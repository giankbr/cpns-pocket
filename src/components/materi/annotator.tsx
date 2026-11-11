"use client";

import { Eraser, Highlighter, MessageSquarePlus, MousePointer2, PenLine, Strikethrough, Trash2, Underline, X } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  type Annotation,
  createAnnotation,
  createInk,
  deleteAnnotation,
  type Ink,
  updateAnnotationNote,
} from "@/app/(app)/catatan/actions";

const COLORS = [
  { id: "yellow", label: "kuning", swatch: "#facc15" },
  { id: "green", label: "hijau", swatch: "#4ade80" },
  { id: "pink", label: "merah muda", swatch: "#f472b6" },
  { id: "blue", label: "biru", swatch: "#60a5fa" },
] as const;
type ColorId = (typeof COLORS)[number]["id"];

const PEN_COLORS = ["#2563eb", "#dc2626", "#16a34a", "#111827"] as const;

// Kept as a runtime <style>: the CSS build pipeline drops ::highlight() rules.
const HIGHLIGHT_CSS = `
::highlight(hl-yellow) { background-color: rgb(250 204 21 / 0.45); }
::highlight(hl-green) { background-color: rgb(74 222 128 / 0.4); }
::highlight(hl-pink) { background-color: rgb(244 114 182 / 0.4); }
::highlight(hl-blue) { background-color: rgb(96 165 250 / 0.4); }
::highlight(ann-underline) { text-decoration: underline; text-decoration-color: var(--primary); text-decoration-thickness: 2px; }
::highlight(ann-strike) { text-decoration: line-through; text-decoration-color: var(--danger); text-decoration-thickness: 2px; }
::highlight(ann-note) { background-color: var(--primary-soft); text-decoration: underline dotted; text-decoration-color: var(--primary); }
::highlight(ann-has-note) { text-decoration: underline dotted; text-decoration-color: var(--primary); }
`;

const kindLabel = { highlight: "Stabilo", underline: "Garis bawah", strike: "Coret", note: "Catatan", ink: "Pena" } as const;

type Tool = "cursor" | "highlight" | "underline" | "strike" | "note" | "pen" | "eraser";
type Settings = { tool: Tool; color: ColorId; pen: string };
type Popover = { x: number; y: number } & ({ mode: "new"; start: number; end: number; quote: string } | { mode: "edit"; id: string });

const SETTINGS_KEY = "cpocket-annotator";
const defaults: Settings = { tool: "highlight", color: "yellow", pen: PEN_COLORS[0] };
const settingsListeners = new Set<() => void>();
let settingsCache: { raw: string | null; value: Settings } = { raw: null, value: defaults };

function readSettings(): Settings {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(SETTINGS_KEY);
  } catch {
    // Storage blocked: defaults for this visit.
  }
  if (raw !== settingsCache.raw) {
    let value = defaults;
    try {
      if (raw) value = { ...defaults, ...(JSON.parse(raw) as Partial<Settings>) };
    } catch {
      value = defaults;
    }
    settingsCache = { raw, value };
  }
  return settingsCache.value;
}

function writeSettings(next: Settings) {
  const raw = JSON.stringify(next);
  settingsCache = { raw, value: next };
  try {
    localStorage.setItem(SETTINGS_KEY, raw);
  } catch {
    // Still applies for this visit through the cache.
  }
  settingsListeners.forEach((listener) => listener());
}

function subscribeSettings(listener: () => void) {
  settingsListeners.add(listener);
  return () => settingsListeners.delete(listener);
}

const noop = () => () => {};
function useHighlightSupport() {
  return useSyncExternalStore(
    noop,
    () => typeof CSS !== "undefined" && "highlights" in CSS,
    () => true,
  );
}

function textNodes(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  return nodes;
}

/** Character offset of (node, offset) within the root's text. */
function offsetOf(root: Node, node: Node, offset: number): number | null {
  if (!root.contains(node)) return null;
  const range = document.createRange();
  range.selectNodeContents(root);
  range.setEnd(node, offset);
  return range.toString().length;
}

function rangeFor(root: Node, start: number, end: number): Range | null {
  let seen = 0;
  const range = document.createRange();
  let started = false;
  for (const node of textNodes(root)) {
    const length = node.data.length;
    if (!started && start < seen + length) {
      range.setStart(node, start - seen);
      started = true;
    }
    if (started && end <= seen + length) {
      range.setEnd(node, end - seen);
      return range;
    }
    seen += length;
  }
  return null;
}

/** Where an annotation sits now: stored offsets if the quote still matches, else found by its quote. */
function locate(root: HTMLElement, annotation: Annotation): [number, number] | null {
  const { start_offset: start, end_offset: end, quote } = annotation;
  if (start === null || end === null) return null;
  const text = root.textContent ?? "";
  if (!quote || text.slice(start, end) === quote) return end <= text.length ? [start, end] : null;
  const found = text.indexOf(quote);
  return found === -1 ? null : [found, found + quote.length];
}

function pathOf(points: [number, number][]) {
  return points.map(([x, y], index) => `${index ? "L" : "M"}${x} ${y}`).join(" ");
}

/**
 * Makes a rendered material behave like a page in a book: pick a tool once (highlighter,
 * underline, strike, pen, eraser, note) and mark as you read. Text marks use the CSS Custom
 * Highlight API, so the rendered content is never mutated; pen strokes are an SVG overlay.
 * Everything is saved per user.
 */
export function Annotator({
  materialId,
  initial,
  children,
}: {
  materialId: string;
  initial: Annotation[];
  children: ReactNode;
}) {
  const pageRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [annotations, setAnnotations] = useState(initial);
  const [popover, setPopover] = useState<Popover | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  const [stroke, setStroke] = useState<[number, number][] | null>(null);
  const strokeRef = useRef<[number, number][] | null>(null);
  const settings = useSyncExternalStore(subscribeSettings, readSettings, () => defaults);
  const supported = useHighlightSupport();
  const { tool, color, pen } = settings;
  const latest = useRef({ tool, color, annotations });
  useEffect(() => {
    latest.current = { tool, color, annotations };
  });

  const texts = annotations.filter((item) => item.kind !== "ink");
  const inks = annotations.filter((item) => item.kind === "ink" && item.ink);

  // Paint text marks.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !supported) return;
    const groups = new Map<string, Range[]>();
    const push = (name: string, range: Range) => groups.set(name, [...(groups.get(name) ?? []), range]);
    for (const annotation of annotations) {
      if (annotation.kind === "ink") continue;
      const position = locate(root, annotation);
      const range = position && rangeFor(root, position[0], position[1]);
      if (!range) continue;
      push(annotation.kind === "highlight" ? `hl-${annotation.color ?? "yellow"}` : `ann-${annotation.kind}`, range);
      if (annotation.note && annotation.kind !== "note") push("ann-has-note", range);
    }
    const names = [...COLORS.map((item) => `hl-${item.id}`), "ann-underline", "ann-strike", "ann-note", "ann-has-note"];
    for (const name of names) {
      const ranges = groups.get(name);
      if (ranges?.length) CSS.highlights.set(name, new Highlight(...ranges));
      else CSS.highlights.delete(name);
    }
    return () => names.forEach((name) => CSS.highlights.delete(name));
  }, [annotations, supported]);

  // Pen strokes scale with the page width.
  useEffect(() => {
    const page = pageRef.current;
    if (!page) return;
    setWidth(page.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(page);
    return () => observer.disconnect();
  }, []);

  const addText = useCallback(
    async (kind: "highlight" | "underline" | "strike" | "note", start: number, end: number, quote: string, note: string | null) => {
      const result = await createAnnotation({ materialId, kind, color: latest.current.color, start, end, quote, note });
      if (result.ok) setAnnotations((current) => [...current, result.data]);
      else setError(result.error);
    },
    [materialId],
  );

  /** Applies the active tool to the current text selection. */
  const applySelection = useCallback(() => {
    const root = rootRef.current;
    const selection = document.getSelection();
    const active = latest.current.tool;
    if (!root || !selection || selection.isCollapsed || selection.rangeCount === 0) return;
    if (active === "pen" || active === "eraser") return;
    const range = selection.getRangeAt(0);
    const start = offsetOf(root, range.startContainer, range.startOffset);
    const end = offsetOf(root, range.endContainer, range.endOffset);
    const quote = range.toString().slice(0, 2000);
    if (start === null || end === null || end <= start || !quote.trim()) return;
    const rect = range.getBoundingClientRect();

    if (active === "highlight" || active === "underline" || active === "strike") {
      selection.removeAllRanges();
      void addText(active, start, end, quote, null);
    } else {
      // "note" tool, or plain cursor: ask what to do with the selection.
      setDraft("");
      setPopover({ mode: "new", start, end, quote, x: rect.left + rect.width / 2, y: rect.bottom });
    }
  }, [addText]);

  // Mouse: apply when the drag ends. Touch/keyboard: apply once the selection settles.
  useEffect(() => {
    let timer = 0;
    let pointerDown = false;
    const onDown = () => {
      pointerDown = true;
    };
    const onUp = (event: PointerEvent) => {
      pointerDown = false;
      if (event.pointerType === "mouse") window.setTimeout(applySelection, 0);
    };
    const onSelection = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (!pointerDown) applySelection();
      }, 700);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("selectionchange", onSelection);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("selectionchange", onSelection);
    };
  }, [applySelection]);

  const close = useCallback(() => {
    setPopover(null);
    setError(null);
  }, []);

  async function remove(id: string) {
    const previous = annotations;
    setAnnotations((current) => current.filter((item) => item.id !== id));
    close();
    const result = await deleteAnnotation(id);
    if (!result.ok) {
      setAnnotations(previous);
      setError(result.error);
    }
  }

  async function saveNote(id: string, note: string) {
    const previous = annotations;
    setAnnotations((current) => current.map((item) => (item.id === id ? { ...item, note: note.trim() || null } : item)));
    close();
    const result = await updateAnnotationNote(id, note);
    if (!result.ok) {
      setAnnotations(previous);
      setError(result.error);
    }
  }

  function hitAt(clientX: number, clientY: number) {
    const root = rootRef.current;
    if (!root) return null;
    const caret = "caretPositionFromPoint" in document ? document.caretPositionFromPoint(clientX, clientY) : null;
    const legacy = !caret && "caretRangeFromPoint" in document ? document.caretRangeFromPoint(clientX, clientY) : null;
    const node = caret?.offsetNode ?? legacy?.startContainer;
    const nodeOffset = caret?.offset ?? legacy?.startOffset;
    if (!node || nodeOffset === undefined) return null;
    const offset = offsetOf(root, node, nodeOffset);
    if (offset === null) return null;
    return (
      [...texts].reverse().find((annotation) => {
        const position = locate(root, annotation);
        return position && offset >= position[0] && offset <= position[1];
      }) ?? null
    );
  }

  // Click on a text mark: erase it (eraser) or open its note.
  function onClick(event: React.MouseEvent) {
    if (!document.getSelection()?.isCollapsed) return;
    const hit = hitAt(event.clientX, event.clientY);
    if (!hit) return;
    if (tool === "eraser") void remove(hit.id);
    else {
      setDraft(hit.note ?? "");
      setPopover({ mode: "edit", id: hit.id, x: event.clientX, y: event.clientY });
    }
  }

  // Pen.
  const scale = (ink: Ink) => (width && ink.w ? width / ink.w : 1);
  function pointIn(event: React.PointerEvent): [number, number] {
    const box = pageRef.current!.getBoundingClientRect();
    return [Math.round((event.clientX - box.left) * 10) / 10, Math.round((event.clientY - box.top) * 10) / 10];
  }
  function penDown(event: React.PointerEvent) {
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Capture is best-effort; drawing still works without it.
    }
    strokeRef.current = [pointIn(event)];
    setStroke(strokeRef.current);
  }
  function penMove(event: React.PointerEvent) {
    const current = strokeRef.current;
    if (!current) return;
    const point = pointIn(event);
    const last = current[current.length - 1];
    if (Math.hypot(point[0] - last[0], point[1] - last[1]) >= 2) {
      strokeRef.current = [...current, point];
      setStroke(strokeRef.current);
    }
  }
  async function penUp() {
    const points = strokeRef.current;
    strokeRef.current = null;
    setStroke(null);
    const w = pageRef.current?.getBoundingClientRect().width ?? width;
    if (!points || points.length < 2 || !w) return;
    const ink: Ink = { w: Math.round(w), color: pen, size: 2.5, points: points.slice(0, 4000) };
    const temporary: Annotation = {
      id: `tmp-${points[0][0]}-${points[0][1]}-${points.length}`,
      material_id: materialId,
      kind: "ink",
      color: null,
      start_offset: null,
      end_offset: null,
      quote: null,
      note: null,
      ink,
      created_at: "",
    };
    setAnnotations((current) => [...current, temporary]);
    const result = await createInk({ materialId, ink });
    setAnnotations((current) => current.flatMap((item) => (item.id === temporary.id ? (result.ok ? [result.data] : []) : [item])));
    if (!result.ok) setError(result.error);
  }

  function scrollTo(annotation: Annotation) {
    const root = rootRef.current;
    const position = root && locate(root, annotation);
    const range = root && position && rangeFor(root, position[0], position[1]);
    if (!range) return;
    window.scrollTo({ top: window.scrollY + range.getBoundingClientRect().top - 160, behavior: "smooth" });
  }

  const setTool = (next: Tool) => {
    document.getSelection()?.removeAllRanges();
    close();
    writeSettings({ ...settings, tool: next });
  };
  const editing = popover?.mode === "edit" ? annotations.find((item) => item.id === popover.id) : null;
  const clampX = (x: number) => Math.min(Math.max(x, 160), (typeof window === "undefined" ? 1200 : window.innerWidth) - 160);
  const hints: Record<Tool, string> = {
    cursor: "Mode baca. Blok teks untuk memilih tindakan, klik tanda untuk membuka catatannya.",
    highlight: "Seret pada teks untuk memberi stabilo.",
    underline: "Seret pada teks untuk menggarisbawahi.",
    strike: "Seret pada teks untuk mencoretnya.",
    note: "Blok teks, lalu tulis catatan untuk bagian itu.",
    pen: "Coret bebas di halaman dengan mouse, jari, atau stylus.",
    eraser: "Klik stabilo, garis, atau coretan pena untuk menghapusnya.",
  };

  return (
    <>
      <style>{HIGHLIGHT_CSS}</style>

      <div className="sticky top-[60px] z-20 -mx-1 mb-4 rounded-xl border border-line bg-surface/95 p-1.5 shadow-[0_8px_24px_-18px_var(--shadow)] backdrop-blur">
        <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Alat tandai">
          <ToolButton label="Mode baca" active={tool === "cursor"} onClick={() => setTool("cursor")}>
            <MousePointer2 size={16} />
          </ToolButton>
          <span className="mx-0.5 h-5 w-px bg-line" />
          <ToolButton label="Stabilo" active={tool === "highlight"} onClick={() => setTool("highlight")}>
            <Highlighter size={16} />
          </ToolButton>
          {tool === "highlight" &&
            COLORS.map((item) => (
              <button
                key={item.id}
                type="button"
                title={`Warna ${item.label}`}
                aria-label={`Warna stabilo ${item.label}`}
                aria-pressed={color === item.id}
                onClick={() => writeSettings({ ...settings, color: item.id })}
                className={`grid size-7 place-items-center rounded-md ${color === item.id ? "bg-canvas ring-1 ring-line-strong" : ""}`}
              >
                <span className="size-3.5 rounded-full" style={{ backgroundColor: item.swatch }} />
              </button>
            ))}
          <ToolButton label="Garis bawah" active={tool === "underline"} onClick={() => setTool("underline")}>
            <Underline size={16} />
          </ToolButton>
          <ToolButton label="Coret teks" active={tool === "strike"} onClick={() => setTool("strike")}>
            <Strikethrough size={16} />
          </ToolButton>
          <ToolButton label="Pena" active={tool === "pen"} onClick={() => setTool("pen")}>
            <PenLine size={16} />
          </ToolButton>
          {tool === "pen" &&
            PEN_COLORS.map((item) => (
              <button
                key={item}
                type="button"
                aria-label={`Warna pena ${item}`}
                aria-pressed={pen === item}
                onClick={() => writeSettings({ ...settings, pen: item })}
                className={`grid size-7 place-items-center rounded-md ${pen === item ? "bg-canvas ring-1 ring-line-strong" : ""}`}
              >
                <span className="size-3.5 rounded-full border border-line" style={{ backgroundColor: item }} />
              </button>
            ))}
          <ToolButton label="Catatan" active={tool === "note"} onClick={() => setTool("note")}>
            <MessageSquarePlus size={16} />
          </ToolButton>
          <ToolButton label="Penghapus" active={tool === "eraser"} onClick={() => setTool("eraser")}>
            <Eraser size={16} />
          </ToolButton>
          <span className="ml-1 min-w-0 flex-1 truncate text-xs text-subtle">{hints[tool]}</span>
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      {!supported && (
        <p className="mb-3 rounded-lg bg-canvas px-3 py-2 text-xs text-muted">
          Browser ini belum bisa menampilkan stabilo pada teks; pena dan catatan tetap berfungsi.
        </p>
      )}

      {/* Pen handlers live on the container, not the SVG, so they win over text selection. */}
      <div
        ref={pageRef}
        className={`relative ${tool === "pen" ? "cursor-crosshair touch-none select-none" : ""}`}
        onPointerDown={tool === "pen" ? penDown : undefined}
        onPointerMove={tool === "pen" ? penMove : undefined}
        onPointerUp={tool === "pen" ? () => void penUp() : undefined}
        onPointerCancel={tool === "pen" ? () => setStroke(null) : undefined}
      >
        <div ref={rootRef} onClick={onClick} className={tool === "eraser" ? "cursor-pointer" : ""}>
          {children}
        </div>
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
          {inks.map((item) => (
            <path
              key={item.id}
              d={pathOf(item.ink!.points)}
              transform={`scale(${scale(item.ink!)})`}
              fill="none"
              stroke={item.ink!.color}
              strokeWidth={item.ink!.size}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={tool === "eraser" && !item.id.startsWith("tmp-") ? "cursor-pointer hover:opacity-50" : ""}
              style={tool === "eraser" && !item.id.startsWith("tmp-") ? { pointerEvents: "stroke" } : undefined}
              onClick={tool === "eraser" && !item.id.startsWith("tmp-") ? () => void remove(item.id) : undefined}
            />
          ))}
          {stroke && <path d={pathOf(stroke)} fill="none" stroke={pen} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />}
        </svg>
      </div>

      {popover && (
        <div
          className="fixed z-40 w-72 -translate-x-1/2 rounded-xl border border-line bg-surface p-3 shadow-[0_12px_32px_-12px_var(--shadow)]"
          style={{ left: clampX(popover.x), top: Math.min(popover.y + 10, (typeof window === "undefined" ? 800 : window.innerHeight) - 260) }}
        >
          {popover.mode === "new" ? (
            <>
              {tool === "cursor" && (
                <div className="mb-2 flex items-center gap-1 border-b border-line pb-2">
                  {COLORS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-label={`Stabilo ${item.label}`}
                      onClick={() => {
                        writeSettings({ ...settings, color: item.id });
                        latest.current.color = item.id;
                        document.getSelection()?.removeAllRanges();
                        close();
                        void addText("highlight", popover.start, popover.end, popover.quote, null);
                      }}
                      className="grid size-8 place-items-center rounded-lg hover:bg-canvas"
                    >
                      <span className="size-4 rounded-full" style={{ backgroundColor: item.swatch }} />
                    </button>
                  ))}
                  <span className="flex-1" />
                  <button type="button" onClick={close} aria-label="Tutup" className="text-subtle hover:text-ink">
                    <X size={15} />
                  </button>
                </div>
              )}
              <NoteEditor
                quote={popover.quote}
                value={draft}
                onChange={setDraft}
                onCancel={() => {
                  document.getSelection()?.removeAllRanges();
                  close();
                }}
                onSave={() => {
                  if (!draft.trim()) return;
                  document.getSelection()?.removeAllRanges();
                  close();
                  void addText("note", popover.start, popover.end, popover.quote, draft);
                }}
              />
            </>
          ) : (
            editing && (
              <>
                <div className="mb-2 flex items-center gap-2 text-xs text-muted">
                  <Highlighter size={13} /> {kindLabel[editing.kind]}
                  <span className="flex-1" />
                  <button type="button" onClick={() => void remove(editing.id)} className="inline-flex items-center gap-1 text-danger hover:underline">
                    <Trash2 size={13} /> Hapus
                  </button>
                  <button type="button" onClick={close} aria-label="Tutup" className="text-subtle hover:text-ink">
                    <X size={15} />
                  </button>
                </div>
                <NoteEditor quote={editing.quote ?? ""} value={draft} onChange={setDraft} onCancel={close} onSave={() => void saveNote(editing.id, draft)} />
              </>
            )
          )}
        </div>
      )}

      {(texts.length > 0 || inks.length > 0) && (
        <section className="mt-8 border-t border-line pt-5">
          <h2 className="mb-3 text-sm text-muted">
            Tanda &amp; catatan di materi ini ({texts.length}){inks.length > 0 && ` · ${inks.length} coretan pena`}
          </h2>
          <ul className="space-y-2">
            {texts.map((annotation) => (
              <li key={annotation.id} className="flex items-start gap-3 rounded-lg bg-canvas px-3 py-2 text-sm">
                <button type="button" onClick={() => scrollTo(annotation)} className="min-w-0 flex-1 text-left">
                  <span className="text-xs text-subtle">{kindLabel[annotation.kind]}</span>
                  <span className="line-clamp-2 text-muted">“{annotation.quote}”</span>
                  {annotation.note && <span className="mt-1 block whitespace-pre-line text-ink">{annotation.note}</span>}
                </button>
                <button
                  type="button"
                  onClick={() => void remove(annotation.id)}
                  aria-label="Hapus tanda"
                  className="mt-0.5 text-subtle transition-colors duration-150 hover:text-danger"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function ToolButton({ label, active, onClick, children }: { label: string; active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`grid size-8 place-items-center rounded-lg transition-colors duration-150 ${
        active ? "bg-primary text-white" : "text-muted hover:bg-canvas hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function NoteEditor({
  quote,
  value,
  onChange,
  onSave,
  onCancel,
}: {
  quote: string;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-2">
      {quote && <p className="line-clamp-2 border-l-2 border-line-strong pl-2 text-xs text-muted">{quote}</p>}
      <textarea
        autoFocus
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        maxLength={4000}
        placeholder="Tulis catatan…"
        className="w-full resize-none rounded-lg border border-line-strong bg-surface px-2.5 py-2 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
      />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg border border-line px-2.5 py-1 text-xs">
          Batal
        </button>
        <button type="button" onClick={onSave} className="btn-solid rounded-lg px-2.5 py-1 text-xs font-medium">
          Simpan
        </button>
      </div>
    </div>
  );
}

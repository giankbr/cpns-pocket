"use client";

import { Highlighter, MessageSquarePlus, Strikethrough, Trash2, Underline, X } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  type Annotation,
  createAnnotation,
  deleteAnnotation,
  updateAnnotationNote,
} from "@/app/(app)/catatan/actions";

const COLORS = [
  { id: "yellow", label: "Kuning", swatch: "#facc15" },
  { id: "green", label: "Hijau", swatch: "#4ade80" },
  { id: "pink", label: "Merah muda", swatch: "#f472b6" },
  { id: "blue", label: "Biru", swatch: "#60a5fa" },
] as const;

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

const kindLabel = { highlight: "Stabilo", underline: "Garis bawah", strike: "Coret", note: "Catatan" } as const;

type Pending = { start: number; end: number; quote: string; x: number; y: number };
type Open = { id: string; x: number; y: number };

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

/** Finds where an annotation sits now: stored offsets if the quote still matches, else by searching the quote. */
function locate(root: HTMLElement, annotation: Annotation): [number, number] | null {
  const { start_offset: start, end_offset: end, quote } = annotation;
  if (start === null || end === null) return null;
  const text = root.textContent ?? "";
  if (!quote || text.slice(start, end) === quote) return end <= text.length ? [start, end] : null;
  const found = text.indexOf(quote);
  return found === -1 ? null : [found, found + quote.length];
}

/**
 * Wraps a rendered material and lets the reader highlight, underline, strike or annotate
 * selected text. Marks are painted with the CSS Custom Highlight API, so the rendered
 * content is never mutated.
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
  const rootRef = useRef<HTMLDivElement>(null);
  const [annotations, setAnnotations] = useState(initial);
  const [pending, setPending] = useState<Pending | null>(null);
  const [open, setOpen] = useState<Open | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supported = useHighlightSupport();

  // Paint marks.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !supported) return;
    const groups = new Map<string, Range[]>();
    for (const annotation of annotations) {
      const position = locate(root, annotation);
      const range = position && rangeFor(root, position[0], position[1]);
      if (!range) continue;
      const name = annotation.kind === "highlight" ? `hl-${annotation.color ?? "yellow"}` : `ann-${annotation.kind}`;
      groups.set(name, [...(groups.get(name) ?? []), range]);
      if (annotation.note && annotation.kind !== "note") groups.set("ann-has-note", [...(groups.get("ann-has-note") ?? []), range]);
    }
    const names = [...COLORS.map((color) => `hl-${color.id}`), "ann-underline", "ann-strike", "ann-note", "ann-has-note"];
    for (const name of names) {
      const ranges = groups.get(name);
      if (ranges?.length) CSS.highlights.set(name, new Highlight(...ranges));
      else CSS.highlights.delete(name);
    }
    return () => names.forEach((name) => CSS.highlights.delete(name));
  }, [annotations, supported]);

  // Selection → toolbar.
  useEffect(() => {
    let timer = 0;
    const onSelection = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const root = rootRef.current;
        const selection = document.getSelection();
        if (!root || !selection || selection.isCollapsed || selection.rangeCount === 0) {
          setPending((current) => (current && draft === null ? null : current));
          return;
        }
        const range = selection.getRangeAt(0);
        const start = offsetOf(root, range.startContainer, range.startOffset);
        const end = offsetOf(root, range.endContainer, range.endOffset);
        const quote = range.toString();
        if (start === null || end === null || end <= start || !quote.trim()) return;
        const rect = range.getBoundingClientRect();
        setOpen(null);
        setPending({ start, end, quote: quote.slice(0, 2000), x: rect.left + rect.width / 2, y: rect.top });
      }, 150);
    };
    document.addEventListener("selectionchange", onSelection);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("selectionchange", onSelection);
    };
  }, [draft]);

  const closeAll = useCallback(() => {
    setPending(null);
    setOpen(null);
    setDraft(null);
    setError(null);
  }, []);

  async function add(kind: Annotation["kind"], color: Annotation["color"], note: string | null) {
    if (!pending) return;
    const { start, end, quote } = pending;
    document.getSelection()?.removeAllRanges();
    closeAll();
    const result = await createAnnotation({ materialId, kind, color, start, end, quote, note });
    if (result.ok) setAnnotations((current) => [...current, result.data]);
    else setError(result.error);
  }

  async function remove(id: string) {
    const previous = annotations;
    setAnnotations((current) => current.filter((item) => item.id !== id));
    closeAll();
    const result = await deleteAnnotation(id);
    if (!result.ok) {
      setAnnotations(previous);
      setError(result.error);
    }
  }

  async function saveNote(id: string, note: string) {
    const previous = annotations;
    setAnnotations((current) => current.map((item) => (item.id === id ? { ...item, note: note.trim() || null } : item)));
    closeAll();
    const result = await updateAnnotationNote(id, note);
    if (!result.ok) {
      setAnnotations(previous);
      setError(result.error);
    }
  }

  // Click on a mark → popover.
  function onClick(event: React.MouseEvent) {
    const root = rootRef.current;
    if (!root || !document.getSelection()?.isCollapsed) return;
    const caret =
      "caretPositionFromPoint" in document
        ? document.caretPositionFromPoint(event.clientX, event.clientY)
        : null;
    const legacy = !caret && "caretRangeFromPoint" in document ? document.caretRangeFromPoint(event.clientX, event.clientY) : null;
    const node = caret?.offsetNode ?? legacy?.startContainer;
    const nodeOffset = caret?.offset ?? legacy?.startOffset;
    if (!node || nodeOffset === undefined) return;
    const offset = offsetOf(root, node, nodeOffset);
    if (offset === null) return;
    const hit = [...annotations].reverse().find((annotation) => {
      const position = locate(root, annotation);
      return position && offset >= position[0] && offset <= position[1];
    });
    if (hit) {
      setPending(null);
      setDraft(hit.note ?? "");
      setOpen({ id: hit.id, x: event.clientX, y: event.clientY });
    }
  }

  function scrollTo(annotation: Annotation) {
    const root = rootRef.current;
    const position = root && locate(root, annotation);
    const range = root && position && rangeFor(root, position[0], position[1]);
    if (!range) return;
    const rect = range.getBoundingClientRect();
    window.scrollTo({ top: window.scrollY + rect.top - 140, behavior: "smooth" });
  }

  const active = open ? annotations.find((item) => item.id === open.id) : null;
  const floating = "fixed z-40 -translate-x-1/2 rounded-xl border border-line bg-surface shadow-[0_12px_32px_-12px_var(--shadow)]";
  const clampX = (x: number) => Math.min(Math.max(x, 150), (typeof window === "undefined" ? 1000 : window.innerWidth) - 150);

  return (
    <>
      <style>{HIGHLIGHT_CSS}</style>
      <div ref={rootRef} onClick={onClick}>
        {children}
      </div>

      {!supported && (
        <p className="mt-4 rounded-lg bg-canvas px-3 py-2 text-xs text-muted">
          Browser ini belum mendukung stabilo pada teks. Catatan tetap bisa dibuat di halaman Catatan.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {pending && supported && (
        <div
          className={`${floating} ${draft === null ? "-translate-y-full p-1.5" : "w-72 -translate-y-full p-3"}`}
          style={{ left: clampX(pending.x), top: Math.max(pending.y - 8, draft === null ? 52 : 190) }}
          onMouseDown={(event) => draft === null && event.preventDefault()}
        >
          {draft === null ? (
            <div className="flex items-center gap-1">
              {COLORS.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  title={`Stabilo ${color.label.toLowerCase()}`}
                  aria-label={`Stabilo ${color.label.toLowerCase()}`}
                  onClick={() => void add("highlight", color.id, null)}
                  className="grid size-8 place-items-center rounded-lg transition-colors duration-150 hover:bg-canvas"
                >
                  <span className="size-4 rounded-full" style={{ backgroundColor: color.swatch }} />
                </button>
              ))}
              <span className="mx-0.5 h-5 w-px bg-line" />
              <ToolButton label="Garis bawah" onClick={() => void add("underline", null, null)}>
                <Underline size={16} />
              </ToolButton>
              <ToolButton label="Coret" onClick={() => void add("strike", null, null)}>
                <Strikethrough size={16} />
              </ToolButton>
              <ToolButton label="Tambah catatan" onClick={() => setDraft("")}>
                <MessageSquarePlus size={16} />
              </ToolButton>
            </div>
          ) : (
            <NoteEditor
              quote={pending.quote}
              value={draft}
              onChange={setDraft}
              onCancel={closeAll}
              onSave={() => draft.trim() && void add("note", null, draft)}
            />
          )}
        </div>
      )}

      {open && active && (
        <div className={`${floating} w-72 p-3`} style={{ left: clampX(open.x), top: Math.min(open.y + 14, window.innerHeight - 250) }}>
          <div className="mb-2 flex items-center gap-2 text-xs text-muted">
            <Highlighter size={13} /> {kindLabel[active.kind]}
            <span className="flex-1" />
            <button type="button" onClick={() => void remove(active.id)} className="inline-flex items-center gap-1 text-danger hover:underline">
              <Trash2 size={13} /> Hapus
            </button>
            <button type="button" onClick={closeAll} aria-label="Tutup" className="text-subtle hover:text-ink">
              <X size={15} />
            </button>
          </div>
          <NoteEditor
            quote={active.quote ?? ""}
            value={draft ?? ""}
            onChange={setDraft}
            onCancel={closeAll}
            onSave={() => void saveNote(active.id, draft ?? "")}
          />
        </div>
      )}

      {annotations.length > 0 && (
        <section className="mt-8 border-t border-line pt-5">
          <h2 className="mb-3 text-sm text-muted">Tanda &amp; catatan di materi ini ({annotations.length})</h2>
          <ul className="space-y-2">
            {annotations.map((annotation) => (
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

function ToolButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-lg text-muted transition-colors duration-150 hover:bg-canvas hover:text-ink"
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

"use client";

import { LoaderCircle, MessageCircle, Play, Target, X } from "lucide-react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { startDailyChallenge } from "@/app/(app)/sesi/actions";
import { AiChat } from "@/components/ai/ai-chat";

type DocumentPictureInPicture = {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
};

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture;
  }
}

export type MiniTab = "soal" | "ai";

type MiniContextValue = {
  supported: boolean;
  active: boolean;
  pipWindow: Window | null;
  tab: MiniTab;
  setTab: (tab: MiniTab) => void;
  open: (tab?: MiniTab) => Promise<void>;
  close: () => void;
  error: string | null;
  /** Element inside the mini window where an open study session portals its view. */
  sessionSlot: HTMLElement | null;
  hasSession: boolean;
  setHasSession: (value: boolean) => void;
};

const MiniContext = createContext<MiniContextValue | null>(null);

export function useMini() {
  const value = useContext(MiniContext);
  if (!value) throw new Error("useMini must be used inside <MiniModeProvider>");
  return value;
}

const noopSubscribe = () => () => {};

function usePipSupported() {
  return useSyncExternalStore(
    noopSubscribe,
    () => window.isSecureContext && "documentPictureInPicture" in window,
    () => false,
  );
}

/** Copies the app's styles, fonts and theme into the floating document. */
function mirrorDocument(target: Window) {
  const doc = target.document;
  const base = doc.createElement("base");
  base.href = window.location.origin;
  doc.head.append(base);

  for (const sheet of Array.from(document.styleSheets)) {
    // Linked sheets are re-linked, not inlined: their relative font URLs
    // (../media/*.woff2) only resolve against the sheet's own URL.
    if (sheet.href) {
      const link = doc.createElement("link");
      link.rel = "stylesheet";
      link.href = sheet.href;
      doc.head.append(link);
      continue;
    }
    try {
      const style = doc.createElement("style");
      style.textContent = Array.from(sheet.cssRules, (rule) => rule.cssText).join("\n");
      doc.head.append(style);
    } catch {
      // Unreadable inline sheet: skip it.
    }
  }

  const sync = () => {
    doc.documentElement.className = `${document.documentElement.className} h-full`;
    doc.documentElement.dataset.theme = document.documentElement.dataset.theme ?? "light";
  };
  sync();
  doc.title = "Daily Challenge";
  doc.body.className = "h-full bg-surface text-ink";

  const observer = new MutationObserver(sync);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
  target.addEventListener("pagehide", () => observer.disconnect(), { once: true });
}

/**
 * App-wide Mini Mode. Lives in the app shell, so the floating window stays open
 * while navigating, and any page can open it on a tab.
 */
export function MiniModeProvider({ children }: { children: ReactNode }) {
  const supported = usePipSupported();
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [inlineOpen, setInlineOpen] = useState(false);
  const [tab, setTab] = useState<MiniTab>("ai");
  const [error, setError] = useState<string | null>(null);
  const [sessionSlot, setSessionSlot] = useState<HTMLElement | null>(null);
  const [hasSession, setHasSession] = useState(false);

  const open = useCallback(
    async (next?: MiniTab) => {
      setTab(next ?? (hasSession ? "soal" : "ai"));
      setError(null);
      if (pipWindow || inlineOpen) return;
      if (!supported || !window.documentPictureInPicture) {
        setInlineOpen(true);
        return;
      }
      try {
        // Must run within the click (user activation).
        const pip = await window.documentPictureInPicture.requestWindow({ width: 340, height: 440 });
        mirrorDocument(pip);
        pip.addEventListener("pagehide", () => setPipWindow(null), { once: true });
        setPipWindow(pip);
      } catch {
        setError("Jendela mengambang tidak dapat dibuka; mode mini ditampilkan di halaman.");
        setInlineOpen(true);
      }
    },
    [hasSession, inlineOpen, pipWindow, supported],
  );

  const close = useCallback(() => {
    pipWindow?.close();
    setPipWindow(null);
    setInlineOpen(false);
  }, [pipWindow]);

  // Closing the tab or logging out closes the floating window too.
  useEffect(() => () => pipWindow?.close(), [pipWindow]);

  const value = useMemo<MiniContextValue>(
    () => ({
      supported,
      active: Boolean(pipWindow) || inlineOpen,
      pipWindow,
      tab,
      setTab,
      open,
      close,
      error,
      sessionSlot,
      hasSession,
      setHasSession,
    }),
    [supported, pipWindow, inlineOpen, tab, open, close, error, sessionSlot, hasSession],
  );

  const hub = <MiniHub value={value} onSlot={setSessionSlot} />;

  return (
    <MiniContext.Provider value={value}>
      {children}
      {pipWindow && createPortal(hub, pipWindow.document.body)}
      {!pipWindow && inlineOpen && (
        <div className="fixed right-4 bottom-4 z-40 h-[440px] max-h-[calc(100dvh-2rem)] w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_60px_-20px_var(--shadow)]">
          {hub}
        </div>
      )}
    </MiniContext.Provider>
  );
}

function MiniHub({ value, onSlot }: { value: MiniContextValue; onSlot: (element: HTMLElement | null) => void }) {
  const tabs: { id: MiniTab; label: string; icon: typeof Target }[] = [
    { id: "soal", label: "Soal", icon: Target },
    { id: "ai", label: "Tanya AI", icon: MessageCircle },
  ];

  return (
    <div className="flex h-full flex-col gap-2.5 p-3">
      <div className="flex items-center gap-2">
        <span className="font-serif text-lg leading-none">Daily Challenge</span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={value.close}
          aria-label="Tutup mode mini"
          className="grid size-7 place-items-center rounded-md text-subtle transition-colors duration-150 hover:text-ink"
        >
          <X size={16} />
        </button>
      </div>

      <div role="tablist" className="grid grid-cols-2 gap-1 rounded-lg bg-canvas p-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={value.tab === id}
            onClick={() => value.setTab(id)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-md py-1 text-xs transition-colors duration-150 ${
              value.tab === id ? "bg-surface text-ink shadow-[0_1px_2px_var(--shadow)]" : "text-muted hover:text-ink"
            }`}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      <div className="relative min-h-0 flex-1">
        {/* Always mounted so an open session can keep its portal target. */}
        <div ref={onSlot} className={`h-full ${value.tab === "soal" && value.hasSession ? "" : "hidden"}`} />
        {value.tab === "soal" && !value.hasSession && <DailyStart />}
        {value.tab === "ai" && <AiChat compact />}
      </div>
    </div>
  );
}

/** No session open: start today's short challenge from questions not answered yet. */
function DailyStart() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function start() {
    setError(null);
    startTransition(async () => {
      const result = await startDailyChallenge();
      if ("error" in result) setError(result.error);
      // The main window navigates; this floating window then shows the session.
      else router.push(`/sesi/${result.id}`);
    });
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <p className="font-serif text-2xl leading-7">5 soal hari ini</p>
      <p className="max-w-60 text-xs leading-5 text-muted">Soal acak yang belum pernah kamu jawab. Kerjakan langsung dari jendela ini.</p>
      <button
        type="button"
        onClick={start}
        disabled={pending}
        className="btn-solid inline-flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-[filter] duration-150 hover:brightness-110 disabled:opacity-60"
      >
        {pending ? <LoaderCircle size={15} className="animate-spin" /> : <Play size={15} />} Mulai
      </button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

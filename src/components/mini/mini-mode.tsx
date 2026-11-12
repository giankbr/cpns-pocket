"use client";

import { MessageCircle, Target, X } from "lucide-react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { AiChat } from "@/components/ai/ai-chat";
import { MiniPractice, type MiniPracticeState } from "./mini-practice";

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
  /** Standalone practice run inside the mini window (used when no session page is open). */
  practice: MiniPracticeState;
  setPractice: (state: MiniPracticeState) => void;
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
  const [practice, setPractice] = useState<MiniPracticeState>({ stage: "intro" });

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
      practice,
      setPractice,
    }),
    [supported, pipWindow, inlineOpen, tab, open, close, error, sessionSlot, hasSession, practice],
  );

  const hub = <MiniHub value={value} onSlot={setSessionSlot} />;

  return (
    <MiniContext.Provider value={value}>
      {children}
      {pipWindow && createPortal(hub, pipWindow.document.body)}
      {!pipWindow && inlineOpen && (
        // Bottom sheet on phones, floating 340×440 card from `sm` up.
        <div className="fixed inset-x-2 bottom-2 z-40 h-[70dvh] overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_60px_-20px_var(--shadow)] sm:inset-x-auto sm:right-4 sm:bottom-4 sm:h-[440px] sm:max-h-[calc(100dvh-2rem)] sm:w-[340px]">
          {hub}
        </div>
      )}
    </MiniContext.Provider>
  );
}

function MiniHub({ value, onSlot }: { value: MiniContextValue; onSlot: (element: HTMLElement | null) => void }) {
  const tabs: { id: MiniTab; label: string; icon: typeof Target }[] = [
    { id: "soal", label: "Soal", icon: Target },
    { id: "ai", label: "AI", icon: MessageCircle },
  ];

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[720px] flex-col gap-2 p-2.5">
      <div className="flex items-center gap-2">
        <span className="min-w-0 truncate font-serif text-[17px] leading-none">Daily Challenge</span>
        <span className="flex-1" />
        <div role="tablist" className="flex shrink-0 gap-0.5 rounded-md bg-canvas p-0.5">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={value.tab === id}
              aria-label={id === "ai" ? "Tanya AI" : label}
              onClick={() => value.setTab(id)}
              className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] transition-colors duration-150 ${
                value.tab === id ? "bg-surface text-ink shadow-[0_1px_2px_var(--shadow)]" : "text-muted hover:text-ink"
              }`}
            >
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={value.close}
          aria-label="Tutup mode mini"
          className="grid size-6 shrink-0 place-items-center rounded-md text-subtle transition-colors duration-150 hover:text-ink"
        >
          <X size={15} />
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        {/* Always mounted so an open session page can keep its portal target. */}
        <div ref={onSlot} className={`h-full ${value.tab === "soal" && value.hasSession ? "" : "hidden"}`} />
        {value.tab === "soal" && !value.hasSession && <MiniPractice state={value.practice} setState={value.setPractice} />}
        {value.tab === "ai" && <AiChat compact />}
      </div>
    </div>
  );
}

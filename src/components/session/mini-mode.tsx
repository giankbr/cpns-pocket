"use client";

import { useShallow } from "zustand/react/shallow";
import { X } from "lucide-react";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { progressOf } from "@/lib/study/session-state";
import { QuestionView } from "./question-view";
import { formatRemaining, useCountdown, useSession } from "./session-context";

type DocumentPictureInPicture = {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
  window: Window | null;
};

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture;
  }
}

const noopSubscribe = () => () => {};

/** True only in browsers exposing the Document Picture-in-Picture API in a secure context. */
export function usePipSupported() {
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
    try {
      const style = doc.createElement("style");
      style.textContent = Array.from(sheet.cssRules, (rule) => rule.cssText).join("\n");
      doc.head.append(style);
    } catch {
      // Cross-origin sheet: link it instead of reading its rules.
      if (sheet.href) {
        const link = doc.createElement("link");
        link.rel = "stylesheet";
        link.href = sheet.href;
        doc.head.append(link);
      }
    }
  }

  const sync = () => {
    doc.documentElement.className = document.documentElement.className;
    doc.documentElement.dataset.theme = document.documentElement.dataset.theme ?? "light";
  };
  sync();
  doc.title = "CPNS Pocket · Mini";
  doc.body.className = "min-h-full bg-surface text-ink";

  const observer = new MutationObserver(sync);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
  target.addEventListener("pagehide", () => observer.disconnect(), { once: true });
}

export function useMiniMode() {
  const supported = usePipSupported();
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [inlineOpen, setInlineOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(async () => {
    setError(null);
    if (!supported || !window.documentPictureInPicture) {
      setInlineOpen(true);
      return;
    }
    try {
      // Must run inside the click handler (user activation).
      const pip = await window.documentPictureInPicture.requestWindow({ width: 340, height: 440 });
      mirrorDocument(pip);
      pip.addEventListener("pagehide", () => setPipWindow(null), { once: true });
      setPipWindow(pip);
    } catch {
      setError("Jendela mini tidak dapat dibuka. Memakai mode mini di halaman ini.");
      setInlineOpen(true);
    }
  }, [supported]);

  const close = useCallback(() => {
    pipWindow?.close();
    setPipWindow(null);
    setInlineOpen(false);
  }, [pipWindow]);

  // Leaving the session page closes the floating window.
  useEffect(() => () => pipWindow?.close(), [pipWindow]);

  return { supported, pipWindow, inlineOpen, open, close, error, active: Boolean(pipWindow) || inlineOpen };
}

export function MiniPlayer({ onClose }: { onClose: () => void }) {
  const progress = useSession(useShallow(progressOf));
  const deadline = useSession((s) => s.deadline);
  const remaining = useCountdown(deadline);
  const percent = progress.total ? (progress.answered / progress.total) * 100 : 0;

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <div className="flex items-center gap-2">
        <span className="font-serif text-lg leading-none">CPNS Pocket</span>
        <span className="flex-1" />
        {remaining !== null && (
          <span className={`text-sm tabular-nums ${remaining < 5 * 60_000 ? "text-danger" : "text-muted"}`}>
            {formatRemaining(remaining)}
          </span>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup mode mini"
          className="grid size-7 place-items-center rounded-md text-subtle transition-colors duration-150 hover:text-ink"
        >
          <X size={16} />
        </button>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-track" aria-label={`${progress.answered} dari ${progress.total} dijawab`}>
        <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${percent}%` }} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <QuestionView compact />
      </div>
    </div>
  );
}

/** Renders Mini Mode into the PiP window, or as a floating inline panel as fallback. */
export function MiniModeHost({ mini }: { mini: ReturnType<typeof useMiniMode> }) {
  if (mini.pipWindow) {
    return createPortal(<MiniPlayer onClose={mini.close} />, mini.pipWindow.document.body);
  }
  if (mini.inlineOpen) {
    return (
      <div className="fixed right-4 bottom-4 z-40 h-[440px] w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_60px_-20px_var(--shadow)]">
        <MiniPlayer onClose={mini.close} />
      </div>
    );
  }
  return null;
}

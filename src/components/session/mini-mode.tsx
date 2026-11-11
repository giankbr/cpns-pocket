"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useShallow } from "zustand/react/shallow";
import { useMini } from "@/components/mini/mini-mode";
import { progressOf } from "@/lib/study/session-state";
import { QuestionView } from "./question-view";
import { formatRemaining, useCountdown, useSession } from "./session-context";

/**
 * Registers the open session with the app-wide Mini Mode and renders its compact view
 * into the mini window's slot. Rendered inside <SessionProvider>, so the floating view
 * reads and writes the same store as the page.
 */
export function SessionMiniPortal() {
  const { setHasSession, sessionSlot } = useMini();

  useEffect(() => {
    setHasSession(true);
    return () => setHasSession(false);
  }, [setHasSession]);

  return sessionSlot ? createPortal(<SessionMiniView />, sessionSlot) : null;
}

function SessionMiniView() {
  const progress = useSession(useShallow(progressOf));
  const deadline = useSession((s) => s.deadline);
  const remaining = useCountdown(deadline);
  const percent = progress.total ? (progress.answered / progress.total) * 100 : 0;

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center gap-2 text-xs text-muted tabular-nums">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-track" aria-hidden>
          <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${percent}%` }} />
        </div>
        <span>
          {progress.answered}/{progress.total}
        </span>
        {remaining !== null && (
          <span className={remaining < 5 * 60_000 ? "text-danger" : "text-ink"}>{formatRemaining(remaining)}</span>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <QuestionView compact />
      </div>
    </div>
  );
}

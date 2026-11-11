"use client";

import { useRouter } from "next/navigation";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { useStore } from "zustand";
import { finishSession, setBookmark, submitAnswer } from "@/app/(app)/sesi/actions";
import type { SessionInit } from "@/lib/study/session-state";
import { createSessionStore, type SessionStore, type SessionStoreState } from "@/lib/study/session-store";

const SessionContext = createContext<SessionStore | null>(null);

export function SessionProvider({ init, children }: { init: SessionInit; children: ReactNode }) {
  const [store] = useState(() => createSessionStore(init));
  return <SessionContext.Provider value={store}>{children}</SessionContext.Provider>;
}

function useSessionStore() {
  const store = useContext(SessionContext);
  if (!store) throw new Error("useSession must be used inside <SessionProvider>");
  return store;
}

export function useSession<T>(selector: (state: SessionStoreState) => T): T {
  return useStore(useSessionStore(), selector);
}

/** Actions shared by the main view and Mini Mode; all state goes through the store. */
export function useSessionActions() {
  const store = useSessionStore();
  const router = useRouter();

  const toResults = useCallback(() => {
    router.replace(`/sesi/${store.getState().sessionId}/hasil`);
    router.refresh();
  }, [router, store]);

  const answer = useCallback(
    async (questionId: string, optionId: string) => {
      const { dispatch, sessionId, answers } = store.getState();
      const previous = answers[questionId];
      dispatch({ type: "submit:start", questionId, optionId });
      // submit:start is a no-op when locked; don't send anything then.
      if (!store.getState().pending[questionId]) return;

      const result = await submitAnswer({ sessionId, questionId, optionId });
      switch (result.status) {
        case "saved":
          dispatch({ type: "submit:saved", questionId, optionId });
          break;
        case "evaluated":
          dispatch({ type: "submit:evaluated", feedback: result.feedback });
          break;
        case "closed":
        case "expired":
          dispatch({ type: "closed" });
          toResults();
          break;
        case "error":
          dispatch({ type: "submit:failed", questionId, previous, message: result.message });
      }
    },
    [store, toResults],
  );

  const toggleBookmark = useCallback(
    async (questionId: string) => {
      const { dispatch, bookmarks } = store.getState();
      const next = !bookmarks[questionId];
      dispatch({ type: "bookmark", questionId, value: next });
      const { ok } = await setBookmark(questionId, next);
      if (!ok) dispatch({ type: "bookmark", questionId, value: !next });
    },
    [store],
  );

  const finish = useCallback(async () => {
    const { ok } = await finishSession(store.getState().sessionId);
    if (ok) {
      store.getState().dispatch({ type: "closed" });
      toResults();
    }
    return ok;
  }, [store, toResults]);

  return { answer, toggleBookmark, finish, dispatch: store.getState().dispatch };
}

/** Milliseconds left until `deadline` (null when untimed), ticking every second. */
export function useCountdown(deadline: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (deadline === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [deadline]);
  return deadline === null ? null : Math.max(deadline - now, 0);
}

export function formatRemaining(ms: number) {
  const total = Math.ceil(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

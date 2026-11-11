import { createStore } from "zustand/vanilla";
import {
  createSessionState,
  type SessionAction,
  type SessionInit,
  sessionReducer,
  type SessionState,
} from "./session-state.ts";

export type SessionStoreState = SessionState & { dispatch: (action: SessionAction) => void };

/** One store per open session; the main view and Mini Mode both subscribe to it. */
export function createSessionStore(init: SessionInit) {
  return createStore<SessionStoreState>()((set) => ({
    ...createSessionState(init),
    dispatch: (action) => set((state) => sessionReducer(state, action)),
  }));
}

export type SessionStore = ReturnType<typeof createSessionStore>;

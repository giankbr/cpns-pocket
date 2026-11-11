/**
 * Pure state machine for a study session. Shared by the main view and Mini Mode
 * (Document Picture-in-Picture) through one store, so both always render the same state.
 * No imports besides types: runs under `node --test` without a bundler.
 */

export type SessionMode = "practice" | "exam";
export type SessionStatus = "in_progress" | "completed" | "abandoned";
export type SubjectCode = "TWK" | "TIU" | "TKP" | "ENG";

export type SessionQuestion = {
  id: string;
  prompt: string;
  type: "objective" | "weighted";
  difficulty: "easy" | "medium" | "hard";
  subject: SubjectCode;
  topic: string;
  /** True for questions written for this app (not taken from a source document). */
  appMade?: boolean;
  options: { id: string; label: string }[];
};

export type OptionKey = { id: string; is_correct: boolean | null; score: number | null };

export type Feedback = {
  question_id: string;
  selected_option_id: string | null;
  explanation: string | null;
  options: OptionKey[];
};

export type SessionState = {
  sessionId: string;
  mode: SessionMode;
  status: SessionStatus;
  questions: SessionQuestion[];
  index: number;
  /** Server-confirmed answer per question (exam: saved choice; practice: checked choice). */
  answers: Record<string, string>;
  /** Practice only: option picked but not yet checked. */
  drafts: Record<string, string>;
  feedback: Record<string, Feedback>;
  pending: Record<string, boolean>;
  bookmarks: Record<string, boolean>;
  /** Epoch ms when an exam ends; null for untimed practice. */
  deadline: number | null;
  /** Practice with instant feedback: show the key right after each answer. Exams are always false. */
  instant: boolean;
  error: string | null;
};

export type SessionInit = Pick<SessionState, "sessionId" | "mode" | "status" | "questions" | "deadline" | "instant"> & {
  answers?: Record<string, string>;
  feedback?: Feedback[];
  bookmarks?: string[];
};

export type SessionAction =
  | { type: "goto"; index: number }
  | { type: "next" }
  | { type: "prev" }
  | { type: "select"; questionId: string; optionId: string }
  | { type: "submit:start"; questionId: string; optionId: string }
  | { type: "submit:saved"; questionId: string; optionId: string }
  | { type: "submit:evaluated"; feedback: Feedback }
  | { type: "submit:failed"; questionId: string; previous: string | undefined; message: string }
  | { type: "bookmark"; questionId: string; value: boolean }
  | { type: "closed" }
  | { type: "dismissError" };

export function createSessionState(init: SessionInit): SessionState {
  const feedback: Record<string, Feedback> = {};
  for (const item of init.feedback ?? []) feedback[item.question_id] = item;

  const answers = { ...(init.answers ?? {}) };
  // Resume where the user left off: first question without a confirmed answer.
  const firstOpen = init.questions.findIndex((question) => !answers[question.id]);

  return {
    sessionId: init.sessionId,
    mode: init.mode,
    status: init.status,
    questions: init.questions,
    index: firstOpen === -1 ? 0 : firstOpen,
    answers,
    drafts: {},
    feedback,
    pending: {},
    bookmarks: Object.fromEntries((init.bookmarks ?? []).map((id) => [id, true])),
    deadline: init.deadline,
    instant: init.instant,
    error: null,
  };
}

function clampIndex(state: SessionState, index: number) {
  return Math.min(Math.max(index, 0), Math.max(state.questions.length - 1, 0));
}

export function isLocked(state: SessionState, questionId: string) {
  if (state.status !== "in_progress") return true;
  if (state.pending[questionId]) return true;
  return state.instant && Boolean(state.feedback[questionId]);
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case "goto":
      return { ...state, index: clampIndex(state, action.index) };
    case "next":
      return { ...state, index: clampIndex(state, state.index + 1) };
    case "prev":
      return { ...state, index: clampIndex(state, state.index - 1) };
    case "select":
      if (isLocked(state, action.questionId) || !state.instant) return state;
      return { ...state, drafts: { ...state.drafts, [action.questionId]: action.optionId } };
    case "submit:start":
      if (isLocked(state, action.questionId)) return state;
      return {
        ...state,
        error: null,
        pending: { ...state.pending, [action.questionId]: true },
        // Exams show the choice immediately (optimistic); rolled back on failure.
        answers:
          state.instant ? state.answers : { ...state.answers, [action.questionId]: action.optionId },
      };
    case "submit:saved":
      return {
        ...state,
        pending: omit(state.pending, action.questionId),
        answers: { ...state.answers, [action.questionId]: action.optionId },
      };
    case "submit:evaluated": {
      const { question_id, selected_option_id } = action.feedback;
      return {
        ...state,
        pending: omit(state.pending, question_id),
        drafts: omit(state.drafts, question_id),
        feedback: { ...state.feedback, [question_id]: action.feedback },
        answers: selected_option_id ? { ...state.answers, [question_id]: selected_option_id } : state.answers,
      };
    }
    case "submit:failed": {
      const answers = { ...state.answers };
      if (action.previous) answers[action.questionId] = action.previous;
      else delete answers[action.questionId];
      return {
        ...state,
        pending: omit(state.pending, action.questionId),
        answers: state.instant ? state.answers : answers,
        error: action.message,
      };
    }
    case "bookmark":
      return { ...state, bookmarks: { ...state.bookmarks, [action.questionId]: action.value } };
    case "closed":
      return { ...state, status: "completed", pending: {} };
    case "dismissError":
      return { ...state, error: null };
  }
}

function omit<T>(record: Record<string, T>, key: string): Record<string, T> {
  if (!(key in record)) return record;
  const copy = { ...record };
  delete copy[key];
  return copy;
}

export function progressOf(state: SessionState) {
  const answered = state.questions.filter((question) => state.answers[question.id]).length;
  return { answered, total: state.questions.length };
}

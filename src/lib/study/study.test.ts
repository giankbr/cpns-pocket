import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { summarizeSession } from "./scoring.ts";
import { createSessionStore } from "./session-store.ts";
import { createSessionState, type Feedback, type SessionQuestion, sessionReducer } from "./session-state.ts";
import { dailySeries, studyStreak } from "./stats.ts";

const question = (id: string, subject: SessionQuestion["subject"] = "TWK", type: SessionQuestion["type"] = "objective"): SessionQuestion => ({
  id,
  prompt: `Soal ${id}`,
  type,
  difficulty: "medium",
  subject,
  topic: "Pancasila",
  options: ["a", "b", "c", "d", "e"].map((label) => ({ id: `${id}-${label}`, label })),
});

const feedback = (questionId: string, selected: string): Feedback => ({
  question_id: questionId,
  selected_option_id: selected,
  explanation: "karena",
  options: [{ id: selected, is_correct: true, score: null }],
});

describe("scoring", () => {
  it("scores objective by points per correct and TKP by weighted score", () => {
    const result = summarizeSession(
      [question("1"), question("2"), question("3", "TIU"), question("4", "TKP", "weighted"), question("5", "TKP", "weighted")],
      [
        { question_id: "1", option_id: "x", is_correct: true, awarded_score: null },
        { question_id: "2", option_id: "y", is_correct: false, awarded_score: null },
        { question_id: "4", option_id: "z", is_correct: null, awarded_score: 4 },
      ],
      5,
    );
    assert.equal(result.score, 9);
    assert.equal(result.correct, 1);
    assert.equal(result.incorrect, 1);
    assert.equal(result.unanswered, 2);
    assert.equal(result.maxScore, 5 * 3 + 5 * 2);
    const tkp = result.bySubject.find((row) => row.subject === "TKP");
    assert.deepEqual([tkp?.score, tkp?.correct, tkp?.unanswered], [4, 0, 1]);
  });
});

describe("answer persistence & session recovery", () => {
  const base = { sessionId: "s", status: "in_progress" as const, deadline: null, questions: [question("1"), question("2"), question("3")] };

  it("resumes at the first unanswered question with saved answers and feedback", () => {
    const state = createSessionState({
      ...base,
      mode: "practice", instant: true,
      answers: { "1": "1-a" },
      feedback: [feedback("1", "1-a")],
      bookmarks: ["2"],
    });
    assert.equal(state.index, 1);
    assert.equal(state.answers["1"], "1-a");
    assert.ok(state.feedback["1"]);
    assert.equal(state.bookmarks["2"], true);
  });

  it("locks a practice answer after it is checked", () => {
    let state = createSessionState({ ...base, mode: "practice", instant: true });
    state = sessionReducer(state, { type: "select", questionId: "1", optionId: "1-b" });
    assert.equal(state.drafts["1"], "1-b");
    state = sessionReducer(state, { type: "submit:start", questionId: "1", optionId: "1-b" });
    state = sessionReducer(state, { type: "submit:evaluated", feedback: feedback("1", "1-b") });
    assert.equal(state.answers["1"], "1-b");
    assert.equal(state.drafts["1"], undefined);
    const after = sessionReducer(state, { type: "select", questionId: "1", optionId: "1-c" });
    assert.equal(after, state);
  });

  it("saves exam answers optimistically and rolls back on failure", () => {
    let state = createSessionState({ ...base, mode: "exam", instant: false, answers: { "1": "1-a" } });
    state = sessionReducer(state, { type: "submit:start", questionId: "1", optionId: "1-c" });
    assert.equal(state.answers["1"], "1-c");
    assert.equal(state.pending["1"], true);
    state = sessionReducer(state, { type: "submit:failed", questionId: "1", previous: "1-a", message: "offline" });
    assert.equal(state.answers["1"], "1-a");
    assert.equal(state.error, "offline");
  });

  it("blocks changes once the session is closed", () => {
    let state = createSessionState({ ...base, mode: "exam", instant: false });
    state = sessionReducer(state, { type: "closed" });
    const after = sessionReducer(state, { type: "submit:start", questionId: "2", optionId: "2-a" });
    assert.equal(after.answers["2"], undefined);
  });

  it("clamps navigation to the question range", () => {
    let state = createSessionState({ ...base, mode: "practice", instant: true });
    state = sessionReducer(state, { type: "prev" });
    assert.equal(state.index, 0);
    state = sessionReducer(state, { type: "goto", index: 99 });
    assert.equal(state.index, 2);
  });
});

describe("Mini Mode state synchronization", () => {
  it("keeps the main view and the floating window on the same store state", () => {
    const store = createSessionStore({ ...{ sessionId: "s", status: "in_progress" as const, deadline: null }, mode: "exam", instant: false, questions: [question("1"), question("2")] });
    const seenByMain: number[] = [];
    const seenByMini: number[] = [];
    store.subscribe((state) => seenByMain.push(state.index));
    store.subscribe((state) => seenByMini.push(state.index));

    // Action from the floating window...
    store.getState().dispatch({ type: "next" });
    // ...and from the main view.
    store.getState().dispatch({ type: "submit:saved", questionId: "2", optionId: "2-d" });

    assert.deepEqual(seenByMain, seenByMini);
    assert.equal(store.getState().index, 1);
    assert.equal(store.getState().answers["2"], "2-d");
  });
});

describe("study stats", () => {
  it("counts a streak ending today or yesterday", () => {
    assert.equal(studyStreak(["2026-11-09", "2026-11-10", "2026-11-11"], "2026-11-11"), 3);
    assert.equal(studyStreak(["2026-11-09", "2026-11-10"], "2026-11-11"), 2);
    assert.equal(studyStreak(["2026-11-08"], "2026-11-11"), 0);
  });

  it("buckets activity per day, oldest first", () => {
    const series = dailySeries(["2026-11-11", "2026-11-11", "2026-11-09"], 3, "2026-11-11");
    assert.deepEqual(series.map((day) => day.count), [1, 0, 2]);
  });
});

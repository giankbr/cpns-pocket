/** Result summary for a finished session. Pure: no imports besides types. */

import type { SubjectCode } from "./session-state.ts";

export type ScoredQuestion = { id: string; subject: SubjectCode; type: "objective" | "weighted" };
export type ScoredAnswer = {
  question_id: string;
  option_id: string | null;
  is_correct: boolean | null;
  awarded_score: number | null;
};

export type SubjectSummary = {
  subject: SubjectCode;
  total: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  score: number;
  maxScore: number;
};

/** Highest TKP option score. */
export const WEIGHTED_MAX = 5;

export function summarizeSession(questions: ScoredQuestion[], answers: ScoredAnswer[], pointsPerCorrect: number) {
  const byQuestion = new Map(answers.map((answer) => [answer.question_id, answer]));
  const subjects = new Map<SubjectCode, SubjectSummary>();

  for (const question of questions) {
    const row =
      subjects.get(question.subject) ??
      { subject: question.subject, total: 0, correct: 0, incorrect: 0, unanswered: 0, score: 0, maxScore: 0 };
    subjects.set(question.subject, row);

    const answer = byQuestion.get(question.id);
    row.total += 1;
    row.maxScore += question.type === "weighted" ? WEIGHTED_MAX : pointsPerCorrect;

    if (!answer?.option_id) {
      row.unanswered += 1;
    } else if (question.type === "weighted") {
      // TKP has no right/wrong: every answer earns its weighted score.
      row.score += answer.awarded_score ?? 0;
    } else if (answer.is_correct) {
      row.correct += 1;
      row.score += pointsPerCorrect;
    } else {
      row.incorrect += 1;
    }
  }

  const bySubject = [...subjects.values()];
  const sum = (key: keyof Omit<SubjectSummary, "subject">) => bySubject.reduce((total, row) => total + row[key], 0);

  return {
    bySubject,
    total: sum("total"),
    correct: sum("correct"),
    incorrect: sum("incorrect"),
    unanswered: sum("unanswered"),
    score: sum("score"),
    maxScore: sum("maxScore"),
  };
}

"use server";

import { z } from "zod";
import { requireSession } from "@/lib/auth/guards";
import { summarizeSession } from "@/lib/study/scoring";
import { loadSession } from "@/lib/study/session-loader";
import type { SessionInit } from "@/lib/study/session-state";
import { getSubjectOptions } from "@/lib/study/subject-options";

/*
 * Server actions for Mini Mode. They return data instead of redirecting: the mini
 * window runs its own flow and must never navigate the main window (or the
 * Picture-in-Picture document, which would close it).
 */

export type MiniSubjectOption = Awaited<ReturnType<typeof getSubjectOptions>>[number];

export async function getMiniOptions(): Promise<MiniSubjectOption[]> {
  const { supabase } = await requireSession();
  return getSubjectOptions(supabase);
}

const startSchema = z.object({
  subjects: z.array(z.enum(["TWK", "TIU", "TKP", "ENG"])).max(4),
  topicIds: z.array(z.uuid()).max(50),
  count: z.number().int().min(1).max(50),
});

export async function startMiniSession(input: z.input<typeof startSchema>): Promise<{ id: string } | { error: string }> {
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return { error: "Pilihan tidak valid." };

  const { supabase } = await requireSession();
  const { subjects, topicIds, count } = parsed.data;
  const run = (filter: "unanswered" | "all") =>
    supabase.rpc("start_study_session", {
      p_mode: "practice",
      p_subject_codes: subjects.length ? subjects : null,
      p_topic_ids: topicIds.length ? topicIds : null,
      p_filter: filter,
      p_count: count,
      p_review: "instant",
    });

  // Prefer questions never answered; when all have been seen, repeat from the full pool.
  let { data, error } = await run("unanswered");
  if (error?.code === "P0002") ({ data, error } = await run("all"));

  if (error?.code === "P0002") return { error: "Belum ada soal terbit untuk pilihan ini." };
  if (error) return { error: "Sesi tidak dapat dimulai. Coba lagi." };
  return { id: data as string };
}

export type MiniVerdict = "correct" | "wrong" | "scored" | "empty";

export type MiniSessionData =
  | { status: "in_progress"; init: SessionInit }
  | {
      status: "completed";
      score: number;
      maxScore: number;
      correct: number;
      incorrect: number;
      unanswered: number;
      verdicts: MiniVerdict[];
    }
  | { status: "missing" };

export async function loadMiniSession(sessionId: string): Promise<MiniSessionData> {
  if (!z.uuid().safeParse(sessionId).success) return { status: "missing" };
  const { supabase } = await requireSession();
  const loaded = await loadSession(supabase, sessionId);
  if (!loaded) return { status: "missing" };

  const { session, questions, answers, feedback, bookmarks, deadline, pointsPerCorrect, instant } = loaded;

  if (session.status === "in_progress") {
    return {
      status: "in_progress",
      init: {
        sessionId: session.id,
        mode: session.mode,
        status: session.status,
        questions,
        deadline,
        instant,
        answers: Object.fromEntries(answers.map((answer) => [answer.question_id, answer.option_id])),
        feedback,
        bookmarks,
      },
    };
  }

  const summary = summarizeSession(questions, answers, pointsPerCorrect);
  const byQuestion = new Map(answers.map((answer) => [answer.question_id, answer]));
  const verdicts = questions.map<MiniVerdict>((question) => {
    const answer = byQuestion.get(question.id);
    if (!answer?.option_id) return "empty";
    if (question.type === "weighted") return "scored";
    return answer.is_correct ? "correct" : "wrong";
  });

  return {
    status: "completed",
    score: summary.score,
    maxScore: summary.maxScore,
    correct: summary.correct,
    incorrect: summary.incorrect,
    unanswered: summary.unanswered,
    verdicts,
  };
}

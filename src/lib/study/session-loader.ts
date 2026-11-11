import type { SupabaseClient } from "@supabase/supabase-js";
import type { Feedback, SessionMode, SessionQuestion, SessionStatus, SubjectCode } from "./session-state";

type QuestionRow = {
  position: number;
  questions: {
    id: string;
    prompt: string;
    type: SessionQuestion["type"];
    difficulty: SessionQuestion["difficulty"];
    topics: { name: string; subjects: { code: SubjectCode } | null } | null;
    question_options: { id: string; label: string; sort_order: number }[];
  } | null;
};

export type LoadedSession = Awaited<ReturnType<typeof loadSession>>;

/** Everything a session page needs, read through RLS (answer keys excluded). */
export async function loadSession(supabase: SupabaseClient, sessionId: string) {
  const { data: session, error } = await supabase
    .from("study_sessions")
    .select("id, mode, status, started_at, completed_at, duration_seconds, score, configuration")
    .eq("id", sessionId)
    .maybeSingle<{
      id: string;
      mode: SessionMode;
      status: SessionStatus;
      started_at: string;
      completed_at: string | null;
      duration_seconds: number | null;
      score: number | null;
      configuration: {
        name?: string | null;
        duration_minutes?: number | null;
        points_per_correct?: number | null;
        question_count?: number;
      };
    }>();

  if (error) throw new Error(`Gagal memuat sesi: ${error.message}`);
  if (!session) return null;

  const [rows, answers, feedback] = await Promise.all([
    supabase
      .from("session_questions")
      .select(
        "position, questions(id, prompt, type, difficulty, topics(name, subjects(code)), question_options(id, label, sort_order))",
      )
      .eq("session_id", sessionId)
      .order("position")
      .returns<QuestionRow[]>(),
    supabase
      .from("session_answers")
      .select("question_id, option_id, is_correct, awarded_score")
      .eq("session_id", sessionId)
      .returns<{ question_id: string; option_id: string; is_correct: boolean | null; awarded_score: number | null }[]>(),
    supabase.rpc("get_session_feedback", { p_session_id: sessionId }),
  ]);

  const loadError = rows.error ?? answers.error ?? feedback.error;
  if (loadError) throw new Error(`Gagal memuat soal sesi: ${loadError.message}`);

  const questions: SessionQuestion[] = (rows.data ?? []).flatMap(({ questions: question }) =>
    question
      ? [
          {
            id: question.id,
            prompt: question.prompt,
            type: question.type,
            difficulty: question.difficulty,
            subject: question.topics?.subjects?.code ?? "TWK",
            topic: question.topics?.name ?? "",
            options: [...question.question_options]
              .sort((a, b) => a.sort_order - b.sort_order)
              .map(({ id, label }) => ({ id, label })),
          },
        ]
      : [],
  );

  const questionIds = questions.map((question) => question.id);
  const bookmarks = questionIds.length
    ? await supabase.from("bookmarks").select("question_id").in("question_id", questionIds)
    : { data: [] as { question_id: string }[] };

  const durationMinutes = session.configuration.duration_minutes ?? null;
  const deadline =
    session.mode === "exam" && durationMinutes
      ? new Date(session.started_at).getTime() + durationMinutes * 60_000
      : null;

  return {
    session,
    questions,
    answers: answers.data ?? [],
    feedback: (feedback.data as Feedback[] | null) ?? [],
    bookmarks: (bookmarks.data ?? []).map((row) => row.question_id),
    deadline,
    /** Timed session still open after its deadline (closed on next visit). */
    expired: session.status === "in_progress" && deadline !== null && Date.now() > deadline,
    pointsPerCorrect: session.configuration.points_per_correct ?? 5,
  };
}

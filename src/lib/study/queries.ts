import type { SupabaseClient } from "@supabase/supabase-js";
import { jakartaDate } from "./stats";

export type SubjectCode = "TWK" | "TIU" | "TKP" | "ENG";

export type Topic = { id: string; name: string; sort_order: number };
export type Subject = {
  id: string;
  code: SubjectCode;
  name: string;
  description: string | null;
  sort_order: number;
  topics: Topic[];
};
export type Material = { id: string; topic_id: string; title: string; body: string };
export type Answer = {
  question_id: string;
  is_correct: boolean | null;
  awarded_score: number | null;
  answered_at: string;
};
export type Session = {
  id: string;
  mode: "practice" | "exam";
  status: "in_progress" | "completed" | "abandoned";
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  score: number | null;
};

export const subjectStyle: Record<SubjectCode, { short: string; color: string }> = {
  TWK: { short: "TWK", color: "#1f6bff" },
  TIU: { short: "TIU", color: "#7c9dff" },
  TKP: { short: "TKP", color: "#ff7a1a" },
  ENG: { short: "B. Inggris", color: "#14b8a6" },
};

export const sessionLabel = {
  mode: { practice: "Latihan", exam: "Simulasi CAT" },
  status: { in_progress: "Berjalan", completed: "Selesai", abandoned: "Ditinggalkan" },
} as const;

/** Subjects, topics, and published question/material counts (RLS hides drafts). */
export async function getCatalog(supabase: SupabaseClient) {
  const [subjects, questions, materials] = await Promise.all([
    supabase
      .from("subjects")
      .select("id, code, name, description, sort_order, topics(id, name, sort_order)")
      .order("sort_order")
      .returns<Subject[]>(),
    supabase.from("questions").select("id, topic_id").returns<{ id: string; topic_id: string }[]>(),
    supabase
      .from("learning_materials")
      .select("id, topic_id, title, body")
      .order("created_at")
      .returns<Material[]>(),
  ]);

  const error = subjects.error ?? questions.error ?? materials.error;
  if (error) throw new Error(`Gagal memuat katalog: ${error.message}`);

  const subjectList = (subjects.data ?? []).map((subject) => ({
    ...subject,
    topics: [...subject.topics].sort((a, b) => a.sort_order - b.sort_order),
  }));

  const subjectByTopic = new Map<string, SubjectCode>();
  for (const subject of subjectList) for (const topic of subject.topics) subjectByTopic.set(topic.id, subject.code);

  const subjectByQuestion = new Map<string, SubjectCode>();
  const questionsPerTopic = new Map<string, number>();
  for (const question of questions.data ?? []) {
    const code = subjectByTopic.get(question.topic_id);
    if (code) subjectByQuestion.set(question.id, code);
    questionsPerTopic.set(question.topic_id, (questionsPerTopic.get(question.topic_id) ?? 0) + 1);
  }

  return {
    subjects: subjectList,
    materials: materials.data ?? [],
    subjectByQuestion,
    questionsPerTopic,
  };
}

/** The signed-in user's answers and sessions (RLS scopes rows to the user). */
export async function getActivity(supabase: SupabaseClient) {
  const [answers, sessions] = await Promise.all([
    supabase
      .from("session_answers")
      .select("question_id, is_correct, awarded_score, answered_at")
      .returns<Answer[]>(),
    supabase
      .from("study_sessions")
      .select("id, mode, status, started_at, completed_at, duration_seconds, score")
      .order("started_at", { ascending: false })
      .returns<Session[]>(),
  ]);

  const error = answers.error ?? sessions.error;
  if (error) throw new Error(`Gagal memuat aktivitas: ${error.message}`);

  const answerList = answers.data ?? [];
  return {
    answers: answerList,
    sessions: sessions.data ?? [],
    answerDates: answerList.map((answer) => jakartaDate(answer.answered_at)),
  };
}

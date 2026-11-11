"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/guards";
import type { Feedback } from "@/lib/study/session-state";

export type StartState = { error: string | null };

const subjectCodes = z.array(z.enum(["TWK", "TIU", "TKP", "ENG"]));

const practiceSchema = z.object({
  subjects: subjectCodes,
  topicIds: z.array(z.uuid()),
  difficulty: z.enum(["", "easy", "medium", "hard"]),
  filter: z.enum(["all", "unanswered", "bookmarked", "incorrect"]),
  count: z.coerce.number().int().min(1).max(200),
  review: z.enum(["instant", "end"]).default("end"),
});

const examSchema = z.union([
  z.object({ configId: z.uuid() }),
  z.object({
    subjects: subjectCodes.min(1, "Pilih minimal satu bidang."),
    count: z.coerce.number().int().min(1).max(200),
    duration: z.coerce.number().int().min(1).max(300),
  }),
]);

function rpcErrorMessage(error: { code?: string; message: string }) {
  if (error.code === "P0002" && error.message.includes("no questions")) {
    return "Belum ada soal terbit yang cocok dengan pilihan ini. Ubah filter atau tunggu bank soal terisi.";
  }
  if (error.code === "22023") return "Pengaturan sesi tidak valid.";
  return "Sesi tidak dapat dimulai. Coba lagi.";
}

export async function startPractice(_: StartState, formData: FormData): Promise<StartState> {
  const parsed = practiceSchema.safeParse({
    subjects: formData.getAll("subjects"),
    topicIds: formData.getAll("topicIds"),
    difficulty: formData.get("difficulty") ?? "",
    filter: formData.get("filter") ?? "all",
    count: formData.get("count"),
    review: formData.get("review") ?? "end",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Isian tidak valid." };

  const { supabase } = await requireSession();
  const { subjects, topicIds, difficulty, filter, count, review } = parsed.data;
  const { data, error } = await supabase.rpc("start_study_session", {
    p_mode: "practice",
    p_subject_codes: subjects.length ? subjects : null,
    p_topic_ids: topicIds.length ? topicIds : null,
    p_difficulty: difficulty || null,
    p_filter: filter,
    p_count: count,
    p_review: review,
  });
  if (error) return { error: rpcErrorMessage(error) };

  redirect(`/sesi/${data as string}`);
}

export async function startExam(_: StartState, formData: FormData): Promise<StartState> {
  const parsed = examSchema.safeParse(
    formData.get("configId")
      ? { configId: formData.get("configId") }
      : { subjects: formData.getAll("subjects"), count: formData.get("count"), duration: formData.get("duration") },
  );
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Isian tidak valid." };

  const { supabase } = await requireSession();
  const args =
    "configId" in parsed.data
      ? { p_mode: "exam", p_exam_configuration_id: parsed.data.configId, p_review: "end" }
      : {
          p_mode: "exam",
          p_subject_codes: parsed.data.subjects,
          p_count: parsed.data.count,
          p_duration_minutes: parsed.data.duration,
          p_review: "end",
        };
  const { data, error } = await supabase.rpc("start_study_session", args);
  if (error) return { error: rpcErrorMessage(error) };

  redirect(`/sesi/${data as string}`);
}

const answerSchema = z.object({ sessionId: z.uuid(), questionId: z.uuid(), optionId: z.uuid() });

export type SubmitResult =
  | { status: "saved" }
  | { status: "evaluated"; feedback: Feedback }
  | { status: "closed" | "expired" }
  | { status: "error"; message: string };

export async function submitAnswer(input: z.input<typeof answerSchema>): Promise<SubmitResult> {
  const parsed = answerSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Jawaban tidak valid." };

  const { supabase } = await requireSession();
  const { data, error } = await supabase.rpc("submit_answer", {
    p_session_id: parsed.data.sessionId,
    p_question_id: parsed.data.questionId,
    p_option_id: parsed.data.optionId,
  });
  if (error) return { status: "error", message: "Jawaban gagal disimpan. Periksa koneksi lalu coba lagi." };

  const result = data as { status: string } & Feedback;
  if (result.status === "evaluated") {
    const { question_id, selected_option_id, explanation, options } = result;
    return { status: "evaluated", feedback: { question_id, selected_option_id, explanation, options } };
  }
  if (result.status === "saved" || result.status === "closed" || result.status === "expired") {
    return { status: result.status };
  }
  return { status: "error", message: "Respons server tidak dikenal." };
}

export async function finishSession(sessionId: string): Promise<{ ok: boolean }> {
  if (!z.uuid().safeParse(sessionId).success) return { ok: false };
  const { supabase } = await requireSession();
  const { error } = await supabase.rpc("finish_study_session", { p_session_id: sessionId });
  if (error) return { ok: false };
  revalidatePath("/dashboard");
  revalidatePath("/riwayat");
  return { ok: true };
}

export async function setBookmark(questionId: string, value: boolean): Promise<{ ok: boolean }> {
  if (!z.uuid().safeParse(questionId).success) return { ok: false };
  const { supabase, user } = await requireSession();
  const { error } = value
    ? await supabase.from("bookmarks").upsert({ user_id: user.id, question_id: questionId }, { ignoreDuplicates: true })
    : await supabase.from("bookmarks").delete().eq("user_id", user.id).eq("question_id", questionId);
  revalidatePath("/bookmark");
  return { ok: !error };
}

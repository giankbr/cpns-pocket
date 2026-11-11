import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { getAnthropicEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const requestSchema = z.object({ questionId: z.uuid() });

type Payload = {
  prompt: string;
  type: "objective" | "weighted";
  subject: string;
  topic: string;
  options: { label: string; is_correct: boolean | null; score: number | null }[];
};

const systemPrompt = `Kamu tutor SKD/SKB CPNS Indonesia. Buat pembahasan singkat untuk satu soal latihan.
Jelaskan dalam bahasa Indonesia yang ringkas dan mudah dipahami (maksimal sekitar 120 kata).
Untuk soal objektif: sebutkan jawaban yang benar, jelaskan mengapa benar, dan singgung kenapa pengecoh utama keliru.
Untuk soal TKP (berbobot): jelaskan mengapa opsi berskor tertinggi paling tepat dan mengapa opsi berskor rendah kurang tepat.
Dasarkan hanya pada isi soal dan kunci yang diberikan; jangan mengarang dasar hukum, pasal, atau angka yang tidak pasti.`;

const letters = ["A", "B", "C", "D", "E"];

export async function POST(request: Request) {
  const user = await requireUser();
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Permintaan tidak valid." }, { status: 400 });

  let anthropicConfig: ReturnType<typeof getAnthropicEnv>;
  try {
    anthropicConfig = getAnthropicEnv();
  } catch (error) {
    console.error("Anthropic configuration is missing", { userId: user.id, error });
    return Response.json({ error: "AI belum dikonfigurasi di server." }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: payload, error: payloadError } = await supabase.rpc("explain_payload", { p_question_id: parsed.data.questionId });
  if (payloadError || !payload) {
    return Response.json({ error: "Pembahasan hanya tersedia setelah soal dijawab." }, { status: 403 });
  }

  const dailyLimit = Number.parseInt(process.env.AI_DAILY_REQUEST_LIMIT || "20", 10);
  const { data: allowed, error: quotaError } = await supabase.rpc("consume_ai_request", {
    p_daily_limit: Number.isFinite(dailyLimit) && dailyLimit > 0 ? dailyLimit : 20,
  });
  if (quotaError) return Response.json({ error: "Batas AI belum dapat diverifikasi." }, { status: 500 });
  if (!allowed) return Response.json({ error: "Batas pertanyaan AI harian sudah tercapai. Coba lagi besok." }, { status: 429 });

  const data = payload as Payload;
  const options = data.options
    .map((option, index) => {
      const key = data.type === "weighted" ? ` (skor ${option.score ?? 0})` : option.is_correct ? " (JAWABAN BENAR)" : "";
      return `${letters[index]}. ${option.label}${key}`;
    })
    .join("\n");
  const userMessage = `Bidang ${data.subject} · topik ${data.topic}.\n\nSoal:\n${data.prompt}\n\nPilihan:\n${options}\n\nTuliskan pembahasannya.`;

  try {
    const anthropic = new Anthropic({
      apiKey: anthropicConfig.apiKey,
      defaultHeaders: anthropicConfig.workspaceId ? { "anthropic-workspace-id": anthropicConfig.workspaceId } : undefined,
    });
    const response = await anthropic.messages.create({
      model: anthropicConfig.model,
      max_tokens: 16000,
      output_config: { effort: "low" },
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });
    if (response.stop_reason === "refusal") {
      return Response.json({ error: "AI tidak dapat membahas soal ini." }, { status: 422 });
    }
    const answer = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();
    if (!answer) return Response.json({ error: "AI tidak mengembalikan pembahasan." }, { status: 502 });
    return Response.json({ answer });
  } catch (error) {
    console.error("AI explain failed", {
      userId: user.id,
      status: error instanceof Anthropic.APIError ? error.status : undefined,
    });
    const configIssue =
      error instanceof Anthropic.AuthenticationError ||
      error instanceof Anthropic.PermissionDeniedError ||
      (error instanceof Anthropic.BadRequestError && /workspace/i.test(error.message));
    return Response.json(
      {
        error: configIssue
          ? "AI belum bisa dipakai: periksa API key Anthropic di server."
          : "AI sedang tidak tersedia. Coba lagi sebentar.",
      },
      { status: configIssue ? 503 : 502 },
    );
  }
}

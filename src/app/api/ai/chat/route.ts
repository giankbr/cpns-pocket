import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { getAnthropicEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
});

const requestSchema = z.object({
  messages: z.array(messageSchema).min(1).max(20),
  context: z.string().trim().max(6000).optional(),
});

const systemPrompt = `Kamu adalah asisten belajar CPOCKET untuk persiapan SKD dan SKB CPNS Indonesia, termasuk tes Bahasa Inggris (grammar, error recognition, vocabulary, reading).
Jawab dalam bahasa Indonesia yang jelas, ringkas, dan mendidik.
Untuk materi Bahasa Inggris, jelaskan aturan dalam bahasa Indonesia dan beri contoh kalimat dalam bahasa Inggris.
Jelaskan alasan dan langkah berpikir, tetapi jangan mengarang sumber, aturan, atau fakta.
Jika pertanyaan tidak berkaitan dengan CPNS atau belajar, arahkan kembali dengan sopan.
Jangan pernah mengklaim bahwa soal atau materi buatan aplikasi adalah soal resmi pemerintah.`;

export async function POST(request: Request) {
  const user = await requireUser();
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Format pesan tidak valid." }, { status: 400 });
  }

  let anthropicConfig: ReturnType<typeof getAnthropicEnv>;
  try {
    anthropicConfig = getAnthropicEnv();
  } catch (error) {
    console.error("Anthropic configuration is missing", { userId: user.id, error });
    return Response.json({ error: "AI belum dikonfigurasi di server." }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const dailyLimit = Number.parseInt(process.env.AI_DAILY_REQUEST_LIMIT || "20", 10);
  const { data: allowed, error: quotaError } = await supabase.rpc("consume_ai_request", {
    p_daily_limit: Number.isFinite(dailyLimit) && dailyLimit > 0 ? dailyLimit : 20,
  });

  if (quotaError) {
    console.error("AI quota check failed", { userId: user.id, error: quotaError });
    return Response.json({ error: "Batas AI belum dapat diverifikasi." }, { status: 500 });
  }

  if (!allowed) {
    return Response.json(
      { error: "Batas pertanyaan AI harian sudah tercapai. Coba lagi besok." },
      { status: 429 },
    );
  }

  try {
    const anthropic = new Anthropic({
      apiKey: anthropicConfig.apiKey,
      defaultHeaders: anthropicConfig.workspaceId
        ? { "anthropic-workspace-id": anthropicConfig.workspaceId }
        : undefined,
    });
    const context = parsed.data.context
      ? `\n\nKonteks tambahan dari aplikasi:\n${parsed.data.context}`
      : "";
    const response = await anthropic.messages.create({
      model: anthropicConfig.model,
      // Thinking shares this budget on current models; keep headroom so answers aren't cut off.
      max_tokens: 16000,
      output_config: { effort: "low" },
      system: `${systemPrompt}${context}`,
      messages: parsed.data.messages,
    });
    if (response.stop_reason === "refusal") {
      return Response.json({ error: "AI tidak dapat menjawab pertanyaan ini. Coba ubah pertanyaannya." }, { status: 422 });
    }

    const answer = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    if (!answer) {
      return Response.json({ error: "AI tidak mengembalikan jawaban." }, { status: 502 });
    }

    return Response.json({ answer });
  } catch (error) {
    console.error("AI request failed", {
      userId: user.id,
      status: error instanceof Anthropic.APIError ? error.status : undefined,
      message: error instanceof Error ? error.message : String(error),
    });
    const { status, message } = describeAiError(error);
    return Response.json({ error: message }, { status });
  }
}

/** Maps SDK errors to a message the user can act on (most specific first). */
function describeAiError(error: unknown): { status: number; message: string } {
  const misconfigured = {
    status: 503,
    message:
      "AI belum bisa dipakai: API key Anthropic ditolak. Pakai API key biasa (sk-ant-api03-…) dari Console di .env.local, lalu restart server.",
  };
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return misconfigured;
  }
  if (error instanceof Anthropic.NotFoundError) {
    return { status: 503, message: "AI belum bisa dipakai: model atau workspace di konfigurasi tidak ditemukan." };
  }
  if (error instanceof Anthropic.BadRequestError) {
    return /workspace/i.test(error.message)
      ? misconfigured
      : { status: 400, message: "Permintaan ke AI tidak valid. Coba persingkat pertanyaannya." };
  }
  if (error instanceof Anthropic.RateLimitError) {
    return { status: 429, message: "AI sedang ramai. Coba lagi beberapa saat lagi." };
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return { status: 503, message: "Server tidak bisa terhubung ke AI. Periksa koneksi internet server." };
  }
  return { status: 502, message: "AI sedang tidak tersedia. Coba lagi sebentar." };
}

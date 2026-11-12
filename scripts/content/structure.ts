/**
 * Step 2: content/text → Claude (Message Batches, structured outputs) → content/structured/*.json
 * Usage:
 *   node scripts/content/structure.ts --estimate          token count + cost (countTokens, free)
 *   node scripts/content/structure.ts --estimate-offline  char-based estimate, no API
 *   node scripts/content/structure.ts --submit [--limit=N] create a batch (paid)
 *   node scripts/content/structure.ts --collect [--wait]  fetch results, validate, write JSON
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  BATCHES,
  flagValue,
  hasFlag,
  loadEnv,
  type ManifestEntry,
  MANIFEST,
  readJson,
  REQUESTS,
  STRUCTURED_DIR,
  TEXT_DIR,
  TOPICS,
  writeJson,
} from "./lib.ts";
import { ChunkSchema } from "./schema.ts";

const MODEL = "claude-opus-5-5";
const MAX_TOKENS = 64000;
const CHUNK_CHARS = 60_000;
const KEY_SECTION_MAX = 40_000;
// Claude Opus 5.5 list price per MTok; batches are billed at 50%.
const PRICE_IN = 4;
const PRICE_OUT = 20;
const BATCH_DISCOUNT = 0.5;
const CHARS_PER_TOKEN = 3.5;


// Strip the helper's parse() so the format serializes cleanly inside batch params.
const { type: formatType, schema: formatSchema } = zodOutputFormat(ChunkSchema);
const OUTPUT_FORMAT = { type: formatType, schema: formatSchema };

const topicList = Object.entries(TOPICS)
  .map(([code, names]) => `- ${code}: ${names.join("; ")}`)
  .join("\n");

const SYSTEM = `Kamu mengekstrak konten belajar CPNS dari teks dokumen (hasil pdftotext/OCR, bisa berantakan) menjadi data terstruktur untuk aplikasi belajar pribadi.

Bidang dan topik yang valid (pakai nama topik persis):
${topicList}

Aturan soal (questions):
- Ambil hanya soal pilihan ganda yang bisa dijawab penuh dari teks. Lewati soal yang butuh gambar, grafik, tabel, atau figur yang tidak ada di teks (misalnya figural TIU bergambar).
- Pertahankan redaksi asli soal dan opsi; rapikan hanya spasi/pemotongan baris akibat ekstraksi. Hapus label "a." / "A)" dari opsi.
- options: tepat 5 opsi sesuai urutan asli. Jika soal asli hanya punya 4 opsi, lewati soalnya.
- TWK, TIU, ENG: answer_index = indeks 0-4 jawaban benar, tkp_scores = null.
- TKP: tkp_scores = 5 skor (1-5) per opsi sesuai kunci, answer_index = null.
- Kunci jawaban sering ada di bagian terpisah ("KUNCI JAWABAN", "PEMBAHASAN", tabel nomor-huruf) di akhir dokumen; cocokkan dengan nomor soal.
- JANGAN mengarang kunci. Jika kunci tidak ada di teks, isi answer_index/tkp_scores = null.
- explanation: pembahasan dari dokumen jika ada (ringkas), selain itu null.
- difficulty: perkiraan easy/medium/hard.
- Pilih subject_code dan topic paling sesuai.

Aturan materi (materials):
- Ringkas bagian materi/teori (bukan soal) menjadi materi per topik dalam Markdown yang rapi dan setia pada isi sumber. Jangan menambah fakta di luar teks.
- Satu entri per subbab yang bermakna. Kosongkan array jika dokumen hanya berisi soal.

Jika chunk tidak berisi soal maupun materi yang relevan, kembalikan array kosong.`;

type RequestMeta = { custom_id: string; slug: string; source: string; chunk: number; chunks: number };

/** Split at question boundaries; append a trailing answer-key section to every chunk. */
function chunkDocument(text: string): string[] {
  const keyMatch = [...text.matchAll(/kunci\s+jawaban|pembahasan\s+soal|jawaban\s+dan\s+pembahasan/gi)].at(-1);
  const keyAt = keyMatch?.index ?? -1;
  const hasTrailingKey = keyAt > text.length * 0.5;
  const body = hasTrailingKey ? text.slice(0, keyAt) : text;
  const keySection = hasTrailingKey ? text.slice(keyAt, keyAt + KEY_SECTION_MAX) : "";

  if (body.length <= CHUNK_CHARS) return [text];

  const chunks: string[] = [];
  let start = 0;
  while (start < body.length) {
    let end = Math.min(start + CHUNK_CHARS, body.length);
    if (end < body.length) {
      const window = body.slice(start + CHUNK_CHARS * 0.6, end);
      const boundaries = [...window.matchAll(/\n\s*\d{1,3}\s*[.)]\s/g)];
      const last = boundaries.at(-1);
      if (last?.index !== undefined) end = start + CHUNK_CHARS * 0.6 + last.index;
      else {
        const paragraph = body.lastIndexOf("\n\n", end);
        if (paragraph > start + CHUNK_CHARS * 0.6) end = paragraph;
      }
    }
    chunks.push(body.slice(start, end));
    start = end;
  }

  return keySection ? chunks.map((chunk) => `${chunk}\n\n[BAGIAN KUNCI/PEMBAHASAN DARI AKHIR DOKUMEN]\n${keySection}`) : chunks;
}

function buildRequests() {
  const manifest = readJson<ManifestEntry[]>(MANIFEST, []);
  // Skip documents that already have structured output (same convention as chunk.ts).
  const done = new Set(
    existsSync(STRUCTURED_DIR)
      ? readdirSync(STRUCTURED_DIR)
          .filter((name) => name.endsWith(".json") && !name.startsWith("_"))
          .map((name) => name.replace(/(__\d+)?\.json$/, ""))
      : [],
  );
  const docs = manifest.filter((entry) => entry.hash && !entry.duplicateOf && !entry.note && !done.has(entry.slug));
  if (docs.length === 0) {
    console.error("No extracted documents. Run content:extract first.");
    process.exit(1);
  }

  const requests: { meta: RequestMeta; params: Anthropic.MessageCreateParamsNonStreaming }[] = [];
  docs.forEach((doc, docIndex) => {
    const text = readFileSync(path.join(TEXT_DIR, `${doc.slug}.txt`), "utf8");
    const chunks = chunkDocument(text);
    chunks.forEach((chunk, chunkIndex) => {
      const custom_id = `d${docIndex}-c${chunkIndex}`;
      requests.push({
        meta: { custom_id, slug: doc.slug, source: doc.file, chunk: chunkIndex + 1, chunks: chunks.length },
        params: {
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: SYSTEM,
          output_config: { effort: "medium", format: OUTPUT_FORMAT },
          messages: [
            {
              role: "user",
              content: `Sumber: ${doc.file} (bagian ${chunkIndex + 1}/${chunks.length})\n\n<document>\n${chunk}\n</document>`,
            },
          ],
        },
      });
    });
  });
  return requests;
}

function client() {
  loadEnv();
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Missing ANTHROPIC_API_KEY in .env.local");
    process.exit(1);
  }
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID;
  return new Anthropic({ defaultHeaders: workspace ? { "anthropic-workspace-id": workspace } : undefined });
}

function dollars(inputTokens: number, outputTokens: number) {
  return ((inputTokens * PRICE_IN + outputTokens * PRICE_OUT) / 1_000_000) * BATCH_DISCOUNT;
}

function printEstimate(inputTokens: number, requests: number) {
  // Output is roughly 40-90% of the document size (questions are re-emitted as JSON), plus thinking.
  const low = Math.round(inputTokens * 0.4);
  const high = Math.round(inputTokens * 0.9);
  console.log(`requests      ${requests}`);
  console.log(`input tokens  ${inputTokens.toLocaleString()}`);
  console.log(`output (est.) ${low.toLocaleString()} – ${high.toLocaleString()}`);
  console.log(`cost (batch)  $${dollars(inputTokens, low).toFixed(2)} – $${dollars(inputTokens, high).toFixed(2)}`);
}

async function estimate(offline: boolean) {
  const requests = buildRequests();
  let inputTokens = 0;
  if (offline) {
    inputTokens = Math.round(
      requests.reduce((sum, { params }) => sum + JSON.stringify(params.messages).length + SYSTEM.length, 0) / CHARS_PER_TOKEN,
    );
  } else {
    const anthropic = client();
    for (const { params } of requests) {
      const count = await anthropic.messages.countTokens({
        model: params.model,
        system: params.system,
        messages: params.messages,
        output_config: params.output_config,
      });
      inputTokens += count.input_tokens;
    }
  }
  printEstimate(inputTokens, requests.length);
}

async function submit() {
  const limit = Number(flagValue("--limit") ?? Infinity);
  const requests = buildRequests().slice(0, limit);
  const anthropic = client();
  const batch = await anthropic.messages.batches.create({
    requests: requests.map(({ meta, params }) => ({ custom_id: meta.custom_id, params })),
  });
  writeJson(REQUESTS, Object.fromEntries(requests.map(({ meta }) => [meta.custom_id, meta])));
  const batches = readJson<{ id: string; created_at: string; requests: number }[]>(BATCHES, []);
  batches.push({ id: batch.id, created_at: batch.created_at, requests: requests.length });
  writeJson(BATCHES, batches);
  console.log(`Batch ${batch.id} submitted with ${requests.length} requests (${batch.processing_status}).`);
}

async function collect(wait: boolean) {
  const batches = readJson<{ id: string }[]>(BATCHES, []);
  const latest = batches.at(-1);
  if (!latest) {
    console.error("No batch submitted yet.");
    process.exit(1);
  }
  const anthropic = client();
  const metas = readJson<Record<string, RequestMeta>>(REQUESTS, {});

  let batch = await anthropic.messages.batches.retrieve(latest.id);
  while (batch.processing_status !== "ended") {
    console.log(`Batch ${batch.id}: ${batch.processing_status}, processing ${batch.request_counts.processing}`);
    if (!wait) return;
    await new Promise((resolve) => setTimeout(resolve, 60_000));
    batch = await anthropic.messages.batches.retrieve(latest.id);
  }

  const problems: { custom_id: string; source?: string; reason: string }[] = [];
  let written = 0;
  let inputTokens = 0;
  let outputTokens = 0;

  for await (const result of await anthropic.messages.batches.results(latest.id)) {
    const meta = metas[result.custom_id];
    if (result.result.type !== "succeeded") {
      problems.push({ custom_id: result.custom_id, source: meta?.source, reason: result.result.type });
      continue;
    }
    const message = result.result.message;
    inputTokens += message.usage.input_tokens;
    outputTokens += message.usage.output_tokens;
    if (message.stop_reason !== "end_turn") {
      problems.push({ custom_id: result.custom_id, source: meta?.source, reason: `stop_reason ${message.stop_reason}` });
      continue;
    }
    const text = message.content.find((block) => block.type === "text")?.text ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      problems.push({ custom_id: result.custom_id, source: meta?.source, reason: "invalid JSON" });
      continue;
    }
    const data = ChunkSchema.safeParse(parsed);
    if (!data.success) {
      problems.push({ custom_id: result.custom_id, source: meta?.source, reason: data.error.message.slice(0, 300) });
      continue;
    }
    const outName = meta ? `${meta.slug}__${String(meta.chunk).padStart(2, "0")}` : result.custom_id;
    writeJson(path.join(STRUCTURED_DIR, `${outName}.json`), { ...meta, data: data.data });
    written += 1;
  }

  writeJson(path.join(STRUCTURED_DIR, "_problems.json"), problems);
  console.log(`Wrote ${written} chunk files, ${problems.length} problems (see content/structured/_problems.json).`);
  console.log(`Usage: ${inputTokens.toLocaleString()} in / ${outputTokens.toLocaleString()} out ≈ $${dollars(inputTokens, outputTokens).toFixed(2)}`);
}

if (hasFlag("--estimate")) await estimate(false);
else if (hasFlag("--estimate-offline")) await estimate(true);
else if (hasFlag("--submit")) await submit();
else if (hasFlag("--collect")) await collect(hasFlag("--wait"));
else console.log("Usage: --estimate | --estimate-offline | --submit [--limit=N] | --collect [--wait]");

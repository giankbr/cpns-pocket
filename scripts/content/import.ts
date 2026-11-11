/**
 * Step 3: content/structured/*.json → Supabase (status 'draft').
 * Signs in as an admin user (CONTENT_ADMIN_EMAIL / CONTENT_ADMIN_PASSWORD in .env.local) and calls the
 * admin-only import_content RPC (migration 0010), so no service-role key is needed.
 * Flags: --write (insert), --include-flagged (also import questions whose source key looks wrong).
 * Usage: node scripts/content/import.ts            dry run: validation + counts
 *        node scripts/content/import.ts --write    insert
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { contentHash, hasFlag, loadEnv, requireEnv, STRUCTURED_DIR, type SubjectCode } from "./lib.ts";
import { type Chunk, ChunkSchema } from "./schema.ts";

const write = hasFlag("--write");
const INSERT_BATCH = 40;
const includeFlagged = hasFlag("--include-flagged");

/** Topics used while structuring → official SKD blueprint topics (migration 0009). */
const TOPIC_MAP: Record<string, string> = {
  "TWK::Pancasila": "Pilar Negara",
  "TWK::UUD 1945": "Pilar Negara",
  "TWK::Bhinneka Tunggal Ika": "Pilar Negara",
  "TWK::NKRI": "Pilar Negara",
  "TWK::Sejarah dan Wawasan Kebangsaan": "Nasionalisme",
  "TIU::Logika": "Verbal",
  "TIU::Analitis": "Verbal",
};
const topicOf = (code: string, topic: string) => TOPIC_MAP[`${code}::${topic}`] ?? topic;

type ChunkFile = { source: string; data: Chunk };
type Question = Chunk["questions"][number];


function validate(question: Question): string | null {
  if (question.options.length !== 5) return "options != 5";
  if (question.options.some((option) => !option.trim())) return "empty option";
  if (!question.prompt.trim()) return "empty prompt";
  if (question.subject_code === "TKP") {
    const scores = question.tkp_scores;
    if (!scores || scores.length !== 5 || scores.some((score) => score < 1 || score > 5)) return "TKP without 5 scores";
  } else if (question.answer_index === null || question.answer_index < 0 || question.answer_index > 4) {
    return "missing answer key";
  }
  return null;
}

async function main() {
  if (!existsSync(STRUCTURED_DIR)) {
    console.error("No content/structured. Structure the documents first.");
    process.exit(1);
  }
  loadEnv();
  const supabase = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { persistSession: false },
  });
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: requireEnv("CONTENT_ADMIN_EMAIL"),
    password: requireEnv("CONTENT_ADMIN_PASSWORD"),
  });
  if (authError) throw new Error(`login: ${authError.message}`);

  const { data: subjects, error } = await supabase.from("subjects").select("code, topics(name)");
  if (error) throw new Error(error.message);
  const validTopics = new Set<string>();
  for (const subject of subjects as { code: SubjectCode; topics: { name: string }[] }[]) {
    for (const topic of subject.topics) validTopics.add(`${subject.code}::${topic.name}`);
  }

  const questions = new Map<string, Record<string, unknown>>();
  const materials = new Map<string, Record<string, unknown>>();
  const dropped = new Map<string, number>();
  const drop = (reason: string) => dropped.set(reason, (dropped.get(reason) ?? 0) + 1);
  const bySubject = new Map<string, number>();

  const files = readdirSync(STRUCTURED_DIR).filter((name) => name.endsWith(".json") && !name.startsWith("_"));
  for (const name of files) {
    let raw: ChunkFile;
    try {
      raw = JSON.parse(readFileSync(path.join(STRUCTURED_DIR, name), "utf8")) as ChunkFile;
    } catch {
      drop("unreadable chunk file");
      continue;
    }
    const parsed = ChunkSchema.safeParse(raw.data);
    if (!parsed.success) {
      drop("invalid chunk file");
      continue;
    }

    for (const question of parsed.data.questions) {
      const problem = validate(question);
      if (problem) {
        drop(problem);
        continue;
      }
      if (!includeFlagged && question.explanation?.trimStart().startsWith("Catatan:")) {
        drop("source key flagged as doubtful");
        continue;
      }
      const topic = topicOf(question.subject_code, question.topic);
      if (!validTopics.has(`${question.subject_code}::${topic}`)) {
        drop("topic not in subject");
        continue;
      }
      const hash = contentHash(question.prompt, ...question.options);
      if (questions.has(hash)) {
        drop("duplicate question");
        continue;
      }
      const weighted = question.subject_code === "TKP";
      questions.set(hash, {
        subject_code: question.subject_code,
        topic,
        type: weighted ? "weighted" : "objective",
        prompt: question.prompt.trim(),
        explanation: question.explanation?.trim() ?? "",
        difficulty: question.difficulty,
        source: raw.source,
        content_hash: hash,
        options: question.options.map((option) => option.trim()),
        ...(weighted ? { scores: question.tkp_scores } : { answer_index: question.answer_index }),
      });
      bySubject.set(question.subject_code, (bySubject.get(question.subject_code) ?? 0) + 1);
    }

    for (const material of parsed.data.materials) {
      const topic = topicOf(material.subject_code, material.topic);
      if (!validTopics.has(`${material.subject_code}::${topic}`) || !material.body_markdown.trim()) {
        drop("material without topic/body");
        continue;
      }
      const hash = contentHash(material.title, material.body_markdown);
      if (materials.has(hash)) {
        drop("duplicate material");
        continue;
      }
      materials.set(hash, {
        subject_code: material.subject_code,
        topic,
        title: material.title.trim(),
        body: material.body_markdown.trim(),
        source: raw.source,
        content_hash: hash,
      });
    }
  }

  console.log(`chunk files  ${files.length}`);
  console.log(`questions    ${questions.size} (${[...bySubject].map(([code, n]) => `${code} ${n}`).join(", ") || "none"})`);
  console.log(`materials    ${materials.size}`);
  console.log(`dropped      ${[...dropped].map(([reason, n]) => `${reason}: ${n}`).join("; ") || "none"}`);

  if (!write) {
    console.log("\nDry run. Re-run with --write to insert as draft.");
    return;
  }

  const totals = { questions: 0, materials: 0, skipped: 0 };
  const send = async (payload: { p_questions?: unknown[]; p_materials?: unknown[] }) => {
    const { data, error: rpcError } = await supabase.rpc("import_content", payload);
    if (rpcError) throw new Error(`import_content: ${rpcError.message}`);
    const result = data as typeof totals;
    totals.questions += result.questions;
    totals.materials += result.materials;
    totals.skipped += result.skipped;
  };

  const questionRows = [...questions.values()];
  for (let i = 0; i < questionRows.length; i += INSERT_BATCH) {
    await send({ p_questions: questionRows.slice(i, i + INSERT_BATCH) });
    console.log(`questions ${Math.min(i + INSERT_BATCH, questionRows.length)}/${questionRows.length}`);
  }
  const materialRows = [...materials.values()];
  for (let i = 0; i < materialRows.length; i += INSERT_BATCH) {
    await send({ p_materials: materialRows.slice(i, i + INSERT_BATCH) });
  }
  console.log(`inserted ${totals.questions} questions, ${totals.materials} materials as draft; ${totals.skipped} already existed or skipped.`);
}

await main();

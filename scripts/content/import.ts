/**
 * Step 3: content/structured/*.json → Supabase (status 'draft').
 * Requires migration 0007_content_source.sql. Uses the service-role key (server-side only).
 * Usage: node scripts/content/import.ts            dry run: validation + counts
 *        node scripts/content/import.ts --write    insert
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { contentHash, hasFlag, loadEnv, requireEnv, STRUCTURED_DIR, type SubjectCode } from "./lib.ts";
import { type Chunk, ChunkSchema } from "./schema.ts";

const write = hasFlag("--write");
const INSERT_BATCH = 100;

type ChunkFile = { source: string; data: Chunk };
type Question = Chunk["questions"][number];
type Prepared = {
  hash: string;
  source: string;
  topicId: string;
  type: "objective" | "weighted";
  question: Question;
};

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

async function fetchAll<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

async function main() {
  if (!existsSync(STRUCTURED_DIR)) {
    console.error("No content/structured. Run content:collect first.");
    process.exit(1);
  }
  loadEnv();
  const supabase = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });

  const { data: subjects, error } = await supabase.from("subjects").select("code, topics(id, name)");
  if (error) throw new Error(error.message);
  const topicIds = new Map<string, string>();
  for (const subject of subjects as { code: SubjectCode; topics: { id: string; name: string }[] }[]) {
    for (const topic of subject.topics) topicIds.set(`${subject.code}::${topic.name}`, topic.id);
  }

  const existingQuestions = new Set(
    (await fetchAll<{ content_hash: string | null }>((from, to) =>
      supabase.from("questions").select("content_hash").not("content_hash", "is", null).range(from, to),
    )).map((row) => row.content_hash),
  );
  const existingMaterials = new Set(
    (await fetchAll<{ content_hash: string | null }>((from, to) =>
      supabase.from("learning_materials").select("content_hash").not("content_hash", "is", null).range(from, to),
    )).map((row) => row.content_hash),
  );

  const questions = new Map<string, Prepared>();
  const materials = new Map<string, { topic_id: string; title: string; body: string; source: string; content_hash: string }>();
  const dropped = new Map<string, number>();
  const drop = (reason: string) => dropped.set(reason, (dropped.get(reason) ?? 0) + 1);

  const files = readdirSync(STRUCTURED_DIR).filter((name) => name.endsWith(".json") && !name.startsWith("_"));
  for (const name of files) {
    const raw = JSON.parse(readFileSync(path.join(STRUCTURED_DIR, name), "utf8")) as ChunkFile;
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
      const topicId = topicIds.get(`${question.subject_code}::${question.topic}`);
      if (!topicId) {
        drop("topic not in subject");
        continue;
      }
      const hash = contentHash(question.prompt, ...question.options);
      if (questions.has(hash) || existingQuestions.has(hash)) {
        drop("duplicate question");
        continue;
      }
      questions.set(hash, {
        hash,
        source: raw.source,
        topicId,
        type: question.subject_code === "TKP" ? "weighted" : "objective",
        question,
      });
    }

    for (const material of parsed.data.materials) {
      const topicId = topicIds.get(`${material.subject_code}::${material.topic}`);
      if (!topicId || !material.body_markdown.trim()) {
        drop("material without topic/body");
        continue;
      }
      const hash = contentHash(material.title, material.body_markdown);
      if (materials.has(hash) || existingMaterials.has(hash)) {
        drop("duplicate material");
        continue;
      }
      materials.set(hash, {
        topic_id: topicId,
        title: material.title.trim(),
        body: material.body_markdown.trim(),
        source: raw.source,
        content_hash: hash,
      });
    }
  }

  const bySubject = new Map<string, number>();
  for (const { question } of questions.values()) {
    bySubject.set(question.subject_code, (bySubject.get(question.subject_code) ?? 0) + 1);
  }
  console.log(`chunk files  ${files.length}`);
  console.log(`questions    ${questions.size} (${[...bySubject].map(([code, n]) => `${code} ${n}`).join(", ") || "none"})`);
  console.log(`materials    ${materials.size}`);
  console.log(`dropped      ${[...dropped].map(([reason, n]) => `${reason}: ${n}`).join("; ") || "none"}`);

  if (!write) {
    console.log("\nDry run. Re-run with --write to insert as draft.");
    return;
  }

  const prepared = [...questions.values()];
  for (let i = 0; i < prepared.length; i += INSERT_BATCH) {
    const slice = prepared.slice(i, i + INSERT_BATCH);
    const { data: inserted, error: questionError } = await supabase
      .from("questions")
      .insert(
        slice.map((item) => ({
          topic_id: item.topicId,
          type: item.type,
          prompt: item.question.prompt.trim(),
          explanation: item.question.explanation?.trim() || null,
          difficulty: item.question.difficulty,
          status: "draft",
          source: item.source,
          content_hash: item.hash,
        })),
      )
      .select("id, content_hash");
    if (questionError) throw new Error(`questions: ${questionError.message}`);

    const idByHash = new Map((inserted ?? []).map((row) => [row.content_hash as string, row.id as string]));
    const optionRows = slice.flatMap((item) =>
      item.question.options.map((label, sort_order) => ({ question_id: idByHash.get(item.hash)!, label: label.trim(), sort_order })),
    );
    const { data: options, error: optionError } = await supabase
      .from("question_options")
      .insert(optionRows)
      .select("id, question_id, sort_order");
    if (optionError) throw new Error(`question_options: ${optionError.message}`);

    const itemById = new Map(slice.map((item) => [idByHash.get(item.hash)!, item]));
    const keyRows = (options ?? []).map((option) => {
      const item = itemById.get(option.question_id as string)!;
      return item.type === "weighted"
        ? { option_id: option.id, is_correct: null, score: item.question.tkp_scores![option.sort_order as number] }
        : { option_id: option.id, is_correct: option.sort_order === item.question.answer_index, score: null };
    });
    const { error: keyError } = await supabase.from("question_answer_keys").insert(keyRows);
    if (keyError) throw new Error(`question_answer_keys: ${keyError.message}`);
    console.log(`inserted questions ${Math.min(i + INSERT_BATCH, prepared.length)}/${prepared.length}`);
  }

  const materialRows = [...materials.values()].map((material) => ({ ...material, status: "draft" }));
  for (let i = 0; i < materialRows.length; i += INSERT_BATCH) {
    const { error: materialError } = await supabase.from("learning_materials").insert(materialRows.slice(i, i + INSERT_BATCH));
    if (materialError) throw new Error(`learning_materials: ${materialError.message}`);
  }
  console.log(`inserted materials ${materialRows.length}. Review, then run content:publish.`);
}

await main();

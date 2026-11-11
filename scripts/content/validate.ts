/**
 * Validates structured chunk files: node scripts/content/validate.ts content/structured/<name>.json [...]
 * File shape: { "source": "<path under content/raw>", "data": { materials: [...], questions: [...] } }
 */
import { readFileSync } from "node:fs";
import { TOPICS } from "./lib.ts";
import { ChunkSchema } from "./schema.ts";

let failed = false;
for (const file of process.argv.slice(2)) {
  try {
    const raw = JSON.parse(readFileSync(file, "utf8")) as { source?: unknown; data?: unknown };
    if (typeof raw.source !== "string" || !raw.source) throw new Error("missing source");
    const data = ChunkSchema.parse(raw.data);
    const problems: string[] = [];
    data.questions.forEach((question, index) => {
      const at = `questions[${index}]`;
      if (question.options.length !== 5) problems.push(`${at}: needs exactly 5 options`);
      if (!TOPICS[question.subject_code].includes(question.topic)) problems.push(`${at}: topic not in ${question.subject_code}`);
      if (question.subject_code === "TKP") {
        // null = no key in the source; allowed here, dropped at import.
        if (question.tkp_scores !== null && (question.tkp_scores.length !== 5 || question.tkp_scores.some((score) => score < 1 || score > 5)))
          problems.push(`${at}: TKP needs 5 scores 1-5`);
      } else if (question.answer_index !== null && (question.answer_index < 0 || question.answer_index > 4)) {
        problems.push(`${at}: answer_index out of range`);
      }
    });
    data.materials.forEach((material, index) => {
      if (!TOPICS[material.subject_code].includes(material.topic)) problems.push(`materials[${index}]: topic not in ${material.subject_code}`);
    });
    if (problems.length) throw new Error(problems.slice(0, 10).join("; "));
    const keyed = data.questions.filter((q) => q.answer_index !== null || q.tkp_scores !== null).length;
    console.log(`ok   ${file}: ${data.questions.length} questions (${keyed} with key), ${data.materials.length} materials`);
  } catch (error) {
    failed = true;
    console.log(`FAIL ${file}: ${String(error).slice(0, 600)}`);
  }
}
process.exit(failed ? 1 : 0);

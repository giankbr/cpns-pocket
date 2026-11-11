import { z } from "zod";
import { ALL_TOPICS } from "./lib.ts";

const SUBJECT = z.enum(["TWK", "TIU", "TKP", "ENG"]);
const TOPIC = z.enum(ALL_TOPICS as [string, ...string[]]);

/** Structured output for one document chunk (see structure.ts). */
export const ChunkSchema = z.object({
  materials: z.array(
    z.object({
      subject_code: SUBJECT,
      topic: TOPIC,
      title: z.string(),
      body_markdown: z.string(),
    }),
  ),
  questions: z.array(
    z.object({
      subject_code: SUBJECT,
      topic: TOPIC,
      difficulty: z.enum(["easy", "medium", "hard"]),
      prompt: z.string(),
      options: z.array(z.string()),
      answer_index: z.number().int().nullable(),
      tkp_scores: z.array(z.number().int()).nullable(),
      explanation: z.string().nullable(),
    }),
  ),
});
export type Chunk = z.infer<typeof ChunkSchema>;

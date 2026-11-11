/**
 * Splits extracted documents into chunk files for agent-based structuring.
 * Usage: node scripts/content/chunk.ts [--max-doc=200000] [--min-doc=0]
 * Writes content/chunks/<slug>__NN.txt and content/chunks/index.json. Skips documents
 * that already have structured output.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CONTENT, flagValue, type ManifestEntry, MANIFEST, readJson, STRUCTURED_DIR, TEXT_DIR, writeJson } from "./lib.ts";

const CHUNK_CHARS = 70_000;
const CHUNKS_DIR = path.join(CONTENT, "chunks");
const maxDoc = Number(flagValue("--max-doc") ?? Infinity);
const minDoc = Number(flagValue("--min-doc") ?? 0);

/** Greedy split on page breaks (\f), falling back to blank lines for oversized pages. */
function split(text: string): string[] {
  const pieces = text.split("\f").flatMap((page) => (page.length > CHUNK_CHARS ? page.split(/\n\s*\n/).map((p) => `${p}\n\n`) : [page]));
  const chunks: string[] = [];
  let current = "";
  for (const piece of pieces) {
    if (current && current.length + piece.length > CHUNK_CHARS) {
      chunks.push(current);
      current = "";
    }
    current += piece;
    while (current.length > CHUNK_CHARS * 1.5) {
      chunks.push(current.slice(0, CHUNK_CHARS));
      current = current.slice(CHUNK_CHARS);
    }
  }
  if (current.trim()) chunks.push(current);
  return chunks;
}

mkdirSync(CHUNKS_DIR, { recursive: true });
const done = new Set(existsSync(STRUCTURED_DIR) ? readdirSync(STRUCTURED_DIR).map((name) => name.replace(/(__\d+)?\.json$/, "")) : []);
const seen = new Set<string>();
const index: { chunk: string; out: string; slug: string; source: string; part: number; parts: number; fullText: string }[] = [];

for (const entry of readJson<ManifestEntry[]>(MANIFEST, [])) {
  if (!entry.hash || entry.note || entry.chars < 400 || seen.has(entry.hash)) continue;
  seen.add(entry.hash);
  if (done.has(entry.slug) || entry.chars > maxDoc || entry.chars <= minDoc) continue;
  const fullText = path.join(TEXT_DIR, `${entry.slug}.txt`);
  if (!existsSync(fullText)) continue;
  const chunks = split(readFileSync(fullText, "utf8"));
  chunks.forEach((chunk, i) => {
    const name = `${entry.slug}__${String(i + 1).padStart(2, "0")}`;
    writeFileSync(path.join(CHUNKS_DIR, `${name}.txt`), chunk);
    index.push({
      chunk: `content/chunks/${name}.txt`,
      out: `content/structured/${name}.json`,
      slug: entry.slug,
      source: entry.file,
      part: i + 1,
      parts: chunks.length,
      fullText: `content/text/${entry.slug}.txt`,
    });
  });
}

writeJson(path.join(CHUNKS_DIR, "index.json"), index);
console.log(`${new Set(index.map((item) => item.slug)).size} documents → ${index.length} chunks`);

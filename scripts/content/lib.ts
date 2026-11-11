import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/** All paths are relative to the repo root; run scripts from there (npm run content:*). */
export const ROOT = process.cwd();
export const CONTENT = path.join(ROOT, "content");
export const RAW_DIR = path.join(CONTENT, "raw");
export const TEXT_DIR = path.join(CONTENT, "text");
export const STRUCTURED_DIR = path.join(CONTENT, "structured");
export const MANIFEST = path.join(TEXT_DIR, "manifest.json");
export const REQUESTS = path.join(CONTENT, "requests.json");
export const BATCHES = path.join(CONTENT, "batches.json");

export type SubjectCode = "TWK" | "TIU" | "TKP" | "ENG";

/** Mirrors supabase/migrations 0003, 0004 and 0009. */
export const TOPICS: Record<SubjectCode, string[]> = {
  // Official blueprint topics first; the rest are legacy names mapped at import (see import.ts TOPIC_MAP).
  TWK: [
    "Nasionalisme", "Integritas", "Bela Negara", "Pilar Negara", "Bahasa Indonesia",
    "Pancasila", "UUD 1945", "Bhinneka Tunggal Ika", "NKRI", "Sejarah dan Wawasan Kebangsaan",
  ],
  TIU: ["Verbal", "Numerik", "Figural", "Logika", "Analitis"],
  TKP: [
    "Pelayanan Publik",
    "Jejaring Kerja",
    "Sosial Budaya",
    "Teknologi Informasi",
    "Profesionalisme",
    "Anti-radikalisme",
  ],
  ENG: [
    "Structure (Grammar)",
    "Written Expression (Error Recognition)",
    "Vocabulary (Synonym & Antonym)",
    "Reading Comprehension",
  ],
};

export const ALL_TOPICS = [...new Set(Object.values(TOPICS).flat())];

export type ManifestEntry = {
  file: string; // path relative to content/raw
  slug: string;
  method: "pdftotext" | "ocr" | "textutil" | "skipped" | "failed";
  pages: number | null;
  chars: number;
  hash: string | null;
  duplicateOf: string | null; // slug of the first identical file
  note?: string;
};

export function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function contentHash(...parts: string[]): string {
  return sha256(normalize(parts.join("\n")));
}

export function slugify(file: string): string {
  return file
    .replace(/\.[^.]+$/, "")
    .replace(/(^|\/)Salinan\s+/gi, "$1")
    .normalize("NFKD")
    .replace(/[^\w/-]+/g, "-")
    .replace(/\//g, "__")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 120);
}

export function readJson<T>(file: string, fallback: T): T {
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : fallback;
}

export function writeJson(file: string, data: unknown) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

export function loadEnv() {
  const envFile = path.join(ROOT, ".env.local");
  if (existsSync(envFile)) process.loadEnvFile(envFile);
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name} in .env.local`);
    process.exit(1);
  }
  return value;
}

export const hasFlag = (flag: string) => process.argv.includes(flag);

export function flagValue(flag: string): string | undefined {
  const hit = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return hit?.slice(flag.length + 1);
}

/**
 * Step 1: content/raw/** → content/text/<slug>.txt + manifest.json
 * PDF via pdftotext (OCR fallback with pdftoppm + tesseract), doc/docx via macOS textutil.
 * Usage: node scripts/content/extract.ts [--force]
 */
import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { hasFlag, type ManifestEntry, MANIFEST, normalize, RAW_DIR, readJson, sha256, slugify, TEXT_DIR, writeJson } from "./lib.ts";

const run = promisify(execFile);
const MAX_BUFFER = 256 * 1024 * 1024;
const MIN_CHARS_PER_PAGE = 100;
const CONCURRENCY = 4;
const force = hasFlag("--force");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

async function ocrLanguage(): Promise<string> {
  const { stdout, stderr } = await run("tesseract", ["--list-langs"]);
  const langs = `${stdout}\n${stderr}`;
  if (/^ind$/m.test(langs)) return "ind+eng";
  console.warn("tesseract 'ind' not installed, OCR uses 'eng' (better: brew install tesseract-lang)");
  return "eng";
}

async function pdfPages(file: string): Promise<number | null> {
  try {
    const { stdout } = await run("pdfinfo", [file], { maxBuffer: MAX_BUFFER });
    const match = stdout.match(/^Pages:\s+(\d+)/m);
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

async function ocrPdf(file: string, lang: string): Promise<string> {
  const dir = mkdtempSync(path.join(tmpdir(), "cpns-ocr-"));
  try {
    await run("pdftoppm", ["-r", "200", "-png", file, path.join(dir, "p")], { maxBuffer: MAX_BUFFER });
    const pages = readdirSync(dir).filter((name) => name.endsWith(".png")).sort();
    const texts: string[] = [];
    for (const page of pages) {
      const { stdout } = await run("tesseract", [path.join(dir, page), "-", "-l", lang], { maxBuffer: MAX_BUFFER });
      texts.push(stdout);
    }
    return texts.join("\n\f\n");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

type Extracted = Pick<ManifestEntry, "method" | "pages" | "chars" | "note"> & { text?: string };

async function extract(file: string, lang: string): Promise<Extracted> {
  const ext = path.extname(file).toLowerCase();

  if (ext === ".pdf") {
    const pages = await pdfPages(file);
    const { stdout } = await run("pdftotext", ["-layout", file, "-"], { maxBuffer: MAX_BUFFER });
    const textChars = stdout.replace(/\s+/g, "").length;
    if (pages && textChars / pages >= MIN_CHARS_PER_PAGE) {
      return { method: "pdftotext", pages, chars: stdout.length, text: stdout };
    }
    const ocr = await ocrPdf(file, lang);
    return { method: "ocr", pages, chars: ocr.length, text: ocr };
  }

  if (ext === ".docx" || ext === ".doc") {
    const { stdout } = await run("textutil", ["-convert", "txt", "-stdout", file], { maxBuffer: MAX_BUFFER });
    return { method: "textutil", pages: null, chars: stdout.length, text: stdout };
  }

  return { method: "skipped", pages: null, chars: 0, note: `unsupported ${ext || "file"}` };
}

async function main() {
  if (!existsSync(RAW_DIR)) {
    console.error(`No ${RAW_DIR}. Download the Drive folder there first.`);
    process.exit(1);
  }
  mkdirSync(TEXT_DIR, { recursive: true });

  const lang = await ocrLanguage();
  const previous = new Map(readJson<ManifestEntry[]>(MANIFEST, []).map((entry) => [entry.file, entry]));
  const files = walk(RAW_DIR).map((full) => path.relative(RAW_DIR, full)).sort();
  const entries: ManifestEntry[] = [];
  const usedSlugs = new Set<string>();

  const slugFor = (file: string) => {
    let slug = slugify(file);
    for (let i = 2; usedSlugs.has(slug); i++) slug = `${slugify(file)}-${i}`;
    usedSlugs.add(slug);
    return slug;
  };

  const jobs = files.map((file) => ({ file, slug: slugFor(file) }));
  let cursor = 0;
  const texts = new Map<string, string>();

  async function worker() {
    while (cursor < jobs.length) {
      const { file, slug } = jobs[cursor++];
      const cached = previous.get(file);
      const textPath = path.join(TEXT_DIR, `${cached?.slug ?? slug}.txt`);

      if (!force && cached && cached.method !== "failed" && (cached.method === "skipped" || existsSync(textPath))) {
        entries.push({ ...cached, duplicateOf: null });
        if (cached.method !== "skipped") texts.set(file, readFileSync(textPath, "utf8"));
        continue;
      }

      try {
        const { text, ...meta } = await extract(path.join(RAW_DIR, file), lang);
        entries.push({ ...meta, file, slug, hash: text ? sha256(normalize(text)) : null, duplicateOf: null });
        if (text) {
          texts.set(file, text);
          writeFileSync(path.join(TEXT_DIR, `${slug}.txt`), text);
        }
        console.log(`${meta.method.padEnd(9)} ${file}${meta.note ? ` (${meta.note})` : ""}`);
      } catch (error) {
        entries.push({ file, slug, method: "failed", pages: null, chars: 0, hash: null, duplicateOf: null, note: String(error).slice(0, 200) });
        console.warn(`failed    ${file}: ${String(error).slice(0, 120)}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  entries.sort((a, b) => a.file.localeCompare(b.file));
  const firstByHash = new Map<string, string>();
  for (const entry of entries) {
    const text = texts.get(entry.file);
    if (!entry.hash || !text) continue;
    if (normalize(text).length < 200) {
      entry.note = "too little text";
      continue;
    }
    const original = firstByHash.get(entry.hash);
    if (original) {
      entry.duplicateOf = original;
      rmSync(path.join(TEXT_DIR, `${entry.slug}.txt`), { force: true });
    } else {
      firstByHash.set(entry.hash, entry.slug);
      writeFileSync(path.join(TEXT_DIR, `${entry.slug}.txt`), text);
    }
  }

  writeJson(MANIFEST, entries);

  const unique = entries.filter((entry) => entry.hash && !entry.duplicateOf && !entry.note);
  const count = (method: ManifestEntry["method"]) => entries.filter((entry) => entry.method === method).length;
  console.log("\nSummary");
  console.log(`  files       ${entries.length}`);
  console.log(`  pdftotext   ${count("pdftotext")}, ocr ${count("ocr")}, textutil ${count("textutil")}`);
  console.log(`  skipped     ${count("skipped")}, failed ${count("failed")}`);
  console.log(`  duplicates  ${entries.filter((entry) => entry.duplicateOf).length}`);
  console.log(`  unique docs ${unique.length}, chars ${unique.reduce((sum, entry) => sum + entry.chars, 0).toLocaleString()}`);
}

await main();

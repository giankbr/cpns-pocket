/**
 * Step 4: flip imported drafts to published.
 * Usage: node scripts/content/publish.ts [--source=<substring>]          dry run (counts)
 *        node scripts/content/publish.ts [--source=<substring>] --write
 */
import { createClient } from "@supabase/supabase-js";
import { flagValue, hasFlag, loadEnv, requireEnv } from "./lib.ts";

loadEnv();
const supabase = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});
const source = flagValue("--source");
const write = hasFlag("--write");

for (const table of ["questions", "learning_materials"] as const) {
  let count = supabase.from(table).select("id", { count: "exact", head: true }).eq("status", "draft").not("source", "is", null);
  if (source) count = count.ilike("source", `%${source}%`);
  const { count: drafts, error } = await count;
  if (error) throw new Error(`${table}: ${error.message}`);

  if (!write) {
    console.log(`${table}: ${drafts ?? 0} imported drafts${source ? ` matching "${source}"` : ""}`);
    continue;
  }

  let update = supabase.from(table).update({ status: "published" }).eq("status", "draft").not("source", "is", null);
  if (source) update = update.ilike("source", `%${source}%`);
  const { error: updateError } = await update;
  if (updateError) throw new Error(`${table}: ${updateError.message}`);
  console.log(`${table}: published ${drafts ?? 0}`);
}

if (!write) console.log("\nDry run. Re-run with --write to publish.");

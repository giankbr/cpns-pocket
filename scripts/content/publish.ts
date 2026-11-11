/**
 * Publishes reviewed drafts: node scripts/content/publish.ts [--source="<file under content/raw>"]
 * Signs in as the admin user and calls the admin-only publish_content RPC.
 */
import { createClient } from "@supabase/supabase-js";
import { flagValue, loadEnv, requireEnv } from "./lib.ts";

loadEnv();
const supabase = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
  auth: { persistSession: false },
});
const { error: authError } = await supabase.auth.signInWithPassword({
  email: requireEnv("CONTENT_ADMIN_EMAIL"),
  password: requireEnv("CONTENT_ADMIN_PASSWORD"),
});
if (authError) throw new Error(`login: ${authError.message}`);

const { data, error } = await supabase.rpc("publish_content", { p_source: flagValue("--source") ?? null });
if (error) throw new Error(error.message);
console.log("published", data);

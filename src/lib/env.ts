function required(name: string, value = process.env[name]): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

// NEXT_PUBLIC_* must be read with static property access so Next.js inlines them into the browser bundle.
export function getSupabaseEnv() {
  return {
    url: required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    anonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  };
}

export function getSupabaseAdminEnv() {
  return {
    url: required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

export function getAnthropicEnv() {
  const apiKey = required("ANTHROPIC_API_KEY");

  return {
    apiKey,
    model: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
    // Required when the API key is not scoped to a single workspace.
    workspaceId: process.env.ANTHROPIC_WORKSPACE_ID || undefined,
  };
}

import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Profile = {
  display_name: string | null;
  role: "member" | "admin";
  status: "active" | "disabled";
  daily_target: number;
  created_at: string;
};

/** Cached per request so layout and page share one auth round-trip. */
export const requireSession = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("display_name, role, status, daily_target, created_at")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  if (error || !profile || profile.status !== "active") {
    redirect("/login");
  }

  return { user, profile, supabase };
});

export async function requireUser() {
  return (await requireSession()).user;
}

export function displayNameOf(user: { email?: string }, profile: Profile) {
  const name = profile.display_name?.trim();
  if (name && !name.includes("@")) return name.split(" ")[0];
  return user.email?.split("@")[0] ?? "Pelajar";
}

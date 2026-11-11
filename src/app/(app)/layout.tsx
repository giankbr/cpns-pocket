import type { ReactNode } from "react";
import { AppShell } from "@/components/app/app-shell";
import { displayNameOf, requireSession } from "@/lib/auth/guards";
import { greetingFor } from "@/lib/study/stats";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { user, profile } = await requireSession();

  return (
    <AppShell user={{ name: displayNameOf(user, profile), email: user.email ?? "" }} greeting={greetingFor()}>
      {children}
    </AppShell>
  );
}

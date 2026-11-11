"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/app/app-shell";
import { ThemeToggle } from "@/components/app/theme";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage(error.message);
      setIsSubmitting(false);
      return;
    }

    router.replace("/dashboard");
  }

  return (
    <main className="relative grid min-h-screen place-items-center bg-canvas px-6">
      <ThemeToggle className="absolute top-4 right-4" />
      <section className="w-full max-w-md rounded-2xl border border-line bg-surface p-8 shadow-[0_24px_60px_-20px_var(--shadow)]">
        <div className="mb-8">
          <div className="mb-6 flex items-center gap-2.5">
            <Logo />
            <span className="font-serif lining-nums text-xl tracking-tight text-ink">CPNS Pocket</span>
          </div>
          <h1 className="font-serif lining-nums text-[32px] leading-10 tracking-tight text-ink">Masuk ke ruang belajar</h1>
          <p className="mt-2 text-sm leading-6 text-muted">Akses hanya tersedia untuk akun yang diundang.</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm text-ink">
            Email
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-line-strong px-3 font-normal outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
              autoComplete="email"
            />
          </label>
          <label className="block text-sm text-ink">
            Password
            <input
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-line-strong px-3 font-normal outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
              autoComplete="current-password"
            />
          </label>
          {message && (
            <p role="alert" className="rounded-xl bg-danger/5 px-3 py-2 text-sm text-danger">
              {message}
            </p>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-11 w-full rounded-xl btn-solid px-4 text-sm font-medium transition-[filter] duration-150 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Memeriksa..." : "Masuk"}
          </button>
        </form>
      </section>
    </main>
  );
}

"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/app/app-shell";
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
    <main className="grid min-h-screen place-items-center bg-canvas px-6">
      <section className="w-full max-w-md rounded-2xl border border-line bg-surface p-8 shadow-[0_24px_60px_-20px_rgba(22,26,35,0.12)]">
        <div className="mb-8">
          <div className="mb-6 flex items-center gap-2.5">
            <Logo />
            <span className="text-xl font-semibold tracking-tight text-primary">CPNS Pocket</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Masuk ke ruang belajar</h1>
          <p className="mt-2 text-sm leading-6 text-muted">Akses hanya tersedia untuk akun yang diundang.</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-ink">
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
          <label className="block text-sm font-medium text-ink">
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
            className="h-11 w-full rounded-xl bg-linear-to-b from-[#3a80ff] to-primary-strong px-4 text-sm font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_8px_18px_-8px_rgba(31,107,255,0.8)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Memeriksa..." : "Masuk"}
          </button>
        </form>
      </section>
    </main>
  );
}

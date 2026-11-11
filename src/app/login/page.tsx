"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
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
    <main className="flex min-h-screen items-center justify-center bg-[#f7f7f5] px-6">
      <section className="w-full max-w-md rounded-2xl border border-[#e7e5df] bg-white p-8 shadow-[0_20px_60px_rgba(27,27,24,0.06)]">
        <div className="mb-8">
          <p className="mb-3 text-sm font-semibold tracking-[0.18em] text-[#6d6c65] uppercase">
            CPNS Pocket
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-[#24241f]">
            Masuk ke ruang belajar
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#77766e]">
            Akses hanya tersedia untuk akun yang diundang.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-[#3d3c36]">
            Email
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 h-11 w-full rounded-lg border border-[#dcdad2] px-3 outline-none transition focus:border-[#77766e] focus:ring-2 focus:ring-[#e7e5df]"
              autoComplete="email"
            />
          </label>
          <label className="block text-sm font-medium text-[#3d3c36]">
            Password
            <input
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 h-11 w-full rounded-lg border border-[#dcdad2] px-3 outline-none transition focus:border-[#77766e] focus:ring-2 focus:ring-[#e7e5df]"
              autoComplete="current-password"
            />
          </label>
          {message && (
            <p role="alert" className="rounded-lg bg-[#fff4f1] px-3 py-2 text-sm text-[#9a4332]">
              {message}
            </p>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-11 w-full rounded-lg bg-[#272722] px-4 text-sm font-medium text-white transition hover:bg-[#44433b] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Memeriksa..." : "Masuk"}
          </button>
        </form>
      </section>
    </main>
  );
}

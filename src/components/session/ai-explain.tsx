"use client";

import { LoaderCircle, Sparkles } from "lucide-react";
import { useState } from "react";
import { Markdown } from "@/components/ui/markdown";

/** On-demand AI discussion for a question the user has already answered. */
export function AiExplain({ questionId, hasExplanation, compact = false }: { questionId: string; hasExplanation: boolean; compact?: boolean }) {
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId }),
      });
      const result = (await response.json()) as { answer?: string; error?: string };
      if (!response.ok || !result.answer) throw new Error(result.error || "AI tidak dapat membahas soal ini.");
      setAnswer(result.answer);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }

  if (answer) {
    return (
      <div className="mt-2 border-t border-line pt-2">
        <p className={`mb-1 flex items-center gap-1.5 text-primary ${compact ? "text-[10px]" : "text-xs"}`}>
          <Sparkles size={compact ? 11 : 13} /> Pembahasan AI
        </p>
        <div className="text-ink">
          <Markdown text={answer} compact={compact} />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={ask}
        disabled={loading}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-primary/40 font-medium text-primary transition-colors duration-150 hover:bg-primary-soft disabled:opacity-60 ${
          compact ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs"
        }`}
      >
        {loading ? <LoaderCircle size={13} className="animate-spin" /> : <Sparkles size={13} />}
        {loading ? "AI sedang membahas…" : hasExplanation ? "Bahas dengan AI" : "Minta pembahasan AI"}
      </button>
      {error && <p className={`mt-1 text-danger ${compact ? "text-[10px]" : "text-xs"}`}>{error}</p>}
    </div>
  );
}

"use client";

import { FormEvent, useState } from "react";
import { Send, Sparkles } from "lucide-react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export function AiChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = input.trim();

    if (!content || isLoading) return;

    const nextMessages = [...messages, { role: "user" as const, content }];
    setMessages(nextMessages);
    setInput("");
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const result = (await response.json()) as { answer?: string; error?: string };

      if (!response.ok || !result.answer) {
        throw new Error(result.error || "AI tidak dapat menjawab saat ini.");
      }

      setMessages([...nextMessages, { role: "assistant", content: result.answer }]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Terjadi kesalahan.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="flex h-[calc(100vh-124px)] min-h-[480px] flex-col rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-linear-to-b from-[#4f8dff] to-primary-strong text-white">
          <Sparkles size={19} />
        </span>
        <div>
          <h2 className="font-medium">Tanya AI</h2>
          <p className="text-sm text-muted">
            Penjelasan konsep TWK, TIU, TKP, Bahasa Inggris, atau strategi belajar.
          </p>
        </div>
      </div>

      <div className="mt-5 min-h-0 flex-1 space-y-3 overflow-y-auto">
        {messages.length === 0 && (
          <p className="rounded-xl border border-dashed border-line-strong px-4 py-5 text-sm leading-6 text-subtle">
            Contoh: &quot;Jelaskan perbedaan desentralisasi dan dekonsentrasi.&quot;
          </p>
        )}
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`rounded-2xl px-4 py-3 text-sm leading-6 whitespace-pre-line ${
              message.role === "user"
                ? "ml-12 bg-primary text-white"
                : "mr-12 bg-canvas text-ink"
            }`}
          >
            {message.content}
          </div>
        ))}
        {isLoading && (
          <p className="mr-12 rounded-2xl bg-canvas px-4 py-3 text-sm text-subtle">
            AI sedang berpikir...
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}

      <form className="mt-5 flex gap-2" onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Tulis pertanyaan..."
          maxLength={4000}
          className="h-11 min-w-0 flex-1 rounded-xl border border-line-strong px-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
          aria-label="Pertanyaan untuk AI"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-white transition hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send size={15} />
          Kirim
        </button>
      </form>
    </section>
  );
}

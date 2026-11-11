"use client";

import { FormEvent, useState } from "react";
import { Bot, Send } from "lucide-react";

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
    <section className="rounded-xl border border-[#e7e5df] bg-white p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-[#efeee9] p-2 text-[#55544d]">
          <Bot size={18} />
        </div>
        <div>
          <h2 className="font-semibold">Tanya AI</h2>
          <p className="mt-1 text-sm text-[#8a8981]">
            Minta penjelasan konsep CPNS atau strategi belajar.
          </p>
        </div>
      </div>

      <div className="mt-5 max-h-80 space-y-3 overflow-y-auto">
        {messages.length === 0 && (
          <p className="rounded-lg border border-dashed border-[#dcdad2] px-4 py-5 text-sm leading-6 text-[#8a8981]">
            Contoh: &quot;Jelaskan perbedaan desentralisasi dan dekonsentrasi.&quot;
          </p>
        )}
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`rounded-lg px-4 py-3 text-sm leading-6 ${
              message.role === "user"
                ? "ml-8 bg-[#272722] text-white"
                : "mr-8 bg-[#f7f7f5] text-[#55544d]"
            }`}
          >
            {message.content}
          </div>
        ))}
        {isLoading && (
          <p className="mr-8 rounded-lg bg-[#f7f7f5] px-4 py-3 text-sm text-[#8a8981]">
            AI sedang berpikir...
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-[#9a4332]">
          {error}
        </p>
      )}

      <form className="mt-5 flex gap-2" onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Tulis pertanyaan..."
          maxLength={4000}
          className="h-11 min-w-0 flex-1 rounded-lg border border-[#dcdad2] px-3 text-sm outline-none transition focus:border-[#77766e] focus:ring-2 focus:ring-[#e7e5df]"
          aria-label="Pertanyaan untuk AI"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#272722] px-4 text-sm font-medium text-white transition hover:bg-[#44433b] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send size={15} />
          Kirim
        </button>
      </form>
    </section>
  );
}

"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { PictureInPicture2, Send, Sparkles, Trash2 } from "lucide-react";
import { create } from "zustand";
import { useMini } from "@/components/mini/mini-mode";
import { Markdown } from "@/components/ui/markdown";

type ChatMessage = { role: "user" | "assistant"; content: string };

type ChatStore = {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  send: (content: string) => Promise<void>;
  reset: () => void;
};

/**
 * One conversation for the whole app: the Asisten page and Mini Mode show the same
 * thread, and it survives navigating between pages.
 */
const useChat = create<ChatStore>()((set, get) => ({
  messages: [],
  isLoading: false,
  error: null,
  reset: () => set({ messages: [], error: null }),
  send: async (content) => {
    if (!content || get().isLoading) return;
    // The API accepts at most 20 messages; keep the most recent ones.
    const nextMessages = [...get().messages, { role: "user" as const, content }];
    set({ messages: nextMessages, isLoading: true, error: null });

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages.slice(-20) }),
      });
      const result = (await response.json()) as { answer?: string; error?: string };
      if (!response.ok || !result.answer) throw new Error(result.error || "AI tidak dapat menjawab saat ini.");
      set({ messages: [...nextMessages, { role: "assistant", content: result.answer }] });
    } catch (requestError) {
      set({ error: requestError instanceof Error ? requestError.message : "Terjadi kesalahan." });
    } finally {
      set({ isLoading: false });
    }
  },
}));

export function AiChat({ compact = false }: { compact?: boolean }) {
  const { messages, isLoading, error, send, reset } = useChat();
  const [input, setInput] = useState("");
  const mini = useMini();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length, isLoading]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = input.trim();
    if (!content || isLoading) return;
    setInput("");
    void send(content);
  }

  return (
    <section
      className={
        compact
          ? "flex h-full min-h-0 flex-col"
          : "flex h-[calc(100dvh-88px)] min-h-[420px] flex-col rounded-xl border border-line bg-surface p-4"
      }
    >
      {!compact && (
        <div className="flex items-start gap-3">
          <span className="btn-solid grid size-9 place-items-center rounded-lg">
            <Sparkles size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px]">Tanya AI</h2>
            <p className="text-xs text-muted">Penjelasan konsep TWK, TIU, TKP, Bahasa Inggris, atau strategi belajar.</p>
          </div>
          <button
            type="button"
            onClick={() => void mini.open("ai")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 hover:border-primary hover:text-primary"
          >
            <PictureInPicture2 size={14} /> Mode mini
          </button>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={reset}
              aria-label="Mulai percakapan baru"
              className="grid size-8 place-items-center rounded-lg text-subtle transition-colors duration-150 hover:text-danger"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      )}

      <div ref={listRef} className={`min-h-0 flex-1 space-y-2.5 overflow-y-auto ${compact ? "" : "mt-4"}`}>
        {messages.length === 0 && (
          <p className="rounded-xl border border-dashed border-line-strong px-3.5 py-4 text-sm leading-6 text-subtle">
            Contoh: &quot;Jelaskan perbedaan desentralisasi dan dekonsentrasi.&quot;
          </p>
        )}
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`rounded-xl px-3 py-2 leading-6 ${message.role === "user" ? "whitespace-pre-line" : ""} ${compact ? "text-[13px]" : "text-sm"} ${
              message.role === "user" ? `${compact ? "ml-6" : "ml-12"} bg-primary text-white` : `${compact ? "mr-6" : "mr-12"} bg-canvas text-ink`
            }`}
          >
            {message.role === "assistant" ? <Markdown text={message.content} compact={compact} /> : message.content}
          </div>
        ))}
        {isLoading && <p className="mr-6 rounded-xl bg-canvas px-3 py-2 text-sm text-subtle">AI sedang berpikir…</p>}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}

      <form className={`flex gap-2 ${compact ? "mt-2" : "mt-4"}`} onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Tulis pertanyaan…"
          maxLength={4000}
          className={`min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 ${
            compact ? "h-9" : "h-10"
          }`}
          aria-label="Pertanyaan untuk AI"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          aria-label="Kirim"
          className={`btn-solid inline-flex items-center gap-2 rounded-lg text-sm font-medium transition-[filter] duration-150 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 ${
            compact ? "h-9 px-3" : "h-10 px-4"
          }`}
        >
          <Send size={15} />
          {!compact && "Kirim"}
        </button>
      </form>
    </section>
  );
}

"use client";

import { useShallow } from "zustand/react/shallow";
import { Flag, PictureInPicture2, Timer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { progressOf, type SessionInit } from "@/lib/study/session-state";
import { useMini } from "@/components/mini/mini-mode";
import { SessionMiniPortal } from "./mini-mode";
import { QuestionView } from "./question-view";
import { formatRemaining, SessionProvider, useCountdown, useSession, useSessionActions } from "./session-context";

export function SessionPlayer({ init, title }: { init: SessionInit; title: string }) {
  return (
    <SessionProvider init={init}>
      <Player title={title} />
    </SessionProvider>
  );
}

function Player({ title }: { title: string }) {
  const mode = useSession((s) => s.mode);
  const status = useSession((s) => s.status);
  const deadline = useSession((s) => s.deadline);
  const progress = useSession(useShallow(progressOf));
  const remaining = useCountdown(deadline);
  const { finish } = useSessionActions();
  const mini = useMini();
  const showingInMini = mini.active && mini.tab === "soal";
  const [confirming, setConfirming] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const autoSubmitted = useRef(false);

  useKeyboard(mini.pipWindow);

  // Time's up: submit automatically, once.
  useEffect(() => {
    if (remaining === 0 && status === "in_progress" && !autoSubmitted.current) {
      autoSubmitted.current = true;
      void finish();
    }
  }, [remaining, status, finish]);

  // Guard against closing the tab mid-exam.
  useEffect(() => {
    if (mode !== "exam" || status !== "in_progress") return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [mode, status]);

  async function confirmFinish() {
    setFinishing(true);
    const ok = await finish();
    if (!ok) setFinishing(false);
  }

  const unanswered = progress.total - progress.answered;

  return (
    <>
      <Card className="sticky top-[68px] z-20 col-span-12 flex flex-wrap items-center gap-3 px-4 py-3 shadow-[0_8px_24px_-16px_var(--shadow)]">
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-xl leading-6">{title}</p>
          <p className="text-xs text-muted tabular-nums">
            {progress.answered} dari {progress.total} soal dijawab
          </p>
        </div>
        {remaining !== null && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm tabular-nums ${
              remaining < 5 * 60_000 ? "border-danger/40 text-danger" : "border-line text-ink"
            }`}
            aria-live="off"
          >
            <Timer size={15} /> {formatRemaining(remaining)}
          </span>
        )}
        <button
          type="button"
          onClick={() => void mini.open("soal")}
          disabled={showingInMini}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition-colors duration-150 hover:border-primary hover:text-primary disabled:opacity-50"
          title={mini.supported ? "Buka jendela mengambang" : "Browser belum mendukung jendela mengambang; dibuka di halaman ini"}
        >
          <PictureInPicture2 size={15} /> Mode mini
        </button>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={status !== "in_progress"}
          className="btn-solid inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-[filter] duration-150 hover:brightness-110 disabled:opacity-50"
        >
          <Flag size={15} /> Selesai
        </button>
        {mini.error && <p className="w-full text-xs text-muted">{mini.error}</p>}
      </Card>

      <Card className="col-span-12 p-4 sm:p-6 lg:col-span-8">
        {showingInMini ? (
          <div className="grid h-full min-h-60 place-items-center text-center">
            <div>
              <p className="font-serif text-2xl">Sedang di mode mini</p>
              <p className="mt-1 text-sm text-muted">Soal tampil di jendela mengambang. Progres tetap tersimpan.</p>
              <button
                type="button"
                onClick={mini.close}
                className="mt-4 rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition-colors duration-150 hover:border-primary hover:text-primary"
              >
                Kembali ke tampilan penuh
              </button>
            </div>
          </div>
        ) : (
          <QuestionView />
        )}
      </Card>

      <Card className="col-span-12 self-start p-4 lg:col-span-4">
        <Navigator />
      </Card>

      <SessionMiniPortal />

      {confirming && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/30 p-4" role="dialog" aria-modal aria-labelledby="finish-title">
          <Card className="w-full max-w-sm p-5">
            <p id="finish-title" className="font-serif text-2xl">
              Akhiri sesi?
            </p>
            <p className="mt-2 text-sm text-muted">
              {unanswered > 0
                ? `Masih ada ${unanswered} soal belum dijawab. Soal kosong tidak mendapat nilai.`
                : "Semua soal sudah dijawab."}{" "}
              Setelah diakhiri, jawaban tidak bisa diubah.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium"
                autoFocus
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => void confirmFinish()}
                disabled={finishing}
                className="btn-solid rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-60"
              >
                {finishing ? "Menyimpan…" : "Ya, akhiri"}
              </button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

function Navigator() {
  const state = useSession((s) => s);
  const { dispatch } = useSessionActions();

  return (
    <div>
      <p className="mb-3 text-sm text-muted">Navigasi soal</p>
      <ol className="grid grid-cols-8 gap-1.5 sm:grid-cols-10 lg:grid-cols-6 xl:grid-cols-8">
        {state.questions.map((question, index) => {
          const answered = Boolean(state.answers[question.id]);
          const feedback = state.feedback[question.id];
          const verdict =
            feedback && question.type === "objective"
              ? feedback.options.find((option) => option.id === feedback.selected_option_id)?.is_correct
              : undefined;
          const current = index === state.index;

          let tone = "border-line text-muted hover:border-line-strong";
          if (answered) tone = "border-primary/40 bg-primary-soft text-primary";
          if (verdict === true) tone = "border-success/40 bg-success/10 text-success";
          if (verdict === false) tone = "border-danger/40 bg-danger/10 text-danger";

          return (
            <li key={question.id}>
              <button
                type="button"
                onClick={() => dispatch({ type: "goto", index })}
                aria-current={current ? "step" : undefined}
                aria-label={`Soal ${index + 1}${answered ? ", sudah dijawab" : ""}${state.bookmarks[question.id] ? ", ditandai" : ""}`}
                className={`relative grid aspect-square w-full place-items-center rounded-md border text-xs tabular-nums transition-colors duration-150 ${tone} ${
                  current ? "ring-2 ring-primary ring-offset-1 ring-offset-surface" : ""
                }`}
              >
                {index + 1}
                {state.bookmarks[question.id] && (
                  <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-accent" />
                )}
              </button>
            </li>
          );
        })}
      </ol>
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
        <Legend className="bg-primary-soft border-primary/40" label="Dijawab" />
        {state.mode === "practice" && <Legend className="bg-success/10 border-success/40" label="Benar" />}
        {state.mode === "practice" && <Legend className="bg-danger/10 border-danger/40" label="Salah" />}
        <Legend className="border-line" label="Belum" />
        <li className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-accent" /> Bookmark
        </li>
      </ul>
      <p className="mt-4 text-xs text-subtle">Pintasan: 1–5 pilih jawaban, ← → pindah soal, Enter periksa.</p>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span className={`size-3 rounded-sm border ${className}`} /> {label}
    </li>
  );
}

/** Keyboard shortcuts in the page and, when open, the floating window. */
function useKeyboard(pipWindow: Window | null) {
  const state = useSession((s) => s);
  const { answer, dispatch } = useSessionActions();
  const latest = useRef({ state, answer, dispatch });
  useEffect(() => {
    latest.current = { state, answer, dispatch };
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]") || event.metaKey || event.ctrlKey) return;
      const { state: s, answer: send, dispatch: act } = latest.current;
      const question = s.questions[s.index];
      if (!question) return;

      if (event.key === "ArrowRight") act({ type: "next" });
      else if (event.key === "ArrowLeft") act({ type: "prev" });
      else if (/^[1-5]$/.test(event.key)) {
        const option = question.options[Number(event.key) - 1];
        if (!option) return;
        if (s.mode === "exam") void send(question.id, option.id);
        else act({ type: "select", questionId: question.id, optionId: option.id });
      } else if (event.key === "Enter" && s.mode === "practice") {
        const draft = s.drafts[question.id];
        if (draft && !s.feedback[question.id]) void send(question.id, draft);
      } else return;
      event.preventDefault();
    };

    const targets = [window, ...(pipWindow ? [pipWindow] : [])];
    targets.forEach((target) => target.addEventListener("keydown", onKey));
    return () => targets.forEach((target) => target.removeEventListener("keydown", onKey));
  }, [pipWindow]);
}

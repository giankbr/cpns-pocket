"use client";

import { Bookmark, BookmarkCheck, Check, ChevronLeft, ChevronRight, LoaderCircle, X } from "lucide-react";
import { isLocked } from "@/lib/study/session-state";
import { subjectStyle } from "@/lib/study/queries";
import { useSession, useSessionActions } from "./session-context";

const letters = ["A", "B", "C", "D", "E"];

/** One question with its options. `compact` is the Mini Mode layout. */
export function QuestionView({ compact = false }: { compact?: boolean }) {
  const state = useSession((s) => s);
  const { answer, toggleBookmark, dispatch } = useSessionActions();
  const question = state.questions[state.index];
  if (!question) return null;

  const feedback = state.feedback[question.id];
  const keyById = new Map(feedback?.options.map((option) => [option.id, option]));
  const chosen = state.mode === "practice" ? (state.answers[question.id] ?? state.drafts[question.id]) : state.answers[question.id];
  const locked = isLocked(state, question.id);
  const pending = Boolean(state.pending[question.id]);
  const isWeighted = question.type === "weighted";
  const bookmarked = Boolean(state.bookmarks[question.id]);

  function pick(optionId: string) {
    if (locked) return;
    if (state.mode === "exam") void answer(question.id, optionId);
    else dispatch({ type: "select", questionId: question.id, optionId });
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-5"}>
      <div className="flex items-center gap-2">
        <span
          className="rounded-md px-1.5 py-0.5 text-[11px] text-white"
          style={{ backgroundColor: subjectStyle[question.subject].color }}
        >
          {subjectStyle[question.subject].short}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-muted">
          Soal {state.index + 1} dari {state.questions.length}
          {!compact && question.topic && ` · ${question.topic}`}
        </span>
        {question.appMade && (
          <span className="shrink-0 rounded-md bg-canvas px-1.5 py-0.5 text-[11px] text-muted" title="Soal latihan buatan aplikasi, bukan soal resmi">
            Buatan CPOCKET
          </span>
        )}
        <button
          type="button"
          onClick={() => void toggleBookmark(question.id)}
          aria-pressed={bookmarked}
          aria-label={bookmarked ? "Hapus bookmark" : "Simpan ke bookmark"}
          className={`grid place-items-center rounded-lg transition-colors duration-150 ${compact ? "size-6" : "size-8"} ${
            bookmarked ? "text-primary" : "text-subtle hover:text-ink"
          }`}
        >
          {bookmarked ? <BookmarkCheck size={compact ? 15 : 17} /> : <Bookmark size={compact ? 15 : 17} />}
        </button>
      </div>

      <p className={`whitespace-pre-line text-ink ${compact ? "text-[13px] leading-5" : "text-[17px] leading-7"}`}>
        {question.prompt}
      </p>

      <ul className={compact ? "space-y-1" : "space-y-2"} role="radiogroup" aria-label="Pilihan jawaban">
        {question.options.map((option, index) => {
          const key = keyById.get(option.id);
          const selected = chosen === option.id;
          const showKey = Boolean(feedback);
          const correct = showKey && !isWeighted && key?.is_correct;
          const wrong = showKey && !isWeighted && selected && !key?.is_correct;

          let tone = "border-line hover:border-line-strong hover:bg-canvas";
          if (selected) tone = "border-primary bg-primary-soft";
          if (correct) tone = "border-success bg-success/10";
          if (wrong) tone = "border-danger bg-danger/10";

          return (
            <li key={option.id}>
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={locked && !selected}
                onClick={() => pick(option.id)}
                className={`flex w-full items-start border text-left transition-colors duration-150 disabled:cursor-default ${tone} ${
                  compact ? "gap-2 rounded-lg px-2 py-1.5 text-[12.5px] leading-5" : "gap-3 rounded-xl px-3.5 py-3 text-[15px]"
                }`}
              >
                <span
                  className={`grid shrink-0 place-items-center rounded-md border ${
                    compact ? "size-5 text-[11px]" : "size-6 text-xs"
                  } ${
                    correct
                      ? "border-success bg-success text-white"
                      : wrong
                        ? "border-danger bg-danger text-white"
                        : selected
                          ? "border-primary bg-primary text-white"
                          : "border-line-strong text-muted"
                  }`}
                >
                  {correct ? <Check size={13} /> : wrong ? <X size={13} /> : letters[index]}
                </span>
                <span className="min-w-0 flex-1 whitespace-pre-line text-ink">{option.label}</span>
                {showKey && isWeighted && key?.score != null && (
                  <span className={`shrink-0 text-xs tabular-nums ${selected ? "text-primary" : "text-subtle"}`}>
                    +{key.score}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {state.error && (
        <p role="alert" className={`rounded-lg bg-danger/10 text-danger ${compact ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm"}`}>
          {state.error}
        </p>
      )}

      {feedback && (
        <div className={`bg-canvas ${compact ? "rounded-lg px-2.5 py-2 text-xs leading-5" : "rounded-xl p-4 text-sm leading-6"}`}>
          <p className={`mb-1 tracking-wide text-subtle uppercase ${compact ? "text-[10px]" : "text-xs"}`}>
            {isWeighted
              ? `Skor jawabanmu: ${keyById.get(chosen ?? "")?.score ?? 0} dari 5`
              : keyById.get(chosen ?? "")?.is_correct
                ? "Jawaban benar"
                : "Jawaban belum tepat"}
          </p>
          <p className="whitespace-pre-line text-ink">{feedback.explanation ?? "Belum ada pembahasan untuk soal ini."}</p>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => dispatch({ type: "prev" })}
          disabled={state.index === 0}
          aria-label="Soal sebelumnya"
          className={`grid place-items-center rounded-lg border border-line text-muted transition-colors duration-150 hover:text-ink disabled:opacity-40 ${compact ? "size-8" : "size-9"}`}
        >
          <ChevronLeft size={17} />
        </button>
        <div className="flex-1">
          {state.mode === "practice" && !feedback && (
            <button
              type="button"
              disabled={!chosen || pending}
              onClick={() => chosen && void answer(question.id, chosen)}
              className={`btn-solid inline-flex w-full items-center justify-center gap-2 rounded-lg px-3 font-medium transition-[filter] duration-150 hover:brightness-110 disabled:opacity-50 ${compact ? "h-8 text-[13px]" : "h-9 text-sm"}`}
            >
              {pending && <LoaderCircle size={15} className="animate-spin" />} {compact ? "Periksa" : "Periksa jawaban"}
            </button>
          )}
          {state.mode === "exam" && (
            <p className="text-center text-xs text-subtle">
              {pending ? "Menyimpan…" : state.answers[question.id] ? "Jawaban tersimpan" : "Pilih jawaban"}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => dispatch({ type: "next" })}
          disabled={state.index >= state.questions.length - 1}
          aria-label="Soal berikutnya"
          className={`grid place-items-center rounded-lg border border-line text-muted transition-colors duration-150 hover:text-ink disabled:opacity-40 ${compact ? "size-8" : "size-9"}`}
        >
          <ChevronRight size={17} />
        </button>
      </div>
    </div>
  );
}

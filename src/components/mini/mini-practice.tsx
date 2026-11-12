"use client";

import { ArrowLeft, Check, Flag, LoaderCircle, Play, RotateCcw, ScrollText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  getMiniOptions,
  loadMiniSession,
  type MiniSessionData,
  type MiniSubjectOption,
  startMiniSession,
} from "@/app/(app)/sesi/mini-actions";
import { QuestionView } from "@/components/session/question-view";
import { SessionProvider, useSession, useSessionActions } from "@/components/session/session-context";
import { progressOf } from "@/lib/study/session-state";

/** Where the standalone mini practice is; kept in the Mini Mode provider so it survives navigation. */
export type MiniPracticeState =
  | { stage: "intro" }
  | { stage: "picker" }
  | { stage: "session"; sessionId: string }
  | { stage: "result"; sessionId: string };

type Props = { state: MiniPracticeState; setState: (state: MiniPracticeState) => void };

const chip = (on: boolean) =>
  `inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors duration-150 ${
    on ? "border-primary bg-primary-soft text-primary" : "border-line text-muted hover:border-line-strong hover:text-ink"
  }`;

const primaryButton =
  "btn-solid inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-[filter] duration-150 hover:brightness-110 disabled:opacity-50";
const ghostButton =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-line px-3 text-[13px] text-muted transition-colors duration-150 hover:border-line-strong hover:text-ink";

export function MiniPractice({ state, setState }: Props) {
  switch (state.stage) {
    case "intro":
      return <Intro onStart={() => setState({ stage: "picker" })} />;
    case "picker":
      return <Picker onBack={() => setState({ stage: "intro" })} onStarted={(sessionId) => setState({ stage: "session", sessionId })} />;
    case "session":
      return (
        <MiniSession
          key={state.sessionId}
          sessionId={state.sessionId}
          onDone={() => setState({ stage: "result", sessionId: state.sessionId })}
          onMissing={() => setState({ stage: "intro" })}
        />
      );
    case "result":
      return <Result sessionId={state.sessionId} onAgain={() => setState({ stage: "picker" })} />;
  }
}

function Intro({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-2 text-center">
      <p className="font-serif text-2xl leading-7">Soal hari ini</p>
      <p className="max-w-56 text-xs leading-5 text-muted">Pilih bidang, kerjakan langsung di jendela ini.</p>
      <button type="button" onClick={onStart} className={`${primaryButton} mt-1`}>
        <Play size={14} /> Mulai
      </button>
    </div>
  );
}

function Picker({ onBack, onStarted }: { onBack: () => void; onStarted: (sessionId: string) => void }) {
  const [options, setOptions] = useState<MiniSubjectOption[] | null>(null);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [topicIds, setTopicIds] = useState<string[]>([]);
  const [count, setCount] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [starting, startStarting] = useTransition();

  useEffect(() => {
    startLoading(async () => setOptions(await getMiniOptions()));
  }, []);

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
  // One subject at a time keeps the topic list short in the narrow window.
  const pickSubject = (code: string) => {
    setSubjects((current) => (current[0] === code ? [] : [code]));
    setTopicIds([]);
  };
  const topics = (options ?? []).filter((subject) => subjects.includes(subject.code)).flatMap((subject) => subject.topics);
  const available = (options ?? [])
    .filter((subject) => subjects.length === 0 || subjects.includes(subject.code))
    .reduce((sum, subject) => sum + subject.questionCount, 0);

  function start() {
    setError(null);
    startStarting(async () => {
      const result = await startMiniSession({
        subjects: subjects as ("TWK" | "TIU" | "TKP" | "ENG")[],
        topicIds: topicIds.filter((id) => topics.some((topic) => topic.id === id)),
        count,
      });
      if ("error" in result) setError(result.error);
      else onStarted(result.id);
    });
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-0.5">
        <section>
          <p className="mb-1 text-[11px] tracking-wide text-subtle uppercase">Bidang</p>
          {loading && !options ? (
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <LoaderCircle size={13} className="animate-spin" /> Memuat…
            </p>
          ) : (
            <div className="flex flex-wrap gap-1">
              <button type="button" onClick={() => { setSubjects([]); setTopicIds([]); }} className={chip(subjects.length === 0)}>
                Semua
              </button>
              {(options ?? []).map((subject) => (
                <button
                  key={subject.code}
                  type="button"
                  onClick={() => pickSubject(subject.code)}
                  className={chip(subjects.includes(subject.code))}
                >
                  <span className="size-1.5 rounded-full" style={{ backgroundColor: subject.color }} />
                  {subject.short}
                  <span className="text-[10px] text-subtle tabular-nums">{subject.questionCount}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {topics.length > 0 && (
          <section>
            <p className="mb-1 text-[11px] tracking-wide text-subtle uppercase">Topik {topics.length} (opsional)</p>
            <div className="flex flex-wrap gap-1">
              {topics.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => setTopicIds((current) => toggle(current, topic.id))}
                  className={chip(topicIds.includes(topic.id))}
                >
                  {topicIds.includes(topic.id) && <Check size={11} />}
                  {topic.name}
                  <span className="text-[10px] text-subtle tabular-nums">{topic.questionCount}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section>
          <p className="mb-1 text-[11px] tracking-wide text-subtle uppercase">Jumlah soal</p>
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-canvas p-0.5">
            {[5, 10, 20].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setCount(value)}
                aria-pressed={count === value}
                className={`rounded-md py-1 text-xs tabular-nums transition-colors duration-150 ${
                  count === value ? "bg-surface text-ink shadow-[0_1px_2px_var(--shadow)]" : "text-muted hover:text-ink"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
          {options && (
            <p className="mt-1 text-[11px] text-subtle tabular-nums">
              {available} soal tersedia{available < count ? ` · dipakai ${available}` : ""}
            </p>
          )}
        </section>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-1.5">
        <button type="button" onClick={onBack} aria-label="Kembali" className={`${ghostButton} px-2`}>
          <ArrowLeft size={14} />
        </button>
        <button type="button" onClick={start} disabled={starting || !options || available === 0} className={`${primaryButton} flex-1`}>
          {starting ? <LoaderCircle size={14} className="animate-spin" /> : <Play size={14} />} Mulai {count} soal
        </button>
      </div>
    </div>
  );
}

function useMiniSessionData(sessionId: string) {
  const [data, setData] = useState<MiniSessionData | null>(null);
  const [, startLoading] = useTransition();
  useEffect(() => {
    startLoading(async () => setData(await loadMiniSession(sessionId)));
  }, [sessionId]);
  return data;
}

function Loading() {
  return (
    <div className="grid h-full place-items-center text-xs text-muted">
      <span className="flex items-center gap-1.5">
        <LoaderCircle size={14} className="animate-spin" /> Memuat…
      </span>
    </div>
  );
}

function MiniSession({ sessionId, onDone, onMissing }: { sessionId: string; onDone: () => void; onMissing: () => void }) {
  const data = useMiniSessionData(sessionId);

  useEffect(() => {
    if (data?.status === "completed") onDone();
    if (data?.status === "missing") onMissing();
  }, [data, onDone, onMissing]);

  if (!data || data.status !== "in_progress") return <Loading />;
  return (
    <SessionProvider init={data.init} onClosed={onDone}>
      <MiniSessionBody />
    </SessionProvider>
  );
}

function MiniSessionBody() {
  const progress = useSession(useShallow(progressOf));
  const { finish } = useSessionActions();
  const [confirming, setConfirming] = useState(false);
  const [finishing, startFinishing] = useTransition();
  const percent = progress.total ? (progress.answered / progress.total) * 100 : 0;
  const allDone = progress.answered === progress.total;

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-track" aria-hidden>
          <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${percent}%` }} />
        </div>
        <span className="text-[11px] text-muted tabular-nums">
          {progress.answered}/{progress.total}
        </span>
        <button
          type="button"
          onClick={() => (confirming || allDone ? startFinishing(async () => void (await finish())) : setConfirming(true))}
          disabled={finishing}
          className={`inline-flex h-6 items-center gap-1 rounded-md px-2 text-[11px] transition-colors duration-150 ${
            confirming || allDone ? "btn-solid font-medium" : "border border-line text-muted hover:text-ink"
          }`}
        >
          {finishing ? <LoaderCircle size={12} className="animate-spin" /> : <Flag size={12} />}
          {confirming && !allDone ? "Akhiri?" : "Selesai"}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
        <QuestionView compact />
      </div>
    </div>
  );
}

const dotTone: Record<string, string> = {
  correct: "bg-success",
  wrong: "bg-danger",
  scored: "bg-primary",
  empty: "bg-track",
};

function Result({ sessionId, onAgain }: { sessionId: string; onAgain: () => void }) {
  const data = useMiniSessionData(sessionId);
  const router = useRouter();

  if (!data) return <Loading />;
  if (data.status !== "completed") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-xs text-muted">
        Hasil belum tersedia.
        <button type="button" onClick={onAgain} className={ghostButton}>
          <RotateCcw size={14} /> Main lagi
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto">
      <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
        <p className="text-[11px] tracking-wide text-subtle uppercase">Skor</p>
        <p className="font-serif text-4xl leading-none tabular-nums">
          {data.score}
          <span className="text-lg text-subtle"> / {data.maxScore}</span>
        </p>
        <p className="text-xs text-muted tabular-nums">
          Benar {data.correct} · Salah {data.incorrect} · Kosong {data.unanswered}
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-1" aria-label="Hasil per soal">
          {data.verdicts.map((verdict, index) => (
            <span key={index} title={`Soal ${index + 1}`} className={`size-2.5 rounded-full ${dotTone[verdict]}`} />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" onClick={() => router.push(`/sesi/${sessionId}/hasil`)} className={ghostButton}>
          <ScrollText size={14} /> Pembahasan
        </button>
        <button type="button" onClick={onAgain} className={primaryButton}>
          <RotateCcw size={14} /> Main lagi
        </button>
      </div>
    </div>
  );
}

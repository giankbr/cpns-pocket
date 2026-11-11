"use client";

import { LoaderCircle, Play } from "lucide-react";
import { useActionState, useState } from "react";
import { type StartState, startExam, startPractice } from "@/app/(app)/sesi/actions";

type SubjectOption = {
  code: string;
  short: string;
  color: string;
  questionCount: number;
  topics: { id: string; name: string; questionCount: number }[];
};

const field = "h-9 w-full rounded-lg border border-line-strong bg-surface px-2.5 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10";

function SubmitButton({ pending, label }: { pending: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-solid inline-flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-[filter] duration-150 hover:brightness-110 disabled:opacity-60"
    >
      {pending ? <LoaderCircle size={15} className="animate-spin" /> : <Play size={15} />} {label}
    </button>
  );
}

function ErrorText({ state }: { state: StartState }) {
  return state.error ? (
    <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
      {state.error}
    </p>
  ) : null;
}

function SubjectChips({ subjects, selected, onToggle }: { subjects: SubjectOption[]; selected: string[]; onToggle: (code: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {subjects.map((subject) => {
        const on = selected.includes(subject.code);
        return (
          <label
            key={subject.code}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors duration-150 ${
              on ? "border-primary bg-primary-soft text-primary" : "border-line text-muted hover:border-line-strong"
            }`}
          >
            <input type="checkbox" name="subjects" value={subject.code} checked={on} onChange={() => onToggle(subject.code)} className="sr-only" />
            <span className="size-2 rounded-full" style={{ backgroundColor: subject.color }} />
            {subject.short}
            <span className="text-xs text-subtle tabular-nums">{subject.questionCount}</span>
          </label>
        );
      })}
    </div>
  );
}

export function PracticeForm({ subjects, defaultFilter = "all" }: { subjects: SubjectOption[]; defaultFilter?: string }) {
  const [state, action, pending] = useActionState(startPractice, { error: null });
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (code: string) =>
    setSelected((current) => (current.includes(code) ? current.filter((item) => item !== code) : [...current, code]));
  const topics = subjects.filter((subject) => selected.includes(subject.code)).flatMap((subject) => subject.topics);

  return (
    <form action={action} className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm text-muted">Bidang (kosongkan untuk semua)</legend>
        <SubjectChips subjects={subjects} selected={selected} onToggle={toggle} />
      </fieldset>

      {topics.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm text-muted">Topik (opsional)</legend>
          <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
            {topics.map((topic) => (
              <label key={topic.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-canvas">
                <input type="checkbox" name="topicIds" value={topic.id} className="accent-[var(--primary)]" />
                <span className="flex-1 truncate">{topic.name}</span>
                <span className="text-xs text-subtle tabular-nums">{topic.questionCount}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm text-muted">
          Tingkat kesulitan
          <select name="difficulty" defaultValue="" className={`mt-1.5 ${field}`}>
            <option value="">Semua</option>
            <option value="easy">Mudah</option>
            <option value="medium">Sedang</option>
            <option value="hard">Sulit</option>
          </select>
        </label>
        <label className="text-sm text-muted">
          Status soal
          <select name="filter" defaultValue={defaultFilter} className={`mt-1.5 ${field}`}>
            <option value="all">Semua soal</option>
            <option value="unanswered">Belum pernah dijawab</option>
            <option value="incorrect">Pernah salah</option>
            <option value="bookmarked">Bookmark</option>
          </select>
        </label>
        <label className="text-sm text-muted">
          Jumlah soal
          <input name="count" type="number" min={1} max={200} defaultValue={20} className={`mt-1.5 ${field}`} />
        </label>
      </div>

      <ErrorText state={state} />
      <SubmitButton pending={pending} label="Mulai latihan" />
    </form>
  );
}

export function ExamPresetButton({ configId, label }: { configId: string; label: string }) {
  const [state, action, pending] = useActionState(startExam, { error: null });
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="configId" value={configId} />
      <SubmitButton pending={pending} label={label} />
      <ErrorText state={state} />
    </form>
  );
}

export function CustomExamForm({ subjects }: { subjects: SubjectOption[] }) {
  const [state, action, pending] = useActionState(startExam, { error: null });
  const [selected, setSelected] = useState<string[]>(["TWK", "TIU", "TKP"]);
  const toggle = (code: string) =>
    setSelected((current) => (current.includes(code) ? current.filter((item) => item !== code) : [...current, code]));

  return (
    <form action={action} className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm text-muted">Bidang</legend>
        <SubjectChips subjects={subjects} selected={selected} onToggle={toggle} />
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-muted">
          Jumlah soal
          <input name="count" type="number" min={1} max={200} defaultValue={50} className={`mt-1.5 ${field}`} />
        </label>
        <label className="text-sm text-muted">
          Durasi (menit)
          <input name="duration" type="number" min={1} max={300} defaultValue={45} className={`mt-1.5 ${field}`} />
        </label>
      </div>
      <ErrorText state={state} />
      <SubmitButton pending={pending} label="Mulai simulasi" />
    </form>
  );
}

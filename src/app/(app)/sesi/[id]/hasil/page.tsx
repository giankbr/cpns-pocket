import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Check, CircleDashed, Clock3, Lightbulb, ListChecks, RotateCcw, Trophy, X } from "lucide-react";
import { z } from "zod";
import { Card, CardHeader, StatCard } from "@/components/ui/card";
import { requireSession } from "@/lib/auth/guards";
import { sessionLabel, subjectStyle } from "@/lib/study/queries";
import { summarizeSession } from "@/lib/study/scoring";
import { loadSession } from "@/lib/study/session-loader";
import { formatDateTime, formatDuration, percent } from "@/lib/study/stats";
import { getTopicStats, weakestTopics } from "@/lib/study/topic-stats";
import { WeaknessList } from "@/components/study/weakness";

const letters = ["A", "B", "C", "D", "E"];

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const { supabase } = await requireSession();
  const loaded = await loadSession(supabase, id);
  if (!loaded) notFound();
  if (loaded.session.status === "in_progress") redirect(`/sesi/${id}`);

  const { session, questions, answers, feedback, pointsPerCorrect } = loaded;
  const summary = summarizeSession(questions, answers, pointsPerCorrect);
  const feedbackById = new Map(feedback.map((item) => [item.question_id, item]));
  const answerById = new Map(answers.map((answer) => [answer.question_id, answer]));
  const title = session.configuration.name ?? sessionLabel.mode[session.mode];
  const sessionSubjects = new Set(questions.map((q) => q.subject));
  const weak = weakestTopics((await getTopicStats(supabase)).filter((row) => sessionSubjects.has(row.subject)), 1, 5);
  // Thresholds come from the exam preset (editable); absent for practice and custom exams.
  const passing = session.configuration.passing_grades ?? null;
  const passedAll = passing ? summary.bySubject.every((row) => row.score >= (passing[row.subject] ?? 0)) : null;

  return (
    <>
      <Card className="col-span-12 flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-xl leading-6">Hasil · {title}</p>
          <p className="text-xs text-muted">
            {formatDateTime(session.started_at)} · {sessionLabel.status[session.status]}
          </p>
        </div>
        {passedAll !== null && (
          <span
            className={`rounded-lg px-2.5 py-1 text-sm ${passedAll ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}
          >
            {passedAll ? "Lolos ambang batas" : "Belum lolos ambang batas"}
          </span>
        )}
        <Link
          href={session.mode === "exam" ? "/simulasi" : "/latihan"}
          className="btn-solid inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-[filter] duration-150 hover:brightness-110"
        >
          <RotateCcw size={15} /> Sesi baru
        </Link>
      </Card>

      <StatCard
        className="col-span-12 sm:col-span-6 xl:col-span-3"
        icon={Trophy}
        label="Total skor"
        value={String(summary.score)}
        footer={[
          ["Maks", String(summary.maxScore)],
          ["Capaian", `${percent(summary.score, summary.maxScore)}%`],
        ]}
      />
      <StatCard
        className="col-span-12 sm:col-span-6 xl:col-span-3"
        icon={Check}
        label="Benar"
        value={String(summary.correct)}
        footer={[
          ["Salah", String(summary.incorrect)],
          ["Kosong", String(summary.unanswered)],
        ]}
      />
      <StatCard
        className="col-span-12 sm:col-span-6 xl:col-span-3"
        icon={ListChecks}
        label="Soal"
        value={String(summary.total)}
        footer={[
          ["Dijawab", String(summary.total - summary.unanswered)],
          ["Poin/benar", String(pointsPerCorrect)],
        ]}
      />
      <StatCard
        className="col-span-12 sm:col-span-6 xl:col-span-3"
        icon={Clock3}
        label="Durasi"
        value={formatDuration(session.duration_seconds ?? 0)}
        footer={[
          ["Mode", sessionLabel.mode[session.mode]],
          ["Batas", session.configuration.duration_minutes ? `${session.configuration.duration_minutes} m` : "—"],
        ]}
      />

      <Card className="col-span-12">
        <CardHeader icon={ListChecks} title="Skor per bidang" description="TKP dinilai berbobot 1–5, tanpa benar/salah" />
        <div className="overflow-x-auto p-4">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-subtle">
              <tr className="border-b border-line">
                <th className="py-2.5 pr-4 font-normal">Bidang</th>
                <th className="py-2.5 pr-4 font-normal">Benar</th>
                <th className="py-2.5 pr-4 font-normal">Salah</th>
                <th className="py-2.5 pr-4 font-normal">Kosong</th>
                {passing && <th className="py-2.5 pr-4 font-normal">Ambang batas</th>}
                <th className="py-2.5 text-right font-normal">Skor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {summary.bySubject.map((row) => (
                <tr key={row.subject}>
                  <td className="py-2.5 pr-4">
                    <span className="inline-flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ backgroundColor: subjectStyle[row.subject].color }} />
                      {subjectStyle[row.subject].short}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 tabular-nums">{row.subject === "TKP" ? "—" : row.correct}</td>
                  <td className="py-2.5 pr-4 tabular-nums">{row.subject === "TKP" ? "—" : row.incorrect}</td>
                  <td className="py-2.5 pr-4 tabular-nums">{row.unanswered}</td>
                  {passing && (
                    <td className="py-2.5 pr-4 tabular-nums">
                      {passing[row.subject] == null ? (
                        "—"
                      ) : (
                        <span className={row.score >= passing[row.subject]! ? "text-success" : "text-danger"}>
                          {passing[row.subject]} · {row.score >= passing[row.subject]! ? "lolos" : "belum"}
                        </span>
                      )}
                    </td>
                  )}
                  <td className="py-2.5 text-right tabular-nums">
                    {row.score} <span className="text-subtle">/ {row.maxScore}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {weak.length > 0 && (
        <Card className="col-span-12">
          <CardHeader icon={Lightbulb} title="Perlu diperkuat" description="Topik dengan penguasaan terendah dari bidang sesi ini" />
          <div className="p-4">
            <WeaknessList topics={weak} />
          </div>
        </Card>
      )}

      <Card className="col-span-12">
        <CardHeader icon={CircleDashed} title="Pembahasan" description="Kunci jawaban dan penjelasan tiap soal" />
        <ol className="divide-y divide-line p-4">
          {questions.map((question, index) => {
            const item = feedbackById.get(question.id);
            const chosen = answerById.get(question.id)?.option_id ?? null;
            const keys = new Map(item?.options.map((option) => [option.id, option]));
            const verdict = question.type === "objective" && chosen ? keys.get(chosen)?.is_correct : undefined;

            return (
              <li key={question.id} className="py-4">
                <details className="group" open={verdict === false}>
                  <summary className="flex cursor-pointer list-none items-start gap-3">
                    <span
                      className={`grid size-7 shrink-0 place-items-center rounded-md text-xs tabular-nums ${
                        verdict === true
                          ? "bg-success/10 text-success"
                          : verdict === false
                            ? "bg-danger/10 text-danger"
                            : chosen
                              ? "bg-primary-soft text-primary"
                              : "bg-canvas text-subtle"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 text-sm leading-6 text-ink">
                      <span className="line-clamp-2 group-open:line-clamp-none whitespace-pre-line">{question.prompt}</span>
                      <span className="text-xs text-subtle">
                        {subjectStyle[question.subject].short} · {question.topic}
                        {!chosen && " · tidak dijawab"}
                      </span>
                    </span>
                  </summary>
                  <ul className="mt-3 ml-10 space-y-1.5">
                    {question.options.map((option, optionIndex) => {
                      const key = keys.get(option.id);
                      const isChosen = chosen === option.id;
                      return (
                        <li
                          key={option.id}
                          className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                            key?.is_correct
                              ? "border-success/40 bg-success/10"
                              : isChosen && question.type === "objective"
                                ? "border-danger/40 bg-danger/10"
                                : isChosen
                                  ? "border-primary/40 bg-primary-soft"
                                  : "border-line"
                          }`}
                        >
                          <span className="text-muted">{letters[optionIndex]}.</span>
                          <span className="flex-1 whitespace-pre-line">{option.label}</span>
                          {key?.is_correct && <Check size={15} className="mt-0.5 text-success" />}
                          {isChosen && question.type === "objective" && !key?.is_correct && (
                            <X size={15} className="mt-0.5 text-danger" />
                          )}
                          {key?.score != null && <span className="text-xs text-muted tabular-nums">+{key.score}</span>}
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-3 ml-10 rounded-lg bg-canvas p-3 text-sm leading-6 whitespace-pre-line text-ink">
                    {item?.explanation ?? "Belum ada pembahasan untuk soal ini."}
                  </p>
                </details>
              </li>
            );
          })}
        </ol>
      </Card>
    </>
  );
}

import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpenCheck,
  ChartNoAxesColumn,
  CircleCheckBig,
  Clock3,
  Flame,
  History,
  Layers,
  Library,
  PieChart,
  Target,
  TrendingUp,
} from "lucide-react";
import { AreaChart, Donut, Legend, ProgressBars } from "@/components/charts/charts";
import { Card, CardHeader, EmptyState, StatCard } from "@/components/ui/card";
import { requireSession } from "@/lib/auth/guards";
import { getActivity, getCatalog, sessionLabel, subjectStyle } from "@/lib/study/queries";
import {
  DAILY_TARGET,
  dailySeries,
  formatDateTime,
  formatDuration,
  jakartaDate,
  percent,
  studyStreak,
} from "@/lib/study/stats";

export default async function DashboardPage() {
  const { supabase } = await requireSession();
  const [catalog, activity, bookmarks] = await Promise.all([
    getCatalog(supabase),
    getActivity(supabase),
    supabase.from("bookmarks").select("question_id", { count: "exact", head: true }),
  ]);

  const { answers, sessions, answerDates } = activity;
  const today = jakartaDate(new Date());
  const objective = answers.filter((answer) => answer.is_correct !== null);
  const correct = objective.filter((answer) => answer.is_correct).length;
  const series = dailySeries(answerDates, 14, today);
  const thisWeek = series.slice(7).reduce((sum, day) => sum + day.count, 0);
  const lastWeek = series.slice(0, 7).reduce((sum, day) => sum + day.count, 0);
  const todayCount = series.at(-1)?.count ?? 0;
  const totalSeconds = sessions.reduce((sum, session) => sum + (session.duration_seconds ?? 0), 0);

  const answeredBySubject = new Map<string, Set<string>>();
  for (const answer of answers) {
    const code = catalog.subjectByQuestion.get(answer.question_id);
    if (!code) continue;
    if (!answeredBySubject.has(code)) answeredBySubject.set(code, new Set());
    answeredBySubject.get(code)!.add(answer.question_id);
  }

  const subjectRows = catalog.subjects.map((subject) => {
    const questionCount = subject.topics.reduce(
      (sum, topic) => sum + (catalog.questionsPerTopic.get(topic.id) ?? 0),
      0,
    );
    const answered = answeredBySubject.get(subject.code)?.size ?? 0;
    return { ...subject, questionCount, answered, ...subjectStyle[subject.code] };
  });

  const questionTotal = subjectRows.reduce((sum, row) => sum + row.questionCount, 0);
  const topicTotal = subjectRows.reduce((sum, row) => sum + row.topics.length, 0);
  const weekDelta = lastWeek > 0 ? percent(thisWeek - lastWeek, lastWeek) : null;

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={BookOpenCheck}
          label="Soal dijawab"
          value={String(answers.length)}
          footer={[
            ["Benar", String(correct)],
            ["Salah", String(objective.length - correct)],
          ]}
        />
        <StatCard
          icon={Target}
          label="Akurasi"
          value={objective.length ? `${percent(correct, objective.length)}%` : "—"}
          footer={[
            ["Hari ini", String(todayCount)],
            ["7 hari", String(thisWeek)],
          ]}
        />
        <StatCard
          icon={Clock3}
          label="Waktu belajar"
          value={formatDuration(totalSeconds)}
          footer={[
            ["Sesi", String(sessions.length)],
            ["Selesai", String(sessions.filter((session) => session.status === "completed").length)],
          ]}
        />
        <StatCard
          icon={Flame}
          label="Streak belajar"
          value={`${studyStreak(answerDates, today)} hari`}
          footer={[
            ["Target", `${DAILY_TARGET}/hari`],
            ["Tercapai", `${Math.min(percent(todayCount, DAILY_TARGET), 100)}%`],
          ]}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <Card>
          <div className="flex flex-wrap items-start gap-3 p-5 pb-0">
            <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary">
              <ChartNoAxesColumn size={20} strokeWidth={1.8} />
            </span>
            <div className="flex-1">
              <p className="text-sm text-muted">Aktivitas 14 hari terakhir</p>
              <p className="flex flex-wrap items-baseline gap-2">
                <span className="text-2xl font-semibold tracking-tight tabular-nums">{thisWeek} soal</span>
                {weekDelta !== null && (
                  <span className={`text-sm font-medium ${weekDelta >= 0 ? "text-success" : "text-danger"}`}>
                    {weekDelta >= 0 ? "+" : ""}
                    {weekDelta}%
                  </span>
                )}
                <span className="text-sm text-subtle">minggu ini</span>
              </p>
            </div>
          </div>
          <div className="p-5">
            <AreaChart
              data={series.map((day) => ({
                label: new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" }).format(
                  new Date(`${day.date}T00:00:00Z`),
                ),
                value: day.count,
              }))}
            />
          </div>
        </Card>

        <Card>
          <CardHeader icon={TrendingUp} title="Progress per bidang" description="Soal unik dijawab dari bank soal" />
          <div className="p-5">
            <ProgressBars
              data={subjectRows.map((row) => ({
                label: row.short,
                value: percent(row.answered, row.questionCount),
                title: `${row.answered} dari ${row.questionCount} soal`,
                color: row.color,
              }))}
            />
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            icon={History}
            title="Sesi terbaru"
            action={<SeeAll href="/riwayat" />}
          />
          <div className="p-5">
            {sessions.length === 0 ? (
              <EmptyState title="Belum ada sesi">Sesi latihan dan simulasi CAT akan tercatat di sini.</EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {sessions.slice(0, 4).map((session) => (
                  <li key={session.id}>
                    <Link
                      href="/riwayat"
                      className="group flex items-center gap-4 rounded-xl px-2 py-3 transition hover:bg-canvas"
                    >
                      <span className="grid size-10 place-items-center rounded-full bg-primary-soft text-primary">
                        {session.mode === "exam" ? <Clock3 size={18} /> : <BookOpenCheck size={18} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-subtle">{formatDateTime(session.started_at)}</p>
                        <p className="truncate font-medium">{sessionLabel.mode[session.mode]}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-subtle">{sessionLabel.status[session.status]}</p>
                        <p className="font-medium tabular-nums">{session.score ?? "—"}</p>
                      </div>
                      <span className="grid size-9 place-items-center rounded-full text-ink transition group-hover:bg-primary group-hover:text-white">
                        <ArrowRight size={17} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader icon={Library} title="Bidang ujian" action={<SeeAll href="/materi" />} />
          <ul className="divide-y divide-line p-5">
            {subjectRows.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/materi#${row.code}`}
                  className="group flex items-center gap-4 rounded-xl px-2 py-3 transition hover:bg-primary-soft/60"
                >
                  <span
                    className="grid size-10 place-items-center rounded-xl text-xs font-semibold text-white"
                    style={{ backgroundColor: row.color }}
                  >
                    {row.code}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{row.name}</p>
                    <p className="text-sm text-subtle">{row.topics.length} topik</p>
                  </div>
                  <span className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted tabular-nums transition group-hover:border-primary group-hover:bg-primary group-hover:text-white">
                    {row.questionCount} soal
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <Card>
          <CardHeader icon={PieChart} title="Distribusi latihan" description="Jawaban per bidang" />
          <div className="grid items-center gap-6 p-5 md:grid-cols-[1fr_220px]">
            <div className="space-y-5">
              <Donut
                data={subjectRows.map((row) => ({
                  label: row.short,
                  value: answeredBySubject.get(row.code)?.size ?? 0,
                  color: row.color,
                }))}
                center={
                  <div>
                    <p className="text-2xl font-semibold tabular-nums">{answers.length}</p>
                    <p className="text-xs text-subtle">jawaban</p>
                  </div>
                }
              />
              <Legend
                data={subjectRows.map((row) => ({
                  label: row.short,
                  value: answeredBySubject.get(row.code)?.size ?? 0,
                  color: row.color,
                }))}
              />
            </div>
            <div className="space-y-4 rounded-2xl bg-canvas p-4">
              <p className="text-sm text-muted">Ringkasan konten</p>
              <MiniStat icon={Layers} label="Topik" value={String(topicTotal)} />
              <MiniStat icon={BookOpenCheck} label="Soal tersedia" value={String(questionTotal)} />
              <MiniStat icon={Library} label="Materi" value={String(catalog.materials.length)} />
              <MiniStat icon={CircleCheckBig} label="Bookmark" value={String(bookmarks.count ?? 0)} />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader icon={Layers} title="Bank soal" description="Soal terbit per bidang" />
          <div className="space-y-6 p-5">
            <Donut
              data={subjectRows.map((row) => ({ label: row.short, value: row.questionCount, color: row.color }))}
              center={
                questionTotal ? (
                  <div>
                    <p className="text-2xl font-semibold tabular-nums">{questionTotal}</p>
                    <p className="text-xs text-subtle">soal</p>
                  </div>
                ) : (
                  <p className="max-w-28 text-sm text-subtle">Belum ada soal terbit</p>
                )
              }
            />
            <Legend data={subjectRows.map((row) => ({ label: row.short, value: row.questionCount, color: row.color }))} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function SeeAll({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-medium text-ink transition hover:border-primary hover:text-primary"
    >
      Lihat semua <ArrowUpRight size={15} />
    </Link>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: typeof Layers; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-10 place-items-center rounded-xl bg-linear-to-b from-[#4f8dff] to-primary-strong text-white">
        <Icon size={17} />
      </span>
      <div>
        <p className="text-xs text-muted">{label}</p>
        <p className="font-semibold tabular-nums">{value}</p>
      </div>
    </div>
  );
}

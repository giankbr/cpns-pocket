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
  Lightbulb,
  PieChart,
  Target,
  TrendingUp,
} from "lucide-react";
import { AreaChart, Donut, Legend, ProgressBars } from "@/components/charts/charts";
import { Card, CardHeader, EmptyState, StatCard } from "@/components/ui/card";
import { WeaknessList, WrongQuestionsCard } from "@/components/study/weakness";
import { requireSession } from "@/lib/auth/guards";
import { getActivity, getCatalog, sessionLabel, subjectStyle } from "@/lib/study/queries";
import { getTopicStats, totalWrong, weakestTopics } from "@/lib/study/topic-stats";
import {
  dailySeries,
  formatDateTime,
  formatDuration,
  jakartaDate,
  percent,
  studyStreak,
} from "@/lib/study/stats";

export default async function DashboardPage() {
  const { supabase, profile } = await requireSession();
  const [catalog, activity, bookmarks, topicStats] = await Promise.all([
    getCatalog(supabase),
    getActivity(supabase),
    supabase.from("bookmarks").select("question_id", { count: "exact", head: true }),
    getTopicStats(supabase),
  ]);
  const dailyTarget = profile.daily_target;
  const weakTopics = weakestTopics(topicStats);
  const wrongCount = totalWrong(topicStats);

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
    <div className="col-span-12 grid grid-cols-12 gap-4">
      <>
        <StatCard
          className="col-span-12 sm:col-span-6 xl:col-span-3"
          icon={BookOpenCheck}
          label="Soal dijawab"
          value={String(answers.length)}
          footer={[
            ["Benar", String(correct)],
            ["Salah", String(objective.length - correct)],
          ]}
        />
        <StatCard
          className="col-span-12 sm:col-span-6 xl:col-span-3"
          icon={Target}
          label="Akurasi"
          value={objective.length ? `${percent(correct, objective.length)}%` : "—"}
          footer={[
            ["Hari ini", String(todayCount)],
            ["7 hari", String(thisWeek)],
          ]}
        />
        <StatCard
          className="col-span-12 sm:col-span-6 xl:col-span-3"
          icon={Clock3}
          label="Waktu belajar"
          value={formatDuration(totalSeconds)}
          footer={[
            ["Sesi", String(sessions.length)],
            ["Selesai", String(sessions.filter((session) => session.status === "completed").length)],
          ]}
        />
        <StatCard
          className="col-span-12 sm:col-span-6 xl:col-span-3"
          icon={Flame}
          label="Streak belajar"
          value={`${studyStreak(answerDates, today)} hari`}
          footer={[
            ["Target", `${dailyTarget}/hari`],
            ["Tercapai", `${Math.min(percent(todayCount, dailyTarget), 100)}%`],
          ]}
        />
      </>

      <>
        <Card className="col-span-12 xl:col-span-8">
          <div className="flex flex-wrap items-center gap-2.5 px-4 pt-4">
            <span className="grid size-8 place-items-center rounded-lg bg-primary-soft text-primary">
              <ChartNoAxesColumn size={16} strokeWidth={1.9} />
            </span>
            <div className="flex-1">
              <p className="text-xs text-muted">Aktivitas 14 hari terakhir</p>
              <p className="flex flex-wrap items-baseline gap-2">
                <span className="font-serif lining-nums text-[28px] leading-8 tracking-tight tabular-nums">{thisWeek} soal</span>
                {weekDelta !== null && (
                  <span className={`text-sm ${weekDelta >= 0 ? "text-success" : "text-danger"}`}>
                    {weekDelta >= 0 ? "+" : ""}
                    {weekDelta}%
                  </span>
                )}
                <span className="text-sm text-subtle">minggu ini</span>
              </p>
            </div>
          </div>
          <div className="p-4">
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

        <Card className="col-span-12 xl:col-span-4">
          <CardHeader icon={TrendingUp} title="Progress per bidang" description="Soal unik dijawab dari bank soal" />
          <div className="p-4">
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
      </>

      <>
        <Card className="col-span-12 lg:col-span-7">
          <CardHeader icon={Lightbulb} title="Analisis kelemahan" description="Topik dengan penguasaan terendah" action={<SeeAll href="/materi" />} />
          <div className="p-4">
            <WeaknessList topics={weakTopics} />
          </div>
        </Card>
        <Card className="col-span-12 self-start lg:col-span-5">
          <CardHeader icon={CircleCheckBig} title="Perbaiki kesalahan" description="Ulang soal yang pernah salah" />
          <div className="space-y-3 p-4">
            <WrongQuestionsCard wrong={wrongCount} />
            <Link
              href="/latihan?filter=unanswered"
              className="group flex items-center gap-3 rounded-xl border border-line p-3 transition-colors duration-150 hover:border-primary hover:bg-primary-soft/40"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                <BookOpenCheck size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-ink group-hover:text-primary">Soal baru</span>
                <span className="block text-xs text-subtle">Latihan soal yang belum pernah kamu jawab</span>
              </span>
              <ArrowRight size={16} className="text-muted transition-colors group-hover:text-primary" />
            </Link>
          </div>
        </Card>
      </>

      <>
        <Card className="col-span-12 lg:col-span-6">
          <CardHeader
            icon={History}
            title="Sesi terbaru"
            action={<SeeAll href="/riwayat" />}
          />
          <div className="p-4">
            {sessions.length === 0 ? (
              <EmptyState title="Belum ada sesi">Sesi latihan dan simulasi CAT akan tercatat di sini.</EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {sessions.slice(0, 4).map((session) => (
                  <li key={session.id}>
                    <Link
                      href={`/sesi/${session.id}`}
                      className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors duration-150 hover:bg-canvas"
                    >
                      <span className="grid size-9 place-items-center rounded-full bg-primary-soft text-primary">
                        {session.mode === "exam" ? <Clock3 size={18} /> : <BookOpenCheck size={18} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-subtle">{formatDateTime(session.started_at)}</p>
                        <p className="truncate text-sm">{sessionLabel.mode[session.mode]}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-subtle">{sessionLabel.status[session.status]}</p>
                        <p className="tabular-nums">{session.score ?? "—"}</p>
                      </div>
                      <span className="grid size-8 place-items-center rounded-full text-ink transition-colors duration-150 group-hover:bg-primary group-hover:text-white">
                        <ArrowRight size={15} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card className="col-span-12 lg:col-span-6">
          <CardHeader icon={Library} title="Bidang ujian" action={<SeeAll href="/materi" />} />
          <ul className="divide-y divide-line p-4">
            {subjectRows.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/materi#${row.code}`}
                  className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors duration-150 hover:bg-primary-soft/60"
                >
                  <span
                    className="grid size-9 place-items-center rounded-lg text-[11px] text-white"
                    style={{ backgroundColor: row.color }}
                  >
                    {row.code}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{row.name}</p>
                    <p className="text-xs text-subtle">{row.topics.length} topik</p>
                  </div>
                  <span className="rounded-md border border-line px-2.5 py-1 text-xs text-muted tabular-nums transition-colors duration-150 group-hover:border-primary group-hover:bg-primary group-hover:text-white">
                    {row.questionCount} soal
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </>

      <>
        <Card className="col-span-12 xl:col-span-8">
          <CardHeader icon={PieChart} title="Distribusi latihan" description="Jawaban per bidang" />
          <div className="grid items-center gap-6 p-4 md:grid-cols-[1fr_200px]">
            <div className="space-y-4">
              <Donut
                data={subjectRows.map((row) => ({
                  label: row.short,
                  value: answeredBySubject.get(row.code)?.size ?? 0,
                  color: row.color,
                }))}
                center={
                  <div>
                    <p className="font-serif lining-nums text-[28px] leading-8 tracking-tight tabular-nums">{answers.length}</p>
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
            <div className="space-y-3 rounded-xl bg-canvas p-3.5">
              <p className="text-sm text-muted">Ringkasan konten</p>
              <MiniStat icon={Layers} label="Topik" value={String(topicTotal)} />
              <MiniStat icon={BookOpenCheck} label="Soal tersedia" value={String(questionTotal)} />
              <MiniStat icon={Library} label="Materi" value={String(catalog.materials.length)} />
              <MiniStat icon={CircleCheckBig} label="Bookmark" value={String(bookmarks.count ?? 0)} />
            </div>
          </div>
        </Card>

        <Card className="col-span-12 xl:col-span-4">
          <CardHeader icon={Layers} title="Bank soal" description="Soal terbit per bidang" />
          <div className="space-y-4 p-4">
            <Donut
              data={subjectRows.map((row) => ({ label: row.short, value: row.questionCount, color: row.color }))}
              center={
                questionTotal ? (
                  <div>
                    <p className="font-serif lining-nums text-[28px] leading-8 tracking-tight tabular-nums">{questionTotal}</p>
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
      </>
    </div>
  );
}

function SeeAll({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink transition-colors duration-150 hover:border-primary hover:text-primary"
    >
      Lihat semua <ArrowUpRight size={13} />
    </Link>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: typeof Layers; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-8 place-items-center rounded-lg btn-solid">
        <Icon size={15} />
      </span>
      <div>
        <p className="text-xs text-muted">{label}</p>
        <p className="text-sm tabular-nums">{value}</p>
      </div>
    </div>
  );
}

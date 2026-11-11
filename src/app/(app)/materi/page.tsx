import Link from "next/link";
import { BookOpenText, ChevronRight, FileText, Layers, ListChecks } from "lucide-react";
import { PracticeTopicButton } from "@/components/session/start-forms";
import { Card, EmptyState } from "@/components/ui/card";
import { Markdown } from "@/components/ui/markdown";
import { requireSession } from "@/lib/auth/guards";
import { getCatalog, type Material, subjectStyle } from "@/lib/study/queries";
import { percent } from "@/lib/study/stats";

type Search = { bidang?: string; topik?: string; materi?: string };

export default async function MateriPage({ searchParams }: { searchParams: Promise<Search> }) {
  const query = await searchParams;
  const { supabase } = await requireSession();
  const [catalog, questions, answers] = await Promise.all([
    getCatalog(supabase),
    supabase.from("questions").select("id, topic_id").returns<{ id: string; topic_id: string }[]>(),
    supabase.from("session_answers").select("question_id").returns<{ question_id: string }[]>(),
  ]);

  if (catalog.subjects.length === 0) {
    return (
      <div className="col-span-12">
        <EmptyState title="Belum ada bidang">Tambahkan subjek dan topik lewat migrasi database.</EmptyState>
      </div>
    );
  }

  // Unique questions answered per topic.
  const answered = new Set((answers.data ?? []).map((row) => row.question_id));
  const answeredPerTopic = new Map<string, number>();
  for (const question of questions.data ?? []) {
    if (answered.has(question.id)) {
      answeredPerTopic.set(question.topic_id, (answeredPerTopic.get(question.topic_id) ?? 0) + 1);
    }
  }

  const materialsByTopic = new Map<string, Material[]>();
  for (const material of catalog.materials) {
    materialsByTopic.set(material.topic_id, [...(materialsByTopic.get(material.topic_id) ?? []), material]);
  }

  const subject = catalog.subjects.find((item) => item.code === query.bidang) ?? catalog.subjects[0];
  const style = subjectStyle[subject.code];
  const topic = subject.topics.find((item) => item.id === query.topik) ?? subject.topics[0];
  const materials = topic ? (materialsByTopic.get(topic.id) ?? []) : [];
  const material = materials.find((item) => item.id === query.materi) ?? materials[0];

  const stats = (topicId: string) => {
    const total = catalog.questionsPerTopic.get(topicId) ?? 0;
    const done = answeredPerTopic.get(topicId) ?? 0;
    return { total, done, materials: materialsByTopic.get(topicId)?.length ?? 0 };
  };
  const subjectTotals = subject.topics.reduce(
    (sum, item) => {
      const s = stats(item.id);
      return { total: sum.total + s.total, done: sum.done + s.done, materials: sum.materials + s.materials };
    },
    { total: 0, done: 0, materials: 0 },
  );

  const href = (params: Search) => `/materi?${new URLSearchParams(params as Record<string, string>)}`;

  return (
    <>
      {/* Subject switcher */}
      <nav aria-label="Bidang" className="col-span-12 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {catalog.subjects.map((item) => {
          const active = item.code === subject.code;
          return (
            <Link
              key={item.code}
              href={href({ bidang: item.code })}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-colors duration-150 ${
                active ? "border-primary bg-primary-soft" : "border-line bg-surface hover:border-line-strong"
              }`}
            >
              <span
                className="grid size-8 shrink-0 place-items-center rounded-lg text-[11px] text-white"
                style={{ backgroundColor: subjectStyle[item.code].color }}
              >
                {item.code}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm text-ink">{item.name}</span>
                <span className="block text-xs text-subtle">{item.topics.length} topik</span>
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Subject summary + topics */}
      <div className="col-span-12 space-y-4 lg:col-span-4">
        <Card className="p-4">
          <p className="font-serif text-[28px] leading-8">{subject.name}</p>
          {subject.description && <p className="mt-1 text-sm leading-6 text-muted">{subject.description}</p>}
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              { icon: Layers, label: "Topik", value: subject.topics.length },
              { icon: FileText, label: "Materi", value: subjectTotals.materials },
              { icon: ListChecks, label: "Soal", value: subjectTotals.total },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-lg bg-canvas px-2 py-2.5">
                <Icon size={15} className="mx-auto text-subtle" />
                <dd className="mt-1 font-serif text-xl leading-6 tabular-nums">{value}</dd>
                <dt className="text-xs text-muted">{label}</dt>
              </div>
            ))}
          </dl>
          <div className="mt-4">
            <div className="flex justify-between text-xs text-muted">
              <span>Soal dikerjakan</span>
              <span className="tabular-nums">
                {subjectTotals.done}/{subjectTotals.total}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-track">
              <div
                className="h-full rounded-full"
                style={{ width: `${percent(subjectTotals.done, subjectTotals.total)}%`, backgroundColor: style.color }}
              />
            </div>
          </div>
        </Card>

        <Card className="p-2">
          <p className="px-2 pt-2 pb-1 text-xs tracking-wider text-subtle uppercase">Topik</p>
          <ul>
            {subject.topics.map((item, index) => {
              const s = stats(item.id);
              const active = item.id === topic?.id;
              return (
                <li key={item.id}>
                  <Link
                    href={href({ bidang: subject.code, topik: item.id })}
                    aria-current={active ? "true" : undefined}
                    className={`flex items-center gap-3 rounded-lg px-2 py-2 transition-colors duration-150 ${
                      active ? "bg-primary-soft" : "hover:bg-canvas"
                    }`}
                  >
                    <span
                      className={`grid size-7 shrink-0 place-items-center rounded-md text-xs tabular-nums ${
                        active ? "bg-primary text-white" : "bg-canvas text-muted"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm ${active ? "text-primary" : "text-ink"}`}>{item.name}</span>
                      <span className="block text-xs text-subtle tabular-nums">
                        {s.materials} materi · {s.done}/{s.total} soal
                      </span>
                    </span>
                    <ChevronRight size={15} className={active ? "text-primary" : "text-subtle"} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      {/* Reader */}
      <Card className="col-span-12 self-start lg:col-span-8">
        {topic && (
          <>
            <div className="flex flex-wrap items-start gap-3 border-b border-line p-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-subtle">
                  {style.short} · Topik {subject.topics.indexOf(topic) + 1} dari {subject.topics.length}
                </p>
                <h2 className="font-serif text-[28px] leading-8">{topic.name}</h2>
              </div>
              {stats(topic.id).total > 0 && <PracticeTopicButton topicId={topic.id} />}
            </div>

            {materials.length > 1 && (
              <div className="flex gap-1.5 overflow-x-auto border-b border-line px-4 py-2.5">
                {materials.map((item) => (
                  <Link
                    key={item.id}
                    href={href({ bidang: subject.code, topik: topic.id, materi: item.id })}
                    className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs transition-colors duration-150 ${
                      item.id === material?.id
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-line text-muted hover:border-line-strong"
                    }`}
                  >
                    {item.title}
                  </Link>
                ))}
              </div>
            )}

            <div className="p-4 sm:p-6">
              {material ? (
                <article className="mx-auto max-w-[70ch]">
                  <h3 className="mb-4 flex items-center gap-2 text-sm text-muted">
                    <BookOpenText size={15} /> {material.title}
                  </h3>
                  <Markdown text={material.body} />
                </article>
              ) : (
                <EmptyState title="Belum ada materi untuk topik ini">
                  Materi hasil import PDF masuk sebagai draft dan tampil di sini setelah dipublikasikan.
                </EmptyState>
              )}
            </div>
          </>
        )}
      </Card>
    </>
  );
}

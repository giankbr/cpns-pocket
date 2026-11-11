import Link from "next/link";
import { ArrowLeft, ArrowRight, ChevronRight, List } from "lucide-react";
import type { Annotation } from "@/app/(app)/catatan/actions";
import { Annotator } from "@/components/materi/annotator";
import { MarkRead, type MaterialItem, MaterialList } from "@/components/materi/material-list";
import { PracticeTopicButton } from "@/components/session/start-forms";
import { Card, EmptyState } from "@/components/ui/card";
import { Markdown } from "@/components/ui/markdown";
import { requireSession } from "@/lib/auth/guards";
import { getCatalog, type Material, subjectStyle } from "@/lib/study/queries";

type Search = { bidang?: string; topik?: string; materi?: string };

function toItem(material: Material, href: string): MaterialItem {
  const plain = material.body.replace(/[#*_`|>-]+/g, " ").replace(/\s+/g, " ").trim();
  return {
    id: material.id,
    title: material.title,
    excerpt: plain.slice(0, 140),
    minutes: Math.max(1, Math.round(plain.split(" ").length / 200)),
    href,
  };
}

export default async function MateriPage({ searchParams }: { searchParams: Promise<Search> }) {
  const query = await searchParams;
  const { supabase } = await requireSession();
  const catalog = await getCatalog(supabase);

  if (catalog.subjects.length === 0) {
    return (
      <div className="col-span-12">
        <EmptyState title="Belum ada bidang">Tambahkan subjek dan topik lewat migrasi database.</EmptyState>
      </div>
    );
  }

  const materialsByTopic = new Map<string, Material[]>();
  for (const material of catalog.materials) {
    materialsByTopic.set(material.topic_id, [...(materialsByTopic.get(material.topic_id) ?? []), material]);
  }

  const subject = catalog.subjects.find((item) => item.code === query.bidang) ?? catalog.subjects[0];
  const topic =
    subject.topics.find((item) => item.id === query.topik) ??
    subject.topics.find((item) => materialsByTopic.has(item.id)) ??
    subject.topics[0];
  const materials = topic ? (materialsByTopic.get(topic.id) ?? []) : [];
  const activeIndex = materials.findIndex((item) => item.id === query.materi);
  const active = activeIndex >= 0 ? materials[activeIndex] : null;

  const href = (params: Search) => `/materi?${new URLSearchParams(params as Record<string, string>)}`;
  const topicHref = topic ? href({ bidang: subject.code, topik: topic.id }) : href({ bidang: subject.code });
  const items = topic
    ? materials.map((material) => toItem(material, href({ bidang: subject.code, topik: topic.id, materi: material.id })))
    : [];
  const questionCount = topic ? (catalog.questionsPerTopic.get(topic.id) ?? 0) : 0;
  const annotations = active
    ? ((
        await supabase
          .from("annotations")
          .select("id, material_id, kind, color, start_offset, end_offset, quote, note, created_at")
          .eq("material_id", active.id)
          .order("created_at")
          .returns<Annotation[]>()
      ).data ?? [])
    : [];

  return (
    <>
      {/* Subject tabs */}
      <nav aria-label="Bidang" className="col-span-12 flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1">
        {catalog.subjects.map((item) => {
          const current = item.code === subject.code;
          const count = item.topics.reduce((sum, t) => sum + (materialsByTopic.get(t.id)?.length ?? 0), 0);
          return (
            <Link
              key={item.code}
              href={href({ bidang: item.code })}
              aria-current={current ? "page" : undefined}
              className={`flex min-w-fit flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors duration-150 ${
                current ? "bg-primary-soft text-primary" : "text-muted hover:bg-canvas hover:text-ink"
              }`}
            >
              <span className="size-2 rounded-full" style={{ backgroundColor: subjectStyle[item.code].color }} />
              <span className="whitespace-nowrap">{item.name}</span>
              <span className="text-xs text-subtle tabular-nums">{count}</span>
            </Link>
          );
        })}
      </nav>

      {/* Topic pills */}
      <nav aria-label="Topik" className="col-span-12 flex flex-wrap gap-2">
        {subject.topics.map((item) => {
          const current = item.id === topic?.id;
          return (
            <Link
              key={item.id}
              href={href({ bidang: subject.code, topik: item.id })}
              aria-current={current ? "page" : undefined}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors duration-150 ${
                current ? "border-primary bg-primary text-white" : "border-line bg-surface text-ink hover:border-line-strong"
              }`}
            >
              {item.name}
              <span className={`text-xs tabular-nums ${current ? "text-white/80" : "text-subtle"}`}>
                {materialsByTopic.get(item.id)?.length ?? 0}
              </span>
            </Link>
          );
        })}
      </nav>

      {topic && !active && (
        <Card className="col-span-12">
          <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
            <div className="min-w-0 flex-1">
              <h2 className="font-serif text-[28px] leading-8">{topic.name}</h2>
              <p className="text-sm text-muted tabular-nums">
                {materials.length} materi · {questionCount} soal latihan
              </p>
            </div>
            {questionCount > 0 && <PracticeTopicButton topicId={topic.id} />}
          </div>
          <div className="p-4">
            {materials.length === 0 ? (
              <EmptyState title="Belum ada materi untuk topik ini">
                {questionCount > 0 ? "Topik ini sudah punya soal latihan; materinya menyusul." : "Materi akan tampil di sini setelah diterbitkan."}
              </EmptyState>
            ) : (
              <MaterialList items={items} variant="grid" />
            )}
          </div>
        </Card>
      )}

      {topic && active && (
        <>
          <Card className="col-span-12 hidden self-start lg:sticky lg:top-[72px] lg:col-span-4 lg:block xl:col-span-3">
            <MaterialList items={items} activeId={active.id} variant="rail" />
          </Card>

          <Card className="col-span-12 lg:col-span-8 xl:col-span-9">
            <MarkRead id={active.id} />
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 text-sm text-muted">
              <Link href={topicHref} className="inline-flex items-center gap-1.5 hover:text-primary">
                <List size={15} /> {topic.name}
              </Link>
              <ChevronRight size={14} className="text-subtle" />
              <span className="tabular-nums">
                Materi {activeIndex + 1} dari {materials.length}
              </span>
              <span className="flex-1" />
              {questionCount > 0 && <PracticeTopicButton topicId={topic.id} label="Latihan" />}
            </div>

            <article className="p-4 sm:p-6">
              <h1 className="mb-1 font-serif text-[32px] leading-9">{active.title}</h1>
              <p className="mb-5 text-xs text-subtle">Blok teks untuk memberi stabilo, garis bawah, coretan, atau catatan.</p>
              <Annotator key={active.id} materialId={active.id} initial={annotations}>
                <Markdown text={active.body} />
              </Annotator>
            </article>

            <div className="grid gap-2 border-t border-line p-4 sm:grid-cols-2">
              {activeIndex > 0 ? (
                <Link
                  href={items[activeIndex - 1].href}
                  className="flex items-center gap-3 rounded-xl border border-line p-3 transition-colors duration-150 hover:border-primary"
                >
                  <ArrowLeft size={16} className="shrink-0 text-muted" />
                  <span className="min-w-0">
                    <span className="block text-xs text-subtle">Sebelumnya</span>
                    <span className="line-clamp-1 text-sm">{items[activeIndex - 1].title}</span>
                  </span>
                </Link>
              ) : (
                <span />
              )}
              {activeIndex < materials.length - 1 && (
                <Link
                  href={items[activeIndex + 1].href}
                  className="flex items-center justify-end gap-3 rounded-xl border border-line p-3 text-right transition-colors duration-150 hover:border-primary"
                >
                  <span className="min-w-0">
                    <span className="block text-xs text-subtle">Berikutnya</span>
                    <span className="line-clamp-1 text-sm">{items[activeIndex + 1].title}</span>
                  </span>
                  <ArrowRight size={16} className="shrink-0 text-muted" />
                </Link>
              )}
            </div>
          </Card>
        </>
      )}
    </>
  );
}

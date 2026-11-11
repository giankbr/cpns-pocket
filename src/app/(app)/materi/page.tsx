import { BookOpenText, ChevronDown, FileText } from "lucide-react";
import { Card, EmptyState } from "@/components/ui/card";
import { requireSession } from "@/lib/auth/guards";
import { getCatalog, type Material, subjectStyle } from "@/lib/study/queries";

export default async function MateriPage() {
  const { supabase } = await requireSession();
  const catalog = await getCatalog(supabase);

  const materialsByTopic = new Map<string, Material[]>();
  for (const material of catalog.materials) {
    materialsByTopic.set(material.topic_id, [...(materialsByTopic.get(material.topic_id) ?? []), material]);
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <nav aria-label="Bidang" className="flex flex-wrap gap-2">
        {catalog.subjects.map((subject) => (
          <a
            key={subject.code}
            href={`#${subject.code}`}
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2 text-sm font-medium transition hover:border-primary hover:text-primary"
          >
            <span className="size-2 rounded-full" style={{ backgroundColor: subjectStyle[subject.code].color }} />
            {subjectStyle[subject.code].short}
          </a>
        ))}
      </nav>

      {catalog.subjects.map((subject) => (
        <Card key={subject.id} className="scroll-mt-24 overflow-hidden">
          <div id={subject.code} className="flex items-center gap-4 border-b border-line p-5">
            <span
              className="grid size-11 place-items-center rounded-xl text-xs font-semibold text-white"
              style={{ backgroundColor: subjectStyle[subject.code].color }}
            >
              {subject.code}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">{subject.name}</h2>
              {subject.description && <p className="text-sm text-muted">{subject.description}</p>}
            </div>
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {subject.topics.map((topic) => {
              const materials = materialsByTopic.get(topic.id) ?? [];
              const questions = catalog.questionsPerTopic.get(topic.id) ?? 0;

              return (
                <div key={topic.id} className="rounded-xl border border-line p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
                      <BookOpenText size={17} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-medium">{topic.name}</h3>
                      <p className="text-sm text-subtle tabular-nums">
                        {materials.length} materi · {questions} soal
                      </p>
                    </div>
                  </div>

                  {materials.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {materials.map((material) => (
                        <li key={material.id}>
                          <details className="group rounded-lg">
                            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted hover:bg-canvas hover:text-ink">
                              <FileText size={15} />
                              <span className="flex-1 truncate">{material.title}</span>
                              <ChevronDown size={15} className="transition group-open:rotate-180" />
                            </summary>
                            <p className="mt-1 px-2 pb-2 text-sm leading-6 whitespace-pre-line text-ink">
                              {material.body}
                            </p>
                          </details>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      {catalog.subjects.length === 0 && (
        <EmptyState title="Belum ada bidang">Tambahkan subjek dan topik lewat migrasi database.</EmptyState>
      )}
    </div>
  );
}

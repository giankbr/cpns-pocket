import Link from "next/link";
import { ArrowRight, Highlighter, NotebookPen } from "lucide-react";
import { NotesBoard } from "@/components/materi/notes-board";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { requireSession } from "@/lib/auth/guards";
import { type SubjectCode, subjectStyle } from "@/lib/study/queries";
import type { Annotation } from "./actions";

type Row = Annotation & {
  learning_materials: { title: string; topic_id: string; topics: { subjects: { code: SubjectCode } | null } | null } | null;
};

const kindLabel = { highlight: "Stabilo", underline: "Garis bawah", strike: "Coret", note: "Catatan" } as const;
const swatch = { yellow: "#facc15", green: "#4ade80", pink: "#f472b6", blue: "#60a5fa" } as const;

export default async function CatatanPage() {
  const { supabase } = await requireSession();
  const { data, error } = await supabase
    .from("annotations")
    .select(
      "id, material_id, kind, color, start_offset, end_offset, quote, note, created_at, learning_materials(title, topic_id, topics(subjects(code)))",
    )
    .order("created_at", { ascending: false })
    .returns<Row[]>();
  if (error) throw new Error(`Gagal memuat catatan: ${error.message}`);

  const rows = data ?? [];
  const personal = rows.filter((row) => !row.material_id);
  const byMaterial = new Map<string, Row[]>();
  for (const row of rows) {
    if (row.material_id && row.learning_materials) byMaterial.set(row.material_id, [...(byMaterial.get(row.material_id) ?? []), row]);
  }

  return (
    <>
      <Card className="col-span-12 xl:col-span-5">
        <CardHeader icon={NotebookPen} title="Catatan pribadi" description={`${personal.length} catatan`} />
        <div className="p-4">
          <NotesBoard initial={personal} />
        </div>
      </Card>

      <Card className="col-span-12 self-start xl:col-span-7">
        <CardHeader icon={Highlighter} title="Tanda di materi" description="Stabilo, garis bawah, coretan, dan catatan saat membaca" />
        <div className="space-y-3 p-4">
          {byMaterial.size === 0 && (
            <EmptyState title="Belum ada tanda">Buka sebuah materi, blok teksnya, lalu pilih stabilo, garis bawah, coret, atau catatan.</EmptyState>
          )}
          {[...byMaterial.entries()].map(([materialId, items]) => {
            const material = items[0].learning_materials!;
            const code = material.topics?.subjects?.code;
            const href = `/materi?${new URLSearchParams({ ...(code ? { bidang: code } : {}), topik: material.topic_id, materi: materialId })}`;
            return (
              <div key={materialId} className="rounded-xl border border-line">
                <Link href={href} className="group flex items-center gap-2 border-b border-line px-3 py-2.5">
                  {code && <span className="size-2 rounded-full" style={{ backgroundColor: subjectStyle[code].color }} />}
                  <span className="min-w-0 flex-1 truncate text-sm group-hover:text-primary">{material.title}</span>
                  <span className="text-xs text-subtle tabular-nums">{items.length}</span>
                  <ArrowRight size={14} className="text-subtle group-hover:text-primary" />
                </Link>
                <ul className="divide-y divide-line">
                  {items.map((item) => (
                    <li key={item.id} className="flex gap-2.5 px-3 py-2 text-sm">
                      <span
                        className="mt-1.5 size-2.5 shrink-0 rounded-full border border-line-strong"
                        style={item.kind === "highlight" && item.color ? { backgroundColor: swatch[item.color], borderColor: "transparent" } : undefined}
                        title={kindLabel[item.kind]}
                      />
                      <span className="min-w-0">
                        <span className={`line-clamp-2 text-muted ${item.kind === "strike" ? "line-through" : item.kind === "underline" ? "underline" : ""}`}>
                          {item.quote}
                        </span>
                        {item.note && <span className="mt-0.5 block whitespace-pre-line text-ink">{item.note}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}

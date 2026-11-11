import Link from "next/link";
import { Bookmark, Play } from "lucide-react";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { requireSession } from "@/lib/auth/guards";
import { type SubjectCode, subjectStyle } from "@/lib/study/queries";
import { formatDateTime } from "@/lib/study/stats";

type BookmarkRow = {
  question_id: string;
  created_at: string;
  questions: {
    prompt: string;
    difficulty: "easy" | "medium" | "hard";
    topics: { name: string; subjects: { code: SubjectCode } | null } | null;
  } | null;
};

const difficultyLabel = { easy: "Mudah", medium: "Sedang", hard: "Sulit" } as const;

export default async function BookmarkPage() {
  const { supabase } = await requireSession();
  const { data, error } = await supabase
    .from("bookmarks")
    .select("question_id, created_at, questions(prompt, difficulty, topics(name, subjects(code)))")
    .order("created_at", { ascending: false })
    .returns<BookmarkRow[]>();

  if (error) throw new Error(`Gagal memuat bookmark: ${error.message}`);
  const bookmarks = (data ?? []).filter((row) => row.questions);

  return (
    <Card className="col-span-12">
      <CardHeader
        icon={Bookmark}
        title="Soal tersimpan"
        description={`${bookmarks.length} soal`}
        action={
          bookmarks.length > 0 && (
            <Link
              href="/latihan?filter=bookmarked"
              className="btn-solid inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-[filter] duration-150 hover:brightness-110"
            >
              <Play size={13} /> Latihan bookmark
            </Link>
          )
        }
      />
      <div className="p-4">
        {bookmarks.length === 0 ? (
          <EmptyState title="Belum ada bookmark">Simpan soal saat latihan untuk diulang di sini.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {bookmarks.map(({ question_id, created_at, questions }) => {
              const code = questions?.topics?.subjects?.code;
              return (
                <li key={question_id} className="flex gap-4 py-3">
                  {code && (
                    <span
                      className="grid size-9 shrink-0 place-items-center rounded-lg text-[11px] text-white"
                      style={{ backgroundColor: subjectStyle[code].color }}
                    >
                      {code}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-ink">{questions?.prompt}</p>
                    <p className="mt-1 text-sm text-subtle">
                      {questions?.topics?.name} · {difficultyLabel[questions!.difficulty]} · disimpan{" "}
                      {formatDateTime(created_at)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}

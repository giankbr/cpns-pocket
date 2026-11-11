import Link from "next/link";
import { ArrowRight, ListChecks, PlayCircle } from "lucide-react";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { PracticeForm } from "@/components/session/start-forms";
import { requireSession } from "@/lib/auth/guards";
import { getSubjectOptions } from "@/lib/study/subject-options";
import { formatDateTime } from "@/lib/study/stats";

export default async function LatihanPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter } = await searchParams;
  const { supabase } = await requireSession();
  const [subjects, open] = await Promise.all([
    getSubjectOptions(supabase),
    supabase
      .from("study_sessions")
      .select("id, started_at, last_activity_at, configuration, session_questions(count), session_answers(count)")
      .eq("mode", "practice")
      .eq("status", "in_progress")
      .order("last_activity_at", { ascending: false })
      .limit(5)
      .returns<
        {
          id: string;
          started_at: string;
          last_activity_at: string;
          session_questions: { count: number }[];
          session_answers: { count: number }[];
        }[]
      >(),
  ]);

  const total = subjects.reduce((sum, subject) => sum + subject.questionCount, 0);
  const allowedFilters = ["all", "unanswered", "incorrect", "bookmarked"];

  return (
    <>
      <Card className="col-span-12 xl:col-span-8">
        <CardHeader icon={ListChecks} title="Mulai latihan" description={`${total} soal terbit di bank soal`} />
        <div className="p-4">
          {total === 0 ? (
            <EmptyState title="Bank soal masih kosong">
              Soal hasil import PDF masuk sebagai draft. Setelah dipublikasikan, latihan bisa dimulai di sini.
            </EmptyState>
          ) : (
            <PracticeForm subjects={subjects} defaultFilter={allowedFilters.includes(filter ?? "") ? filter : "all"} />
          )}
        </div>
      </Card>

      <Card className="col-span-12 self-start xl:col-span-4">
        <CardHeader icon={PlayCircle} title="Lanjutkan sesi" description="Latihan yang belum diakhiri" />
        <div className="p-4">
          {(open.data ?? []).length === 0 ? (
            <EmptyState title="Tidak ada sesi terbuka" />
          ) : (
            <ul className="divide-y divide-line">
              {(open.data ?? []).map((session) => (
                <li key={session.id}>
                  <Link
                    href={`/sesi/${session.id}`}
                    className="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors duration-150 hover:bg-canvas"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        {session.session_answers[0]?.count ?? 0} / {session.session_questions[0]?.count ?? 0} dijawab
                      </p>
                      <p className="text-xs text-subtle">Terakhir {formatDateTime(session.last_activity_at)}</p>
                    </div>
                    <ArrowRight size={15} className="text-muted transition-colors group-hover:text-primary" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </>
  );
}

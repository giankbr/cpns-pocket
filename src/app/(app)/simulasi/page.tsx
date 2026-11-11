import Link from "next/link";
import { ArrowRight, SlidersHorizontal, Timer } from "lucide-react";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { CustomExamForm, ExamPresetButton } from "@/components/session/start-forms";
import { requireSession } from "@/lib/auth/guards";
import { type SubjectCode, subjectStyle } from "@/lib/study/queries";
import { getSubjectOptions } from "@/lib/study/subject-options";
import { formatDateTime } from "@/lib/study/stats";

type ExamConfig = {
  id: string;
  name: string;
  description: string | null;
  subject_codes: SubjectCode[];
  question_count: number;
  duration_minutes: number;
};

export default async function SimulasiPage() {
  const { supabase } = await requireSession();
  const [subjects, configs, open] = await Promise.all([
    getSubjectOptions(supabase),
    supabase
      .from("exam_configurations")
      .select("id, name, description, subject_codes, question_count, duration_minutes")
      .order("question_count", { ascending: false })
      .returns<ExamConfig[]>(),
    supabase
      .from("study_sessions")
      .select("id, started_at, configuration")
      .eq("mode", "exam")
      .eq("status", "in_progress")
      .order("started_at", { ascending: false })
      .returns<{ id: string; started_at: string; configuration: { name?: string | null } }[]>(),
  ]);

  const available = new Map(subjects.map((subject) => [subject.code, subject.questionCount]));

  return (
    <>
      {(open.data ?? []).length > 0 && (
        <Card className="col-span-12 border-primary/40">
          <ul className="divide-y divide-line px-4 py-2">
            {(open.data ?? []).map((session) => (
              <li key={session.id}>
                <Link href={`/sesi/${session.id}`} className="group flex items-center gap-3 py-2.5">
                  <Timer size={16} className="text-primary" />
                  <span className="flex-1 text-sm">
                    Simulasi berjalan: {session.configuration.name ?? "Kustom"} · mulai {formatDateTime(session.started_at)}
                  </span>
                  <span className="text-sm text-primary">Lanjutkan</span>
                  <ArrowRight size={15} className="text-primary" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="col-span-12 xl:col-span-8">
        <CardHeader icon={Timer} title="Paket simulasi" description="Preset bisa diubah di tabel exam_configurations" />
        <div className="grid gap-3 p-4 md:grid-cols-2">
          {(configs.data ?? []).length === 0 && <EmptyState title="Belum ada preset" />}
          {(configs.data ?? []).map((config) => {
            const pool = config.subject_codes.reduce((sum, code) => sum + (available.get(code) ?? 0), 0);
            return (
              <div key={config.id} className="flex flex-col gap-3 rounded-xl border border-line p-4">
                <div>
                  <p className="font-serif text-xl leading-6">{config.name}</p>
                  {config.description && <p className="mt-1 text-xs text-muted">{config.description}</p>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {config.subject_codes.map((code) => (
                    <span key={code} className="rounded-md px-1.5 py-0.5 text-[11px] text-white" style={{ backgroundColor: subjectStyle[code].color }}>
                      {subjectStyle[code].short}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-muted tabular-nums">
                  {config.question_count} soal · {config.duration_minutes} menit
                  <span className={pool < config.question_count ? " text-danger" : " text-subtle"}> · {pool} tersedia</span>
                </p>
                <div className="mt-auto">
                  <ExamPresetButton configId={config.id} label="Mulai" />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="col-span-12 self-start xl:col-span-4">
        <CardHeader icon={SlidersHorizontal} title="Simulasi kustom" description="Atur bidang, jumlah, dan durasi" />
        <div className="p-4">
          <CustomExamForm subjects={subjects} />
          <p className="mt-4 text-xs leading-5 text-subtle">
            Jika soal tersedia lebih sedikit dari jumlah yang diminta, simulasi memakai semua soal yang ada. Jawaban
            tersimpan otomatis; sesi berakhir otomatis saat waktu habis.
          </p>
        </div>
      </Card>
    </>
  );
}

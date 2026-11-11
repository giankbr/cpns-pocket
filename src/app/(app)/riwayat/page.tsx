import Link from "next/link";
import { History } from "lucide-react";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { requireSession } from "@/lib/auth/guards";
import { getActivity, sessionLabel } from "@/lib/study/queries";
import { formatDateTime, formatDuration } from "@/lib/study/stats";

const statusStyle = {
  completed: "bg-success/10 text-success",
  in_progress: "bg-primary-soft text-primary",
  abandoned: "bg-canvas text-subtle",
} as const;

export default async function RiwayatPage() {
  const { supabase } = await requireSession();
  const { sessions } = await getActivity(supabase);

  return (
    <Card className="col-span-12">
      <CardHeader icon={History} title="Riwayat sesi" description={`${sessions.length} sesi tercatat`} />
      <div className="p-4">
        {sessions.length === 0 ? (
          <EmptyState title="Belum ada sesi">Riwayat latihan dan simulasi CAT akan muncul di sini.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-subtle">
                <tr className="border-b border-line">
                  <th className="py-2.5 pr-4 font-normal">Mulai</th>
                  <th className="py-2.5 pr-4 font-normal">Mode</th>
                  <th className="py-2.5 pr-4 font-normal">Status</th>
                  <th className="py-2.5 pr-4 font-normal">Durasi</th>
                  <th className="py-2.5 text-right font-normal">Skor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {sessions.map((session) => (
                  <tr key={session.id}>
                    <td className="py-2.5 pr-4 text-muted">{formatDateTime(session.started_at)}</td>
                    <td className="py-2.5 pr-4">{sessionLabel.mode[session.mode]}</td>
                    <td className="py-2.5 pr-4">
                      <span className={`rounded-md px-2 py-1 text-xs ${statusStyle[session.status]}`}>
                        {sessionLabel.status[session.status]}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-muted tabular-nums">
                      {session.duration_seconds ? formatDuration(session.duration_seconds) : "—"}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      <Link
                        href={session.status === "in_progress" ? `/sesi/${session.id}` : `/sesi/${session.id}/hasil`}
                        className="text-primary hover:underline"
                      >
                        {session.status === "in_progress" ? "Lanjutkan" : (session.score ?? "Lihat")}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}

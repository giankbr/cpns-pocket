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
    <Card className="mx-auto max-w-[1400px]">
      <CardHeader icon={History} title="Riwayat sesi" description={`${sessions.length} sesi tercatat`} />
      <div className="p-5">
        {sessions.length === 0 ? (
          <EmptyState title="Belum ada sesi">Riwayat latihan dan simulasi CAT akan muncul di sini.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-subtle">
                <tr className="border-b border-line">
                  <th className="py-3 pr-4 font-medium">Mulai</th>
                  <th className="py-3 pr-4 font-medium">Mode</th>
                  <th className="py-3 pr-4 font-medium">Status</th>
                  <th className="py-3 pr-4 font-medium">Durasi</th>
                  <th className="py-3 text-right font-medium">Skor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {sessions.map((session) => (
                  <tr key={session.id}>
                    <td className="py-3.5 pr-4 text-muted">{formatDateTime(session.started_at)}</td>
                    <td className="py-3.5 pr-4 font-medium">{sessionLabel.mode[session.mode]}</td>
                    <td className="py-3.5 pr-4">
                      <span className={`rounded-md px-2 py-1 text-xs font-medium ${statusStyle[session.status]}`}>
                        {sessionLabel.status[session.status]}
                      </span>
                    </td>
                    <td className="py-3.5 pr-4 text-muted tabular-nums">
                      {session.duration_seconds ? formatDuration(session.duration_seconds) : "—"}
                    </td>
                    <td className="py-3.5 text-right font-medium tabular-nums">{session.score ?? "—"}</td>
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

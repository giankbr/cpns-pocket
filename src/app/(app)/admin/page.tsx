import { redirect } from "next/navigation";
import { Clock3, ListChecks, Shield, Target, Users } from "lucide-react";
import { Card, CardHeader, EmptyState, StatCard } from "@/components/ui/card";
import { requireSession } from "@/lib/auth/guards";
import { formatDateTime, formatDuration, percent } from "@/lib/study/stats";

type UserRow = {
  user_id: string;
  name: string | null;
  email: string;
  role: "member" | "admin";
  status: "active" | "disabled";
  joined: string;
  daily_target: number;
  sessions: number;
  completed: number;
  study_seconds: number;
  last_active: string | null;
  answered: number;
  graded: number;
  correct: number;
};

export default async function AdminPage() {
  const { supabase, profile } = await requireSession();
  if (profile.role !== "admin") redirect("/dashboard");

  const { data, error } = await supabase.rpc("admin_user_overview");
  if (error) throw new Error(`Gagal memuat data admin: ${error.message}`);
  const users = (data as UserRow[] | null) ?? [];

  const active = users.filter((user) => user.status === "active").length;
  const totalAnswered = users.reduce((sum, user) => sum + user.answered, 0);
  const totalSeconds = users.reduce((sum, user) => sum + user.study_seconds, 0);

  return (
    <>
      <StatCard
        className="col-span-12 sm:col-span-4"
        icon={Users}
        label="Pengguna"
        value={String(users.length)}
        footer={[
          ["Aktif", String(active)],
          ["Nonaktif", String(users.length - active)],
        ]}
      />
      <StatCard
        className="col-span-12 sm:col-span-4"
        icon={ListChecks}
        label="Total soal dijawab"
        value={String(totalAnswered)}
        footer={[["Semua pengguna", String(users.length)]]}
      />
      <StatCard
        className="col-span-12 sm:col-span-4"
        icon={Clock3}
        label="Total waktu belajar"
        value={formatDuration(totalSeconds)}
        footer={[["Sesi selesai", String(users.reduce((s, u) => s + u.completed, 0))]]}
      />

      <Card className="col-span-12">
        <CardHeader icon={Shield} title="Progress semua pengguna" description="Hanya admin yang bisa melihat halaman ini" />
        <div className="p-4">
          {users.length === 0 ? (
            <EmptyState title="Belum ada pengguna" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="text-subtle">
                  <tr className="border-b border-line">
                    <th className="py-2.5 pr-4 font-normal">Pengguna</th>
                    <th className="py-2.5 pr-4 font-normal">Dijawab</th>
                    <th className="py-2.5 pr-4 font-normal">Akurasi</th>
                    <th className="py-2.5 pr-4 font-normal">Sesi</th>
                    <th className="py-2.5 pr-4 font-normal">Waktu</th>
                    <th className="py-2.5 pr-4 font-normal">Target</th>
                    <th className="py-2.5 font-normal">Aktif terakhir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {users.map((user) => (
                    <tr key={user.user_id}>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2.5">
                          <span className="btn-solid grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold">
                            {(user.name ?? user.email).charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-ink">
                              {user.name ?? "—"}
                              {user.role === "admin" && (
                                <span className="ml-1.5 rounded bg-primary-soft px-1 py-0.5 text-[10px] text-primary">admin</span>
                              )}
                              {user.status === "disabled" && (
                                <span className="ml-1.5 rounded bg-canvas px-1 py-0.5 text-[10px] text-subtle">nonaktif</span>
                              )}
                            </p>
                            <p className="truncate text-xs text-subtle">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 tabular-nums">{user.answered}</td>
                      <td className="py-3 pr-4 tabular-nums">{user.graded ? `${percent(user.correct, user.graded)}%` : "—"}</td>
                      <td className="py-3 pr-4 tabular-nums">
                        {user.completed}/{user.sessions}
                      </td>
                      <td className="py-3 pr-4 tabular-nums">{formatDuration(user.study_seconds)}</td>
                      <td className="py-3 pr-4 tabular-nums">
                        <span className="inline-flex items-center gap-1 text-muted">
                          <Target size={13} /> {user.daily_target}
                        </span>
                      </td>
                      <td className="py-3 text-xs text-muted">{user.last_active ? formatDateTime(user.last_active) : "belum ada"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </>
  );
}

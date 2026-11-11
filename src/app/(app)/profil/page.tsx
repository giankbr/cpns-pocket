import { KeyRound, LogOut, PencilLine, UserRound } from "lucide-react";
import { NameForm, PasswordForm } from "@/components/app/profile-forms";
import { Card, CardHeader } from "@/components/ui/card";
import { displayNameOf, requireSession } from "@/lib/auth/guards";
import { formatDateTime } from "@/lib/study/stats";

export default async function ProfilPage() {
  const { user, profile } = await requireSession();
  const name = displayNameOf(user, profile);

  const rows: [string, string][] = [
    ["Nama tampilan", profile.display_name ?? name],
    ["Email", user.email ?? "—"],
    ["Peran", profile.role === "admin" ? "Admin" : "Member"],
    ["Status", profile.status === "active" ? "Aktif" : "Nonaktif"],
    ["Bergabung", formatDateTime(profile.created_at)],
  ];

  return (
    <div className="col-span-12 grid grid-cols-12 items-start gap-4">
      <Card className="col-span-12 flex items-center gap-4 p-4 lg:col-span-4">
        <span className="grid size-12 place-items-center rounded-full btn-solid text-xl">
          {name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="font-serif lining-nums text-2xl tracking-tight">{name}</p>
          <p className="truncate text-muted">{user.email}</p>
        </div>
      </Card>

      <Card className="col-span-12 row-span-2 self-start lg:col-span-4 lg:col-start-1">
        <CardHeader icon={UserRound} title="Informasi akun" />
        <dl className="divide-y divide-line p-4">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 py-2.5 text-sm">
              <dt className="text-muted">{label}</dt>
              <dd className="truncate text-ink">{value}</dd>
            </div>
          ))}
        </dl>
        <form action="/auth/sign-out" method="post" className="border-t border-line p-4">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-medium text-danger transition-colors duration-150 hover:border-danger hover:bg-danger/5"
          >
            <LogOut size={16} /> Keluar
          </button>
        </form>
      </Card>

      <Card className="col-span-12 lg:col-span-8 lg:col-start-5 lg:row-start-1">
        <CardHeader icon={PencilLine} title="Ubah profil" description="Nama ini tampil di sapaan dan avatar" />
        <div className="p-4">
          <NameForm name={profile.display_name ?? name} />
        </div>
      </Card>

      <Card className="col-span-12 lg:col-span-8 lg:col-start-5">
        <CardHeader icon={KeyRound} title="Ganti password" description="Minimal 8 karakter" />
        <div className="p-4">
          <PasswordForm />
        </div>
      </Card>
    </div>
  );
}

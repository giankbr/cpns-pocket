import { ArrowRight, BookOpen, Clock3, Flame, Target } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { AiChat } from "@/components/ai/ai-chat";

export const dynamic = "force-dynamic";

const metrics = [
  { label: "Soal dijawab", value: "0", icon: BookOpen },
  { label: "Akurasi", value: "—", icon: Target },
  { label: "Waktu belajar", value: "0 m", icon: Clock3 },
  { label: "Streak", value: "0 hari", icon: Flame },
];

export default async function DashboardPage() {
  const user = await requireUser();
  const firstName = user.user_metadata?.full_name?.split(" ")[0] ?? user.email?.split("@")[0] ?? "Pelajar";

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-[#272722]">
      <div className="mx-auto max-w-6xl px-6 py-8 lg:px-10">
        <header className="flex items-center justify-between border-b border-[#e7e5df] pb-6">
          <div>
            <p className="text-sm font-semibold tracking-[0.18em] text-[#6d6c65] uppercase">CPNS Pocket</p>
            <p className="mt-1 text-sm text-[#8a8981]">{user.email}</p>
          </div>
          <form action="/auth/sign-out" method="post">
            <button type="submit" className="text-sm text-[#77766e] transition hover:text-[#272722]">
              Keluar
            </button>
          </form>
        </header>

        <section className="py-12">
          <p className="text-sm font-medium text-[#8a8981]">Selamat datang kembali</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Hai, {firstName}.</h1>
          <p className="mt-3 max-w-xl text-[#77766e]">
            Bangun ritme belajar yang konsisten untuk menghadapi SKD dan SKB dengan lebih tenang.
          </p>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-xl border border-[#e7e5df] bg-white p-5">
              <Icon size={18} strokeWidth={1.7} className="text-[#8a8981]" />
              <p className="mt-5 text-2xl font-semibold">{value}</p>
              <p className="mt-1 text-sm text-[#8a8981]">{label}</p>
            </div>
          ))}
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-xl border border-[#e7e5df] bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Lanjutkan belajar</h2>
                <p className="mt-1 text-sm text-[#8a8981]">Belum ada sesi aktif.</p>
              </div>
              <button className="inline-flex items-center gap-2 rounded-lg bg-[#272722] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#44433b]">
                Mulai latihan <ArrowRight size={16} />
              </button>
            </div>
            <div className="mt-8 rounded-lg border border-dashed border-[#dcdad2] px-5 py-10 text-center">
              <p className="text-sm font-medium text-[#55544d]">Materi sedang disiapkan</p>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#8a8981]">
                Admin belum menambahkan materi belajar. Setelah tersedia, progres dan sesi aktif akan muncul di sini.
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-[#e7e5df] bg-white p-6">
            <h2 className="font-semibold">Progress per bidang</h2>
            <p className="mt-1 text-sm text-[#8a8981]">Belum ada data untuk ditampilkan.</p>
            <div className="mt-8 space-y-5">
              {["TWK", "TIU", "TKP", "B. Inggris"].map((subject) => (
                <div key={subject}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{subject}</span>
                    <span className="text-[#8a8981]">0%</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-[#efeee9]">
                    <div className="h-2 w-0 rounded-full bg-[#77766e]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-6">
          <AiChat />
        </section>
      </div>
    </main>
  );
}

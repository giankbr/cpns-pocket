import {
  Bookmark,
  BookOpenText,
  History,
  LayoutGrid,
  ListChecks,
  NotebookPen,
  type LucideIcon,
  Sparkles,
  Timer,
  UserRound,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Feature not built yet: shown in the menu but not navigable. */
  soon?: boolean;
};

export const navSections: { title: string; items: NavItem[] }[] = [
  {
    title: "Belajar",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
      { href: "/materi", label: "Materi", icon: BookOpenText },
      { href: "/latihan", label: "Latihan Soal", icon: ListChecks },
      { href: "/simulasi", label: "Simulasi CAT", icon: Timer },
    ],
  },
  {
    title: "Personal",
    items: [
      { href: "/bookmark", label: "Bookmark", icon: Bookmark },
      { href: "/catatan", label: "Catatan", icon: NotebookPen },
      { href: "/riwayat", label: "Riwayat", icon: History },
      { href: "/asisten", label: "Asisten AI", icon: Sparkles },
    ],
  },
  {
    title: "Akun",
    items: [{ href: "/profil", label: "Profil", icon: UserRound }],
  },
];

const sessionItem: NavItem = { href: "/sesi", label: "Sesi belajar", icon: ListChecks };

export function findNavItem(pathname: string) {
  if (pathname.startsWith("/sesi/")) return sessionItem;
  return navSections
    .flatMap((section) => section.items)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}

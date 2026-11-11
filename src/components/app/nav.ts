import {
  Bookmark,
  BookOpenText,
  History,
  LayoutGrid,
  ListChecks,
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
      { href: "/latihan", label: "Latihan Soal", icon: ListChecks, soon: true },
      { href: "/simulasi", label: "Simulasi CAT", icon: Timer, soon: true },
    ],
  },
  {
    title: "Personal",
    items: [
      { href: "/bookmark", label: "Bookmark", icon: Bookmark },
      { href: "/riwayat", label: "Riwayat", icon: History },
      { href: "/asisten", label: "Asisten AI", icon: Sparkles },
    ],
  },
  {
    title: "Akun",
    items: [{ href: "/profil", label: "Profil", icon: UserRound }],
  },
];

export function findNavItem(pathname: string) {
  return navSections
    .flatMap((section) => section.items)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}

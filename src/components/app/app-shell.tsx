"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";
import {
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  PictureInPicture2,
  Sparkles,
  X,
} from "lucide-react";
import { MiniModeProvider, useMini } from "@/components/mini/mini-mode";
import { adminSection, findNavItem, navSections } from "./nav";
import { ThemeToggle } from "./theme";

type ShellUser = { name: string; email: string };
type ShellProps = { user: ShellUser; greeting: string; isAdmin: boolean; children: ReactNode };

export function AppShell({ user, greeting, isAdmin, children }: ShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const current = findNavItem(pathname);

  return (
    <MiniModeProvider>
      <div className="flex min-h-screen bg-canvas">
        <aside
          className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 lg:flex ${
            collapsed ? "w-16" : "w-60"
          }`}
        >
          <SidebarContent
            pathname={pathname}
            collapsed={collapsed}
            isAdmin={isAdmin}
            onToggle={() => setCollapsed((value) => !value)}
          />
        </aside>

        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              aria-label="Tutup menu"
              className="absolute inset-0 bg-ink/30"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="relative flex h-full w-60 flex-col bg-surface shadow-xl">
              <SidebarContent
                pathname={pathname}
                collapsed={false}
                isAdmin={isAdmin}
                onClose={() => setMobileOpen(false)}
                onNavigate={() => setMobileOpen(false)}
              />
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2.5 border-b border-line bg-surface/90 px-4 backdrop-blur sm:px-5">
            <button
              aria-label="Buka menu"
              className="grid size-9 place-items-center rounded-lg border border-line text-muted lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={17} />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-serif lining-nums text-xl leading-6 tracking-tight text-ink">
                {current?.label ?? "CPOCKET"}
              </h1>
              <p className="truncate text-xs text-muted">
                {greeting}, {user.name}!
              </p>
            </div>
            <MiniButton />
            <ThemeToggle />
            <Link
              href="/asisten"
              aria-label="Asisten AI"
              className="grid size-9 place-items-center rounded-full border border-line text-muted transition-colors duration-150 hover:border-primary/40 hover:text-primary"
            >
              <Sparkles size={16} />
            </Link>
            <Link
              href="/profil"
              aria-label="Profil"
              className="grid size-9 place-items-center rounded-full btn-solid text-sm"
            >
              {user.name.charAt(0).toUpperCase()}
            </Link>
          </header>

          <main className="flex-1 p-4 sm:p-5">
            <div className="grid grid-cols-12 gap-4">{children}</div>
          </main>
        </div>
      </div>
    </MiniModeProvider>
  );
}

function SidebarContent({
  pathname,
  collapsed,
  isAdmin,
  onToggle,
  onClose,
  onNavigate,
}: {
  pathname: string;
  collapsed: boolean;
  isAdmin: boolean;
  onToggle?: () => void;
  onClose?: () => void;
  onNavigate?: () => void;
}) {
  const sections = isAdmin ? [...navSections, adminSection] : navSections;
  return (
    <>
      <div
        className={`flex h-14 shrink-0 items-center border-b border-line px-3 ${collapsed ? "justify-center" : "justify-between"}`}
      >
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2 pl-1">
            <Logo />
            <span className="font-serif lining-nums text-xl tracking-tight text-ink">
              CPOCKET
            </span>
          </Link>
        )}
        {onToggle && (
          <button
            aria-label={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
            onClick={onToggle}
            className="grid size-7 place-items-center rounded-md border border-line text-subtle transition-colors duration-150 hover:text-ink"
          >
            {collapsed ? (
              <PanelLeftOpen size={15} />
            ) : (
              <PanelLeftClose size={15} />
            )}
          </button>
        )}
        {onClose && (
          <button
            aria-label="Tutup menu"
            onClick={onClose}
            className="grid size-8 place-items-center text-subtle"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-2.5 py-3">
        {sections.map((section) => (
          <div key={section.title}>
            {!collapsed && (
              <p className="mb-1 px-2.5 text-[11px] tracking-wider text-subtle uppercase">
                {section.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map(({ href, label, icon: Icon, soon }) => {
                const active =
                  pathname === href || pathname.startsWith(`${href}/`);
                const base = `flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors duration-150 ${
                  collapsed ? "justify-center" : ""
                }`;

                if (soon) {
                  return (
                    <li key={href}>
                      <span
                        aria-disabled
                        title={`${label} (segera)`}
                        className={`${base} cursor-not-allowed text-subtle`}
                      >
                        <Icon size={17} strokeWidth={1.8} />
                        {!collapsed && (
                          <>
                            <span className="flex-1">{label}</span>
                            <span className="rounded bg-canvas px-1.5 py-px text-[10px]">
                              Segera
                            </span>
                          </>
                        )}
                      </span>
                    </li>
                  );
                }

                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={onNavigate}
                      title={collapsed ? label : undefined}
                      aria-current={active ? "page" : undefined}
                      className={`${base} ${
                        active
                          ? "btn-solid font-medium"
                          : "text-muted hover:bg-canvas hover:text-ink"
                      }`}
                    >
                      <Icon size={17} strokeWidth={active ? 2 : 1.8} />
                      {!collapsed && <span>{label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <form
        action="/auth/sign-out"
        method="post"
        className="border-t border-line p-2.5"
      >
        <button
          type="submit"
          className={`flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm text-muted transition-colors duration-150 hover:bg-canvas hover:text-danger ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <LogOut size={17} strokeWidth={1.8} />
          {!collapsed && "Keluar"}
        </button>
      </form>
    </>
  );
}

export function Logo() {
  return (
    <svg
      width="22"
      height="17"
      viewBox="0 0 28 22"
      aria-hidden
      className="text-primary"
    >
      <rect x="0" y="0" width="28" height="5" rx="2.5" fill="currentColor" />
      <rect
        x="4"
        y="8.5"
        width="20"
        height="5"
        rx="2.5"
        fill="currentColor"
        opacity="0.75"
      />
      <rect x="0" y="17" width="28" height="5" rx="2.5" fill="currentColor" />
    </svg>
  );
}

function MiniButton() {
  const mini = useMini();
  return (
    <button
      type="button"
      onClick={() => (mini.active ? mini.close() : void mini.open())}
      aria-pressed={mini.active}
      aria-label={mini.active ? "Tutup mode mini" : "Buka mode mini"}
      title="Mode mini: soal & Tanya AI di jendela mengambang"
      className={`grid size-9 place-items-center rounded-full border transition-colors duration-150 ${
        mini.active
          ? "border-primary/40 bg-primary-soft text-primary"
          : "border-line text-muted hover:border-primary/40 hover:text-primary"
      }`}
    >
      <PictureInPicture2 size={16} />
    </button>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, Sparkles, X } from "lucide-react";
import { findNavItem, navSections } from "./nav";

type ShellUser = { name: string; email: string };

export function AppShell({ user, greeting, children }: { user: ShellUser; greeting: string; children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const current = findNavItem(pathname);

  return (
    <div className="flex min-h-screen bg-canvas">
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 lg:flex ${
          collapsed ? "w-[76px]" : "w-[264px]"
        }`}
      >
        <SidebarContent
          pathname={pathname}
          collapsed={collapsed}
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
          <aside className="relative flex h-full w-[264px] flex-col bg-surface shadow-xl">
            <SidebarContent
              pathname={pathname}
              collapsed={false}
              onClose={() => setMobileOpen(false)}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-[76px] items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur sm:px-6">
          <button
            aria-label="Buka menu"
            className="grid size-10 place-items-center rounded-xl border border-line text-muted lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-medium text-ink">{current?.label ?? "CPNS Pocket"}</h1>
            <p className="truncate text-sm text-muted">
              {greeting}, {user.name}!
            </p>
          </div>
          <Link
            href="/asisten"
            aria-label="Asisten AI"
            className="grid size-10 place-items-center rounded-full border border-line text-muted transition hover:border-primary/40 hover:text-primary"
          >
            <Sparkles size={18} />
          </Link>
          <Link
            href="/profil"
            aria-label="Profil"
            className="grid size-10 place-items-center rounded-full bg-linear-to-b from-[#4f8dff] to-primary-strong text-sm font-semibold text-white"
          >
            {user.name.charAt(0).toUpperCase()}
          </Link>
        </header>

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

function SidebarContent({
  pathname,
  collapsed,
  onToggle,
  onClose,
  onNavigate,
}: {
  pathname: string;
  collapsed: boolean;
  onToggle?: () => void;
  onClose?: () => void;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className={`flex h-[76px] items-center border-b border-line px-4 ${collapsed ? "justify-center" : "justify-between"}`}>
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <Logo />
            <span className="text-xl font-semibold tracking-tight text-primary">CPNS Pocket</span>
          </Link>
        )}
        {onToggle && (
          <button
            aria-label={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
            onClick={onToggle}
            className="grid size-8 place-items-center rounded-lg border border-line text-subtle transition hover:text-ink"
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        )}
        {onClose && (
          <button aria-label="Tutup menu" onClick={onClose} className="grid size-8 place-items-center text-subtle">
            <X size={18} />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {navSections.map((section) => (
          <div key={section.title}>
            {!collapsed && (
              <p className="mb-2 px-3 text-xs font-medium tracking-wide text-subtle uppercase">{section.title}</p>
            )}
            <ul className="space-y-1">
              {section.items.map(({ href, label, icon: Icon, soon }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                const base = `flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] transition ${
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
                        <Icon size={19} strokeWidth={1.7} />
                        {!collapsed && (
                          <>
                            <span className="flex-1">{label}</span>
                            <span className="rounded-md bg-canvas px-1.5 py-0.5 text-[11px] font-medium">Segera</span>
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
                          ? "bg-linear-to-b from-[#3a80ff] to-primary-strong font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_8px_18px_-8px_rgba(31,107,255,0.8)]"
                          : "text-muted hover:bg-canvas hover:text-ink"
                      }`}
                    >
                      <Icon size={19} strokeWidth={active ? 2 : 1.7} />
                      {!collapsed && <span>{label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <form action="/auth/sign-out" method="post" className="border-t border-line p-3">
        <button
          type="submit"
          className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-[15px] text-muted transition hover:bg-canvas hover:text-danger ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <LogOut size={19} strokeWidth={1.7} />
          {!collapsed && "Keluar"}
        </button>
      </form>
    </>
  );
}

export function Logo() {
  return (
    <svg width="28" height="22" viewBox="0 0 28 22" aria-hidden className="text-primary">
      <rect x="0" y="0" width="28" height="5" rx="2.5" fill="currentColor" />
      <rect x="4" y="8.5" width="20" height="5" rx="2.5" fill="currentColor" opacity="0.75" />
      <rect x="0" y="17" width="28" height="5" rx="2.5" fill="currentColor" />
    </svg>
  );
}

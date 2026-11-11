"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY as STORAGE_KEY } from "@/lib/theme-script";

export type ThemePreference = "system" | "light" | "dark";

function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

function apply(preference: ThemePreference) {
  const dark =
    preference === "dark" ||
    (preference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.dataset.themePref = preference;
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystemChange = () => {
    if (readPreference() === "system") apply("system");
  };
  media.addEventListener("change", onSystemChange);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", onSystemChange);
  };
}

function setPreference(preference: ThemePreference) {
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Storage blocked: theme still applies for this page view.
  }
  apply(preference);
  listeners.forEach((listener) => listener());
}

const order: ThemePreference[] = ["system", "light", "dark"];
const meta = {
  system: { icon: Monitor, label: "Tema: ikuti sistem" },
  light: { icon: Sun, label: "Tema: terang" },
  dark: { icon: Moon, label: "Tema: gelap" },
} as const;

export function ThemeToggle({ className = "" }: { className?: string }) {
  const preference = useSyncExternalStore(subscribe, readPreference, () => "system" as const);
  const { icon: Icon, label } = meta[preference];
  const next = order[(order.indexOf(preference) + 1) % order.length];

  return (
    <button
      type="button"
      onClick={() => setPreference(next)}
      aria-label={`${label}. Klik untuk ganti.`}
      title={label}
      className={`grid size-9 place-items-center rounded-full border border-line text-muted transition-colors duration-150 hover:border-primary/40 hover:text-primary ${className}`}
    >
      <Icon size={16} />
    </button>
  );
}

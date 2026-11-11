"use client";

import Link from "next/link";
import { Check, Search } from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

export type MaterialItem = { id: string; title: string; excerpt: string; minutes: number; href: string };

const STORAGE_KEY = "cpocket-read-materials";
const listeners = new Set<() => void>();
let cache: { raw: string | null; ids: Set<string> } = { raw: null, ids: new Set() };

function readIds(): Set<string> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage blocked: nothing is marked as read.
  }
  if (raw !== cache.raw) {
    let ids: string[] = [];
    try {
      ids = raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      ids = [];
    }
    cache = { raw, ids: new Set(ids) };
  }
  return cache.ids;
}

const emptySet = new Set<string>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Ids of materials opened on this device (kept in localStorage). */
export function useReadMaterials() {
  return useSyncExternalStore(subscribe, readIds, () => emptySet);
}

/** Marks a material as read once its reader page is shown. */
export function MarkRead({ id }: { id: string }) {
  useEffect(() => {
    const ids = new Set(readIds());
    if (ids.has(id)) return;
    ids.add(id);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
    } catch {
      return;
    }
    listeners.forEach((listener) => listener());
  }, [id]);
  return null;
}

/**
 * Searchable list of a topic's materials. `variant="grid"` is the topic index;
 * `variant="rail"` is the compact table of contents beside the reader.
 */
export function MaterialList({
  items,
  activeId,
  variant,
}: {
  items: MaterialItem[];
  activeId?: string;
  variant: "grid" | "rail";
}) {
  const [query, setQuery] = useState("");
  const read = useReadMaterials();
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? items.filter((item) => `${item.title} ${item.excerpt}`.toLowerCase().includes(needle)) : items;
  }, [items, query]);
  const readCount = items.filter((item) => read.has(item.id)).length;

  return (
    <div className={variant === "rail" ? "flex max-h-[calc(100dvh-140px)] flex-col" : ""}>
      <div className={`flex items-center gap-2 ${variant === "rail" ? "p-3 pb-2" : "mb-3"}`}>
        <label className="relative min-w-0 flex-1">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-subtle" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Cari di ${items.length} materi…`}
            aria-label="Cari materi"
            className="h-9 w-full rounded-lg border border-line-strong bg-surface pr-3 pl-8 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
          />
        </label>
        <span className="shrink-0 text-xs text-subtle tabular-nums">
          {readCount}/{items.length} dibaca
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-subtle">Tidak ada materi yang cocok dengan “{query}”.</p>
      ) : variant === "grid" ? (
        <ol className="grid gap-2.5 md:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="group flex h-full gap-3 rounded-xl border border-line p-3 transition-colors duration-150 hover:border-primary hover:bg-primary-soft/40"
              >
                <Marker index={items.indexOf(item) + 1} done={read.has(item.id)} />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-sm text-ink group-hover:text-primary">{item.title}</span>
                  <span className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{item.excerpt}</span>
                  <span className="mt-1.5 block text-[11px] text-subtle">{item.minutes} menit baca</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <ol className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
          {filtered.map((item) => {
            const active = item.id === activeId;
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors duration-150 ${
                    active ? "bg-primary-soft text-primary" : "text-ink hover:bg-canvas"
                  }`}
                >
                  <Marker index={items.indexOf(item) + 1} done={read.has(item.id)} small />
                  <span className="line-clamp-2 min-w-0 flex-1 leading-5">{item.title}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function Marker({ index, done, small = false }: { index: number; done: boolean; small?: boolean }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-md text-[11px] tabular-nums ${small ? "mt-0.5 size-5" : "size-7"} ${
        done ? "bg-success/10 text-success" : "bg-canvas text-muted"
      }`}
    >
      {done ? <Check size={small ? 12 : 14} /> : index}
    </span>
  );
}

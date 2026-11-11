"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/guards";

export type Annotation = {
  id: string;
  material_id: string | null;
  kind: "highlight" | "underline" | "strike" | "note" | "ink";
  color: "yellow" | "green" | "pink" | "blue" | null;
  start_offset: number | null;
  end_offset: number | null;
  quote: string | null;
  note: string | null;
  ink: Ink | null;
  created_at: string;
};

/** Freehand stroke; coordinates are px relative to the content box when it was `w` px wide. */
export type Ink = { w: number; color: string; size: number; points: [number, number][] };

const COLUMNS = "id, material_id, kind, color, start_offset, end_offset, quote, note, ink, created_at";

const createSchema = z
  .object({
    materialId: z.uuid(),
    kind: z.enum(["highlight", "underline", "strike", "note"]),
    color: z.enum(["yellow", "green", "pink", "blue"]).nullable(),
    start: z.number().int().min(0),
    end: z.number().int().min(1),
    quote: z.string().trim().min(1).max(2000),
    note: z.string().trim().max(4000).nullable(),
  })
  .refine((value) => value.end > value.start, "Rentang teks tidak valid.");

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export async function createAnnotation(input: z.input<typeof createSchema>): Promise<Result<Annotation>> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Tandai teks tidak valid." };
  const { supabase } = await requireSession();
  const { materialId, kind, color, start, end, quote, note } = parsed.data;
  const { data, error } = await supabase
    .from("annotations")
    .insert({
      material_id: materialId,
      kind,
      color: kind === "highlight" ? (color ?? "yellow") : null,
      start_offset: start,
      end_offset: end,
      quote,
      note: note || null,
    })
    .select(COLUMNS)
    .single<Annotation>();
  if (error || !data) return { ok: false, error: "Gagal menyimpan. Coba lagi." };
  revalidatePath("/catatan");
  return { ok: true, data };
}

const inkSchema = z.object({
  materialId: z.uuid(),
  ink: z.object({
    w: z.number().positive().max(10000),
    color: z.string().regex(/^#[0-9a-f]{6}$/i),
    size: z.number().min(1).max(24),
    points: z.array(z.tuple([z.number(), z.number()])).min(2).max(4000),
  }),
});

export async function createInk(input: z.input<typeof inkSchema>): Promise<Result<Annotation>> {
  const parsed = inkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Coretan tidak valid." };
  const { supabase } = await requireSession();
  const { data, error } = await supabase
    .from("annotations")
    .insert({ material_id: parsed.data.materialId, kind: "ink", ink: parsed.data.ink })
    .select(COLUMNS)
    .single<Annotation>();
  if (error || !data) return { ok: false, error: "Coretan gagal disimpan." };
  return { ok: true, data };
}

const noteSchema = z.object({ note: z.string().trim().min(1, "Catatan masih kosong.").max(4000) });

/** Free-standing personal note (not tied to a material). */
export async function createNote(input: { note: string }): Promise<Result<Annotation>> {
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Catatan tidak valid." };
  const { supabase } = await requireSession();
  const { data, error } = await supabase
    .from("annotations")
    .insert({ kind: "note", note: parsed.data.note })
    .select(COLUMNS)
    .single<Annotation>();
  if (error || !data) return { ok: false, error: "Gagal menyimpan catatan." };
  revalidatePath("/catatan");
  return { ok: true, data };
}

export async function updateAnnotationNote(id: string, note: string): Promise<Result<null>> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Catatan tidak ditemukan." };
  const text = note.trim().slice(0, 4000);
  const { supabase } = await requireSession();
  // RLS limits this to the user's own rows.
  const { error } = await supabase
    .from("annotations")
    .update({ note: text || null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: "Gagal menyimpan catatan." };
  revalidatePath("/catatan");
  return { ok: true, data: null };
}

export async function deleteAnnotation(id: string): Promise<Result<null>> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Catatan tidak ditemukan." };
  const { supabase } = await requireSession();
  const { error } = await supabase.from("annotations").delete().eq("id", id);
  if (error) return { ok: false, error: "Gagal menghapus." };
  revalidatePath("/catatan");
  return { ok: true, data: null };
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/guards";

export type FormState = { error: string | null; success: string | null };

const nameSchema = z.string().trim().min(1, "Nama tidak boleh kosong.").max(60, "Nama maksimal 60 karakter.");

export async function updateName(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return { error: parsed.error.issues[0].message, success: null };

  const { supabase } = await requireSession();
  const { error } = await supabase.rpc("update_display_name", { p_name: parsed.data });
  if (error) return { error: "Nama gagal disimpan. Coba lagi.", success: null };

  revalidatePath("/", "layout");
  return { error: null, success: "Nama tampilan diperbarui." };
}

const passwordSchema = z
  .object({
    current: z.string().min(1, "Isi password saat ini."),
    next: z.string().min(8, "Password baru minimal 8 karakter.").max(72, "Password baru maksimal 72 karakter."),
    confirm: z.string(),
  })
  .refine((value) => value.next === value.confirm, "Konfirmasi password tidak sama.")
  .refine((value) => value.next !== value.current, "Password baru harus berbeda dari yang lama.");

export async function changePassword(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = passwordSchema.safeParse({
    current: formData.get("current"),
    next: formData.get("next"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message, success: null };

  const { supabase, user } = await requireSession();
  if (!user.email) return { error: "Akun ini tidak memakai email dan password.", success: null };

  // Re-authenticate first so a borrowed, unlocked session cannot change the password.
  const { error: authError } = await supabase.auth.signInWithPassword({ email: user.email, password: parsed.data.current });
  if (authError) return { error: "Password saat ini salah.", success: null };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.next });
  if (error) return { error: "Password gagal diganti. Coba password lain.", success: null };

  return { error: null, success: "Password berhasil diganti." };
}

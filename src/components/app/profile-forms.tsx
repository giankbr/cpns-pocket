"use client";

import { useActionState } from "react";
import { changePassword, type FormState, updateName } from "@/app/(app)/profil/actions";

const initial: FormState = { error: null, success: null };
const field =
  "mt-1.5 h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10";

function Status({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
        {state.error}
      </p>
    );
  }
  return state.success ? <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">{state.success}</p> : null;
}

export function NameForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState(updateName, initial);
  return (
    <form action={action} className="space-y-3">
      <label className="block text-sm text-muted">
        Nama tampilan
        <input name="name" defaultValue={name} maxLength={60} required autoComplete="nickname" className={field} />
      </label>
      <Status state={state} />
      <button type="submit" disabled={pending} className="btn-solid h-9 rounded-lg px-4 text-sm font-medium disabled:opacity-60">
        {pending ? "Menyimpan…" : "Simpan nama"}
      </button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, initial);
  return (
    <form action={action} className="space-y-3">
      <label className="block text-sm text-muted">
        Password saat ini
        <input name="current" type="password" required autoComplete="current-password" className={field} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm text-muted">
          Password baru
          <input name="next" type="password" required minLength={8} maxLength={72} autoComplete="new-password" className={field} />
        </label>
        <label className="block text-sm text-muted">
          Ulangi password baru
          <input name="confirm" type="password" required minLength={8} maxLength={72} autoComplete="new-password" className={field} />
        </label>
      </div>
      <Status state={state} />
      <button type="submit" disabled={pending} className="btn-solid h-9 rounded-lg px-4 text-sm font-medium disabled:opacity-60">
        {pending ? "Mengganti…" : "Ganti password"}
      </button>
    </form>
  );
}

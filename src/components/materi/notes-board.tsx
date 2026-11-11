"use client";

import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { type Annotation, createNote, deleteAnnotation, updateAnnotationNote } from "@/app/(app)/catatan/actions";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(
    new Date(value),
  );
}

/** Free-standing personal notes: add, edit in place, delete. */
export function NotesBoard({ initial }: { initial: Annotation[] }) {
  const [notes, setNotes] = useState(initial);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add() {
    const note = text.trim();
    if (!note) return;
    setError(null);
    startTransition(async () => {
      const result = await createNote({ note });
      if (result.ok) {
        setNotes((current) => [result.data, ...current]);
        setText("");
      } else setError(result.error);
    });
  }

  function save() {
    if (!editing || !editing.text.trim()) return;
    const { id, text: note } = editing;
    setEditing(null);
    startTransition(async () => {
      const result = await updateAnnotationNote(id, note);
      if (result.ok) setNotes((current) => current.map((item) => (item.id === id ? { ...item, note: note.trim() } : item)));
      else setError(result.error);
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteAnnotation(id);
      if (result.ok) setNotes((current) => current.filter((item) => item.id !== id));
      else setError(result.error);
    });
  }

  const field =
    "w-full resize-y rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10";

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={3}
          maxLength={4000}
          placeholder="Tulis catatan baru: rumus, hal yang sering salah, target belajar…"
          aria-label="Catatan baru"
          className={field}
        />
        <button
          type="button"
          onClick={add}
          disabled={pending || !text.trim()}
          className="btn-solid inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium disabled:opacity-50"
        >
          <Plus size={15} /> Simpan catatan
        </button>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>

      {notes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-sm text-subtle">Belum ada catatan pribadi.</p>
      ) : (
        <ul className="grid gap-2.5 md:grid-cols-2">
          {notes.map((note) => (
            <li key={note.id} className="rounded-xl border border-line p-3">
              {editing?.id === note.id ? (
                <div className="space-y-2">
                  <textarea
                    autoFocus
                    value={editing.text}
                    onChange={(event) => setEditing({ id: note.id, text: event.target.value })}
                    rows={4}
                    maxLength={4000}
                    className={field}
                  />
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-line px-2.5 py-1 text-xs">
                      Batal
                    </button>
                    <button type="button" onClick={save} className="btn-solid inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium">
                      <Check size={13} /> Simpan
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm leading-6 whitespace-pre-line text-ink">{note.note}</p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-subtle">
                    <span className="flex-1">{formatDate(note.created_at)}</span>
                    <button type="button" onClick={() => setEditing({ id: note.id, text: note.note ?? "" })} className="inline-flex items-center gap-1 hover:text-ink">
                      <Pencil size={13} /> Ubah
                    </button>
                    <button type="button" onClick={() => remove(note.id)} className="inline-flex items-center gap-1 hover:text-danger">
                      <Trash2 size={13} /> Hapus
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

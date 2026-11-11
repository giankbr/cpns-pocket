import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { SessionPlayer } from "@/components/session/session-player";
import { requireSession } from "@/lib/auth/guards";
import { sessionLabel } from "@/lib/study/queries";
import { loadSession } from "@/lib/study/session-loader";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const { supabase } = await requireSession();
  const loaded = await loadSession(supabase, id);
  if (!loaded) notFound();

  const { session, questions, answers, feedback, bookmarks, deadline, expired } = loaded;

  // An exam left open past its deadline is closed on the next visit.
  if (expired) {
    await supabase.rpc("finish_study_session", { p_session_id: id });
    redirect(`/sesi/${id}/hasil`);
  }
  if (session.status !== "in_progress") redirect(`/sesi/${id}/hasil`);

  return (
    <SessionPlayer
      title={session.configuration.name ?? sessionLabel.mode[session.mode]}
      init={{
        sessionId: session.id,
        mode: session.mode,
        status: session.status,
        questions,
        deadline,
        answers: Object.fromEntries(answers.map((answer) => [answer.question_id, answer.option_id])),
        feedback,
        bookmarks,
      }}
    />
  );
}

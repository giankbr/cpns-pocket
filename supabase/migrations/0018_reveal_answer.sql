-- Per-question reveal during a practice run. Returns the answer key + explanation
-- for a single question the user has already answered in one of their PRACTICE
-- sessions, whatever the review mode. Lets the mini daily challenge / practice show
-- a "lihat jawaban & pembahasan" button right after each answer without ever leaking
-- keys during an exam in progress (exams are excluded by s.mode = 'practice').
create or replace function public.reveal_answer(p_session_id uuid, p_question_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_option uuid;
begin
  select a.option_id into v_option
  from session_answers a
  join study_sessions s on s.id = a.session_id
  where a.session_id = p_session_id
    and a.question_id = p_question_id
    and s.user_id = auth.uid()
    and s.mode = 'practice';

  if not found then
    raise exception 'not answered in a practice session' using errcode = '42501';
  end if;

  return question_feedback(p_question_id, v_option);
end;
$$;

revoke all on function public.reveal_answer(uuid, uuid) from public, anon;
grant execute on function public.reveal_answer(uuid, uuid) to authenticated;

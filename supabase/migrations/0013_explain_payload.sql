-- Authoritative question + answer key for the "Bahas dengan AI" button. Only returned for
-- questions the user has already answered in one of their sessions, so it never leaks keys
-- during an exam in progress.
create or replace function public.explain_payload(p_question_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not exists (
    select 1 from session_answers a
    join study_sessions s on s.id = a.session_id
    where s.user_id = auth.uid() and a.question_id = p_question_id
  ) then
    raise exception 'not answered yet' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'prompt', q.prompt,
    'type', q.type,
    'subject', s.code,
    'topic', t.name,
    'options', (
      select jsonb_agg(jsonb_build_object('label', o.label, 'is_correct', k.is_correct, 'score', k.score) order by o.sort_order)
      from question_options o left join question_answer_keys k on k.option_id = o.id
      where o.question_id = q.id
    )
  )
  into result
  from questions q join topics t on t.id = q.topic_id join subjects s on s.id = t.subject_id
  where q.id = p_question_id;

  if result is null then
    raise exception 'question not found' using errcode = 'P0002';
  end if;
  return result;
end;
$$;

revoke all on function public.explain_payload(uuid) from public, anon;
grant execute on function public.explain_payload(uuid) to authenticated;

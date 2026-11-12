-- Per-user daily target and a weakness-analysis helper.

alter table public.profiles add column daily_target smallint not null default 20 check (daily_target between 1 and 500);

create or replace function public.set_daily_target(p_target integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or p_target < 1 or p_target > 500 then
    raise exception 'invalid target' using errcode = '22023';
  end if;
  update profiles set daily_target = p_target, updated_at = now() where id = auth.uid();
end; $$;

-- Per-topic performance for the signed-in user, based on the latest attempt per question.
create or replace function public.my_topic_stats()
returns jsonb language sql stable security definer set search_path = public as $$
  with latest as (
    select distinct on (a.question_id)
      a.question_id, a.is_correct, a.awarded_score, q.type, t.id as topic_id, t.name as topic,
      s.code as subject, s.sort_order as subject_order
    from session_answers a
    join study_sessions ss on ss.id = a.session_id and ss.user_id = auth.uid()
    join questions q on q.id = a.question_id
    join topics t on t.id = q.topic_id
    join subjects s on s.id = t.subject_id
    order by a.question_id, a.answered_at desc
  )
  select coalesce(jsonb_agg(row order by row->>'subject_order', (row->>'answered')::int desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'subject', subject, 'subject_order', subject_order, 'topic', topic, 'topic_id', topic_id,
      'answered', count(*),
      'graded', count(*) filter (where is_correct is not null),
      'correct', count(*) filter (where is_correct),
      'wrong', count(*) filter (where is_correct = false),
      'tkp_count', count(*) filter (where type = 'weighted' and awarded_score is not null),
      'tkp_score', coalesce(sum(awarded_score) filter (where type = 'weighted'), 0)
    ) as row
    from latest group by subject, subject_order, topic, topic_id
  ) rows;
$$;

revoke all on function public.set_daily_target(integer) from public, anon;
revoke all on function public.my_topic_stats() from public, anon;
grant execute on function public.set_daily_target(integer) to authenticated;
grant execute on function public.my_topic_stats() to authenticated;

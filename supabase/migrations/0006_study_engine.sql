-- Practice & CAT engine. Sessions are built and scored by SECURITY DEFINER functions so
-- answer keys (question_answer_keys, no client policies) never reach the browser
-- before an answer is evaluated. Exam answers stay unscored until the session ends.

alter table public.exam_configurations
  add column if not exists description text,
  add column if not exists points_per_correct smallint not null default 5 check (points_per_correct > 0);

-- Editable presets. Not official regulations: adjust to the latest announcement.
insert into public.exam_configurations (name, description, subject_codes, question_count, duration_minutes, enabled)
select v.name, v.description, v.subject_codes, v.question_count, v.duration_minutes, true
from (values
  ('Simulasi SKD', 'Campuran TWK, TIU, TKP. Sesuaikan jumlah & durasi dengan aturan terbaru.', array['TWK','TIU','TKP'], 110, 100),
  ('Mini TWK', 'Latihan berwaktu khusus TWK.', array['TWK'], 30, 30),
  ('Mini TIU', 'Latihan berwaktu khusus TIU.', array['TIU'], 35, 35),
  ('Mini TKP', 'Latihan berwaktu khusus TKP.', array['TKP'], 45, 40),
  ('Bahasa Inggris', 'Latihan berwaktu format SKB Bahasa Inggris.', array['ENG'], 40, 40)
) as v(name, description, subject_codes, question_count, duration_minutes)
where not exists (select 1 from public.exam_configurations e where e.name = v.name);

create index if not exists session_questions_session_position_idx on public.session_questions(session_id, position);
create index if not exists study_sessions_user_started_idx on public.study_sessions(user_id, started_at desc);

-- Deadline for timed sessions (null for untimed practice).
create or replace function public.session_deadline(s public.study_sessions)
returns timestamptz
language sql
stable
as $$
  select case
    when s.mode = 'exam' and (s.configuration ->> 'duration_minutes') is not null
      then s.started_at + make_interval(mins => (s.configuration ->> 'duration_minutes')::int)
  end;
$$;

-- Key + explanation for one question, relative to the chosen option.
create or replace function public.question_feedback(p_question_id uuid, p_option_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'question_id', q.id,
    'selected_option_id', p_option_id,
    'explanation', q.explanation,
    'options', coalesce((
      select jsonb_agg(jsonb_build_object('id', o.id, 'is_correct', k.is_correct, 'score', k.score) order by o.sort_order)
      from public.question_options o
      left join public.question_answer_keys k on k.option_id = o.id
      where o.question_id = q.id
    ), '[]'::jsonb)
  )
  from public.questions q
  where q.id = p_question_id;
$$;

create or replace function public.start_study_session(
  p_mode public.session_mode,
  p_subject_codes text[] default null,
  p_topic_ids uuid[] default null,
  p_difficulty public.difficulty_level default null,
  p_filter text default 'all',
  p_count integer default 20,
  p_duration_minutes integer default null,
  p_exam_configuration_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_session uuid;
  v_inserted integer;
  v_points integer := 5;
  v_name text;
begin
  if v_user is null or not exists (select 1 from profiles where id = v_user and status = 'active') then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if p_exam_configuration_id is not null then
    select subject_codes, question_count, duration_minutes, points_per_correct, name
      into p_subject_codes, p_count, p_duration_minutes, v_points, v_name
    from exam_configurations
    where id = p_exam_configuration_id and enabled;
    if not found then
      raise exception 'exam configuration not found' using errcode = 'P0002';
    end if;
  end if;

  if p_count is null or p_count < 1 or p_count > 200 then
    raise exception 'invalid question count' using errcode = '22023';
  end if;
  if p_mode = 'exam' and (p_duration_minutes is null or p_duration_minutes < 1 or p_duration_minutes > 300) then
    raise exception 'invalid duration' using errcode = '22023';
  end if;
  if p_filter not in ('all', 'unanswered', 'bookmarked', 'incorrect') then
    raise exception 'invalid filter' using errcode = '22023';
  end if;

  insert into study_sessions (user_id, mode, configuration)
  values (
    v_user,
    p_mode,
    jsonb_build_object(
      'name', v_name,
      'subject_codes', p_subject_codes,
      'topic_ids', p_topic_ids,
      'difficulty', p_difficulty,
      'filter', p_filter,
      'question_count', p_count,
      'duration_minutes', case when p_mode = 'exam' then p_duration_minutes end,
      'points_per_correct', v_points
    )
  )
  returning id into v_session;

  insert into session_questions (session_id, question_id, position)
  select v_session, picked.id, (row_number() over (order by random()) - 1)::smallint
  from (
    select q.id
    from questions q
    join topics t on t.id = q.topic_id
    join subjects s on s.id = t.subject_id
    where q.status = 'published'
      and (coalesce(cardinality(p_subject_codes), 0) = 0 or s.code = any (p_subject_codes))
      and (coalesce(cardinality(p_topic_ids), 0) = 0 or q.topic_id = any (p_topic_ids))
      and (p_difficulty is null or q.difficulty = p_difficulty)
      and (p_filter <> 'bookmarked' or exists (
        select 1 from bookmarks b where b.user_id = v_user and b.question_id = q.id))
      and (p_filter <> 'unanswered' or not exists (
        select 1 from session_answers a join study_sessions ss on ss.id = a.session_id
        where ss.user_id = v_user and a.question_id = q.id))
      and (p_filter <> 'incorrect' or exists (
        select 1 from session_answers a join study_sessions ss on ss.id = a.session_id
        where ss.user_id = v_user and a.question_id = q.id and a.is_correct = false))
    order by random()
    limit p_count
  ) picked;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    raise exception 'no questions match the selected filters' using errcode = 'P0002';
  end if;

  return v_session;
end;
$$;

create or replace function public.finish_study_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s study_sessions;
  v_points integer;
  v_deadline timestamptz;
  v_seconds integer;
begin
  select * into s from study_sessions where id = p_session_id and user_id = auth.uid() for update;
  if not found then
    raise exception 'session not found' using errcode = 'P0002';
  end if;
  if s.status <> 'in_progress' then
    return;
  end if;

  v_points := coalesce((s.configuration ->> 'points_per_correct')::int, 5);
  v_deadline := session_deadline(s);

  -- Exam answers are stored unscored while the timer runs; score them now.
  update session_answers a
  set is_correct = case when q.type = 'objective' then coalesce(k.is_correct, false) end,
      awarded_score = case when q.type = 'weighted' then coalesce(k.score, 0) end
  from questions q, question_options o
  left join question_answer_keys k on k.option_id = o.id
  where a.session_id = s.id and q.id = a.question_id and o.id = a.option_id;

  if v_deadline is not null then
    v_seconds := extract(epoch from least(now(), v_deadline) - s.started_at)::int;
  else
    -- Practice can be resumed days later: count active time as gaps between
    -- answers, each capped at 5 minutes.
    select coalesce(sum(least(extract(epoch from gap)::int, 300)), 0)
      into v_seconds
    from (
      select answered_at - coalesce(lag(answered_at) over (order by answered_at), s.started_at) as gap
      from session_answers where session_id = s.id
    ) gaps;
  end if;

  update study_sessions
  set status = 'completed',
      completed_at = now(),
      last_activity_at = now(),
      duration_seconds = greatest(v_seconds, 0),
      score = (
        select coalesce(sum(case when a.is_correct then v_points else coalesce(a.awarded_score, 0) end), 0)
        from session_answers a where a.session_id = s.id
      )
  where id = s.id;
end;
$$;

create or replace function public.submit_answer(p_session_id uuid, p_question_id uuid, p_option_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s study_sessions;
  v_type question_type;
  v_correct boolean;
  v_score smallint;
  v_deadline timestamptz;
begin
  select * into s from study_sessions where id = p_session_id and user_id = auth.uid() for update;
  if not found then
    raise exception 'session not found' using errcode = 'P0002';
  end if;
  if s.status <> 'in_progress' then
    return jsonb_build_object('status', 'closed');
  end if;

  v_deadline := session_deadline(s);
  if v_deadline is not null and now() > v_deadline + interval '5 seconds' then
    perform finish_study_session(p_session_id);
    return jsonb_build_object('status', 'expired');
  end if;

  if not exists (select 1 from session_questions where session_id = s.id and question_id = p_question_id) then
    raise exception 'question not in session' using errcode = '22023';
  end if;

  select q.type into v_type
  from questions q join question_options o on o.question_id = q.id
  where q.id = p_question_id and o.id = p_option_id;
  if not found then
    raise exception 'invalid option' using errcode = '22023';
  end if;

  if s.mode = 'practice' then
    if exists (select 1 from session_answers where session_id = s.id and question_id = p_question_id) then
      return jsonb_build_object('status', 'evaluated') || question_feedback(p_question_id,
        (select option_id from session_answers where session_id = s.id and question_id = p_question_id));
    end if;
    select k.is_correct, k.score into v_correct, v_score from question_answer_keys k where k.option_id = p_option_id;
  end if;

  insert into session_answers (session_id, question_id, option_id, is_correct, awarded_score, answered_at)
  values (
    s.id, p_question_id, p_option_id,
    case when s.mode = 'practice' and v_type = 'objective' then coalesce(v_correct, false) end,
    case when s.mode = 'practice' and v_type = 'weighted' then coalesce(v_score, 0) end,
    now()
  )
  on conflict (session_id, question_id) do update
  set option_id = excluded.option_id, answered_at = excluded.answered_at;

  update study_sessions set last_activity_at = now() where id = s.id;

  if s.mode = 'exam' then
    return jsonb_build_object('status', 'saved');
  end if;
  return jsonb_build_object('status', 'evaluated') || question_feedback(p_question_id, p_option_id);
end;
$$;

-- Feedback for every answered question: practice anytime, exams only after completion.
create or replace function public.get_session_feedback(p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s study_sessions;
begin
  select * into s from study_sessions where id = p_session_id and user_id = auth.uid();
  if not found then
    raise exception 'session not found' using errcode = 'P0002';
  end if;
  if s.mode = 'exam' and s.status = 'in_progress' then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(
      question_feedback(sq.question_id, a.option_id)
      || jsonb_build_object('is_correct', a.is_correct, 'awarded_score', a.awarded_score)
      order by sq.position)
    from session_questions sq
    left join session_answers a on a.session_id = sq.session_id and a.question_id = sq.question_id
    where sq.session_id = s.id
      and (s.mode = 'exam' or a.option_id is not null)
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.session_deadline(public.study_sessions) from public, anon;
revoke all on function public.question_feedback(uuid, uuid) from public, anon, authenticated;
revoke all on function public.start_study_session(public.session_mode, text[], uuid[], public.difficulty_level, text, integer, integer, uuid) from public, anon;
revoke all on function public.finish_study_session(uuid) from public, anon;
revoke all on function public.submit_answer(uuid, uuid, uuid) from public, anon;
revoke all on function public.get_session_feedback(uuid) from public, anon;
grant execute on function public.session_deadline(public.study_sessions) to authenticated;
grant execute on function public.start_study_session(public.session_mode, text[], uuid[], public.difficulty_level, text, integer, integer, uuid) to authenticated;
grant execute on function public.finish_study_session(uuid) to authenticated;
grant execute on function public.submit_answer(uuid, uuid, uuid) to authenticated;
grant execute on function public.get_session_feedback(uuid) to authenticated;

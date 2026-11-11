-- Practice "review" mode: 'instant' (reveal key after each answer, default/legacy) or
-- 'end' (behave like an exam: save answers unscored, reveal all feedback only after finishing).
drop function if exists public.start_study_session(public.session_mode, text[], uuid[], public.difficulty_level, text, integer, integer, uuid);

create or replace function public.start_study_session(
  p_mode public.session_mode,
  p_subject_codes text[] default null,
  p_topic_ids uuid[] default null,
  p_difficulty public.difficulty_level default null,
  p_filter text default 'all',
  p_count integer default 20,
  p_duration_minutes integer default null,
  p_exam_configuration_id uuid default null,
  p_review text default 'instant'
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
  v_quotas jsonb;
  v_passing jsonb;
begin
  if v_user is null or not exists (select 1 from profiles where id = v_user and status = 'active') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_review not in ('instant', 'end') then
    raise exception 'invalid review mode' using errcode = '22023';
  end if;

  if p_exam_configuration_id is not null then
    select subject_codes, question_count, duration_minutes, points_per_correct, name, subject_quotas, passing_grades
      into p_subject_codes, p_count, p_duration_minutes, v_points, v_name, v_quotas, v_passing
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
      'points_per_correct', v_points,
      'subject_quotas', v_quotas,
      'passing_grades', v_passing,
      'review', case when p_mode = 'exam' then 'end' else p_review end
    )
  )
  returning id into v_session;

  insert into session_questions (session_id, question_id, position)
  select
    v_session,
    picked.id,
    (row_number() over (
      order by case when v_quotas is null then 0 else picked.subject_order end, picked.shuffle
    ) - 1)::smallint
  from (
    select
      q.id, s.code, s.sort_order as subject_order, random() as shuffle,
      row_number() over (order by random()) as overall_rank,
      row_number() over (partition by s.code order by random()) as subject_rank
    from questions q
    join topics t on t.id = q.topic_id
    join subjects s on s.id = t.subject_id
    where q.status = 'published'
      and (coalesce(cardinality(p_subject_codes), 0) = 0 or s.code = any (p_subject_codes))
      and (coalesce(cardinality(p_topic_ids), 0) = 0 or q.topic_id = any (p_topic_ids))
      and (p_difficulty is null or q.difficulty = p_difficulty)
      and (p_filter <> 'bookmarked' or exists (select 1 from bookmarks b where b.user_id = v_user and b.question_id = q.id))
      and (p_filter <> 'unanswered' or not exists (
        select 1 from session_answers a join study_sessions ss on ss.id = a.session_id where ss.user_id = v_user and a.question_id = q.id))
      and (p_filter <> 'incorrect' or exists (
        select 1 from session_answers a join study_sessions ss on ss.id = a.session_id where ss.user_id = v_user and a.question_id = q.id and a.is_correct = false))
  ) picked
  where case when v_quotas is null then picked.overall_rank <= p_count else picked.subject_rank <= coalesce((v_quotas ->> picked.code)::int, 0) end;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    raise exception 'no questions match the selected filters' using errcode = 'P0002';
  end if;
  return v_session;
end;
$$;

-- submit_answer: practice with review='end' stores the answer unscored and hides the key, like an exam.
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
  v_instant boolean;
begin
  select * into s from study_sessions where id = p_session_id and user_id = auth.uid() for update;
  if not found then raise exception 'session not found' using errcode = 'P0002'; end if;
  if s.status <> 'in_progress' then return jsonb_build_object('status', 'closed'); end if;

  v_instant := s.mode = 'practice' and coalesce(s.configuration ->> 'review', 'instant') = 'instant';
  v_deadline := session_deadline(s);
  if v_deadline is not null and now() > v_deadline + interval '5 seconds' then
    perform finish_study_session(p_session_id);
    return jsonb_build_object('status', 'expired');
  end if;

  if not exists (select 1 from session_questions where session_id = s.id and question_id = p_question_id) then
    raise exception 'question not in session' using errcode = '22023';
  end if;

  select q.type into v_type from questions q join question_options o on o.question_id = q.id where q.id = p_question_id and o.id = p_option_id;
  if not found then raise exception 'invalid option' using errcode = '22023'; end if;

  if v_instant then
    if exists (select 1 from session_answers where session_id = s.id and question_id = p_question_id) then
      return jsonb_build_object('status', 'evaluated') || question_feedback(p_question_id,
        (select option_id from session_answers where session_id = s.id and question_id = p_question_id));
    end if;
    select k.is_correct, k.score into v_correct, v_score from question_answer_keys k where k.option_id = p_option_id;
  end if;

  insert into session_answers (session_id, question_id, option_id, is_correct, awarded_score, answered_at)
  values (
    s.id, p_question_id, p_option_id,
    case when v_instant and v_type = 'objective' then coalesce(v_correct, false) end,
    case when v_instant and v_type = 'weighted' then coalesce(v_score, 0) end,
    now()
  )
  on conflict (session_id, question_id) do update
  set option_id = excluded.option_id, answered_at = excluded.answered_at;

  update study_sessions set last_activity_at = now() where id = s.id;

  if not v_instant then return jsonb_build_object('status', 'saved'); end if;
  return jsonb_build_object('status', 'evaluated') || question_feedback(p_question_id, p_option_id);
end;
$$;

-- get_session_feedback: hide feedback while in progress for exams and for practice review='end'.
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
  if not found then raise exception 'session not found' using errcode = 'P0002'; end if;
  if s.status = 'in_progress' and (s.mode = 'exam' or coalesce(s.configuration ->> 'review', 'instant') = 'end') then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(
      question_feedback(sq.question_id, a.option_id)
      || jsonb_build_object('is_correct', a.is_correct, 'awarded_score', a.awarded_score)
      order by sq.position)
    from session_questions sq
    left join session_answers a on a.session_id = sq.session_id and a.question_id = sq.question_id
    where sq.session_id = s.id and (s.mode = 'exam' or coalesce(s.configuration ->> 'review','instant') = 'end' or a.option_id is not null)
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.start_study_session(public.session_mode, text[], uuid[], public.difficulty_level, text, integer, integer, uuid, text) from public, anon;
grant execute on function public.start_study_session(public.session_mode, text[], uuid[], public.difficulty_level, text, integer, integer, uuid, text) to authenticated;

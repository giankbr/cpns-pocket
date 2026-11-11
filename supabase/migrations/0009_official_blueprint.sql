-- Align topics and the SKD simulation with the official SKD blueprint
-- (KepmenPANRB 321/2024: 110 questions / 100 minutes = TWK 30, TIU 35, TKP 45;
-- thresholds TWK 65, TIU 80, TKP 166). Values stay editable in exam_configurations.

-- 1. Topics ---------------------------------------------------------------
insert into public.topics (subject_id, name, sort_order)
select s.id, t.name, t.sort_order
from (values
  ('TWK', 'Nasionalisme', 1),
  ('TWK', 'Integritas', 2),
  ('TWK', 'Bela Negara', 3),
  ('TWK', 'Pilar Negara', 4),
  ('TWK', 'Bahasa Indonesia', 5),
  ('TIU', 'Verbal', 1),
  ('TIU', 'Numerik', 2),
  ('TIU', 'Figural', 3)
) as t(code, name, sort_order)
join public.subjects s on s.code = t.code
on conflict (subject_id, name) do update set sort_order = excluded.sort_order;

-- Move content from the old topics, then drop them.
with mapping(code, old_name, new_name) as (values
  ('TWK', 'Pancasila', 'Pilar Negara'),
  ('TWK', 'UUD 1945', 'Pilar Negara'),
  ('TWK', 'Bhinneka Tunggal Ika', 'Pilar Negara'),
  ('TWK', 'NKRI', 'Pilar Negara'),
  ('TWK', 'Sejarah dan Wawasan Kebangsaan', 'Nasionalisme'),
  ('TIU', 'Logika', 'Verbal'),
  ('TIU', 'Analitis', 'Verbal')
), resolved as (
  select o.id as old_id, n.id as new_id
  from mapping m
  join public.subjects s on s.code = m.code
  join public.topics o on o.subject_id = s.id and o.name = m.old_name
  join public.topics n on n.subject_id = s.id and n.name = m.new_name
), moved_questions as (
  update public.questions q set topic_id = r.new_id from resolved r where q.topic_id = r.old_id returning 1
), moved_materials as (
  update public.learning_materials l set topic_id = r.new_id from resolved r where l.topic_id = r.old_id returning 1
)
select (select count(*) from moved_questions) + (select count(*) from moved_materials);

delete from public.topics t
using public.subjects s
where s.id = t.subject_id
  and (
    (s.code = 'TWK' and t.name in ('Pancasila', 'UUD 1945', 'Bhinneka Tunggal Ika', 'NKRI', 'Sejarah dan Wawasan Kebangsaan'))
    or (s.code = 'TIU' and t.name in ('Logika', 'Analitis'))
  )
  and not exists (select 1 from public.questions q where q.topic_id = t.id)
  and not exists (select 1 from public.learning_materials l where l.topic_id = t.id);

update public.subjects set description = 'Nasionalisme, integritas, bela negara, pilar negara, dan bahasa Indonesia.' where code = 'TWK';
update public.subjects set description = 'Kemampuan verbal, numerik, dan figural.' where code = 'TIU';

-- 2. Exam presets: per-subject quotas and passing grades ---------------------
alter table public.exam_configurations
  add column if not exists subject_quotas jsonb,
  add column if not exists passing_grades jsonb;

update public.exam_configurations
set subject_quotas = '{"TWK": 30, "TIU": 35, "TKP": 45}'::jsonb,
    passing_grades = '{"TWK": 65, "TIU": 80, "TKP": 166}'::jsonb,
    description = 'Format SKD: 30 TWK, 35 TIU, 45 TKP dalam 100 menit. Ambang batas TWK 65, TIU 80, TKP 166 (ubah bila aturan berganti).'
where name = 'Simulasi SKD';

-- 3. start_study_session: honour quotas, keep subjects grouped like the real CAT
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
  v_quotas jsonb;
  v_passing jsonb;
begin
  if v_user is null or not exists (select 1 from profiles where id = v_user and status = 'active') then
    raise exception 'not allowed' using errcode = '42501';
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
      'passing_grades', v_passing
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
      q.id,
      s.code,
      s.sort_order as subject_order,
      random() as shuffle,
      row_number() over (order by random()) as overall_rank,
      row_number() over (partition by s.code order by random()) as subject_rank
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
  ) picked
  where case
    when v_quotas is null then picked.overall_rank <= p_count
    else picked.subject_rank <= coalesce((v_quotas ->> picked.code)::int, 0)
  end;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    raise exception 'no questions match the selected filters' using errcode = 'P0002';
  end if;

  return v_session;
end;
$$;

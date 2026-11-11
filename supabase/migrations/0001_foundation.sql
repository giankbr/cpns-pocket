create extension if not exists pgcrypto;

create type public.profile_role as enum ('member', 'admin');
create type public.profile_status as enum ('active', 'disabled');
create type public.content_status as enum ('draft', 'published', 'archived');
create type public.question_type as enum ('objective', 'weighted');
create type public.difficulty_level as enum ('easy', 'medium', 'hard');
create type public.session_mode as enum ('practice', 'exam');
create type public.session_status as enum ('in_progress', 'completed', 'abandoned');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role public.profile_role not null default 'member',
  status public.profile_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('TWK', 'TIU', 'TKP')),
  name text not null,
  description text,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  name text not null,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  unique(subject_id, name)
);

create table public.learning_materials (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  title text not null,
  body text not null,
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete restrict,
  type public.question_type not null,
  prompt text not null,
  explanation text,
  difficulty public.difficulty_level not null default 'medium',
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  label text not null,
  sort_order smallint not null check (sort_order >= 0),
  created_at timestamptz not null default now(),
  unique(question_id, sort_order)
);

create table public.question_answer_keys (
  option_id uuid primary key references public.question_options(id) on delete cascade,
  is_correct boolean,
  score smallint,
  check (
    (is_correct is not null and score is null)
    or (is_correct is null and score is not null)
  )
);

create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode public.session_mode not null,
  status public.session_status not null default 'in_progress',
  configuration jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  last_activity_at timestamptz not null default now(),
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  score numeric check (score is null or score >= 0)
);

create table public.session_questions (
  session_id uuid not null references public.study_sessions(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  position smallint not null check (position >= 0),
  primary key (session_id, question_id),
  unique(session_id, position)
);

create table public.session_answers (
  session_id uuid not null,
  question_id uuid not null,
  option_id uuid not null references public.question_options(id) on delete restrict,
  is_correct boolean,
  awarded_score smallint,
  answered_at timestamptz not null default now(),
  primary key (session_id, question_id),
  foreign key (session_id, question_id)
    references public.session_questions(session_id, question_id)
    on delete cascade
);

create table public.bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

create table public.exam_configurations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject_codes text[] not null default '{}',
  question_count smallint not null check (question_count > 0),
  duration_minutes smallint not null check (duration_minutes > 0),
  enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create index topics_subject_id_idx on public.topics(subject_id);
create index questions_topic_id_status_idx on public.questions(topic_id, status);
create index study_sessions_user_id_status_idx on public.study_sessions(user_id, status);
create index session_answers_session_id_idx on public.session_answers(session_id);
create index bookmarks_question_id_idx on public.bookmarks(question_id);

alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.topics enable row level security;
alter table public.learning_materials enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.question_answer_keys enable row level security;
alter table public.study_sessions enable row level security;
alter table public.session_questions enable row level security;
alter table public.session_answers enable row level security;
alter table public.bookmarks enable row level security;
alter table public.exam_configurations enable row level security;

create policy "Users can read their profile"
  on public.profiles for select to authenticated
  using (id = auth.uid());

create policy "Active users can read published subjects"
  on public.subjects for select to authenticated
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active'
  ));

create policy "Active users can read published topics"
  on public.topics for select to authenticated
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active'
  ));

create policy "Active users can read published materials"
  on public.learning_materials for select to authenticated
  using (
    status = 'published'
    and exists (select 1 from public.profiles where id = auth.uid() and status = 'active')
  );

create policy "Active users can read published questions"
  on public.questions for select to authenticated
  using (
    status = 'published'
    and exists (select 1 from public.profiles where id = auth.uid() and status = 'active')
  );

create policy "Active users can read question options"
  on public.question_options for select to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where id = auth.uid() and status = 'active'
    )
    and exists (
      select 1
      from public.questions
      where id = question_id and status = 'published'
    )
  );

create policy "Users can manage their sessions"
  on public.study_sessions for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can read their session questions"
  on public.session_questions for select to authenticated
  using (exists (
    select 1 from public.study_sessions
    where id = session_id and user_id = auth.uid()
  ));

create policy "Users can manage their session answers"
  on public.session_answers for all to authenticated
  using (exists (
    select 1 from public.study_sessions
    where id = session_id and user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.study_sessions
    where id = session_id and user_id = auth.uid()
  ));

revoke insert, update, delete on public.session_answers from authenticated;

create policy "Users can manage their bookmarks"
  on public.bookmarks for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Active users can read enabled exam configurations"
  on public.exam_configurations for select to authenticated
  using (
    enabled and exists (select 1 from public.profiles where id = auth.uid() and status = 'active')
  );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

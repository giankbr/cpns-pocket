-- Personal notes and text annotations (highlight / underline / strike / note) on learning
-- materials, plus a way for users to rename themselves.

create table public.annotations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- null = free-standing personal note
  material_id uuid references public.learning_materials(id) on delete cascade,
  kind text not null check (kind in ('highlight', 'underline', 'strike', 'note')),
  color text check (color in ('yellow', 'green', 'pink', 'blue')),
  -- character offsets inside the rendered material text; quote is kept for display and re-anchoring
  start_offset integer check (start_offset >= 0),
  end_offset integer,
  quote text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_offset is null or end_offset > start_offset),
  check (material_id is not null or (kind = 'note' and note is not null))
);

create index annotations_user_material_idx on public.annotations(user_id, material_id);

alter table public.annotations enable row level security;

create policy "Users manage their annotations"
  on public.annotations for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.update_display_name(p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or char_length(btrim(p_name)) not between 1 and 60 then
    raise exception 'invalid name' using errcode = '22023';
  end if;
  update profiles set display_name = btrim(p_name), updated_at = now() where id = auth.uid();
end;
$$;

revoke all on function public.update_display_name(text) from public, anon;
grant execute on function public.update_display_name(text) to authenticated;

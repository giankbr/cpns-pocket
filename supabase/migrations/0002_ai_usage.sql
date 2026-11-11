create table public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (user_id, usage_date)
);

alter table public.ai_usage enable row level security;

create or replace function public.consume_ai_request(p_daily_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  accepted boolean;
begin
  if current_user_id is null or p_daily_limit < 1 then
    return false;
  end if;

  insert into public.ai_usage (user_id, usage_date, request_count)
  values (current_user_id, current_date, 1)
  on conflict (user_id, usage_date) do update
  set request_count = public.ai_usage.request_count + 1
  where public.ai_usage.request_count < p_daily_limit
  returning true into accepted;

  return coalesce(accepted, false);
end;
$$;

revoke all on table public.ai_usage from public, anon, authenticated;
revoke all on function public.consume_ai_request(integer) from public, anon;
grant execute on function public.consume_ai_request(integer) to authenticated;

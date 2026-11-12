-- Admin-only overview of every user's progress. Aggregated per user (no raw answers leak);
-- callable only by an active admin.
create or replace function public.admin_user_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'admin' and status = 'active') then
    raise exception 'admin only' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(row order by (row->>'last_active') desc nulls last)
    from (
      select jsonb_build_object(
        'user_id', p.id,
        'name', p.display_name,
        'email', u.email,
        'role', p.role,
        'status', p.status,
        'joined', p.created_at,
        'daily_target', p.daily_target,
        'sessions', (select count(*) from study_sessions ss where ss.user_id = p.id),
        'completed', (select count(*) from study_sessions ss where ss.user_id = p.id and ss.status = 'completed'),
        'study_seconds', (select coalesce(sum(duration_seconds), 0) from study_sessions ss where ss.user_id = p.id and ss.status = 'completed'),
        'last_active', (select max(ss.last_activity_at) from study_sessions ss where ss.user_id = p.id),
        'answered', latest.answered,
        'graded', latest.graded,
        'correct', latest.correct
      ) as row
      from profiles p
      join auth.users u on u.id = p.id
      left join lateral (
        select count(*) as answered,
               count(*) filter (where is_correct is not null) as graded,
               count(*) filter (where is_correct) as correct
        from (
          select distinct on (a.question_id) a.is_correct
          from session_answers a
          join study_sessions ss on ss.id = a.session_id and ss.user_id = p.id
          order by a.question_id, a.answered_at desc
        ) q
      ) latest on true
    ) rows
  ), '[]'::jsonb);
end; $$;

revoke all on function public.admin_user_overview() from public, anon;
grant execute on function public.admin_user_overview() to authenticated;

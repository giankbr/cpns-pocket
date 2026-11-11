-- Invite-only at the data layer: anyone who still manages to sign up lands as 'disabled'
-- and is rejected by requireSession until an admin activates them. Existing users keep access.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, status)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email), 'disabled');
  return new;
end;
$$;

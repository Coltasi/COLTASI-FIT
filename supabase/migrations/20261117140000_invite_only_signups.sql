-- Signups are invite only: a new login must carry a valid household invite code.
-- Enforced in the database so it also blocks direct calls to the Supabase auth API.
create or replace function public.require_invite_code()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  code text := upper(trim(coalesce(new.raw_user_meta_data ->> 'household_invite_code', '')));
begin
  if code = '' or not exists (select 1 from public.households where invite_code = code) then
    raise exception 'Signups are invite only. Ask for an invite code.';
  end if;
  return new;
end;
$$;
revoke all on function public.require_invite_code() from public, anon, authenticated;

drop trigger if exists a_require_invite_code on auth.users;
create trigger a_require_invite_code
  before insert on auth.users
  for each row execute function public.require_invite_code();

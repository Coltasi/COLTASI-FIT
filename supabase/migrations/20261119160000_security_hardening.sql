-- Security and integrity hardening (19 Nov 2026 audit).

-- 1. Only one workout open per person. Stops double taps or two devices creating twin sessions.
create unique index if not exists sessions_one_open_per_user
  on public.sessions (user_id) where status = 'in_progress';

-- 2. Invite codes only work for a household that actually has a member. Households left behind
--    by deleted test signups otherwise keep a working invite code forever.
create or replace function public.require_invite_code()
returns trigger language plpgsql security definer set search_path to '' as $$
declare
  code text := upper(trim(coalesce(new.raw_user_meta_data ->> 'household_invite_code', '')));
begin
  if code = '' or not exists (
    select 1 from public.households h
    where h.invite_code = code
      and exists (select 1 from public.profiles p where p.household_id = h.id)
  ) then
    raise exception 'Signups are invite only. Ask for an invite code.';
  end if;
  return new;
end;
$$;

-- 3. A signed-in user can edit their own profile but can't move themselves into another
--    household (which would expose that household's member list) or change their id.
create or replace function public.lock_profile_identity()
returns trigger language plpgsql set search_path to '' as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.id is distinct from old.id or new.household_id is distinct from old.household_id) then
    raise exception 'That profile field can''t be changed from the app.';
  end if;
  return new;
end;
$$;
drop trigger if exists lock_profile_identity on public.profiles;
create trigger lock_profile_identity before update on public.profiles
  for each row execute function public.lock_profile_identity();

-- 4. Photo uploads: images only, 10 MB max.
update storage.buckets
   set file_size_limit = 10485760,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
 where id in ('scan-photos', 'meal-photos');

-- 5. Indexes on foreign keys the app filters and joins on.
create index if not exists exercises_created_by on public.exercises (created_by);
create index if not exists plan_overrides_day on public.plan_overrides (day_id);
create index if not exists plan_overrides_exercise on public.plan_overrides (exercise_id);
create index if not exists plan_overrides_sub_for on public.plan_overrides (sub_for);
create index if not exists profiles_household on public.profiles (household_id);
create index if not exists program_exercises_exercise on public.program_exercises (exercise_id);
create index if not exists session_exercises_exercise on public.session_exercises (exercise_id);
create index if not exists session_sets_user on public.session_sets (user_id);
create index if not exists sessions_day on public.sessions (day_id);

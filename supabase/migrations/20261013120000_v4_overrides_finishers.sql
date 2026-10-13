-- Coltasi Fit v4: plan overrides (swaps and additions carry over to that day's next
-- session), editable ab finishers, per-session finisher moves, swap/add markers on
-- session lifts, and a daily sleep reminder setting. Additive only: no data is dropped.

-- ---------------------------------------------------------------- profiles
alter table public.profiles
  add column if not exists notify_sleep boolean not null default true,
  add column if not exists sleep_time time not null default '07:00';

-- ---------------------------------------------------------------- plan overrides
-- A finished Split session's final lift list, saved per user and program day.
-- When rows exist for a day, the next session builds from them instead of the template.
create table if not exists public.plan_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day_id uuid not null references public.program_days (id) on delete cascade,
  position int not null,
  exercise_id uuid not null references public.exercises (id),
  target_sets int not null check (target_sets between 1 and 10),
  rep_range text,
  sub_for uuid references public.exercises (id), -- original lift this replaces
  added boolean not null default false,
  unique (user_id, day_id, position)
);
create index if not exists plan_overrides_user_day on public.plan_overrides (user_id, day_id, position);

-- ---------------------------------------------------------------- finishers
create table if not exists public.finishers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  moves jsonb not null default '[]', -- [{ "name": "KB windmill", "dose": "8 each" }]
  is_default boolean not null default false,
  position int not null default 0
);
create index if not exists finishers_user on public.finishers (user_id, position);

-- ---------------------------------------------------------------- sessions
alter table public.sessions add column if not exists finisher_moves jsonb; -- [{name, dose, done}]
-- sub_for has no foreign key on purpose: a second FK from session_exercises to exercises would
-- make the existing `exercises(name)` embeds ambiguous in PostgREST.
alter table public.session_exercises
  add column if not exists sub_for uuid,
  add column if not exists added boolean not null default false;

-- ---------------------------------------------------------------- RLS
alter table public.plan_overrides enable row level security;
alter table public.finishers enable row level security;
drop policy if exists "plan_overrides: owner" on public.plan_overrides;
create policy "plan_overrides: owner" on public.plan_overrides for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "finishers: owner" on public.finishers;
create policy "finishers: owner" on public.finishers for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- finisher seed
-- The four starter finishers. KB core circuit is the default.
create or replace function public.seed_finishers(uid uuid)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.finishers (user_id, name, moves, is_default, position)
  select uid, v.name, v.moves::jsonb, v.is_default, v.position
  from (values
    ('Plank series', '[{"name":"Front plank","dose":"45 s"},{"name":"Side plank","dose":"30 s each"},{"name":"Hollow hold","dose":"30 s"}]', false, 1),
    ('KB Russian Twists', '[{"name":"KB Russian twists","dose":"3 × 20"}]', false, 2),
    ('Hanging Leg Raises', '[{"name":"Hanging leg raises","dose":"3 × 10"}]', false, 3),
    ('KB core circuit', '[{"name":"KB Russian twist","dose":"20"},{"name":"KB windmill","dose":"8 each"},{"name":"KB dead bug pullover","dose":"10"},{"name":"KB suitcase carry","dose":"30 m each"},{"name":"Rounds","dose":"3"}]', true, 4)
  ) as v (name, moves, is_default, position)
  where not exists (select 1 from public.finishers f where f.user_id = uid);
$$;
revoke all on function public.seed_finishers(uuid) from public, anon, authenticated;

-- New profiles get the starter finishers.
create or replace function public.handle_new_profile()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.seed_finishers(new.id);
  return new;
end;
$$;
revoke all on function public.handle_new_profile() from public, anon, authenticated;

drop trigger if exists on_profile_created on public.profiles;
create trigger on_profile_created
  after insert on public.profiles
  for each row execute function public.handle_new_profile();

-- Existing people get them now.
select public.seed_finishers(id) from public.profiles;

-- ---------------------------------------------------------------- library
insert into public.exercises (name, modality)
select 'Farmer Carry', 'other'
where not exists (select 1 from public.exercises where created_by is null and lower(name) = 'farmer carry');

-- Coltasi Fit v3: fresh schema for the redesigned app.
-- Drops everything from the first build (logged data, meals, nutrition logging)
-- and recreates the database around the Claude Design canvas:
-- program (shared template), sessions + sets, weekly weigh-ins, Tanita scans,
-- sleep, and Coach reads. Every per-person table is locked to its owner by RLS.

-- ---------------------------------------------------------------- teardown
drop trigger if exists on_auth_user_created on auth.users;
drop table if exists
  public.meals, public.nutrition_targets,
  public.body_comp_scan_photos, public.body_comp_scans,
  public.workout_sets, public.session_exercises, public.workout_sessions,
  public.program_exercises, public.program_days, public.exercises,
  public.sleep_logs, public.profiles, public.households
  cascade;
drop function if exists public.handle_new_user();
drop function if exists public.my_household_id();
drop policy if exists "meal-photos: owner manage" on storage.objects;

-- ---------------------------------------------------------------- people
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Household',
  invite_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  display_name text,
  height_cm numeric(5,1),
  sex text check (sex in ('male', 'female')),
  birth_year int check (birth_year between 1900 and 2100),
  units text not null default 'metric' check (units in ('metric', 'imperial')),
  phase text not null default 'cut' check (phase in ('cut', 'maintain', 'bulk')),
  target_rate_kg_week numeric(4,2),
  tdee_kcal int,
  target_kcal int,
  protein_g int,
  carbs_g int,
  fat_g int,
  kettlebells_kg numeric[] not null default '{8,12,16,20,24,30}',
  notify_weigh_in boolean not null default true,
  weigh_in_time time not null default '07:30',
  notify_workout boolean not null default true,
  workout_time time not null default '08:00',
  created_at timestamptz not null default now()
);

create function public.my_household_id()
returns uuid
language sql stable security definer set search_path = ''
as $$ select household_id from public.profiles where id = (select auth.uid()) $$;
revoke all on function public.my_household_id() from public, anon;
grant execute on function public.my_household_id() to authenticated;

alter table public.households enable row level security;
alter table public.profiles enable row level security;

create policy "households: members read" on public.households
  for select to authenticated using (id = public.my_household_id());
create policy "profiles: read self and household" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (household_id is not null and household_id = public.my_household_id()));
create policy "profiles: update self" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- New sign-ups get a profile, and either join the household whose invite code
-- they entered or get a household of their own.
create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  hh uuid;
  code text := upper(trim(coalesce(new.raw_user_meta_data ->> 'household_invite_code', '')));
  nm text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');
begin
  if code <> '' then
    select id into hh from public.households where invite_code = code;
  end if;
  if hh is null then
    insert into public.households (name) values (coalesce(nm, 'My') || '''s household') returning id into hh;
  end if;
  insert into public.profiles (id, household_id, display_name) values (new.id, hh, nm);
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Existing logins keep working: give each one a fresh profile + household.
do $$
declare u record; hh uuid;
begin
  for u in select id, raw_user_meta_data from auth.users loop
    insert into public.households (name)
      values (coalesce(nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''), 'My') || '''s household')
      returning id into hh;
    insert into public.profiles (id, household_id, display_name)
      values (u.id, hh, nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''));
  end loop;
end $$;

-- ---------------------------------------------------------------- program (shared template)
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  modality text not null default 'other'
    check (modality in ('barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'kettlebell', 'band', 'other')),
  created_by uuid references auth.users (id) on delete cascade, -- null = part of the program
  created_at timestamptz not null default now()
);
create unique index exercises_name_per_owner
  on public.exercises (coalesce(created_by, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

create table public.program_days (
  id uuid primary key default gen_random_uuid(),
  program text not null check (program in ('split', 'kettlebell')),
  name text not null,
  day_order int not null,
  unique (program, day_order)
);

create table public.program_exercises (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.program_days (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  position int not null,
  target_sets int not null check (target_sets between 1 and 10),
  rep_range text not null,
  unique (day_id, position)
);

alter table public.exercises enable row level security;
alter table public.program_days enable row level security;
alter table public.program_exercises enable row level security;

create policy "exercises: read program + own" on public.exercises
  for select to authenticated using (created_by is null or created_by = (select auth.uid()));
create policy "exercises: add own" on public.exercises
  for insert to authenticated with check (created_by = (select auth.uid()));
create policy "program_days: read" on public.program_days for select to authenticated using (true);
create policy "program_exercises: read" on public.program_exercises for select to authenticated using (true);

-- ---------------------------------------------------------------- training log
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('split', 'kettlebell', 'custom')),
  day_id uuid references public.program_days (id) on delete set null,
  title text not null,
  session_date date not null default current_date,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'in_progress' check (status in ('in_progress', 'done', 'skipped')),
  warmup text check (warmup in ('stairs', 'elliptical', 'treadmill', 'rower')),
  warmup_done boolean not null default false,
  finisher text,
  finisher_done boolean not null default false,
  cooldown boolean not null default false,
  cooldown_done boolean not null default false
);
create index sessions_user_date on public.sessions (user_id, session_date desc);

create table public.session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id),
  position int not null,
  target_sets int not null default 3 check (target_sets between 1 and 10),
  rep_range text
);
create index session_exercises_session on public.session_exercises (session_id, position);
create index session_exercises_user_exercise on public.session_exercises (user_id, exercise_id);

create table public.session_sets (
  id uuid primary key default gen_random_uuid(),
  session_exercise_id uuid not null references public.session_exercises (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  set_no int not null check (set_no between 1 and 20),
  weight_kg numeric(6,2) check (weight_kg >= 0),
  reps int check (reps between 0 and 200),
  done boolean not null default false,
  done_at timestamptz,
  unique (session_exercise_id, set_no)
);

-- ---------------------------------------------------------------- body, sleep, coach
create table public.weigh_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  measured_on date not null default current_date,
  weight_kg numeric(5,2) not null check (weight_kg between 20 and 400),
  created_at timestamptz not null default now(),
  unique (user_id, measured_on)
);

create table public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  scanned_on date not null default current_date,
  weight_kg numeric(5,2),
  body_fat_pct numeric(4,1),
  fat_mass_kg numeric(5,2),
  muscle_mass_kg numeric(5,2),
  water_pct numeric(4,1),
  visceral_fat numeric(4,1),
  bmr_kcal int,
  photo_paths text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index scans_user_date on public.scans (user_id, scanned_on desc);

create table public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  night_of date not null,
  hours numeric(3,1) not null check (hours between 0 and 24),
  wake_feeling text check (wake_feeling in ('energetic', 'rested', 'groggy', 'tired', 'exhausted')),
  flags text[] not null default '{}',
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, night_of)
);

create table public.coach_reads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('session', 'weigh_in')),
  source_id uuid,
  headline text not null,
  lifting text,
  weight text,
  recovery text,
  model text,
  created_at timestamptz not null default now()
);
create index coach_reads_user_time on public.coach_reads (user_id, created_at desc);

-- Owner-only access for every per-person table.
do $$
declare t text;
begin
  foreach t in array array['sessions', 'session_exercises', 'session_sets', 'weigh_ins', 'scans', 'sleep_logs', 'coach_reads'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "%1$s: owner" on public.%1$I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t);
  end loop;
end $$;

-- ---------------------------------------------------------------- seed: The Split + Kettlebell
insert into public.exercises (name, modality) values
  ('Bench Press', 'barbell'), ('Chest-Supported Row', 'dumbbell'), ('Standing Overhead Press', 'barbell'),
  ('Lat Pulldown', 'cable'), ('High to Low Cable Flies', 'cable'), ('Lying Face Pulls / Skull Crushers', 'cable'),
  ('Front Squat', 'barbell'), ('Deadlift', 'barbell'), ('Barbell Hip Thrust', 'barbell'),
  ('Single Leg Weighted Calf Raise', 'dumbbell'), ('Leg Press Calf Raise', 'machine'), ('RDL', 'barbell'),
  ('Incline Dumbbell Press', 'dumbbell'), ('Flat Dumbbell Press', 'dumbbell'), ('Lateral Raises', 'dumbbell'),
  ('Banded Push-Ups', 'band'), ('Overhead Rope Extensions', 'cable'), ('Bar Triceps Pushdowns', 'cable'),
  ('Weighted Pull-Ups', 'bodyweight'), ('Seated Row', 'cable'), ('Reverse Pec Deck', 'machine'),
  ('Kneeling Face Pulls', 'cable'), ('Incline Dumbbell Curls', 'dumbbell'), ('Hammer Curls', 'dumbbell'),
  ('Scapular Pull-Ups', 'bodyweight'),
  ('Back Squat', 'barbell'), ('Bulgarian Split Squat', 'dumbbell'), ('Glute Ham Raise', 'bodyweight'),
  ('Smith Machine Calf Raises', 'machine'), ('Seated Weighted Calf Raise', 'machine'),
  ('Kettlebell Swing', 'kettlebell'), ('Goblet Squat', 'kettlebell'), ('Kettlebell Clean and Press', 'kettlebell'),
  ('Single-Arm Kettlebell Row', 'kettlebell'), ('Turkish Get-Up', 'kettlebell'), ('Kettlebell Halo', 'kettlebell');

insert into public.program_days (program, name, day_order) values
  ('split', 'Upper', 1), ('split', 'Lower', 2), ('split', 'Push', 3), ('split', 'Pull', 4), ('split', 'Legs', 5),
  ('kettlebell', 'Full Body · Kettlebell', 1);

insert into public.program_exercises (day_id, exercise_id, position, target_sets, rep_range)
select d.id, e.id, v.pos, v.sets, v.reps
from (values
  ('Upper', 1, 'Bench Press', 4, '4–6'),
  ('Upper', 2, 'Chest-Supported Row', 3, '6–8'),
  ('Upper', 3, 'Standing Overhead Press', 3, '8–10'),
  ('Upper', 4, 'Lat Pulldown', 3, '10–12'),
  ('Upper', 5, 'High to Low Cable Flies', 3, '12–15'),
  ('Upper', 6, 'Lying Face Pulls / Skull Crushers', 3, '10–12'),
  ('Lower', 1, 'Front Squat', 4, '10–12'),
  ('Lower', 2, 'Deadlift', 4, '6–8'),
  ('Lower', 3, 'Barbell Hip Thrust', 4, '8–12'),
  ('Lower', 4, 'Single Leg Weighted Calf Raise', 3, '6–8'),
  ('Lower', 5, 'Leg Press Calf Raise', 3, '8–12'),
  ('Lower', 6, 'RDL', 3, '8–12'),
  ('Push', 1, 'Incline Dumbbell Press', 3, '8–10'),
  ('Push', 2, 'Flat Dumbbell Press', 3, '6–8 / 8–10 / 10–12'),
  ('Push', 3, 'Lateral Raises', 4, '8–12'),
  ('Push', 4, 'Banded Push-Ups', 2, '10+'),
  ('Push', 5, 'Overhead Rope Extensions', 3, '12–15'),
  ('Push', 6, 'Bar Triceps Pushdowns', 3, '8–12'),
  ('Pull', 1, 'Weighted Pull-Ups', 3, '4–6 / 6–8 / 8–10'),
  ('Pull', 2, 'Seated Row', 3, '8–10'),
  ('Pull', 3, 'Reverse Pec Deck', 3, '10–12'),
  ('Pull', 4, 'Kneeling Face Pulls', 4, '10–15'),
  ('Pull', 5, 'Incline Dumbbell Curls', 3, '8–10'),
  ('Pull', 6, 'Hammer Curls', 3, '8–10'),
  ('Pull', 7, 'Scapular Pull-Ups', 2, '5–10+'),
  ('Legs', 1, 'Back Squat', 4, '6–8'),
  ('Legs', 2, 'Bulgarian Split Squat', 4, '8–10'),
  ('Legs', 3, 'Glute Ham Raise', 4, '10–12'),
  ('Legs', 4, 'Smith Machine Calf Raises', 3, '10–15'),
  ('Legs', 5, 'Seated Weighted Calf Raise', 3, '10–15'),
  ('Full Body · Kettlebell', 1, 'Kettlebell Swing', 4, '15–20'),
  ('Full Body · Kettlebell', 2, 'Goblet Squat', 3, '10–12'),
  ('Full Body · Kettlebell', 3, 'Kettlebell Clean and Press', 3, '6–8 per side'),
  ('Full Body · Kettlebell', 4, 'Single-Arm Kettlebell Row', 3, '8–10 per side'),
  ('Full Body · Kettlebell', 5, 'Turkish Get-Up', 2, '3–5 per side'),
  ('Full Body · Kettlebell', 6, 'Kettlebell Halo', 2, '8–10 per side')
) as v (day_name, pos, ex_name, sets, reps)
join public.program_days d on d.name = v.day_name
join public.exercises e on e.name = v.ex_name and e.created_by is null;

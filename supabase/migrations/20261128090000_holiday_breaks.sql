-- Holiday mode: breaks you enter yourself (dates + workouts per week), and two short
-- kettlebell workouts built for the 8 kg and 12 kg bells you travel with.

create table public.breaks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text check (char_length(name) <= 60),
  start_date date not null,
  end_date date not null,
  workouts_per_week int not null default 3 check (workouts_per_week between 1 and 7),
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index breaks_user_dates on public.breaks (user_id, start_date);

alter table public.breaks enable row level security;
create policy "breaks: own" on public.breaks
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Holiday workouts live in their own program so they never count as Split days.
alter table public.program_days drop constraint program_days_program_check;
alter table public.program_days add constraint program_days_program_check
  check (program in ('split', 'kettlebell', 'holiday'));

insert into public.exercises (name, modality) values
  ('Kettlebell Floor Press', 'kettlebell'),
  ('Half-Kneeling Kettlebell Press', 'kettlebell'),
  ('Kettlebell Curl', 'kettlebell'),
  ('Suitcase Carry', 'kettlebell'),
  ('Plank', 'bodyweight')
on conflict do nothing;

insert into public.program_days (program, name, day_order) values
  ('holiday', 'Holiday A: Legs + pull', 1),
  ('holiday', 'Holiday B: Upper + core', 2);

insert into public.program_exercises (day_id, exercise_id, position, target_sets, rep_range)
select d.id, e.id, v.pos, v.sets, v.reps
from (values
  ('Holiday A: Legs + pull', 1, 'Turkish Get-Up', 3, '3 per side'),
  ('Holiday A: Legs + pull', 2, 'Goblet Squat', 3, '15, 3 s down'),
  ('Holiday A: Legs + pull', 3, 'Bulgarian Split Squat', 3, '10 per side'),
  ('Holiday A: Legs + pull', 4, 'Single-Arm Kettlebell Row', 3, '12 per side'),
  ('Holiday A: Legs + pull', 5, 'Single-Leg Kettlebell RDL', 3, '10 per side'),
  ('Holiday A: Legs + pull', 6, 'Kettlebell Swing', 10, '15 every minute'),
  ('Holiday B: Upper + core', 1, 'Kettlebell Halo', 2, '10 each way'),
  ('Holiday B: Upper + core', 2, 'Kettlebell Floor Press', 3, '12 per side'),
  ('Holiday B: Upper + core', 3, 'Push-Ups', 3, '1–2 short of failure'),
  ('Holiday B: Upper + core', 4, 'Half-Kneeling Kettlebell Press', 3, '10 per side'),
  ('Holiday B: Upper + core', 5, 'Kettlebell Curl', 3, '15 per side'),
  ('Holiday B: Upper + core', 6, 'Suitcase Carry', 4, '40 m per side'),
  ('Holiday B: Upper + core', 7, 'Plank', 2, '45 s')
) as v (day_name, pos, ex_name, sets, reps)
join public.program_days d on d.name = v.day_name and d.program = 'holiday'
join public.exercises e on e.name = v.ex_name and e.created_by is null;

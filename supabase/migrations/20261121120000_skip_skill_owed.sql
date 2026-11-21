-- Skip a lift mid-workout (with a reason), owed reminders, and one-off rows that never carry over.
alter table public.session_exercises
  add column if not exists skipped_reason text
    check (skipped_reason in ('sore', 'equipment', 'time')),
  -- Owed lift dealt with: added to a later session, or dropped by the user.
  add column if not exists owed_cleared boolean not null default false,
  -- Added for this session only (an owed lift, a skill block): not saved into the day's plan.
  add column if not exists one_off boolean not null default false,
  -- Skill block in the warm-up (crow pose). Reps are logged as seconds held.
  add column if not exists skill boolean not null default false;

create index if not exists session_exercises_skipped_idx
  on public.session_exercises (user_id) where skipped_reason is not null and owed_cleared = false;

insert into public.exercises (name, modality)
select 'Crow Pose', 'bodyweight'
where not exists (select 1 from public.exercises where name = 'Crow Pose' and created_by is null);

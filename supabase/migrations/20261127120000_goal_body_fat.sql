-- Goal body fat %, so the Coach can cheer progress toward it.
alter table public.profiles
  add column if not exists goal_body_fat_pct numeric(4,1) check (goal_body_fat_pct between 3 and 50);

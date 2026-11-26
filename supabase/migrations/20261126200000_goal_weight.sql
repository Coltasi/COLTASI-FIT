-- Goal weight for the Nutrition page's "on this pace" projection. Stored in kg.
alter table public.profiles
  add column if not exists goal_weight_kg numeric(5,1) check (goal_weight_kg between 30 and 300);

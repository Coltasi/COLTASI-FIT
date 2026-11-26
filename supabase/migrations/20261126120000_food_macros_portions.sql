-- Carbs and fat on every food entry, plus portions: how much of something was eaten.
-- Existing entries keep carbs/fat empty (unknown), not zero.
alter table public.food_logs
  add column if not exists carbs_g numeric(5,1) check (carbs_g between 0 and 500),
  add column if not exists fat_g numeric(5,1) check (fat_g between 0 and 500),
  -- What was eaten, for the log line: "33 g" or "1/3 pack".
  add column if not exists portion text check (length(portion) <= 24);

-- Saved foods keep the label's numbers, so any amount can be logged from them later.
-- base_g: the grams those numbers are for (usually 100). Empty = one pack or serving.
-- pack_g: pack weight, so "1/3 of the pack" can be turned into grams.
-- last_amount: what was eaten last time (grams when base_g is set, otherwise packs/servings).
alter table public.saved_foods
  add column if not exists carbs_g numeric(5,1) check (carbs_g between 0 and 500),
  add column if not exists fat_g numeric(5,1) check (fat_g between 0 and 500),
  add column if not exists base_g numeric(6,1) check (base_g > 0 and base_g <= 5000),
  add column if not exists pack_g numeric(6,1) check (pack_g > 0 and pack_g <= 5000),
  add column if not exists last_amount numeric(6,2) check (last_amount > 0 and last_amount <= 5000);

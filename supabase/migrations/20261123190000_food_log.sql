-- Coltasi Fit: in-app food log. Each row is one thing eaten (calories + protein).
-- saved_foods are one-tap repeats (shake, smoothie). Targets live on profiles.

create table if not exists public.saved_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  kcal int not null check (kcal between 0 and 5000),
  protein_g numeric(5,1) not null default 0 check (protein_g between 0 and 500),
  use_count int not null default 0,
  last_used timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists saved_foods_user_idx on public.saved_foods (user_id);

create table if not exists public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  name text not null check (length(name) between 1 and 120),
  kcal int not null check (kcal between 0 and 5000),
  protein_g numeric(5,1) not null default 0 check (protein_g between 0 and 500),
  source text not null default 'manual' check (source in ('manual','saved','barcode','photo','text')),
  saved_food_id uuid references public.saved_foods (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists food_logs_user_day_idx on public.food_logs (user_id, day);
create index if not exists food_logs_saved_idx on public.food_logs (saved_food_id);

alter table public.saved_foods enable row level security;
alter table public.food_logs enable row level security;
create policy "saved_foods: owner" on public.saved_foods for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "food_logs: owner" on public.food_logs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

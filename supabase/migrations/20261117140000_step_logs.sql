-- Coltasi Fit: daily step counts (manual entry from the Garmin watch).
-- One row per user per day; re-saving a day overwrites it. Coach reads this table.

create table if not exists public.step_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  steps int not null check (steps between 0 and 200000),
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day)
);

alter table public.step_logs enable row level security;
create policy "step_logs: owner" on public.step_logs
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

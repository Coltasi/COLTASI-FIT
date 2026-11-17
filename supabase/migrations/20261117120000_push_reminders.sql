-- Coltasi Fit: phone push reminders (daily sleep log, weekly weigh-in).
-- Subscriptions live per device. reminder_log makes each reminder fire at most once per
-- user, kind and local day. A pg_cron job pings the send-reminders edge function every
-- 15 minutes; the function decides who is due, in each user's own time zone.
-- Secrets (VAPID private key, cron secret) live in Supabase Vault, never in this repo.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  timezone text not null default 'Europe/Madrid',
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create index if not exists push_subscriptions_user on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy "push_subscriptions: owner" on public.push_subscriptions
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table if not exists public.reminder_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('sleep', 'weigh_in', 'weigh_in_nudge')),
  local_date date not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, kind, local_date)
);
-- No policies on purpose: only the edge function (service role) reads or writes this.
alter table public.reminder_log enable row level security;

-- Lets the edge function read Vault secrets through the service role only.
create or replace function public.get_reminder_secret(secret_name text)
returns text
language sql
security definer
set search_path = ''
as $$ select decrypted_secret from vault.decrypted_secrets where name = secret_name $$;
revoke all on function public.get_reminder_secret(text) from public, anon, authenticated;
grant execute on function public.get_reminder_secret(text) to service_role;

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

select cron.schedule(
  'send-reminders',
  '*/15 * * * *',
  $cron$
  select net.http_post(
    url := 'https://rxhizksxrfeutpzlzqto.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'reminder_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $cron$
);

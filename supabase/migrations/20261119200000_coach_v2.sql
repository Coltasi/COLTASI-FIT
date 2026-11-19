-- Coach v2: reads lead with training and recovery; weight only on weigh-in and scan reads.
--   next_session: per-lift calls for next time (written in code, not by the model)
--   signals:      everything the read was built from (lift calls, sleep trend, split days),
--                 kept so sleep can later be compared with lift performance.
--   kind 'scan':  a Tanita scan now triggers a read too.
-- `lifting` stays for older reads; new reads leave it empty. `weight` was already optional.
alter table public.coach_reads add column if not exists next_session text;
alter table public.coach_reads add column if not exists signals jsonb;
alter table public.coach_reads drop constraint if exists coach_reads_kind_check;
alter table public.coach_reads add constraint coach_reads_kind_check check (kind in ('session', 'weigh_in', 'scan'));

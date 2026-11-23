-- How hard the workout was, as rated by the user at Finish (optional).
alter table public.sessions add column if not exists effort text check (effort in ('slacked','okay','solid','pushed'));

-- How hard each working set was, tapped right after ticking it (optional).
-- easy = 3+ reps left, hard = 1-2 left, failed = couldn't do another.
alter table public.session_sets add column if not exists effort text check (effort in ('easy','hard','failed'));

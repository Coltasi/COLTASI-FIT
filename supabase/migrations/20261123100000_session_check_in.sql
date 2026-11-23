-- Optional end-of-workout check-in for the Coach: how it felt, any niggles, and a free-text note.
alter table public.sessions
  add column if not exists feel text
    check (feel in ('strong', 'normal', 'low', 'sick')),
  add column if not exists pain_areas text[] not null default '{}'
    check (pain_areas <@ array['lower_back','upper_back','neck','shoulder','elbow','wrist','hip','knee','ankle','other']::text[]),
  add column if not exists notes text
    check (char_length(notes) <= 1000);

-- Coach looks back 30 days for the same niggle coming up again.
create index if not exists sessions_pain_idx
  on public.sessions (user_id, session_date) where cardinality(pain_areas) > 0;

-- How long the warm-up is, in 5 minute steps. Every existing session keeps the old fixed 10 minutes.
alter table public.sessions add column if not exists warmup_min smallint not null default 10
  check (warmup_min between 5 and 30 and warmup_min % 5 = 0);

-- Cancelling an edit also puts the warm-up length back.
create or replace function public.cancel_session_edit(p_session uuid) returns boolean
language plpgsql security invoker set search_path = public as $$
declare snap jsonb; r public.sessions;
begin
  select edit_snapshot into snap from public.sessions
   where id = p_session and user_id = (select auth.uid()) and status = 'in_progress' and edit_snapshot is not null
   for update;
  if snap is null then return false; end if;
  delete from public.session_exercises where session_id = p_session;
  insert into public.session_exercises
    select * from jsonb_populate_recordset(null::public.session_exercises, snap->'session_exercises');
  insert into public.session_sets
    select * from jsonb_populate_recordset(null::public.session_sets,
      (select coalesce(jsonb_agg(x), '[]'::jsonb)
         from jsonb_array_elements(snap->'session_exercises') e, jsonb_array_elements(e->'session_sets') x));
  r := jsonb_populate_record(null::public.sessions, snap);
  update public.sessions set
    status = r.status, finished_at = r.finished_at, feel = r.feel, pain_areas = r.pain_areas, notes = r.notes,
    warmup = r.warmup, warmup_min = coalesce(r.warmup_min, 10), warmup_done = r.warmup_done, finisher = r.finisher, finisher_moves = r.finisher_moves,
    finisher_done = r.finisher_done, cooldown = r.cooldown, cooldown_done = r.cooldown_done, edit_snapshot = null
   where id = p_session;
  return true;
end $$;

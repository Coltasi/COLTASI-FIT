-- Edit a finished workout: reopen it (with a snapshot so Cancel can put it back exactly), then save or cancel.
alter table public.sessions add column if not exists edit_snapshot jsonb;

-- Reopens one of your finished workouts for editing. Saves a full copy of the session, its lifts and sets.
create or replace function public.reopen_session(p_session uuid) returns boolean
language plpgsql security invoker set search_path = public as $$
declare s public.sessions;
begin
  select * into s from public.sessions
   where id = p_session and user_id = (select auth.uid()) and status = 'done' and edit_snapshot is null
   for update;
  if not found then return false; end if;
  update public.sessions set status = 'in_progress', edit_snapshot =
    (to_jsonb(s) - 'edit_snapshot') || jsonb_build_object('session_exercises', (
      select coalesce(jsonb_agg(to_jsonb(se) || jsonb_build_object('session_sets', (
        select coalesce(jsonb_agg(to_jsonb(ss)), '[]'::jsonb) from public.session_sets ss where ss.session_exercise_id = se.id
      ))), '[]'::jsonb)
      from public.session_exercises se where se.session_id = s.id))
   where id = p_session;
  return true;
end $$;

-- Throws away edits: puts the session, its lifts and sets back exactly as they were when Edit was tapped.
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
    warmup = r.warmup, warmup_done = r.warmup_done, finisher = r.finisher, finisher_moves = r.finisher_moves,
    finisher_done = r.finisher_done, cooldown = r.cooldown, cooldown_done = r.cooldown_done, edit_snapshot = null
   where id = p_session;
  return true;
end $$;

revoke execute on function public.reopen_session(uuid) from public, anon;
revoke execute on function public.cancel_session_edit(uuid) from public, anon;
grant execute on function public.reopen_session(uuid) to authenticated;
grant execute on function public.cancel_session_edit(uuid) to authenticated;

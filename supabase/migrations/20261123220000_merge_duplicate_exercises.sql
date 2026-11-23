-- Merge duplicate exercises Colin typed under different names into one canonical library exercise.
-- History is kept: every session/plan row pointing at a duplicate is repointed to the canonical one.

-- 1. Promote canonical exercises that only existed as personal entries into the shared library.
update exercises set created_by = null, modality = 'kettlebell' where created_by is not null and lower(name) = 'kettlebell front squat';
update exercises set created_by = null, modality = 'bodyweight', name = 'Push-Ups' where created_by is not null and lower(name) = 'push ups';
update exercises set created_by = null, modality = 'dumbbell', name = 'Single-Arm Iso DB Press' where created_by is not null and lower(name) = 'iso db press';
update exercises set created_by = null, modality = 'dumbbell' where created_by is not null and lower(name) = 'hanging bicep curls';
update exercises set created_by = null where created_by is not null and lower(name) in ('bosu ski jumps', 'bosu single leg squat');
update exercises set name = 'Round the World' where created_by is not null and lower(name) = 'round the worlds';

-- 2. Duplicate (personal) name -> canonical (library) name.
create temp table ex_merge on commit drop as
select d.id as dup_id, c.id as canon_id
from (values
  ('kb swing', 'kettlebell swing'),
  ('kb swings', 'kettlebell swing'),
  ('turkish getups', 'turkish get-up'),
  ('farmer carry', 'farmer carry'),
  ('farmer carry kb', 'farmer carry'),
  ('chest supported rows', 'chest-supported row'),
  ('lat pull downs (machine)', 'lat pulldown'),
  ('tricep pulldowns', 'bar triceps pushdowns'),
  ('hip thrust', 'barbell hip thrust'),
  ('front squat kb', 'kettlebell front squat'),
  ('single leg rdl', 'single-leg kettlebell rdl'),
  ('single arm isometric db bench', 'single-arm iso db press'),
  ('bosu ski jumpers', 'bosu ski jumps'),
  ('bosu ski exercises', 'bosu ski jumps'),
  ('bosu side ski jumps', 'bosu ski jumps'),
  ('bosu ball exercises', 'bosu ski jumps'),
  ('single leg squats', 'bosu single leg squat'),
  ('bosu pistols', 'bosu single leg squat'),
  ('iso seated hanging curls', 'hanging bicep curls')
) m(dup, canon)
join exercises d on lower(d.name) = m.dup and d.created_by is not null
join exercises c on lower(c.name) = m.canon and c.created_by is null;

do $$ begin
  if (select count(*) from ex_merge) <> 19 then raise exception 'expected 19 duplicate mappings, got %', (select count(*) from ex_merge); end if;
end $$;

-- 3. Repoint everything, then remove the duplicates.
update session_exercises t set exercise_id = m.canon_id from ex_merge m where t.exercise_id = m.dup_id;
update plan_overrides t set exercise_id = m.canon_id from ex_merge m where t.exercise_id = m.dup_id;
update plan_overrides t set sub_for = m.canon_id from ex_merge m where t.sub_for = m.dup_id;
update program_exercises t set exercise_id = m.canon_id from ex_merge m where t.exercise_id = m.dup_id;
delete from exercises e using ex_merge m where e.id = m.dup_id;

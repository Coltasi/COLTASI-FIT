-- Promote every remaining personal exercise into the shared library, with tidied names and equipment.
update exercises e set created_by = null, name = m.new_name, modality = m.modality
from (values
  ('bosu round the world', 'Bosu Round the World', 'other'),
  ('cable oblique extensions', 'Cable Oblique Extensions', 'cable'),
  ('chest flies', 'Chest Flies', 'dumbbell'),
  ('clean front squat', 'Clean Front Squat', 'kettlebell'),
  ('hamstring machine lifts', 'Hamstring Machine Curl', 'machine'),
  ('kb dead bugs', 'Kettlebell Dead Bug', 'kettlebell'),
  ('kb side lifts', 'Kettlebell Side Lifts', 'kettlebell'),
  ('kneeling woodchopper', 'Kneeling Woodchopper', 'cable'),
  ('round the world', 'Round the World', 'kettlebell'),
  ('seat linear leg lift', 'Seated Linear Leg Lift', 'bodyweight'),
  ('seated oh press', 'Seated Overhead Press', 'dumbbell'),
  ('single leg lunge', 'Single-Leg Lunge', 'kettlebell'),
  ('single leg press', 'Single-Leg Press', 'machine'),
  ('skull crushers', 'Skull Crushers', 'other'),
  ('standing iso dumbbell curls', 'Standing Iso Dumbbell Curls', 'dumbbell'),
  ('standing kb oh march', 'Kettlebell Overhead March', 'kettlebell'),
  ('superset should press + oh', 'Shoulder Press + Overhead Superset', 'other'),
  ('tricep dips', 'Triceps Dips', 'bodyweight'),
  ('zanetti press', 'Zanetti Press', 'other')
) m(old_name, new_name, modality)
where e.created_by is not null and lower(e.name) = m.old_name;

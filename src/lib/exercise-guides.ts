/**
 * How-to content for the Exercise library: main and secondary muscles, three steps and
 * one common mistake per lift, keyed by exercise name (matches exercises.name).
 */
export type Guide = { primary: string[]; secondary: string[]; steps: string[]; mistake: string };

export const GUIDES: Record<string, Guide> = {
  "Bench Press": {
    primary: ["Chest"],
    secondary: ["Front delts","Triceps"],
    steps: ["Lie with eyes under the bar, feet flat, shoulder blades pinched.","Lower the bar to mid-chest with elbows about 45° from your body.","Press up and slightly back over your shoulders."],
    mistake: "Bouncing the bar off your chest or flaring elbows straight out.",
  },
  "Chest-Supported Row": {
    primary: ["Upper back","Lats"],
    secondary: ["Rear delts","Biceps"],
    steps: ["Lie chest-down on an incline bench, dumbbells hanging.","Pull elbows back toward your hips.","Squeeze shoulder blades together, lower under control."],
    mistake: "Lifting your chest off the pad to cheat the weight up.",
  },
  "Standing Overhead Press": {
    primary: ["Shoulders"],
    secondary: ["Triceps","Upper chest","Core"],
    steps: ["Bar on front of shoulders, grip just outside them, glutes tight.","Press straight up, moving your head back then through.","Lock out with the bar over mid-foot."],
    mistake: "Leaning back and turning it into an incline press.",
  },
  "Lat Pulldown": {
    primary: ["Lats"],
    secondary: ["Biceps","Rear delts"],
    steps: ["Grip slightly wider than shoulders, thighs under the pad.","Pull the bar to your upper chest, elbows down and back.","Let it rise slowly until arms are straight."],
    mistake: "Leaning far back and yanking with your body.",
  },
  "High to Low Cable Flies": {
    primary: ["Lower chest"],
    secondary: ["Front delts"],
    steps: ["Set pulleys high, step forward, slight bend in elbows.","Sweep hands down and together in front of your hips.","Return slowly and feel the chest stretch."],
    mistake: "Bending the elbows so it becomes a press.",
  },
  "Lying Face Pulls / Skull Crushers": {
    primary: ["Rear delts / Triceps"],
    secondary: ["Upper back"],
    steps: ["Face pulls: pull the rope to your face, elbows high.","Skull crushers: lower the bar to your forehead, elbows still.","Extend fully and control the way down."],
    mistake: "Letting elbows drift, which moves work off the target muscle.",
  },
  "Front Squat": {
    primary: ["Quads"],
    secondary: ["Glutes","Upper back","Core"],
    steps: ["Bar on front of shoulders, elbows high.","Sit straight down between your heels, chest up.","Drive up through mid-foot, keep elbows up."],
    mistake: "Elbows dropping so the bar rolls forward.",
  },
  "Deadlift": {
    primary: ["Hamstrings","Glutes","Back"],
    secondary: ["Traps","Forearms","Core"],
    steps: ["Bar over mid-foot, shins touching it, flat back.","Brace, push the floor away, keep the bar against your legs.","Stand tall with hips through, then lower the same way."],
    mistake: "Rounding the lower back or letting the bar drift forward.",
  },
  "Barbell Hip Thrust": {
    primary: ["Glutes"],
    secondary: ["Hamstrings"],
    steps: ["Upper back on a bench, bar padded over hips.","Drive hips up until your body is flat from knees to shoulders.","Squeeze glutes at the top, chin tucked."],
    mistake: "Arching the lower back instead of finishing with the glutes.",
  },
  "Single Leg Weighted Calf Raise": {
    primary: ["Calves"],
    secondary: ["Ankle stabilisers"],
    steps: ["Stand on one foot on a step, dumbbell in the same-side hand.","Lower the heel for a full stretch.","Rise as high as you can and pause."],
    mistake: "Bouncing at the bottom with short reps.",
  },
  "Leg Press Calf Raise": {
    primary: ["Calves"],
    secondary: [],
    steps: ["Balls of feet on the bottom edge of the platform.","Let heels drop back for a stretch.","Press through the toes as far as you can."],
    mistake: "Bending knees to help the weight move.",
  },
  "RDL": {
    primary: ["Hamstrings","Glutes"],
    secondary: ["Lower back","Forearms"],
    steps: ["Stand tall, soft knees, bar against your thighs.","Push hips back, sliding the bar down your legs.","Stop when hamstrings are stretched, drive hips forward."],
    mistake: "Squatting it down instead of hinging at the hips.",
  },
  "Incline Dumbbell Press": {
    primary: ["Upper chest"],
    secondary: ["Front delts","Triceps"],
    steps: ["Bench at 30°, dumbbells at chest level.","Press up and slightly together.","Lower until elbows are just below the bench."],
    mistake: "Setting the bench too steep so shoulders take over.",
  },
  "Flat Dumbbell Press": {
    primary: ["Chest"],
    secondary: ["Front delts","Triceps"],
    steps: ["Lie flat, dumbbells beside your chest, shoulder blades back.","Press up until arms are straight.","Lower slowly to a deep stretch."],
    mistake: "Cutting the range short at the bottom.",
  },
  "Lateral Raises": {
    primary: ["Side delts"],
    secondary: ["Traps"],
    steps: ["Stand tall, light dumbbells at your sides.","Raise arms out to the sides to shoulder height.","Lower slowly, no swinging."],
    mistake: "Shrugging or swinging the weight up.",
  },
  "Banded Push-Ups": {
    primary: ["Chest"],
    secondary: ["Triceps","Front delts","Core"],
    steps: ["Band across your upper back, hands under shoulders.","Lower your chest to the floor, body straight.","Press up hard against the band."],
    mistake: "Letting the hips sag.",
  },
  "Overhead Rope Extensions": {
    primary: ["Triceps (long head)"],
    secondary: [],
    steps: ["Face away from a cable, rope behind your head.","Keep elbows pointing forward and still.","Extend arms fully, then let the rope stretch behind."],
    mistake: "Elbows flaring out wide.",
  },
  "Bar Triceps Pushdowns": {
    primary: ["Triceps"],
    secondary: [],
    steps: ["Grip the bar at chest height, elbows at your sides.","Push down until arms are straight.","Let it rise to just above 90°."],
    mistake: "Leaning over the bar and using bodyweight.",
  },
  "Weighted Pull-Ups": {
    primary: ["Lats"],
    secondary: ["Biceps","Upper back","Core"],
    steps: ["Hang with weight on a belt, grip just outside shoulders.","Pull your chest toward the bar, elbows down.","Lower to a full hang every rep."],
    mistake: "Half reps that stop short of a full hang.",
  },
  "Seated Row": {
    primary: ["Mid back","Lats"],
    secondary: ["Biceps","Rear delts"],
    steps: ["Sit tall, slight knee bend, arms straight.","Pull the handle to your belly button.","Squeeze shoulder blades, then reach forward slowly."],
    mistake: "Rocking your torso back and forth.",
  },
  "Reverse Pec Deck": {
    primary: ["Rear delts"],
    secondary: ["Upper back"],
    steps: ["Face the pad, arms straight ahead at shoulder height.","Sweep arms back in a wide arc.","Return slowly without the stack touching."],
    mistake: "Bending the elbows and turning it into a row.",
  },
  "Kneeling Face Pulls": {
    primary: ["Rear delts"],
    secondary: ["Upper back","Rotator cuff"],
    steps: ["Kneel facing a high cable with a rope.","Pull toward your forehead, hands apart, elbows high.","Finish with thumbs pointing back."],
    mistake: "Pulling to the chest with elbows low.",
  },
  "Incline Dumbbell Curls": {
    primary: ["Biceps"],
    secondary: ["Forearms"],
    steps: ["Lie back on a 45° bench, arms hanging.","Curl up without moving your upper arm.","Lower all the way to a full stretch."],
    mistake: "Swinging the shoulders forward.",
  },
  "Hammer Curls": {
    primary: ["Biceps","Brachialis"],
    secondary: ["Forearms"],
    steps: ["Stand with palms facing each other.","Curl up keeping the thumb side on top.","Lower slowly."],
    mistake: "Using momentum from the hips.",
  },
  "Scapular Pull-Ups": {
    primary: ["Lower traps","Lats"],
    secondary: ["Grip"],
    steps: ["Hang from the bar, arms straight.","Pull shoulder blades down and back without bending your elbows.","Relax back to a full hang."],
    mistake: "Bending the elbows so it becomes a pull-up.",
  },
  "Back Squat": {
    primary: ["Quads","Glutes"],
    secondary: ["Hamstrings","Lower back","Core"],
    steps: ["Bar on upper back, feet shoulder width.","Brace, sit down and back until thighs are at least parallel.","Drive up, knees tracking over toes."],
    mistake: "Knees caving in on the way up.",
  },
  "Bulgarian Split Squat": {
    primary: ["Quads","Glutes"],
    secondary: ["Hamstrings","Adductors"],
    steps: ["Back foot on a bench, front foot well forward.","Drop the back knee straight down.","Push through the front heel to stand."],
    mistake: "Front foot too close so the heel lifts.",
  },
  "Glute Ham Raise": {
    primary: ["Hamstrings"],
    secondary: ["Glutes","Calves"],
    steps: ["Feet locked, knees just behind the pad.","Lower your body forward under control.","Pull yourself back up with your hamstrings."],
    mistake: "Bending at the hips instead of keeping a straight line.",
  },
  "Smith Machine Calf Raises": {
    primary: ["Calves"],
    secondary: [],
    steps: ["Balls of feet on a plate, bar on upper back.","Lower heels for a full stretch.","Rise high and pause."],
    mistake: "Short, bouncy reps.",
  },
  "Seated Weighted Calf Raise": {
    primary: ["Calves (soleus)"],
    secondary: [],
    steps: ["Sit with knees under the pad, balls of feet on the edge.","Lower heels fully.","Press up as high as possible."],
    mistake: "Rushing the bottom stretch.",
  },
  "45-Degree Hip Hinge": {
    primary: ["Glutes","Hamstrings"],
    secondary: ["Lower back (holds still)"],
    steps: ["Set the 45° bench pad just below your hip bones, feet flat, a dumbbell, kettlebell or plate hugged flat to your chest.","Keep your back flat like a plank and hinge down from the hips for 2 seconds, then pause 1 second at the bottom.","Drive up through your heels in 1 second, squeezing your glutes, and stop when your body is in a straight line."],
    mistake: "Rounding your back on the way down or arching past straight at the top. Your spine stays still; your hips do the moving.",
  },
  "Kettlebell Swing": {
    primary: ["Glutes","Hamstrings"],
    secondary: ["Core","Upper back","Grip"],
    steps: ["Hike the bell back between your legs, flat back.","Snap hips forward so the bell floats to chest height.","Let it fall back and hinge again."],
    mistake: "Squatting the swing or lifting with your arms.",
  },
  "Farmer Carry": {
    primary: ["Grip","Traps","Core"],
    secondary: ["Glutes","Calves"],
    steps: ["Pick up heavy weights, one in each hand.","Stand tall, shoulders down, walk with short steps.","Put them down with a flat back."],
    mistake: "Leaning or shrugging shoulders up to your ears.",
  },
  "Goblet Squat": {
    primary: ["Quads","Glutes"],
    secondary: ["Core","Upper back"],
    steps: ["Hold the bell at your chest, elbows down.","Squat between your knees, chest up.","Drive up through mid-foot."],
    mistake: "Letting the chest fall forward.",
  },
  "Single-Arm Kettlebell Row": {
    primary: ["Lats","Mid back"],
    secondary: ["Biceps","Rear delts"],
    steps: ["Hand on a bench, flat back, bell hanging.","Row the bell to your hip.","Lower to a full stretch."],
    mistake: "Twisting the torso to lift it.",
  },
  "Turkish Get-Up": {
    primary: ["Shoulders","Core"],
    secondary: ["Glutes","Hips"],
    steps: ["Lie down, bell pressed up, eyes on it.","Roll to elbow, hand, bridge, sweep the leg, kneel, stand.","Reverse every step back down."],
    mistake: "Losing sight of the bell or bending the arm.",
  },
  "Kettlebell Clean and Press": {
    primary: ["Shoulders","Glutes"],
    secondary: ["Triceps","Core","Hamstrings"],
    steps: ["Swing the bell back and pull it into the rack on your chest.","Brace and press it overhead.","Lower to the rack, then back between your legs."],
    mistake: "Letting the bell crash onto your forearm.",
  },
  "Kettlebell Halo": {
    primary: ["Shoulders"],
    secondary: ["Core","Upper back"],
    steps: ["Hold the bell upside down by the horns.","Circle it around your head, close to your neck.","Switch direction each rep."],
    mistake: "Arching the lower back.",
  },
  "Bosu Ski Jumps": {
    primary: ["Quads","Glutes"],
    secondary: ["Calves","Core"],
    steps: ["Stand beside the Bosu, feet together, knees soft.","Hop sideways onto the dome, land quietly in a quarter squat.","Hop off the far side and keep the rhythm going back and forth."],
    mistake: "Landing stiff-legged instead of absorbing through the hips and knees.",
  },
  "Bosu Single Leg Squat": {
    primary: ["Quads","Glutes"],
    secondary: ["Hamstrings","Core"],
    steps: ["Stand on one leg in the middle of the dome, hold a light bell at your chest.","Sit back and down as far as you can stay balanced.","Drive up through the whole foot, knee tracking over your toes."],
    mistake: "Letting the knee cave inward as you wobble.",
  },
  "Crow Pose": {
    primary: ["Core","Shoulders"],
    secondary: ["Wrists","Triceps"],
    steps: ["Squat, hands flat shoulder-width, fingers spread.","Bend elbows, put knees high on the backs of your upper arms.","Lean forward until your feet float, eyes ahead, and hold."],
    mistake: "Looking down at your feet, which tips you back out of it.",
  },
  "Kettlebell Front Squat": {
    primary: ["Quads","Glutes"],
    secondary: ["Core","Upper back"],
    steps: ["Clean the bell(s) to the rack, elbows tucked, wrists straight.","Sit down between your heels, chest tall.","Drive up through the whole foot to standing."],
    mistake: "Letting the elbows drop and the chest fold forward.",
  },
  "Single-Leg Kettlebell RDL": {
    primary: ["Hamstrings","Glutes"],
    secondary: ["Lower back","Core"],
    steps: ["Bell in the opposite hand to your standing leg, soft knee.","Hinge at the hip, back leg rising in line with your spine.","Squeeze the glute to stand back up, hips square."],
    mistake: "Rounding the back or letting the hips open to the side.",
  },
  "Push-Ups": {
    primary: ["Chest"],
    secondary: ["Triceps","Front delts","Core"],
    steps: ["Hands just outside shoulders, body in one straight line.","Lower until your chest nearly touches, elbows about 45°.","Press back up without letting the hips sag."],
    mistake: "Sagging hips or flaring elbows straight out.",
  },
  "Single-Arm Iso DB Press": {
    primary: ["Chest"],
    secondary: ["Triceps","Core"],
    steps: ["Lie on the bench, one dumbbell held locked out, the other pressing.","Hold one arm still at the top while the other does its reps.","Switch arms and repeat."],
    mistake: "Letting the held arm drift down or the torso twist.",
  },
  "Hanging Bicep Curls": {
    primary: ["Biceps"],
    secondary: ["Forearms"],
    steps: ["Let the dumbbells hang straight down, palms forward.","Curl up without moving your elbows forward.","Lower slowly to a full stretch."],
    mistake: "Swinging the body to get the weight up.",
  },
  "Zanetti Press": {
    primary: ["Shoulders"],
    secondary: ["Triceps", "Upper back", "Core"],
    steps: ["Sit on the floor, legs straight out, weights at your shoulders.", "Brace your core and press straight overhead without leaning back.", "Lower under control back to the shoulders."],
    mistake: "Leaning back or rounding the lower back to finish the rep.",
  },
  "Seated Overhead Press": {
    primary: ["Shoulders"],
    secondary: ["Triceps", "Upper chest"],
    steps: ["Sit tall on an upright bench, dumbbells at shoulder height.", "Press up until arms are straight, bells over your head.", "Lower slowly back to the shoulders."],
    mistake: "Arching off the back pad to push more weight.",
  },
  "Triceps Dips": {
    primary: ["Triceps"],
    secondary: ["Chest", "Front delts"],
    steps: ["Support yourself on the bars or bench, arms straight.", "Lower until your upper arms are about parallel to the floor.", "Press back up to straight arms."],
    mistake: "Dropping too deep and loading the front of the shoulder.",
  },
  "Chest Flies": {
    primary: ["Chest"],
    secondary: ["Front delts"],
    steps: ["Lie on a bench, dumbbells above your chest, slight bend in the elbows.", "Open your arms wide until you feel a chest stretch.", "Squeeze them back together over your chest."],
    mistake: "Bending the elbows so it turns into a press.",
  },
  "Skull Crushers": {
    primary: ["Triceps"],
    secondary: [],
    steps: ["Lie on a bench, weight above your chest, arms straight.", "Bend only at the elbows to lower it toward your forehead.", "Extend back up to straight arms."],
    mistake: "Letting the elbows flare out wide.",
  },
  "Standing Iso Dumbbell Curls": {
    primary: ["Biceps"],
    secondary: ["Forearms"],
    steps: ["Stand holding both dumbbells, curl one to 90\u00b0 and hold it there.", "Do your reps with the other arm.", "Switch arms and repeat."],
    mistake: "Letting the held arm sag below 90\u00b0.",
  },
  "Hamstring Machine Curl": {
    primary: ["Hamstrings"],
    secondary: ["Calves"],
    steps: ["Set the pad just above your heels, knees lined up with the machine's pivot.", "Curl your heels toward your glutes.", "Return slowly to straight legs."],
    mistake: "Lifting the hips off the seat or pad to finish the rep.",
  },
  "Single-Leg Press": {
    primary: ["Quads", "Glutes"],
    secondary: ["Hamstrings"],
    steps: ["One foot in the middle of the platform, the other off.", "Lower until your knee is at about 90\u00b0.", "Press back up without locking the knee."],
    mistake: "Letting the knee cave in or the hips lift off the seat.",
  },
  "Single-Leg Lunge": {
    primary: ["Quads", "Glutes"],
    secondary: ["Hamstrings", "Core"],
    steps: ["Hold the bell(s), step one foot back.", "Drop the back knee toward the floor, front shin near vertical.", "Drive through the front foot to stand."],
    mistake: "Front knee collapsing inward.",
  },
  "Clean Front Squat": {
    primary: ["Quads", "Glutes"],
    secondary: ["Hamstrings", "Upper back", "Core"],
    steps: ["Swing the bell back and clean it to the rack.", "Front squat with the bell racked, chest tall.", "Stand, lower the bell and repeat the clean."],
    mistake: "Letting the bell flop onto the forearm on the clean.",
  },
  "Round the World": {
    primary: ["Shoulders", "Core"],
    secondary: ["Upper back"],
    steps: ["Hold the bell by the handle at your chest.", "Pass it around your body or head in a smooth circle.", "Switch direction halfway through."],
    mistake: "Arching the lower back as the bell passes behind you.",
  },
  "Kettlebell Overhead March": {
    primary: ["Shoulders", "Core"],
    secondary: ["Hip flexors"],
    steps: ["Press the bell overhead and lock the arm out.", "March in place, knees up to hip height.", "Keep the bell stacked over your shoulder the whole time."],
    mistake: "Letting the arm drift forward or the torso lean.",
  },
  "Kettlebell Dead Bug": {
    primary: ["Core"],
    secondary: ["Hip flexors", "Shoulders"],
    steps: ["Lie on your back, bell pressed above your chest, knees bent at 90\u00b0.", "Lower one leg toward the floor, keeping your lower back down.", "Bring it back and switch legs."],
    mistake: "Lower back lifting off the floor.",
  },
  "Kneeling Woodchopper": {
    primary: ["Obliques", "Core"],
    secondary: ["Shoulders"],
    steps: ["Kneel side-on to the cable or bell, set high.", "Pull diagonally down across your body, turning through the torso.", "Return slowly to the start."],
    mistake: "Pulling with the arms instead of rotating through the trunk.",
  },
};

/** Library sections: one per program day, plus Kettlebell. */
export const LIBRARY_GROUPS: [string, string[]][] = [["Upper",["Bench Press","Chest-Supported Row","Standing Overhead Press","Lat Pulldown","High to Low Cable Flies","Lying Face Pulls / Skull Crushers","Seated Overhead Press","Shoulder Press + Overhead Superset"]],["Lower",["Front Squat","Deadlift","Barbell Hip Thrust","Single Leg Weighted Calf Raise","Leg Press Calf Raise","RDL","Hamstring Machine Curl","45-Degree Hip Hinge","Single-Leg Press","Single-Leg Lunge"]],["Push",["Incline Dumbbell Press","Flat Dumbbell Press","Lateral Raises","Banded Push-Ups","Overhead Rope Extensions","Bar Triceps Pushdowns","Single-Arm Iso DB Press","Zanetti Press","Chest Flies","Skull Crushers","Triceps Dips"]],["Pull",["Weighted Pull-Ups","Seated Row","Reverse Pec Deck","Kneeling Face Pulls","Incline Dumbbell Curls","Hammer Curls","Scapular Pull-Ups","Hanging Bicep Curls","Standing Iso Dumbbell Curls"]],["Legs",["Back Squat","Bulgarian Split Squat","Glute Ham Raise","Smith Machine Calf Raises","Seated Weighted Calf Raise"]],["Kettlebell",["Kettlebell Swing","Goblet Squat","Kettlebell Clean and Press","Single-Arm Kettlebell Row","Turkish Get-Up","Kettlebell Halo","Farmer Carry","Kettlebell Front Squat","Single-Leg Kettlebell RDL","Clean Front Squat","Round the World","Kettlebell Side Lifts","Kettlebell Overhead March"]],["Bodyweight & Bosu",["Push-Ups","Bosu Ski Jumps","Bosu Single Leg Squat","Bosu Round the World"]],["Core",["Kettlebell Dead Bug","Kneeling Woodchopper","Cable Oblique Extensions","Seated Linear Leg Lift"]]];

export const guideFor = (name: string): Guide | null => GUIDES[name] ?? null;

export const demoUrl = (name: string) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} proper form`)}`;

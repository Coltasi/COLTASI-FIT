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
};

/** Library sections: one per program day, plus Kettlebell. */
export const LIBRARY_GROUPS: [string, string[]][] = [["Upper",["Bench Press","Chest-Supported Row","Standing Overhead Press","Lat Pulldown","High to Low Cable Flies","Lying Face Pulls / Skull Crushers"]],["Lower",["Front Squat","Deadlift","Barbell Hip Thrust","Single Leg Weighted Calf Raise","Leg Press Calf Raise","RDL"]],["Push",["Incline Dumbbell Press","Flat Dumbbell Press","Lateral Raises","Banded Push-Ups","Overhead Rope Extensions","Bar Triceps Pushdowns"]],["Pull",["Weighted Pull-Ups","Seated Row","Reverse Pec Deck","Kneeling Face Pulls","Incline Dumbbell Curls","Hammer Curls","Scapular Pull-Ups"]],["Legs",["Back Squat","Bulgarian Split Squat","Glute Ham Raise","Smith Machine Calf Raises","Seated Weighted Calf Raise"]],["Kettlebell",["Kettlebell Swing","Goblet Squat","Kettlebell Clean and Press","Single-Arm Kettlebell Row","Turkish Get-Up","Kettlebell Halo","Farmer Carry"]]];

export const guideFor = (name: string): Guide | null => GUIDES[name] ?? null;

export const demoUrl = (name: string) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} proper form`)}`;

/**
 * Shapes of database rows as the app selects them (the Supabase client here is untyped).
 * Postgres numeric columns can arrive as strings, so those are `Num` and read with Number().
 */
import type { SetEffort } from "@/lib/set-effort";
import type { SkipReason } from "@/lib/owed";

export type Num = number | string;

export type SetRow = { id: string; set_no: number; weight_kg: Num | null; reps: number | null; done: boolean; effort?: SetEffort | null };
type Named = { name: string } | null;
/** One lift in a finished session, joined to its session and sets (for history and "last time"). */
export type HistoryRow = {
  id: string; exercise_id: string; session_id?: string; exercises?: Named;
  sessions: { session_date: string; status: string; started_at: string };
  session_sets: Pick<SetRow, "set_no" | "weight_kg" | "reps" | "done" | "effort">[] | null;
};
/** A lift inside a session, as the session screens select it. */
export type SessionLiftRow = {
  id: string; exercise_id: string; position: number; target_sets: number; rep_range: string | null;
  sub_for: string | null; added: boolean; one_off: boolean; skipped_reason: SkipReason | null; skill: boolean;
  exercises: Named; session_sets: SetRow[] | null;
};
export type WeighRow = { measured_on: string; weight_kg: Num };
export type NightRow = { night_of: string; hours: Num; wake_feeling: string | null; flags: string[] | null; note?: string | null };
export type FoodRow = { day: string; kcal: number; protein_g: Num };
/** The `signals` json a Coach read stores; only `lifts` is read back here. */
export type SignalsJson<L = unknown> = { lifts?: L[] } | null;

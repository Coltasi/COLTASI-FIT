import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditRow } from "./edit-row";

export default async function TrainSessionEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: session } = await supabase
    .from("workout_sessions")
    .select("id, split_day, completed_at")
    .eq("id", id)
    .single();

  if (!session) notFound();
  if (session.completed_at) redirect(`/train/session/${id}`);

  const { data: rows } = await supabase
    .from("session_exercises")
    .select("order_index, target_sets, target_rep_range, exercises(id, name)")
    .eq("session_id", id)
    .order("order_index");

  const items = (rows ?? [])
    .map((r) => ({
      ex: r.exercises as unknown as { id: string; name: string } | null,
      target_sets: r.target_sets,
      target_rep_range: r.target_rep_range,
    }))
    .filter((r): r is { ex: { id: string; name: string }; target_sets: number; target_rep_range: string | null } => !!r.ex);

  return (
    <div className="px-5 pt-[30px] pb-8">
      <div className="mb-4.5 flex items-center justify-between">
        <h1 className="font-display text-[22px] font-extrabold tracking-tight">
          Edit Workout
        </h1>
        <Link href={`/train/session/${id}`} className="text-blue text-[15px] font-semibold">
          Done
        </Link>
      </div>

      <div className="flex flex-col gap-2.5">
        {items.map(({ ex, target_sets, target_rep_range }, i) => (
          <EditRow
            key={ex.id}
            sessionId={id}
            exerciseId={ex.id}
            name={ex.name}
            targetLabel={target_rep_range ? `${target_sets} × ${target_rep_range}` : `${target_sets} sets`}
            isFirst={i === 0}
            isLast={i === items.length - 1}
          />
        ))}

        <Link
          href={`/train/session/${id}/edit/add`}
          className="border-muted-2 flex items-center justify-center gap-2 rounded-[14px] border border-dashed px-4 py-3.5 text-muted"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
          <span className="text-[13px]">Add exercise</span>
        </Link>
      </div>

      <p className="text-muted mt-3.5 text-center text-[13px]">
        Use the arrows to reorder, tap the red circle to remove. Tap Done when
        you&apos;re finished.
      </p>
    </div>
  );
}

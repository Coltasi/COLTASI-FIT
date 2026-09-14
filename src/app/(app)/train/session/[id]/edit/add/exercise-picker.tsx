"use client";

import { useState } from "react";
import { AddExerciseRow } from "./add-exercise-row";

export function ExercisePicker({
  sessionId,
  exercises,
}: {
  sessionId: string;
  exercises: { id: string; name: string; modality: string | null }[];
}) {
  const [query, setQuery] = useState("");

  const filtered = exercises.filter((ex) =>
    ex.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <>
      <input
        type="text"
        placeholder="Search exercises…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="border-border mb-4 w-full rounded-xl border bg-surface px-4 py-3 text-[15px]"
      />
      <div className="flex flex-col gap-2.5">
        {filtered.map((ex) => (
          <AddExerciseRow
            key={ex.id}
            sessionId={sessionId}
            exerciseId={ex.id}
            name={ex.name}
            modality={ex.modality}
          />
        ))}
        {filtered.length === 0 && (
          <p className="text-muted py-6 text-center text-[14px]">
            No exercises match &ldquo;{query}&rdquo;.
          </p>
        )}
      </div>
    </>
  );
}

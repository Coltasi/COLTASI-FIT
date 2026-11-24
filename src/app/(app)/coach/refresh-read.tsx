"use client";

import { useTransition } from "react";
import { refreshRead } from "./actions";

/** Rebuilds the latest read from current data (e.g. after logging last night's sleep). */
export function RefreshRead() {
  const [pending, start] = useTransition();
  return (
    <div>
      <button type="button" className="btn2" title="Rewrites the latest insight using everything you have logged since" disabled={pending} onClick={() => start(() => refreshRead())}>
        {pending ? "Updating…" : "Update with new data"}
      </button>
    </div>
  );
}

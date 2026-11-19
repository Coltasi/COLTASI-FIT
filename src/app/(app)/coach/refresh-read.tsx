"use client";

import { useTransition } from "react";
import { refreshRead } from "./actions";

/** Rebuilds the latest read from current data (e.g. after logging last night's sleep). */
export function RefreshRead() {
  const [pending, start] = useTransition();
  return (
    <div style={{ textAlign: "right", margin: "4px 0 8px" }}>
      <button type="button" className="btn2" style={{ height: 32, fontSize: 13 }} disabled={pending} onClick={() => start(() => refreshRead())}>
        {pending ? "Refreshing…" : "Refresh read"}
      </button>
    </div>
  );
}

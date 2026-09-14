"use client";

import { useState, type ReactNode } from "react";

export function ProgressTabs({ body, lifting }: { body: ReactNode; lifting: ReactNode }) {
  const [tab, setTab] = useState<"body" | "lifting">("body");

  return (
    <>
      <div className="bg-border mb-4.5 flex rounded-xl p-1 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        <button
          type="button"
          onClick={() => setTab("body")}
          className={`flex-1 rounded-[9px] py-2 text-sm font-semibold ${
            tab === "body" ? "bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.06)]" : "text-muted"
          }`}
        >
          Body
        </button>
        <button
          type="button"
          onClick={() => setTab("lifting")}
          className={`flex-1 rounded-[9px] py-2 text-sm font-semibold ${
            tab === "lifting" ? "bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.06)]" : "text-muted"
          }`}
        >
          Lifting
        </button>
      </div>
      {tab === "body" ? body : lifting}
    </>
  );
}

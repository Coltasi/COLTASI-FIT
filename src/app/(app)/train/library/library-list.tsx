"use client";

import Link from "next/link";
import { useState } from "react";
import { IconChevron } from "@/components/icons";
import { GUIDES } from "@/lib/exercise-guides";

export function LibraryList({ groups }: { groups: { name: string; items: { id: string; name: string }[] }[] }) {
  const [q, setQ] = useState("");
  const query = q.toLowerCase().trim();
  const shown = groups
    .map((g) => ({
      ...g,
      items: g.items.filter((x) => {
        if (!query) return true;
        const guide = GUIDES[x.name];
        return x.name.toLowerCase().includes(query) || [...(guide?.primary ?? []), ...(guide?.secondary ?? [])].join(" ").toLowerCase().includes(query);
      }),
    }))
    .filter((g) => g.items.length);

  return (
    <>
      <label><span className="sr-only">Search lifts or muscles</span>
        <input className="fld" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search lifts or muscles" autoComplete="off" />
      </label>
      {shown.map((g) => (
        <div key={g.name} className="card clip">
          <div style={{ padding: "12px 16px 8px" }}><p className="lab">{g.name}</p></div>
          {g.items.map((x) => (
            <Link key={x.id} href={`/train/library/${x.id}`} className="row" style={{ borderTop: "1px solid var(--line-soft)" }}>
              <div style={{ flexGrow: 1, minWidth: 0 }}>
                <p className="ln">{x.name}</p>
                <p className="cap">{GUIDES[x.name]?.primary.join(", ")}</p>
              </div>
              <IconChevron style={{ flexShrink: 0 }} />
            </Link>
          ))}
        </div>
      ))}
      {!shown.length ? <p className="cap" style={{ textAlign: "center", marginTop: 12 }}>No lifts match that search.</p> : null}
    </>
  );
}

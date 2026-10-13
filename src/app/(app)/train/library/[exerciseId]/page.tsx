import { notFound } from "next/navigation";
import { BackHeader } from "@/components/ui";
import { IconPlay } from "@/components/icons";
import { getContext } from "@/lib/data";
import { demoUrl, guideFor } from "@/lib/exercise-guides";

export default async function HowToPage({ params, searchParams }: PageProps<"/train/library/[exerciseId]">) {
  const [{ exerciseId }, sp] = await Promise.all([params, searchParams]);
  const { supabase } = await getContext();
  const { data: ex } = await supabase.from("exercises").select("id, name").eq("id", exerciseId).maybeSingle();
  if (!ex) notFound();
  const g = guideFor(ex.name);
  // Opened from a live session's "How to" link: go back to that session.
  const from = typeof sp.from === "string" && /^[0-9a-f-]{36}$/.test(sp.from) ? sp.from : null;

  return (
    <main className="screen">
      <BackHeader href={from ? `/train/session/${from}` : "/train/library"} label={from ? "session" : "Exercise library"} eyebrow="How to" title={ex.name} />

      {g ? (
        <>
          <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <p className="lab">Muscles worked</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {g.primary.map((m) => <span key={m} style={{ fontSize: 12, fontWeight: 700, padding: "5px 10px", borderRadius: 999, background: "var(--navy)", color: "#fff" }}>{m}</span>)}
              {g.secondary.map((m) => <span key={m} style={{ fontSize: 12, fontWeight: 600, padding: "5px 10px", borderRadius: 999, background: "var(--tint-blue)", color: "var(--kingfisher-text)" }}>{m}</span>)}
            </div>
            <p className="cap" style={{ fontSize: 12 }}>Dark = main muscles · Blue = also working</p>
          </div>

          <div className="card clip">
            <div style={{ padding: "14px 16px 6px" }}><p className="lab">Steps</p></div>
            {g.steps.map((t, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "26px minmax(0,1fr)", gap: 10, padding: "10px 16px", borderTop: i ? "1px solid var(--line-soft)" : undefined }}>
                <span style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--tint-ember)", color: "var(--rust)", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                <p style={{ fontSize: 14, lineHeight: 1.45 }}>{t}</p>
              </div>
            ))}
          </div>

          <div className="card cream" style={{ padding: "14px 16px" }}>
            <p className="lab" style={{ color: "var(--rust)" }}>Common mistake</p>
            <p style={{ fontSize: 14, lineHeight: 1.45, marginTop: 4 }}>{g.mistake}</p>
          </div>
        </>
      ) : (
        <p className="cap">No guide for this lift yet. The demo search below still works.</p>
      )}

      <a href={demoUrl(ex.name)} target="_blank" rel="noopener noreferrer" className="btn" style={{ gap: 8 }}>
        <IconPlay />Watch a demo
      </a>
      <p className="cap" style={{ fontSize: 12, textAlign: "center", marginTop: -8 }}>Opens YouTube search results for this lift</p>
    </main>
  );
}

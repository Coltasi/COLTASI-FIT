/** Instant placeholder shown the moment you tap, while the next screen loads. */
export default function Loading() {
  const block = (h: number, w: string = "100%") => (
    <div style={{ height: h, width: w, borderRadius: 14, background: "var(--line-soft)", animation: "pulse 1.2s ease-in-out infinite" }} />
  );
  return (
    <main className="screen" aria-busy="true" aria-label="Loading">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.55}}`}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/coltasi-bird.svg" alt="" width={34} height={34} />
        <span className="disp" style={{ fontSize: 14, letterSpacing: "0.08em", textTransform: "uppercase" }}>Coltasi</span>
      </div>
      {block(34, "45%")}
      {block(64)}
      {block(120)}
      {block(220)}
    </main>
  );
}

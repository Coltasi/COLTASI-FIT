import Link from "next/link";
import type { ReactNode } from "react";
import { IconBack } from "./icons";

/** Compact brand line: small bird + wordmark. Prominent branding is kept for login and onboarding. */
export function BrandRow({ right }: { right?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 44 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/coltasi-bird.svg" alt="" width={30} height={30} />
        <span className="disp" style={{ fontSize: 15, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 800 }}>Coltasi Fit</span>
      </div>
      {right}
    </div>
  );
}

/** Tab-level page header: brand line, big title, optional context line under it. */
export function PageHeader({ title, sub, right, above }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; above?: ReactNode }) {
  return (
    <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <BrandRow right={right} />
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
        {above ? <p className="cap" style={{ fontSize: 16 }}>{above}</p> : null}
        <h1 className="ptitle">{title}</h1>
        {sub ? <div className="cap" style={{ fontSize: 16 }}>{sub}</div> : null}
      </div>
    </header>
  );
}

/** Section heading with an optional right-hand link or summary. */
export function Section({ title, right, children, gap = 12 }: { title: ReactNode; right?: ReactNode; children: ReactNode; gap?: number }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <h2 className="sec">{title}</h2>
        {right ? <div style={{ fontSize: 15, fontWeight: 600 }}>{right}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function BackHeader({ href, label, eyebrow, title, eyebrowColor }: {
  href: string; label: string; eyebrow?: string; title: string; eyebrowColor?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <Link href={href} className="iconbtn" aria-label={`Back to ${label}`}><IconBack /></Link>
      <div>
        {eyebrow ? <p className="lab" style={eyebrowColor ? { color: eyebrowColor } : undefined}>{eyebrow}</p> : null}
        <h1 className="disp" style={{ fontSize: 26, lineHeight: 1.15, marginTop: eyebrow ? 2 : 0 }}>{title}</h1>
      </div>
    </div>
  );
}

export function CoachMark({ size = 22 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/coltasi-bird.svg" alt="" width={size} height={size} />;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="sec" style={{ margin: "4px 0 6px" }}>{children}</h2>;
}

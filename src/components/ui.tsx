import Link from "next/link";
import type { ReactNode } from "react";
import { IconBack } from "./icons";

export function BrandRow({ right }: { right?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: -4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/coltasi-bird.svg" alt="" width={34} height={34} />
        <span className="disp" style={{ fontSize: 14, letterSpacing: "0.08em", textTransform: "uppercase" }}>Coltasi</span>
      </div>
      {right}
    </div>
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
        <h1 className="disp" style={{ fontSize: 26, marginTop: eyebrow ? 2 : 0 }}>{title}</h1>
      </div>
    </div>
  );
}

export function CoachMark({ size = 22 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/coltasi-bird.svg" alt="" width={size} height={size} />;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="lab" style={{ margin: "0 0 8px 4px" }}>{children}</p>;
}

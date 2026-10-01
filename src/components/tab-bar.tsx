"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconCoach, IconHome, IconProgress, IconTrain } from "./icons";

const TABS = [
  { href: "/", label: "Overview", Icon: IconHome, match: (p: string) => p === "/" || p.startsWith("/sleep") || p.startsWith("/settings") },
  { href: "/train", label: "Train", Icon: IconTrain, match: (p: string) => p.startsWith("/train") },
  { href: "/progress", label: "Progress", Icon: IconProgress, match: (p: string) => p.startsWith("/progress") },
  { href: "/coach", label: "Coach", Icon: IconCoach, match: (p: string) => p.startsWith("/coach") },
];

export function TabBar() {
  const path = usePathname();
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map(({ href, label, Icon, match }) => {
        const on = match(path);
        return (
          <Link key={href} href={href} className={`tab${on ? " on" : ""}`} aria-current={on ? "page" : undefined}>
            <Icon size={22} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

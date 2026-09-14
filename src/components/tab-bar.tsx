"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  {
    href: "/",
    label: "Overview",
    icon: (
      <>
        <path d="M4 11.5 12 4l8 7.5" />
        <path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" />
      </>
    ),
  },
  {
    href: "/train",
    label: "Train",
    icon: (
      <>
        <path d="M4 9v6" />
        <path d="M2 10v4" />
        <path d="M20 10v4" />
        <path d="M22 9v6" />
        <path d="M6 12h12" />
        <rect x="4" y="8" width="4" height="8" rx="1" />
        <rect x="16" y="8" width="4" height="8" rx="1" />
      </>
    ),
  },
  {
    href: "/log",
    label: "Log",
    icon: (
      <>
        <path d="M3 3v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3" />
        <path d="M5 12v9" />
        <path d="M19 3c-1.7 0-3 2-3 5s1.3 5 3 5" />
        <path d="M19 3v18" />
      </>
    ),
  },
  {
    href: "/progress",
    label: "Progress",
    icon: (
      <>
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="M7 15l4-4 3 3 5-6" />
      </>
    ),
  },
  {
    href: "/coach",
    label: "Coach",
    icon: <path d="M4 5h16v11H8l-4 4V5Z" />,
  },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="border-border bg-surface fixed inset-x-0 bottom-0 h-[72px] border-t">
      <div className="mx-auto flex h-full w-full max-w-md items-center">
        {tabs.map((tab) => {
          const active =
            tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-1 flex-col items-center gap-1 text-[11px] font-semibold ${
                active ? "text-blue" : "text-muted-2"
              }`}
            >
              <svg
                width="21"
                height="21"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {tab.icon}
              </svg>
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 20): SVGProps<SVGSVGElement> => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true,
});

export const IconHome = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M4 11.5 12 4l8 7.5" /><path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" /></svg>
);
export const IconTrain = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M4 9v6" /><path d="M2 10v4" /><path d="M20 10v4" /><path d="M22 9v6" /><path d="M6 12h12" /><rect x="4" y="8" width="4" height="8" rx="1" /><rect x="16" y="8" width="4" height="8" rx="1" /></svg>
);
export const IconProgress = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M4 19V5" /><path d="M4 19h16" /><path d="M7 15l4-4 3 3 5-6" /></svg>
);
export const IconCoach = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M4 5h16v11H8l-4 4V5Z" /></svg>
);
export const IconClock = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
);
export const IconBack = ({ size, ...p }: P) => (
  <svg {...base(size)} strokeWidth={2} {...p}><path d="m15 6-6 6 6 6" /></svg>
);
export const IconChevron = ({ size = 18, ...p }: P) => (
  <svg {...base(size)} stroke="#7F8383" strokeWidth={2} {...p}><path d="m9 6 6 6-6 6" /></svg>
);
export const IconCheck = ({ size = 16, ...p }: P) => (
  <svg {...base(size)} strokeWidth={2.8} {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
);
export const IconPlus = ({ size = 16, ...p }: P) => (
  <svg {...base(size)} strokeWidth={2.4} {...p}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconMinus = ({ size = 12, ...p }: P) => (
  <svg {...base(size)} strokeWidth={3.2} {...p}><path d="M5 12h14" /></svg>
);
export const IconLock = ({ size = 18, ...p }: P) => (
  <svg {...base(size)} {...p}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
);
export const IconUp = ({ size = 18, ...p }: P) => (
  <svg {...base(size)} strokeWidth={2} {...p}><path d="m6 15 6-6 6 6" /></svg>
);
export const IconDown = ({ size = 18, ...p }: P) => (
  <svg {...base(size)} strokeWidth={2} {...p}><path d="m6 9 6 6 6-6" /></svg>
);
export const IconSend = ({ size = 20, ...p }: P) => (
  <svg {...base(size)} strokeWidth={2.2} {...p}><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></svg>
);
export const IconDoc = ({ size = 18, ...p }: P) => (
  <svg {...base(size)} {...p}><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M8 9h8M8 13h5" /></svg>
);
export const IconGear = ({ size = 20, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></svg>
);
export const IconPen = ({ size = 16, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></svg>
);

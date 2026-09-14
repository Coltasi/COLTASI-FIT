import Link from "next/link";

export default function SettingsAboutPage() {
  return (
    <div className="px-5 pt-[24px] pb-8">
      <div className="flex items-center gap-2.5">
        <Link href="/settings">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <span className="text-muted text-[15px]">Settings</span>
      </div>
      <h1 className="font-display mt-1 mb-5 text-2xl font-extrabold tracking-tight">
        About Coltasi Fit
      </h1>

      <div className="border-border bg-surface flex flex-col gap-4 rounded-xl border px-4 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_rgba(0,0,0,0.03)]">
        <p className="text-[14px] leading-relaxed">
          Coltasi Fit is a personal app built to follow the Built With Science
          intermediate program: training, nutrition targets, and body-comp
          tracking from Tanita scans in one place.
        </p>
        <p className="text-[14px] leading-relaxed text-muted">
          Nutrition targets are calculated from your logged Tanita scans
          using the same TDEE and macro formulas as the original Built With
          Science spreadsheet.
        </p>
        <p className="text-[13px] text-muted">
          Built for the Constantine household. Not a commercial product, no
          support line — if something looks wrong, just say so.
        </p>
      </div>
    </div>
  );
}

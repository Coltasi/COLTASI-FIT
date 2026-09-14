import Link from "next/link";

export function ComingSoon({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <h1 className="font-display mb-2 text-2xl font-extrabold tracking-tight">
        {title}
      </h1>
      <p className="text-muted mb-6 max-w-xs text-sm leading-relaxed">
        {description}
      </p>
      <Link href="/" className="text-blue text-sm font-semibold">
        ← Back to Overview
      </Link>
    </div>
  );
}

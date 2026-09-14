import Link from "next/link";

export default function CheckEmailPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-14 text-center">
      <h1 className="font-display mb-2 text-2xl font-extrabold tracking-tight">
        Check your email
      </h1>
      <p className="text-muted mb-6 max-w-xs text-sm leading-relaxed">
        We sent you a confirmation link. Open it to activate your account,
        then come back and log in.
      </p>
      <Link href="/login" className="text-blue text-sm font-semibold">
        Back to log in
      </Link>
    </div>
  );
}

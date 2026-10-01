import Link from "next/link";

export default function CheckEmailPage() {
  return (
    <main className="screen no-tabs" style={{ padding: "22px 24px 40px", gap: 18, alignItems: "center", textAlign: "center" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/coltasi-bird.svg" alt="" width={88} height={88} style={{ marginTop: 48 }} />
      <h1 className="disp" style={{ fontSize: 26 }}>Check your email</h1>
      <p className="cap" style={{ fontSize: 15, lineHeight: 1.5 }}>We sent you a link to confirm your account. Open it on this phone and you&apos;ll land straight in the app.</p>
      <Link href="/login" style={{ fontWeight: 600 }}>Back to log in</Link>
    </main>
  );
}

import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata = { title: "Log in · Coltasi Fit" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const notice = sp.error === "confirmation_failed" ? "That confirmation link didn't work. Try logging in, or sign up again." : undefined;
  return (
    <main className="screen no-tabs" style={{ padding: "22px 24px 40px", gap: 24, minHeight: "100dvh" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginTop: 36 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/coltasi-bird.svg" alt="" width={104} height={104} />
        <span className="disp" style={{ fontSize: 18, letterSpacing: "0.1em", textTransform: "uppercase" }}>Coltasi Fit</span>
      </div>
      <h1 className="disp" style={{ fontSize: 26, textAlign: "center" }}>Welcome back</h1>
      <LoginForm notice={notice} />
      <p className="cap" style={{ textAlign: "center", marginTop: "auto" }}>New here? <Link href="/signup" style={{ fontWeight: 600 }}>Create an account</Link></p>
    </main>
  );
}

import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata = { title: "Coltasi · Track every lift. See every gain." };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const notice = sp.error === "confirmation_failed" ? "That confirmation link didn't work. Try logging in, or sign up again." : undefined;
  return (
    <main className="screen no-tabs" style={{ padding: "22px 24px 40px", gap: 24, minHeight: "100dvh" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginTop: 36 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/coltasi-bird.svg" alt="" width={104} height={104} />
        <span className="disp" style={{ fontSize: 18, letterSpacing: "0.1em", textTransform: "uppercase" }}>Coltasi</span>
        <p className="disp" style={{ fontSize: 22, textAlign: "center", color: "var(--rust)", marginTop: 6 }}>Track every lift. See every gain.</p>
        <p className="cap" style={{ textAlign: "center", maxWidth: 290, lineHeight: 1.45 }}>Log your workouts, weigh-ins and sleep, and watch your strength and body change week by week.</p>
      </div>
      <h1 className="disp" style={{ fontSize: 26, textAlign: "center" }}>Welcome back</h1>
      <LoginForm notice={notice} />
      <p className="cap" style={{ textAlign: "center", marginTop: "auto" }}>New here? <Link href="/signup" style={{ fontWeight: 600 }}>Create an account</Link></p>
    </main>
  );
}

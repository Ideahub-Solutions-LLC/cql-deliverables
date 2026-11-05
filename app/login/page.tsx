import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "../../lib/auth";
import LoginForm from "./login-form";
import Link from "next/link";
import "./login.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in · DSI Daily Delivery" };

export default async function LoginPage() {
  if (await getAuthenticatedUser()) redirect("/");
  return (
    <main className="login-page">
      <div className="login-art" aria-hidden="true">
        <div className="art-orbit orbit-one" />
        <div className="art-orbit orbit-two" />
        <div className="art-orbit orbit-three" />
        <div className="art-caption"><span /> A shared record for the work that moves us forward</div>
      </div>
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-brand">
          <img className="login-mark-image" src="/ideahub-icon.png" alt="iDeaHub"/>
          <div><strong>Daily Delivery</strong><small>IDEAHUB</small></div>
        </div>
        <div className="login-copy">
          <span className="login-kicker">TEAM WORKSPACE</span>
          <h1 id="login-title">Good work starts<br />with a clear view.</h1>
          <p>Sign in to see your commitments, share progress, and keep every handoff accountable.</p>
        </div>
        <LoginForm />
        <Link className="signup-link" href="/signup">New here? Create an account</Link>
        <footer className="login-footer"><span>Private to the DSI delivery team</span><span>Access is based on your assigned role</span></footer>
      </section>
    </main>
  );
}

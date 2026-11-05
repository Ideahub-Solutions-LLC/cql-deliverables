import type { Metadata } from "next";
import Link from "next/link";
import SignupForm from "./signup-form";

export const metadata: Metadata = { title: "Create account · DSI Daily Delivery" };
export default function SignupPage(){return <main className="login-page"><div className="login-art" aria-hidden="true"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="art-orbit orbit-three"/><div className="art-caption"><span/>A shared record for the work that moves us forward</div></div><section className="login-panel signup-panel"><div className="login-brand"><div className="login-mark">D<span>S</span>I</div><div><strong>Daily Delivery</strong><small>IDEAHUB</small></div></div><div className="login-copy"><span className="login-kicker">CREATE ACCOUNT</span><h1>Join your team.</h1><p>New accounts stay disabled until an Admin or Reviewer enables access.</p></div><SignupForm/><Link className="signup-link" href="/login">Back to sign in</Link></section></main>}

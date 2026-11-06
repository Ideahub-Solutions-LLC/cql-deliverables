import { env } from "cloudflare:workers";
import {
  PASSWORD_ITERATIONS,
  SESSION_SECONDS,
  passwordDigest,
  randomHex,
  sessionCookie,
  sha256Hex,
  verifyPassword,
} from "../../../../lib/auth";

export const dynamic = "force-dynamic";
const dummySalt = "d42935db16c7e4611a540437cd0780b1";
const dummyHash = "0000000000000000000000000000000000000000000000000000000000000000";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).origin !== new URL(request.url).origin) {
    return Response.json({ error: "This sign-in request could not be verified." }, { status: 403 });
  }
  if (!env.DB) return Response.json({ error: "Sign-in is not configured on this environment." }, { status: 503 });

  let body: { username?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Enter your username and password." }, { status: 400 });
  }
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!/^[a-z0-9_.-]{2,40}$/.test(username) || password.length < 1 || password.length > 256) {
    await passwordDigest(password.slice(0, 256), dummySalt, PASSWORD_ITERATIONS);
    return Response.json({ error: "The username or password is incorrect." }, { status: 401 });
  }


  const account = await env.DB!.prepare(
    "SELECT username, display_name, role, password_salt, password_hash, password_iterations, active FROM delivery_users WHERE username = ?",
  ).bind(username).first<{
    username: string;
    display_name: string;
    role: string;
    password_salt: string;
    password_hash: string;
    password_iterations: number;
    active: number;
  }>();

  const matches = account
    ? await verifyPassword(password, account.password_salt, account.password_hash, account.password_iterations)
    : (await passwordDigest(password, dummySalt, PASSWORD_ITERATIONS)) === dummyHash;
  if (!account || !account.active || !matches) {
    return Response.json({ error: "The username or password is incorrect." }, { status: 401 });
  }

  const token = randomHex(32);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_SECONDS * 1000).toISOString();
  await env.DB!.batch([
    env.DB!.prepare("DELETE FROM delivery_sessions WHERE expires_at <= ?").bind(now.toISOString()),
    env.DB!.prepare("INSERT INTO delivery_sessions (token_hash, username, workspace_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(await sha256Hex(token), account.username, null, expiresAt, now.toISOString()),
  ]);

  return Response.json(
    { user: { username: account.username, displayName: account.display_name, role: account.role, workspace: null } },
    { headers: { "Cache-Control": "no-store", "Set-Cookie": sessionCookie(token, request.url) } },
  );
}

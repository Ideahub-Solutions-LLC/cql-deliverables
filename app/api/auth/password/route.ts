import { env } from "cloudflare:workers";
import { getAuthenticatedUser, PASSWORD_ITERATIONS, passwordDigest, randomHex, verifyPassword } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return Response.json({ error: "Sign in to change your password." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).origin !== new URL(request.url).origin) return Response.json({ error: "Cross-origin password changes are not allowed." }, { status: 403 });
  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: "Complete the password form." }, { status: 400 }); }
  const current = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const next = typeof body.newPassword === "string" ? body.newPassword : "";
  if (next !== body.confirmPassword) return Response.json({ error: "New password and confirmation do not match." }, { status: 400 });
  if (next.length < 12 || next.length > 256 || !/[a-z]/.test(next) || !/[A-Z]/.test(next) || !/\d/.test(next) || !/[^A-Za-z0-9]/.test(next)) return Response.json({ error: "Use a strong password with at least 12 characters, upper and lower case letters, a number, and a symbol." }, { status: 400 });
  const row = await env.DB!.prepare("SELECT password_salt, password_hash, password_iterations FROM delivery_users WHERE username=?").bind(user.username).first<any>();
  if (!row || !(await verifyPassword(current, row.password_salt, row.password_hash, row.password_iterations))) return Response.json({ error: "Current password is incorrect." }, { status: 403 });
  const salt = randomHex(16), hash = await passwordDigest(next, salt, PASSWORD_ITERATIONS);
  await env.DB!.prepare("UPDATE delivery_users SET password_salt=?, password_hash=?, password_iterations=? WHERE username=?").bind(salt, hash, PASSWORD_ITERATIONS, user.username).run();
  return Response.json({ ok: true });
}

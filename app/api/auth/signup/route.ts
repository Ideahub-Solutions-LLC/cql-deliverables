import { env } from "cloudflare:workers";
import { PASSWORD_ITERATIONS, passwordDigest, randomHex } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).origin !== new URL(request.url).origin) return Response.json({ error: "This request could not be verified." }, { status: 403 });
  if (!env.DB) return Response.json({ error: "Sign-up is not configured." }, { status: 503 });
  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: "Complete the sign-up form." }, { status: 400 }); }
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (body.confirmPassword !== password) return Response.json({ error: "Password and confirmation do not match." }, { status: 400 });
  if (!/^[a-z0-9_.-]{3,40}$/.test(username) || !firstName || firstName.length > 80 || !lastName || lastName.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return Response.json({ error: "Enter a valid username, email, first name, and last name." }, { status: 400 });
  }
  if (password.length < 12 || password.length > 256 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return Response.json({ error: "Use a strong password with at least 12 characters, upper and lower case letters, a number, and a symbol." }, { status: 400 });
  }
  const salt = randomHex(16);
  const hash = await passwordDigest(password, salt, PASSWORD_ITERATIONS);
  const displayName = `${firstName} ${lastName}`.trim();
  try {
    await env.DB!.prepare(`INSERT INTO delivery_users (username, display_name, role, person_id, password_salt, password_hash, password_iterations, active, email, first_name, last_name, timezone, theme_mode)
      VALUES (?, ?, 'staff', NULL, ?, ?, ?, 0, ?, ?, ?, 'PST', 'default')`)
      .bind(username, displayName, salt, hash, PASSWORD_ITERATIONS, email, firstName, lastName).run();
  } catch (error) {
    if (String(error).includes("UNIQUE")) return Response.json({ error: "That username or email is already registered." }, { status: 409 });
    throw error;
  }
  return Response.json({ ok: true, message: "Sign-up received. An Admin or Reviewer must enable your account before you can sign in." }, { status: 201 });
}

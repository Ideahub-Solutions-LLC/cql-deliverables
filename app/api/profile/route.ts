import { env } from "cloudflare:workers";
import { getAuthenticatedUser } from "../../../lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return Response.json({ error: "Sign in to view your profile." }, { status: 401 });
  return Response.json({ user }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return Response.json({ error: "Sign in to update your profile." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).origin !== new URL(request.url).origin) return Response.json({ error: "Cross-origin profile changes are not allowed." }, { status: 403 });
  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: "Review your profile details." }, { status: 400 }); }
  const first = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const last = typeof body.lastName === "string" ? body.lastName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const timezone = body.timezone;
  const theme = body.themeMode;
  const avatar = body.avatarData == null ? null : String(body.avatarData);
  if (!first || first.length > 80 || last.length > 80 || (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254))) return Response.json({ error: "Enter valid names and email." }, { status: 400 });
  if (!['PDT','PST','PHT'].includes(timezone) || !['default','dark','light'].includes(theme)) return Response.json({ error: "Choose a valid timezone and theme." }, { status: 400 });
  if (avatar && (!/^data:image\/(png|jpeg|webp|gif);base64,/.test(avatar) || avatar.length > 700_000)) return Response.json({ error: "Choose an image smaller than 500 KB in PNG, JPG, WEBP, or GIF format." }, { status: 400 });
  try {
    await env.DB!.prepare("UPDATE delivery_users SET first_name=?, last_name=?, display_name=?, email=?, avatar_data=?, timezone=?, theme_mode=? WHERE username=?")
      .bind(first, last, `${first} ${last}`, email || null, avatar, timezone, theme, user.username).run();
  } catch (error) {
    if (String(error).includes("UNIQUE")) return Response.json({ error: "That email is already assigned to another account." }, { status: 409 });
    throw error;
  }
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}

import { env } from "cloudflare:workers";
import { getAuthenticatedUser } from "../../../lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return Response.json({ error: "Sign in to view the team." }, { status: 401 });
  const privileged = user.role === "admin" || user.role === "reviewer";
  const result = privileged
    ? await env.DB!.prepare(`SELECT username, display_name AS displayName, role, active, email,
        first_name AS firstName, last_name AS lastName, timezone, theme_mode AS themeMode, avatar_data AS avatarData
      FROM delivery_users ORDER BY display_name`).all()
    : await env.DB!.prepare(`SELECT username, display_name AS displayName, role, active, avatar_data AS avatarData
      FROM delivery_users WHERE active=1 ORDER BY display_name`).all();
  return Response.json({ users: result.results ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

import { env } from "cloudflare:workers";
import { getAuthenticatedUser, readCookie, SESSION_COOKIE, sha256Hex } from "../../lib/auth";

export const dynamic = "force-dynamic";

// Explicit dashboard navigation clears the selected workspace and project.
export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return Response.redirect(new URL("/login", request.url), 303);
  const token = readCookie(request.headers.get("cookie") ?? "", SESSION_COOKIE)!;
  await env.DB!.prepare("UPDATE delivery_sessions SET workspace_id = NULL WHERE token_hash = ?")
    .bind(await sha256Hex(token)).run();
  return new Response(null, { status: 303, headers: { Location: new URL("/", request.url).href, "Cache-Control": "no-store" } });
}

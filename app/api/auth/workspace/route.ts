import { env } from "cloudflare:workers";
import { getAuthenticatedUser, readCookie, SESSION_COOKIE, sha256Hex } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return Response.json({ error: "Sign in to switch workspaces." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).origin !== new URL(request.url).origin) {
    return Response.json({ error: "Cross-origin workspace changes are not allowed." }, { status: 403 });
  }
  let body: { workspaceId?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Choose a workspace." }, { status: 400 }); }
  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
  if (!/^[a-z0-9-]{2,80}$/.test(workspaceId)) return Response.json({ error: "Choose a valid workspace." }, { status: 400 });
  const workspace = await env.DB!.prepare("SELECT id FROM workspaces WHERE id = ? AND active = 1").bind(workspaceId).first();
  if (!workspace) return Response.json({ error: "That workspace is unavailable." }, { status: 404 });
  const token = readCookie(request.headers.get("cookie") ?? "", SESSION_COOKIE);
  if (!token) return Response.json({ error: "Sign in to switch workspaces." }, { status: 401 });
  await env.DB!.prepare("UPDATE delivery_sessions SET workspace_id = ? WHERE token_hash = ?")
    .bind(workspaceId, await sha256Hex(token)).run();
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}

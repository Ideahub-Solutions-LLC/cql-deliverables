import { env } from "cloudflare:workers";
import { getAuthenticatedUser, readCookie, SESSION_COOKIE, sha256Hex } from "../../../lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!env.DB) return Response.json({ error: "Workspace sign-in is not configured." }, { status: 503 });
  const result = await env.DB!.prepare(
    "SELECT id, name FROM workspaces WHERE active = 1 ORDER BY sort_order, name",
  ).all<{ id: string; name: string }>();
  return Response.json({ workspaces: result.results ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return Response.json({ error: "Sign in to add a workspace." }, { status: 401 });
  if (user.role !== "admin" && user.role !== "reviewer") {
    return Response.json({ error: "Only an administrator or reviewer can add a workspace." }, { status: 403 });
  }
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).origin !== new URL(request.url).origin) {
    return Response.json({ error: "Cross-origin workspace changes are not allowed." }, { status: 403 });
  }
  let body: { name?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Enter a workspace name." }, { status: 400 }); }
  const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  if (name.length < 2 || name.length > 100) {
    return Response.json({ error: "Workspace names must be between 2 and 100 characters." }, { status: 400 });
  }
  const id = `workspace-${crypto.randomUUID()}`;
  const created = await env.DB!.prepare("SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM workspaces").first<{ next_order: number }>();
  try {
    await env.DB!.prepare("INSERT INTO workspaces (id, name, sort_order, active) VALUES (?, ?, ?, 1)")
      .bind(id, name, created?.next_order ?? 1).run();
  } catch (error) {
    if (String(error).includes("UNIQUE")) return Response.json({ error: "A workspace with that name already exists." }, { status: 409 });
    throw error;
  }
  const token = readCookie(request.headers.get("cookie") ?? "", SESSION_COOKIE);
  if (token) {
    await env.DB!.prepare("UPDATE delivery_sessions SET workspace_id = ? WHERE token_hash = ?")
      .bind(id, await sha256Hex(token)).run();
  }
  return Response.json({ workspace: { id, name } }, { status: 201, headers: { "Cache-Control": "no-store" } });
}

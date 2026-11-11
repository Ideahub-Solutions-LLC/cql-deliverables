import { env } from "cloudflare:workers";
import { getAuthenticatedUser } from "../../../lib/auth";
import { cleanWorkstream, listWorkstreams, rememberWorkstream } from "../../../lib/workstreams";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return Response.json({ error: "Sign in to view workstreams." }, { status: 401 });
  return Response.json({ workstreams: await listWorkstreams(env.DB!, user.workspaceId) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return Response.json({ error: "Sign in to add a workstream." }, { status: 401 });
  if (user.role !== "admin" && user.role !== "reviewer") return Response.json({ error: "Only an administrator or reviewer can add workstreams." }, { status: 403 });
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).origin !== new URL(request.url).origin) return Response.json({ error: "Cross-origin changes are not allowed." }, { status: 403 });
  let body: any; try { body = await request.json(); } catch { body = {}; }
  const name = cleanWorkstream(body?.name);
  if (!name) return Response.json({ error: "Type a workstream name." }, { status: 400 });
  try {
    const workstream = await rememberWorkstream(env.DB!, user.workspaceId, name, user.username, true);
    return Response.json({ workstream, workstreams: await listWorkstreams(env.DB!, user.workspaceId) }, { status: 201 });
  } catch (error) {
    console.error("Workstream store error", error instanceof Error ? error.message : "unknown");
    return Response.json({ error: "The workstream list could not be saved. Ask the technical team to apply database migration 0005." }, { status: 500 });
  }
}

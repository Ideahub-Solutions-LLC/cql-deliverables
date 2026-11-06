import { env } from "cloudflare:workers";
import { getAuthenticatedUser } from "../../../lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: "Sign in to view workspace projects." }, { status: 401 });
  if (!user.workspaceId) return Response.json({ error: "Choose a workspace first." }, { status: 400 });
  if (!env.DB) return Response.json({ error: "Workspace projects are not configured." }, { status: 503 });
  const result = await env.DB!.prepare(
    "SELECT id, name, created_at AS createdAt FROM workspace_projects WHERE workspace_id = ? ORDER BY created_at, name",
  ).bind(user.workspaceId).all<{ id: string; name: string; createdAt: string }>();
  return Response.json({ projects: result.results ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return Response.json({ error: "Sign in to add a workspace project." }, { status: 401 });
  if (user.role !== "admin" && user.role !== "reviewer") {
    return Response.json({ error: "Only an administrator or reviewer can add a workspace project." }, { status: 403 });
  }
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).origin !== new URL(request.url).origin) {
    return Response.json({ error: "Cross-origin project changes are not allowed." }, { status: 403 });
  }
  if (!user.workspaceId) return Response.json({ error: "Choose a workspace first." }, { status: 400 });
  if (!env.DB) return Response.json({ error: "Workspace projects are not configured." }, { status: 503 });
  let body: { name?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Enter a project name." }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  if (name.length < 2 || name.length > 100) {
    return Response.json({ error: "Project names must be between 2 and 100 characters." }, { status: 400 });
  }
  const project = { id: crypto.randomUUID(), name, createdAt: new Date().toISOString() };
  try {
    await env.DB!.prepare(
      "INSERT INTO workspace_projects (id, workspace_id, name, created_by, created_at) VALUES (?, ?, ?, ?, ?)",
    ).bind(project.id, user.workspaceId, project.name, user.username, project.createdAt).run();
  } catch (error) {
    if (String(error).includes("UNIQUE")) {
      return Response.json({ error: "A project with that name already exists in this workspace." }, { status: 409 });
    }
    throw error;
  }
  return Response.json({ project }, { status: 201, headers: { "Cache-Control": "no-store" } });
}

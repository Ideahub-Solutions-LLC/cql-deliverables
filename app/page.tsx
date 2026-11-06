import { env } from "cloudflare:workers";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "../lib/auth";
import source from "./data/plan.json";
import DeliveryConsole from "./delivery-console";
import DashboardShell from "./dashboard-shell";
import WorkspaceHome from "./workspace-home";
import type { Plan } from "../lib/delivery";

export const dynamic = "force-dynamic";
type Project = { id: string; name: string; createdAt: string };

export default async function Home({ searchParams }: { searchParams?: Promise<{ projectId?: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  if (!env.DB) throw new Error("Workspace database is not configured.");
  if (!user.workspaceId) {
    const workspaceList = await env.DB.prepare("SELECT id, name FROM workspaces WHERE active = 1 ORDER BY sort_order, name").all<{ id: string; name: string }>();
    return <DashboardShell user={user} workspaceTree workspaceList={workspaceList.results ?? []}><section className="workspace-content"><div className="workspace-heading"><div><h1>Main dashboard</h1><p>Select a workspace from the sidebar, then choose a project to continue.</p></div></div></section></DashboardShell>;
  }
  const workspace = await env.DB.prepare("SELECT name FROM workspaces WHERE id = ? AND active = 1")
    .bind(user.workspaceId).first<{ name: string }>();
  if (!workspace) redirect("/login");
  const { projectId } = (await searchParams) || {};
  const [projectsResult, workspacesResult] = await Promise.all([
    env.DB.prepare(
      "SELECT id, name, created_at AS createdAt FROM workspace_projects WHERE workspace_id = ? ORDER BY created_at, name",
    ).bind(user.workspaceId).all<Project>(),
    env.DB.prepare(
      "SELECT id, name FROM workspaces WHERE active = 1 ORDER BY sort_order, name",
    ).all<{ id: string; name: string }>(),
  ]);
  const projects = projectsResult.results ?? [];
  const workspaces = workspacesResult.results ?? [];
  if (!projectId) return <WorkspaceHome workspaceName={workspace.name} workspaces={workspaces} projects={projects} user={user} />;
  const project = projects.find((item) => item.id === projectId);
  if (!project) redirect("/");
  if (project.id === "dsi-delivery-tracker" && user.workspaceId === "digital-smile-innovations") {
    return <DeliveryConsole plan={source as unknown as Plan} user={user} projectId={project.id} workspaceName={workspace.name} />;
  }
  return <WorkspaceHome workspaceName={workspace.name} workspaces={workspaces} projects={projects} user={user} selectedProject={project} />;
}

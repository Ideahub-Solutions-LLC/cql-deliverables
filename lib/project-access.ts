import { env } from "cloudflare:workers";
import source from "../app/data/plan.json";

export const LEGACY_PROJECT = "dsi-delivery-tracker";

export async function projectInWorkspace(projectId: string, workspaceId: string) {
  if (!env.DB || !workspaceId || !projectId) return false;
  return !!await env.DB.prepare("SELECT id FROM workspace_projects WHERE id=? AND workspace_id=?")
    .bind(projectId, workspaceId).first();
}

export async function taskInWorkspace(taskId: string, workspaceId: string) {
  if (!env.DB || !workspaceId) return false;
  const custom = await env.DB.prepare(`SELECT d.id FROM delivery_tasks d JOIN workspace_projects p ON p.id=d.project_id
    WHERE d.id=? AND p.workspace_id=? AND d.deleted_at IS NULL`).bind(taskId, workspaceId).first();
  if (custom) return true;
  if (workspaceId !== "digital-smile-innovations") return false;
  return source.tasks.some(task => task.id === taskId) || source.milestones.some(task => task.id === taskId);
}

// Legacy dates and gates belong only to DSI. All new records are scoped through their project.
export const eventScopeSql = `(entity_id IN (SELECT id FROM delivery_tasks WHERE project_id=?)
  OR (?='dsi-delivery-tracker' AND entity_id NOT IN (SELECT id FROM delivery_tasks)))`;

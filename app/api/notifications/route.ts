import { env } from "cloudflare:workers";
import { getAuthenticatedUser } from "../../../lib/auth";

import source from "../../data/plan.json";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return Response.json({ error: "Sign in to view notifications." }, { status: 401 });
  const result = await env.DB!.prepare(`SELECT n.id,n.task_id AS taskId,n.kind,n.message,n.read_at AS readAt,n.created_at AS createdAt,u.display_name AS actorName, p.id AS projectId, w.id AS workspaceId
    FROM delivery_notifications n JOIN delivery_users u ON u.username=n.actor_username
    LEFT JOIN delivery_tasks d ON d.id=n.task_id AND d.deleted_at IS NULL
    LEFT JOIN workspace_projects p ON p.id=d.project_id
    LEFT JOIN workspaces w ON w.id=p.workspace_id AND w.active=1
    WHERE n.recipient_username=? ORDER BY n.created_at DESC LIMIT 50`).bind(user.username).all<{id:string;taskId:string|null;projectId:string|null;workspaceId:string|null}>();
  const legacyIds = new Set([...source.tasks, ...source.milestones].map(task => task.id));
  const legacy = await env.DB!.prepare(`SELECT p.id AS projectId, w.id AS workspaceId FROM workspace_projects p
    JOIN workspaces w ON w.id=p.workspace_id AND w.active=1
    WHERE p.id='dsi-delivery-tracker' AND w.id='digital-smile-innovations'`).first<{projectId:string;workspaceId:string}>();
  const notifications = (result.results ?? []).map(notice => ({
    ...notice,
    ...(!notice.projectId && notice.taskId && legacyIds.has(notice.taskId) && legacy ? legacy : {}),
  }));
  return Response.json({ notifications }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return Response.json({ error: "Sign in to update notifications." }, { status: 401 });
  const origin=request.headers.get("origin");if(origin&&new URL(origin).origin!==new URL(request.url).origin)return Response.json({error:"Cross-origin notification changes are not allowed."},{status:403});
  let body: any; try { body = await request.json(); } catch { body = {}; }
  const now = new Date().toISOString();
  if (body.all === true) await env.DB!.prepare("UPDATE delivery_notifications SET read_at=? WHERE recipient_username=? AND read_at IS NULL").bind(now,user.username).run();
  else if (typeof body.id === "string") await env.DB!.prepare("UPDATE delivery_notifications SET read_at=? WHERE id=? AND recipient_username=?").bind(now,body.id,user.username).run();
  else return Response.json({ error: "Choose a notification." }, { status: 400 });
  return Response.json({ ok: true });
}

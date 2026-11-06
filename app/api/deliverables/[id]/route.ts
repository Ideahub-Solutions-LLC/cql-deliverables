import { env } from "cloudflare:workers";
import { getAuthenticatedUser } from "../../../../lib/auth";

import { taskInWorkspace } from "../../../../lib/project-access";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser(request);
  if (!user) return Response.json({ error: "Sign in to delete a deliverable." }, { status: 401 });
  if (user.role !== "admin" && user.role !== "reviewer") return Response.json({ error: "Only an administrator or reviewer can delete deliverables." }, { status: 403 });
  const origin=request.headers.get("origin");if(origin&&new URL(origin).origin!==new URL(request.url).origin)return Response.json({error:"Cross-origin changes are not allowed."},{status:403});
  const { id } = await context.params;
  if (!await taskInWorkspace(id, user.workspaceId)) return Response.json({ error: "Deliverable not found." }, { status: 404 });
  const now = new Date().toISOString();
  if (id.startsWith("custom-")) {
    const row = await env.DB!.prepare("SELECT id FROM delivery_tasks WHERE id=? AND deleted_at IS NULL").bind(id).first();
    if (!row) return Response.json({ error: "Deliverable not found." }, { status: 404 });
    await env.DB!.batch([
      env.DB!.prepare("DELETE FROM delivery_tasks WHERE id=?").bind(id),
      env.DB!.prepare("DELETE FROM delivery_events WHERE entity_id=?").bind(id),
      env.DB!.prepare("DELETE FROM delivery_comments WHERE task_id=? AND parent_id IS NOT NULL").bind(id),
      env.DB!.prepare("DELETE FROM delivery_comments WHERE task_id=? AND parent_id IS NULL").bind(id),
      env.DB!.prepare("DELETE FROM delivery_notifications WHERE task_id=?").bind(id),
    ]);
  } else {
    const existing = await env.DB!.prepare("SELECT id FROM delivery_events WHERE entity_type='deleted_task' AND entity_id=?").bind(id).first();
    if (existing) return Response.json({ error: "Deliverable is already deleted." }, { status: 404 });
    await env.DB!.batch([
      env.DB!.prepare("DELETE FROM delivery_events WHERE entity_id=?").bind(id),
      env.DB!.prepare("DELETE FROM delivery_comments WHERE task_id=? AND parent_id IS NOT NULL").bind(id),
      env.DB!.prepare("DELETE FROM delivery_comments WHERE task_id=? AND parent_id IS NULL").bind(id),
      env.DB!.prepare("DELETE FROM delivery_notifications WHERE task_id=?").bind(id),
      env.DB!.prepare("INSERT INTO delivery_events (id,entity_type,entity_id,version,payload,actor_id,actor_name,at) VALUES (?,?,?,?,?,?,?,?)")
        .bind(crypto.randomUUID(),"deleted_task",id,1,"{}",user.username,user.displayName,now),
    ]);
  }
  return Response.json({ ok: true });
}

import { env } from "cloudflare:workers";
import { getAuthenticatedUser } from "../../../lib/auth";

export const dynamic = "force-dynamic";
const PROJECT = "dsi-delivery-tracker";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return Response.json({ error: "Sign in to view deliverables." }, { status: 401 });
  if (user.workspaceId !== "digital-smile-innovations") return Response.json({ error: "This project is not available in the selected workspace." }, { status: 403 });
  const result = await env.DB!.prepare(`SELECT d.id,d.title,COALESCE(u.display_name,d.owner) AS owner,d.owner_username AS ownerUsername,d.workstream,d.start_date AS startDate,d.due_date AS dueDate,
    d.deliverable,d.acceptance,d.target,d.unit FROM delivery_tasks d LEFT JOIN delivery_users u ON u.username=d.owner_username WHERE d.project_id=? AND d.deleted_at IS NULL ORDER BY d.due_date,d.title`)
    .bind(PROJECT).all<any>();
  const tasks = (result.results ?? []).map((row) => ({ ...row, date: row.dueDate, originalDueDate: row.dueDate, dueTime: "17:00", status: "Ready", actual: null, evidence: "", blocker: "", rescueOwner: "", recoveryDate: "", acceptedBy: "", closedAt: null }));
  return Response.json({ tasks }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return Response.json({ error: "Sign in to add a deliverable." }, { status: 401 });
  if (user.workspaceId !== "digital-smile-innovations") return Response.json({ error: "This project is not available in the selected workspace." }, { status: 403 });
  if (user.role !== "admin" && user.role !== "reviewer") return Response.json({ error: "Only an administrator or reviewer can add deliverables." }, { status: 403 });
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).origin !== new URL(request.url).origin) return Response.json({ error: "Cross-origin changes are not allowed." }, { status: 403 });
  let body: any; try { body = await request.json(); } catch { return Response.json({ error: "Complete the deliverable form." }, { status: 400 }); }
  const title = typeof body.title === "string" ? body.title.trim().slice(0,160) : "";
  const ownerUsername = typeof body.ownerUsername === "string" ? body.ownerUsername : "";
  const workstream = typeof body.workstream === "string" ? body.workstream.trim().slice(0,100) : "Additional deliverables";
  const startDate = typeof body.startDate === "string" ? body.startDate : "";
  const dueDate = typeof body.dueDate === "string" ? body.dueDate : "";
  const acceptance = typeof body.acceptance === "string" ? body.acceptance.trim().slice(0,4000) : "";
  const target = body.target==null||body.target===""?null:Number(body.target);
  const owner = await env.DB!.prepare("SELECT username,display_name FROM delivery_users WHERE username=? AND active=1").bind(ownerUsername).first<{username:string;display_name:string}>();
  if (!title || !owner || !acceptance || !validDate(startDate) || !validDate(dueDate) || dueDate < startDate || (target!==null&&(!Number.isFinite(target)||target<0))) return Response.json({ error: "Enter a title, active owner, definition of done, a valid date range, and a nonnegative target." }, { status: 400 });
  const id = `custom-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  await env.DB!.prepare(`INSERT INTO delivery_tasks (id,project_id,title,owner,owner_username,workstream,start_date,due_date,deliverable,acceptance,target,unit,created_by,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,PROJECT,title,owner.display_name,owner.username,workstream||"Additional deliverables",startDate,dueDate,acceptance,acceptance,target===null?null:String(target),typeof body.unit==="string"?body.unit.trim().slice(0,40):null,user.username,now).run();
  await env.DB!.prepare(`INSERT INTO delivery_notifications (id,recipient_username,actor_username,task_id,kind,message,created_at) VALUES (?,?,?,?,?,?,?)`)
    .bind(crypto.randomUUID(),owner.username,user.username,id,"assignment",`${user.displayName} assigned you a deliverable: ${title}`,now).run();
  return Response.json({ task: { id,title,owner:owner.display_name,ownerUsername:owner.username,workstream,startDate,dueDate,date:dueDate,originalDueDate:dueDate,dueTime:"17:00",deliverable:acceptance,acceptance,target,unit:body.unit??"",status:"Ready",actual:null,evidence:"",blocker:"",rescueOwner:"",recoveryDate:"",acceptedBy:"",closedAt:null } }, { status: 201 });
}

function validDate(value:string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value; }

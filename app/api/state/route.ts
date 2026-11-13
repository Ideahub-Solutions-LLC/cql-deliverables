import { env } from "cloudflare:workers";
import { canEditMetrics, canEditTask, canReview, getAuthenticatedUser } from "../../../lib/auth";
import source from "../../data/plan.json";
import { type Plan, type Task, gateTasks, validateTaskUpdate, validateMetrics } from "../../../lib/delivery";
import { notifyMentions } from "../../../lib/mentions";
import { eventScopeSql, LEGACY_PROJECT, projectInWorkspace } from "../../../lib/project-access";
import { cleanWorkstream, rememberWorkstream } from "../../../lib/workstreams";
const legacyPlan=source as unknown as Plan;
const emptyPlan: Plan={meta:{},people:[],phases:[],milestones:[],targets:[],calendar:[],tasks:[]};
export const dynamic="force-dynamic";
const latestSql=`SELECT e.* FROM delivery_events e INNER JOIN (SELECT entity_type, entity_id, MAX(version) AS v FROM delivery_events WHERE ${eventScopeSql} GROUP BY entity_type, entity_id) x ON e.entity_type=x.entity_type AND e.entity_id=x.entity_id AND e.version=x.v`;

function decode(row:any) {return {id:row.id,entityType:row.entity_type,entityId:row.entity_id,version:row.version,payload:JSON.parse(row.payload),actorName:row.actor_name,at:row.at};}
function failure(error:unknown) { console.error("Delivery store error",error instanceof Error?error.message:"unknown"); return Response.json({error:"The shared tracker could not save or load this change. Your entry has been kept on screen. Please retry."},{status:503}); }

export async function GET(request: Request) {
  const user=await getAuthenticatedUser();
  if(!user) return Response.json({error:"Sign in to load and save shared progress."},{status:401});
  const projectId=new URL(request.url).searchParams.get("projectId")||"";
  if(!await projectInWorkspace(projectId,user.workspaceId)) return Response.json({error:"This project is not available in the selected workspace."},{status:403});
  try {
    if(!env.DB) throw new Error("Missing DB binding");
    const [latest,audit,deleted,custom]=await env.DB!.batch([
      env.DB!.prepare(latestSql).bind(projectId,projectId),
      env.DB!.prepare(`SELECT * FROM delivery_events WHERE ${eventScopeSql} ORDER BY at DESC LIMIT 150`).bind(projectId,projectId),
      env.DB!.prepare(`SELECT entity_id FROM delivery_events WHERE entity_type='deleted_task' AND ${eventScopeSql}`).bind(projectId,projectId),
      env.DB!.prepare("SELECT d.*,u.username AS owner_username,u.display_name AS current_owner FROM delivery_tasks d LEFT JOIN delivery_users u ON u.username=d.owner_username WHERE d.project_id=? AND d.deleted_at IS NULL").bind(projectId),
    ]);
    const overrides:Record<string,any>={},metrics:Record<string,any>={},milestones:Record<string,any>={};
    for(const raw of latest.results || []) {const e=decode(raw);if(e.entityType==="task")overrides[e.entityId]={...e.payload,version:e.version,updatedAt:e.at};else if(e.entityType==="milestone")milestones[e.entityId]={...e.payload,version:e.version,updatedAt:e.at};else if(e.entityType==="metrics")metrics[e.entityId]={...e.payload,version:e.version,updatedAt:e.at};}
    const extraTasks=(custom.results||[]).map((row:any)=>({id:row.id,title:row.title,owner:row.current_owner||row.owner,ownerUsername:row.owner_username,workstream:row.workstream,startDate:row.start_date,date:row.due_date,originalDueDate:row.due_date,dueTime:"17:00",deliverable:row.deliverable,acceptance:row.acceptance,target:row.target==null?null:Number(row.target),unit:row.unit,status:"Ready",actual:null,evidence:"",blocker:"",rescueOwner:"",recoveryDate:"",acceptedBy:"",closedAt:null,...overrides[row.id]}));
    return Response.json({overrides,metrics,milestones,extraTasks,deletedTaskIds:(deleted.results||[]).map((row:any)=>row.entity_id),audit:(audit.results||[]).map(decode),user:{name:user.displayName,role:user.role},syncedAt:new Date().toISOString()},{headers:{"Cache-Control":"no-store"}});
  } catch(error) { return failure(error); }
}

export async function POST(request:Request) {
  const user=await getAuthenticatedUser(request);
  if(!user) return Response.json({error:"Sign in to save shared progress."},{status:401});
  const origin=request.headers.get("origin");
  if(origin && new URL(origin).origin !== new URL(request.url).origin) return Response.json({error:"Cross-origin updates are not allowed."},{status:403});
  try {
    if(!env.DB) throw new Error("Missing DB binding");
    const body:any=await request.json();
    const projectId=typeof body.projectId==="string"?body.projectId:"";
    if(!await projectInWorkspace(projectId,user.workspaceId)) return Response.json({error:"This project is not available in the selected workspace."},{status:403});
    const plan=projectId===LEGACY_PROJECT?legacyPlan:emptyPlan;
    if(!["task","milestone","metrics"].includes(body.entityType) || typeof body.entityId!=="string") return Response.json({error:"Unknown record type."},{status:400});
    if(!Number.isInteger(body.version)||body.version<0) return Response.json({error:"Refresh to get the current record version."},{status:400});
    const rows=await env.DB!.prepare(latestSql).bind(projectId,projectId).all();
    const latest=(rows.results||[]).map(decode);
    const previous=latest.find(e=>e.entityType===body.entityType&&e.entityId===body.entityId);
    if((previous?.version||0)!==body.version) return Response.json({error:"Someone updated this record while you were editing. Refresh, review their change, then save again."},{status:409});
    let value:any;
    if(body.entityType==="task"||body.entityType==="milestone") {
      const work=[...plan.tasks,...gateTasks(plan)];
      let base:any=work.find(t=>t.id===body.entityId && (body.entityType==="task"?t.workstream!=="Delivery gate":t.workstream==="Delivery gate"));
      if(!base&&body.entityType==="task") {
        const row=await env.DB!.prepare("SELECT d.*,u.username AS owner_username,u.person_id AS owner_person_id,u.display_name AS current_owner FROM delivery_tasks d LEFT JOIN delivery_users u ON u.username=d.owner_username WHERE d.id=? AND d.project_id=? AND d.deleted_at IS NULL").bind(body.entityId,projectId).first<any>();
        if(row)base={id:row.id,date:row.due_date,originalDueDate:row.due_date,startDate:row.start_date,owner:row.current_owner||row.owner,ownerUsername:row.owner_username,ownerPersonId:row.owner_person_id,workstream:row.workstream,title:row.title,deliverable:row.deliverable,acceptance:row.acceptance,target:row.target==null?null:Number(row.target),unit:row.unit,status:"Ready",dependencies:[]};
      }
      if(!base) return Response.json({error:"This task is not in the active plan."},{status:404});
      if(body.entityType==="task"&&(await env.DB!.prepare("SELECT entity_id FROM delivery_events WHERE entity_type='deleted_task' AND entity_id=?").bind(body.entityId).first()))return Response.json({error:"This deliverable has been deleted."},{status:404});
      base={...base,...previous?.payload};
      const ownerId=base.ownerPersonId||plan.people.find(person=>person.name===base.owner)?.id;
      if(!((user.role==="staff"&&base.ownerUsername===user.username)||(projectId===LEGACY_PROJECT?canEditTask(user,ownerId||""):canReview(user.role)))) return Response.json({error:"Your role can update only work assigned to you."},{status:403});
      const isPrivileged=user.role==="admin"||user.role==="reviewer";
      const definitionFields=["title","acceptance","startDate","dueDate","workstream"];
      if(!isPrivileged&&definitionFields.some((key:string)=>body.data?.[key]!==undefined))return Response.json({error:"Only an administrator or reviewer can edit the title, workstream, dates, or definition of done."},{status:403});
      if(body.data?.ownerUsername!==undefined&&(!isPrivileged||body.entityType!=="task"))return Response.json({error:"Only an administrator or reviewer can change a deliverable's assignee."},{status:403});
      const isApproval=body.data?.status==="Accepted";
      const isReopening=previous?.payload.status==="Accepted" && body.data?.status!=="Accepted";
      if((isApproval||isReopening)&&!canReview(user.role)) return Response.json({error:"Only an authorized reviewer can accept or reopen work."},{status:403});
      const tasks=work.map(t=>({...t,...latest.find(e=>e.entityId===t.id)?.payload})) as Task[];
      const userRows=await env.DB!.prepare("SELECT display_name FROM delivery_users WHERE active=1").all<{display_name:string}>();
      const people=[...new Set([...plan.people.map(p=>p.name),...(userRows.results||[]).map(p=>p.display_name),user.displayName])];
      const result=validateTaskUpdate(base,{...body.data,version:body.version},tasks,people,{requireDelegation:projectId===LEGACY_PROJECT,reviewer:user.displayName});
      if(result.error) return Response.json({error:result.error},{status:400});
      value=result.value;
      if(isPrivileged&&body.entityType==="task") {
        const title=body.data?.title===undefined?base.title:String(body.data.title).trim();
        const acceptance=body.data?.acceptance===undefined?(base.acceptance||base.deliverable):String(body.data.acceptance).trim();
        const startDate=body.data?.startDate===undefined?(base.startDate||base.originalDueDate||base.date):String(body.data.startDate);
        const dueDate=body.data?.dueDate===undefined?(base.date||base.originalDueDate):String(body.data.dueDate);
        const validDate=(d:string)=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
        if(!title||title.length>160||!acceptance||acceptance.length>4000||!validDate(startDate)||!validDate(dueDate)||dueDate<startDate)return Response.json({error:"Enter a title, definition of done, and a valid start-to-due date range."},{status:400});
        value={...value,title,acceptance,deliverable:acceptance,startDate,date:dueDate,originalDueDate:value.status==="Accepted"?(base.originalDueDate||base.date):dueDate};
        if(body.data?.workstream!==undefined){
          let workstream=cleanWorkstream(body.data.workstream);
          if(!workstream)return Response.json({error:"Choose or type a workstream."},{status:400});
          // Only a changed workstream joins the list, so older plan workstreams are not added by an unrelated save.
          if(workstream!==base.workstream)workstream=await rememberWorkstream(env.DB!,user.workspaceId,workstream,user.username);
          value.workstream=workstream;
        }
        if(body.data?.ownerUsername!==undefined){
          const ownerUsername=typeof body.data.ownerUsername==="string"?body.data.ownerUsername:"";
          const owner=await env.DB!.prepare("SELECT username,display_name,person_id FROM delivery_users WHERE username=? AND active=1").bind(ownerUsername).first<{username:string;display_name:string;person_id:string|null}>();
          if(!owner)return Response.json({error:"Choose an active assignee."},{status:400});
          value={...value,ownerUsername:owner.username,owner:owner.display_name,ownerPersonId:owner.person_id};
        }

      }
      if(value.status==="Accepted") {
        value.closedAt=previous?.payload.status==="Accepted" ? previous.payload.closedAt:new Date().toISOString();
      } else {
        value.acceptedBy="";
        value.closedAt=null;
      }
    } else {
      if(!canEditMetrics(user.role)) return Response.json({error:"Only an administrator or project reviewer can record daily results."},{status:403});
      if(!plan.calendar.some(d=>d.date===body.entityId)) return Response.json({error:"Choose a date inside the project window."},{status:400});
      const result=validateMetrics(body.data);
      if(result.error) return Response.json({error:result.error},{status:400});
      value=result.value;
    }
    const at=new Date().toISOString(),version=body.version+1,id=crypto.randomUUID();
    value={...previous?.payload,...value};
    value.version=version;value.updatedAt=at;
    try {
      // Definitions travel in the versioned event, so a losing concurrent save cannot change the task.
      await env.DB!.prepare("INSERT INTO delivery_events (id,entity_type,entity_id,version,payload,actor_id,actor_name,at) VALUES (?,?,?,?,?,?,?,?)").bind(id,body.entityType,body.entityId,version,JSON.stringify(value),user.userId,user.displayName,at).run();
      if(body.entityType==="task")await notifyMentions(body.entityId,[value.acceptance,value.evidence,value.notes].filter(Boolean).join("\n"),user.username,user.displayName);
    } catch(error) {
      if(String(error).includes("UNIQUE")) return Response.json({error:"Another teammate saved first. Refresh this record before saving again."},{status:409});
      throw error;
    }
    return Response.json({value,event:{id,entityType:body.entityType,entityId:body.entityId,version,payload:value,actorName:user.displayName,at}},{headers:{"Cache-Control":"no-store"}});
  } catch(error) {return failure(error);}
}

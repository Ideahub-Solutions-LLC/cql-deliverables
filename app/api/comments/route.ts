import { env } from "cloudflare:workers";
import { getAuthenticatedUser } from "../../../lib/auth";
import { taskInWorkspace } from "../../../lib/project-access";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user=await getAuthenticatedUser(request);
  if(!user)return Response.json({error:"Sign in to view comments."},{status:401});
  const taskId=new URL(request.url).searchParams.get("taskId")||"";
  if(!taskId||!(await taskInWorkspace(taskId,user.workspaceId)))return Response.json({error:"Deliverable not found."},{status:404});
  const result=await env.DB!.prepare(`SELECT c.id,c.task_id AS taskId,c.parent_id AS parentId,c.content,c.created_at AS createdAt,c.updated_at AS updatedAt,
    u.username AS authorUsername,u.display_name AS authorName FROM delivery_comments c JOIN delivery_users u ON u.username=c.author_username
    WHERE c.task_id=? ORDER BY c.created_at ASC`).bind(taskId).all();
  return Response.json({comments:result.results??[]},{headers:{"Cache-Control":"no-store"}});
}

export async function POST(request: Request) {
  const user=await getAuthenticatedUser(request);
  if(!user)return Response.json({error:"Sign in to comment."},{status:401});
  const origin=request.headers.get("origin");
  if(origin&&new URL(origin).origin!==new URL(request.url).origin)return Response.json({error:"Cross-origin changes are not allowed."},{status:403});
  let body:any;try{body=await request.json();}catch{return Response.json({error:"Enter a comment."},{status:400});}
  const taskId=typeof body.taskId==="string"?body.taskId:"",content=typeof body.content==="string"?body.content.trim().slice(0,4000):"",parentId=typeof body.parentId==="string"?body.parentId:null;
  if(!taskId||!(await taskInWorkspace(taskId,user.workspaceId))||content.length<1)return Response.json({error:"Enter a comment for an existing deliverable."},{status:400});
  if(parentId){const parent=await env.DB!.prepare("SELECT id,parent_id FROM delivery_comments WHERE id=? AND task_id=?").bind(parentId,taskId).first<any>();if(!parent||parent.parent_id)return Response.json({error:"Replies can be added to a top-level comment."},{status:400});}
  const id=crypto.randomUUID(),now=new Date().toISOString();
  await env.DB!.prepare("INSERT INTO delivery_comments (id,task_id,author_username,parent_id,content,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").bind(id,taskId,user.username,parentId,content,now,now).run();
  if(parentId){const parent=await env.DB!.prepare("SELECT author_username FROM delivery_comments WHERE id=?").bind(parentId).first<{author_username:string}>();if(parent&&parent.author_username!==user.username)await env.DB!.prepare("INSERT INTO delivery_notifications (id,recipient_username,actor_username,task_id,kind,message,created_at) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(),parent.author_username,user.username,taskId,"reply",`${user.displayName} replied to your comment.`,now).run();}
  return Response.json({comment:{id,taskId,parentId,content,createdAt:now,updatedAt:now,authorUsername:user.username,authorName:user.displayName}},{status:201});
}

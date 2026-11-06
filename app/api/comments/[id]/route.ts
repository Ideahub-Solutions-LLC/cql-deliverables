import { env } from "cloudflare:workers";
import { getAuthenticatedUser } from "../../../../lib/auth";

import { taskInWorkspace } from "../../../../lib/project-access";

export const dynamic = "force-dynamic";

export async function PATCH(request:Request,context:{params:Promise<{id:string}>}) {
  const user=await getAuthenticatedUser(request);if(!user)return Response.json({error:"Sign in to edit comments."},{status:401});
  const origin=request.headers.get("origin");if(origin&&new URL(origin).origin!==new URL(request.url).origin)return Response.json({error:"Cross-origin changes are not allowed."},{status:403});
  const {id}=await context.params;let body:any;try{body=await request.json();}catch{return Response.json({error:"Enter a comment."},{status:400});}
  const comment=await env.DB!.prepare("SELECT task_id FROM delivery_comments WHERE id=?").bind(id).first<{task_id:string}>();
  if(!comment||!await taskInWorkspace(comment.task_id,user.workspaceId))return Response.json({error:"Comment not found."},{status:404});
  const content=typeof body.content==="string"?body.content.trim().slice(0,4000):"";
  if(!content)return Response.json({error:"A comment cannot be empty."},{status:400});
  const result=await env.DB!.prepare("UPDATE delivery_comments SET content=?,updated_at=? WHERE id=? AND author_username=?").bind(content,new Date().toISOString(),id,user.username).run();
  if(!result.meta.changes)return Response.json({error:"Only your own comments can be edited."},{status:403});
  return Response.json({ok:true});
}

export async function DELETE(request:Request,context:{params:Promise<{id:string}>}) {
  const user=await getAuthenticatedUser(request);if(!user)return Response.json({error:"Sign in to delete comments."},{status:401});
  const origin=request.headers.get("origin");if(origin&&new URL(origin).origin!==new URL(request.url).origin)return Response.json({error:"Cross-origin changes are not allowed."},{status:403});
  const {id}=await context.params;
  const row=await env.DB!.prepare("SELECT author_username,task_id FROM delivery_comments WHERE id=?").bind(id).first<{author_username:string;task_id:string}>();
  if(!row||!await taskInWorkspace(row.task_id,user.workspaceId))return Response.json({error:"Comment not found."},{status:404});
  if(row.author_username!==user.username)return Response.json({error:"Only your own comments can be deleted."},{status:403});
  const replies=await env.DB!.prepare("SELECT id FROM delivery_comments WHERE parent_id=? LIMIT 1").bind(id).first();
  if(replies)return Response.json({error:"This comment has replies, so it cannot be deleted. You can still edit it."},{status:409});
  await env.DB!.prepare("DELETE FROM delivery_comments WHERE id=? AND author_username=?").bind(id,user.username).run();
  return Response.json({ok:true});
}

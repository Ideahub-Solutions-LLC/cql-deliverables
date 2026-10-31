"use client";

import { useEffect, useState } from "react";
import { MessageCircle, Pencil, Reply, Trash2, X } from "lucide-react";

type Comment = { id:string;taskId:string;parentId:string|null;content:string;createdAt:string;updatedAt:string;authorUsername:string;authorName:string };

export default function TaskComments({ taskId, username }: { taskId:string;username:string }) {
  const [comments,setComments]=useState<Comment[]>([]),[draft,setDraft]=useState(""),[replyTo,setReplyTo]=useState<string|null>(null),[editing,setEditing]=useState<string|null>(null),[editText,setEditText]=useState(""),[error,setError]=useState("");
  async function load(){const response=await fetch(`/api/comments?taskId=${encodeURIComponent(taskId)}`,{cache:"no-store"});const data:any=await response.json();if(response.ok)setComments(data.comments||[]);}
  useEffect(()=>{load().catch(()=>{});},[taskId]);
  async function post(content:string,parentId:string|null){const response=await fetch("/api/comments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({taskId,content,parentId})});const data:any=await response.json();if(!response.ok)throw new Error(data.error||"Could not add comment.");setComments(current=>[...current,data.comment]);}
  async function submit(){setError("");try{await post(draft,replyTo);setDraft("");setReplyTo(null);}catch(e){setError(e instanceof Error?e.message:"Could not add comment.");}}
  async function update(id:string){const response=await fetch(`/api/comments/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({content:editText})});const data:any=await response.json();if(!response.ok){setError(data.error);return;}setComments(current=>current.map(c=>c.id===id?{...c,content:editText,updatedAt:new Date().toISOString()}:c));setEditing(null);}
  async function remove(id:string){const response=await fetch(`/api/comments/${id}`,{method:"DELETE"});const data:any=await response.json();if(!response.ok){setError(data.error);return;}setComments(current=>current.filter(c=>c.id!==id));}
  const roots=comments.filter(c=>!c.parentId);
  return <section className="task-comments"><header><MessageCircle size={17}/><h3>Comments</h3><span>{comments.length}</span></header>
    {roots.length===0&&<p className="comments-empty">No comments yet. Add a note or ask a question about this deliverable.</p>}
    <div className="comment-list">{roots.map(comment=>{const replies=comments.filter(c=>c.parentId===comment.id);return <article className="comment-thread" key={comment.id}><CommentCard comment={comment} username={username} replies={replies.length} editing={editing===comment.id} editText={editText} setEditText={setEditText} onEdit={()=>{setEditing(comment.id);setEditText(comment.content);}} onSave={()=>update(comment.id)} onCancel={()=>setEditing(null)} onDelete={()=>remove(comment.id)} onReply={()=>{setReplyTo(comment.id);setDraft("");}}/>{replies.map(reply=><CommentCard key={reply.id} comment={reply} username={username} replies={0} editing={editing===reply.id} editText={editText} setEditText={setEditText} onEdit={()=>{setEditing(reply.id);setEditText(reply.content);}} onSave={()=>update(reply.id)} onCancel={()=>setEditing(null)} onDelete={()=>remove(reply.id)} onReply={()=>{setReplyTo(comment.id);setDraft("");}} reply/> )}</article>;})}</div>
    <div className="comment-form">{replyTo&&<div className="replying-to">Replying to a comment<button type="button" onClick={()=>setReplyTo(null)} aria-label="Cancel reply"><X size={14}/></button></div>}<textarea value={draft} onChange={e=>setDraft(e.target.value)} rows={2} maxLength={4000} placeholder={replyTo?"Write a reply…":"Add a comment…"} required/><button type="button" className="button primary" disabled={!draft.trim()} onClick={submit}><MessageCircle size={14}/>{replyTo?"Reply":"Comment"}</button></div>
    {error&&<p className="comment-error" role="alert">{error}</p>}
  </section>;
}

function CommentCard({comment,username,replies,editing,editText,setEditText,onEdit,onSave,onCancel,onDelete,onReply,reply=false}:{comment:Comment;username:string;replies:number;editing:boolean;editText:string;setEditText:(v:string)=>void;onEdit:()=>void;onSave:()=>void;onCancel:()=>void;onDelete:()=>void;onReply:()=>void;reply?:boolean}){
const mine=comment.authorUsername===username;
return <div className={`comment-card${reply?" reply":""}`}><div className="comment-meta"><strong>{comment.authorName}</strong><time>{new Date(comment.createdAt).toLocaleString()}</time>{comment.updatedAt!==comment.createdAt&&<small>edited</small>}</div>{editing?<><textarea value={editText} onChange={e=>setEditText(e.target.value)} rows={3}/><div className="comment-actions"><button type="button" onClick={onCancel}>Cancel</button><button type="button" onClick={onSave}>Save edit</button></div></>:<p>{comment.content}</p>}<div className="comment-actions">{mine&&!editing&&<><button type="button" onClick={onEdit}><Pencil size={13}/>Edit</button>{!replies&&<button type="button" onClick={onDelete}><Trash2 size={13}/>Delete</button>}</>}{!reply&&!editing&&<button type="button" onClick={onReply}><Reply size={13}/>Reply</button>}</div></div>;
}

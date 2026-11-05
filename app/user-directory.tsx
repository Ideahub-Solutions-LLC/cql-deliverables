"use client";
import { useEffect, useState } from "react";
import { Check, Save, UserRound, UserX } from "lucide-react";
import "./workspace.css";

export type Member={username:string;displayName:string;role:string;active:number;email:string|null;firstName:string;lastName:string;timezone:string;themeMode:string;avatarData:string|null};

/** Admin/Reviewer list of accounts. Used inside the Dashboard and on the /users page. */
export default function UserDirectory({currentUsername,onChange}:{currentUsername:string;onChange?:(person:Member)=>void}){
  const [users,setUsers]=useState<Member[]>([]),[loaded,setLoaded]=useState(false),[error,setError]=useState(""),[busy,setBusy]=useState<string|null>(null),[saved,setSaved]=useState<string|null>(null);
  useEffect(()=>{fetch("/api/users",{cache:"no-store"}).then(r=>r.json()).then((d:any)=>{if(d.error)throw new Error(d.error);setUsers(d.users||[]);}).catch(()=>setError("Could not load users.")).finally(()=>setLoaded(true));},[]);
  const update=(username:string,patch:Partial<Member>)=>setUsers(v=>v.map(u=>u.username===username?{...u,...patch}:u));
  async function save(person:Member){setBusy(person.username);setError("");setSaved(null);try{const r=await fetch(`/api/users/${encodeURIComponent(person.username)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({firstName:person.firstName,lastName:person.lastName,email:person.email,timezone:person.timezone,avatarData:person.avatarData})});const d:any=await r.json();if(!r.ok)throw new Error(d.error);const next={...person,firstName:(person.firstName||"").trim(),lastName:(person.lastName||"").trim(),displayName:`${(person.firstName||"").trim()} ${(person.lastName||"").trim()}`.trim()};update(person.username,next);setSaved(person.username);onChange?.(next);}catch(e){setError(e instanceof Error?e.message:"Could not update profile.");}finally{setBusy(null);}}
  async function toggle(person:Member){setBusy(person.username);setError("");setSaved(null);try{const active=person.active?0:1;const r=await fetch(`/api/users/${encodeURIComponent(person.username)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({active})});const d:any=await r.json();if(!r.ok)throw new Error(d.error);update(person.username,{active});onChange?.({...person,active});}catch(e){setError(e instanceof Error?e.message:"Could not change account access.");}finally{setBusy(null);}}
  const enabled=users.filter(u=>u.active).length;
  return <div className="user-directory">
    <div className="workspace-section-title"><h2>Team accounts</h2><span>{users.length}</span>{loaded&&users.length>0&&<small className="user-directory-summary">{enabled} enabled · {users.length-enabled} disabled</small>}</div>
    {error&&<p className="workspace-form-error" role="alert">{error}</p>}
    {!loaded&&<p className="user-directory-note">Loading users…</p>}
    {loaded&&!error&&!users.length&&<p className="user-directory-note">No user accounts found.</p>}
    <div className="user-management-list">{users.map(person=><article className="managed-user" key={person.username}>
      <header><span className="managed-user-avatar">{person.avatarData?<img src={person.avatarData} alt=""/>:<UserRound size={18}/>}</span><div><strong>{person.displayName}{person.username===currentUsername&&<em className="user-directory-you"> (you)</em>}</strong><small>@{person.username} · {person.role.replaceAll("_"," ")}</small></div><span className={`account-status ${person.active?"enabled":"disabled"}`}>{person.active?"Enabled":"Disabled"}</span></header>
      <div className="managed-user-fields">
        <label className="managed-avatar-upload">Photo<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" capture="user" onChange={e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>500*1024){setError("Profile photos must be under 500 KB.");return;}const reader=new FileReader();reader.onload=()=>update(person.username,{avatarData:String(reader.result)});reader.readAsDataURL(file);}}/></label>
        <label>First name<input value={person.firstName||""} onChange={e=>update(person.username,{firstName:e.target.value})}/></label>
        <label>Last name<input value={person.lastName||""} onChange={e=>update(person.username,{lastName:e.target.value})}/></label>
        <label>Email<input type="email" value={person.email||""} onChange={e=>update(person.username,{email:e.target.value})}/></label>
        <label>Time zone<select value={person.timezone||"PST"} onChange={e=>update(person.username,{timezone:e.target.value})}><option>PST</option><option>PDT</option><option>PHT</option></select></label>
      </div>
      <footer>{saved===person.username&&<span className="user-directory-saved"><Check size={13}/>Saved</span>}<button className="button secondary" onClick={()=>save(person)} disabled={busy===person.username}><Save size={14}/>Save profile</button>{person.username!==currentUsername&&<button className={`button ${person.active?"secondary":"primary"}`} onClick={()=>toggle(person)} disabled={busy===person.username}>{person.active?<><UserX size={14}/>Disable account</>:<><Check size={14}/>Enable account</>}</button>}</footer>
    </article>)}</div>
  </div>;
}

"use client";

import { useEffect, useState } from "react";
import { Bell, ChevronDown, Clock3, LogOut, Moon, Sun, UserRound, UsersRound, SlidersHorizontal } from "lucide-react";
import type { AuthenticatedUser } from "../lib/auth";
import { Avatar } from "./delivery-components";

type Notice={id:string;taskId:string|null;kind:string;message:string;readAt:string|null;createdAt:string;actorName:string};
const zones={PDT:"Etc/GMT+7",PST:"Etc/GMT+8",PHT:"Asia/Manila"} as const;

export default function DashboardTools({user}:{user:AuthenticatedUser}) {
  const [time,setTime]=useState(new Date()),[timezone,setTimezone]=useState<keyof typeof zones>(user.timezone||"PST"),[theme,setTheme]=useState<"default"|"dark"|"light">(user.themeMode||"default"),[menu,setMenu]=useState<false|"theme"|"account">(false),[noticesOpen,setNoticesOpen]=useState(false),[notices,setNotices]=useState<Notice[]>([]);
  const canManage=user.role==="admin"||user.role==="reviewer";
  useEffect(()=>{const timer=setInterval(()=>setTime(new Date()),1000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{document.documentElement.dataset.theme=theme;},[theme]);
  useEffect(()=>{let live=true;const load=()=>fetch("/api/notifications",{cache:"no-store"}).then(r=>r.json()).then((d:any)=>{if(live)setNotices(d.notifications||[]);}).catch(()=>{});load();const timer=setInterval(load,45000);return()=>{live=false;clearInterval(timer);};},[]);
  const clock=time.toLocaleString("en-US",{timeZone:zones[timezone],weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",second:"2-digit",hour12:true});
  async function chooseTheme(next:"default"|"dark"|"light"){setTheme(next);const res=await fetch("/api/profile",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({...user,themeMode:next})});if(!res.ok)setTheme(user.themeMode||"default");}
  async function signOut(){await fetch("/api/auth/logout",{method:"POST",credentials:"same-origin"});window.location.assign("/login");}
  async function markRead(notice:Notice){await fetch("/api/notifications",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:notice.id})});setNotices(current=>current.map(item=>item.id===notice.id?{...item,readAt:new Date().toISOString()}:item));}
  const unread=notices.filter(item=>!item.readAt).length;
  return <div className="dashboard-tools">
    <div className="dashboard-clock"><Clock3 size={14}/><time>{clock}</time><select aria-label="Display timezone" value={timezone} onChange={e=>setTimezone(e.target.value as keyof typeof zones)}>{Object.keys(zones).map(zone=><option key={zone}>{zone}</option>)}</select></div>
    <div className="theme-wrap"><button className="dashboard-icon-button" aria-label="Theme mode" title="Theme mode" onClick={()=>setMenu(menu==="theme"?false:"theme")}>{theme==="dark"?<Moon size={17}/>:<Sun size={17}/>}</button>{menu==="theme"&&<div className="dashboard-popover theme-popover"><strong>Theme mode</strong>{["default","light","dark"].map(option=><button key={option} className={theme===option?"selected":""} onClick={()=>{chooseTheme(option as "default"|"light"|"dark");setMenu(false);}}>{option[0].toUpperCase()+option.slice(1)}</button>)}</div>}</div>
    <div className="notice-wrap"><button className="dashboard-icon-button" aria-label={`Notifications, ${unread} unread`} title="Notifications" onClick={()=>setNoticesOpen(!noticesOpen)}><Bell size={17}/>{unread>0&&<i>{unread>9?"9+":unread}</i>}</button>{noticesOpen&&<div className="dashboard-popover notification-popover"><header><strong>Notifications</strong>{unread>0&&<button onClick={async()=>{await fetch("/api/notifications",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({all:true})});setNotices(items=>items.map(n=>({...n,readAt:new Date().toISOString()})));}}>Mark all read</button>}</header>{notices.length?notices.map(item=><button key={item.id} className={`notice-item${item.readAt?"":" unread"}`} onClick={()=>markRead(item)}><span>{item.kind==="assignment"?"Task assigned":"You were mentioned"}</span><small>{item.message}</small><time>{new Date(item.createdAt).toLocaleString()}</time></button>):<p className="notice-empty">You’re all caught up.</p>}</div>}</div>
    <div className="account-menu-wrap"><button className="account-chip dashboard-account" onClick={()=>setMenu(menu==="account"?false:"account")} aria-expanded={menu==="account"}><UserAvatar user={user}/><span><strong>{user.displayName}</strong><small>{user.role.replaceAll("_"," ")}</small></span><ChevronDown size={13}/></button>{menu==="account"&&<div className="dashboard-popover account-popover"><a href="/profile"><UserRound size={15}/>Profile</a><a href="/settings"><SlidersHorizontal size={15}/>Settings</a><a href="/change-password"><span className="menu-dot"/>Change password</a>{canManage&&<a href="/users"><UsersRound size={15}/>Manage users</a>}<button onClick={signOut}><LogOut size={15}/>Sign out</button></div>}</div>
  </div>;
}

function UserAvatar({user}:{user:AuthenticatedUser}){return user.avatarData?<img className="avatar avatar-small-image" src={user.avatarData} alt=""/>:<Avatar name={user.displayName} small/>;}

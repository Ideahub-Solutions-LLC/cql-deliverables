"use client";
import { ArrowLeft, LogOut, Shield } from "lucide-react";
import UserDirectory from "../user-directory";
import "../workspace.css";
export default function UserManagement({currentUsername,displayName}:{currentUsername:string;displayName:string}){
async function signOut(){await fetch("/api/auth/logout",{method:"POST"});window.location.assign("/login");}
return <main className="workspace-page"><header className="workspace-topbar"><a className="workspace-brand" href="/"><img className="workspace-brand-logo" src="/ideahub-icon.png" alt="iDeaHub"/><span><strong>Daily Delivery</strong><small>IDEAHUB × DSI</small></span></a><div className="workspace-account"><span><strong>{displayName}</strong><small>Manage users</small></span><button onClick={signOut} aria-label="Sign out"><LogOut size={16}/></button></div></header><section className="workspace-content"><div className="workspace-context"><a href="/" className="workspace-back"><ArrowLeft size={15}/>Dashboard</a><b>Users</b></div><div className="workspace-heading"><div><span className="workspace-kicker">ADMINISTRATION</span><h1>Manage users</h1><p>Update user profiles and control who can sign in.</p></div><span className="workspace-project-symbol"><Shield size={25}/></span></div><UserDirectory currentUsername={currentUsername}/></section></main>}

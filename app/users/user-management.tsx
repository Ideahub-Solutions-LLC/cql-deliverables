"use client";
import { ArrowLeft, Shield } from "lucide-react";
import UserDirectory from "../user-directory";
export default function UserManagement({currentUsername,isAdmin}:{currentUsername:string;isAdmin:boolean}){
return <div className="dashboard-account-content"><section className="workspace-content"><div className="workspace-context"><a href="/" className="workspace-back"><ArrowLeft size={15}/>Dashboard</a><b>Users</b></div><div className="workspace-heading"><div><span className="workspace-kicker">ADMINISTRATION</span><h1>Manage users</h1><p>Update user profiles and control who can sign in.</p></div><span className="workspace-project-symbol"><Shield size={25}/></span></div><UserDirectory currentUsername={currentUsername} isAdmin={isAdmin}/></section></div>}

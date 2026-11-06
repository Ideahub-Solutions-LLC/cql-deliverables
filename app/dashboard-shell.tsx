"use client";
import { useState } from "react";
import { Menu, Users, X } from "lucide-react";
import type { AuthenticatedUser } from "../lib/auth";
import DashboardTools from "./dashboard-tools";
import DashboardLink from "./dashboard-link";
import WorkspaceSwitcher from "./workspace-switcher";
import WorkspaceTree from "./workspace-tree";
import "./workspace.css";

type WorkspaceProject = { id: string; name: string };
type WorkspaceNode = { id: string; name: string };

export default function DashboardShell({ user, workspaceName = "", workspaceTree = false, workspaceProjects = [], workspaceList = [], children }: { user: AuthenticatedUser; workspaceName?: string; workspaceTree?: boolean; workspaceProjects?: WorkspaceProject[]; workspaceList?: WorkspaceNode[]; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <div className="console-shell dashboard-shell">
    {open && <button className="dashboard-sidebar-backdrop" aria-label="Close navigation" onClick={() => setOpen(false)}/>}
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="brand"><img className="console-brand-logo" src="/ideahub-icon.png" alt="iDeaHub"/><div><strong>Daily Delivery</strong><small>IDEAHUB</small></div></div>
      <button className="dashboard-nav-close" aria-label="Close navigation" onClick={() => setOpen(false)}><X size={20}/></button>
      <DashboardLink/>
      <div className="sidebar-workspace-switcher">
        {workspaceTree
          ? <WorkspaceTree workspaceId={user.workspaceId} workspaceName={workspaceName} workspaces={workspaceList} projects={workspaceProjects} canAdd={user.role === "admin" || user.role === "reviewer"} />
          : <WorkspaceSwitcher workspaceId={user.workspaceId} workspaceName={workspaceName} canAdd={user.role === "admin" || user.role === "reviewer"} compact />}
      </div>
      <a className="nav-admin-link" href="/users"><Users size={18}/><span>List of users</span></a>
    </aside>
    <main className="main workspace-page">
      <header className="topbar"><div className="breadcrumb"><button className="mobile-toggle icon-btn" aria-label="Open navigation" onClick={() => setOpen(true)}><Menu size={21}/></button><strong>{workspaceName || "Main dashboard"}</strong></div><DashboardTools user={user}/></header>
      {children}
    </main>
  </div>;
}

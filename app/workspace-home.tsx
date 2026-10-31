"use client";

import { useState } from "react";
import { ArrowLeft, ArrowUpRight, Building2, FolderKanban, Plus, Sparkles } from "lucide-react";
import type { AuthenticatedUser } from "../lib/auth";
import WorkspaceSwitcher from "./workspace-switcher";
import DashboardTools from "./dashboard-tools";
import "./workspace.css";

type WorkspaceProject = { id: string; name: string; createdAt: string };

export default function WorkspaceHome({
  workspaceName,
  projects: initialProjects,
  user,
  selectedProject = null,
}: {
  workspaceName: string;
  projects: WorkspaceProject[];
  user: AuthenticatedUser;
  selectedProject?: WorkspaceProject | null;
}) {
  const [projects, setProjects] = useState(initialProjects);
  const [activeProject, setActiveProject] = useState(selectedProject);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canAddProject = user.role === "admin" || user.role === "reviewer";
  async function createProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ name }),
      });
      const result:any = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not add this project.");
      setProjects((current) => [...current, result.project].sort((a, b) => a.name.localeCompare(b.name)));
      setActiveProject(result.project);
      setName("");
      setAdding(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add this project.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="workspace-page">
      <header className="workspace-topbar">
        <a className="workspace-brand" href="/" aria-label="Workspace home">
          <img className="workspace-brand-logo" src="/ideahub-icon.png" alt="iDeaHub"/>
          <span><strong>Daily Delivery</strong><small>IDEAHUB × DSI</small></span>
        </a>
        <DashboardTools user={user}/>
      </header>

      <section className="workspace-content">
        <div className="workspace-context"><WorkspaceSwitcher workspaceId={user.workspaceId} workspaceName={workspaceName} canAdd={canAddProject} /><span className="workspace-context-description">Dashboard projects</span></div>
        {activeProject ? (
          <>
            <button className="workspace-back" onClick={() => { setActiveProject(null); setError(""); }}><ArrowLeft size={15} />All projects</button>
            <div className="workspace-heading">
              <div><span className="workspace-kicker">PROJECT</span><h1>{activeProject.name}</h1><p>This project has been added to {workspaceName}.</p></div>
              <span className="workspace-project-symbol"><FolderKanban size={25} /></span>
            </div>
            {activeProject.id === "dsi-delivery-tracker" ? (
              <a className="workspace-open-project" href={`/?projectId=${encodeURIComponent(activeProject.id)}`}>
                Open the delivery tracker <ArrowUpRight size={16} />
              </a>
            ) : (
              <section className="workspace-next-step">
                <Sparkles size={19} /><div><strong>Project record created</strong><p>Tasks and delivery settings can be added in a later project setup stage.</p></div>
              </section>
            )}
          </>
        ) : (
          <>
            <div className="workspace-heading">
              <div><span className="workspace-kicker">YOUR WORKSPACE</span><h1>{workspaceName}</h1><p>Choose a project to continue, or add one if you manage this workspace.</p></div>
              <span className="workspace-project-symbol"><Building2 size={25} /></span>
            </div>
            <div className="workspace-section-title"><h2>Projects</h2><span>{projects.length}</span></div>
            {projects.length ? (
              <div className="workspace-projects">
                {projects.map((project) => (
                  <button className="workspace-project-card" key={project.id} onClick={() => setActiveProject(project)}>
                    <span className="project-card-icon"><FolderKanban size={19} /></span>
                    <span className="project-card-copy"><strong>{project.name}</strong><small>Project · {workspaceName}</small></span>
                    <ArrowUpRight size={16} className="project-card-arrow" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="workspace-empty"><FolderKanban size={24} /><strong>No projects yet</strong><p>{canAddProject ? "Add the first project to this workspace." : "Ask a workspace administrator or reviewer to add a project."}</p></div>
            )}
            {canAddProject && <div className="workspace-add-area">
              {adding ? (
                <form className="workspace-add-form" onSubmit={createProject}>
                  <label htmlFor="project-name">Project name</label>
                  <input id="project-name" autoFocus maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="For example, Client onboarding" required />
                  {error && <p className="workspace-form-error" role="alert">{error}</p>}
                  <div><button type="button" className="workspace-cancel" onClick={() => { setAdding(false); setError(""); }}>Cancel</button><button className="workspace-add-button" disabled={busy || name.trim().length < 2}>{busy ? "Adding…" : "Add project"}</button></div>
                </form>
              ) : (
                <button className="workspace-add-button" onClick={() => setAdding(true)}><Plus size={17} />Add project</button>
              )}
            </div>}
          </>
        )}
      </section>
      <footer className="workspace-footer">Only members of {workspaceName} can see its project list.</footer>
    </main>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, RefreshCw } from "lucide-react";
import type { AuthenticatedUser } from "../lib/auth";
import { STATUSES, type Audit, type Task } from "../lib/delivery";
import DashboardShell from "./dashboard-shell";
import AddDeliverable from "./add-deliverable";
import { Badge, Empty, fdate, TaskDrawer } from "./delivery-components";

type Project = { id: string; name: string };
type Person = { username: string; displayName: string };
type View = "Board" | "Schedule" | "Recovery" | "History";

export default function ProjectConsole({ project, projects, workspaces, workspaceName, user }: {
  project: Project; projects: Project[]; workspaces: Project[]; workspaceName: string; user: AuthenticatedUser;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [view, setView] = useState<View>("Board");
  const [selectedId, setSelectedId] = useState("");
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState("");
  const privileged = user.role === "admin" || user.role === "reviewer";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: ({ PHT: "Asia/Manila", PDT: "Etc/GMT+7", PST: "Etc/GMT+8" } as const)[user.timezone], year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

  const loadProject = useCallback(async () => {
    const response = await fetch(`/api/state?projectId=${encodeURIComponent(project.id)}`, { cache: "no-store" });
    const result = await response.json() as { error?: string; extraTasks: Task[]; audit: Audit[] };
    if (!response.ok) throw new Error(result.error || "Could not load this project.");
    return result;
  }, [project.id]);
  const receiveProject = useCallback((result: { extraTasks: Task[]; audit: Audit[] }) => {
    setError(""); setTasks(result.extraTasks); setAudit(result.audit); setLoading(false);
  }, []);
  const loadFailed = useCallback((cause: unknown) => {
    setError(cause instanceof Error ? cause.message : "Could not load this project."); setLoading(false);
  }, []);
  const refresh = () => {
    setLoading(true);
    void loadProject().then(receiveProject).catch(loadFailed);
  };
  useEffect(() => {
    let current = true;
    void loadProject().then(result => { if (current) receiveProject(result); })
      .catch(cause => { if (current) loadFailed(cause); });
    return () => { current = false; };
  }, [loadProject, receiveProject, loadFailed]);
  useEffect(() => {
    let current = true;
    void fetch("/api/users").then(async response => {
      if (!response.ok) throw new Error("Could not load owners. Refresh to try again.");
      const result = await response.json() as { users: (Person & { active: number })[] };
      if (current) setPeople(result.users.filter((person: Person & { active: number }) => person.active));
    }).catch(cause => { if (current) setError(cause.message); });
    return () => { current = false; };
  }, []);

  const selected = tasks.find(task => task.id === selectedId);
  const visible = tasks.filter(task => (!owner || task.ownerUsername === owner) && `${task.title} ${task.workstream} ${task.owner}`.toLowerCase().includes(query.toLowerCase()));
  const recovery = visible.filter(task => task.status !== "Accepted" && (task.date < today || ["Blocked", "Deferred"].includes(task.status)));

  return <DashboardShell user={user} workspaceName={workspaceName} workspaceTree workspaceProjects={projects} workspaceList={workspaces}>
    <section className="workspace-content project-content">
      <Link className="workspace-back" href="/"><ArrowLeft size={15}/>All projects</Link>
      <div className="workspace-heading"><div><span className="workspace-kicker">{workspaceName}</span><h1>{project.name}</h1><p>Plan deliverables, record evidence, and review completed work.</p></div>{privileged && <button className="workspace-add-button" onClick={() => setAdding(true)} disabled={loading}><Plus size={16}/>Add deliverable</button>}</div>
      <ol className="setup-progress" aria-label="Workspace setup"><li className="complete">1. Workspace created</li><li className="complete">2. Project created</li><li className={tasks.length ? "complete" : ""}>3. {tasks.length ? "Deliverables added" : "Add your first deliverable"}</li></ol>
      <div className="project-summary"><span>{tasks.length} deliverables</span><span>{tasks.filter(task => task.status === "Accepted").length} accepted</span><span>{tasks.filter(task => task.status === "Review").length} awaiting review</span></div>
      <div className="project-toolbar"><nav aria-label="Project views">{(["Board", "Schedule", "Recovery", "History"] as View[]).map(item => <button key={item} aria-current={view === item ? "page" : undefined} onClick={() => setView(item)}>{item}</button>)}</nav><button className="button secondary" onClick={refresh} disabled={loading}><RefreshCw size={14}/>{loading ? "Loading…" : "Refresh"}</button></div>
      {error && <p className="alert error" role="alert">{error}</p>}
      {view !== "History" && <div className="project-filters"><label>Find deliverables<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Title, workstream, or owner"/></label><label>Owner<select value={owner} onChange={event => setOwner(event.target.value)}><option value="">All owners</option>{people.map(person => <option key={person.username} value={person.username}>{person.displayName}</option>)}</select></label></div>}
      {!loading && !tasks.length && view !== "History" ? <div className="workspace-empty"><strong>No deliverables yet</strong><p>{privileged ? "Add a deliverable with an owner, working dates, and a definition of done." : "Ask an Admin or Reviewer to add the first deliverable."}</p>{privileged && <button className="workspace-add-button" onClick={() => setAdding(true)}><Plus size={15}/>Add deliverable</button>}</div> : view === "Board" ? <div className="kanban project-board" tabIndex={0} role="region" aria-label="Project board">{STATUSES.map(status => <section className="kanban-column" key={status}><header><Badge status={status}/><b>{visible.filter(task => task.status === status).length}</b></header><div className="kanban-cards">{visible.filter(task => task.status === status).map(task => <button className="kanban-card" key={task.id} onClick={() => setSelectedId(task.id)}><span className="task-stream">{task.workstream}</span><h3>{task.title}</h3><p>{task.acceptance}</p><div><span>{task.owner}</span><span>{fdate(task.date)}</span></div>{task.date < today && task.status !== "Accepted" && <span className="overdue-label">Overdue</span>}</button>)}</div></section>)}</div> : view === "History" ? <section className="panel"><div className="panel-heading"><h2>Project activity</h2><p>Latest 150 saved updates in this project.</p></div>{audit.length ? <div className="activity-list">{audit.map(event => <article key={event.id}><div><strong>{event.actorName}</strong><p>{tasks.find(task => task.id === event.entityId)?.title || "Deliverable"} <Badge status={event.payload.status}/></p><small>Version {event.version}</small></div><time>{new Date(event.at).toLocaleString()}</time></article>)}</div> : <Empty title="No saved updates yet" detail="Updates and review decisions will appear here."/>}</section> : <section className="panel"><div className="panel-heading"><h2>{view === "Recovery" ? "Recovery queue" : "Delivery schedule"}</h2></div>{(view === "Recovery" ? recovery : visible).length ? <div className="table-scroll" tabIndex={0} role="region" aria-label="Delivery table"><table><thead><tr><th>Deliverable</th><th>Owner</th><th>Start</th><th>Due</th><th>Stage</th>{view === "Recovery" && <><th>Obstacle</th><th>Recovery owner / date</th></>}</tr></thead><tbody>{[...(view === "Recovery" ? recovery : visible)].sort((a, b) => a.date.localeCompare(b.date)).map(task => <tr key={task.id}><td><button className="text-button" onClick={() => setSelectedId(task.id)}>{task.title}</button></td><td>{task.owner}</td><td>{fdate(String(task.startDate || task.date))}</td><td>{fdate(task.date)}</td><td><Badge status={task.status}/></td>{view === "Recovery" && <><td>{task.blocker || "Reason needed"}</td><td>{task.rescueOwner || "Unassigned"}<small>{task.recoveryDate ? fdate(task.recoveryDate) : "Set a recovery date"}</small></td></>}</tr>)}</tbody></table></div> : <Empty title={view === "Recovery" ? "No deliverables need recovery" : "No matching deliverables"}/>}</section>}
    </section>
    {adding && <AddDeliverable projectId={project.id} users={people} onClose={() => setAdding(false)} onCreated={task => { setTasks(current => [...current, task]); setAdding(false); setSelectedId(task.id); }}/ >}
    {selected && <TaskDrawer key={`${selected.id}-${selected.version || 0}`} task={selected} tasks={tasks} people={Array.from(new Set([...people.map(person => person.displayName), user.displayName]))} viewer={user.displayName} username={user.username} mentionUsers={people} genericProject canManageDefinition={privileged} canEdit={privileged || user.role === "delegated_reviewer" || (user.role === "staff" && selected.ownerUsername === user.username)} onClose={() => setSelectedId("")} onSave={async data => {
      const response = await fetch("/api/state", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId: project.id, entityType: "task", entityId: selected.id, version: selected.version || 0, data }) });
      const result = await response.json() as { error?: string; value: Partial<Task>; event: Audit };
      if (!response.ok) throw new Error(result.error || "Could not save this deliverable.");
      setTasks(current => current.map(task => task.id === selected.id ? { ...task, ...result.value } : task));
      setAudit(current => [result.event, ...current].slice(0, 150)); setSelectedId("");
    }} onDelete={privileged ? async () => {
      const response = await fetch(`/api/deliverables/${encodeURIComponent(selected.id)}`, { method: "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not delete this deliverable.");
      setTasks(current => current.filter(task => task.id !== selected.id));
      setAudit(current => current.filter(event => event.entityId !== selected.id));
    } : undefined}/ >}
  </DashboardShell>;
}

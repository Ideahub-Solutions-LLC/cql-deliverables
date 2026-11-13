"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, CalendarDays, Clock, Plus, RefreshCw, Search, Target } from "lucide-react";
import type { AuthenticatedUser } from "../lib/auth";
import { STATUSES, type Audit, type Task } from "../lib/delivery";
import DashboardShell from "./dashboard-shell";
import AddDeliverable from "./add-deliverable";
import { Badge, Empty, fdate, STATUS_CLASS, TaskDrawer } from "./delivery-components";
import { PROJECT_PAGES, type ProjectPage } from "./project-pages";

type Project = { id: string; name: string };
type Workspace = { id: string; name: string };
type Person = { username: string; displayName: string };

const PAGE_DESCRIPTIONS: Record<ProjectPage, string> = {
  today: "Review the selected day's commitments, owners, and progress.",
  board: "Move project deliverables through their stages and open updates.",
  gantt: "See planned start and due dates across the project's deliverables.",
  calendar: "Review daily commitments and select a date to see its work.",
  roles: "See each owner's responsibilities and project workload.",
  scorecard: "Compare planned targets with reported results for each deliverable.",
  promises: "Connect each project commitment to its acceptance criteria and evidence.",
  recovery: "Keep overdue and blocked work visible with its recovery plan.",
  history: "Review recent project updates and the people who recorded them.",
};

function daysBetween(start: string, end: string) {
  return Math.round((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86400000);
}

export default function ProjectConsole({ project, projects, workspaces, workspaceName, user, initialTaskId, initialView = "today" }: {
  initialTaskId?: string;
  initialView?: ProjectPage;
  project: Project;
  projects: Project[];
  workspaces: Workspace[];
  workspaceName: string;
  user: AuthenticatedUser;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const view = initialView;
  const [date, setDate] = useState(() => new Intl.DateTimeFormat("en-CA", {
    timeZone: ({ PHT: "Asia/Manila", PDT: "Etc/GMT+7", PST: "Etc/GMT+8" } as const)[user.timezone],
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()));
  const [selectedId, setSelectedId] = useState(initialTaskId || "");
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState("");
  const privileged = user.role === "admin" || user.role === "reviewer";

  const loadProject = useCallback(async () => {
    const response = await fetch(`/api/state?projectId=${encodeURIComponent(project.id)}`, { cache: "no-store" });
    const result = await response.json() as { error?: string; extraTasks: Task[]; audit: Audit[] };
    if (!response.ok) throw new Error(result.error || "Could not load this project.");
    return result;
  }, [project.id]);
  const receiveProject = useCallback((result: { extraTasks: Task[]; audit: Audit[] }) => {
    setError("");
    setTasks(result.extraTasks);
    setAudit(result.audit);
    setLoading(false);
  }, []);
  const loadFailed = useCallback((cause: unknown) => {
    setError(cause instanceof Error ? cause.message : "Could not load this project.");
    setLoading(false);
  }, []);
  const refresh = () => {
    setLoading(true);
    void loadProject().then(receiveProject).catch(loadFailed);
  };

  useEffect(() => {
    let current = true;
    void loadProject().then((result) => { if (current) receiveProject(result); })
      .catch((cause) => { if (current) loadFailed(cause); });
    return () => { current = false; };
  }, [loadProject, receiveProject, loadFailed]);
  useEffect(() => {
    let current = true;
    void fetch("/api/users").then(async (response) => {
      if (!response.ok) throw new Error("Could not load owners. Refresh to try again.");
      const result = await response.json() as { users: (Person & { active: number })[] };
      if (current) setPeople(result.users.filter((person) => person.active));
    }).catch((cause: unknown) => { if (current) setError(cause instanceof Error ? cause.message : "Could not load owners."); });
    return () => { current = false; };
  }, []);

  const visible = tasks.filter((task) =>
    (!owner || task.ownerUsername === owner) &&
    `${task.title} ${task.workstream} ${task.owner} ${task.id}`.toLowerCase().includes(query.toLowerCase()));
  const dayTasks = visible.filter((task) => task.date === date);
  const recoveryTasks = visible.filter((task) => task.status !== "Accepted" &&
    (task.date < date || ["Blocked", "Deferred"].includes(task.status)));
  const selected = tasks.find((task) => task.id === selectedId);
  const page = PROJECT_PAGES.find((item) => item.id === view)!;
  const owners = [...new Set(tasks.map((task) => task.owner))].sort((a, b) => a.localeCompare(b));
  const ownerGroups = owners.map((name) => {
    const assigned = tasks.filter((task) => task.owner === name);
    return { name, assigned, accepted: assigned.filter((task) => task.status === "Accepted").length };
  });
  const monthParts = date.split("-").map(Number);
  const year = monthParts[0];
  const month = monthParts[1];
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthOffset = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const monthDates = Array.from({ length: daysInMonth }, (_, index) => `${year}-${String(month).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`);
  const timelineStart = tasks.length ? tasks.map((task) => String(task.startDate || task.date)).sort()[0] : date;
  const timelineEnd = tasks.length ? tasks.map((task) => task.date).sort().at(-1)! : date;
  const timelineDays = Math.max(daysBetween(timelineStart, timelineEnd) + 1, 1);

  async function save(data: unknown) {
    if (!selected) return;
    const response = await fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id, entityType: "task", entityId: selected.id, version: selected.version || 0, data }),
    });
    const result = await response.json() as { error?: string; value: Partial<Task>; event: Audit };
    if (!response.ok) throw new Error(result.error || "Could not save this deliverable.");
    setTasks((current) => current.map((task) => task.id === selected.id ? { ...task, ...result.value } : task));
    setAudit((current) => [result.event, ...current].slice(0, 150));
    setSelectedId("");
  }

  async function remove() {
    if (!selected) return;
    const response = await fetch(`/api/deliverables/${encodeURIComponent(selected.id)}`, { method: "DELETE" });
    const result = await response.json() as { error?: string };
    if (!response.ok) throw new Error(result.error || "Could not delete this deliverable.");
    setTasks((current) => current.filter((task) => task.id !== selected.id));
    setAudit((current) => current.filter((event) => event.entityId !== selected.id));
  }

  return <DashboardShell user={user} workspaceName={workspaceName} workspaceTree workspaceProjects={projects} workspaceList={workspaces} showProjectNavigation projectId={project.id} activePage={view}>
    <section className="workspace-content project-content">
      <div className="workspace-heading">
        <div><span className="workspace-kicker">{workspaceName} · {project.name}</span><h1>{page.label}</h1><p>{PAGE_DESCRIPTIONS[view]}</p></div>
        {privileged && <button className="workspace-add-button" onClick={() => setAdding(true)} disabled={loading}><Plus size={16}/>Add deliverable</button>}
      </div>
      <div className="project-summary"><span>{tasks.length} deliverables</span><span>{tasks.filter((task) => task.status === "Accepted").length} accepted</span><span>{tasks.filter((task) => task.status === "Review").length} awaiting review</span><button className="text-button" onClick={refresh} disabled={loading}><RefreshCw size={14}/>{loading ? "Loading…" : "Refresh"}</button></div>
      {error && <p className="alert error" role="alert">{error}</p>}
      {["today", "calendar", "gantt", "recovery"].includes(view) && <div className="project-page-tools">
        <label><CalendarDays size={15}/>Selected date<input aria-label="Selected date" type="date" value={date} onChange={(event) => setDate(event.target.value)}/></label>
      </div>}
      {["today", "board", "recovery"].includes(view) && <div className="project-filters">
        <label className="project-search"><Search size={15}/><input aria-label="Search deliverables" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search deliverables, workstreams, or owners"/></label>
        <label>Owner<select value={owner} onChange={(event) => setOwner(event.target.value)}><option value="">All owners</option>{people.map((person) => <option key={person.username} value={person.username}>{person.displayName}</option>)}</select></label>
      </div>}

      {view === "today" && <section className="panel project-view-panel">
        <div className="panel-heading"><div><h2>Daily commitments · {fdate(date, { weekday: "long", month: "long", day: "numeric" })}</h2><p>{dayTasks.length} deliverables due on this date.</p></div></div>
        {dayTasks.length ? <div className="task-list">{dayTasks.map((task) => <button className="project-task-row" key={task.id} onClick={() => setSelectedId(task.id)}>
          <div><span className="task-stream">{task.workstream}</span><h3>{task.title}</h3><p>{task.acceptance || task.deliverable}</p><small>{task.owner} · {task.dueTime || "17:00"}</small></div><Badge status={task.status}/>
        </button>)}</div> : <Empty title="No deliverables due on this date" detail={tasks.length ? "Choose another date or add a deliverable." : "Add a deliverable to start this project's daily plan."}/>}
      </section>}

      {view === "board" && <>{privileged && <div className="deliverable-actions"><p>Move work forward by updating its stage, evidence, and owner.</p><button className="button primary" onClick={() => setAdding(true)}><Plus size={15}/>Add deliverable</button></div>}
        <div className="kanban project-board" tabIndex={0} role="region" aria-label="Project workboard">{STATUSES.map((status) => {
          const column = visible.filter((task) => task.status === status);
          return <section className="kanban-column" key={status}><header><Badge status={status}/><b>{column.length}</b></header><div className="kanban-cards">{column.map((task) => <button className="kanban-card" key={task.id} onClick={() => setSelectedId(task.id)}>
            <span className="task-stream">{task.workstream}</span><h3>{task.title}</h3><p>{task.acceptance || task.deliverable}</p><div><span>{task.owner}</span><span><Clock size={12}/>{fdate(task.date)}</span></div>
          </button>)}</div></section>;
        })}</div>
      </>}

      {view === "gantt" && <section className="panel project-view-panel">
        <div className="panel-heading"><div><h2>Project timeline</h2><p>Each bar spans a deliverable&apos;s planned start and due dates.</p></div></div>
        {tasks.length ? <div className="project-gantt"><div className="project-gantt-axis"><span>{fdate(timelineStart)}</span><span>{fdate(timelineEnd)}</span></div>{[...tasks].sort((a, b) => String(a.startDate || a.date).localeCompare(String(b.startDate || b.date))).map((task) => {
          const start = String(task.startDate || task.date);
          const left = Math.max(0, daysBetween(timelineStart, start)) / timelineDays * 100;
          const width = Math.max(1, daysBetween(start, task.date) + 1) / timelineDays * 100;
          return <div className="project-gantt-row" key={task.id}><button className="project-gantt-label" onClick={() => setSelectedId(task.id)}><strong>{task.title}</strong><small>{task.owner} · {fdate(start)}–{fdate(task.date)}</small></button><div className="project-gantt-track"><button className={`project-gantt-bar ${task.status === "Accepted" ? "complete" : ""}`} style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }} title={`${task.title}: ${task.status}`} onClick={() => setSelectedId(task.id)}><span>{task.status}</span></button></div></div>;
        })}</div> : <Empty title="No timeline items yet" detail="Add deliverables with start and due dates to build the timeline."/>}
      </section>}

      {view === "calendar" && <><section className="panel month project-month">
        <h2>{fdate(`${year}-${String(month).padStart(2, "0")}-01`, { month: "long", year: "numeric" })}</h2>
        <div className="week-labels">{["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="month-days">{Array.from({ length: monthOffset }, (_, index) => <div key={`blank-${index}`}/>)}{monthDates.map((day) => {
          const dayWork = tasks.filter((task) => task.date === day);
          return <button key={day} className={`calendar-day ${day === date ? "selected" : ""} ${dayWork.some((task) => ["Blocked", "Deferred"].includes(task.status)) ? "needs-help" : dayWork.length && dayWork.every((task) => task.status === "Accepted") ? "complete" : ""}`} onClick={() => setDate(day)} title={`${dayWork.length} deliverables`}>
            <strong>{Number(day.slice(-2))}</strong><span>{dayWork.length ? `${dayWork.length} ${dayWork.length === 1 ? "item" : "items"}` : "—"}</span><div className="day-dots">{dayWork.slice(0, 4).map((task) => <i className={STATUS_CLASS[task.status]} key={task.id}/>)}</div>
          </button>;
        })}</div>
      </section><section className="panel project-view-panel"><div className="panel-heading"><h2>Deliverables · {fdate(date)}</h2></div>{tasks.filter((task) => task.date === date).length ? <div className="activity-list">{tasks.filter((task) => task.date === date).map((task) => <button className="project-activity-button" key={task.id} onClick={() => setSelectedId(task.id)}><div><strong>{task.title}</strong><p>{task.owner} · {task.workstream}</p></div><Badge status={task.status}/></button>)}</div> : <Empty title="No deliverables on this date"/>}</section></>}

      {view === "roles" && <section className="panel project-view-panel">
        <div className="panel-heading"><div><h2>Team & ownership</h2><p>Deliverable assignments and progress by owner.</p></div></div>
        {ownerGroups.length ? <div className="project-owner-grid">{ownerGroups.map((group) => <article className="project-owner-card" key={group.name}><div><strong>{group.name}</strong><span>{group.accepted}/{group.assigned.length} accepted</span></div><p>{group.assigned.length} assigned {group.assigned.length === 1 ? "deliverable" : "deliverables"}</p><ul>{group.assigned.slice(0, 5).map((task) => <li key={task.id}><button onClick={() => setSelectedId(task.id)}>{task.title}</button><Badge status={task.status}/></li>)}</ul>{group.assigned.length > 5 && <small>And {group.assigned.length - 5} more…</small>}</article>)}</div> : <Empty title="No owners assigned yet" detail="Add a deliverable and assign it to a team member."/>}
      </section>}

      {view === "scorecard" && <section className="panel project-view-panel">
        <div className="panel-heading"><div><h2>Targets & results</h2><p>Reported actuals are compared with each deliverable&apos;s target.</p></div><Target size={19}/></div>
        {tasks.length ? <div className="table-scroll" tabIndex={0} role="region" aria-label="Project targets and results"><table><thead><tr><th>Deliverable</th><th>Owner</th><th>Target</th><th>Actual</th><th>Progress</th><th>Stage</th></tr></thead><tbody>{tasks.map((task) => {
          const target = Number(task.target);
          const actual = Number(task.actual);
          const hasTarget = task.target !== null && task.target !== undefined && task.target !== "";
          const hasActual = task.actual !== null && task.actual !== undefined && task.actual !== "";
          const progress = hasTarget && hasActual && Number.isFinite(target) && target > 0 && Number.isFinite(actual) ? Math.min(100, Math.round(actual / target * 100)) : null;
          return <tr key={task.id}><td><button className="text-button" onClick={() => setSelectedId(task.id)}>{task.title}</button></td><td>{task.owner}</td><td>{hasTarget ? `${task.target} ${task.unit || ""}` : "—"}</td><td>{task.actual ?? "—"}</td><td>{progress === null ? "—" : <progress value={progress} max={100}>{progress}%</progress>}</td><td><Badge status={task.status}/></td></tr>;
        })}</tbody></table></div> : <Empty title="No results to report" detail="Add deliverables with targets to track project results."/>}
      </section>}

      {view === "promises" && <section className="panel project-view-panel">
        <div className="panel-heading"><div><h2>Commitment → delivery → evidence</h2><p>Review the acceptance criteria and delivery proof for each project commitment.</p></div></div>
        {tasks.length ? <div className="promise-grid project-promise-grid">{tasks.map((task, index) => <article key={task.id}><span className="promise-number">{String(index + 1).padStart(2, "0")}</span><h3>{task.title}</h3><div><span>OWNER · DUE DATE</span><p>{task.owner} · {fdate(task.date)}</p></div><div><span>ACCEPTANCE CRITERIA</span><p>{task.acceptance || task.deliverable || "Not specified"}</p></div><div><span>DELIVERY EVIDENCE</span><p>{task.evidence || "Not yet recorded"}</p></div><footer><Badge status={task.status}/><button className="text-button" onClick={() => setSelectedId(task.id)}>Update<ArrowRight size={14}/></button></footer></article>)}</div> : <Empty title="No commitments yet" detail="Add a deliverable to define the project's commitments."/>}
      </section>}

      {view === "recovery" && <section className="panel project-view-panel">
        <div className="panel-heading"><div><h2>Recovery queue</h2><p>Overdue, blocked, and deferred work, as of {fdate(date)}.</p></div></div>
        {recoveryTasks.length ? <div className="table-scroll" tabIndex={0} role="region" aria-label="Project recovery queue"><table><thead><tr><th>Original due</th><th>Deliverable / owner</th><th>Obstacle</th><th>Recovery owner</th><th>Recovery date</th><th>Stage</th><th/></tr></thead><tbody>{recoveryTasks.map((task) => <tr key={task.id}><td>{fdate(task.originalDueDate || task.date)}<small>{task.date < date ? "Overdue" : "Due today"}</small></td><td><button className="text-button" onClick={() => setSelectedId(task.id)}>{task.title}</button><small>{task.owner}</small></td><td>{task.blocker || "Reason needed"}</td><td>{task.rescueOwner || "Unassigned"}</td><td>{task.recoveryDate ? fdate(task.recoveryDate) : "Set a date"}</td><td><Badge status={task.status}/></td><td><button className="text-button" onClick={() => setSelectedId(task.id)}>Recover</button></td></tr>)}</tbody></table></div> : <Empty title="No recovery items" detail="Blocked, deferred, and overdue work will appear here."/>}
      </section>}

      {view === "history" && <section className="panel project-view-panel">
        <div className="panel-heading"><div><h2>Project activity</h2><p>Latest 150 saved updates in this project.</p></div><button className="text-button" onClick={refresh}><RefreshCw size={14}/>Refresh</button></div>
        {audit.length ? <div className="activity-list">{audit.map((event) => <article key={event.id}><div><strong>{event.actorName}</strong><p>{tasks.find((task) => task.id === event.entityId)?.title || "Deliverable"} <Badge status={event.payload.status || "Updated"}/></p><small>Version {event.version}</small></div><time>{new Date(event.at).toLocaleString()}</time></article>)}</div> : <Empty title="No saved updates yet" detail="Updates and review decisions will appear here."/>}
      </section>}
    </section>
    {adding && <AddDeliverable projectId={project.id} users={people} onClose={() => setAdding(false)} onCreated={(task) => { setTasks((current) => [...current, task]); setAdding(false); setSelectedId(task.id); }}/>}
    {selected && <TaskDrawer key={`${selected.id}-${selected.version || 0}`} task={selected} tasks={tasks} people={Array.from(new Set([...people.map((person) => person.displayName), user.displayName]))} viewer={user.displayName} username={user.username} mentionUsers={people} genericProject canManageDefinition={privileged} canEdit={privileged || user.role === "delegated_reviewer" || (user.role === "staff" && selected.ownerUsername === user.username)} onClose={() => setSelectedId("")} onSave={save} onDelete={privileged ? remove : undefined}/>}
  </DashboardShell>;
}

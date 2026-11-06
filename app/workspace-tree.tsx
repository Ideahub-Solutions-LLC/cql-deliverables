"use client";

import { useState } from "react";
import { Building2, ChevronRight, FolderKanban, Plus } from "lucide-react";

type WorkspaceNode = { id: string; name: string };
type WorkspaceProject = { id: string; name: string };

export default function WorkspaceTree({
  workspaceId,
  workspaceName,
  workspaces = [],
  projects = [],
  canAdd,
}: {
  workspaceId: string;
  workspaceName: string;
  workspaces?: WorkspaceNode[];
  projects?: WorkspaceProject[];
  canAdd: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const nodes = workspaces.length ? workspaces : workspaceId ? [{ id: workspaceId, name: workspaceName }] : [];

  async function switchWorkspace(id: string, destination: string, busyKey = id) {
    setError("");
    setBusy(busyKey);
    try {
      const response = await fetch("/api/auth/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ workspaceId: id }),
      });
      if (!response.ok) throw new Error("Could not switch workspace.");
      window.location.assign(destination);
    } catch {
      setError("Could not switch workspace. Try again.");
      setBusy("");
    }
  }

  function chooseWorkspace(workspace: WorkspaceNode) {
    if (workspace.id === workspaceId) {
      setOpen((current) => !current);
      return;
    }
    void switchWorkspace(workspace.id, "/");
  }

  function openProject(workspace: WorkspaceNode, project: WorkspaceProject) {
    const destination = `/?projectId=${encodeURIComponent(project.id)}`;
    if (workspace.id === workspaceId) {
      window.location.assign(destination);
      return;
    }
    void switchWorkspace(workspace.id, destination, project.id);
  }

  return (
    <div className="workspace-tree" role="navigation" aria-label="Workspaces">
      <div className="workspace-tree-heading"><Building2 size={14} aria-hidden="true" /><span>Workspace</span></div>
      {nodes.length ? (
        <ul role="tree" aria-label="Workspaces and projects">
          {nodes.map((workspace) => {
            const isCurrent = workspace.id === workspaceId;
            const isOpen = isCurrent && open;
            return (
              <li
                role="treeitem"
                aria-label={workspace.name}
                aria-selected={isCurrent}
                aria-expanded={isCurrent ? isOpen : undefined}
                key={workspace.id}
                className="workspace-tree-item"
              >
                <div className={`workspace-tree-row${isCurrent ? " current" : ""}`}>
                  {isCurrent ? (
                    <button
                      type="button"
                      className="workspace-tree-toggle"
                      aria-label={`${isOpen ? "Collapse" : "Expand"} ${workspace.name}`}
                      aria-expanded={isOpen}
                      onClick={() => setOpen((current) => !current)}
                    >
                      <ChevronRight size={13} aria-hidden="true" />
                    </button>
                  ) : (
                    <span className="workspace-tree-spacer" aria-hidden="true" />
                  )}
                  <button
                    type="button"
                    className="workspace-tree-label"
                    title={workspace.name}
                    aria-current={isCurrent ? "true" : undefined}
                    disabled={busy === workspace.id}
                    onClick={() => chooseWorkspace(workspace)}
                  >
                    <Building2 size={14} aria-hidden="true" />
                    <span>{workspace.name}</span>
                    {busy === workspace.id && <i className="workspace-tree-spinner" aria-hidden="true" />}
                  </button>
                </div>
                {isOpen && (
                  <ul role="group" className="workspace-tree-children">
                    {projects.length ? (
                      projects.map((project) => (
                        <li role="none" key={project.id}>
                          <button
                            type="button"
                            className="workspace-tree-project"
                            disabled={busy === project.id}
                            onClick={() => openProject(workspace, project)}
                          >
                            <FolderKanban size={12} aria-hidden="true" />
                            <span>{project.name}</span>
                            {busy === project.id && <i className="workspace-tree-spinner" aria-hidden="true" />}
                          </button>
                        </li>
                      ))
                    ) : (
                      <li role="none" className="workspace-tree-empty">No projects yet</li>
                    )}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="workspace-tree-empty">No workspaces yet</p>
      )}
      {error && <small className="workspace-tree-error" role="alert">{error}</small>}
      {canAdd && <a className="workspace-tree-add" href="/workspace/new"><Plus size={13} aria-hidden="true" /><span>Add workspace</span></a>}
    </div>
  );
}

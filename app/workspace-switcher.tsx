"use client";

import { useEffect, useState } from "react";
import { Building2, ChevronDown } from "lucide-react";

type Workspace = { id: string; name: string };

export default function WorkspaceSwitcher({
  workspaceId,
  workspaceName,
  canAdd,
  compact = false,
}: {
  workspaceId: string;
  workspaceName: string;
  canAdd: boolean;
  compact?: boolean;
}) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([{ id: workspaceId, name: workspaceName }]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/workspaces", { cache: "no-store" })
      .then((response) => response.json())
      .then((result:any) => setWorkspaces(result.workspaces || []))
      .catch(() => {});
  }, []);

  async function choose(value: string) {
    if (value === "__add__") {
      window.location.assign("/workspace/new");
      return;
    }
    if (!value || value === workspaceId) return;
    setBusy(true);
    try {
      const response = await fetch("/api/auth/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ workspaceId: value }),
      });
      if (!response.ok) throw new Error("Could not switch workspace.");
      window.location.assign("/");
    } catch {
      setBusy(false);
    }
  }

  return (
    <label className={`workspace-switcher${compact ? " compact" : ""}`}>
      <Building2 size={compact ? 15 : 16} aria-hidden="true" />
      {!compact && <span className="workspace-switcher-label">Workspace</span>}
      <span className="workspace-switcher-select-wrap">
        <select aria-label="Switch workspace" value={workspaceId} disabled={busy} onChange={(event) => choose(event.target.value)}>
          {canAdd && <option value="__add__">＋ Add workspace</option>}
          {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
        </select>
        <ChevronDown size={13} aria-hidden="true" />
      </span>
    </label>
  );
}

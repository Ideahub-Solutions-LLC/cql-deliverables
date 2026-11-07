"use client";

import { useState } from "react";
import { ArrowLeft, Building2, Plus } from "lucide-react";

export default function AddWorkspaceForm() {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ name }),
      });
      const result: { error?: string } = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not add this workspace.");
      window.location.assign("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add this workspace.");
      setBusy(false);
    }
  }

  return (
    <div className="dashboard-account-content">
      <section className="workspace-content">
        <div className="workspace-context"><Building2 size={16} /><span>Dashboard</span><b>Add workspace</b></div>
        <button className="workspace-back" onClick={() => window.location.assign("/")}><ArrowLeft size={15} />Back to dashboard</button>
        <div className="workspace-heading"><div><span className="workspace-kicker">WORKSPACE SETUP</span><h1>Add a workspace</h1><p>Start an empty workspace, create a project, then add deliverables with owners, dates, and review criteria.</p></div><span className="workspace-project-symbol"><Building2 size={25} /></span></div>
        <ol className="setup-progress" aria-label="Workspace setup"><li aria-current="step">1. Create workspace</li><li>2. Create project</li><li>3. Add deliverables</li></ol>
        <form className="workspace-add-form" onSubmit={submit}>
          <label htmlFor="workspace-name">Workspace name</label>
          <input id="workspace-name" autoFocus maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="For example, Client Operations" required />
          {error && <p className="workspace-form-error" role="alert">{error}</p>}
          <div><button type="button" className="workspace-cancel" onClick={() => window.location.assign("/")}>Cancel</button><button className="workspace-add-button" disabled={busy || name.trim().length < 2}>{busy ? "Adding…" : <><Plus size={16} />Add workspace</>}</button></div>
        </form>
      </section>
    </div>
  );
}

"use client";

import { useState } from "react";
import { ArrowLeft, Building2, LogOut, Plus } from "lucide-react";
import "../../workspace.css";

export default function AddWorkspaceForm({ displayName, roleName }: { displayName: string; roleName: string }) {
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
      const result:any = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not add this workspace.");
      window.location.assign("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add this workspace.");
      setBusy(false);
    }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    window.location.assign("/login");
  }

  return (
    <main className="workspace-page">
      <header className="workspace-topbar">
        <a className="workspace-brand" href="/" aria-label="Workspace dashboard"><img className="workspace-brand-logo" src="/ideahub-icon.png" alt="iDeaHub"/><span><strong>Daily Delivery</strong><small>IDEAHUB × DSI</small></span></a>
        <div className="workspace-account"><span className="workspace-avatar">{displayName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><span><strong>{displayName}</strong><small>{roleName}</small></span><button onClick={signOut} aria-label="Sign out" title="Sign out"><LogOut size={16} /></button></div>
      </header>
      <section className="workspace-content">
        <div className="workspace-context"><Building2 size={16} /><span>Dashboard</span><b>Add workspace</b></div>
        <button className="workspace-back" onClick={() => window.location.assign("/")}><ArrowLeft size={15} />Back to dashboard</button>
        <div className="workspace-heading"><div><span className="workspace-kicker">WORKSPACE SETUP</span><h1>Add a workspace</h1><p>Create a workspace for its own project list and team activity.</p></div><span className="workspace-project-symbol"><Building2 size={25} /></span></div>
        <form className="workspace-add-form" onSubmit={submit}>
          <label htmlFor="workspace-name">Workspace name</label>
          <input id="workspace-name" autoFocus maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="For example, Client Operations" required />
          {error && <p className="workspace-form-error" role="alert">{error}</p>}
          <div><button type="button" className="workspace-cancel" onClick={() => window.location.assign("/")}>Cancel</button><button className="workspace-add-button" disabled={busy || name.trim().length < 2}>{busy ? "Adding…" : <><Plus size={16} />Add workspace</>}</button></div>
        </form>
      </section>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, LockKeyhole, UserRound, ArrowRight, AlertCircle, Building2 } from "lucide-react";

type Workspace = { id: string; name: string };

export default function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/workspaces", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("Could not load workspaces.");
      const result:any = await response.json();
      setWorkspaces(result.workspaces || []);
    }).catch(() => setError("Workspaces could not be loaded. Refresh the page to try again."));
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username, password, workspaceId }),
      });
      const result:any = await response.json();
      if (!response.ok) throw new Error(result.error || "Sign-in failed. Check your details and try again.");
      window.location.assign("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-in failed. Check your details and try again.");
      setBusy(false);
    }
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <label htmlFor="workspace">Workspace</label>
      <div className="login-input-wrap login-select-wrap">
        <Building2 size={17} aria-hidden="true" />
        <select id="workspace" name="workspace" required value={workspaceId} onChange={(event) => setWorkspaceId(event.target.value)}>
          <option value="">Choose a workspace</option>
          {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
        </select>
      </div>
      <label htmlFor="username">Username</label>
      <div className="login-input-wrap">
        <UserRound size={17} aria-hidden="true" />
        <input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          required
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Enter your username"
        />
      </div>
      <label htmlFor="password">Password</label>
      <div className="login-input-wrap">
        <LockKeyhole size={17} aria-hidden="true" />
        <input
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter your password"
        />
        <button
          className="password-toggle"
          type="button"
          aria-label={showPassword ? "Hide password" : "Show password"}
          onClick={() => setShowPassword((value) => !value)}
        >
          {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
      {error && <div className="login-error" role="alert"><AlertCircle size={16} />{error}</div>}
      <button className="login-submit" type="submit" disabled={busy || !username || !password || !workspaceId || !workspaces.length}>
        <span>{busy ? "Signing in…" : "Sign in to your workspace"}</span><ArrowRight size={17} />
      </button>
      <p className="login-help">Need access? Ask your project administrator.</p>
    </form>
  );
}

"use client";
import { useEffect, useState } from "react";

export default function TeamList() {
  const [users, setUsers] = useState<{username: string; displayName: string; role: string}[]>([]);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    fetch("/api/users", { cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error();
      const result = await response.json() as { users: typeof users };
      setUsers(result.users);
    }).catch(() => setError("Could not load users. Refresh the page to try again.")).finally(() => setLoaded(true));
  }, []);
  return <section className="workspace-content"><div className="workspace-heading"><h1>List of users</h1></div>{error && <p role="alert">{error}</p>}{!loaded && <p>Loading users…</p>}<div className="user-management-list">{users.map(user => <article className="managed-user" key={user.username}><header><div><strong>{user.displayName}</strong><small>@{user.username} · {user.role.replaceAll("_", " ")}</small></div></header></article>)}</div></section>;
}

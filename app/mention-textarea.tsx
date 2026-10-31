"use client";

import { useState } from "react";

export type MentionUser = { username: string; displayName: string };

export default function MentionTextarea({ value, onChange, users, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string; onChange: (value: string) => void; users: MentionUser[] }) {
  const [search, setSearch] = useState<string | null>(null);
  const [caret, setCaret] = useState(0);
  const match = search === null ? "" : search.toLowerCase();
  const suggestions = users.filter((user) => user.displayName.toLowerCase().includes(match) || user.username.toLowerCase().includes(match)).slice(0, 6);

  function update(next: string, target: HTMLTextAreaElement) {
    onChange(next);
    const before = next.slice(0, target.selectionStart);
    const at = before.lastIndexOf("@");
    const afterAt = at >= 0 ? before.slice(at + 1) : "";
    setSearch(at >= 0 && !/\s{2}|\n/.test(afterAt) ? afterAt : null);
    setCaret(target.selectionStart);
  }

  function insert(user: MentionUser) {
    const at = value.slice(0, caret).lastIndexOf("@");
    const next = `${value.slice(0, at)}@${user.displayName} ${value.slice(caret)}`;
    onChange(next);
    setSearch(null);
  }

  return <div className="mention-field"><textarea {...props} value={value} onChange={(event) => update(event.target.value, event.target)} />{search !== null && suggestions.length > 0 && <div className="mention-suggestions" role="listbox" aria-label="Mention a user">{suggestions.map((user) => <button type="button" key={user.username} onMouseDown={(event) => event.preventDefault()} onClick={() => insert(user)}><span>{user.displayName}</span><small>@{user.username}</small></button>)}</div>}</div>;
}

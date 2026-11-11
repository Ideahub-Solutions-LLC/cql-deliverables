"use client";

import { useEffect, useId, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { DEFAULT_WORKSTREAMS, WORKSTREAM_MAX_LENGTH, cleanWorkstream, matchWorkstream } from "../lib/workstreams";

type Item = { name: string; add: boolean };

/** Dropdown of workstreams that also accepts a typed name and can add it to the shared list. */
export default function WorkstreamField({ value, onChange, disabled = false }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const [options, setOptions] = useState<string[]>([...DEFAULT_WORKSTREAMS]);
  const [open, setOpen] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const listId = useId();

  useEffect(() => {
    let live = true;
    fetch("/api/workstreams", { cache: "no-store" })
      .then(response => response.ok ? response.json() : null)
      .then((result: any) => { if (live && Array.isArray(result?.workstreams)) setOptions(result.workstreams); })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  const typed = cleanWorkstream(value);
  const shown = filtering && typed ? options.filter(name => name.toLowerCase().includes(typed.toLowerCase())) : options;
  const isNew = !!typed && !matchWorkstream(options, typed);
  const items: Item[] = [...shown.map(name => ({ name, add: false })), ...(isNew ? [{ name: typed, add: true }] : [])];

  function openList() {
    if (disabled) return;
    setOpen(true);
    setFiltering(false);
    setActive(Math.max(0, options.findIndex(name => name === value)));
  }
  function choose(name: string) { onChange(name); setOpen(false); setFiltering(false); setError(""); }
  async function add(name: string) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/workstreams", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      const result: any = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not add this workstream.");
      if (Array.isArray(result.workstreams)) setOptions(result.workstreams);
      choose(result.workstream || name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add this workstream.");
    } finally { setBusy(false); }
  }
  function pick(index: number) {
    const item = items[index];
    if (!item || busy) return;
    if (item.add) void add(item.name); else choose(item.name);
  }
  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") { event.preventDefault(); if (!open) openList(); else setActive(i => Math.min(i + 1, items.length - 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
    else if (event.key === "Enter" && open && items.length) { event.preventDefault(); pick(active); }
    else if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); }
  }
  function onBlur() {
    setOpen(false); setFiltering(false);
    onChange(matchWorkstream(options, typed) || typed);
  }

  return <label className="workstream-field">Workstream
    <div className="combo">
      <input role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={open && items[active] ? `${listId}-${active}` : undefined}
        required maxLength={WORKSTREAM_MAX_LENGTH} autoComplete="off" disabled={disabled}
        placeholder="Choose or type a workstream" value={value}
        onFocus={openList} onMouseDown={() => { if (!open) openList(); }}
        onChange={event => { onChange(event.target.value); setOpen(true); setFiltering(true); setActive(0); setError(""); }}
        onKeyDown={onKeyDown} onBlur={onBlur}/>
      <ChevronDown size={15} className="combo-caret" aria-hidden="true"/>
      {open && items.length > 0 && <ul id={listId} role="listbox" className="combo-list" aria-label="Workstreams">
        {items.map((item, index) => <li key={`${item.add ? "add" : "option"}-${item.name}`} id={`${listId}-${index}`} role="option"
          aria-selected={!item.add && item.name === value}
          className={`${index === active ? "active" : ""} ${item.add ? "add" : ""} ${!item.add && item.name === value ? "selected" : ""}`}
          onMouseDown={event => { event.preventDefault(); pick(index); }} onMouseEnter={() => setActive(index)}>
          {item.add ? <><Plus size={13}/>Add “{item.name}” as a workstream</> : item.name}
        </li>)}
      </ul>}
    </div>
    {busy ? <small>Adding workstream…</small>
      : error ? <small className="combo-error">{error}</small>
      : isNew && !open ? <small>New workstream. It is added to the list when you save.</small> : null}
  </label>;
}

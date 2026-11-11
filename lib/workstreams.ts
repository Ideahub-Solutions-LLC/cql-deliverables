// Workstream list shared by the Add deliverable and Update deliverable forms.
// Safe to import from client components: it never reads the Worker environment itself.

export const DEFAULT_WORKSTREAMS = ["Paid Ads", "LP Conversion", "Socials", "SEO", "Marketplaces", "Partnerships", "Webinars", "Reporting"] as const;
export const WORKSTREAM_MAX_LENGTH = 100;

type Database = { prepare(sql: string): { bind(...values: unknown[]): { all<T = unknown>(): Promise<{ results?: T[] }>; run(): Promise<unknown> } } };

export function cleanWorkstream(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, WORKSTREAM_MAX_LENGTH) : "";
}

export function matchWorkstream(list: readonly string[], name: string) {
  const key = cleanWorkstream(name).toLowerCase();
  return key ? list.find(item => item.toLowerCase() === key) : undefined;
}

function merge(...lists: (readonly string[])[]) {
  const merged: string[] = [];
  for (const list of lists) for (const raw of list) {
    const name = cleanWorkstream(raw);
    if (name && !matchWorkstream(merged, name)) merged.push(name);
  }
  return merged;
}

/** Defaults first, then the workspace's custom workstreams in the order they were added. */
export async function listWorkstreams(db: Database, workspaceId: string) {
  try {
    const rows = await db.prepare("SELECT name FROM delivery_workstreams WHERE workspace_id=? ORDER BY created_at,name").bind(workspaceId).all<{ name: string }>();
    return merge(DEFAULT_WORKSTREAMS, (rows.results ?? []).map(row => row.name));
  } catch {
    // Before migration 0005 is applied the defaults still work.
    return [...DEFAULT_WORKSTREAMS];
  }
}

/**
 * Returns the list's spelling of `name` (so "seo" saves as "SEO") and adds a new
 * custom name to the workspace list. With `strict`, a storage failure is thrown.
 */
export async function rememberWorkstream(db: Database, workspaceId: string, name: string, username: string, strict = false) {
  const existing = matchWorkstream(await listWorkstreams(db, workspaceId), name);
  if (existing) return existing;
  try {
    await db.prepare("INSERT OR IGNORE INTO delivery_workstreams (workspace_id,name,created_by,created_at) VALUES (?,?,?,?)")
      .bind(workspaceId, name, username, new Date().toISOString()).run();
  } catch (error) {
    if (strict) throw error;
  }
  return name;
}

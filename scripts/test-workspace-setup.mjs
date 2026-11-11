// Runs the real route handlers against an isolated SQLite database. No local or hosted data is changed.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { build } from "esbuild";
import { resolve, dirname, extname } from "node:path";
import { existsSync } from "node:fs";

const sqlite = new DatabaseSync(":memory:");
sqlite.exec("PRAGMA foreign_keys=OFF");
for (const file of readdirSync("drizzle").filter(name => name.endsWith(".sql")).sort()) {
  sqlite.exec(readFileSync(`drizzle/${file}`, "utf8"));
}
for (const [username, role] of [["marco", "admin"], ["reviewer", "reviewer"], ["staff", "staff"], ["viewer", "viewer"]]) {
  sqlite.prepare("INSERT INTO delivery_users (username,display_name,role,password_salt,password_hash,password_iterations) VALUES (?,?,?,?,?,?)")
    .run(username, username, role, "test", "test", 1);
}
sqlite.exec("PRAGMA foreign_keys=ON");
const DB = {
  prepare(sql) {
    const stmt = sqlite.prepare(sql);
    let values = [];
    return {
      bind(...args) { values = args; return this; },
      async first() { return stmt.get(...values) || null; },
      async all() { return { results: stmt.all(...values) }; },
      async run() { return { meta: stmt.run(...values) }; },
    };
  },
  async batch(statements) {
    sqlite.exec("BEGIN");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.all());
      sqlite.exec("COMMIT");
      return results;
    } catch (error) { sqlite.exec("ROLLBACK"); throw error; }
  },
};
globalThis.__workspaceTest = { env: { DB }, user: null };
const routes = {};
for (const name of ["notifications", "workspaces", "projects", "deliverables", "deliverables/[id]", "state", "comments", "comments/[id]", "workstreams"]) {
  const bundled = await build({
    entryPoints: [`app/api/${name}/route.ts`], bundle: true, write: false, format: "esm", platform: "node", logLevel: "silent", tsconfigRaw: {},
    plugins: [{ name: "isolated-test-environment", setup(builder) {
      builder.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: "env", namespace: "test" }));
      builder.onLoad({ filter: /.*/, namespace: "test" }, () => ({ contents: "export const env=globalThis.__workspaceTest.env;" }));
      builder.onResolve({ filter: /^next\/headers$/ }, () => ({ path: "headers", namespace: "headers" }));
      builder.onLoad({ filter: /.*/, namespace: "headers" }, () => ({ contents: "export const headers=()=>new Headers();" }));
      builder.onResolve({ filter: /^(?:\.|app\/)/ }, args => {
        const base = resolve(args.importer ? dirname(args.importer) : process.cwd(), args.path);
        const path = [base, `${base}.ts`, `${base}.json`].find(candidate => existsSync(candidate));
        return path ? { path, namespace: "source" } : null;
      });
      builder.onLoad({ filter: /[\\/]lib[\\/]auth\.ts$/ }, args => {
        let contents = readFileSync(args.path, "utf8");
        const start = contents.indexOf("export async function getAuthenticatedUser(");
        const end = contents.indexOf("export function sessionCookie", start);
        assert.ok(start >= 0 && end > start);
        contents = contents.slice(0, start) + "export async function getAuthenticatedUser(){return globalThis.__workspaceTest.user;}\n" + contents.slice(end);
        return { contents, loader: "ts" };
      });
      builder.onLoad({ filter: /.*/, namespace: "source" }, args => ({ contents: readFileSync(args.path, "utf8"), loader: extname(args.path) === ".json" ? "json" : "ts" }));
    } }],
  });
  routes[name] = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
}
function login(username, workspaceId) {
  const row = sqlite.prepare("SELECT * FROM delivery_users WHERE username=?").get(username);
  globalThis.__workspaceTest.user = { username, userId: username, displayName: row.display_name, role: row.role, workspaceId, personId: null };
}
let checks = 0;
async function call(route, method, body, expected = 200, params = {}, query = "") {
  const request = new Request(`http://localhost/api/${route}${query}`, { method, headers: { "Content-Type": "application/json", origin: "http://localhost" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const response = await routes[route][method](request, { params: Promise.resolve(params) });
  const result = await response.json();
  assert.equal(response.status, expected, `${method} ${route}: ${JSON.stringify(result)}`);
  checks++;
  return result;
}
try {
  await call("workspaces", "POST", { name: "Unauthorized" }, 401);
  login("marco", "digital-smile-innovations");
  const { workspace } = await call("workspaces", "POST", { name: "Stage 4 test" }, 201);
  login("reviewer", workspace.id);
  const { project } = await call("projects", "POST", { name: "New delivery flow" }, 201);
  await call("projects", "POST", { name: project.name }, 409);
  const empty = await call("state", "GET", null, 200, {}, `?projectId=${project.id}`);
  assert.deepEqual(empty.extraTasks, []);
  assert.deepEqual(empty.audit, []);
  assert.deepEqual(empty.metrics, {});
  assert.deepEqual(empty.milestones, {});
  const definition = { projectId: project.id, title: "Fresh deliverable", ownerUsername: "staff", workstream: "Operations", startDate: "2026-11-06", dueDate: "2026-11-10", acceptance: "Approved output link", target: 2, unit: "items" };
  await call("deliverables", "POST", { ...definition, dueDate: "2026-02-30" }, 400);
  const { task } = await call("deliverables", "POST", definition, 201);
  login("staff", workspace.id);
  await call("workspaces", "POST", { name: "Staff workspace" }, 403);
  await call("projects", "POST", { name: "Staff project" }, 403);
  await call("deliverables", "POST", definition, 403);
  const progress = { projectId: project.id, entityType: "task", entityId: task.id, version: 0, data: { status: "In progress", evidence: "Draft output", actual: 1 } };
  await call("state", "POST", { ...progress, data: { ...progress.data, title: "Staff change" } }, 403);
  await call("state", "POST", progress);
  await call("state", "POST", { ...progress, version: 1, data: { status: "Accepted", evidence: "Output", actual: 2 } }, 403);
  login("reviewer", workspace.id);
  await call("state", "POST", { ...progress, version: 1, data: { status: "Accepted", actual: 2 } }, 400);
  await call("state", "POST", { ...progress, version: 1, data: { status: "Accepted", actual: 1, evidence: "Output" } }, 400);
  await call("state", "POST", { ...progress, version: 1, data: { status: "Blocked" } }, 400);
  const accepted = await call("state", "POST", { ...progress, version: 1, data: { status: "Accepted", actual: 2, evidence: "Approved output", title: "Reviewed title", acceptance: "New criteria", startDate: definition.startDate, dueDate: definition.dueDate } });
  assert.equal(accepted.value.acceptedBy, "reviewer");
  assert.ok(accepted.value.closedAt);
  await call("state", "POST", { ...progress, version: 1, data: { status: "Ready", title: "Stale title" } }, 409);
  const stored = await call("state", "GET", null, 200, {}, `?projectId=${project.id}`);
  assert.equal(stored.extraTasks[0].title, "Reviewed title");
  assert.equal(stored.extraTasks[0].status, "Accepted");
  const listed = await call("deliverables", "GET", null, 200, {}, `?projectId=${project.id}`);
  assert.equal(listed.tasks[0].title, "Reviewed title");
  assert.equal(listed.tasks[0].status, "Accepted");
  // Workstreams: eight defaults, custom names added explicitly or on save, scoped to the workspace.
  const defaults = ["Paid Ads", "LP Conversion", "Socials", "SEO", "Marketplaces", "Partnerships", "Webinars", "Reporting"];
  assert.deepEqual((await call("workstreams", "GET")).workstreams, [...defaults, "Operations"], "A custom workstream saved on a new deliverable joins the list");
  await call("deliverables", "POST", { ...definition, workstream: "  " }, 400);
  const { task: seoTask } = await call("deliverables", "POST", { ...definition, title: "SEO audit", workstream: "seo" }, 201);
  assert.equal(seoTask.workstream, "SEO", "A typed default uses the list spelling");
  await call("workstreams", "POST", { name: "" }, 400);
  const added = await call("workstreams", "POST", { name: "  Email   Nurture " }, 201);
  assert.equal(added.workstream, "Email Nurture");
  assert.equal((await call("workstreams", "POST", { name: "email nurture" }, 201)).workstreams.filter(name => name === "Email Nurture").length, 1, "No case-insensitive duplicates");
  const moved = await call("state", "POST", { projectId: project.id, entityType: "task", entityId: seoTask.id, version: 0, data: { status: "Ready", workstream: "Affiliates" } });
  assert.equal(moved.value.workstream, "Affiliates");
  assert.ok((await call("workstreams", "GET")).workstreams.includes("Affiliates"), "A custom workstream set on update joins the list");
  assert.equal((await call("deliverables", "GET", null, 200, {}, `?projectId=${project.id}`)).tasks.find(item => item.id === seoTask.id).workstream, "Affiliates");
  await call("state", "POST", { projectId: project.id, entityType: "task", entityId: seoTask.id, version: 1, data: { status: "Ready", workstream: "" } }, 400);
  login("staff", workspace.id);
  await call("workstreams", "POST", { name: "Staff stream" }, 403);
  await call("state", "POST", { projectId: project.id, entityType: "task", entityId: seoTask.id, version: 1, data: { status: "In progress", workstream: "Paid Ads" } }, 403);
  assert.deepEqual((await call("workstreams", "GET")).workstreams.slice(0, 8), defaults);
  login("reviewer", "ideahub");
  assert.deepEqual((await call("workstreams", "GET")).workstreams, defaults, "Custom workstreams stay in their own workspace");
  login("reviewer", workspace.id);
  await call("deliverables/[id]", "DELETE", null, 200, { id: seoTask.id });
  const { comment } = await call("comments", "POST", { taskId: task.id, content: "Project comment" }, 201);
  const { project: second } = await call("projects", "POST", { name: "Second project" }, 201);
  const otherProject = await call("state", "GET", null, 200, {}, `?projectId=${second.id}`);
  assert.deepEqual(otherProject.extraTasks, []);
  assert.deepEqual(otherProject.audit, []);
  await call("state", "POST", { ...progress, projectId: second.id }, 404);
  await call("state", "POST", { ...progress, entityType: "metrics", entityId: "2026-11-06" }, 400);
  login("staff", "ideahub");
  const notices = await call("notifications", "GET");
  const assignment = notices.notifications.find(notice => notice.taskId === task.id);
  assert.ok(assignment, "Assigned staff receives a notification even from another workspace");
  assert.equal(assignment.projectId, project.id);
  assert.equal(assignment.workspaceId, workspace.id);
  await call("notifications", "PATCH", { id: assignment.id });
  assert.ok((await call("notifications", "GET")).notifications.find(notice => notice.id === assignment.id).readAt);
  login("viewer", "ideahub");
  assert.ok(!(await call("notifications", "GET")).notifications.some(notice => notice.id === assignment.id));
  login("reviewer", "ideahub");
  await call("state", "GET", null, 403, {}, `?projectId=${project.id}`);
  await call("state", "POST", { ...progress, version: 2 }, 403);
  await call("deliverables", "POST", definition, 403);
  await call("comments", "GET", null, 404, {}, `?taskId=${task.id}`);
  await call("comments", "POST", { taskId: task.id, content: "Wrong workspace" }, 400);
  await call("comments/[id]", "PATCH", { content: "Wrong workspace" }, 404, { id: comment.id });
  await call("comments/[id]", "DELETE", null, 404, { id: comment.id });
  await call("deliverables/[id]", "DELETE", null, 404, { id: task.id });
  login("marco", "digital-smile-innovations");
  const legacy = await call("state", "GET", null, 200, {}, "?projectId=dsi-delivery-tracker");
  assert.deepEqual(legacy.extraTasks, []);
  assert.deepEqual(legacy.audit, []);
  const source = JSON.parse(readFileSync("app/data/plan.json", "utf8"));
  const legacyTask = source.tasks.find(task => !task.dependencies?.length);
  sqlite.prepare("INSERT INTO delivery_notifications (id,recipient_username,actor_username,task_id,kind,message,created_at) VALUES (?,?,?,?,?,?,?)")
    .run("legacy-notice", "marco", "reviewer", legacyTask.id, "mention", "Legacy mention", new Date().toISOString());
  const legacyNotice = (await call("notifications", "GET")).notifications.find(notice => notice.id === "legacy-notice");
  assert.equal(legacyNotice.projectId, "dsi-delivery-tracker");
  assert.equal(legacyNotice.workspaceId, "digital-smile-innovations");
  const legacyReview = { projectId: "dsi-delivery-tracker", entityType: "task", entityId: legacyTask.id, version: 0, data: { status: "Accepted", evidence: "Legacy test proof", actual: Number(legacyTask.target) || 1 } };
  const delegation = await call("state", "POST", legacyReview, 400);
  assert.match(delegation.error, /delegat|Wyline/);
  await call("state", "POST", { ...legacyReview, data: { ...legacyReview.data, reviewNote: "Existing approval reference" } });
  login("viewer", workspace.id);
  await call("state", "POST", { ...progress, version: 2 }, 403);
  login("staff", workspace.id);
  await call("state", "POST", { ...progress, version: 2 }, 403);
  login("reviewer", workspace.id);
  await call("state", "POST", { ...progress, version: 2, data: { status: "Blocked", blocker: "Awaiting input", rescueOwner: "staff", recoveryDate: "2026-11-12" } });
  login("staff", workspace.id);
  await call("state", "POST", { ...progress, version: 3, data: { status: "Review", evidence: "Revised output", actual: 2 } });
  const afterStaff = await call("state", "GET", null, 200, {}, `?projectId=${project.id}`);
  assert.equal(afterStaff.extraTasks[0].title, "Reviewed title");
  assert.equal(afterStaff.extraTasks[0].acceptance, "New criteria");
  login("reviewer", workspace.id);
  await call("comments/[id]", "PATCH", { content: "Updated comment" }, 200, { id: comment.id });
  await call("deliverables/[id]", "DELETE", null, 200, { id: task.id });
  const removed = await call("state", "GET", null, 200, {}, `?projectId=${project.id}`);
  assert.deepEqual(removed.extraTasks, []);
  assert.deepEqual(removed.audit, []);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM delivery_comments WHERE task_id=?").get(task.id).n, 0);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM delivery_notifications WHERE task_id=?").get(task.id).n, 0);
  console.log(`Passed ${checks} route checks: empty setup, roles, review, persistence, conflicts, project/workspace isolation, comments, and deletion.`);
} finally {
  sqlite.close();
  delete globalThis.__workspaceTest;
}

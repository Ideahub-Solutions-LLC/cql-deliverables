// Render real client components with synthetic API responses. No database or accounts are changed.
// Requires Playwright and Chromium: optionally set PLAYWRIGHT_MODULE and CHROMIUM_PATH.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { build } from "esbuild";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const output = resolve("work/responsive");
mkdirSync(output, { recursive: true });
const plan = JSON.parse(readFileSync("app/data/plan.json", "utf8"));
const user = {
  userId: "responsive-test", username: "responsive-test", displayName: "Responsive Test Administrator",
  firstName: "Responsive", lastName: "Test Administrator", role: "admin", active: 1,
  personId: plan.people[0].id, workspaceId: "test-workspace", email: "test@example.invalid",
  timezone: "PST", themeMode: "default", avatarData: null,
};
const workspaceName = "Workspace with a long name for responsive layout verification";
const projects = [{ id: "test-project", name: "Project" + "WithALongUnbrokenTitle".repeat(8), createdAt: "2026-11-07" }];
const tasks = plan.tasks.slice(0, 6).map((task, index) => ({
  ...task, id: `test-${index}`, status: ["Ready", "In progress", "Blocked", "Review", "Accepted", "Deferred"][index],
  title: index ? task.title : "LongUnbrokenDeliverableTitle".repeat(8),
  owner: user.displayName, ownerUsername: user.username,
  acceptance: "Verify evidence and completion. " + "LongEvidence".repeat(20),
}));
const fixture = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import DashboardShell from './app/dashboard-shell';
import DeliveryConsole from './app/delivery-console';
import ProjectConsole from './app/project-console';
import WorkspaceHome from './app/workspace-home';
import ProfileForm from './app/profile/profile-form';
import SettingsForm from './app/settings/settings-form';
import PasswordForm from './app/change-password/password-form';
import UserDirectory from './app/user-directory';
import AddWorkspaceForm from './app/workspace/new/workspace-form';
import LoginForm from './app/login/login-form';
import SignupForm from './app/signup/signup-form';
import plan from './app/data/plan.json';
const user=${JSON.stringify(user)}, projects=${JSON.stringify(projects)}, workspaceName=${JSON.stringify(workspaceName)};
const workspaces=[{id:user.workspaceId,name:workspaceName}];
const mode=new URLSearchParams(location.search).get('mode')||'delivery';
let content;
if(mode==='delivery') content=<DeliveryConsole user={user} plan={plan} projectId="test-project" workspaceName={workspaceName}/>;
else if(mode==='project') content=<ProjectConsole user={user} project={projects[0]} projects={projects} workspaces={workspaces} workspaceName={workspaceName}/>;
else if(mode==='workspace') content=<WorkspaceHome user={user} projects={projects} workspaces={workspaces} workspaceName={workspaceName}/>;
else if(mode==='login'||mode==='signup') content=<main className="login-page"><div className="login-art"/><section className={'login-panel '+(mode==='signup'?'signup-panel':'')}><div className="login-brand"><strong>Daily Delivery</strong></div><div className="login-copy"><h1>Good work starts with a clear view.</h1></div>{mode==='login'?<LoginForm/>:<SignupForm/>}</section></main>;
else content=<DashboardShell user={user} workspaceName={workspaceName}>{mode==='profile'?<ProfileForm user={user}/>:mode==='settings'?<SettingsForm user={user}/>:mode==='password'?<PasswordForm/>:<section className="workspace-content">{mode==='users'?<UserDirectory currentUsername={user.username} isAdmin/>:<AddWorkspaceForm/>}</section>}</DashboardShell>;
createRoot(document.getElementById('root')).render(content);
`;
const bundled = await build({
  stdin: { contents: fixture, resolveDir: process.cwd(), loader: "tsx" },
  bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic", tsconfigRaw: {},
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [{ name: "fixture-links", setup(builder) {
    builder.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "fixture" }));
    builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
      contents: 'import React from "react";export default function Link(props){return React.createElement("a",props)}',
      resolveDir: process.cwd(),
    }));
    builder.onResolve({ filter: /.*/ }, args => {
      const root = args.resolveDir || (args.importer ? dirname(args.importer) : process.cwd());
      if (args.path.startsWith(".")) {
        const base = resolve(root, args.path);
        const path = [base, `${base}.tsx`, `${base}.ts`, `${base}.js`, `${base}.json`].find(file => existsSync(file));
        if (path) return { path };
      }
      return { path: createRequire(resolve(root, "fixture.cjs")).resolve(args.path) };
    });
  } }],
});
const css = ["app/globals.css", "app/workspace.css", "app/login/login.css", "app/responsive.css"]
  .map(file => readFileSync(file, "utf8").replace('@import "tailwindcss";', "")).join("\n");
const server = createServer((req, res) => {
  if (req.url.startsWith("/api/")) {
    res.setHeader("Content-Type", "application/json");
    if (req.method !== "GET") { res.writeHead(405); res.end('{"error":"Fixture is read only"}'); return; }
    res.end(JSON.stringify({
      users: [user, { ...user, username: "other-test-user", displayName: "Other test user" }],
      notifications: [{ id: "notice-1", kind: "assignment", message: "LongNotification".repeat(25), actorName: "Test", createdAt: "2026-11-07", readAt: null }],
      workspaces: [{ id: user.workspaceId, name: workspaceName }], projects,
      overrides: {}, metrics: {}, milestones: {}, extraTasks: tasks, deletedTaskIds: [],
      audit: [], syncedAt: "2026-11-07T00:00:00Z",
    }));
  } else if (req.url === "/fixture.js") { res.setHeader("Content-Type", "text/javascript"); res.end(bundled.outputFiles[0].text); }
  else if (req.url === "/fixture.css") { res.setHeader("Content-Type", "text/css"); res.end(css); }
  else if (req.url === "/ideahub-icon.png") { res.setHeader("Content-Type", "image/png"); res.end(readFileSync("public/ideahub-icon.png")); }
  else { res.setHeader("Content-Type", "text/html"); res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>'); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
let checks = 0;
const widths = [320, 375, 430, 640, 768, 1023, 1024, 1280, 1920, 2560];
const results = [];
try {
  browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  async function fits(label) {
    await page.evaluate(() => Promise.all(document.getAnimations()
      .filter(animation => animation.effect.getComputedTiming().iterations !== Infinity)
      .map(animation => animation.finished.catch(() => {}))));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const layout = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth,
      overflow: [...document.querySelectorAll("body *")].filter(el => {
        const box = el.getBoundingClientRect();
        if (!box.width || getComputedStyle(el).visibility === "hidden" || el.closest(".table-scroll,.gantt-scroll,.kanban,.sidebar,.hero-art,.login-art")) return false;
        return box.right > innerWidth + 1 || box.left < -1;
      }).slice(0, 10).map(el => ({ tag: el.tagName, class: el.className })) }));
    if (layout.scroll > layout.width + 1 || layout.overflow.length) await page.screenshot({ path: `${output}/failure.png`, fullPage: true });
    assert.ok(layout.scroll <= layout.width + 1, `${label}: page overflow ${JSON.stringify(layout)}`);
    assert.deepEqual(layout.overflow, [], `${label}: element overflow`);
    assert.deepEqual(errors, [], `${label}: browser errors`);
    checks++; results.push(label);
  }
  async function navigateView(label, width) {
    if (width < 1024) await page.getByRole("button", { name: "Open navigation", exact: true }).click();
    await page.locator(".sidebar").getByRole("button", { name: new RegExp(`^${label}`) }).click();
  }
  for (const width of widths) {
    await page.setViewportSize({ width, height: width < 640 ? 740 : 900 });
    for (const mode of ["workspace", "project", "profile", "settings", "password", "users", "new-workspace", "login", "signup", "delivery"]) {
      await page.goto(`${base}/?mode=${mode}`); await page.waitForLoadState("networkidle");
      await fits(`${mode} at ${width}`);
      if (mode === "workspace" && width < 1024) {
        const trigger = page.getByRole("button", { name: "Open navigation", exact: true });
        await trigger.click();
        assert.equal(await trigger.getAttribute("aria-expanded"), "true");
        await page.keyboard.press("Shift+Tab");
        assert.equal(await page.evaluate(() => !!document.activeElement.closest(".sidebar")), true);
        await page.keyboard.press("Escape");
        await trigger.evaluate(el => { if (document.activeElement !== el) throw Error("Navigation focus not restored"); });
        assert.equal(await page.locator(".sidebar").getAttribute("inert"), "");
        checks++;
      }
      if (mode === "project") {
        await page.getByRole("button", { name: "Schedule", exact: true }).click(); await fits(`project schedule at ${width}`);
        await page.getByRole("button", { name: "Recovery", exact: true }).click(); await fits(`project recovery at ${width}`);
        await page.getByRole("button", { name: "Add deliverable", exact: true }).first().click();
        await fits(`add drawer at ${width}`);
        const rows = await page.locator(".drawer .form-row").first().evaluate(el => getComputedStyle(el).gridTemplateColumns.split(" ").length);
        assert.equal(rows, width < 640 ? 1 : 2);
        await page.getByRole("button", { name: "Close", exact: true }).click(); checks++;
      }
      if (mode === "delivery") {
        for (const view of ["Work board", "Gantt timeline", "Day-by-day map", "Team & ownership", "Targets & results", "Proposal to delivery", "Recovery desk", "Activity log", "List of users"]) {
          await navigateView(view, width); await fits(`${view} at ${width}`);
        }
        await page.getByRole("button", { name: /Notifications,/ }).click(); await fits(`notification at ${width}`);
        if ([375, 768, 1920].includes(width)) await page.screenshot({ path: `${output}/delivery-${width}.png`, fullPage: true });
      }
      if (width >= 1920 && mode === "workspace") {
        const box = await page.locator(".workspace-content").boundingBox();
        assert.ok(box.width > width - 300, "Workspace still capped on a wide desktop"); checks++;
      }
    }
    console.log(`Passed responsive layouts at ${width}px`);
  }
  // Phone landscape, enlarged text, and reduced motion are separate from width-only checks.
  await page.setViewportSize({ width: 740, height: 360 });
  await page.goto(`${base}/?mode=project`); await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Add deliverable", exact: true }).first().click();
  await fits("landscape drawer");
  const footer = page.locator(".drawer-footer");
  assert.ok((await footer.boundingBox()).y < 360, "Drawer actions out of view");
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(await page.locator(".drawer").evaluate(el => getComputedStyle(el).animationName), "none"); checks++;
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto(`${base}/?mode=profile`); await page.waitForLoadState("networkidle");
  await page.addStyleTag({ content: "html { font-size: 200%; } body { zoom: 2; }" });
  await fits("profile at 200% zoom");
  if (process.env.APP_URL) {
    for (const width of [320, 768, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ["login", "signup"]) {
        await page.goto(`${process.env.APP_URL}/${route}`); await page.waitForLoadState("networkidle");
        await page.locator(".login-form").waitFor();
        await fits(`running app ${route} at ${width}`);
        const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
        assert.ok(viewport.includes("width=device-width") && !viewport.includes("user-scalable=no"));
        await page.screenshot({ path: `${output}/live-${route}-${width}.png`, fullPage: true });
      }
    }
  }
  writeFileSync(`${output}/results.json`, JSON.stringify({ checks, widths, results }, null, 2));
  console.log(`Passed ${checks} responsive layout and interaction checks. Screenshots: work/responsive`);
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}

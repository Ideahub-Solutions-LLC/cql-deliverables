# PMS - technical handoff

This package gives IdeaHub's technical team the application source and a concrete migration brief for company-controlled hosting, a company URL, staff sign-in, and a later AI employee reporting extension.

## Start here

1. Read `docs/DEPLOYMENT_HANDOFF.md` before choosing deployment commands.
2. Import this directory into a **private** repository in the company's GitHub organization.
3. Choose the hosting path: the existing company server, or company-owned Cloudflare Workers/D1.
4. Replace platform authentication, implement account-bound permissions, and configure persistent storage.
5. Pilot with Wyline and one staff member, migrate any live data, then launch the company URL.
6. Add AI reporting only after the human workflow is accepted. Read `docs/AI_REPORTING_DESIGN.md`.

## What you are receiving

- React/TypeScript application with nine views, 494 dated tasks, 21 gates, 58 calendar dates and 13 people/roles.
- The complete base plan in `app/data/plan.json`.
- Task, milestone and metric validation in `lib/delivery.ts`.
- Current Worker API, D1 schema/migration, UI components, assets and dependency lockfile.
- The Excel tracker, PDF execution map, CSV task list and two PNG diagrams under `public/downloads/`.
- Deployment, migration, access-control and AI reporting requirements under `docs/`.
- The original source provenance record and export SHA-256 manifest, plus handoff and access-control documentation.

## Current implementation versus migration work

| Included today | Work for the technical team |
| --- | --- |
| Vinext/Vite React app running as a Cloudflare Worker | Company production hosting and domain |
| App-owned sign-in, disabled-by-default signup, profile updates and Admin/Reviewer account controls | Company SSO/session verification and production onboarding |
| Workspace-scoped D1 projects, additional DSI deliverables, comments and in-app alerts | Company-controlled database and complete data migration |
| Recorded reviewer name and signed-in editor audit | Server-enforced staff, reviewer, administrator and agent permissions |
| Manual daily business results | Later verified CQL integration and AI report submission |
| Current-state export plus latest 150 audit events | Full historical export/import and tested backups |

**This is a source handoff, not a completed self-hosted release or production database backup.** The current `npm start` command runs a local Wrangler preview. It is not a company production server command. Changing DNS alone does not move the application's identity, runtime or data.

## Provenance

The source baseline was exported from the published application at commit `acf4a6c9b6af7d262984ba977bbc78f5e2c453d3` (version 1). This working checkout includes subsequent local account, workspace, profile, deliverable, notification, and comment features described in `docs/ACCESS_CONTROL.md` and `docs/DEPLOYMENT_HANDOFF.md`.

Reference application: https://dsi-daily-delivery-oct-dec-2026.ideahub-9058.chatgpt.site

The original managed Site `project_id` is removed from `.openai/hosting.json` to prevent accidental reuse. The original starter README is preserved as `README_PLATFORM_BASELINE.md`; handoff documents and provenance are included. The D1 binding declaration remains for local inspection.

Credentials, Git metadata/history, `node_modules`, generated builds, local tool state and local/production databases are not included. The archive does not contain hosted task updates made after publication. Existing vendor license files are retained.

## Quick start: initialize and run locally

Requirements: Node.js `>=22.13.0`, npm, and Python for the optional account seeder. From the repository root:

```bash
npm run install:ci
npm run build
```

The local app uses Wrangler's persistent local D1 database. On a **fresh** checkout, apply the migrations once, in order:

```bash
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_brief_taskmaster.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_accounts_and_sessions.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_workspaces_and_projects.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0003_profiles_tasks_comments_notifications.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0004_task_owner_account.sql
```

To create local sign-in accounts, place the private credential document at the ignored path `notes/credential.docx`, then run `npm run accounts:seed -- notes/credential.docx`. This step is optional for building the app, but needed to sign in with seeded accounts. Keep the credential document out of Git. See `docs/ACCESS_CONTROL.md` for account details.

Start the development server:

```bash
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). `npm start` runs a built Wrangler preview on localhost using the same local database. The `.wrangler/state` database and generated build are local state; migrations should not be rerun against an already initialized database.

These commands are for local development. They do not deploy to Cloudflare production. The company Cloudflare Worker, D1 database, authentication, secrets, migrations, and custom domain require the setup described in `docs/DEPLOYMENT_HANDOFF.md`. Do not point local development at production resources.

For production planning, read `docs/DEPLOYMENT_HANDOFF.md` before choosing a hosting path. Revalidate identity, dependencies and production settings on the team's chosen target platform.

## Success criteria

The company URL is ready when Wyline can sign in with a company-approved account, a staff member can submit proof for an assigned task, only an authorized reviewer can accept it, another session sees the persisted change, overdue work remains visible, and a tested backup can restore the full history.

For the AI phase, one scoped agent must submit a report for human review without changing accepted work or double-counting sales results. AI report receipt is distinct from human acceptance.

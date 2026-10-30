# DSI Daily Delivery - technical handoff

**Planning date: October 22, 2026. Business owner: Wyline.**

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
- A source provenance record and SHA-256 file manifest.

## Current implementation versus migration work

| Included today | Work for the technical team |
| --- | --- |
| Vinext/Vite React app running as a Cloudflare Worker | Company production hosting and domain |
| Platform-provided ChatGPT identity | Company SSO/session verification and staff onboarding |
| Shared data in Cloudflare D1 | Company-controlled database and complete data migration |
| Recorded reviewer name and signed-in editor audit | Server-enforced staff, reviewer, administrator and agent permissions |
| Manual daily business results | Later verified CQL integration and AI report submission |
| Current-state export plus latest 150 audit events | Full historical export/import and tested backups |

**This is a source handoff, not a completed self-hosted release or production database backup.** The current `npm start` command runs a local Wrangler preview. It is not a company production server command. Changing DNS alone does not move the application's identity, runtime or data.

## Provenance

The source was exported from the published application at commit `acf4a6c9b6af7d262984ba977bbc78f5e2c453d3` (version 1).

Reference application: https://dsi-daily-delivery-oct-dec-2026.ideahub-9058.chatgpt.site

The application code in this export is unchanged from that commit. Export-only changes: this handoff README replaces the starter README; the original is preserved as `README_PLATFORM_BASELINE.md`; the original managed Site `project_id` is removed from `.openai/hosting.json` to prevent accidental reuse; handoff documents and provenance are added. The D1 binding declaration remains for local inspection.

Credentials, Git metadata/history, `node_modules`, generated builds, local tool state and local/production databases are not included. The archive does not contain hosted task updates made after publication. Existing vendor license files are retained.

## Local inspection

Use Node.js at least `22.13.0` as declared in the supplied package. Begin with the lockfile and the documented portable workflow in `docs/DEPLOYMENT_HANDOFF.md`. Revalidate dependencies and production settings on the team's chosen target platform.

## Success criteria

The company URL is ready when Wyline can sign in with a company-approved account, a staff member can submit proof for an assigned task, only an authorized reviewer can accept it, another session sees the persisted change, overdue work remains visible, and a tested backup can restore the full history.

For the AI phase, one scoped agent must submit a report for human review without changing accepted work or double-counting sales results. AI report receipt is distinct from human acceptance.

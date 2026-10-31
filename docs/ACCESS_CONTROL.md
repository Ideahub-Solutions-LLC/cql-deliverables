# Local sign-in and access control

## Sign in

The app uses its own username and password page at `/login`. Account passwords are stored as per-account PBKDF2-SHA-256 hashes (310,000 iterations); the browser receives a random, HTTP-only session cookie and the database stores only its SHA-256 hash. Sessions expire after eight hours. Use HTTPS for any hosted environment.

Before sign-in, choose one of the configured workspaces: Digital Smile Innovations, iDeaHub, or Right Team Provider. The existing delivery tracker belongs to Digital Smile Innovations. Projects added in other workspaces are workspace-scoped project records.

For a local checkout, keep the private credential document under the ignored `notes/` directory. Apply the baseline and account migrations, seed accounts, then apply the workspace and profile/task migrations (the workspace migration seeds the existing tracker project and attributes it to Marco). Build the app and run:

```bash
npm run accounts:seed -- notes/credential.docx
```

The document importer briefly creates an ignored local JSON file, passes it to the account seeder, and deletes it when seeding finishes. The seeder hashes passwords before writing account records to local D1 and removes its temporary SQL file. Keep the credential source out of Git. The seeder is local-only; production account provisioning, recovery, company SSO, and account lifecycle administration still need a company-controlled process.

## Roles

| Role | Access |
| --- | --- |
| Admin | Edit all deliverables and gates, approve or reopen work, record daily actuals, and export project data. |
| Reviewer | Edit and review project work, approve or return deliverables, and record daily actuals. |
| Delegated reviewer | Edit and review project work; an approval must include the delegation reference. Cannot record official daily actuals. |
| Staff | View the project and update assigned work. Cannot accept or reopen accepted work, or record official daily actuals. |
| Viewer | Read-only project access. |

The server assigns the accepting reviewer from the authenticated account; it ignores a client-selected reviewer name. Staff updates are checked against the task owner in `app/data/plan.json`. API checks enforce these rules even if a client bypasses the disabled controls.

Only Admin and Reviewer accounts can add workspace projects. The API derives workspace ownership from the signed-in session; the browser cannot choose another workspace when creating or listing projects. The DSI tracker state API is limited to its Digital Smile Innovations project.

Admin and Reviewer accounts can also add workspaces from the dashboard switcher. The new workspace becomes their active workspace; switching workspaces updates only the current session. Login opens the selected workspace dashboard directly.

Self-sign-up stores a strong-password hash and creates a disabled Staff account. An Admin or Reviewer must enable it before login. Enabled users can edit their own profile, change their password after verifying the current password, set a PST/PDT/PHT preference, and choose a theme. Admin and Reviewer accounts can also edit user profiles and enable/disable users, except they cannot disable themselves.

Additional DSI deliverables, comments, and in-app assignment/tag/reply notifications are stored in D1. Admin and Reviewer accounts can add, edit definitions/dates, and delete deliverables. Staff see their own tasks first and can update only assigned work. Comment editing/deletion is limited to its author; comments with replies cannot be deleted. Images inside task evidence/notes and outbound email notifications remain unavailable until a host domain and delivery/storage service are configured.

The supplied credential document says Marco and Ludwig have full delivery control, while its access table labels Ludwig as Staff. This build maps Ludwig to Admin to honor the full-control instruction. Wyline is Reviewer; the delegated-reviewer account must leave a review reference; Viewer stays read-only. Staff accounts without a matching person in the base-plan roster can still be assigned added deliverables, but do not receive edits to base-plan work until an administrator provisions a person mapping.

This account layer is suitable for local project sign-in. Do not treat it as a completed production identity system: the company-hosted release still needs approved identity, account provisioning and recovery, secure deployment configuration, and a production-safe account import path.

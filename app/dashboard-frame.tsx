import { env } from "cloudflare:workers";
import type { AuthenticatedUser } from "../lib/auth";
import DashboardShell from "./dashboard-shell";

export default async function DashboardFrame({ user, children }: { user: AuthenticatedUser; children: React.ReactNode }) {
  const workspace = user.workspaceId ? await env.DB!.prepare("SELECT name FROM workspaces WHERE id = ? AND active = 1").bind(user.workspaceId).first<{ name: string }>() : null;
  return <DashboardShell user={user} workspaceName={workspace?.name}>{children}</DashboardShell>;
}

import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "../../../lib/auth";
import AddWorkspaceForm from "./workspace-form";
import DashboardFrame from "../../dashboard-frame";

export const dynamic = "force-dynamic";

export default async function AddWorkspacePage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  if (user.role !== "admin" && user.role !== "reviewer") redirect("/");
  return <DashboardFrame user={user}><AddWorkspaceForm /></DashboardFrame>;
}

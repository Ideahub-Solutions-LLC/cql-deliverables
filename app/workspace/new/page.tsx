import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "../../../lib/auth";
import AddWorkspaceForm from "./workspace-form";

export const dynamic = "force-dynamic";

export default async function AddWorkspacePage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  if (user.role !== "admin" && user.role !== "reviewer") redirect("/");
  return <AddWorkspaceForm displayName={user.displayName} roleName={user.role === "admin" ? "Administrator" : "Reviewer"} />;
}

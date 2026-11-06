import TeamList from "../team-list";
import DashboardFrame from "../dashboard-frame";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "../../lib/auth";
import UserManagement from "./user-management";
export const dynamic="force-dynamic";
export default async function UsersPage(){const user=await getAuthenticatedUser();if(!user)redirect("/login");if(user.role!=="admin"&&user.role!=="reviewer")return <DashboardFrame user={user}><TeamList/></DashboardFrame>;return <DashboardFrame user={user}><UserManagement currentUsername={user.username} isAdmin={user.role==="admin"}/></DashboardFrame>;}

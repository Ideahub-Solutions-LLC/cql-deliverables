import DashboardFrame from "../dashboard-frame";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "../../lib/auth";
import SettingsForm from "./settings-form";
export const dynamic="force-dynamic";
export default async function SettingsPage(){const user=await getAuthenticatedUser();if(!user)redirect("/login");return <DashboardFrame user={user}><SettingsForm user={user}/></DashboardFrame>;}

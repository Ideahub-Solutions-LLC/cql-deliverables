import DashboardFrame from "../dashboard-frame";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "../../lib/auth";
import ProfileForm from "./profile-form";

export const dynamic="force-dynamic";
export default async function ProfilePage(){const user=await getAuthenticatedUser();if(!user)redirect("/login");return <DashboardFrame user={user}><ProfileForm user={user}/></DashboardFrame>;}

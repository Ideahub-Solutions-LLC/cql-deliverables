import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "../../lib/auth";
import PasswordForm from "./password-form";
export const dynamic="force-dynamic";
export default async function ChangePasswordPage(){const user=await getAuthenticatedUser();if(!user)redirect("/login");return <PasswordForm displayName={user.displayName}/>;}

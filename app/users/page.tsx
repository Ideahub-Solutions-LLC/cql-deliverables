import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "../../lib/auth";
import UserManagement from "./user-management";
export const dynamic="force-dynamic";
export default async function UsersPage(){const user=await getAuthenticatedUser();if(!user)redirect("/login");if(user.role!=="admin"&&user.role!=="reviewer")redirect("/");return <UserManagement currentUsername={user.username} displayName={user.displayName}/>;}

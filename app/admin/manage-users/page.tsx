import ManageUsersClient from './ManageUsersClient'
import { getCurrentUser } from "@/app/actions";
import { Role } from "@prisma/client";
import { redirect } from "next/navigation";

export default async function ManageUsersPage() {
  const user = await getCurrentUser();
  
  // Verify if user is admin
  if (!user || user.role !== Role.ADMIN) {
    redirect("/");
  }

  return <ManageUsersClient userRole={user.role} />
}

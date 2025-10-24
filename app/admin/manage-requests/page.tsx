import RequestsClient from './RequestsClient'
import { getCurrentUser } from "@/app/actions";
import { Role } from "@prisma/client";
import { redirect } from "next/navigation";

export default async function ManageRequestsPage() {
  const user = await getCurrentUser();
  
  // Vérifier si l'utilisateur est admin
  if (!user || user.role !== Role.ADMIN) {
    redirect("/");
  }

  return <RequestsClient userRole={user.role} />
}

import { getCurrentUser } from "../actions";
import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import AdminClient from "./AdminClient";

export default async function AdminPage() {
  const user = await getCurrentUser();
  
  // Vérifier si l'utilisateur est admin
  if (!user || user.role !== Role.ADMIN) {
    redirect("/");
  }

  return <AdminClient />;
}

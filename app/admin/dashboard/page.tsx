import { getCurrentUser } from "../../actions";
import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  
  // Vérifier si l'utilisateur est admin
  if (!user || user.role !== Role.ADMIN) {
    redirect("/");
  }

  return <DashboardClient />;
}


import { getCurrentUser, getProjectsCreatedByUser } from "./actions";
import { Role } from "@prisma/client";
import HomeClient from "./components/HomeClient";
import { Project } from "@/type";

export default async function Home() {
  const user = await getCurrentUser();
  const userRole = user?.role || Role.USER;
  const email = user?.email as string;

  let initialProjects: Project[] = []; // Specify type here
      if (email) {
    const { projects } = await getProjectsCreatedByUser(email);
    initialProjects = projects;
  }

  return (
    <HomeClient userRole={userRole} initialProjects={initialProjects} />
  );
}

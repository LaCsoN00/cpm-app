import { getCurrentUser, getProjectInfo } from "@/app/actions";
import { createClient } from "@/utils/supabase/server";
import React from "react";
import EmptyState from "@/app/components/EmptyState";
import ProjectDetailsClient from "@/app/project/[projectId]/ProjectDetailsClient";
import { Role } from "@prisma/client";

const Page = async ({ params: paramsPromise }: { params: Promise<{ projectId: string }> }) => {
  const supabase = createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();
  if (!supabaseUser) {
    return <div>Accès non autorisé</div>; // Ou rediriger vers la page de connexion
  }

  const params = await paramsPromise; // Await the promise to get the actual params object

  const project = await getProjectInfo(params.projectId, true);
  const user = await getCurrentUser(); // Get current user and their role
  const userRole = user?.role || Role.USER; // Default to USER if not found

  if (!project) {
    return <EmptyState
    imageSrc="/empty-project.png"
    imageAlt="Picture of an empty project"
    message="Projet non trouvé"
  />;
  }

  return <ProjectDetailsClient project={project} projectId={params.projectId} userRole={userRole} />;
};

export default Page;

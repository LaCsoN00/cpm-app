import { getProjectInfo } from "@/app/actions";
import { auth } from "@clerk/nextjs/server";
import React from "react";
import EmptyState from "@/app/components/EmptyState";
import ProjectDetailsClient from "@/app/project/[projectId]/ProjectDetailsClient";

const Page = async ({ params: paramsPromise }: { params: Promise<{ projectId: string }> }) => {
  const { userId } = await auth();
  if (!userId) {
    return <div>Accès non autorisé</div>; // Ou rediriger vers la page de connexion
  }

  const params = await paramsPromise; // Await the promise to get the actual params object

  const project = await getProjectInfo(params.projectId, true);

  if (!project) {
    return <EmptyState
    imageSrc="/empty-project.png"
    imageAlt="Picture of an empty project"
    message="Projet non trouvé"
  />;
  }

  return <ProjectDetailsClient project={project} projectId={params.projectId} />;
};

export default Page;

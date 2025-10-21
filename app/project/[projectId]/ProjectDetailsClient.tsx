
"use client";

import { deleteTaskById } from "@/app/actions";
import ProjectComponent from "@/app/components/ProjectComponent";
import UserInfo from "@/app/components/UserInfo";
import Wrapper from "@/app/components/Wrapper";
import { Project } from "@/type";
import { useUser } from "@clerk/nextjs";
import {
  CircleCheckBig,
  CopyPlus,
  ListTodo,
  Loader,
  SlidersHorizontal,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import EmptyState from "@/app/components/EmptyState";
import TaskComponent from "@/app/components/TaskComponent";
import TaskCardMobile from "@/app/components/TaskCardMobile";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import { deleteProjectById } from "@/app/actions";
import { deleteProjectFromIdb, addPendingChange } from "@/lib/idb";

type ProjectDetailsClientProps = {
  project: Project;
  projectId: string;
};

const ProjectDetailsClient: React.FC<ProjectDetailsClientProps> = ({ project: initialProject, projectId }) => {
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(initialProject);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [assignedFilter, setAssignedFilter] = useState<boolean>(false);
  const [taskCounts, setTaskCounts] = useState({
    todo: 0,
    inProgress: 0,
    done: 0,
    assigned: 0,
  });

  // Refetch project info if initial project changes (e.g., after an update)
  useEffect(() => {
    setProject(initialProject);
  }, [initialProject]);

  useEffect(() => {
    if (project && project.tasks && email) {
      const counts = {
        todo: project.tasks.filter((task) => task.status === "To Do").length,
        inProgress: project.tasks.filter((task) => task.status == "In Progress")
          .length,
        done: project.tasks.filter((task) => task.status == "Done").length,
        assigned: project.tasks.filter((task) => task?.user?.email == email)
          .length,
      };
      setTaskCounts(counts);
    }
  }, [project, email]);

  const filteredTasks = project?.tasks?.filter((task) => {
    const statusMatch = !statusFilter || task.status === statusFilter;
    const assignedMatch = !assignedFilter || task?.user?.email === email;
    return statusMatch && assignedMatch;
  });

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTaskById(taskId);
      toast.success("Tâche supprimée !");
      router.refresh(); // Rafraîchir la page pour recharger les données du projet
    } catch (error) {
      console.error("Erreur lors de la suppression de la tâche:", error);
      toast.error("Erreur lors de la suppression de la tâche");
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      if (!navigator.onLine) {
        // Handle offline deletion
        await addPendingChange({
          userId: email as string,
          data: { id: projectId },
          timestamp: new Date().toISOString(),
          type: 'project_delete',
        });
        await deleteProjectFromIdb(projectId);
        toast.success("Projet marqué pour suppression hors ligne !");
        router.push("/general-projects");
        return;
      }

      await deleteProjectById(projectId);
      await deleteProjectFromIdb(projectId); // Supprimer également d'IndexedDB
      toast.success("Projet supprimé !");
      router.push("/general-projects"); // Rediriger vers la page des projets généraux après suppression
    } catch (error) {
      console.error("Erreur lors de la suppression du projet:", error);
      toast.error("Erreur lors de la suppression du projet");
    }
  };

  return (
    <Wrapper>
      <div className="md:flex md:flex-row flex-col">
        <div className="md:w-1/4">
          <div className="p-5 border border-base-300 rounded-xl mb-6">
            <UserInfo
              role="Créé par"
              email={project?.createdBy?.email || null}
              name={project?.createdBy?.name || null}
              imageUrl={project?.createdBy?.imageUrl || null}
            />
          </div>

          <div className="w-full">
            {project && (
              <ProjectComponent project={project} admin={project.createdBy?.email === email ? 1 : 0} style={false} onDelete={handleDeleteProject} />
            )}
          </div>
        </div>

        <div className="mt-6 md:ml-6 md:mt-0 md:w-3/4">
          <div className="md:flex md:justify-between">
            <div className="flex flex-col">
              <div className="space-x-2 mt-2">
                <button
                  onClick={() => {
                    setStatusFilter("");
                    setAssignedFilter(false);
                  }}
                  className={`btn btn-sm ${!statusFilter ? "btn-primary" : ""}`}
                >
                  <SlidersHorizontal className="w-4" /> Tous (
                  {project?.tasks?.length || 0})
                </button>

                <button
                  onClick={() => {
                    setStatusFilter("To Do");
                  }}
                  className={`btn btn-sm ${
                    statusFilter === "To Do" ? "btn-primary" : ""
                  }`}
                >
                  <ListTodo className="w-4" />A faire ({taskCounts.todo})
                </button>

                <button
                  onClick={() => {
                    setStatusFilter("In Progress");
                  }}
                  className={`btn btn-sm ${
                    statusFilter === "In Progress" ? "btn-primary" : ""
                  }`}
                >
                  <Loader className="w-4" />
                  En cours ({taskCounts.inProgress})
                </button>
              </div>
              <div className="space-x-2 mt-2">
                <button
                  onClick={() => {
                    setStatusFilter("Done");
                  }}
                  className={`btn btn-sm ${
                    statusFilter === "Done" ? "btn-primary" : ""
                  }`}
                >
                  <CircleCheckBig className="w-4" />
                  Finis ({taskCounts.done})
                </button>

                <button
                  onClick={() => {
                    setAssignedFilter(!assignedFilter);
                  }}
                  className={`btn btn-sm ${
                    assignedFilter ? "btn-primary" : ""
                  }`}
                >
                  <UserCheck className="w-4" />
                  Vos tâches ({taskCounts.assigned})
                </button>
              </div>
            </div>
            <Link
              href={`/new-tasks/${projectId}`}
              className="btn btn-sm mt-2 md:mt-0"
            >
              Nouvelle tâche
              <CopyPlus className="w-4" />
            </Link>
          </div>
          <div className="mt-6 border border-base-300 p-5 shadow-sm rounded-xl">
            {filteredTasks && filteredTasks.length > 0 ? (
              <>
                {/* Vue mobile en cards */}
                <div className="md:hidden">
                  {filteredTasks.map((task, index) => (
                    <TaskCardMobile key={task.id} task={task} index={index} email={email} onDelete={handleDeleteTask} />
                  ))}
                </div>

                {/* Vue desktop en table inchangée */}
                <div className="hidden md:block overflow-auto">
                  <table className="table table-lg">
                    <thead>
                      <tr>
                        <th></th>
                        <th>Titre</th>
                        <th>Assigné à</th>
                        <th>A livré le</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody className="w-fit">
                      {filteredTasks.map((task, index) => (
                        <tr key={task.id} className="border-t last:border-none">
                          <TaskComponent
                            task={task}
                            index={index}
                            onDelete={handleDeleteTask}
                            email={email}
                          />                      
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <EmptyState
                imageSrc="/empty-task.png"
                imageAlt="Picture of an empty project"
                message="0 tâche à afficher"
              />
            )}
          </div>
        </div>
      </div>
    </Wrapper>
  );
};

export default ProjectDetailsClient;

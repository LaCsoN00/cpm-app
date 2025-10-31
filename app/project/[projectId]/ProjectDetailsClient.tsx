
"use client";

import { deleteTaskById } from "@/app/actions";
import ProjectComponent from "@/app/components/ProjectComponent";
import UserInfo from "@/app/components/UserInfo";
import Wrapper from "@/app/components/Wrapper";
import { Project } from "@/type";
import { useSupabaseUser } from "../../hooks/useSupabaseUser";
import { Role } from "@prisma/client";
import {
  CircleCheckBig,
  CopyPlus,
  ListTodo,
  Loader,
  SlidersHorizontal,
  UserCheck,
  RefreshCw, // Ajout de RefreshCw
} from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState, useCallback } from "react";
import EmptyState from "@/app/components/EmptyState";
import TaskComponent from "@/app/components/TaskComponent";
import TaskCardMobile from "@/app/components/TaskCardMobile";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import { deleteProjectById } from "@/app/actions";
import { deleteProjectFromIdb, addPendingChange } from "@/lib/idb";
import { getProjectTasks } from "@/app/actions";
import { Task } from "@/type";
import EditProjectForm from "@/app/components/EditProjectForm"; // Import the new form component
import SelectCollaboratorsModal from "@/app/components/SelectCollaboratorsModal"; // Import the new modal
import TaskRequestFormModal from "@/app/components/TaskRequestFormModal"; // Import the new TaskRequestFormModal

type ProjectDetailsClientProps = {
  project: Project;
  projectId: string;
  userRole: Role; // Add userRole prop
};

const ProjectDetailsClient: React.FC<ProjectDetailsClientProps> = ({ project: initialProject, projectId, userRole }) => {
  const { user, loading } = useSupabaseUser(); // Destructure loading from useSupabaseUser
  const email = user?.email; // Re-introduce email
  const router = useRouter();

  console.log("User object from hook:", user);
  console.log("User ID from hook:", user?.id);
  console.log("Initial Project CreatedBy ID:", initialProject.createdById);
  console.log("User Role (from props):", userRole);
  console.log("Is user loading (from hook):", loading);
  console.log("initialProject.createdById:", initialProject.createdById);
  console.log("user?.id:", user?.id);
  console.log("userRole === Role.USER:", userRole === Role.USER);
  console.log("initialProject.isConsultantProject:", initialProject.isConsultantProject);
  console.log("Contenu complet de initialProject.users (avant filtrage):", initialProject.users);
  console.log("ID du créateur du projet (initialProject.createdById):", initialProject.createdById);
  console.log("userRole === Role.USER:", userRole === Role.USER);
  console.log("initialProject.isConsultantProject:", initialProject.isConsultantProject);
  console.log("initialProject.users (détail):");
  initialProject.users?.forEach((pu, index) => console.log(`  Collaborateur ${index}:`, pu.user.id));
  console.log("initialProject.users?.some(pu => pu.userId === user?.id):", initialProject.users?.some(pu => pu.user.id === user?.id));
  console.log("Condition for buttons: ", !loading && (
    (initialProject.createdById === user?.id && userRole === Role.USER && !initialProject.isConsultantProject) ||
    (userRole === Role.USER && initialProject.isConsultantProject && initialProject.users && initialProject.users.some(pu => pu.user.id === user?.id))
  ));

  const [project, setProject] = useState<Project | null>(initialProject);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [assignedFilter, setAssignedFilter] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState(""); // Nouvel état pour la recherche
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc"); // Nouvel état pour le tri
  const [currentPage, setCurrentPage] = useState(1); // Nouvel état pour la pagination
  const [totalItems, setTotalItems] = useState(0); // Nouvel état pour le nombre total de tâches filtrées/recherchées
  const itemsPerPage = 5; // Nombre d'éléments par page, peut être ajusté
  const [collaboratorsCountDisplay, setCollaboratorsCountDisplay] = useState(0); // New state for collaborators count
  const [taskCounts, setTaskCounts] = useState({
    todo: 0,
    inProgress: 0,
    done: 0,
    late: 0, // Add new state for late tasks
    assigned: 0,
  });
  const [displayedPaginatedTasks, setDisplayedPaginatedTasks] = useState<Task[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false); // State to control edit modal
  const [isAssistanceModalOpen, setIsAssistanceModalOpen] = useState(false); // State to control assistance modal (for the task request form)
  const [isSelectCollaboratorsModalOpen, setIsSelectCollaboratorsModalOpen] = useState(false); // New state for collaborators selection modal
  const [refreshing, setRefreshing] = useState(false); // Nouvel état pour le rafraîchissement

  console.log("Client-side userRole prop:", userRole);

  // Refetch project info if initial project changes (e.g., after an update)
  const fetchProjectData = useCallback(async () => { // Déclaration de fetchProjectData avec useCallback
    if (!projectId) return;

    setRefreshing(true); // Début du rafraîchissement

    try {
      const skip = (currentPage - 1) * itemsPerPage;

      // Fetch project info (without tasks initially, or if tasks are already handled separately)
      // The initialProject prop already contains the project details
      setProject(initialProject);

      const { tasks: paginatedTasks, totalCount } = await getProjectTasks(
        projectId,
        skip,
        itemsPerPage,
        searchTerm,
        sortOrder,
        statusFilter,
        assignedFilter,
        email || undefined
      );
      setTotalItems(totalCount);
      setDisplayedPaginatedTasks(paginatedTasks);
    } catch (error) {
      console.error("Erreur lors du chargement des tâches:", error);
      toast.error("Erreur lors du chargement des tâches.");
    } finally {
      setRefreshing(false); // Fin du rafraîchissement
    }
  }, [projectId, currentPage, itemsPerPage, searchTerm, sortOrder, statusFilter, assignedFilter, email, initialProject]); // Ajout des dépendances

  useEffect(() => {
    fetchProjectData();
  }, [fetchProjectData]); // Ajout de fetchProjectData aux dépendances du useEffect

  useEffect(() => {
    if (initialProject && initialProject.tasks && email) {
      const counts = {
        todo: initialProject.tasks.filter((task) => task.status === "To Do").length,
        inProgress: initialProject.tasks.filter((task) => task.status == "In Progress")
          .length,
        done: initialProject.tasks.filter((task) => task.status == "Done").length,
        late: initialProject.tasks.filter((task) => task.status == "Late").length, // Calculate late tasks
        assigned: initialProject.tasks.filter((task) => task?.user?.email == email)
          .length,
      };
      setTaskCounts(counts);
    }
  }, [initialProject, email]);

  useEffect(() => {
    if (initialProject && initialProject.users && initialProject.createdById) {
      const count = initialProject.users.filter(
        (userEntry) => userEntry.user.id !== initialProject.createdById
      ).length;
      setCollaboratorsCountDisplay(count);
    }
  }, [initialProject]);

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
    <Wrapper userRole={userRole}>
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
              <ProjectComponent project={project} userRole={userRole} createdById={project.createdById} currentUserId={user?.id || ''} style={false} onDelete={handleDeleteProject} collaboratorsCount={collaboratorsCountDisplay} />
            )}
          </div>
        </div>

        <div className="mt-6 md:ml-6 md:mt-0 md:w-3/4">
          <div className="md:flex md:justify-between">
            <div className="flex flex-col">
              <div className="flex flex-wrap gap-2 mt-2">
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
                    setStatusFilter("Late");
                  }}
                  className={`btn btn-sm ${
                    statusFilter === "Late" ? "btn-primary" : ""
                  }`}
                >
                  <Loader className="w-4" />
                  En retard ({taskCounts.late})
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
            {!loading && user?.id && (
              (initialProject.createdById === user.id && userRole === Role.USER && !initialProject.isConsultantProject) ||
              (userRole === Role.USER && initialProject.isConsultantProject && initialProject.users && initialProject.users.some(pu => pu.user.id === user?.id))
            ) && (
              <div className="flex flex-col md:flex-row gap-2 mt-2 md:mt-0">
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="btn btn-sm btn-outline btn-primary"
                >
                  Modifier le projet
                </button>
                <Link
                  href={`/new-tasks/${projectId}`}
                  className="btn btn-sm"
                >
                  Nouvelle tâche
                  <CopyPlus className="w-4" />
                </Link>
              </div>
            )}
            {/* New button for consultants to request assistance */}
            {!loading && userRole === Role.CONSULTANT && (
              <div className="flex flex-col md:flex-row gap-2 mt-2 md:mt-0">
                <button
                  onClick={() => {
                    console.log("DBG: Button clicked - userRole at click:", userRole);
                    setIsSelectCollaboratorsModalOpen(true);
                  }}
                  className="btn btn-sm btn-outline btn-info"
                >
                  Demander de l&#39;assistance
                </button>
              </div>
            )}
          </div>
          <div className='flex flex-col md:flex-row items-center justify-between mb-6 gap-4 mt-6'>
            <div className='flex flex-col sm:flex-row items-center gap-4 w-full md:w-2/3'>
                <input
                    type="text"
                    placeholder="Rechercher une tâche..."
                    className='w-full p-3 input input-bordered rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200'
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <select
                    className='select select-bordered w-full sm:w-auto rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 min-w-fit'
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
                >
                    <option value="asc">Trier par titre (A-Z)</option>
                    <option value="desc">Trier par titre (Z-A)</option>
                </select>
            </div>
            {/* Bouton Actualiser */}
            <button
              onClick={fetchProjectData}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors w-full sm:w-auto justify-center mt-4 sm:mt-0"
              title="Actualiser la liste des tâches"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:block">{refreshing ? 'Actualisation...' : 'Actualiser'}</span>
            </button>
          </div>
          <div className="mt-6 border border-base-300 p-5 shadow-sm rounded-xl">
            {displayedPaginatedTasks && displayedPaginatedTasks.length > 0 ? (
              <>
                {/* Vue mobile en cards */}
                <div className="md:hidden">
                  {displayedPaginatedTasks.map((task, index) => (
                    <TaskCardMobile key={task.id} task={task} index={index} email={email} onDelete={handleDeleteTask} userRole={userRole} project={project as Project} />
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
                        <th>Priorité</th>
                        <th>A livré le</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody className="w-fit">
                      {displayedPaginatedTasks.map((task, index) => (
                        <tr key={task.id} className="border-t last:border-none">
                          <TaskComponent
                            task={task}
                            index={index}
                            onDelete={handleDeleteTask}
                            email={email}
                            userRole={userRole}
                            project={project as Project} // Pass the project object
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
          {totalItems > itemsPerPage && (
              <div className="flex justify-center mt-8">
                  <div className="join">
                      <button
                          className="join-item btn"
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                      >
                          «
                      </button>
                      {[...Array(Math.ceil(totalItems / itemsPerPage))].map((_, index) => (
                          <button
                              key={index + 1}
                              className={`join-item btn ${currentPage === index + 1 ? "btn-active" : ""}`}
                              onClick={() => setCurrentPage(index + 1)}
                          >
                              {index + 1}
                          </button>
                      ))}
                      <button
                          className="join-item btn"
                          onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalItems / itemsPerPage), prev + 1))}
                          disabled={currentPage === Math.ceil(totalItems / itemsPerPage)}
                      >
                          »
                      </button>
                  </div>
              </div>
          )}
        </div>
      </div>
      <dialog id="edit_project_modal" className="modal" open={isEditModalOpen}>
        <div className="modal-box">
          <h3 className="font-bold text-lg">Modifier le projet</h3>
          {project && <EditProjectForm project={project} onClose={() => {
            setIsEditModalOpen(false);
            router.refresh(); // Refresh to reflect changes
          }} />}
        </div>
      </dialog>
      {/* Assistance Request Modal (for task request) */}
      <dialog id="assistance_request_modal" className="modal" open={isAssistanceModalOpen}>
        <div className="modal-box">
          <h3 className="font-bold text-lg">Émettre un besoin de tâche</h3>
          {project && <TaskRequestFormModal
            projectId={project.id}
            onClose={() => setIsAssistanceModalOpen(false)}
          />}
        </div>
      </dialog>
      {/* Select Collaborators Modal */}
      <dialog id="select_collaborators_modal" className="modal" open={isSelectCollaboratorsModalOpen}>
        <div className="modal-box">
          <h3 className="font-bold text-lg">Sélectionner des collaborateurs</h3>
          {isSelectCollaboratorsModalOpen && project && <SelectCollaboratorsModal // Conditionally render the component
            projectId={project.id}
            onClose={() => setIsSelectCollaboratorsModalOpen(false)}
            onCollaboratorsSelected={() => {
              // After collaborators are selected and added, open the task request modal
              setIsSelectCollaboratorsModalOpen(false);
              setIsAssistanceModalOpen(true); // Open the task request modal
              router.refresh(); // Refresh to reflect new collaborators
            }}
          />}
        </div>
      </dialog>
    </Wrapper>
  );
};

export default ProjectDetailsClient;
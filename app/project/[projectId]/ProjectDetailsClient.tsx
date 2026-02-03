
"use client";

import { deleteTaskById, deleteProjectById, getProjectTasks, respondToAssistanceRequest } from "@/app/actions";
import ProjectComponent from "@/app/components/ProjectComponent";
import UserInfo from "@/app/components/UserInfo";
import Wrapper from "@/app/components/Wrapper";
import type { Project, Task, AssistanceRequest } from "@/type";
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
import { deleteProjectFromIdb, addPendingChange } from "@/lib/idb";
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
  const itemsPerPage = 4; // Nombre d'éléments par page, peut être ajusté
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
  const [assistanceRequests, setAssistanceRequests] = useState<AssistanceRequest[]>(initialProject.assistanceRequests || []);
  const [assistanceActionLoading, setAssistanceActionLoading] = useState<string | null>(null);

  console.log("Client-side userRole prop:", userRole);

  const isProjectOwner = user?.id === initialProject.createdById;
  // Vérifier si l'utilisateur est collaborateur - utiliser pu.user.id (relation Prisma)
  const isProjectCollaborator = initialProject.users?.some((pu) => pu.user?.id === user?.id) ?? false;
  // Autoriser le créateur ou tout collaborateur USER à traiter les demandes
  const canModerateAssistanceRequests = !!user?.id && userRole === Role.USER && (isProjectOwner || isProjectCollaborator);
  const viewingOwnRequestsOnly = userRole === Role.CONSULTANT && !canModerateAssistanceRequests;
  const canViewRequestsPanels = userRole === Role.USER && (isProjectOwner || isProjectCollaborator);
  const canEditProject = !!user?.id && !loading && (
    userRole === Role.ADMIN ||
    isProjectOwner ||
    (!initialProject.isConsultantProject && userRole === Role.USER && isProjectCollaborator)
  );
  const canCreateTask = !!user?.id && !loading && (
    userRole === Role.ADMIN ||
    isProjectOwner ||
    userRole === Role.USER
  );

  const assistanceRequestsToDisplay = viewingOwnRequestsOnly && user?.id
    ? assistanceRequests.filter((request) => request.consultantId === user.id)
    : assistanceRequests;

  const combinedRequests = [
    ...assistanceRequestsToDisplay.map((request) => ({
      id: request.id,
      type: "assistance" as const,
      title: request.taskName || request.consultant?.name || "Demande d'assistance",
      description: request.message,
      status: request.status,
      priority: request.taskPriority || null,
      deadline: request.taskDeadline || null,
      consultantName: request.consultant?.name,
      createdAt: request.createdAt,
      resolvedAt: request.resolvedAt,
      resolvedBy: request.resolvedBy?.name,
      comments: request.taskDescription || null,
    })),
  ].sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateB - dateA;
  });

  const pendingRequestsCount = combinedRequests.filter((request) => request.status === "pending").length;
  const requestsEmptyMessage = viewingOwnRequestsOnly
    ? "Vous n'avez soumis aucune demande d'assistance pour ce projet."
    : "Aucune demande d'assistance enregistrée pour ce projet.";

  const formatDate = (value?: string | Date | null) => {
    if (!value) return "—";
    return new Date(value).toLocaleString("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  };

  const statusBadgeMap: Record<string, { label: string; className: string }> = {
    pending: { label: "En attente", className: "badge-warning" },
    resolved: { label: "Résolue", className: "badge-success" },
    rejected: { label: "Rejetée", className: "badge-error" },
    approved: { label: "Approuvée", className: "badge-success" },
  };

  const getStatusBadge = (status: string) => {
    const config = statusBadgeMap[status] || { label: status, className: "badge-ghost" };
    return <span className={`badge ${config.className}`}>{config.label}</span>;
  };

  const priorityBadgeMap: Record<string, { label: string; className: string }> = {
    HIGH: { label: "Haute", className: "badge-error" },
    MEDIUM: { label: "Moyenne", className: "badge-warning" },
    LOW: { label: "Basse", className: "badge-info" },
    LATE: { label: "En retard", className: "badge-error" }, // Added LATE
    UNDEFINED: { label: "Non définie", className: "badge-ghost" }, // Added UNDEFINED
  };

  const getPriorityBadge = (priority: string) => {
    const config = priorityBadgeMap[priority] || { label: priority, className: "badge-ghost" };
    return <span className={`badge ${config.className}`}>{config.label}</span>;
  };

  // Refetch project info if initial project changes (e.g., after an update)s
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
        late: initialProject.tasks.filter((task) => task.status == "Late" || (task.deadline && new Date(task.deadline) < new Date() && task.status !== "Done" && task.status !== "Cancelled")).length, // Calculate late tasks
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

  useEffect(() => {
    setAssistanceRequests(initialProject.assistanceRequests || []);
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

  const handleAssistanceAction = async (requestId: string, resolution: "resolved" | "rejected") => {
    if (!canModerateAssistanceRequests) return;
    try {
      setAssistanceActionLoading(`${requestId}-${resolution}`);
      const updatedRequest = await respondToAssistanceRequest(requestId, resolution) as AssistanceRequest;
      setAssistanceRequests((prev) =>
        prev.map((request) => (request.id === requestId ? { ...request, ...updatedRequest } : request))
      );
      toast.success(resolution === "resolved" ? "Demande d'assistance traitée" : "Demande d'assistance rejetée");
      router.refresh();
    } catch (error) {
      console.error("Erreur lors du traitement de la demande d'assistance:", error);
      toast.error(error instanceof Error ? error.message : "Impossible de traiter la demande d'assistance.");
    } finally {
      setAssistanceActionLoading(null);
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
                {userRole !== Role.CONSULTANT && (
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
                )}
              </div>
            </div>
            <div className="flex flex-col md:flex-row gap-2 mt-2 md:mt-0">
              {canEditProject && (
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="btn btn-sm btn-outline btn-primary"
                >
                  Modifier le projet
                </button>
              )}
              {/* Afficher le bouton pour créer des tâches */}
              {canCreateTask && (
                <Link
                  href={`/new-tasks/${projectId}`}
                  className="btn btn-sm"
                >
                  Nouvelle tâche
                  <CopyPlus className="w-4" />
                </Link>
              )}
              {/* New button for consultants to request assistance */}
              {!loading && userRole === Role.CONSULTANT && (
                <button
                  onClick={() => {
                    console.log("DBG: Button clicked - userRole at click:", userRole);
                    setIsSelectCollaboratorsModalOpen(true);
                  }}
                  className="btn btn-sm btn-outline btn-info"
                >
                  Demander de l&#39;assistance
                </button>
              )}
            </div>
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
      {canViewRequestsPanels && (
      <div className="mt-10">
        <div className="border border-base-300 rounded-xl p-5 bg-base-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">Demandes d&apos;assistance</h3>
              <p className="text-sm text-base-content/70">
                {viewingOwnRequestsOnly
                  ? "Suivez et validez vos demandes d&apos;assistance."
                  : "Vue globale des besoins exprimés par les consultants."}
              </p>
            </div>
            <span className="badge badge-info badge-outline">{pendingRequestsCount} en attente</span>
          </div>
          {combinedRequests.length ? (
            <ul className="space-y-3">
              {combinedRequests.map((request) => (
                <li
                  key={`${request.type}-${request.id}`}
                  className="rounded-2xl border border-base-200 bg-base-100 p-5 shadow-sm transition hover:border-base-300 hover:shadow-md"
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-3">
                          {request.priority && getPriorityBadge(request.priority)}
                        </div>
                        <div className="flex items-center gap-2">
                          {request.status === "pending" && canModerateAssistanceRequests && (
                            <>
                              <button
                                className="btn btn-xs btn-success"
                                onClick={() => handleAssistanceAction(request.id, "resolved")}
                                disabled={assistanceActionLoading === `${request.id}-resolved`}
                              >
                                {assistanceActionLoading === `${request.id}-resolved` ? (
                                  <span className="loading loading-spinner loading-xs" />
                                ) : (
                                  "Valider"
                                )}
                              </button>
                              <button
                                className="btn btn-xs btn-error"
                                onClick={() => handleAssistanceAction(request.id, "rejected")}
                                disabled={assistanceActionLoading === `${request.id}-rejected`}
                              >
                                {assistanceActionLoading === `${request.id}-rejected` ? (
                                  <span className="loading loading-spinner loading-xs" />
                                ) : (
                                  "Refuser"
                                )}
                              </button>
                            </>
                          )}
                          {getStatusBadge(request.status)}
                        </div>
                      </div>
                      <p className="text-lg font-semibold text-base-content">{request.title}</p>
                      <p className="text-sm text-base-content/70 break-words leading-relaxed">{request.description}</p>
                      {request.comments && (
                        <p className="text-xs text-base-content/60 italic break-words bg-base-200/60 rounded-lg px-3 py-2">
                          Détails · {request.comments}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                      <div className="flex items-center justify-between rounded-xl bg-base-200/70 px-4 py-2 sm:justify-start sm:gap-3">
                        <span className="text-xs uppercase tracking-wide text-base-content/60">Consultant</span>
                        <span className="font-medium text-base-content text-right sm:text-left">{request.consultantName || "—"}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-base-200/70 px-4 py-2 sm:justify-center sm:gap-3">
                        <span className="text-xs uppercase tracking-wide text-base-content/60">Échéance</span>
                        <span className="font-medium text-base-content text-right">{request.deadline ? formatDate(request.deadline) : "—"}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-base-200/70 px-4 py-2 sm:justify-end sm:gap-3">
                        <span className="text-xs uppercase tracking-wide text-base-content/60">Envoyée le</span>
                        <span className="font-medium text-base-content text-right sm:text-left">{formatDate(request.createdAt)}</span>
                      </div>
                    </div>

                    {request.status === "pending" && canModerateAssistanceRequests && (
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          className="btn btn-ghost btn-xs"
                          onClick={() => handleAssistanceAction(request.id, "resolved")}
                          disabled={assistanceActionLoading === `${request.id}-resolved`}
                        >
                          {assistanceActionLoading === `${request.id}-resolved` ? (
                            <span className="loading loading-spinner loading-xs" />
                          ) : (
                            "Résoudre"
                          )}
                        </button>
                        <button
                          className="btn btn-error btn-xs"
                          onClick={() => handleAssistanceAction(request.id, "rejected")}
                          disabled={assistanceActionLoading === `${request.id}-rejected`}
                        >
                          {assistanceActionLoading === `${request.id}-rejected` ? (
                            <span className="loading loading-spinner loading-xs" />
                          ) : (
                            "Rejeter"
                          )}
                        </button>
                      </div>
                    )}
                    {request.status !== "pending" && (
                      <p className="text-xs text-base-content/60">
                        Traité le {formatDate(request.resolvedAt)}
                        {request.resolvedBy ? ` par ${request.resolvedBy}` : ""}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-base-content/70">{requestsEmptyMessage}</p>
          )}
        </div>
      </div>
      )}
      <dialog id="edit_project_modal" className="modal" open={isEditModalOpen}>
        <div className="modal-box">
          <h3 className="font-bold text-lg">Modifier le projet</h3>
          {project && <EditProjectForm project={project} onClose={() => {
            setIsEditModalOpen(false);
            router.refresh(); // Refresh to reflect changes
          }} />}
        </div>
      </dialog>
      {/* Assistance Request Modal */}
      <dialog id="assistance_request_modal" className="modal" open={isAssistanceModalOpen}>
        <div className="modal-box">
          <h3 className="font-bold text-lg">Demande d&apos;assistance</h3>
          {project && <TaskRequestFormModal
            projectId={project.id}
            onClose={() => setIsAssistanceModalOpen(false)}
            onSuccess={() => {
              router.refresh(); // Refresh to show the new request
            }}
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
              // After collaborators are selected and added, open the request modal
              setIsSelectCollaboratorsModalOpen(false);
              setIsAssistanceModalOpen(true); // Open the assistance request modal
              router.refresh(); // Refresh to reflect new collaborators
            }}
          />}
        </div>
      </dialog>
    </Wrapper>
  );
};

export default ProjectDetailsClient;
"use client"

import Wrapper from "./Wrapper";
import { useEffect, useState, useCallback } from "react";
import { FolderGit2 } from "lucide-react";
import { createProject, deleteProjectById, getProjectsCreatedByUser, updateTaskStatus, addUserToProject } from "../actions";
import { useSupabaseUser } from "../hooks/useSupabaseUser";
import { toast } from "react-hot-toast";
import { Project } from "@/type";
import { addProject, getProjects, addPendingChange, removeFromPending, getPendingData, Project as IdbProject, deleteProjectFromIdb, PendingChange, updatePendingChange, saveUserEmail, getUserEmail, Task as IdbTask } from "@/lib/idb";
import ProjectComponent from "./ProjectComponent";
import EmptyState from "./EmptyState";
import { Role, User } from "@prisma/client"; // Import User
import { getCurrentUser } from "../actions"; // Import getCurrentUser

interface HomeClientProps {
  userRole: Role | "GUEST";
  initialProjects: Project[];
}

export default function HomeClient({ userRole, initialProjects }: HomeClientProps) {
  const { user } = useSupabaseUser();
  const email = user?.email as string;
  const [name, setName] = useState("");
  const [descrition, setDescription] = useState("");
  const [projects, setProjects] = useState<IdbProject[]>(initialProjects);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 6; 
  const [currentUserEmail, setCurrentUserEmail] = useState<string | undefined>(undefined);
  const [fullCurrentUser, setFullCurrentUser] = useState<User | null>(null); // New state for full user object

  const filteredAndSortedProjects = [...projects].filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (project.description && project.description.toLowerCase().includes(searchTerm.toLowerCase()))
  ).sort((a, b) => {
    if (sortOrder === "asc") {
      return a.name.localeCompare(b.name);
    } else {
      return b.name.localeCompare(a.name);
    }
  });

  const fetchProjects = useCallback(async (userEmail: string) => {
    if (!userEmail) return;

    console.log("Fetching projects for email:", userEmail);
    const skip = (currentPage - 1) * itemsPerPage;

    try {
      const localProjects = await getProjects();
      const pendingChanges = await getPendingData(userEmail);
      const pendingProjects = pendingChanges.filter(change => change.type === 'project').map(change => change.data as IdbProject);

      let projectsToConsider = localProjects;

      if (!navigator.onLine) {
        const existingProjectIds = new Set(localProjects.map(p => p.id));
        const uniquePendingProjects = pendingProjects.filter(p => !existingProjectIds.has(p.id));
        projectsToConsider = [...localProjects, ...uniquePendingProjects];
      }
      const filteredLocalProjects = projectsToConsider.filter(p => p.createdById === userEmail);
      const paginatedLocalProjects = filteredLocalProjects.slice(skip, skip + itemsPerPage);

      setProjects(paginatedLocalProjects);
      setTotalItems(filteredLocalProjects.length);
      console.log('Projets chargés depuis IndexedDB (incluant les projets en attente):', paginatedLocalProjects);
    } catch (error) {
      console.error('Erreur lors du chargement des projets depuis IndexedDB:', error);
    }

    if (navigator.onLine) {
      try {
        const { projects: networkProjects, totalCount } = await getProjectsCreatedByUser(userEmail, skip, itemsPerPage, searchTerm, sortOrder);
        if (Array.isArray(networkProjects)) {
          setProjects(networkProjects);
          setTotalItems(totalCount);
          for (const project of networkProjects) {
            await addProject(project);
          }
          console.log('Projets chargés et mis en cache depuis le réseau:', networkProjects);
        } else {
          console.warn('getProjectsCreatedByUser n\'a pas retourné un tableau.', networkProjects);
        }
      } catch (error) {
        console.error('Erreur lors du chargement des projets depuis le réseau:', error);
        toast.error('Impossible de charger les projets depuis le réseau.');
      }
    } else {
      toast('Vous êtes hors ligne. Affichage des projets en cache.', { icon: '📡' });
    }
  }, [currentPage, itemsPerPage, searchTerm, sortOrder]);

  const syncPendingChanges = useCallback(async () => {
    if (!navigator.onLine) return;
    if (!currentUserEmail) {
      console.warn("Cannot sync pending changes: currentUserEmail is undefined.");
      return;
    }

    console.log("Attempting to sync pending changes...");
    
    let pending = await getPendingData(currentUserEmail);
    const errors: string[] = [];
    const changesToSkip: Set<number> = new Set();

    const offlineCreations = new Map<string, PendingChange>();
    const offlineDeletions = new Map<string, PendingChange>();

    const projectCreations: (PendingChange & { id: number })[] = [];
    const projectDeletions: (PendingChange & { id: number })[] = [];
    const taskUpdates: (PendingChange & { id: number })[] = [];
    const projectAddUsers: (PendingChange & { id: number })[] = [];

    for (const change of pending) {
        if (change.type === 'project' && change.data && (change.data as IdbProject).id.startsWith('offline-')) {
            offlineCreations.set((change.data as IdbProject).id, change);
        } else if (change.type === 'project_delete' && change.data && (change.data as { id: string }).id.startsWith('offline-')) {
            offlineDeletions.set((change.data as { id: string }).id, change);
        }

        if (change.id && !changesToSkip.has(change.id)) {
            switch (change.type) {
                case 'project':
                    projectCreations.push(change as PendingChange & { id: number });
                    break;
                case 'project_delete':
                    projectDeletions.push(change as PendingChange & { id: number });
                    break;
                case 'task':
                    taskUpdates.push(change as PendingChange & { id: number });
                    break;
                case 'project_add_user':
                    projectAddUsers.push(change as PendingChange & { id: number });
                    break;
            }
        }
    }

    for (const [offlineId, deleteChange] of offlineDeletions.entries()) {
        if (offlineCreations.has(offlineId)) {
            const createChange = offlineCreations.get(offlineId)!;
            if (createChange.id) changesToSkip.add(createChange.id);
            if (deleteChange.id) changesToSkip.add(deleteChange.id);
            console.log(`[Sync] Annulation de la paire créer/supprimer hors ligne pour l'ID de projet : ${offlineId}`);
        }
    }

    for (const id of changesToSkip) {
        await removeFromPending(id);
    }

    for (const change of projectCreations) {
        try {
            const projectData = change.data as Project;
            console.log('[Sync] Synchronisation de la création de projet:', projectData);
            const createdProject = await createProject(projectData.name, projectData.description ?? '', change.userId, projectData.id);

            await deleteProjectFromIdb(projectData.id);
            await addProject(createdProject as IdbProject);
            await removeFromPending(change.id);

            for (const addUserChange of projectAddUsers) {
                if ((addUserChange.data as { inviteCode: string; offlineProjectId?: string }).offlineProjectId === projectData.id) {
                    const updatedData = { ...addUserChange.data as { inviteCode: string }, inviteCode: createdProject.inviteCode };
                    await updatePendingChange(addUserChange.id!, updatedData);
                    console.log(`[Sync Pass 1] InviteCode mis à jour pour la demande d'ajout d'utilisateur en attente ${addUserChange.id}. Nouveau code: ${createdProject.inviteCode}`);
                }
            }
        } catch (error) {
            console.error('[Sync Error] Erreur lors de la synchronisation d\'une création de projet:', change, error);
            errors.push(`Échec de la synchronisation de la création de projet (ID: ${change.id}): ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    pending = await getPendingData(currentUserEmail);
    const finalChangesToProcess = pending.filter(change => change.id && !changesToSkip.has(change.id));

    for (const change of finalChangesToProcess) {
        try {
            if (change.type === 'project_delete') {
                const projectDeleteData = change.data as { id: string };
                console.log('[Sync] Synchronisation de la suppression de projet:', projectDeleteData.id);
                await deleteProjectById(projectDeleteData.id);
                await removeFromPending(change.id);
            } else if (change.type === 'task') {
                const taskData = change.data as IdbTask;
                console.log('[Sync] Synchronisation de la mise à jour de la tâche:', taskData.id, taskData.status);
                await updateTaskStatus(taskData.id, taskData.status, taskData.solutionDescription ?? undefined);
                await removeFromPending(change.id);
            } else if (change.type === 'project_add_user') {
                const addUserData = change.data as { inviteCode: string; userId: string };
                console.log('[Sync Pass 2] Synchronisation de l\'ajout d\'utilisateur au projet:', addUserData.inviteCode, addUserData.userId);
                const result = await addUserToProject(addUserData.userId, addUserData.inviteCode);

                if (result.success) {
                    await removeFromPending(change.id);
                } else {
                    console.error('[Sync Error] Échec de l\'ajout d\'utilisateur au projet:', result.error);
                    toast.error(`Échec de la synchronisation de l\'ajout d\'utilisateur: ${result.error}`);
                }
            }
        } catch (error) {
            console.error('[Sync Error] Erreur lors de la synchronisation d\'une modification:', change, error);
            errors.push(`Échec de la synchronisation de la modification ${change.type} (ID: ${change.id}): ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    await fetchProjects(currentUserEmail);
  }, [currentUserEmail, fetchProjects]); // Removed userRole from dependencies

  useEffect(() => {
    const initializeUserEmail = async () => {
      if (email) {
        setCurrentUserEmail(email);
        await saveUserEmail(email);
        fetchProjects(email);
        syncPendingChanges();
        const userDetails = await getCurrentUser(); // Fetch full user details
        setFullCurrentUser(userDetails);
      } else {
        const storedEmail = await getUserEmail();
        if (storedEmail) {
          setCurrentUserEmail(storedEmail as unknown as string);
          fetchProjects(storedEmail as unknown as string);
          syncPendingChanges();
          const userDetails = await getCurrentUser();
          setFullCurrentUser(userDetails);
        }
      }
    };
    initializeUserEmail();
  }, [email, fetchProjects, syncPendingChanges]);

  useEffect(() => {
    const handleOnline = async () => {
      console.log('Connexion rétablie, tentative de synchronisation...');
      await syncPendingChanges();
      if (currentUserEmail) {
        fetchProjects(currentUserEmail);
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [currentUserEmail, fetchProjects, syncPendingChanges]);

  const deleteProject = async (projectId: string) => {
    if (!currentUserEmail) {
      toast.error("Utilisateur non identifié.");
      return;
    }

    if (!navigator.onLine) {
      await addPendingChange({
        userId: currentUserEmail,
        data: { id: projectId, name: "", description: "" } as Project,
        timestamp: new Date().toISOString(),
        type: 'project_delete',
      });
      setProjects(prev => prev.filter(p => p.id !== projectId));
      toast.success('Project marqué pour suppression hors ligne!');
      return;
    }

    try {
      await deleteProjectById(projectId);
      setProjects(prev => prev.filter(p => p.id !== projectId));
      toast.success('Project supprimé !');
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error('Erreur lors de la suppression du projet.');
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentUserEmail) {
      toast.error("Utilisateur non identifié.");
      return;
    }

    try {
      const modal = document.getElementById('my_modal_3') as HTMLDialogElement;

      if (!navigator.onLine) {
        const newProject: IdbProject = {
          id: `offline-${Date.now()}`,
          name,
          description: descrition,
          createdBy: fullCurrentUser || { email: currentUserEmail, id: "", name: "", imageUrl: null, role: Role.USER, approved: true, restricted: false },
          createdById: currentUserEmail as string,
          inviteCode: `offline-invite-${Date.now()}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          tasks: [],
          users: [],
        };
        await addPendingChange({
          userId: currentUserEmail,
          data: newProject,
          timestamp: new Date().toISOString(),
          type: 'project',
        });
        setProjects(prev => [...prev, newProject]);
        toast.success("Projet Créé hors ligne !");
      } else {
        const createdProject = await createProject(name, descrition, email, undefined);
        setProjects(prev => [...prev, createdProject as IdbProject]);
        toast.success("Projet Créé");
      }

      if (modal) {
        modal.close();
      }
      setName("");
      setDescription("");
    } catch (error) {
      console.error('Error creating project:', error);
      toast.error('Erreur lors de la création du projet.');
    }
  };

  const isButtonDisabled = !name || !descrition;

  return (
    <Wrapper userRole={userRole}>
      <div className='flex flex-col md:flex-row items-center justify-between mb-6 gap-4'>
        <div className='flex flex-col sm:flex-row items-center gap-4 w-full md:w-2/3'>
          <input
            type="text"
            placeholder="Rechercher un projet..."
            className='w-full p-3 input input-bordered rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200'
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className='select select-bordered w-full sm:w-auto rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 min-w-fit'
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
          >
            <option value="asc">Trier par nom (A-Z)</option>
            <option value="desc">Trier par nom (Z-A)</option>
          </select>
        </div>
        <div className='flex items-center gap-4 w-full md:w-1/3 mt-4 md:mt-0'>
          <button className="btn btn-primary rounded-lg whitespace-nowrap px-6 py-3" onClick={() => (document.getElementById('my_modal_3') as HTMLDialogElement).showModal()}> Nouveau Projet <FolderGit2 /></button>
        </div>
      </div>

      <dialog id="my_modal_3" className="modal">
        <div className="modal-box">
          <form method="dialog">
            <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button><br />
          </form>
          <h3 className="font-bold text-lg">Nom du client</h3><br />
          <div>
            <input
              placeholder="Nom du client"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border border-base-300 input  input-bordered w-full mb-4 placeholder:text-sm rounded-lg"
              required
            />
            <textarea
              placeholder="Informations relatives au client"
              value={descrition}
              onChange={(e) => setDescription(e.target.value)}
              className="mb-2 textarea textarea-bordered border border-base-300 w-full  textarea-md placeholder::text-sm rounded-lg"
              required
            >
            </textarea>
            <button className="btn btn-primary rounded-lg" onClick={handleSubmit} disabled={isButtonDisabled}>
              Nouveau Projet <FolderGit2 />
            </button>
          </div>
        </div>
      </dialog>

      <div className="w-full">

        {Array.isArray(filteredAndSortedProjects) && filteredAndSortedProjects.length > 0 ? (
          <ul className="w-full grid md:grid-cols-3 gap-6">
            {(filteredAndSortedProjects ?? []).map((project) => (
              <li key={project.id}>
                <ProjectComponent project={project} userRole={userRole as Role} createdById={project.createdById as string} style={true} onDelete={deleteProject}></ProjectComponent>
              </li>
            ))}
          </ul>
        ) : (
          <div>
            <EmptyState
               imageSrc='/empty-project.png'
               imageAlt="Picture of an empty project"
               message="Aucun projet Créer"
            />
          </div>
        )}

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

    </Wrapper>
  );
}

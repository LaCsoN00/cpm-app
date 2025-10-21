"use client"

import Wrapper from "./components/Wrapper";
import { useEffect, useState, useCallback } from "react";
import { FolderGit2 } from "lucide-react";
import { createProject, deleteProjectById, getProjectsCreatedByUser, updateTaskStatus, addUserToProject } from "./actions";
import { useUser } from "@clerk/nextjs";
import { toast } from "react-hot-toast";
import { Project, Task } from "@/type";
import { addProject, getProjects, addPendingChange, removeFromPending, getPendingData, Project as IdbProject, deleteProjectFromIdb, PendingChange, updatePendingChange, saveUserEmail, getUserEmail, clearAllStores } from "@/lib/idb";
import ProjectComponent from "./components/ProjectComponent";
import EmptyState from "./components/EmptyState";

export default function Home() {

  const { user } = useUser()
  const email = user?.primaryEmailAddress?.emailAddress as string
  const [name, setName] = useState("")
  const [descrition, setDescription] = useState("")
  const [projects, setProjects] = useState<IdbProject[]>([])
  const [currentUserEmail, setCurrentUserEmail] = useState<string | undefined>(undefined); // Nouvel état pour l'e-mail actuel

  const fetchProjects = useCallback(async (email: string) => {
    if (!email) return;

    console.log("Fetching projects for email:", email);

    // 1. Essayer de récupérer depuis IndexedDB d'abord
    try {
      const localProjects = await getProjects();
      // Récupérer les projets en attente de création
      const pendingChanges = await getPendingData(email);
      const pendingProjects = pendingChanges.filter(change => change.type === 'project').map(change => change.data as IdbProject);

      let projectsToDisplay = localProjects;

      // Si hors ligne ou si la récupération réseau n'a pas eu lieu, inclure les projets en attente
      if (!navigator.onLine) {
        // Fusionner les projets en attente avec les projets locaux, en évitant les doublons par ID temporaire
        const existingProjectIds = new Set(localProjects.map(p => p.id));
        const uniquePendingProjects = pendingProjects.filter(p => !existingProjectIds.has(p.id));
        projectsToDisplay = [...localProjects, ...uniquePendingProjects];
      }

      if (projectsToDisplay.length > 0) {
        setProjects(projectsToDisplay.filter(p => p.createdById === email));
        console.log('Projets chargés depuis IndexedDB (incluant les projets en attente):', projectsToDisplay);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des projets depuis IndexedDB:', error);
    }

    // 2. Tenter de récupérer depuis le réseau
    if (navigator.onLine) {
      try {
        const networkProjects = await getProjectsCreatedByUser(email);
        if (Array.isArray(networkProjects)) {
          setProjects(networkProjects);
          // Mettre à jour IndexedDB avec les dernières données du réseau
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
  }, []);

  const syncPendingChanges = useCallback(async () => {
    if (!navigator.onLine) return;
    if (!currentUserEmail) { // Ajouter cette vérification
      console.warn("Cannot sync pending changes: currentUserEmail is undefined.");
      return;
    }

    console.log("Attempting to sync pending changes...");
    
    let pending = await getPendingData(currentUserEmail); // Utilisez let pour pouvoir modifier
    const changesToSkip: Set<number> = new Set();
    
    // Étape 1: Identifier et ignorer les paires de création/suppression pour les projets hors ligne
    const offlineCreations = new Map<string, PendingChange>(); // Mappe l'offlineId à son objet pendingChange
    const offlineDeletions = new Map<string, PendingChange>(); // Mappe l'offlineId à son objet pendingChange

    // Séparer les changements par type pour un traitement ordonné
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

    // Étape 2: Traiter les créations de projets en premier
    for (const change of projectCreations) {
        try {
            const projectData = change.data as Project;
            console.log('[Sync] Synchronisation de la création de projet:', projectData);
            const createdProject = await createProject(projectData.name, projectData.description ?? '', change.userId);

            await deleteProjectFromIdb(projectData.id);
            await addProject(createdProject as IdbProject);
            await removeFromPending(change.id);

            // Mettre à jour les inviteCode des demandes d'ajout d'utilisateur en attente
            for (const addUserChange of projectAddUsers) {
                if ((addUserChange.data as { inviteCode: string; offlineProjectId?: string }).offlineProjectId === projectData.id) {
                    const updatedData = { ...addUserChange.data as { inviteCode: string }, inviteCode: createdProject.inviteCode };
                    await updatePendingChange(addUserChange.id!, updatedData); // Utiliser addUserChange.id! car il est vérifié non-nul
                    console.log(`[Sync Pass 1] InviteCode mis à jour pour la demande d'ajout d'utilisateur en attente ${addUserChange.id}. Nouveau code: ${createdProject.inviteCode}`);
                }
            }
        } catch (error) {
            console.error('[Sync Error] Erreur lors de la synchronisation d\'une création de projet:', change, error);
            toast.error(`Échec de la synchronisation de la création de projet: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    // Re-récupérer les changements en attente après la mise à jour des inviteCode pour les project_add_user
    pending = await getPendingData(currentUserEmail);
    const finalChangesToProcess = pending.filter(change => change.id && !changesToSkip.has(change.id));

    // Étape 3: Traiter les autres changements (suppressions de projets, mises à jour de tâches, ajouts d'utilisateurs)
    for (const change of finalChangesToProcess) {
        try {
            if (change.type === 'project_delete') {
                const projectData = change.data as { id: string };
                console.log('[Sync] Synchronisation de la suppression de projet:', projectData.id);
                await deleteProjectById(projectData.id);
                await removeFromPending(change.id);
            } else if (change.type === 'task') {
                const taskData = change.data as Task;
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
            // else if (change.type === 'project') { /* déjà traité */ }
        } catch (error) {
            console.error('[Sync Error] Erreur lors de la synchronisation d\'une modification:', change, error);
            toast.error(`Échec de la synchronisation de la modification: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    await fetchProjects(currentUserEmail);
  }, [currentUserEmail, fetchProjects]);

  useEffect(() => {
    const initializeUserEmail = async () => { // Créer une fonction asynchrone
      if (email) {
        setCurrentUserEmail(email);
        await saveUserEmail(email); // Sauvegarder l'e-mail de l'utilisateur lors de la connexion/chargement
        fetchProjects(email);
        syncPendingChanges(); // Try to sync on load
      } else {
        // Si l'utilisateur n'est pas connecté (offline ou non authentifié par Clerk)
        const storedEmail = await getUserEmail(); // Ajouter await ici
        if (storedEmail) {
          setCurrentUserEmail(storedEmail as unknown as string);
          fetchProjects(storedEmail as unknown as string);
          syncPendingChanges();
        }
      }
    };
    initializeUserEmail(); // Appeler la fonction asynchrone
  }, [email, fetchProjects, syncPendingChanges]);

  useEffect(() => {
    const handleOnline = () => {
      console.log('Connexion rétablie, tentative de synchronisation...');
      syncPendingChanges();
      // Récupérer les projets avec l'e-mail actuel (qui peut provenir de Clerk ou IndexedDB)
      if (currentUserEmail) {
        fetchProjects(currentUserEmail);
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [currentUserEmail, fetchProjects, syncPendingChanges]); // Dépend de currentUserEmail

  const deleteProject = async (projectId: string) => {
    if (!currentUserEmail) { // Utiliser currentUserEmail
      toast.error("Utilisateur non identifié.");
      return;
    }

    if (!navigator.onLine) {
      await addPendingChange({
        userId: currentUserEmail, // Utiliser currentUserEmail
        data: { id: projectId, name: "", description: "" } as Project, // Minimal data for deletion
        timestamp: new Date().toISOString(),
        type: 'project_delete',
      });
      // Remove from local display immediately
      setProjects(prev => prev.filter(p => p.id !== projectId));
      toast.success('Project marqué pour suppression hors ligne!');
      return;
    }

    try {
      await deleteProjectById(projectId);
      setProjects(prev => prev.filter(p => p.id !== projectId)); // Update UI
      toast.success('Project supprimé !');
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error('Erreur lors de la suppression du projet.');
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentUserEmail) { // Utiliser currentUserEmail
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
          createdBy: { email: currentUserEmail }, // Utiliser currentUserEmail
          createdById: currentUserEmail, // Utiliser currentUserEmail
          inviteCode: `offline-invite-${Date.now()}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          tasks: [],
          users: [],
        };
        await addPendingChange({
          userId: currentUserEmail, // Utiliser currentUserEmail
          data: newProject,
          timestamp: new Date().toISOString(),
          type: 'project',
        });
        setProjects(prev => [...prev, newProject]); // Update UI immediately
        toast.success("Projet Créé hors ligne !");
      } else {
        const createdProject = await createProject(name, descrition, email);
        setProjects(prev => [...prev, createdProject as IdbProject]); // Update UI immediately with server-generated project
        toast.success("Projet Créé");
      }

      if (modal) {
        modal.close();
      }
      setName("");
      setDescription("");
      // fetchProjects(email); // Refresh projects after creation - removed to prevent page reload
    } catch (error) {
      console.error('Error creating project:', error);
      toast.error('Erreur lors de la création du projet.');
    }
  };

// L'inscription du Service Worker est gérée par next-pwa (voir next.config.ts)

  const isButtonDisabled = !name || !descrition;

  return (
    <Wrapper>
      <div>
        <button className="btn  btn-primary mb-6" onClick={() => (document.getElementById('my_modal_3') as HTMLDialogElement).showModal()}> Nouveau Projet <FolderGit2 /></button>

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
                className="border border-base-300 input  input-bordered w-full mb-4 placeholder:text-sm"
                required
              />
              <textarea
                placeholder="Informations relatives au client"
                value={descrition}
                onChange={(e) => setDescription(e.target.value)}
                className="mb-2 textarea textarea-bordered border border-base-300 w-full  textarea-md placeholder::text-sm"
                required
              >
              </textarea>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={isButtonDisabled}>
                Nouveau Projet <FolderGit2 />
              </button>
            </div>
          </div>
        </dialog>

        <div className="w-full">

          {Array.isArray(projects) && projects.length > 0 ? (
            <ul className="w-full grid md:grid-cols-3 gap-6">
              {(projects ?? []).map((project) => (
                <li key={project.id}>
                  <ProjectComponent project={project} admin={1} style={true} onDelete={deleteProject}></ProjectComponent>
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

        </div>

      </div>
    </Wrapper>
  );
}

"use client"

import React, { useEffect, useState, useCallback } from 'react'
import Wrapper from '../components/Wrapper'
import { SquarePlus } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { addUserToProject, getProjectsAssociatedWithUser, deleteProjectById, createProject } from '../actions'
import { useUser } from '@clerk/nextjs'
import { addProject, getProjects, addPendingChange, removeFromPending, getPendingData, Project as IdbProject, deleteProjectFromIdb, updatePendingChange, getFirstPendingChangeEmail } from "@/lib/idb";
import ProjectComponent from '../components/ProjectComponent'
import EmptyState from '../components/EmptyState'
import { getDB, STORE_PENDING_CHANGES } from "@/lib/idb";

const Page = () => {
    const { user } = useUser()
    const [email, setEmail] = useState(user?.primaryEmailAddress?.emailAddress || "")
    const [inviteCode, setInviteCode] = useState("")
    const [associatedProjects, setAssociatedProjects] = useState<IdbProject[]>([])

    const fetchProjects = useCallback(async (userEmail: string) => {
        // La suppression de la condition if (!userEmail) return; permet de tenter de charger depuis IndexedDB même sans email initialement

        let fetchedFromNetwork = false;

        // 1. Tenter de récupérer depuis le réseau en premier si en ligne
        if (navigator.onLine) {
            try {
                const networkProjects = await getProjectsAssociatedWithUser(userEmail);
                if (Array.isArray(networkProjects)) {
                    setAssociatedProjects(networkProjects);
                    // Mettre à jour IndexedDB avec les dernières données du réseau
                    const localProjects = await getProjects();
                    const networkProjectIds = new Set(networkProjects.map(p => p.id));

                    for (const project of networkProjects) {
                        await addProject(project);
                    }

                    // Gérer les projets créés hors ligne qui ont été synchronisés
                    for (const localProject of localProjects) {
                        if (localProject.id.startsWith('offline-')) {
                            const synchronizedProject = networkProjects.find(
                                p => p.name === localProject.name && p.description === localProject.description
                            );
                            if (synchronizedProject) {
                                // Si un projet hors ligne a été synchronisé, supprimez l'ancien et ajoutez le nouveau
                                await deleteProjectFromIdb(localProject.id);
                                await addProject(synchronizedProject);
                                networkProjectIds.add(synchronizedProject.id); // S'assurer que le projet synchronisé est conservé
                                console.log('Projet hors ligne synchronisé et mis à jour:', localProject.id, '->', synchronizedProject.id);
                            }
                        }
                    }

                    // Supprimer d'IndexedDB les projets qui ne sont plus sur le réseau (et ne sont pas des projets hors ligne non synchronisés)
                    for (const localProject of localProjects) {
                        if (!networkProjectIds.has(localProject.id) && !localProject.id.startsWith('offline-')) {
                            await deleteProjectFromIdb(localProject.id);
                        }
                    }
                    console.log('Projets associés chargés et mis en cache depuis le réseau:', networkProjects);
                    fetchedFromNetwork = true;
                } else {
                    console.warn('getProjectsAssociatedWithUser n\'a pas retourné un tableau.', networkProjects);
                }
            } catch (error) {
                console.error(error);
                toast.error("Erreur lors du chargement des projets associés depuis le réseau");
            }
        }

        // 2. Si non chargé depuis le réseau (hors ligne ou erreur), essayer IndexedDB
        if (!fetchedFromNetwork) {
            try {
                const localProjects = await getProjects();
                if (userEmail) {
                    setAssociatedProjects(localProjects.filter(p => p.users?.some(u => u.email === userEmail) || (p.createdBy && 'email' in p.createdBy && p.createdBy.email === userEmail)));
                } else {
                    // Si pas d'email (par ex. hors ligne et pas encore d'email en pending), afficher tous les projets locaux
                    setAssociatedProjects(localProjects);
                }
                console.log('Projets associés chargés depuis IndexedDB:', localProjects);
                if (!navigator.onLine) {
                    toast('Vous êtes hors ligne. Affichage des projets associés en cache.', { icon: '📡' });
                }
            } catch (error) {
                console.error('Erreur lors du chargement des projets associés depuis IndexedDB:', error);
                toast.error("Erreur lors du chargement des projets associés depuis le cache.");
            }
        }
    }, []);

    const syncPendingChanges = useCallback(async () => {
        if (!navigator.onLine) return;

        console.log("Attempting to sync pending changes...");
        
        let pending = await getPendingData(email);
        const errors: string[] = [];

        // Pass 1: Process project creations first
        const projectCreations = pending.filter(change => change.type === 'project');
        for (const change of projectCreations) {
            try {
                const projectData = change.data as IdbProject;
                const createdProject = await createProject(projectData.name, projectData.description, change.userId, projectData.id);
                await removeFromPending(change.id as number);
                console.log('Projet hors ligne synchronisé et supprimé:', change);

                // Après la création réussie d'un projet, mettre à jour les inviteCode des demandes d'ajout d'utilisateur en attente
                const pendingAddUserChanges = (await getPendingData(email)).filter(
                    pc => pc.type === 'project_add_user' && 
                          (pc.data as { inviteCode: string; offlineProjectId?: string }).offlineProjectId === projectData.id 
                );

                for (const addUserChange of pendingAddUserChanges) {
                    if (addUserChange.id) {
                        const updatedData = { ...addUserChange.data as { inviteCode: string }, inviteCode: createdProject.inviteCode };
                        await updatePendingChange(addUserChange.id, updatedData);
                        console.log(`[Sync Pass 1] InviteCode mis à jour pour la demande d'ajout d'utilisateur en attente ${addUserChange.id}. Nouveau code: ${createdProject.inviteCode}`);
                    }
                }
            } catch (error) {
                console.error('Erreur lors de la synchronisation d\'une modification de projet:', change, error);
                errors.push(`Échec de la synchronisation de la création de projet (ID: ${change.id}): ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        // Re-fetch pending data to get updated inviteCodes for project_add_user changes
        pending = await getPendingData(email);

        // Pass 2: Process other pending changes (including updated project_add_user changes)
        const otherChanges = pending.filter(change => change.type !== 'project');
        for (const change of otherChanges) {
            try {
                if (change.type === 'project_add_user') {
                    // Récupérer la dernière version du changement en attente depuis IndexedDB
                    const db = await getDB();
                    const latestChange = await db.get(STORE_PENDING_CHANGES, change.id as number);
                    if (!latestChange) {
                      console.warn(`Changement en attente (ID: ${change.id}) introuvable pour project_add_user.`);
                      await removeFromPending(change.id as number);
                      continue;
                    }
                    const projectAddUserData = latestChange.data as { inviteCode: string; offlineProjectId?: string };
                    console.log("[Sync Pass 2] Appel de addUserToProject. InviteCode:", projectAddUserData.inviteCode);
                    if (navigator.onLine) {
                        await addUserToProject(latestChange.userId, projectAddUserData.inviteCode);
                    } else {
                        console.warn("Tentative d'ajout d'utilisateur au projet hors ligne lors de la synchronisation. La modification sera resynchronisée.");
                        continue; 
                    }
                    await removeFromPending(change.id as number);
                    console.log('Modification synchronisée et supprimée:', change);
                } else if (change.type === 'project_delete') {
                    const projectDeleteData = change.data as { id: string };
                    await deleteProjectById(projectDeleteData.id);
                    await deleteProjectFromIdb(projectDeleteData.id);
                    await removeFromPending(change.id as number);
                    console.log('Projet supprimé synchronisé et supprimé:', change);
                }
            } catch (error) {
                console.error('Erreur lors de la synchronisation d\'une autre modification:', change, error);
                errors.push(`Échec de la synchronisation de la modification ${change.type} (ID: ${change.id}): ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        // Afficher un seul toast si des erreurs sont survenues
        if (errors.length > 0) {
            toast.error(`Certaines modifications n'ont pas pu être synchronisées.\n${errors.join('\n')}`, { duration: 5000 });
        } else {
            // Si tout s'est bien passé, on peut afficher un message de succès
            if (pending.length > 0) {
                toast.success('Toutes les modifications en attente ont été synchronisées avec succès!');
            }
        }

        await fetchProjects(email); // Actualiser les projets après la synchronisation
    }, [email, fetchProjects]);

    useEffect(() => {
        const fetchUserEmail = async () => {
            if (user?.primaryEmailAddress?.emailAddress) {
                setEmail(user.primaryEmailAddress.emailAddress);
            } else if (!navigator.onLine) {
                const offlineEmail = await getFirstPendingChangeEmail();
                if (offlineEmail) {
                    setEmail(offlineEmail);
                }
            }
        };
        fetchUserEmail();
    }, [user]);

    useEffect(() => {
        if (email) {
            const initializeProjects = async () => {
                await syncPendingChanges();
                fetchProjects(email);
            };
            initializeProjects();
        }
    }, [email, fetchProjects, syncPendingChanges]);

    useEffect(() => {
        const handleOnline = async () => {
            console.log('Connexion rétablie, tentative de synchronisation...');
            await syncPendingChanges();
            fetchProjects(email);
        };
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [email, fetchProjects, syncPendingChanges]);

    const handleSubmit = async () => {
        if (!email) {
            toast.error("Utilisateur non identifié")
            return
        }

        if (inviteCode.trim() === "") {
            toast.error('Il manque le code du projet')
            return
        }

        if (!navigator.onLine) {
            // Chercher le projet hors ligne correspondant pour récupérer son ID temporaire
            const localProjects = await getProjects();
            const offlineProject = localProjects.find(p => p.inviteCode === inviteCode);

            await addPendingChange({
                userId: email,
                data: { 
                    inviteCode, 
                    offlineProjectId: offlineProject?.id // Stocker l'ID hors ligne si le projet est local
                },
                timestamp: new Date().toISOString(),
                type: 'project_add_user',
            });
            setInviteCode("");
            toast.success('Demande d\'ajout au projet enregistrée hors ligne!');
            return;
        }

        try {
            console.log("Appel de addUserToProject depuis handleSubmit...");
            await addUserToProject(email, inviteCode)
            fetchProjects(email)
            setInviteCode("")
            toast.success('Vous pouvez maintenant collaborer sur ce projet')
        } catch (error) {
            console.error(error)
            toast.error(`${error instanceof Error ? error.message : "Code invalide ou vous appartenez déjà au projet"}`)
        }
    }

    return (
        <Wrapper>
            <div className='flex'>
                <div className='mb-4'>
                    <input
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value)}
                        type="text"
                        placeholder="Code d'invitation"
                        className='w-full p-2 input input-bordered'
                    />
                </div>
                <button className='btn btn-primary ml-4' onClick={handleSubmit}>
                    Rejoindre <SquarePlus className='w-4' />
                </button>
            </div>

            <div>
                {associatedProjects.length > 0 ? (
                    <ul className="w-full grid md:grid-cols-3 gap-6">
                        {associatedProjects.map((project) => (
                            <li key={project.id}>
                                <ProjectComponent project={project} admin={0} style={true} />
                            </li>
                        ))}
                    </ul>
                ) : (
                    <EmptyState
                        imageSrc='/empty-project.png'
                        imageAlt="Picture of an empty project"
                        message="Aucun projet associé"
                    />
                )}
            </div>
        </Wrapper>
    )
}

export default Page

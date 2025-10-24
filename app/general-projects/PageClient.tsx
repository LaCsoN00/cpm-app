"use client"

import React, { useEffect, useState, useCallback } from 'react'
import Wrapper from '../components/Wrapper'
import { SquarePlus } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { addUserToProject, getProjectsAssociatedWithUser, deleteProjectById, createProject } from '../actions'
import { useSupabaseUser } from '../hooks/useSupabaseUser'
import { addProject, getProjects, addPendingChange, removeFromPending, getPendingData, Project as IdbProject, deleteProjectFromIdb, updatePendingChange, getFirstPendingChangeEmail } from "@/lib/idb";
import ProjectComponent from '../components/ProjectComponent'
import EmptyState from '../components/EmptyState'
import { getDB, STORE_PENDING_CHANGES } from "@/lib/idb";
import { Role } from "@prisma/client";

interface PageClientProps {
    userRole: Role;
}

const PageClient = ({ userRole }: PageClientProps) => {
    const { user } = useSupabaseUser()
    const [email, setEmail] = useState(user?.email || "")
    const [inviteCode, setInviteCode] = useState("")
    const [associatedProjects, setAssociatedProjects] = useState<IdbProject[]>([])
    const [searchTerm, setSearchTerm] = useState("")
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
    const [currentPage, setCurrentPage] = useState(1)
    const [totalItems, setTotalItems] = useState(0)
    const itemsPerPage = 6

    const filteredAndSortedProjects = [...associatedProjects].filter(project =>
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
        const skip = (currentPage - 1) * itemsPerPage;

        let fetchedFromNetwork = false;

        if (navigator.onLine) {
            try {
                const { projects: networkProjects, totalCount } = await getProjectsAssociatedWithUser(userEmail, skip, itemsPerPage, searchTerm, sortOrder);
                if (Array.isArray(networkProjects)) {
                    setAssociatedProjects(networkProjects);
                    setTotalItems(totalCount);
                    const localProjects = await getProjects();
                    const networkProjectIds = new Set(networkProjects.map(p => p.id));

                    for (const project of networkProjects) {
                        await addProject(project);
                    }

                    for (const localProject of localProjects) {
                        if (localProject.id.startsWith('offline-')) {
                            const synchronizedProject = networkProjects.find(
                                p => p.name === localProject.name && p.description === localProject.description
                            );
                            if (synchronizedProject) {
                                await deleteProjectFromIdb(localProject.id);
                                await addProject(synchronizedProject);
                                networkProjectIds.add(synchronizedProject.id);
                                console.log('Projet hors ligne synchronisé et mis à jour:', localProject.id, '->', synchronizedProject.id);
                            }
                        }
                    }

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

        if (!fetchedFromNetwork) {
            try {
                const localProjects = await getProjects();
                const totalLocalProjects = localProjects.length;
                setTotalItems(totalLocalProjects);

                let projectsToDisplay = [];
                if (userEmail) {
                    projectsToDisplay = localProjects.filter(p => p.users?.some(u => u.email === userEmail) || (p.createdBy && 'email' in p.createdBy && p.createdBy.email === userEmail));
                } else {
                    projectsToDisplay = localProjects;
                }
                const paginatedLocalProjects = projectsToDisplay.slice(skip, skip + itemsPerPage);
                setAssociatedProjects(paginatedLocalProjects);

                console.log('Projets associés chargés depuis IndexedDB:', paginatedLocalProjects);
                if (!navigator.onLine) {
                    toast('Vous êtes hors ligne. Affichage des projets associés en cache.', { icon: '📡' });
                }
            } catch (error) {
                console.error('Erreur lors du chargement des projets associés depuis IndexedDB:', error);
                toast.error("Erreur lors du chargement des projets associés depuis le cache.");
            }
        }
    }, [currentPage, itemsPerPage, searchTerm, sortOrder]);

    const syncPendingChanges = useCallback(async () => {
        if (!navigator.onLine) return;

        console.log("Attempting to sync pending changes...");
        
        let pending = await getPendingData(email);
        const errors: string[] = [];

        const projectCreations = pending.filter(change => change.type === 'project');
        for (const change of projectCreations) {
            try {
                const projectData = change.data as IdbProject;
                const createdProject = await createProject(projectData.name, projectData.description, change.userId, projectData.id);
                await removeFromPending(change.id as number);
                console.log('Projet hors ligne synchronisé et supprimé:', change);

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

        pending = await getPendingData(email);

        const otherChanges = pending.filter(change => change.type !== 'project');
        for (const change of otherChanges) {
            try {
                if (change.type === 'project_add_user') {
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

        if (errors.length > 0) {
            toast.error(`Certaines modifications n'ont pas pu être synchronisées.\n${errors.join('\n')}`, { duration: 5000 });
        } else {
            if (pending.length > 0) {
                toast.success('Toutes les modifications en attente ont été synchronisées avec succès!');
            }
        }

        await fetchProjects(email);
    }, [email, fetchProjects]);

    useEffect(() => {
        const fetchUserEmail = async () => {
            if (user?.email) {
                setEmail(user.email);
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
            const localProjects = await getProjects();
            const offlineProject = localProjects.find(p => p.inviteCode === inviteCode);

            await addPendingChange({
                userId: email,
                data: { 
                    inviteCode, 
                    offlineProjectId: offlineProject?.id
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
                    <input
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value)}
                        type="text"
                        placeholder="Code d'invitation"
                        className='w-full p-3 input input-bordered rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200'
                    />
                    <button className='btn btn-primary rounded-lg whitespace-nowrap px-6 py-3' onClick={handleSubmit}>
                        Rejoindre <SquarePlus className='w-4' />
                    </button>
                </div>
            </div>

            <div>
                {filteredAndSortedProjects.length > 0 ? (
                    <ul className="w-full grid md:grid-cols-3 gap-6">
                        {filteredAndSortedProjects.map((project) => (
                            <li key={project.id}>
                                <ProjectComponent 
                                  project={project} 
                                  userRole={userRole} 
                                  createdById={project.createdById as string}
                                  style={true} 
                                />
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
        </Wrapper>
    )
}

export default PageClient

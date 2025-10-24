"use server"

import prisma from '@/lib/prisma';
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { addPendingChange, getProjectById, getProjectTasks as getProjectTasksFromIdb, addTask as addTaskToIdb, getProjects as getProjectsFromIdb, deleteProjectFromIdb } from "@/lib/idb";
import { Task as IdbTask } from "@/lib/idb"; // Renommer pour éviter les conflits
import { User, Role } from '@prisma/client';
import type { Prisma } from '@prisma/client'; // Importer le type Prisma
import { ExtendedUser } from '@/type'; // Importer ExtendedUser et Project de @/typ
import { createClient } from "@/utils/supabase/server";

type OfflineUser = Pick<User, 'email'>;

export async function getCurrentUser() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return null;
  }
  const user = await prisma.user.findUnique({
    where: { email: data.user.email as string },
    select: { id: true, name: true, email: true, imageUrl: true, role: true, approved: true, restricted: true },
  });
  console.log("Current user role:", user?.role); // Temporary log to check user's role
  return user;
}

// Helper function to check user role
const checkRole = async (requiredRoles: Role[]) => {
  const user = await getCurrentUser();
  if (!user || !requiredRoles.includes(user.role)) {
    throw new Error("Accès non autorisé : rôle insuffisant.");
  }
  return user;
};

export async function updateUserRole(email: string, newRole: Role) {
    try {
        await prisma.user.update({
            where: { email },
            data: { role: newRole }
        });
        console.log(`Rôle utilisateur mis à jour: ${email} -> ${newRole}`);
        
        // Forcer la mise à jour du cache Next.js
        revalidatePath('/');
        revalidatePath('/general-projects');
        revalidatePath('/admin');
        
        return true;
    } catch (error) {
        console.error("Erreur lors de la mise à jour du rôle:", error);
        return false;
    }
}

export async function getAllUsers() {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                imageUrl: true,
                role: true,
                approved: true,
                restricted: true,
            },
            orderBy: {
                name: 'asc'
            }
        });
        return users;
    } catch (error) {
        console.error("Erreur lors du chargement des utilisateurs:", error);
        throw error;
    }
}

export async function getUserByEmail(email: string) {
    try {
        const user = await prisma.user.findUnique({
            where: { email },
            select: {
                id: true,
                name: true,
                email: true,
                imageUrl: true,
                role: true,
            }
        });
        console.log(`Utilisateur trouvé pour ${email}:`, user);
        return user;
    } catch (error) {
        console.error("Erreur lors de la recherche de l'utilisateur:", error);
        throw error;
    }
}

export async function checkAndAddUser(email: string, name: string, imageUrl: string, role: Role = Role.USER) {
    if (!email) return
    try {
        const existingUser = await prisma.user.findUnique({
            where: {
                email: email
            }
        })
        if (!existingUser) {
            await prisma.user.create({
                data: {
                    email,
                    name,
                    imageUrl,
                    role,
                }
            })
            console.error("Erreur lors de la vérification de l'utilisateur:");
        } else if (existingUser && (existingUser.name !== name || existingUser.imageUrl !== imageUrl)) {
            await prisma.user.update({
                where: { email },
                data: {
                    name,
                    imageUrl,
                    // Ne pas mettre à jour le rôle ici pour éviter d'écraser les changements manuels
                }
            })
            console.log("Utilisateur mis à jour (nom/image) - rôle conservé:", existingUser.role);
        }
    } catch (error) {
        console.error("Erreur lors de la vérification de l'utilisateur:", error);
    }
}

export async function createProject(name: string, description: string | null, email: string, offlineTempId?: string) {
  const currentUser = await checkRole([Role.ADMIN, Role.USER]); // Only ADMIN or USER can create projects
  console.log("createProject action called - offlineTempId:", offlineTempId);
  try {
    if (typeof window !== 'undefined' && !navigator.onLine) {
      const newProject = {
        id: offlineTempId || `offline-${Date.now()}`,
        name,
        description,
        createdBy: { email, id: currentUser.id, name: currentUser.name, imageUrl: currentUser.imageUrl, role: currentUser.role },
        createdById: email,
        inviteCode: randomBytes(16).toString('hex'),
        createdAt: new Date(),
        updatedAt: new Date(),
        tasks: [],
        users: [],
      };
      await addPendingChange({
        userId: email,
        data: newProject,
        timestamp: new Date().toISOString(),
        type: 'project',
      });
      console.log('Projet ajouté hors ligne:', newProject);
      return newProject;
    }

    const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
    });

    if (!user) {
        throw new Error(`Utilisateur avec l'email ${email} introuvable`);
    }

    const data = {
      name,
      description,
      createdById: user.id,
      inviteCode: randomBytes(16).toString('hex'),
    };

    // Prisma will generate a new UUID for `id`.
    const createdProject = await prisma.project.create({ data });
    console.log("Projet créé en ligne :", createdProject.id, createdProject.inviteCode);

    // await addProject(createdProject as IdbProject); // Moved to client-side after successful sync
    revalidatePath('/general-projects');
    return createdProject;

  } catch (error: unknown) {
    console.error("Error in createProject:", error);
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === 'P2002' && (error.meta?.target as string[])?.includes('id')) {
        // C'est l'erreur de clé unique, mais nous la gérons maintenant avec l'offlineTempId
        throw new Error(`Erreur: Un projet avec le même ID existe déjà. Ceci peut indiquer un problème de synchronisation.`);
      }
    } else if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error(`Erreur réseau: Impossible de créer le projet. Veuillez vérifier votre connexion.`);
    }
    throw new Error(`Échec de la création du projet: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getProjectsCreatedByUser(email: string, skip: number = 0, take: number = 6, searchTerm: string = "", sortOrder: "asc" | "desc" = "asc") {
  if (!email) {
    return { projects: [], totalCount: 0 };
  }

  try {
    if (typeof window !== 'undefined' && !navigator.onLine) {
      const localProjects = await getProjectsFromIdb();
      let filteredLocalProjects = localProjects.filter(project => 
        project.createdById === email &&
        (project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (project.description && project.description.toLowerCase().includes(searchTerm.toLowerCase())))
      );
      filteredLocalProjects = [...filteredLocalProjects].sort((a, b) => {
        if (sortOrder === "asc") {
          return a.name.localeCompare(b.name);
        } else {
          return b.name.localeCompare(a.name);
        }
      });

      if (filteredLocalProjects) {
        console.log('Projets créés par l\'utilisateur chargés depuis IndexedDB (hors ligne):', filteredLocalProjects);
        const paginatedProjects = filteredLocalProjects.slice(skip, skip + take);
        return { projects: paginatedProjects, totalCount: filteredLocalProjects.length };
      }
    }

    const whereClause: Prisma.ProjectWhereInput = {
      createdBy: { email },
    };

    if (searchTerm) {
      whereClause.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const projects = await prisma.project.findMany({
      where: whereClause,
      include: {
        tasks: {
          include: {
            user: true,
            createdBy: true,
          },
        },
        users: {
          select: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                imageUrl: true,
                role: true, // Include role
              },
            },
          },
        },
        createdBy: { // Include createdBy in select
          select: {
            id: true,
            name: true,
            email: true,
            imageUrl: true,
            role: true,
          },
        },
      },
      orderBy: {
        name: sortOrder,
      },
      skip,
      take,
    });

    const totalCount = await prisma.project.count({ where: whereClause });

    const formattedProjects = projects.map((project) => ({
      ...project,
      users: project.users.map((userEntry) => userEntry.user as ExtendedUser),
      createdBy: project.createdBy as ExtendedUser,
    }));

    return { projects: formattedProjects, totalCount };
  } catch (error) {
    console.error('Erreur lors du chargement des projets depuis le réseau:', error);
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('Erreur réseau: Impossible de charger les projets. Veuillez vérifier votre connexion.');
    }
    throw new Error('Impossible de charger les projets.');
  }
}

export async function getProjectsAssociatedWithUser(email: string, skip: number = 0, take: number = 6, searchTerm: string = "", sortOrder: "asc" | "desc" = "asc") {
  if (!email) {
    return { projects: [], totalCount: 0 };
  }

  try {
    if (typeof window !== 'undefined' && !navigator.onLine) {
      const localProjects = await getProjectsFromIdb();
      let filteredLocalProjects = localProjects.filter(project => 
        project.users?.some(user => user.email === email) &&
        (project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (project.description && project.description.toLowerCase().includes(searchTerm.toLowerCase())))
      );
      filteredLocalProjects = [...filteredLocalProjects].sort((a, b) => {
        if (sortOrder === "asc") {
          return a.name.localeCompare(b.name);
        } else {
          return b.name.localeCompare(a.name);
        }
      });

      if (filteredLocalProjects) {
        console.log('Projets associés à l\'utilisateur chargés depuis IndexedDB (hors ligne):', filteredLocalProjects);
        const paginatedProjects = filteredLocalProjects.slice(skip, skip + take);
        return { projects: paginatedProjects, totalCount: filteredLocalProjects.length };
      }
    }

    const whereClause: Prisma.ProjectWhereInput = {
      users: {
        some: {
          user: {
            email,
          },
        },
      },
    };

    if (searchTerm) {
      whereClause.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const projects = await prisma.project.findMany({
      where: whereClause,
      include: {
        tasks: true,
        users: {
          select: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                imageUrl: true,
                role: true, // Include role
              },
            },
          },
        },
        createdBy: { // Include createdBy in select
          select: {
            id: true,
            name: true,
            email: true,
            imageUrl: true,
            role: true,
          },
        },
      },
      orderBy: {
        name: sortOrder,
      },
      skip,
      take,
    });

    const totalCount = await prisma.project.count({ where: whereClause });

    const formattedProjects = projects.map((project) => ({
      ...project,
      users: project.users.map((userEntry) => userEntry.user as ExtendedUser),
      createdBy: project.createdBy as ExtendedUser,
    }));

    revalidatePath('/general-projects');
    return { projects: formattedProjects, totalCount };
  } catch (error) {
    console.error('Erreur lors du chargement des projets associés depuis le réseau:', error);
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('Erreur réseau: Impossible de charger les projets associés. Veuillez vérifier votre connexion.');
    }
    throw new Error('Impossible de charger les projets associés.');
  }
}

export async function getProjectInfo(idProject: string, details: boolean) {
  if (!idProject) {
    return null;
  }

  try {
    if (typeof window !== 'undefined' && !navigator.onLine) {
      const localProject = await getProjectById(idProject);
      if (localProject) {
        console.log('Projet chargé depuis IndexedDB (hors ligne):', localProject);
        return localProject;
      }
    }
    const project = await prisma.project.findUnique({
      where: {
        id: idProject,
      },
      include: details
        ? {
            tasks: {
              include: {
                user: true,
                createdBy: true,
              },
            },
            users: {
              select: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    imageUrl: true,
                    role: true,
                  },
                },
              },
            },
            createdBy: true,
          }
        : undefined,
    });

    if (!project) {
      return null; // Retourner null si le projet n'est pas trouvé
    }

    return project;
  } catch (error) {
    console.error('Erreur lors du chargement des informations du projet depuis le réseau:', error);
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('Erreur réseau: Impossible de charger les informations du projet. Veuillez vérifier votre connexion.');
    }
    return null; // Retourner null en cas d'erreur
  }
};

export async function getProjectUsers(idProject: string) {
    try {
        if (typeof window !== 'undefined' && !navigator.onLine) {
            const localProject = await getProjectById(idProject);
            if (localProject && localProject.users) {
                console.log('Utilisateurs du projet chargés depuis IndexedDB (hors ligne):', localProject.users);
                return localProject.users;
            }
        }
        const projectWithUsers = await prisma.project.findUnique({
            where: {
                id: idProject
            },
            select: {
                users: {
                    select: {
                        user: true
                    }
                }
            }
        })

        if (!projectWithUsers) {
            return []
        }
        return projectWithUsers.users.map(pu => pu.user)
    } catch (error) {
        console.error(error)
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
          throw new Error('Erreur réseau: Impossible de charger les utilisateurs du projet. Veuillez vérifier votre connexion.');
        }
        throw new Error('Impossible de charger les utilisateurs du projet.')
    }
}

export async function addUserToProject(email: string, inviteCode: string) {
    try {
        console.log("addUserToProject action called with inviteCode:", inviteCode);
        const project = await prisma.project.findUnique({
            where: { inviteCode }
        })

        if (!project) {
            console.error("Projet non trouvé pour l'inviteCode:", inviteCode);
            return { success: false, error: 'Projet non trouvé' };
        }

        const user = await prisma.user.findUnique({
            where: { email }
        })

        if (!user) {
            return { success: false, error: 'Utilisateur non trouvé' };
        }

        const existingAssociation = await prisma.projectUser.findUnique({
            where: {
                userId_projectId: {
                    userId: user.id,
                    projectId: project.id
                }
            }
        })

        if (existingAssociation) {
            return { success: false, error: 'Utilisateur déjà associé à ce projet' };
        }

        await prisma.projectUser.create({
            data: {
                userId: user.id,
                projectId: project.id
            }
        })
        return { success: true, message: 'Utilisateur ajouté au projet avec succès' };
    } catch (error) {
        console.error(error)
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
          return { success: false, error: 'Erreur réseau: Impossible d\'ajouter l\'utilisateur au projet. Veuillez vérifier votre connexion.' };
        }
        return { success: false, error: "Erreur lors de l\'ajout de l\'utilisateur au projet." };
    }
}

export async function createTask(
    name: string,
    description: string,
    dueDate: Date | null,
    projectId: string,
    createdByEmail: string,
    assignToEmail: string | undefined,
    offlineTempId?: string
) {
    await checkRole([Role.ADMIN, Role.USER]); // Only ADMIN or USER can create tasks
    if (typeof window !== 'undefined' && !navigator.onLine) {
        const newTask = {
            id: offlineTempId || `offline-task-${Date.now()}`,
            name,
            description,
            dueDate,
            projectId,
            createdById: createdByEmail,
            userId: assignToEmail || createdByEmail, // Use email as temporary userId
            status: 'To Do',
            createdAt: new Date(),
            updatedAt: new Date(),
            user: assignToEmail ? { email: assignToEmail } as OfflineUser : { email: createdByEmail } as OfflineUser,
            createdBy: { email: createdByEmail } as OfflineUser,
        };
        await addPendingChange({
            userId: createdByEmail,
            data: newTask,
            timestamp: new Date().toISOString(),
            type: 'task',
        });
        await addTaskToIdb(newTask as IdbTask); // Add to IndexedDB immediately
        console.log('Tâche ajoutée hors ligne:', newTask);
        return newTask;
    }

    try {
        const createdBy = await prisma.user.findUnique({
            where: { email: createdByEmail }
        })

        if (!createdBy) {
            throw new Error(`Utilisateur avec l'email ${createdByEmail} introuvable`);
        }

        let assignedUserId = createdBy.id

        if (assignToEmail) {
            const assignedUser = await prisma.user.findUnique({
                where: { email: assignToEmail }
            })
            if (!assignedUser) {
                throw new Error(`Utilisateur avec l'email ${assignToEmail} introuvable`);
            }
            assignedUserId = assignedUser.id
        }

        const newTask = await prisma.task.create({
            data: {
                name,
                description,
                dueDate,
                projectId,
                createdById: createdBy.id,
                userId: assignedUserId,
            }
        })

        console.log('Tâche créée avec succès:', newTask);
        return newTask;
    } catch (error) {
        console.error(error)
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
          throw new Error('Erreur réseau: Impossible de créer la tâche. Veuillez vérifier votre connexion.');
        }
        throw new Error('Échec de la création de la tâche.')
    }

}
export async function deleteTaskById(taskId: string) {
  const user = await checkRole([Role.ADMIN, Role.USER]);
    try {
        const taskToDelete = await prisma.task.findUnique({
            where: { id: taskId },
            select: { createdBy: { select: { id: true } }, project: { select: { createdById: true } } },
        });

        if (!taskToDelete) {
            throw new Error("Tâche non trouvée.");
        }

        const isProjectCreator = taskToDelete.project?.createdById === user.id;
        const isTaskCreator = taskToDelete.createdBy.id === user.id;

        if (user.role !== Role.ADMIN && !isProjectCreator && !isTaskCreator) {
            throw new Error("Accès non autorisé : vous n'êtes ni administrateur, ni le créateur de la tâche, ni le créateur du projet.");
        }

        await prisma.task.delete({
            where: {
                id: taskId
            }
        })
    } catch (error) {
        console.error(error)
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
          throw new Error('Erreur réseau: Impossible de supprimer la tâche. Veuillez vérifier votre connexion.');
        }
        throw new Error('Échec de la suppression de la tâche.')
    }
}

export async function deleteProjectById(projectId: string) {
  const user = await checkRole([Role.ADMIN, Role.USER]); // Only ADMIN or project creator can delete
  try {
    if (typeof window !== 'undefined' && !navigator.onLine) {
      // Gérer la suppression hors ligne
      await addPendingChange({
        userId: "offline_user", // TODO: remplacer par l'email de l'utilisateur réel si disponible hors ligne
        data: { id: projectId },
        timestamp: new Date().toISOString(),
        type: 'project_delete',
      });
      await deleteProjectFromIdb(projectId);
      console.log(`Projet avec l'ID ${projectId} marqué pour suppression hors ligne.`);
      revalidatePath('/general-projects');
      return; // Sortir après la gestion hors ligne
    }

    // Vérifier si le projet existe avant de tenter de le supprimer
    const existingProject = await prisma.project.findUnique({
      where: {
        id: projectId,
      },
      select: { createdById: true },
    });

    if (!existingProject) {
      console.warn(`Tentative de suppression d'un projet inexistant avec l'ID : ${projectId}.`);
      revalidatePath('/general-projects');
      return; // Sortir si le projet n'existe pas
    }

    if (user.role !== Role.ADMIN && existingProject.createdById !== user.id) {
      throw new Error("Accès non autorisé : vous n'êtes ni administrateur, ni le créateur du projet.");
    }

    await prisma.project.delete({
      where: {
        id: projectId,
      },
    });
    console.log(`Projet avec l'ID ${projectId} supprimé avec succès.`);
    revalidatePath('/general-projects');
  } catch (error: unknown) {
    console.error("Erreur lors de la suppression du projet :", error);
    throw new Error(`Échec de la suppression du projet: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export const getTaskDetails = async (taskId: string) => {
  if (!taskId) {
    return null;
  }

  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            imageUrl: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            imageUrl: true,
          },
        },
      },
    });
    if (!task) {
      throw new Error('Tâche non trouvée');
    }

    return task;
  } catch (error) {
    console.error('Erreur lors du chargement des détails de la tâche depuis le réseau:', error);
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('Erreur réseau: Impossible de charger les détails de la tâche. Veuillez vérifier votre connexion.');
    }
    throw new Error('Impossible de charger les détails de la tâche.');
  }
};

export const updateTaskStatus = async (taskId: string, newStatus: string, solutionDescription?: string) => {
  const user = await checkRole([Role.ADMIN, Role.USER]);
  try {
    const existingTask = await prisma.task.findUnique({
      where: { id: taskId },
      select: { userId: true, project: { select: { createdById: true } }, solutionDescription: true }, // Include solutionDescription
    });

    if (!existingTask) {
      throw new Error('Tâche non trouvée.');
    }

    const isProjectCreator = existingTask.project.createdById === user.id;
    const isTaskAssignee = existingTask.userId === user.id;

    if (user.role !== Role.ADMIN && !isProjectCreator && !isTaskAssignee) {
      throw new Error("Accès non autorisé : vous n'êtes ni administrateur, ni l'assigné de la tâche, ni le créateur du projet.");
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: { status: newStatus, solutionDescription: solutionDescription || existingTask.solutionDescription },
    });

    return updatedTask;
  } catch (error) {
    console.error('Error updating task status:', error);
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('Erreur réseau: Impossible de mettre à jour le statut de la tâche. Veuillez vérifier votre connexion.');
    }
    throw new Error('Impossible de mettre à jour le statut de la tâche.');
  }
};

export const getProjectTasks = async (projectId: string, skip: number = 0, take: number = 5, searchTerm: string = "", sortOrder: "asc" | "desc" = "asc") => {
  if (!projectId) {
    return { tasks: [], totalCount: 0 };
  }

  try {
    if (typeof window !== 'undefined' && !navigator.onLine) {
      const localTasks: IdbTask[] = await getProjectTasksFromIdb(projectId);
      const filteredLocalTasks = [...localTasks].filter(task => 
        task.projectId === projectId &&
        ((task.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (task.description && task.description.toLowerCase().includes(searchTerm.toLowerCase())))
      );
      filteredLocalTasks.sort((a, b) => {
        if (sortOrder === "asc") {
          return (a.name || "").localeCompare(b.name || "");
        } else {
          return (b.name || "").localeCompare(a.name || "");
        }
      });

      if (filteredLocalTasks) {
        console.log('Tâches chargées depuis IndexedDB (hors ligne):', filteredLocalTasks);
        const paginatedTasks = filteredLocalTasks.slice(skip, skip + take);
        return { tasks: paginatedTasks, totalCount: filteredLocalTasks.length };
      }
    }
    const whereClause: Prisma.TaskWhereInput = { projectId: projectId };

    if (searchTerm) {
      whereClause.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } }, // Remplacer title par name
        { description: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            imageUrl: true,
            role: true, // Include role
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            imageUrl: true,
            role: true, // Include role
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take,
    });

    const totalCount = await prisma.task.count({ where: whereClause });

    return { tasks, totalCount };
  } catch (error) {
    console.error('Erreur lors du chargement des tâches du projet depuis le réseau:', error);
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('Erreur réseau: Impossible de charger les tâches du projet. Veuillez vérifier votre connexion.');
    }
    throw new Error('Impossible de charger les tâches du projet.');
  }
};

export const getProjectDashboardInfo = async (projectId: string) => {
  if (!projectId) {
    return null;
  }

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tasks: true,
        users: {
          select: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                imageUrl: true,
                role: true,
              },
            },
          },
        },
        createdBy: { // Include createdBy here
          select: {
            id: true,
            name: true,
            email: true,
            imageUrl: true,
            role: true,
          },
        },
      },
    });

    if (!project) {
      return null;
    }

    const totalTasks = project.tasks.length;
    const collaboratorsCount = project.users.length;

    const taskStats = project.tasks.reduce(
      (acc, task) => {
        if (task.status === 'To Do') {
          acc.toDo++;
        } else if (task.status === 'In Progress') {
          acc.inProgress++;
        } else if (task.status === 'Done') {
          acc.done++;
        }
        return acc;
      },
      { toDo: 0, inProgress: 0, done: 0 }
    );

    const progressPercentage = totalTasks > 0 ? (taskStats.done / totalTasks) * 100 : 0;
    const inProgressPercentage = totalTasks > 0 ? (taskStats.inProgress / totalTasks) * 100 : 0;
    const toDoPercentage = totalTasks > 0 ? (taskStats.toDo / totalTasks) * 100 : 0;

    const formattedProject = {
      ...project,
      totalTasks,
      collaboratorsCount,
      taskStats,
      percentages: {
        progressPercentage,
        inProgressPercentage,
        toDoPercentage,
      },
      users: project.users.map((userEntry) => userEntry.user as ExtendedUser),
      createdBy: project.createdBy as ExtendedUser,
    };

    return formattedProject;
  } catch (error) {
    console.error('Error fetching project dashboard info from network:', error);
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('Erreur réseau: Impossible de charger les informations du tableau de bord du projet. Veuillez vérifier votre connexion.');
    }
    throw new Error('Impossible de charger les informations du tableau de bord du projet.');
  }
};
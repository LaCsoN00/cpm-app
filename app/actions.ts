"use server"

import prisma from '@/lib/prisma';
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { addPendingChange, getProjectById, getProjectTasks as getProjectTasksFromIdb, addTask as addTaskToIdb, getProjects as getProjectsFromIdb, deleteProjectFromIdb } from "@/lib/idb";
import { Task } from "@/lib/idb";
import { User } from '@prisma/client';

type OfflineUser = Pick<User, 'email'>;

export async function checkAndAddUser(email: string, name: string, imageUrl: string) {
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
                }
            })
            console.error("Erreur lors de la vérification de l'utilisateur:");
        } else if (existingUser && existingUser.name !== name || existingUser.imageUrl !== imageUrl) {
            await prisma.user.update({
                where: { email },
                data: {
                    name,
                    imageUrl,
                }
            })
            console.error("Utilisateur déjà présent dans la base de données");
        }
    } catch (error) {
        console.error("Erreur lors de la vérification de l'utilisateur:", error);
    }
}

export async function createProject(name: string, description: string | null, email: string, offlineTempId?: string) {
  console.log("createProject action called - offlineTempId:", offlineTempId);
  try {
    if (typeof window !== 'undefined' && !navigator.onLine) {
      const newProject = {
        id: offlineTempId || `offline-${Date.now()}`, // Temporary ID for offline project or use provided offlineTempId
        name,
        description,
        createdBy: { email },
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

export async function getProjectsCreatedByUser(email: string) {
  if (!email) {
    return [];
  }

  try {
    if (typeof window !== 'undefined' && !navigator.onLine) {
      const localProjects = await getProjectsFromIdb();
      const filteredProjects = localProjects.filter(project => project.createdById === email);
      if (filteredProjects) {
        console.log('Projets créés par l\'utilisateur chargés depuis IndexedDB (hors ligne):', filteredProjects);
        return filteredProjects;
      }
    }
    const projects = await prisma.project.findMany({
      where: {
        createdBy: { email },
      },
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
              },
            },
          },
        },
      },
    });

    const formattedProjects = projects.map((project) => ({
      ...project,
      users: project.users.map((userEntry) => userEntry.user),
    }));

    return formattedProjects;
  } catch (error) {
    console.error('Erreur lors du chargement des projets depuis le réseau:', error);
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('Erreur réseau: Impossible de charger les projets. Veuillez vérifier votre connexion.');
    }
    throw new Error('Impossible de charger les projets.');
  }
}

export async function getProjectsAssociatedWithUser(email: string) {
  if (!email) {
    return [];
  }

  try {
    if (typeof window !== 'undefined' && !navigator.onLine) {
      const localProjects = await getProjectsFromIdb();
      const filteredProjects = localProjects.filter(project => project.users?.some(user => user.email === email));
      if (filteredProjects) {
        console.log('Projets associés à l\'utilisateur chargés depuis IndexedDB (hors ligne):', filteredProjects);
        return filteredProjects;
      }
    }
    const projects = await prisma.project.findMany({
      where: {
        users: {
          some: {
            user: {
              email,
            },
          },
        },
      },
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
              },
            },
          },
        },
      },
    });

    const formattedProjects = projects.map((project) => ({
      ...project,
      users: project.users.map((userEntry) => userEntry.user),
    }));

    revalidatePath('/general-projects');
    return formattedProjects;
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
        await addTaskToIdb(newTask as Task); // Add to IndexedDB immediately
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
    try {
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
    });

    if (!existingProject) {
      console.warn(`Tentative de suppression d'un projet inexistant avec l'ID : ${projectId}.`);
      revalidatePath('/general-projects');
      return; // Sortir si le projet n'existe pas
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
  try {
    const existingTask = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!existingTask) {
      throw new Error('Tâche non trouvée.');
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

export const getProjectTasks = async (projectId: string) => {
  if (!projectId) {
    return [];
  }

  try {
    if (typeof window !== 'undefined' && !navigator.onLine) {
      const localTasks: Task[] = await getProjectTasksFromIdb(projectId);
      if (localTasks) {
        console.log('Tâches chargées depuis IndexedDB (hors ligne):', localTasks);
        return localTasks;
      }
    }
    const tasks = await prisma.task.findMany({
      where: { projectId: projectId },
      include: {
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
      orderBy: {
        createdAt: 'desc',
      },
    });

    return tasks;
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
              },
            },
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
      users: project.users.map((userEntry) => userEntry.user),
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
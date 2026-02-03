"use server"

import prisma from '@/lib/prisma';
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { addPendingChange, getProjectById, getProjectTasks as getProjectTasksFromIdb, addTask as addTaskToIdb, getProjects as getProjectsFromIdb, deleteProjectFromIdb } from "@/lib/idb";
import { Task as IdbTask } from "@/lib/idb"; // Renommer pour éviter les conflits
import { Priority, Role, Task, ReactionType } from '@prisma/client';
import type { Prisma } from '@prisma/client'; // Importer le type Prisma
import { ExtendedUser } from '@/type'; // Importer ExtendedUser et Project de @/typ
import { createClient } from "@/utils/supabase/server";

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
  console.log(`Vérification du rôle: Utilisateur actuel avec rôle ${user?.role}, rôles requis: ${requiredRoles.join(', ')}`);
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

export async function checkAndAddUser(email: string, name: string, imageUrl: string | null = null, role: Role = Role.USER) {
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
            console.log("Nouvel utilisateur créé avec succès.");
        } else if (existingUser && (existingUser.name !== name || (imageUrl !== null && existingUser.imageUrl !== imageUrl))) {
            const dataToUpdate: { name: string; imageUrl?: string | null } = { name };
            if (imageUrl !== null) {
                dataToUpdate.imageUrl = imageUrl;
            }
            await prisma.user.update({
                where: { email },
                data: dataToUpdate,
            })
            console.log("Utilisateur mis à jour (nom/image) - rôle conservé:", existingUser.role);
        }
    } catch (error) {
        console.error("Erreur lors de la vérification de l'utilisateur:", error);
    }
}

export async function createProject(name: string, description: string | null, email: string, offlineTempId?: string) {
  const currentUser = await checkRole([Role.USER, Role.CONSULTANT]); // Allow CONSULTANT and USER to create projects
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
      isConsultantProject: currentUser.role === Role.CONSULTANT, // Set based on role
    };

    // Prisma will generate a new UUID for `id`.
    const createdProject = await prisma.project.create({ data });

    // If the creator is a CONSULTANT, automatically add them as a ProjectUser
    if (currentUser.role === Role.CONSULTANT) {
      await prisma.projectUser.create({
        data: {
          userId: currentUser.id,
          projectId: createdProject.id,
        },
      });
    }

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
  const currentUser = await checkRole([Role.ADMIN, Role.USER, Role.CONSULTANT]); // Get current user's role
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

    const whereClause: Prisma.ProjectWhereInput = {};

    if (currentUser.role === Role.CONSULTANT) {
      whereClause.createdById = currentUser.id;
      whereClause.isConsultantProject = true; // Consultant only sees their own consultant projects
    } else if (currentUser.role === Role.ADMIN) { // Admin sees all projects
      // No restrictions for ADMIN role
    } else if (currentUser.role === Role.USER) {
      whereClause.OR = [
        { createdById: currentUser.id }, // Projects created by the current USER
        { users: { some: { userId: currentUser.id } } }, // Projects where the current USER is a collaborator
      ];
    }

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
                approved: true,
                restricted: true,
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
      users: project.users.map((userEntry) => userEntry as { user: ExtendedUser }),
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
  const currentUser = await checkRole([Role.ADMIN, Role.USER, Role.CONSULTANT]); // Get current user's role
  if (!email) {
    return { projects: [], totalCount: 0 };
  }

  try {
    if (typeof window !== 'undefined' && !navigator.onLine) {
      const localProjects = await getProjectsFromIdb();
      let filteredLocalProjects = localProjects.filter(project => 
        // Ensure non-consultant projects are visible to all associated users
        // Consultant projects are visible only to linked consultants, users, and admins
        (project.users?.some(userEntry => userEntry.user.email === email) || 
         (currentUser.role !== Role.CONSULTANT && project.createdBy?.email === email && !project.isConsultantProject)) &&
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

    // Existing Prisma query logic
    const whereClause: Prisma.ProjectWhereInput = {
      users: {
        some: {
          user: {
            email,
          },
        },
      },
      // Removed the OR condition for ADMIN/USER roles here.
      // Projects created by consultants should only appear if the user is a direct collaborator.
      // Consultant projects are visible to ADMIN/USER on "Mes projets" page via getProjectsCreatedByUser if applicable.
    };

    // If the current user is an ADMIN or USER, they can see all projects associated with them
    // If the current user is a CONSULTANT, they can only see non-consultant projects associated with them.
    // Consultant-created projects are handled in getProjectInfo and getProjectsCreatedByUser

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
                approved: true,
                restricted: true,
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
      users: project.users.map((userEntry) => userEntry as { user: ExtendedUser }),
      createdBy: project.createdBy as ExtendedUser,
    }));

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
  const currentUser = await checkRole([Role.ADMIN, Role.USER, Role.CONSULTANT]); // Get current user for permission check
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
      include: {
        users: {
          select: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                imageUrl: true,
                role: true,
                approved: true,
                restricted: true,
              },
            },
          },
        },
        createdBy: true,
        ...(details && {
          tasks: {
            include: {
              user: true,
              createdBy: true,
            },
          },
          assistanceRequests: {
            include: {
              consultant: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  imageUrl: true,
                  role: true,
                },
              },
              resolvedBy: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  imageUrl: true,
                  role: true,
                },
              },
              project: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
        }),
      },
    });

    if (!project) {
      return null; // Retourner null si le projet n'est pas trouvé
    }

    // Enforce visibility for consultant projects
    if (project.isConsultantProject) {
      // ADMINs and USERs can always see consultant projects
      if (currentUser.role === Role.ADMIN || currentUser.role === Role.USER) {
        // No restrictions for ADMIN or USER roles on consultant projects
      } else if (currentUser.role === Role.CONSULTANT) {
        const isCollaborator = project.users.some(pu => pu.user.id === currentUser.id);
        const isProjectCreator = project.createdById === currentUser.id;

        if (!isProjectCreator && !isCollaborator) {
          // If current user is a CONSULTANT and not the creator or a collaborator, deny access
          return null;
        }
      }
    }

    console.log("Contenu de project.users dans getProjectInfo:", project.users);

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
                return localProject.users.map(pu => pu.user);
            }
        }
        const projectWithUsers = await prisma.project.findUnique({
            where: {
                id: idProject
            },
            select: {
                users: {
                    select: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                imageUrl: true,
                                role: true,
                                approved: true,
                                restricted: true,
                            },
                        },
                    },
                },
            },
        });

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
    priority: Priority,
    deadline: Date | null,
    attachments: { name: string, url: string }[] | null, // Nouveau paramètre pour plusieurs pièces jointes
    projectId: string,
    createdByEmail: string,
    assignToEmail: string | undefined,
    offlineTempId?: string
) {
    const user = await checkRole([Role.USER]); // Seuls les USERS peuvent créer des tâches

    // Fetch the project to check ownership and collaborators
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
            createdById: true,
            isConsultantProject: true, // Include this to check project type
            users: {
                select: {
                    userId: true,
                },
            },
        },
    });

    if (!project) {
        throw new Error("Projet non trouvé.");
    }

    console.log(`createTask - User Role: ${user.role}, User ID: ${user.id}`);
    console.log(`createTask - Project Created By ID: ${project.createdById}, Is Consultant Project: ${project.isConsultantProject}`);
    console.log(`createTask - Project Users: ${JSON.stringify(project.users)}`);

    const isProjectCreator = project.createdById === user.id;
    const isCollaborator = project.users.some(pu => pu.userId === user.id); // Check if current user is a collaborator

    console.log(`createTask - Is Project Creator: ${isProjectCreator}, Is Collaborator: ${isCollaborator}`);

    // Validation: Prevent assigning tasks to consultants in consultant projects.
    if (assignToEmail) {
        const assignedUser = await prisma.user.findUnique({
            where: { email: assignToEmail },
            select: { role: true },
        });
        if (assignedUser?.role === Role.CONSULTANT && project.isConsultantProject) {
            throw new Error("Impossible d'assigner une tâche à un consultant dans un projet de consultant.");
        }
    }

    // L'assignation est obligatoire
    if (!assignToEmail) {
        throw new Error("Une assignation est obligatoire pour créer une tâche.");
    }

    if (!isProjectCreator && !isCollaborator) {
        throw new Error("Accès non autorisé : vous devez être créateur ou collaborateur du projet.");
    }

    const assignedUser = await prisma.user.findUnique({
        where: { email: assignToEmail }
    });
    if (!assignedUser) {
        throw new Error(`Utilisateur avec l'email ${assignToEmail} introuvable`);
    }
    const assignedUserId: string = assignedUser.id;

    let createdTask;

    if (typeof window !== 'undefined' && !navigator.onLine) {
        const newTaskData = {
            id: offlineTempId || `offline-task-${Date.now()}`,
            name,
            description,
            priority,
            deadline,
            projectId,
            createdById: user.id,
            userId: assignedUserId,
            status: 'To Do',
            createdAt: new Date(),
            updatedAt: new Date(),
            solutionDescription: null, // Add missing property
            attachments: attachments || [], // Inclure les pièces jointes pour le mode hors ligne
        };
        await addPendingChange({
            userId: createdByEmail,
            data: newTaskData,
            timestamp: new Date().toISOString(),
            type: 'task',
        });
        // Simulate creation for offline mode
        createdTask = { ...newTaskData /* Removed user and createdBy relations here */ };
        await addTaskToIdb(createdTask as IdbTask); // Add to IndexedDB immediately
        console.log('Tâche ajoutée hors ligne:', createdTask);
    } else {
        createdTask = await prisma.task.create({
            data: {
                name,
                description,
                status: "To Do", // Default status
                priority,
                deadline,
                projectId,
                createdById: user.id,
                userId: assignedUserId,
                attachments: {
                  create: attachments ? attachments.map(att => ({ ...att, uploadedById: user.id })) : [],
                },
            },
        });
    }

    // Automatically update status after creation (e.g., to "Late" if deadline passed)
    const finalTask = await updateTaskStatusAutomatically(createdTask);

    console.log('Tâche créée avec succès:', finalTask);
    revalidatePath(`/project/${projectId}`);
    revalidatePath(`/task-details/${finalTask.id}`); // Revalidate task details page as well
    return finalTask;
}
export async function deleteTaskById(taskId: string) {
  const user = await checkRole([Role.ADMIN, Role.USER, Role.CONSULTANT]); // Allow CONSULTANT to access for checking, but deny deletion

  if (user.role === Role.CONSULTANT) {
    throw new Error("Accès non autorisé : les consultants ne peuvent pas supprimer de tâches.");
  }
    try {
        const taskToDelete = await prisma.task.findUnique({
            where: { id: taskId },
            select: {
                createdBy: { select: { id: true } },
                project: {
                    select: {
                        createdById: true,
                        isConsultantProject: true, // Include this to check project type
                        users: { select: { userId: true } }, // Include project collaborators
                    },
                },
            },
        });

        if (!taskToDelete) {
            throw new Error("Tâche non trouvée.");
        }

        console.log(`deleteTaskById - User Role: ${user.role}, User ID: ${user.id}`);
        console.log(`deleteTaskById - Project Created By ID: ${taskToDelete.project?.createdById}, Is Consultant Project: ${taskToDelete.project?.isConsultantProject}`);
        console.log(`deleteTaskById - Task Created By ID: ${taskToDelete.createdBy.id}`);
        console.log(`deleteTaskById - Project Users: ${JSON.stringify(taskToDelete.project?.users)}`);

        const isProjectCreator = taskToDelete.project?.createdById === user.id;
        const isTaskCreator = taskToDelete.createdBy.id === user.id;
        const isCollaborator = taskToDelete.project?.users.some(pu => pu.userId === user.id); // Check if current user is a collaborator
        const isAssistantOnConsultantProject = taskToDelete.project?.isConsultantProject && user.role === Role.USER && !isProjectCreator && !isCollaborator;

        console.log(`deleteTaskById - Is Project Creator: ${isProjectCreator}, Is Task Creator: ${isTaskCreator}, Is Collaborator: ${isCollaborator}`);

        if (isAssistantOnConsultantProject) {
            throw new Error("Accès non autorisé : les assistants ne peuvent pas modifier un projet créé par un consultant.");
        }

        // Allow ADMINs, or USERs who are either project creators, task creators, or collaborators on any project type.
        // CONSULTANTs are explicitly blocked by the initial checkRole.
        if (
            user.role !== Role.ADMIN && // Not an ADMIN
            !isProjectCreator &&      // Not the project creator
            !isTaskCreator &&          // Not the task creator
            !(user.role === Role.USER && isCollaborator) // Not a USER who is a collaborator
        ) {
            throw new Error("Accès non autorisé : vous n'êtes ni administrateur, ni le créateur de la tâche, ni le créateur du projet, ni un collaborateur du projet.");
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
  const user = await checkRole([Role.ADMIN, Role.USER, Role.CONSULTANT]); // Allow ADMIN, USER, and CONSULTANT to delete their own projects
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

    await prisma.assistanceRequest.deleteMany({
      where: {
        projectId: projectId,
      },
    });

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
        attachments: {
          select: { id: true, name: true, url: true, createdAt: true, uploadedById: true }, // Inclure les champs nécessaires des pièces jointes
        },
      },
    });
    if (!task) {
      throw new Error('Tâche non trouvée');
    }

    const updatedTask = await updateTaskStatusAutomatically(task);

    return updatedTask;
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
      select: {
        userId: true,
        project: { select: { createdById: true, isConsultantProject: true, users: { select: { userId: true } } } },
        solutionDescription: true,
        status: true,
        priority: true, // Assurez-vous que la priorité est bien incluse
        user: { // Inclure l'utilisateur assigné
          select: {
            id: true, name: true, email: true, imageUrl: true, // Champs nécessaires
          },
        },
        createdBy: { // Inclure le créateur de la tâche
          select: {
            id: true, name: true, email: true, imageUrl: true, // Champs nécessaires
          },
        },
      },
    });

    if (!existingTask) {
      throw new Error('Tâche non trouvée.');
    }

    // Vérifier si la tâche est déjà terminée ou en retard
    if (existingTask.status === "Done" || existingTask.priority === "LATE") {
      throw new Error("Impossible de modifier le statut d'une tâche terminée ou en retard.");
    }

    const isProjectCreator = existingTask.project.createdById === user.id;
    const isTaskAssignee = existingTask.userId === user.id;
    const isCollaborator = existingTask.project.users.some(pu => pu.userId === user.id);
    const isAssistantOnConsultantProject = existingTask.project.isConsultantProject && user.role === Role.USER && !isProjectCreator && !isCollaborator;

    if (isAssistantOnConsultantProject) {
      throw new Error("Accès non autorisé : les assistants ne peuvent pas modifier un projet créé par un consultant.");
    }

    if (user.role !== Role.ADMIN && !isProjectCreator && !isTaskAssignee) {
      throw new Error("Accès non autorisé : vous n'êtes ni administrateur, ni l'assigné de la tâche, ni le créateur du projet.");
    }

    const updateData: { status: string; solutionDescription?: string | null; priority?: Priority } = {
      status: newStatus,
      solutionDescription: solutionDescription || existingTask.solutionDescription,
    };

    // Nouvelle logique pour la priorité (corrigée)
    if ((existingTask.priority as Priority) === Priority.LATE && (newStatus === "To Do" || newStatus === "In Progress")) {
      updateData.priority = Priority.HIGH;
    } else if (newStatus === "To Do" || newStatus === "In Progress") {
      updateData.priority = Priority.UNDEFINED;
    } else if (newStatus === "Late") {
      updateData.priority = Priority.LATE;
    }
    // Si le statut est "Done", la priorité n'est pas modifiée, elle reste telle quelle.

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: updateData,
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

export async function updateProject(projectId: string, name: string, description: string | null) {
  const user = await checkRole([Role.ADMIN, Role.USER]); // Only ADMIN or USER can update projects
  try {
    const existingProject = await prisma.project.findUnique({
      where: { id: projectId },
      select: { createdById: true },
    });

    if (!existingProject) {
      throw new Error("Projet non trouvé.");
    }

    if (user.role !== Role.ADMIN && existingProject.createdById !== user.id) {
      throw new Error("Accès non autorisé : vous n'êtes ni administrateur, ni le créateur du projet.");
    }

    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: { name, description },
    });

    revalidatePath(`/project/${projectId}`);
    revalidatePath('/general-projects');
    return updatedProject;
  } catch (error) {
    console.error("Erreur lors de la mise à jour du projet :", error);
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('Erreur réseau: Impossible de mettre à jour le projet. Veuillez vérifier votre connexion.');
    }
    throw new Error(`Échec de la mise à jour du projet: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function updateTask(
  taskId: string,
  name: string,
  description: string,
  deadline: Date | null,
  assignToEmail: string | undefined,
  attachments: { id?: string, name: string, url: string }[] | null, // Nouveau paramètre pour les pièces jointes
) {
  const user = await checkRole([Role.ADMIN, Role.USER, Role.CONSULTANT]); // Allow CONSULTANT to access for checking, but deny update

  if (user.role === Role.CONSULTANT) {
    throw new Error("Accès non autorisé : les consultants ne peuvent pas modifier de tâches.");
  }
  try {
    const existingTask = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        name: true,
        description: true,
        status: true, // Inclure le statut
        priority: true, // Inclure la priorité
        deadline: true,
        userId: true,
        createdById: true,
        projectId: true,
        project: { // Inclure le projet pour vérifier isConsultantProject et createdById
          select: { createdById: true, isConsultantProject: true, users: { select: { userId: true } } },
        },
        attachments: { select: { id: true, name: true, url: true } },
      },
    });

    if (!existingTask) {
      throw new Error("Tâche non trouvée.");
    }

    // Vérifier si la tâche est déjà terminée ou en retard
    if (existingTask.status === "Done" || existingTask.priority === "LATE") {
      throw new Error("Impossible de modifier une tâche terminée ou en retard.");
    }

    const isProjectCreator = existingTask.project.createdById === user.id;
    const isTaskCreator = existingTask.createdById === user.id;
    const isTaskAssignee = existingTask.userId === user.id;
    const isCollaborator = existingTask.project.users.some(pu => pu.userId === user.id);
    const isAssistantOnConsultantProject = existingTask.project.isConsultantProject && user.role === Role.USER && !isProjectCreator && !isCollaborator;

    console.log(`User Role: ${user.role}, Project Creator: ${isProjectCreator}, Task Creator: ${isTaskCreator}, Task Assignee: ${isTaskAssignee}, Collaborator: ${isCollaborator}`);

    if (isAssistantOnConsultantProject) {
      throw new Error("Accès non autorisé : les assistants ne peuvent pas modifier un projet créé par un consultant.");
    }

    // Allow ADMINs, or USERs who are either project creators, task creators, task assignees, or collaborators on any project type.
    // CONSULTANTs are explicitly blocked by the initial checkRole (line 910).
    if (
      user.role !== Role.ADMIN && // Not an ADMIN
      !isProjectCreator &&      // Not the project creator
      !isTaskCreator &&          // Not the task creator
      !isTaskAssignee &&         // Not the task assignee
      !(user.role === Role.USER && isCollaborator) // Not a USER who is a collaborator
    ) {
      throw new Error("Accès non autorisé : vous n'êtes ni administrateur, ni le créateur du projet, ni le créateur ou l'assigné de la tâche, ni un collaborateur du projet.");
    }

    let assignedUserId: string | null = null;
    if (assignToEmail) {
      const assignedUser = await prisma.user.findUnique({
        where: { email: assignToEmail }
      });
      if (!assignedUser) {
        throw new Error(`Utilisateur avec l'email ${assignToEmail} introuvable`);
      }
      assignedUserId = assignedUser.id;
    }

    const existingAttachmentIds = new Set(existingTask.attachments.map(att => att.id));
    const attachmentsToCreate = attachments?.filter(att => !att.id).map(att => ({ ...att, uploadedById: user.id, taskId }));
    const attachmentsToKeepIds = attachments?.filter(att => att.id && existingAttachmentIds.has(att.id)).map(att => att.id);
    const attachmentsToDeleteIds = Array.from(existingAttachmentIds).filter(id => !attachmentsToKeepIds?.includes(id));

    // Supprimer les pièces jointes qui ne sont plus présentes
    if (attachmentsToDeleteIds.length > 0) {
      await prisma.attachment.deleteMany({
        where: { id: { in: attachmentsToDeleteIds } },
      });
    }

    // Créer de nouvelles pièces jointes
    if (attachmentsToCreate && attachmentsToCreate.length > 0) {
      await prisma.attachment.createMany({
        data: attachmentsToCreate,
      });
    }

    let updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        name,
        description,
        // priority,
        deadline,
        userId: assignedUserId,
        // Supprimé: attachmentName,
        // Supprimé: attachmentUrl,
        // status,
      },
    });

    // After updating basic task details, automatically update status and priority
    updatedTask = await updateTaskStatusAutomatically(updatedTask);

    console.log(`[updateTask] Tâche mise à jour avec l'ID: ${taskId}, nouvelle deadline: ${deadline?.toISOString() || 'N/A'}`);

    revalidatePath(`/task-details/${taskId}`);
    revalidatePath(`/project/${existingTask.project.createdById}`); // Revalidate project page to update task list
    return updatedTask;
  } catch (error) {
    console.error("Erreur lors de la mise à jour de la tâche :", error);
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('Erreur réseau: Impossible de mettre à jour la tâche. Veuillez vérifier votre connexion.');
    }
    throw new Error(`Échec de la mise à jour de la tâche: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Nouvelle signature pour inclure les détails de la tâche
export async function createAssistanceRequest(
  message: string, 
  projectId: string | null = null,
  taskDetails?: {
    name: string;
    description: string;
    priority: Priority;
    deadline: Date | null;
  }
) {
  try {
    const currentUser = await checkRole([Role.CONSULTANT]); // Only CONSULTANTs can create assistance requests

    if (!currentUser) {
      throw new Error("Utilisateur non authentifié ou rôle non autorisé.");
    }

    if (!message || message.trim() === '') {
      throw new Error("Le message d'assistance ne peut pas être vide.");
    }

    if (projectId) {
      const projectExists = await prisma.project.findUnique({
        where: { id: projectId },
      });
      if (!projectExists) {
        throw new Error("Projet spécifié introuvable.");
      }
    }

    const newAssistanceRequest = await prisma.assistanceRequest.create({
      data: {
        consultantId: currentUser.id,
        projectId: projectId,
        message: message,
        status: "pending",
        taskName: taskDetails?.name,
        taskDescription: taskDetails?.description,
        taskPriority: taskDetails?.priority,
        taskDeadline: taskDetails?.deadline,
      },
    });

    console.log("Nouvelle demande d'assistance créée:", newAssistanceRequest);
    return newAssistanceRequest;

  } catch (error) {
    console.error("Erreur lors de la création de la demande d'assistance:", error);
    throw new Error(`Échec de la création de la demande d'assistance: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function respondToAssistanceRequest(requestId: string, resolution: 'resolved' | 'rejected') {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    throw new Error("Utilisateur non authentifié.");
  }

  // Seuls les USERS ou ADMINS peuvent traiter une demande d'assistance
  if (currentUser.role !== Role.USER && currentUser.role !== Role.ADMIN) {
    throw new Error("Accès non autorisé : seul un utilisateur avec le rôle USER ou ADMIN peut traiter une demande d'assistance.");
  }

  const assistanceRequest = await prisma.assistanceRequest.findUnique({
    where: { id: requestId },
    include: {
      project: {
        select: {
          id: true,
          createdById: true,
          users: {
            select: {
              userId: true,
            },
          },
        },
      },
    },
  });

  if (!assistanceRequest) {
    throw new Error("Demande d'assistance introuvable.");
  }

  if (assistanceRequest.status !== 'pending') {
    throw new Error("Cette demande a déjà été traitée.");
  }

  // Si la demande est liée à un projet et que l'utilisateur n'est pas ADMIN
  if (assistanceRequest.projectId && currentUser.role !== Role.ADMIN) {
    const isProjectCreator = assistanceRequest.project?.createdById === currentUser.id;
    const isCollaborator = assistanceRequest.project?.users?.some((pu) => pu.userId === currentUser.id);
    if (!isProjectCreator && !isCollaborator) {
      throw new Error("Accès non autorisé pour traiter cette demande d'assistance liée à ce projet.");
    }
  }

  // Création automatique de tâche si approuvée et contient des détails
  if (resolution === 'resolved' && assistanceRequest.taskName && assistanceRequest.projectId) {
    await prisma.task.create({
      data: {
        name: assistanceRequest.taskName,
        description: assistanceRequest.taskDescription || "",
        priority: assistanceRequest.taskPriority || Priority.LOW,
        deadline: assistanceRequest.taskDeadline,
        projectId: assistanceRequest.projectId,
        createdById: currentUser.id,
        userId: assistanceRequest.consultantId, // Assignée au consultant par défaut
        status: "To Do",
      }
    });
  }

  const updatedRequest = await prisma.assistanceRequest.update({
    where: { id: requestId },
    data: {
      status: resolution,
      resolvedById: currentUser.id,
      resolvedAt: new Date(),
    },
    include: {
      consultant: true,
      resolvedBy: true,
    },
  });

  if (assistanceRequest.projectId) {
    revalidatePath(`/project/${assistanceRequest.projectId}`);
  }
  revalidatePath('/admin/dashboard');
  return updatedRequest;
}

export const getProjectTasks = async (projectId: string, skip: number = 0, take: number = 5, searchTerm: string = "", sortOrder: "asc" | "desc" = "asc", statusFilter: string = "", assignedFilter: boolean = false, userEmail: string | undefined) => {
  if (!projectId) {
    return { tasks: [], totalCount: 0 };
  }

  try {
    if (typeof window !== 'undefined' && !navigator.onLine) {
      const localTasks: IdbTask[] = await getProjectTasksFromIdb(projectId);
      const filteredLocalTasks = [...localTasks].filter(task => 
        task.projectId === projectId &&
        ((task.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (task.description && task.description.toLowerCase().includes(searchTerm.toLowerCase()))) &&
        (!statusFilter || task.status === statusFilter) &&
        (!assignedFilter || (userEmail && task.user?.email === userEmail))
      ).sort((a, b) => {
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
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    if (statusFilter) {
      whereClause.status = statusFilter;
    }

    if (assignedFilter && userEmail) {
      whereClause.user = { email: userEmail };
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
        project: { // Include the project to access its properties
            select: {
                id: true,
                createdById: true,
                isConsultantProject: true, // Crucial for permission checks
                users: { // Include project users for collaborator checks
                    select: {
                        userId: true,
                        user: { select: { email: true } }, // Select user email for comparison
                    },
                },
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

    const tasksWithUpdatedStatus = await Promise.all(
      tasks.map(async (task) => await updateTaskStatusAutomatically(task))
    );

    return { tasks: tasksWithUpdatedStatus, totalCount };
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
                approved: true,
                restricted: true,
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
    const collaboratorsCount = project.users.filter(userEntry => userEntry.user.id !== project.createdById).length;

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
      users: project.users.map((userEntry) => userEntry as { user: ExtendedUser }),
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

export async function updateUserProfileImage(email: string, imageUrl: string) {
  try {
    const user = await prisma.user.update({
      where: { email },
      data: { imageUrl },
      select: { imageUrl: true }, // Return the updated imageUrl
    });
    revalidatePath('/'); // Revalidate paths where user image might be displayed
    revalidatePath('/user/profile');
    return { success: true, imageUrl: user.imageUrl };
  } catch (error) {
    console.error("Erreur lors de la mise à jour de l'image de profil :", error);
    return { success: false, error: "Échec de la mise à jour de l'image de profil." };
  }
}

export async function getAllUsersForCollaboration() {
  const currentUser = await checkRole([Role.CONSULTANT, Role.ADMIN]); // Only consultants and admins can fetch all users for collaboration

  if (!currentUser) {
    throw new Error("Utilisateur non authentifié ou rôle non autorisé.");
  }

  try {
    const users = await prisma.user.findMany({
      where: {
        role: Role.USER, // Only fetch users with Role.USER
        id: { not: currentUser.id }, // Exclude the current user (consultant/admin making the request)
      },
      select: {
        id: true,
        name: true,
        email: true,
        imageUrl: true,
        role: true,
        approved: true,
        restricted: true,
        tasks: {
          where: {
            status: { in: ["To Do", "In Progress"] },
          },
          select: {
            id: true,
            status: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
    return users;
  } catch (error) {
    console.error("Erreur lors du chargement de tous les utilisateurs pour la collaboration:", error);
    throw new Error(`Erreur lors du chargement de tous les utilisateurs pour la collaboration: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function createComment(taskId: string, content: string, userEmail: string, parentId: string | null = null) {
  await checkRole([Role.USER, Role.CONSULTANT, Role.ADMIN]); // Anyone can comment

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email: userEmail },
      select: { id: true },
    });

    if (!existingUser) {
      throw new Error("Utilisateur non trouvé.");
    }

    const newComment = await prisma.comment.create({
      data: {
        content,
        taskId,
        userId: existingUser.id,
        parentId, // Pour les réponses
      },
      include: {
        user: { select: { id: true, name: true, email: true, imageUrl: true } },
        reactions: true,
        replies: {
          include: {
            user: { select: { id: true, name: true, email: true, imageUrl: true } },
            reactions: true,
          },
        },
      },
    });

    revalidatePath(`/task-details/${taskId}`);
    return newComment;
  } catch (error) {
    console.error("Erreur lors de la création du commentaire :", error);
    throw new Error(`Échec de la création du commentaire: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function addMultipleUsersToProject(projectId: string, userIds: string[]) {
  const currentUser = await checkRole([Role.ADMIN, Role.CONSULTANT]); // Only ADMIN or CONSULTANT can add multiple users

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { createdById: true },
    });

    if (!project) {
      throw new Error("Projet non trouvé.");
    }

    // If current user is a CONSULTANT, ensure they are the project creator
    if (currentUser.role === Role.CONSULTANT && project.createdById !== currentUser.id) {
      throw new Error("Accès non autorisé : Les consultants ne peuvent ajouter des utilisateurs qu'à leurs propres projets.");
    }

    const existingProjectUsers = await prisma.projectUser.findMany({
      where: { projectId, userId: { in: userIds } },
      select: { userId: true },
    });

    const existingUserIds = new Set(existingProjectUsers.map(pu => pu.userId));
    const usersToAdd = userIds.filter(id => !existingUserIds.has(id));

    if (usersToAdd.length > 0) {
      await prisma.projectUser.createMany({
        data: usersToAdd.map(userId => ({
          projectId,
          userId,
        })),
        skipDuplicates: true, // Skip if a user is already associated
      });
    }

    revalidatePath(`/project/${projectId}`);
    return { success: true, message: `${usersToAdd.length} utilisateurs ajoutés au projet avec succès.` };
  } catch (error) {
    console.error("Erreur lors de l'ajout de plusieurs utilisateurs au projet :", error);
    throw new Error(`Échec de l'ajout de plusieurs utilisateurs au projet: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getCommentsForTask(taskId: string) {
  try {
    const comments = await prisma.comment.findMany({
      where: { taskId, parentId: null }, // Fetch top-level comments
      include: {
        user: { select: { id: true, name: true, email: true, imageUrl: true } },
        reactions: true,
        replies: {
          include: {
            user: { select: { id: true, name: true, email: true, imageUrl: true } },
            reactions: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return comments;
  } catch (error) {
    console.error("Erreur lors du chargement des commentaires :", error);
    throw new Error(`Échec du chargement des commentaires: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function toggleCommentReaction(commentId: string, userId: string, reactionType: ReactionType) {
  await checkRole([Role.USER, Role.CONSULTANT, Role.ADMIN]); // Anyone can react to a comment

  try {
    const existingReaction = await prisma.commentReaction.findUnique({
      where: {
        userId_commentId: {
          userId,
          commentId,
        },
      },
    });

    if (existingReaction) {
      // If a reaction exists, delete it (toggle off)
      await prisma.commentReaction.delete({
        where: {
          userId_commentId: {
            userId,
            commentId,
          },
        },
      });
    } else {
      // If no reaction exists, create one
      await prisma.commentReaction.create({
        data: {
          commentId,
          userId,
          type: reactionType, // Use the provided reactionType
        },
      });
    }

    // revalidatePath(`/task-details/${commentId}`); // Revalidate the task details page to show updated reactions
    return { success: true };
  } catch (error) {
    console.error("Erreur lors de la gestion de la réaction au commentaire :", error);
    throw new Error(`Échec de la gestion de la réaction au commentaire: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function updateComment(commentId: string, newContent: string) {
  const currentUser = await checkRole([Role.USER, Role.CONSULTANT, Role.ADMIN]); // Anyone can edit their own comment, or if they have higher roles

  try {
    const existingComment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { userId: true, taskId: true, task: { select: { createdById: true } } },
    });

    if (!existingComment) {
      throw new Error("Commentaire non trouvé.");
    }

    const isCommentCreator = existingComment.userId === currentUser.id;
    const isTaskCreator = existingComment.task.createdById === currentUser.id;

    if (currentUser.role !== Role.ADMIN && !isCommentCreator && !isTaskCreator) {
      throw new Error("Accès non autorisé : vous n'êtes ni administrateur, ni le créateur du commentaire, ni le créateur de la tâche.");
    }

    await prisma.comment.update({
      where: { id: commentId },
      data: { content: newContent },
    });

    revalidatePath(`/task-details/${existingComment.taskId}`);
    return { success: true };
  } catch (error) {
    console.error("Erreur lors de la mise à jour du commentaire :", error);
    throw new Error(`Échec de la mise à jour du commentaire: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function deleteComment(commentId: string) {
  const currentUser = await checkRole([Role.USER, Role.CONSULTANT, Role.ADMIN]); // Anyone can delete their own comment, or if they have higher roles

  try {
    const commentToDelete = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { userId: true, taskId: true, task: { select: { createdById: true } } },
    });

    if (!commentToDelete) {
      throw new Error("Commentaire non trouvé.");
    }

    const isCommentCreator = commentToDelete.userId === currentUser.id;
    const isTaskCreator = commentToDelete.task.createdById === currentUser.id;

    if (currentUser.role !== Role.ADMIN && !isCommentCreator && !isTaskCreator) {
      throw new Error("Accès non autorisé : vous n'êtes ni administrateur, ni le créateur du commentaire, ni le créateur de la tâche.");
    }

    await prisma.comment.delete({
      where: { id: commentId },
    });

    revalidatePath(`/task-details/${commentToDelete.taskId}`);
    return { success: true };
  } catch (error) {
    console.error("Erreur lors de la suppression du commentaire :", error);
    throw new Error(`Échec de la suppression du commentaire: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// TODO: Implémenter la logique réelle de mise à jour automatique du statut de la tâche
async function updateTaskStatusAutomatically(task: Task) {
  const now = new Date();
  // Ne pas mettre à jour le statut si la tâche est déjà "Done" ou "Cancelled"
  if (task.status === "Done" || task.status === "Cancelled") {
    return task;
  }

  // Vérifier si la deadline est dépassée et la priorité n'est pas déjà 'Late'
  if (task.deadline && task.deadline < now && task.priority !== Priority.LATE) {
    try {
      const updatedTask = await prisma.task.update({
        where: { id: task.id },
        data: {
          priority: Priority.LATE,
          // status: "Late" // REMOVED: Keep existing status (e.g. "To Do") but mark priority as Late
        },
      });
      console.log(`[updateTaskStatusAutomatically] Tâche ${task.id} priorité mise à jour à 'Late'.`);
      return updatedTask;
    } catch (error) {
      console.error(`Erreur lors de la mise à jour automatique de la tâche ${task.id}:`, error);
      // En cas d'erreur, retourner la tâche originale pour éviter de bloquer
      return task;
    }
  }
  // Si aucune mise à jour n'est nécessaire, retourner la tâche originale
  return task;
}
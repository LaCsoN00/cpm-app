"use server"

import prisma from '@/lib/prisma';
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { addPendingChange, getProjectById, getProjectTasks as getProjectTasksFromIdb, addTask as addTaskToIdb, getProjects as getProjectsFromIdb, deleteProjectFromIdb } from "@/lib/idb";
import { Task as IdbTask } from "@/lib/idb"; // Renommer pour éviter les conflits
import { Task, Priority, Role, ReactionType } from '@prisma/client';
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
    projectId: string,
    createdByEmail: string,
    assignToEmail: string | undefined,
    offlineTempId?: string
) {
    const user = await checkRole([Role.USER, Role.CONSULTANT]); // Only USER or CONSULTANT can create tasks

    // No longer explicitly disallowing consultants, as they are now allowed by checkRole
    // if (user.role === Role.CONSULTANT) {
    //     throw new Error("Accès non autorisé : les consultants ne peuvent pas créer de tâches.");
    // }

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

    // Allow ADMINs, or USERs who are either project creators or collaborators on any project type.
    // CONSULTANTs are explicitly blocked by the initial checkRole.

    // Validation: Prevent assigning tasks to consultants in consultant projects.
    if (assignToEmail) {
        const assignedUser = await prisma.user.findUnique({
            where: { email: assignToEmail },
            select: { role: true },
        });
        if (assignedUser?.role === Role.CONSULTANT && project.isConsultantProject) {
            throw new Error("Impossible d\'assigner une tâche à un consultant dans un projet de consultant.");
        }
    }

    if (
        user.role !== Role.ADMIN && // Not an ADMIN
        !isProjectCreator &&      // Not the project creator
        !(user.role === Role.USER && isCollaborator) // Not a USER who is a collaborator
    ) {
        throw new Error("Accès non autorisé : vous n'êtes ni administrateur, ni le créateur du projet, ni un collaborateur du projet.");
    }

    // Special condition: if it's a consultant project, only ADMINs and USER collaborators can create tasks.
    // The project creator (consultant) is already blocked by the initial checkRole and user.role check.
    if (project.isConsultantProject && user.role === Role.USER && !isCollaborator) {
        throw new Error("Accès non autorisé : En tant qu'utilisateur, vous devez être collaborateur sur ce projet de consultant pour créer une tâche.");
    }

    let assignedUserId = user.id;
    if (assignToEmail) {
        const assignedUser = await prisma.user.findUnique({
            where: { email: assignToEmail }
        });
        if (!assignedUser) {
            throw new Error(`Utilisateur avec l'email ${assignToEmail} introuvable`);
        }
        assignedUserId = assignedUser.id;
    }

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

        console.log(`deleteTaskById - Is Project Creator: ${isProjectCreator}, Is Task Creator: ${isTaskCreator}, Is Collaborator: ${isCollaborator}`);

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

        // Special condition: if it's a consultant project and the user is a USER, they must be a collaborator to delete a task.
        if (taskToDelete.project?.isConsultantProject && user.role === Role.USER && !isCollaborator) {
            throw new Error("Accès non autorisé : En tant qu'utilisateur, vous devez être collaborateur sur ce projet de consultant pour supprimer une tâche.");
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
  priority: Priority,
  deadline: Date | null,
  assignToEmail: string | undefined,
  status: string
) {
  const user = await checkRole([Role.ADMIN, Role.USER, Role.CONSULTANT]); // Allow CONSULTANT to access for checking, but deny update

  if (user.role === Role.CONSULTANT) {
    throw new Error("Accès non autorisé : les consultants ne peuvent pas modifier de tâches.");
  }
  try {
    const existingTask = await prisma.task.findUnique({
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
        userId: true,
      },
    });

    if (!existingTask) {
      throw new Error("Tâche non trouvée.");
    }

    console.log(`updateTask - User Role: ${user.role}, User ID: ${user.id}`);
    console.log(`updateTask - Project Created By ID: ${existingTask.project.createdById}, Is Consultant Project: ${existingTask.project.isConsultantProject}`);
    console.log(`updateTask - Project Users: ${JSON.stringify(existingTask.project.users)}`);

    const isProjectCreator = existingTask.project.createdById === user.id;
    const isTaskCreator = existingTask.createdBy.id === user.id;
    const isTaskAssignee = existingTask.userId === user.id;
    const isCollaborator = existingTask.project.users.some(pu => pu.userId === user.id); // Check if current user is a collaborator

    console.log(`updateTask - Is Project Creator: ${isProjectCreator}, Is Task Creator: ${isTaskCreator}, Is Task Assignee: ${isTaskAssignee}, Is Collaborator: ${isCollaborator}`);

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

    // Special condition: if it's a consultant project and the user is a USER, they must be a collaborator to update a task.
    if (existingTask.project.isConsultantProject && user.role === Role.USER && !isCollaborator) {
        throw new Error("Accès non autorisé : En tant qu'utilisateur, vous devez être collaborateur sur ce projet de consultant pour modifier une tâche.");
    }

    let assignedUserId: string | undefined = undefined;
    if (assignToEmail) {
      const assignedUser = await prisma.user.findUnique({
        where: { email: assignToEmail }
      });
      if (!assignedUser) {
        throw new Error(`Utilisateur avec l'email ${assignToEmail} introuvable`);
      }
      assignedUserId = assignedUser.id;
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        name,
        description,
        priority,
        deadline,
        userId: assignedUserId,
        status,
      },
    });

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

export async function createAssistanceRequest(message: string, projectId: string | null = null) {
  try {
    const currentUser = await checkRole([Role.CONSULTANT]); // Only CONSULTANTs can create assistance requests

    if (!currentUser) {
      throw new Error("Utilisateur non authentifié ou rôle non autorisé.");
    }

    if (!message || message.trim() === '') {
      throw new Error("Le message d'assistance ne peut pas être vide.");
    }

    // Optional: Verify project exists if projectId is provided
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
      },
    });

    // TODO: Notify admins/users about the new assistance request
    console.log("Nouvelle demande d'assistance créée:", newAssistanceRequest);
    return newAssistanceRequest;

  } catch (error) {
    console.error("Erreur lors de la création de la demande d'assistance:", error);
    throw new Error(`Échec de la création de la demande d'assistance: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function createTaskRequest(
  projectId: string,
  name: string,
  description: string,
  priority: Priority,
  deadline: Date | null,
  comments: string | null,
) {
  try {
    const currentUser = await checkRole([Role.CONSULTANT]); // Only CONSULTANTs can create task requests

    if (!currentUser) {
      throw new Error("Utilisateur non authentifié ou rôle non autorisé.");
    }

    if (!name || name.trim() === '') {
      throw new Error("Le nom de la tâche ne peut pas être vide.");
    }

    if (!description || description.trim() === '') {
      throw new Error("La description de la tâche ne peut pas être vide.");
    }

    // Verify project exists
    const projectExists = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, createdById: true },
    });
    if (!projectExists) {
      throw new Error("Projet spécifié introuvable.");
    }

    // Verify the current consultant is the creator of this project.
    if (projectExists.createdById !== currentUser.id) {
        throw new Error("Accès non autorisé: Vous ne pouvez créer de demandes de tâches que pour vos propres projets.");
    }

    const newTaskRequest = await prisma.taskRequest.create({
      data: {
        projectId: projectId,
        consultantId: currentUser.id,
        name: name,
        description: description,
        priority: priority,
        deadline: deadline,
        comments: comments,
        status: "pending", // Default status
      },
    });

    // TODO: Notify project collaborators/admins about the new task request
    revalidatePath(`/project/${projectId}`);
    console.log("Nouvelle demande de tâche créée:", newTaskRequest);
    return newTaskRequest;

  } catch (error) {
    console.error("Erreur lors de la création de la demande de tâche:", error);
    throw new Error(`Échec de la création de la demande de tâche: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
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
    throw new Error(`Échec du chargement des utilisateurs: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function addMultipleUsersToProject(projectId: string, userIds: string[]) {
  const currentUser = await checkRole([Role.CONSULTANT, Role.ADMIN]); // Only consultants (project creator) and admins can add users

  if (!currentUser) {
    throw new Error("Utilisateur non authentifié ou rôle non autorisé.");
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, createdById: true, isConsultantProject: true },
  });

  if (!project) {
    throw new Error("Projet non trouvé.");
  }

  // A consultant can only add users to projects they created.
  if (currentUser.role === Role.CONSULTANT && project.createdById !== currentUser.id) {
    throw new Error("Accès non autorisé: Les consultants ne peuvent ajouter des collaborateurs qu'à leurs propres projets.");
  }

  const addedUsers: string[] = [];
  const errors: string[] = [];

  for (const userId of userIds) {
    // Check if user exists
    const userToAdd = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!userToAdd) {
      errors.push(`Utilisateur avec l'ID ${userId} introuvable.`);
      continue;
    }

    // Check for existing association
    const existingAssociation = await prisma.projectUser.findUnique({
      where: {
        userId_projectId: {
          userId: userToAdd.id,
          projectId: project.id,
        },
      },
    });

    if (existingAssociation) {
      errors.push(`Utilisateur ${userToAdd.email} est déjà associé à ce projet.`);
      continue;
    }

    // Create association
    await prisma.projectUser.create({
      data: {
        userId: userToAdd.id,
        projectId: project.id,
      },
    });
    addedUsers.push(userToAdd.email);
  }

  revalidatePath(`/project/${projectId}`);

  if (errors.length > 0) {
    return { success: false, addedUsers, errors, message: "Certains utilisateurs n'ont pas pu être ajoutés." };
  }

  return { success: true, addedUsers, message: "Collaborateurs ajoutés avec succès !" };
}

export async function addUsersToProjectByConsultant(projectInviteCode: string, userEmails: string[]) {
  try {
    const currentUser = await checkRole([Role.ADMIN, Role.CONSULTANT]); // Only ADMIN or CONSULTANT can add multiple users

    if (!currentUser) {
      throw new Error("Utilisateur non authentifié ou rôle non autorisé.");
    }

    const project = await prisma.project.findUnique({
      where: { inviteCode: projectInviteCode },
      select: { id: true, createdById: true, isConsultantProject: true },
    });

    if (!project) {
      throw new Error("Projet non trouvé.");
    }

    // Check if the current user is the project creator or an ADMIN
    const isProjectCreator = project.createdById === currentUser.id;
    if (currentUser.role === Role.CONSULTANT && !isProjectCreator) {
      throw new Error("Accès non autorisé: Seul le créateur du projet ou un administrateur peut inviter des collaborateurs.");
    }

    const addedUsers: string[] = [];
    const errors: string[] = [];

    for (const email of userEmails) {
      const userToAdd = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true },
      });

      if (!userToAdd) {
        errors.push(`Utilisateur avec l'email ${email} introuvable.`);
        continue;
      }

      const existingAssociation = await prisma.projectUser.findUnique({
        where: {
          userId_projectId: {
            userId: userToAdd.id,
            projectId: project.id,
          },
        },
      });

      if (existingAssociation) {
        errors.push(`Utilisateur ${email} est déjà associé à ce projet.`);
        continue;
      }

      await prisma.projectUser.create({
        data: {
          userId: userToAdd.id,
          projectId: project.id,
        },
      });
      addedUsers.push(email);
    }

    revalidatePath(`/project/${project.id}`);

    if (errors.length > 0) {
      return { success: false, addedUsers, errors, message: "Certains utilisateurs n'ont pas pu être ajoutés." };
    }

    return { success: true, addedUsers, message: "Collaborateurs ajoutés avec succès !" };
  } catch (error) {
    console.error(error);
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      return { success: false, addedUsers: [], errors: [], message: "Erreur réseau: Impossible d'ajouter les utilisateurs au projet." };
    }
    return { success: false, addedUsers: [], errors: [], message: "Erreur lors de l'ajout des utilisateurs au projet." };
  }
}

export async function updateTaskStatusAutomatically(task: Task) {
  // Convertir le type Prisma.Task vers le type Task étendu si nécessaire
  const extendedTask: Task = task as Task; // Assurez-vous que l'objet tâche a toutes les propriétés requises

  if (extendedTask.status === "Done") {
    return extendedTask; // Ne pas modifier une tâche déjà terminée
  }

  if (!extendedTask.deadline) {
    return extendedTask; // Pas de deadline, pas de changement automatique de statut
  }

  const now = new Date();
  const deadlineDate = new Date(extendedTask.deadline);
  const diffTime = deadlineDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let newStatus = extendedTask.status;

  if (diffDays < 0) {
    newStatus = "Late"; // Deadline dépassée
  } else if (diffDays <= 3 && extendedTask.status === "To Do") {
    newStatus = "In Progress"; // Moins de 3 jours avant la deadline, et toujours "To Do"
  }

  if (newStatus !== extendedTask.status) {
    try {
      const updatedTask = await prisma.task.update({
        where: { id: extendedTask.id },
        data: { status: newStatus },
      });
      extendedTask.status = updatedTask.status; // Mettre à jour le statut de l'objet en mémoire
      revalidatePath(`/task-details/${extendedTask.id}`);
      revalidatePath(`/project/${extendedTask.projectId}`);
    } catch (error) {
      console.error(`Erreur lors de la mise à jour automatique du statut de la tâche ${extendedTask.id}:`, error);
    }
  }

  return extendedTask;
}

export async function createComment(taskId: string, userId: string, content: string, parentId: string | null = null) {
  try {
    const comment = await prisma.comment.create({
      data: {
        taskId,
        userId,
        content,
        parentId,
      },
      include: {
        user: { select: { id: true, name: true, email: true, imageUrl: true, role: true, approved: true, restricted: true } },
        reactions: { include: { user: { select: { id: true, name: true, email: true, role: true, approved: true, restricted: true } } } },
        // replies: { include: { user: { select: { id: true, name: true, email: true, imageUrl: true } }, reactions: { include: { user: { select: { id: true, name: true, email: true } } } } }, orderBy: { createdAt: 'asc' } }, // Removed recursive replies
      },
    });
    return comment;
  } catch (error) {
    console.error('Erreur lors de la création du commentaire:', error);
    throw new Error('Impossible de créer le commentaire.');
  }
}

export async function getCommentsForTask(taskId: string) {
  try {
    const comments = await prisma.comment.findMany({
      where: {
        taskId,
        parentId: null, // Only fetch top-level comments
      },
      include: {
        user: { select: { id: true, name: true, email: true, imageUrl: true, role: true, approved: true, restricted: true } },
        reactions: {
          include: { user: { select: { id: true, name: true, email: true, role: true, approved: true, restricted: true } } },
        },
        replies: {
          include: {
            user: { select: { id: true, name: true, email: true, imageUrl: true, role: true, approved: true, restricted: true } },
            reactions: {
              include: { user: { select: { id: true, name: true, email: true, role: true, approved: true, restricted: true } } },
            },
            replies: { // Recursive replies
              include: {
                user: { select: { id: true, name: true, email: true, imageUrl: true, role: true, approved: true, restricted: true } },
                reactions: {
                  include: { user: { select: { id: true, name: true, email: true, role: true, approved: true, restricted: true } } },
                },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
    return comments;
  } catch (error) {
    console.error(`Erreur lors de la récupération des commentaires pour la tâche ${taskId}:`, error);
    throw new Error('Impossible de récupérer les commentaires.');
  }
}

export async function updateComment(commentId: string, content: string) {
  const user = await getCurrentUser();
  if (!user) { throw new Error("Utilisateur non authentifié."); }

  try {
    const existingComment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { userId: true, taskId: true },
    });

    if (!existingComment) { throw new Error("Commentaire non trouvé."); }

    // Only the comment creator can update
    if (existingComment.userId !== user.id) {
      throw new Error("Accès non autorisé : vous n'êtes pas l'auteur de ce commentaire.");
    }

    const comment = await prisma.comment.update({
      where: { id: commentId },
      data: { content },
      include: {
        user: { select: { id: true, name: true, email: true, imageUrl: true } },
        reactions: { include: { user: { select: { id: true, name: true, email: true } } } },
        // replies: { include: { user: { select: { id: true, name: true, email: true, imageUrl: true } }, reactions: { include: { user: { select: { id: true, name: true, email: true } } } } }, orderBy: { createdAt: 'asc' } }, // Removed recursive replies
      },
    });
    return comment;
  } catch (error) {
    console.error('Erreur lors de la mise à jour du commentaire:', error);
    throw new Error('Impossible de mettre à jour le commentaire.');
  }
}

export async function deleteComment(commentId: string) {
  const user = await getCurrentUser();
  if (!user) { throw new Error("Utilisateur non authentifié."); }

  try {
    const existingComment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { userId: true, taskId: true },
    });

    if (!existingComment) { throw new Error("Commentaire non trouvé."); }

    // Only the comment creator or an ADMIN can delete
    if (user.role !== Role.ADMIN && existingComment.userId !== user.id) {
      throw new Error("Accès non autorisé : vous n'êtes pas l'auteur de ce commentaire ou un administrateur.");
    }

    const comment = await prisma.comment.delete({
      where: { id: commentId },
    });
    return comment;
  } catch (error) {
    console.error('Erreur lors de la suppression du commentaire:', error);
    throw new Error('Impossible de supprimer le commentaire.');
  }
}

export async function toggleCommentReaction(commentId: string, userId: string, reactionType: ReactionType) {
  try {
    // Find if the user has any existing reaction on this comment
    const existingReaction = await prisma.commentReaction.findFirst({
      where: { commentId, userId },
    });

    if (existingReaction) {
      if (existingReaction.type === reactionType) {
        // User clicked on the same reaction type again, so remove it (toggle off)
        await prisma.commentReaction.delete({
          where: { id: existingReaction.id },
        });
      } else {
        // User clicked on the opposite reaction type, so update the existing one
        await prisma.commentReaction.update({
          where: { id: existingReaction.id },
          data: { type: reactionType },
        });
      }
    } else {
      // No existing reaction, so create a new one
      await prisma.commentReaction.create({
        data: {
          commentId,
          userId,
          type: reactionType,
        },
      });
    }

    const updatedComment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        user: { select: { id: true, name: true, email: true, imageUrl: true } },
        reactions: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
    });
    return updatedComment;
  } catch (error) {
    console.error("Erreur lors de l'ajout/modification/suppression de la réaction:", error);
    throw new Error("Impossible d'ajouter/modifier/supprimer la réaction.");
  }
}

export async function removeCommentReaction(reactionId: string) {
  const user = await getCurrentUser();
  if (!user) { throw new Error("Utilisateur non authentifié."); }

  try {
    const existingReaction = await prisma.commentReaction.findUnique({
      where: { id: reactionId },
      select: { userId: true, commentId: true },
    });

    if (!existingReaction) { throw new Error("Réaction non trouvée."); }

    // Only the reaction creator or an ADMIN can remove
    if (user.role !== Role.ADMIN && existingReaction.userId !== user.id) {
      throw new Error("Accès non autorisé : vous n'êtes pas l'auteur de cette réaction ou un administrateur.");
    }

    const reaction = await prisma.commentReaction.delete({
      where: { id: reactionId },
    });
    revalidatePath(`/task-details/${reaction.commentId}`);
    return reaction;
  } catch (error) {
    console.error("Erreur lors de la suppression de la réaction:", error);
    throw new Error("Impossible de supprimer la réaction.");
  }
}
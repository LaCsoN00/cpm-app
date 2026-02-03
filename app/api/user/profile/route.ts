import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import prisma from '@/lib/prisma'
import { Role } from '@prisma/client'

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Récupérer l'utilisateur avec gestion d'erreur de connexion DB
    let dbUser;
    try {
      dbUser = await prisma.user.findUnique({
        where: { email: user.email! },
        select: {
          id: true,
          name: true,
          email: true,
          imageUrl: true,
          role: true,
          approved: true,
          restricted: true,
        }
      })
    } catch (dbError: unknown) {
      // En cas d'erreur de connexion DB, utiliser les données Supabase comme fallback
      const error = dbError as { code?: string; message?: string }
      if (error?.code === 'P1001' || error?.message?.includes('Can\'t reach database server')) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[DB Connection Issue] Cannot fetch user from DB, using Supabase data as fallback')
        }
        // Retourner les données de base sans stats
        return NextResponse.json({
          user: {
            id: user.id,
            name: user.user_metadata?.name || user.email?.split('@')[0] || 'Utilisateur',
            email: user.email!,
            imageUrl: user.user_metadata?.avatar_url || null,
            role: Role.USER, // Valeur par défaut
            approved: false,
            restricted: false,
            isGlobalStats: false,
            statistics: {}
          }
        }, { status: 200 })
      }
      throw dbError // Relancer les autres erreurs
    }

    if (!dbUser) {
      return NextResponse.json({ 
        error: 'User not found'
      }, { status: 404 })
    }

    // Si l'utilisateur est admin, récupérer les statistiques globales
    if (dbUser.role === Role.ADMIN) {
      // Utiliser Promise.allSettled pour gérer les erreurs individuellement
      const results = await Promise.allSettled([
        prisma.user.count(),
        prisma.project.count(),
        prisma.task.count(),
        prisma.comment.count(),
        prisma.commentReaction.count(),
        prisma.assistanceRequest.count(),
        prisma.attachment.count(),
        prisma.user.count({ where: { approved: true, restricted: false } }),
        prisma.user.count({ where: { approved: true } }),
        prisma.user.count({ where: { restricted: true } }),
        prisma.user.groupBy({
          by: ['role'],
          _count: { role: true }
        }),
        prisma.project.count(),
        prisma.task.groupBy({
          by: ['status'],
          _count: { status: true }
        }),
        prisma.assistanceRequest.groupBy({
          by: ['status'],
          _count: { status: true }
        })
      ])

      // Helper pour extraire la valeur ou retourner 0 en cas d'erreur
      const getValue = <T>(result: PromiseSettledResult<T>, index: number, defaultValue: T = 0 as T): T => {
        if (result.status === 'fulfilled') {
          return result.value
        }
        // Logger silencieusement les erreurs de connexion DB (erreurs attendues)
        const error = result.reason as { code?: string; message?: string }
        if (error?.code === 'P1001' || error?.message?.includes('Can\'t reach database server')) {
          // Erreur de connexion DB - logger en debug seulement
          if (process.env.NODE_ENV === 'development') {
            console.warn(`[DB Connection Issue] Stat at index ${index} unavailable: ${error.message || error.code}`)
          }
        } else {
          // Autres erreurs - logger normalement
          console.error(`Error fetching stat at index ${index}:`, result.reason)
        }
        return defaultValue
      }

      interface UserRoleCount {
        role: Role;
        _count: { role: number };
      }

      interface TaskStatusCount {
        status: string;
        _count: { status: number };
      }

      interface AssistanceRequestStatusCount {
        status: string;
        _count: { status: number };
      }

      const totalUsers = getValue(results[0], 0, 0)
      const totalProjects = getValue(results[1], 1, 0)
      const totalTasks = getValue(results[2], 2, 0)
      const totalComments = getValue(results[3], 3, 0)
      const totalCommentReactions = getValue(results[4], 4, 0)
      const totalAssistanceRequests = getValue(results[5], 5, 0)
      const totalAttachments = getValue(results[6], 6, 0)
      const activeUsers = getValue(results[7], 7, 0)
      const approvedUsers = getValue(results[8], 8, 0)
      const restrictedUsers = getValue(results[9], 9, 0)
      const usersByRole = getValue<UserRoleCount[]>(results[10], 10, [])
      const projectsCreated = getValue(results[11], 11, 0)
      const tasksByStatus = getValue<TaskStatusCount[]>(results[12], 12, [])
      const assistanceRequestsByStatus = getValue<AssistanceRequestStatusCount[]>(results[13], 13, [])

      const adminCount = usersByRole.find((u) => u.role === Role.ADMIN)?._count?.role || 0
      const consultantCount = usersByRole.find((u) => u.role === Role.CONSULTANT)?._count?.role || 0
      const userCount = usersByRole.find((u) => u.role === Role.USER)?._count?.role || 0

      const tasksToDo = tasksByStatus.find((t) => t.status === 'To Do')?._count?.status || 0
      const tasksInProgress = tasksByStatus.find((t) => t.status === 'In Progress')?._count?.status || 0
      const tasksDone = tasksByStatus.find((t) => t.status === 'Done')?._count?.status || 0

      const assistanceRequestsPending = assistanceRequestsByStatus.find((a) => a.status === 'pending')?._count?.status || 0
      const assistanceRequestsResolved = assistanceRequestsByStatus.find((a) => a.status === 'resolved')?._count?.status || 0
      const assistanceRequestsRejected = assistanceRequestsByStatus.find((a) => a.status === 'rejected')?._count?.status || 0

      return NextResponse.json({ 
        user: {
          id: dbUser.id,
          name: dbUser.name,
          email: dbUser.email,
          imageUrl: dbUser.imageUrl,
          role: dbUser.role,
          approved: dbUser.approved,
          restricted: dbUser.restricted,
          isGlobalStats: true,
          statistics: {
            // Statistiques utilisateurs
            totalUsers,
            activeUsers,
            approvedUsers,
            restrictedUsers,
            adminCount,
            consultantCount,
            userCount,
            // Statistiques projets
            totalProjects,
            projectsCreated,
            // Statistiques tâches
            totalTasks,
            tasksToDo,
            tasksInProgress,
            tasksDone,
            // Statistiques autres
            comments: totalComments,
            commentReactions: totalCommentReactions,
            totalAssistanceRequests,
            assistanceRequestsPending,
            assistanceRequestsResolved,
            assistanceRequestsRejected,
            attachments: totalAttachments,
          }
        }
      }, { status: 200 })
    }

    // Pour les non-admins, récupérer les statistiques personnelles
    // Essayer de récupérer avec les stats, mais continuer même en cas d'erreur
    try {
      const userWithStats = await prisma.user.findUnique({
        where: { email: user.email! },
        select: {
          id: true,
          name: true,
          email: true,
          imageUrl: true,
          role: true,
          approved: true,
          restricted: true,
          _count: {
            select: {
              projects: true,
              userProjects: true,
              createdTasks: true,
              tasks: true,
              comments: true,
              commentReactions: true,
              assistanceRequests: true,
              resolvedAssistanceRequests: true,
              attachments: true,
            }
          }
        }
      })

      if (!userWithStats) {
        // Si l'utilisateur n'est pas trouvé, retourner au moins les infos de base
        return NextResponse.json({ 
          user: {
            id: dbUser.id,
            name: dbUser.name,
            email: dbUser.email,
            imageUrl: dbUser.imageUrl,
            role: dbUser.role,
            approved: dbUser.approved,
            restricted: dbUser.restricted,
            isGlobalStats: false,
            statistics: {}
          }
        }, { status: 200 })
      }

      const totalProjects = (userWithStats._count.projects || 0) + (userWithStats._count.userProjects || 0)
      const totalTasks = (userWithStats._count.createdTasks || 0) + (userWithStats._count.tasks || 0)

      return NextResponse.json({ 
        user: {
          id: userWithStats.id,
          name: userWithStats.name,
          email: userWithStats.email,
          imageUrl: userWithStats.imageUrl,
          role: userWithStats.role,
          approved: userWithStats.approved,
          restricted: userWithStats.restricted,
          isGlobalStats: false,
          statistics: {
            projectsCreated: userWithStats._count.projects || 0,
            projectsCollaborated: userWithStats._count.userProjects || 0,
            totalProjects,
            tasksCreated: userWithStats._count.createdTasks || 0,
            tasksAssigned: userWithStats._count.tasks || 0,
            totalTasks,
            comments: userWithStats._count.comments || 0,
            commentReactions: userWithStats._count.commentReactions || 0,
            assistanceRequestsCreated: userWithStats._count.assistanceRequests || 0,
            assistanceRequestsResolved: userWithStats._count.resolvedAssistanceRequests || 0,
            attachments: userWithStats._count.attachments || 0,
          }
        }
      }, { status: 200 })
    } catch (statsError) {
      // En cas d'erreur lors du fetch des stats, retourner au moins les infos de base
      console.error('Error fetching user statistics:', statsError)
      return NextResponse.json({ 
        user: {
          id: dbUser.id,
          name: dbUser.name,
          email: dbUser.email,
          imageUrl: dbUser.imageUrl,
          role: dbUser.role,
          approved: dbUser.approved,
          restricted: dbUser.restricted,
          isGlobalStats: false,
          statistics: {}
        }
      }, { status: 200 })
    }
  } catch (error) {
    console.error('Error fetching user profile:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


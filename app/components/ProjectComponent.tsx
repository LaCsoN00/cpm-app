import { Project } from '@/lib/idb'
import { Copy, ExternalLink, FolderGit2, Trash } from 'lucide-react';
import Link from 'next/link';
import React, { FC } from 'react'
import { toast } from 'react-hot-toast';
import { Role } from '@prisma/client';

interface ProjectProps {
    project: Project
    userRole: Role; // New prop for user role
    createdById: string; // New prop for project creator ID
    currentUserId: string; // New prop for current user ID
    style: boolean;
    showSummaryGauge?: boolean; // New prop to control gauge display
    onDelete?: (id: string) => void;
    collaboratorsCount?: number; // New prop for collaborators count

}

const ProjectComponent: FC<ProjectProps> = ({ project, userRole, style, onDelete, currentUserId, showSummaryGauge, collaboratorsCount }) => {

    const handleDeleteClick = () => {
        const isConfirmed = window.confirm("Êtes-vous sûr de vouloir supprimer ce projet ?")
        if (isConfirmed && onDelete) {
            onDelete(project.id)
        }
    }

    const totalTasks = project.tasks?.length ?? 0;
    const tasksByStatus = project.tasks?.reduce(
        (acc, task) => {
            if (task.status === "To Do") acc.toDo++;
            else if (task.status === "In Progress") acc.inProgress++;
            else if (task.status === "Done") acc.done++;
            else if (task.status === "Late") acc.late++; // Add late tasks to count
            return acc
        },
        {
            toDo: 0, inProgress: 0, done: 0, late: 0 // Initialize late count
        }
    ) ?? { toDo: 0, inProgress: 0, done: 0, late: 0 }

    const progressPercentage = totalTasks ? Math.round((tasksByStatus.done / totalTasks) * 100) : 0
    const inProgressPercentage = totalTasks ? Math.round((tasksByStatus.inProgress / totalTasks) * 100) : 0
    const toDoPercentage = totalTasks ? Math.round((tasksByStatus.toDo / totalTasks) * 100) : 0
    const latePercentage = totalTasks ? Math.round((tasksByStatus.late / totalTasks) * 100) : 0 // Calculate late percentage

    const textSizeClass = style ? 'text-sm' : 'text-md'

    // Determine role-based styling
    let roleBadge = null;
    let cardBorderClass = '';

    if (project.createdBy?.role === Role.CONSULTANT) {
        roleBadge = <span className="badge badge-info ml-2 text-xs">💼 Consultant</span>;
        cardBorderClass = 'border-info'; // Blue border for consultant projects
    } else if (project.createdBy?.role === Role.ADMIN) {
        roleBadge = <span className="badge badge-warning ml-2 text-xs">👨‍💼 Admin</span>;
        cardBorderClass = 'border-warning'; // Yellow border for admin projects
    } else if (project.createdBy?.role === Role.USER) {
        roleBadge = <span className="badge badge-success ml-2 text-xs">👤 Utilisateur</span>;
        cardBorderClass = 'border-success'; // Green border for user projects
    }

    const handleCopyCode = async () => {
        try {
            if (project.inviteCode) {
                await navigator.clipboard.writeText(project.inviteCode)
                toast.success("Code d'invitation copié")
            }
        } catch (error) {
            console.error('Error copying invite code:', error)
            toast.error("Erreur lors de la copie du code d'invitation.")
        }
    }

    const isCollaborator = project.users?.some(userEntry => userEntry?.user?.id === currentUserId);
    // The invite code should only be visible to collaborators and the project creator.
    // ADMINs only see it if they are also a collaborator or the creator.
    const canSeeInviteCode = currentUserId === project.createdById || isCollaborator;

    // canManageProject for deletion, which ADMINs should always be able to do.
    const canManageProject = userRole === Role.ADMIN || currentUserId === project.createdById;

    const displayCollaboratorCount = project.users
        ? project.users.filter(userEntry => userEntry.user && userEntry.user.id !== project.createdById).length
        : 0;

    return (
        <div key={project.id} className={`${style ? `border ${cardBorderClass} p-5 shadow-sm ` : ''}text-base-content rounded-xl w-full text-left max-w-full overflow-hidden`}>

            <div className='w-full flex items-center mb-3'>
                <div className='bg-primary-content text-xl h-10 w-10 rounded-lg flex justify-center items-center'>
                    <FolderGit2 className='w-6 text-primary' />
                </div>
                <div className='badge ml-3 font-bold'>
                    {project.name}
                </div>
                {roleBadge}
            </div>

            {/* {style == false && (
                <p className='text-sm text-gra-500 border  border-base-300 p-5 mb-6 rounded-xl'>
                    {project.description}
                </p>
            )} */}

            <div className={`mb-3`}>
                <span>Collaborateurs</span>
                <div className='badge badge-sm badge-ghost ml-1'>{collaboratorsCount !== undefined ? collaboratorsCount : displayCollaboratorCount}</div>
            </div>

            {canSeeInviteCode && (
                <div className='flex items-center rounded-lg p-2 border border-base-300 mb-3 bg-base-200/30 overflow-hidden'>
                    <p className='text-primary font-bold ml-3 flex-grow max-w-[calc(100%-40px)] overflow-hidden text-ellipsis whitespace-nowrap'>
                        {project.inviteCode.substring(0, 20)}...
                    </p>
                    <button className='btn btn-sm ml-2 flex-shrink-0' onClick={handleCopyCode}>
                        <Copy className='w-4' />
                    </button>
                </div>
            )}

            {showSummaryGauge ? (
                <div className='flex flex-col mb-3'>
                    <h2 className={`text-gray-500 mb-2 ${textSizeClass}`}>
                        <span className='font-bold'>Progression Globale</span>
                        <div className='badge badge-ghost badge-sm ml-1'>
                            {progressPercentage}%
                        </div>
                    </h2>
                    <progress className="progress progress-primary w-full" value={progressPercentage} max="100"></progress>
                    <div className='flex'>
                        <span className={`text-gray-400 mt-2 ${textSizeClass}`}>
                            {/* {progressPercentage}% des tâches terminées */}
                        </span>
                    </div>
                </div>
            ) : (
                <>
                    <div className='flex flex-col mb-3'>
                        <h2 className={`text-gray-500 mb-2 ${textSizeClass}`}>
                            <span className='font-bold'>A faire</span>
                            <div className='badge badge-ghost badge-sm ml-1'>
                                {tasksByStatus.toDo}
                            </div>
                        </h2>
                        <progress className="progress progress-primary w-full" value={toDoPercentage} max="100">
                        </progress>
                        <div className='flex'>
                            <span className={`text-gray-400 mt-2 ${textSizeClass}`}>
                                {toDoPercentage}%
                            </span>
                        </div>
                    </div>

                    <div className='flex flex-col mb-3'>
                        <h2 className={`text-gray-500 mb-2 ${textSizeClass}`}>
                            <span className='font-bold'>En cours</span>
                            <div className='badge badge-ghost badge-sm ml-1'>
                                {tasksByStatus.inProgress}
                            </div>
                        </h2>
                        <progress className="progress progress-primary w-full" value={inProgressPercentage} max="100">
                        </progress>
                        <div className='flex'>
                            <span className={`text-gray-400 mt-2 ${textSizeClass}`}>
                                {inProgressPercentage}%
                            </span>
                        </div>
                    </div>

                    <div className='flex flex-col mb-3'>
                        <h2 className={`text-gray-500 mb-2 ${textSizeClass}`}>
                            <span className='font-bold'>Terminée(s)</span>
                            <div className='badge badge-ghost badge-sm ml-1 '>
                                {tasksByStatus.done}
                            </div>
                        </h2>
                        <progress className="progress progress-primary w-full" value={progressPercentage} max="100">
                        </progress>
                        <div className='flex'>
                            <span className={`text-gray-400 mt-2 ${textSizeClass}`}>
                                {progressPercentage}%
                            </span>
                        </div>
                    </div>

                    {/* Late Tasks */}
                    <div className='flex flex-col mb-3'>
                        <h2 className={`text-gray-500 mb-2 ${textSizeClass}`}>
                            <span className='font-bold'>En retard</span>
                            <div className='badge badge-ghost badge-sm ml-1 '>
                                {tasksByStatus.late}
                            </div>
                        </h2>
                        <progress className="progress progress-primary w-full" value={latePercentage} max="100">
                        </progress>
                        <div className='flex'>
                            <span className={`text-gray-400 mt-2 ${textSizeClass}`}>
                                {latePercentage}%
                            </span>
                        </div>
                    </div>
                </>
            )}

            <div className='flex'>

                {style && (
                    <Link className='btn btn-primary btn-sm' href={`/project/${project.id}`}>
                        <div className='badge badge-sm'>
                            {totalTasks}
                        </div>
                        Tâche
                        <ExternalLink className='w-4' />

                    </Link>
                )}

                {canManageProject && (
                    <button className='btn btn-sm ml-3' onClick={handleDeleteClick}>
                        <Trash className='w-4' />
                    </button>
                )}
            </div>


        </div>
    )
}

export default ProjectComponent
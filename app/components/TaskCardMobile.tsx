import { Task } from '@/type'
import React, { FC } from 'react'
import Link from 'next/link'
import UserInfo from './UserInfo'
import { ArrowRight, Trash } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Priority } from '@prisma/client'
import { Role } from '@prisma/client'
import { Project } from '@/type'

interface TaskCardMobileProps {
    task: Task,
    index: number,
    email?: string,
    userRole: Role, // Add userRole prop
    project: Project; // Add project prop
    onDelete?: (id: string) => void
}

const TaskCardMobile: FC<TaskCardMobileProps> = ({ task, index, email, onDelete, userRole, project }) => {
    const isConsultantProject = project?.isConsultantProject;
    const isCollaborator = project?.users?.some(pu => pu.user.email === email);
    const canDelete = userRole === Role.ADMIN || (userRole === Role.USER && !isConsultantProject && (email === task.createdBy?.email || isCollaborator));

    const handleDeleteClick = () => {
        if (onDelete) {
            onDelete(task.id)
        }
    }

    const getPriorityBadgeClass = (priority: Priority | string) => {
        if (task.status === "Done") {
            return 'badge-success'; // Si la tâche est terminée, la priorité est "Terminé"
        }
        if (task.status === "Late") {
            return 'badge-error';
        }
        switch (priority) {
            case Priority.HIGH:
                return 'badge-error';
            case Priority.MEDIUM:
                return 'badge-warning';
            case Priority.LOW:
                return 'badge-info';
            default:
                return 'badge-neutral';
        }
    };

    const getPriorityText = (priority: Priority | string) => {
        if (task.status === "Done") {
            return 'Terminé'; // Si la tâche est terminée, la priorité est "Terminé"
        }
        if (task.status === "Late") {
            return 'En retard';
        }
        switch (priority) {
            case Priority.HIGH:
                return 'Haute';
            case Priority.MEDIUM:
                return 'Moyenne';
            case Priority.LOW:
                return 'Basse';
            default:
                return 'Non définie';
        }
    };

    return (
        <div className="card card-bordered bg-base-100 shadow-sm mb-3">
            <div className="card-body p-4">
                <div className='flex items-start justify-between'>
                    <div className='flex items-center gap-2'>
                        <div className='badge badge-ghost text-xs'>#{index + 1}</div>
                        <div className={`badge text-xs mb-2 font-semibold
                           ${task.status === "To Do" ? "bg-blue-200 text-blue-800" : ""}
                           ${task.status === "In Progress" ? "bg-yellow-200 text-yellow-800" : ""}
                           ${task.status === "Done" ? "bg-green-200 text-green-800" : ""}
                           ${task.status === "Late" ? "bg-red-500 text-white" : ""}
                           ${!task.status || (task.status !== "To Do" && task.status !== "In Progress" && task.status !== "Done" && task.status !== "Late") ? "bg-gray-200 text-gray-800" : ""}
                        `}>
                            {task.status === "To Do" && 'A faire'}
                            {task.status === "In Progress" && 'En cours'}
                            {task.status === "Done" && 'Terminé'}
                            {task.status === "Late" && 'En retard'}
                            {!task.status || (task.status !== "To Do" && task.status !== "In Progress" && task.status !== "Done" && task.status !== "Late") && 'Non défini'}
                        </div>
                    </div>
                </div>

                <h3 className='text-sm font-bold mt-2'>
                    {task.name.length > 100 ? `${task.name.slice(0, 100)}...` : task.name}
                </h3>

                <div className='mt-3'>
                    <UserInfo role="Assigné à" email={task.user?.email || null} name={task.user?.name || null} imageUrl={task.user?.imageUrl || null} />
                </div>

                <div className='mt-3 grid grid-cols-2 gap-2 text-xs text-gray-500'>
                    <div>
                        <div className='font-semibold text-gray-600'>Priorité</div>
                        <div className={`badge ${getPriorityBadgeClass(task.priority)}`}>
                            {getPriorityText(task.priority)}
                        </div>
                    </div>
                    <div>
                        <div className='font-semibold text-gray-600'>A livré le</div>
                        <div>{task.deadline ? format(new Date(task.deadline), 'PPP', { locale: fr }) : 'Non définie'}</div>
                    </div>
                </div>

                <div className='mt-4 flex'>
                    <Link className='btn btn-sm btn-primary' href={`/task-details/${task.id}`}>
                        Plus
                        <ArrowRight className='w-4' />
                    </Link>
                    {canDelete && (
                        <button onClick={handleDeleteClick} className='btn btn-sm ml-2'>
                            <Trash className='w-4' />
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

export default TaskCardMobile


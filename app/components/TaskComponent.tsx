import { Task } from '@/type'
import React, { FC } from 'react'
import UserInfo from './UserInfo'
import Link from 'next/link'
import { ArrowRight, Trash } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Priority } from '@prisma/client'
import { Role } from '@prisma/client'
import { Project } from '@/type'


interface TaskProps {
    task: Task,
    index: number,
    email?: string,
    userRole: Role; // Add userRole prop
    project: Project; // Add project prop
    onDelete? : (id: string) => void
}

const TaskComponent: FC<TaskProps> = ({ task, index, email , onDelete, userRole }) => {
    // Droits de suppression : ADMIN toujours, USER seulement s'il est créateur
    const canDelete =
      userRole === Role.ADMIN ||
      (userRole === Role.USER && email === task.createdBy?.email);

    const handleDeleteClick = () => {
        if(onDelete){
            onDelete(task.id)
        }
    }

    const getStatusBadgeConfig = () => {
        switch (task.status) {
            case "To Do":
                return { label: "À faire", className: "bg-blue-200 text-blue-900" };
            case "In Progress":
                return { label: "En cours", className: "bg-yellow-200 text-yellow-900" };
            case "Done":
                return { label: "Terminé", className: "bg-green-200 text-green-900" };
            case "Late":
                return { label: "En retard", className: "bg-red-200 text-red-900" };
            default:
                return { label: task.status, className: "bg-base-300 text-base-content" };
        }
    };

    const getPriorityBadgeConfig = (priority: Priority | string) => {
        if (task.status === "Done") {
            return { label: "Terminé", className: "bg-green-200 text-green-900" };
        }
        if (task.status === "Late") {
            return { label: "En retard", className: "bg-red-200 text-red-900" };
        }
        switch (priority) {
            case Priority.HIGH:
                return { label: "Haute", className: "bg-red-200 text-red-900" };
            case Priority.MEDIUM:
                return { label: "Moyenne", className: "bg-yellow-200 text-yellow-900" };
            case Priority.LOW:
                return { label: "Basse", className: "bg-blue-200 text-blue-900" };
            default:
                return { label: "Non définie", className: "bg-base-300 text-base-content" };
        }
    };

    return (
        <>
            <td>{index + 1}</td>
            <td>
                <div className='flex flex-col mb-2'>
                    {(() => {
                        const { label, className } = getStatusBadgeConfig()
                        return (
                            <span className={`badge whitespace-nowrap text-xs font-semibold ${className}`}>
                                {label}
                            </span>
                        )
                    })()}
                </div>
                <span className='text-sm font-bold'>
                    {task.name.length > 100 ? `${task.name.slice(0, 100)}...` : task.name}
                </span>
            </td>

            <td>
                {task.user?.email ? (
                    <UserInfo
                        role=""
                        email={task.user?.email || null}
                        name={task.user?.name || null}
                        imageUrl={task.user?.imageUrl || null}
                    />
                ) : (
                    <span className="text-gray-500">Non assigné</span>
                )}
            </td>

            <td>
                {(() => {
                    const { label, className } = getPriorityBadgeConfig(task.priority)
                    return (
                        <span className={`badge whitespace-nowrap ${className}`}>
                            {label}
                        </span>
                    )
                })()}
            </td>

            <td>
                <div className='text-xs text-gray-500 hidden md:flex'>
                    {task.deadline ? format(new Date(task.deadline), 'PPP', { locale: fr }) : 'Non définie'}
                </div>
            </td>

            {/* Colonne Actions */}
            <td>
                <div className='flex h-fit'>
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
            </td>
        </>
    )
}

export default TaskComponent

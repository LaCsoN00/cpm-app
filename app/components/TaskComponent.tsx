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
    const canDelete = userRole === Role.ADMIN || (userRole === Role.USER && (email == task.createdBy?.email || task.project?.users?.some(pu => pu.user.email === email)));

    const handleDeleteClick = () => {
        if(onDelete){
            onDelete(task.id)
        }
    }

    const getPriorityBadgeClass = (priority: Priority | string) => {
        switch (priority) {
            case Priority.HIGH:
                return 'badge-error';
            case Priority.MEDIUM:
                return 'badge-warning';
            case Priority.LOW:
                return 'badge-info';
            case "Late": // Nouveau statut "Late"
                return 'badge-error-content text-white'; // Ou une autre classe appropriée pour "Late"
            default:
                return 'badge-neutral';
        }
    };

    const getPriorityText = (priority: Priority | string) => {
        switch (priority) {
            case Priority.HIGH:
                return 'Haute';
            case Priority.MEDIUM:
                return 'Moyenne';
            case Priority.LOW:
                return 'Basse';
            case "Late":
                return 'En retard';
            default:
                return 'Non définie';
        }
    };

    return (
        <>
            <td>{index + 1}</td>
            <td>
                <div className='flex flex-col'>
                    <div className={`badge text-xs mb-2  font-semibold
                       ${task.status == "To Do" ? "bg-red-200 font-semibold" : ""}      
                       ${task.status == "In Progress" ? "bg-yellow-200 font-semibold" : ""}                     
                        ${task.status == "Done" ? "bg-green-200 font-semibold" : ""}   
                        ${task.status == "Late" ? "bg-red-200 font-semibold" : ""} 
                    `}>

                        {task.status == "To Do" && 'A faire'}
                        {task.status == "In Progress" && 'En cours'}
                        {task.status == "Done" && 'Terminé'}
                        {task.status == "Late" && 'En retard'}
                    </div>
                    <span className='text-sm font-bold'>
                        {task.name.length > 100 ? `${task.name.slice(0, 100)}...` : task.name}
                    </span>
                </div>
            </td>

            <td>
                <UserInfo
                    role=""
                    email={task.user?.email || null}
                    name={task.user?.name || null}
                    imageUrl={task.user?.imageUrl || null}
                />
            </td>

            <td>
                <div className={`badge ${getPriorityBadgeClass(task.priority)}`}>
                    {getPriorityText(task.priority)}
                </div>
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

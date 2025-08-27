import { Task } from '@/type'
import React, { FC } from 'react'
import Link from 'next/link'
import UserInfo from './UserInfo'
import { ArrowRight, Trash } from 'lucide-react'

interface TaskCardMobileProps {
    task: Task,
    index: number,
    email?: string,
    onDelete?: (id: string) => void
}

const TaskCardMobile: FC<TaskCardMobileProps> = ({ task, index, email, onDelete }) => {
    const canDelete = email == task.createdBy?.email

    const handleDeleteClick = () => {
        if (onDelete) {
            onDelete(task.id)
        }
    }

    return (
        <div className="card card-bordered bg-base-100 shadow-sm mb-3">
            <div className="card-body p-4">
                <div className='flex items-start justify-between'>
                    <div className='flex items-center gap-2'>
                        <div className='badge badge-ghost text-xs'>#{index + 1}</div>
                        <div className={`badge text-xs font-semibold
                            ${task.status == "To Do" ? "bg-red-200" : ""}
                            ${task.status == "In Progress" ? "bg-yellow-200" : ""}
                            ${task.status == "Done" ? "bg-green-200" : ""}
                        `}>
                            {task.status == "To Do" && 'A faire'}
                            {task.status == "In Progress" && 'En cours'}
                            {task.status == "Done" && 'Terminé'}
                        </div>
                    </div>
                </div>

                <h3 className='text-sm font-bold mt-2'>{task.name}</h3>

                <div className='mt-3'>
                    <UserInfo role="Assigné à" email={task.user?.email || null} name={task.user?.name || null} />
                </div>

                <div className='mt-3 grid grid-cols-2 gap-2 text-xs text-gray-500'>
                    <div>
                        <div className='font-semibold text-gray-600'>A livré le</div>
                        <div>{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'Non défini'}</div>
                    </div>
                    <div>
                        <div className='font-semibold text-gray-600'>Prix (CFA)</div>
                        <div>{task.price ? `${task.price.toLocaleString()} CFA` : 'Non défini'}</div>
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


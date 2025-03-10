"use client"
import { createTask, getProjectInfo, getProjectUsers } from '@/app/actions';
import AssignTask from '@/app/components/AssignTask';
import Wrapper from '@/app/components/Wrapper'
import { Project } from '@/type';
import { useUser } from '@clerk/nextjs';
import { User } from '@prisma/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react'
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { toast } from 'react-hot-toast';

const Page = ({ params }: { params: Promise<{ projectId: string }> }) => {

    const modules = {
        toolbar: [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'font': [] }],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            [{ 'color': [] }, { 'background': [] }],
            ['blockquote', 'code-block'],
            ['link', 'image'],
            ['clean']
        ]
    };

    const { user } = useUser();
    const email = user?.primaryEmailAddress?.emailAddress as string;
    const [projectId, setProjectId] = useState("");
    const [project, setProject] = useState<Project | null>(null);
    const [usersProject, setUsersProject] = useState<User[]>([]); 
    const [selectedUser, setSelectedUser] = useState<User | null>(null)
    const [dueDate, setDueDate] = useState<Date | null>(null)
    const [name, setName] = useState("")
    const [description, setDescription] = useState("")
    const [price, setPrice] = useState<string>("");  // État pour le prix
    const rooter = useRouter()

    const fetchInfos = async (projectId: string) => {
        try {
            const project = await getProjectInfo(projectId, true)
            setProject(project)

            const associatedUsers = await getProjectUsers(projectId)
            setUsersProject(associatedUsers)

        } catch (error) {
            console.error('Erreur lors du chargement du projet:', error);
        }
    }

    useEffect(() => {
        const getId = async () => {
            const resolvedParams = await params;
            setProjectId(resolvedParams.projectId)
            fetchInfos(resolvedParams.projectId)
        }
        getId()

    }, [params])

    const handleUserSelect = (user: User) => {
        setSelectedUser(user)
    }

    const handleSubmit = async () => {
        if (!name || !projectId || !selectedUser || !description || !dueDate || !price) {
            toast.error('Veuillez remplir tous les champs obligatoires')
            return
        }
        try {
            await createTask(name, description, dueDate, projectId, email, selectedUser.email, parseFloat(price))
            rooter.push(`/project/${projectId}`)
        } catch (error) {
            toast.error("Une erreur est survenue lors de la création de la tâche." + error);
        }
    }

    return (
        <Wrapper>
            <div>
                <div className="breadcrumbs text-sm">
                    <ul>
                        <li>
                            <div className='badge badge-primary'><Link href={`/project/${projectId}`}>Retour</Link></div>
                        </li>
                        <li>
                            <div className='badge badge-primary'>{project?.name}</div>
                        </li>

                    </ul>
                </div>

                <div className='flex flex-col md:flex-row md:justify-between'>
                    <div className='md:w-1/4'>
                        <AssignTask users={usersProject} projectId={projectId} onAssignTask={handleUserSelect} />
                        <div className='flex justify-between items-center mt-4'>
                            <span className='badge'>
                                A livré
                            </span>
                            <input
                                placeholder="Date d'échéance"
                                className='input input-bordered  border-base-300 '
                                type="date"
                                onChange={(e) => setDueDate(new Date(e.target.value))}
                            />
                        </div>
                    </div>
                    <div className='md:w-3/4 mt-4 md:mt-0 md:ml-4 '>
                        <div className='flex flex-col justify-between w-full'>
                            <input
                                placeholder='Nom de la tache'
                                className='w-full input input-bordered border border-base-300 font-bold mb-4'
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                            <ReactQuill
                                placeholder='Décrivez la tâche'
                                value={description}
                                modules={modules}
                                onChange={setDescription}
                            />
                        </div>
                        <div className='flex items-center justify-between mt-4'>
                            <input
                                type="number"
                                placeholder="Prix en CFA"
                                className='input input-bordered border-base-300 w-1/3'
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                            />
                            <button className='btn mt-4 btn-md btn-primary' onClick={handleSubmit}>
                                Créer la tâche
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </Wrapper>
    )
}

export default Page

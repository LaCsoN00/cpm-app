"use client"

import { createTask, getProjectInfo, getProjectUsers } from '@/app/actions';
import AssignTask from '@/app/components/AssignTask';
import Wrapper from '@/app/components/Wrapper'
import { Project } from '@/type';
import { useSupabaseUserWithRole } from '../../hooks/useSupabaseUserWithRole';
import { User } from '@prisma/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react'
import dynamic from 'next/dynamic';
const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });
import 'react-quill-new/dist/quill.snow.css';
import { toast } from 'react-hot-toast';
import { addPendingChange, Project as IdbProject, getProjectById, addTask as addTaskToIdb } from "@/lib/idb";
import { Task } from '@/type';

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

    const { user, role } = useSupabaseUserWithRole();
    const email = user?.email as string;
    const [projectId, setProjectId] = useState("");
    const [project, setProject] = useState<Project | null>(null);
    const [usersProject, setUsersProject] = useState<User[]>([]); 
    const [selectedUser, setSelectedUser] = useState<User | null>(null)
    const [dueDate, setDueDate] = useState<Date | null>(null)
    const [name, setName] = useState("")
    const [description, setDescription] = useState("")
    const rooter = useRouter()

    const fetchInfos = async (projectId: string) => {
        try {
            let currentProject: Project | null = null;
            let associatedUsers: User[] = [];

            if (typeof window !== 'undefined' && !navigator.onLine) {
                // Try to get from IndexedDB
                const localProject = await getProjectById(projectId);
                if (localProject) {
                    currentProject = localProject as Project;
                    // Assuming users are stored within the project or can be fetched separately from Idb
                    associatedUsers = localProject.users || [];
                    console.log("Projet et utilisateurs chargés depuis IndexedDB (hors ligne)");
                }
            } else {
                // Fetch from network
                currentProject = await getProjectInfo(projectId, true);
                if (currentProject) {
                    associatedUsers = await getProjectUsers(projectId);
                }
            }
            setProject(currentProject);
            setUsersProject(associatedUsers);

        } catch (error) {
            console.error('Erreur lors du chargement du projet ou des utilisateurs:', error);
            toast.error("Impossible de charger le projet ou les utilisateurs. Veuillez vérifier votre connexion.");
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

    const createTaskOffline = async (name: string, description: string, dueDate: Date | null, projectId: string, createdByEmail: string, assignToEmail: string | undefined, offlineTempId: string) => {
        const newTask = {
            id: offlineTempId,
            name,
            description,
            dueDate,
            projectId,
            createdById: createdByEmail,
            userId: assignToEmail || createdByEmail, // Use email as temporary userId
            status: 'To Do',
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        await addPendingChange({
            userId: createdByEmail,
            data: newTask as IdbProject | Task | { inviteCode: string } | { id: string },
            timestamp: new Date().toISOString(),
            type: 'task',
        });
        await addTaskToIdb(newTask as Task); // Add to IndexedDB immediately
        console.log('Tâche ajoutée hors ligne (client-side):', newTask);
        return newTask;
    };

    const handleSubmit = async () => {
        if (!name || !projectId || !selectedUser || !description || !dueDate) {
            toast.error('Veuillez remplir tous les champs obligatoires')
            return
        }

        try {
            const offlineTempId = `offline-task-${Date.now()}`;
            if (typeof window !== 'undefined' && !navigator.onLine) {
                // Offline task creation
                await createTaskOffline(name, description, dueDate, projectId, email, selectedUser.email, offlineTempId);
                toast.success('Tâche créée hors ligne et sera synchronisée !');
                rooter.push(`/project/${projectId}`);
            } else {
                // Online task creation
                await createTask(name, description, dueDate, projectId, email, selectedUser.email);
                toast.success('Tâche créée avec succès !');
                rooter.push(`/project/${projectId}`);
            }
        } catch (error) {
            toast.error("Une erreur est survenue lors de la création de la tâche." + error);
        }
    }

    return (
        <Wrapper userRole={role || "GUEST"}>
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
                        <button className='btn mt-4 btn-md btn-primary' onClick={handleSubmit}>
                            Créer la tâche
                        </button>
                    </div>
                </div>

            </div>
        </Wrapper>
    )
}

export default Page

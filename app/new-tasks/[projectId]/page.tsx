"use client"

import { createTask, getProjectInfo, getProjectUsers } from '@/app/actions';
import AssignTask from '@/app/components/AssignTask';
import Wrapper from '@/app/components/Wrapper'
import { Project } from '@/type';
import { useSupabaseUserWithRole } from '../../hooks/useSupabaseUserWithRole';
import { Priority, User, Role } from '@prisma/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react'
import dynamic from 'next/dynamic';
const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });
import 'react-quill-new/dist/quill.snow.css';
import { toast } from 'react-hot-toast';
import { addPendingChange, getProjectById, addTask as addTaskToIdb, Task as IdbTask } from "@/lib/idb";
import { Task, ExtendedUser } from '@/type';
// import type Quill from 'quill'; // Supprimer l'importation de Quill

// import Quill from 'quill'; // Déplacer l'importation de Quill
// interface QuillIcons { [key: string]: string; }
// const icons = Quill.import('ui/icons') as QuillIcons;
// icons['file'] = '<i class="fa fa-paperclip"></i>'; // Déplacer la configuration des icônes

const Page = ({ params }: { params: Promise<{ projectId: string }> }) => {

    // const quillRef = useRef<InstanceType<typeof ReactQuill> | null>(null); // Supprimer la référence quillRef

    // const [uploadedFiles, setUploadedFiles] = useState<{ name: string, url: string }[]>([]); // Supprimer l'état pour les fichiers téléchargés
    const [attachments, setAttachments] = useState<{ name: string; url: string }[]>([]); // Nouvel état pour les pièces jointes

    useEffect(() => {
        // Importation dynamique de Quill côté client
        import('quill').then(QuillModule => {
          const Quill = QuillModule.default;
          interface QuillIcons { [key: string]: string; }
          const icons = Quill.import('ui/icons') as QuillIcons;
          icons['file'] = '<i class="fa fa-paperclip"></i>';
        });
      }, []);

    const handleFileUpload = () => {
        console.log('handleFileUpload a été appelée.'); // Nouveau log
        const input = document.createElement('input');
        input.setAttribute('type', 'file');
        input.setAttribute('accept', '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx');
        input.click();
        console.log('input.click() a été appelé.'); // Nouveau log

        input.onchange = async () => {
            console.log('Événement onchange déclenché.');
            console.log('input.files:', input.files); // Nouveau log
            const file = input.files?.[0];
            if (file) {
                console.log('Fichier sélectionné:', file.name, file.type, file.size, 'octets');
                const formData = new FormData();
                formData.append('file', file);

                try {
                    console.log('Envoi du fichier à l\'API:', '/api/user/upload-file');
                    const response = await fetch('/api/user/upload-file', {
                        method: 'POST',
                        body: formData,
                    });

                    if (!response.ok) {
                        throw new Error(`Upload failed: ${response.statusText}`);
                    }

                    const data = await response.json();
                    const fileUrl = data.url;

                    console.log('Fichier téléchargé. URL:', fileUrl);

                    // Mettre à jour l'état attachments
                    setAttachments(prev => [...prev, { name: file.name, url: fileUrl }]); // Ajouter le nouveau fichier
                    console.log('attachments mis à jour:', [...attachments, { name: file.name, url: fileUrl }]); // Nouveau log
                    toast.success('Fichier téléchargé avec succès.');

                    // Supprimer toutes les logiques d'insertion dans Quill

                } catch (error) {
                    console.error('Error uploading file:', error);
                    toast.error("Erreur lors du téléchargement du fichier.");
                }
            }
        };
    };

    const modules = {
        toolbar: {
            container: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'font': [] }],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                [{ 'color': [] }, { 'background': [] }],
                ['blockquote', 'code-block'],
                ['link', 'file', 'image'], // Déplacé le bouton de fichier avant l'image
                ['clean']
            ],
            handlers: {
                file: handleFileUpload,
            },
        }
    };

    const { user, role } = useSupabaseUserWithRole();
    const email = user?.email as string;
    const [projectId, setProjectId] = useState("");
    const [project, setProject] = useState<Project | null>(null);
    const [usersProject, setUsersProject] = useState<ExtendedUser[]>([]); 
    const [selectedUser, setSelectedUser] = useState<User | null>(null)
    const [name, setName] = useState("")
    const [description, setDescription] = useState("")
    const rooter = useRouter()
    const [priority, setPriority] = useState<Priority>(Priority.LOW); // État pour la priorité, initialisé par calcul
    const [deadline, setDeadline] = useState<Date | null>(null); // État pour la deadline

    const getPriorityBadgeClass = (priority: Priority) => {
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
    
      const getPriorityText = (priority: Priority) => {
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
                    associatedUsers = (localProject.users?.map((item: { user: ExtendedUser }) => item.user) as ExtendedUser[]) || []; // Cast here
                    console.log("Projet et utilisateurs chargés depuis IndexedDB (hors ligne)");
                }
            } else {
                // Fetch from network
                currentProject = await getProjectInfo(projectId, true) as Project | null;
                if (currentProject) {
                    const allProjectUsers = await getProjectUsers(projectId);
                    // Filtrer les consultants de la liste des utilisateurs assignables
                    associatedUsers = allProjectUsers.filter((user: ExtendedUser) => user.role !== Role.CONSULTANT) as ExtendedUser[]; // Explicitly type user and cast result
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

    useEffect(() => {
        if (role === "ADMIN") {
            rooter.push("/admin"); // Redirect admins away from task creation
        }
    }, [role, rooter]);

    const handleUserSelect = (user: User) => {
        setSelectedUser(user)
    }

    const assignableUsers = usersProject.filter(u => u.id !== user?.id && u.role !== Role.CONSULTANT);
    const showAssignTask = assignableUsers.length > 0; // Show if there's at least one other assignable user


    const createTaskOffline = async (name: string, description: string, deadline: Date | null, projectId: string, createdByEmail: string, assignToEmail: string | undefined, offlineTempId: string) => {
        const newIdbTask: IdbTask = {
            id: offlineTempId,
            name,
            description,
            projectId,
            createdById: createdByEmail,
            userId: assignToEmail || null, // userId in PrismaTask is optional, but often populated. Set to null if assignToEmail is undefined
            status: 'To Do',
            createdAt: new Date(),
            updatedAt: new Date(),
            priority: Priority.LOW,
            deadline,
            // attachmentName: null, // Supprimé
            // attachmentUrl: null,  // Supprimé
            attachments: attachments.map(att => ({ ...att, id: Date.now().toString(), taskId: offlineTempId, uploadedById: createdByEmail, createdAt: new Date() })), // Inclure les pièces jointes
            comments: null,
            solutionDescription: null,
        };
        await addPendingChange({
            userId: createdByEmail,
            data: newIdbTask,
            timestamp: new Date().toISOString(),
            type: 'task',
        });
        await addTaskToIdb(newIdbTask); // Add to IndexedDB
        console.log('Tâche ajoutée hors ligne (client-side):', newIdbTask);
        return newIdbTask as Task; // Return as @/type.ts/Task
    };

    const handleSubmit = async () => {
        if (!name || !projectId || !description || (showAssignTask && !selectedUser)) {
            toast.error('Veuillez remplir tous les champs obligatoires')
            return
        }

        let calculatedPriority: Priority = Priority.LOW; // Default priority
        if (deadline) {
            const now = new Date();
            const deadlineDate = new Date(deadline);
            const diffTime = deadlineDate.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays <= 1) {
                calculatedPriority = Priority.HIGH;
            } else if (diffDays <= 3) {
                calculatedPriority = Priority.MEDIUM;
            } else {
                calculatedPriority = Priority.LOW;
            }
        }

        try {
            const offlineTempId = `offline-task-${Date.now()}`;
            const userToAssignEmail = selectedUser?.email || email; // Utiliser l'email de l'utilisateur sélectionné ou celui du créateur

            if (typeof window !== 'undefined' && !navigator.onLine) {
                // Offline task creation
                await createTaskOffline(name, description, deadline, projectId, email, userToAssignEmail, offlineTempId);
                toast.success('Tâche créée hors ligne et sera synchronisée !');
                rooter.push(`/project/${projectId}`);
            } else {
                // Online task creation
                await createTask(
                    name,
                    description,
                    calculatedPriority,
                    deadline,
                    attachments, // Passer le tableau de pièces jointes
                    projectId,
                    email,
                    userToAssignEmail
                );
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
                        {showAssignTask && (
                            <AssignTask users={usersProject} projectId={projectId} onAssignTask={handleUserSelect} />
                        )}
                        <div className='flex justify-between items-center mt-4'>
                            <span className='badge'>
                                Priorité
                            </span>
                            <div className={`badge ${getPriorityBadgeClass(priority)}`}>
                                {getPriorityText(priority)}
                            </div>
                        </div>
                        <div className='flex justify-between items-center mt-4'>
                            <span className='badge whitespace-nowrap'>
                                A livré le
                            </span>
                            <input
                                placeholder="Deadline"
                                className='input input-bordered  border-base-300 '
                                type="date"
                                onChange={(e) => {
                                    const newDeadline = e.target.value ? new Date(e.target.value) : null;
                                    setDeadline(newDeadline);
                                    if (newDeadline) {
                                        const now = new Date();
                                        const diffTime = newDeadline.getTime() - now.getTime();
                                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                                        if (diffDays <= 1) {
                                            setPriority(Priority.HIGH);
                                        } else if (diffDays <= 3) {
                                            setPriority(Priority.MEDIUM);
                                        } else {
                                            setPriority(Priority.LOW);
                                        }
                                    } else {
                                        setPriority(Priority.LOW); // Default if no deadline
                                    }
                                }}
                            />
                        </div>
                        {attachments.length > 0 && (
                            <div className="mt-4 p-2 bg-base-200 rounded-md"> {/* Remplacer la bordure de débogage par un style plus propre */}
                                <span className='badge whitespace-nowrap'>
                                    Pièces jointes
                                </span>
                                {attachments.map((att, index) => (
                                  <div key={index} className="flex items-center mt-2">
                                    <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline ml-2">
                                        {att.name}
                                    </a>
                                    <button type="button" className="btn btn-xs btn-outline btn-error ml-2" onClick={() => setAttachments(prev => prev.filter((_, i) => i !== index))}>
                                      Supprimer
                                    </button>
                                  </div>
                                ))}
                            </div>
                        )}
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
                                // ref={quillRef} // Supprimer la prop ref
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

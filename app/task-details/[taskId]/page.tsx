"use client"
import { getProjectInfo, getTaskDetails, updateTaskStatus } from '@/app/actions';
import EmptyState from '@/app/components/EmptyState';
import UserInfo from '@/app/components/UserInfo';
import Wrapper from '@/app/components/Wrapper';
import { Project, Task } from '@/type';
import Link from 'next/link';
import React, { useEffect, useState } from 'react'
import ReactQuill from 'react-quill-new';
import { toast } from 'react-hot-toast';
import 'react-quill-new/dist/quill.snow.css';
import { useUser } from '@clerk/nextjs';

const Page = ({ params }: { params: Promise<{ taskId: string }> }) => {
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress;

  const [task, setTask] = useState<Task | null>(null)
  const [taskId, setTaskId] = useState<string>("")
  const [project, setProject] = useState<Project | null>(null);
  const [status, setStatus] = useState("");
  const [realStatus, setRealStatus] = useState("");
  const [solution, setSolution] = useState("");

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

  const fetchInfos = async (taskId: string) => {
    try {
      const task = await getTaskDetails(taskId)
      setTask(task)
      setStatus(task.status)
      setRealStatus(task.status)
      fetchProject(task.projectId)
    } catch (error) {
      console.log(error)
      toast.error("Erreur lors du chargement des détails de la tâche.");
    }
  }

  const fetchProject = async (projectId: string) => {
    try {
      const project = await getProjectInfo(projectId, false)
      setProject(project)
    } catch (error) {
      console.log(error)
      toast.error("Erreur lors du chargement du projet");
    }
  }

  useEffect(() => {
    const getId = async () => {
      const resolvedParams = await params;
      setTaskId(resolvedParams.taskId)
      fetchInfos(resolvedParams.taskId)
    }
    getId()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const changeStatus = async (taskId: string, newStatus: string) => {
    try {
      await updateTaskStatus(taskId, newStatus)
      fetchInfos(taskId)
    } catch (error) {
      console.log(error)
      toast.error("Erreur lors du changement de status")
    }
  }

  const handleStatusChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = event.target.value;
    setStatus(newStatus)
    const modal = document.getElementById('my_modal_3') as HTMLDialogElement
    if (newStatus == "To Do" || newStatus == "In Progress") {
      changeStatus(taskId, newStatus)
      toast.success('Status changé')
      modal.close()
    } else {
      modal.showModal()
    }
  }

  const closeTask = async (newStatus: string) => {
    const modal = document.getElementById('my_modal_3') as HTMLDialogElement
    try {
      if (solution != "") {
        await updateTaskStatus(taskId, newStatus, solution)
        fetchInfos(taskId)
        if (modal) {
          modal.close()
        }
        toast.success('Tache cloturée')
      } else {
        toast.error('Il manque une solution')
      }

    } catch (error) {
      console.log(error)
      toast.error("Erreur lors du changement de status")
    }
  }

  useEffect(() => {
    const modal = document.getElementById('my_modal_3') as HTMLDialogElement
    const handleClose = () => {
      if (status === "Done" && status !== realStatus) {
        setStatus(realStatus)
      }
    }
    if (modal) {
      modal.addEventListener('close', handleClose)
    }
    return () => {
      if (modal) {
        modal.removeEventListener('close', handleClose)
      }
    }

  }, [status, realStatus])

  return (
    <Wrapper>
      {task ? (
        <div>
          <div className='flex flex-col md:justify-between md:flex-row'>
            <div className='breadcrumbs text-sm'>
              <ul>
                <li>
                  <div className='badge badge-primary'>
                    <Link href={`/project/${task?.projectId}`}>Retour</Link>
                  </div>
                </li>
                <li>
                  <div className='badge badge-primary'>{project?.name}</div>
                </li>
              </ul>
            </div>
            <div className='p-5 border border-base-300 rounded-xl w-full md:w-fit my-4'>
              <UserInfo
                role="Assigné à"
                email={task.user?.email || null}
                name={task.user?.name || null}
              />
            </div>            
          </div>
          
          {/* Nom de la tâche avec bordure */}
          <h1 className='font-semibold italic text-2xl mb-4 p-4 border border-base-300 rounded-lg'>{task.name}</h1>

          {/* Section Prix */}
          <div className="flex items-center justify-start p-5 border border-base-300 rounded-xl w-full md:w-fit my-4">
              <span className="font-semibold text-xl">Montant : </span>
              <span className="ml-2 text-lg">{task?.price ? `${task.price} Fcfa` : "Non défini"}</span>
          </div>

          {/* Date d'échéance et status */}
          <div className='flex justify-between items-center mb-4'>
            <span>
              A livré le
              <div className='badge badge-ghost ml-2'> {task?.dueDate?.toLocaleDateString()}</div>
            </span>
            <div>
              <select
                value={status}
                onChange={handleStatusChange}
                className='select select-sm select-bordered select-primary focus:outline-none ml-3'
                disabled={status == "Done" || task.user?.email !== email}
              >
                <option value="To Do">A faire</option>
                <option value="In Progress">En cours</option>
                <option value="Done">Terminée</option>
              </select>
            </div>
          </div>

          {/* Information créateur */}
          <div>
            <div className='flex md:justify-between md:items-center flex-col md:flex-row'>
              <div className='p-5 border border-base-300 rounded-xl w-full md:w-fit md:mb-4 '>
                <UserInfo
                  role="Créer par"
                  email={task.createdBy?.email || null}
                  name={task.createdBy?.name || null}
                />
              </div>
              <div className='badge badge-primary my-4 md:mt-0'>
                {task.dueDate && `
                    ${Math.max(0, Math.ceil((new Date(task.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))} jours restants
               `}
              </div>
            </div>
          </div>

          {/* Description de la tâche */}
          <div className='ql-snow w-full'>
            <div
              className='ql-editor p-5 border-base-300 border rounded-xl'
              dangerouslySetInnerHTML={{ __html: task.description }}
            />
          </div>

          {/* Solution si disponible */}
          {task?.solutionDescription && (
            <div>
              <div className='badge badge-primary my-4'>
                Solution
              </div>

              <div className='ql-snow w-full'>
                <div
                  className='ql-editor p-5 border-base-300 border rounded-xl'
                  dangerouslySetInnerHTML={{ __html: task.solutionDescription }}
                />
              </div>
            </div>
          )}

          <dialog id="my_modal_3" className="modal">
            <div className="modal-box">
              <form method="dialog">
                {/* if there is a button in form, it will close the modal */}
                <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
              </form>
              <h3 className="font-bold text-lg">C&apos;est quoi la solutions ?</h3>
              <p className="py-4">Décrivez ce que vous avez fait exactement</p>

              <ReactQuill
                placeholder='Decrivez la solution'
                value={solution}
                modules={modules}
                onChange={setSolution}
              />
              <button onClick={() => closeTask(status)} className='btn mt-4'> Terminé(e)</button>
            </div>
          </dialog>

        </div>
      ) : (
        <EmptyState
          imageSrc="/empty-task.png"
          imageAlt="Picture of an empty project"
          message="Cette tâche n'existe pas"
        />
      )}
    </Wrapper>
  )
}

export default Page;

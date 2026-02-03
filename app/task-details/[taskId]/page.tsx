"use client"
import { getProjectInfo, getTaskDetails, updateTaskStatus } from '@/app/actions';
import EmptyState from '@/app/components/EmptyState';
import UserInfo from '@/app/components/UserInfo';
import Wrapper from '@/app/components/Wrapper';
import { Project, Task } from '@/type';
import Link from 'next/link';
import React, { useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic';
import { toast } from 'react-hot-toast';
import 'react-quill-new/dist/quill.snow.css';
import { useSupabaseUserWithRole } from '../../hooks/useSupabaseUserWithRole';
import EditTaskForm from '@/app/components/EditTaskForm'; // Import the new form component
import { Role, Priority, Attachment } from '@prisma/client'; // Import Priority et Attachment
import { RefreshCw } from 'lucide-react'; // Ajout de RefreshCw
import { getCommentsForTask } from '@/app/actions';
import { getCurrentUser } from '@/app/actions';
import CommentComponent from '@/app/components/CommentComponent';
import CommentForm from '@/app/components/CommentForm';
import { useRouter } from 'next/navigation';
import { CommentWithUserAndReactionsAndReplies, User } from '@/type'; // Import ReactionType from @/type

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });

const Page = ({ params }: { params: Promise<{ taskId: string }> }) => {
  // eslint-disable-next-line
  const router = useRouter();
  const { user: supabaseUser, role } = useSupabaseUserWithRole();
  const email = supabaseUser?.email;

  const [task, setTask] = useState<(Task & { attachments: Attachment[] }) | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [status, setStatus] = useState("");
  const [realStatus, setRealStatus] = useState("");
  const [solution, setSolution] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [comments, setComments] = useState<CommentWithUserAndReactionsAndReplies[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null); // Set type for currentUser
  const [refreshing, setRefreshing] = useState(false); // Nouvel état pour le rafraîchissement

  const handleAddComment = useCallback((newComment: CommentWithUserAndReactionsAndReplies) => {
    const addReplyRecursively = (commentsArray: CommentWithUserAndReactionsAndReplies[]): CommentWithUserAndReactionsAndReplies[] => {
      return commentsArray.map(comment => {
        if (comment.id === newComment.parentId) {
          return { ...comment, replies: [...(comment.replies || []), newComment] };
        } else if (comment.replies && comment.replies.length > 0) {
          return { ...comment, replies: addReplyRecursively(comment.replies) };
        }
        return comment;
      });
    };

    if (newComment.parentId) {
      // Find the parent comment (or reply) and add the new reply
      setComments(prevComments => addReplyRecursively(prevComments));
    } else {
      // It's a top-level comment
      setComments(prevComments => [newComment, ...prevComments]);
    }
  }, []); // Empty dependency array as it only uses internal state setters

  const handleUpdateComment = (updatedComment: CommentWithUserAndReactionsAndReplies) => {
    const updateCommentsRecursively = (commentsArray: CommentWithUserAndReactionsAndReplies[]): CommentWithUserAndReactionsAndReplies[] => {
      return commentsArray.map(comment => {
        if (comment.id === updatedComment.id) {
          return updatedComment;
        } else if (comment.replies && comment.replies.length > 0) {
          return { ...comment, replies: updateCommentsRecursively(comment.replies) };
        }
        return comment;
      });
    };
    setComments(prevComments => updateCommentsRecursively(prevComments));
  };

  const handleDeleteComment = (commentId: string) => {
    const removeCommentRecursively = (commentsArray: CommentWithUserAndReactionsAndReplies[]): CommentWithUserAndReactionsAndReplies[] => {
      return commentsArray.filter(comment => {
        if (comment.id === commentId) {
          return false; // Remove this comment
        }
        // Recursively filter replies
        if (comment.replies && comment.replies.length > 0) {
          comment.replies = removeCommentRecursively(comment.replies);
        }
        return true; // Keep this comment (it's not the one to be deleted)
      });
    };
    setComments(prevComments => removeCommentRecursively(prevComments));
  };

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

  const getPriorityBadgeClass = (priority: Priority) => {
    if (task?.status === "Done") {
      return 'badge-success';
    }
    if (task?.status === "Late") {
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

  const getPriorityText = (priority: Priority) => {
    if (task?.status === "Done") {
      return 'Terminé';
    }
    if (task?.status === "Late") {
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

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "To Do":
        return 'badge-info';
      case "In Progress":
        return 'badge-warning';
      case "Done":
        return 'badge-success';
      case "Late":
        return 'badge-error';
      default:
        return 'badge-neutral';
    }
  };

  const fetchProject = useCallback(async (projectId: string) => {
    try {
      const projectData = await getProjectInfo(projectId, false);
      setProject(projectData as Project | null);
    } catch (error) {
      console.log(error);
      toast.error("Erreur lors du chargement du projet");
    }
  }, [setProject]);

  const fetchInfos = useCallback(async (currentTaskId: string) => {
    try {
      setRefreshing(true); // Début du rafraîchissement
      const taskData = await getTaskDetails(currentTaskId);
      if (taskData) {
        setTask(taskData as Task & { attachments: Attachment[] }); // Caster correctement le type
        setStatus(taskData.status);
        setRealStatus(taskData.status);
        await fetchProject(taskData.projectId);
        const userInfo = await getCurrentUser();
        setCurrentUser(userInfo as User | null);
      }
    } catch (error) {
      console.log(error);
      toast.error("Erreur lors du chargement des détails de la tâche.");
    } finally {
      setRefreshing(false); // Fin du rafraîchissement
    }
  }, [fetchProject, setCurrentUser, setRealStatus, setStatus, setTask]);

  useEffect(() => {
    const loadTaskData = async () => {
      const resolvedParams = await params;
      setTask(null);
      setProject(null);
      setComments([]);
      setCurrentUser(null);
      fetchInfos(resolvedParams.taskId);
      const initialComments = await getCommentsForTask(resolvedParams.taskId);
      setComments(initialComments as CommentWithUserAndReactionsAndReplies[]);
    };
    loadTaskData();
  }, [params, fetchInfos]); // Garder fetchInfos comme dépendance

  const changeStatus = async (currentTaskId: string, newStatus: string, solution?: string) => {
    try {
      const updatedTaskData = await updateTaskStatus(currentTaskId, newStatus, solution);
      if (updatedTaskData) {
        setTask(prevTask => prevTask ? { ...prevTask, status: updatedTaskData.status, solutionDescription: updatedTaskData.solutionDescription } : null);
        setStatus(updatedTaskData.status);
        setRealStatus(updatedTaskData.status);
      }
    } catch (error) {
      console.log(error);
      toast.error("Erreur lors du changement de status");
    }
  };

  const handleStatusChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = event.target.value;
    setStatus(newStatus);

    const canChangeStatus = role === Role.ADMIN || task?.createdBy?.email === email || task?.userId === supabaseUser?.id;

    if (role === Role.CONSULTANT && !canChangeStatus) {
      toast.error("Accès non autorisé : les consultants ne peuvent pas modifier le statut de la tâche.");
      return;
    }

    const modal = document.getElementById('my_modal_3') as HTMLDialogElement;
    if (newStatus === "To Do" || newStatus === "In Progress") {
      changeStatus(task?.id || "", newStatus);
      toast.success('Status changé');
      modal.close();
    } else {
      modal.showModal();
    }
  };

  const closeTask = async (newStatus: string) => {
    const modal = document.getElementById('my_modal_3') as HTMLDialogElement;
    try {
      if (solution !== "") {
        await changeStatus(task?.id || "", newStatus, solution);
        if (modal) {
          modal.close();
        }
        toast.success('Tache cloturée');
      } else {
        toast.error('Il manque une solution');
      }
    } catch (error) {
      console.log(error);
      toast.error("Erreur lors du changement de status");
    }
  };

  useEffect(() => {
    const modal = document.getElementById('my_modal_3') as HTMLDialogElement;
    const handleClose = () => {
      if (status === "Done" && status !== realStatus) {
        setStatus(realStatus);
      }
    };
    if (modal) {
      modal.addEventListener('close', handleClose);
    }
    return () => {
      if (modal) {
        modal.removeEventListener('close', handleClose);
      }
    };
  }, [status, realStatus]);

  if (!task) {
    return (
      <EmptyState
        imageSrc="/empty-task.png"
        imageAlt="Picture of an empty project"
        message="Cette tâche n'existe pas ou est en cours de chargement"
      />
    );
  }

  const canChangeStatus = (role === Role.ADMIN || task.createdBy?.email === email || task.user?.id === supabaseUser?.id) && task.status !== "Done";

  return (
    <Wrapper userRole={role ?? "GUEST"}> { /* Handle null role here */ }
      <div>
        <div className='flex flex-col md:justify-between md:flex-row'>
          <div className='breadcrumbs text-sm'>
            <ul>
              <li>
                <div className='badge badge-primary'>
                  <Link href={`/project/${task.projectId}`}>Retour</Link>
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
              imageUrl={task.user?.imageUrl || null}
            />
          </div>
        </div>

        {/* Nom de la tâche avec bordure */}
        <div className="flex justify-between items-center">
          <h1 className='font-semibold italic text-2xl mb-4 p-4 border border-base-300 rounded-lg'>{task.name}</h1>
          <div className="flex gap-2">
            <button
              onClick={() => fetchInfos(task.id)}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors justify-center"
              title="Actualiser la tâche"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:block">{refreshing ? 'Actualisation...' : 'Actualiser'}</span>
            </button>
            {(task.createdBy?.email === email || role === Role.ADMIN || project?.createdById === supabaseUser?.id) && role !== Role.CONSULTANT && task.status !== "Done" && task.priority !== "LATE" && (
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="btn btn-sm btn-outline btn-primary ml-4"
              >
                Modifier la tâche
              </button>
            )}
          </div>
        </div>

        {/* Date d'échéance, priorité, deadline */}
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4 items-center mb-4 p-4 border border-base-300 rounded-lg'>
          <div>
            <span className='font-semibold mr-2'>Priorité:</span>
            <div className={`badge ${getPriorityBadgeClass(task.priority)}`}>
              {getPriorityText(task.priority)}
            </div>
          </div>
          <div className="flex justify-end">
            <span className='font-semibold'>A livré le:</span>
            <div className='badge badge-ghost ml-2'> {task?.deadline?.toLocaleDateString() || 'Non définie'}</div>
          </div>
        </div>

        {/* Information créateur */}
        <div>
          <div className='flex md:justify-between md:items-center flex-col md:flex-row'>
            <div className='p-5 border border-base-300 rounded-xl w-full md:w-fit md:mb-4 '>
              <UserInfo
                role="Créé par"
                email={task.createdBy?.email || null}
                name={task.createdBy?.name || null}
                imageUrl={task.createdBy?.imageUrl || null}
              />
            </div>
            <div className='flex flex-col items-center gap-2 my-4 md:mt-0 md:flex-row'> {/* Adjusted for mobile */} 
              
              <div className={`badge ${getStatusBadgeClass(task.status)}`}>
                {task.status === "To Do" && "À faire"}
                {task.status === "In Progress" && "En cours"}
                {task.status === "Done" && "Terminé"}
                {task.status === "Late" && "En retard"}
              </div>
              {task.deadline && (
                <div className='badge badge-primary'>
                  {`
                    ${Math.max(0, Math.ceil((new Date(task.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))} jours restants
                  `}
                </div>
              )}
              {canChangeStatus && ( // Show dropdown only if user can change status
                <div className="flex items-center gap-2 mt-2 md:mt-0"> {/* New wrapper for label and select */} 
                  <select
                    className="select select-bordered select-sm w-fit max-w-xs" /* Adjusted width */
                    value={status}
                    onChange={handleStatusChange}
                    disabled={task.status === "Done" || task.priority === "LATE"}
                  >
                    <option value="To Do">À faire</option>
                    <option value="In Progress">En cours</option>
                    <option value="Done">Terminé</option>
                  </select>
                </div>
              )}
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

        {/* Affichage des pièces jointes si elles existent */}
        {task.attachments && task.attachments.length > 0 && (
          <div className="form-control mb-4 mt-4 p-4 border border-base-300 rounded-md">
            <label className="label">
              <span className="label-text">Pièces jointes</span>
            </label>
            {task.attachments.map((att) => (
              <div key={att.id} className="flex items-center mt-2">
                <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline mr-2">
                  {att.name}
                </a>
              </div>
            ))}
          </div>
        )}

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

        {/* Section Commentaires */}
        <div className="flex flex-col gap-2 p-4 border border-base-300 rounded-md w-full mt-4">
          <h3 className="text-lg font-semibold">Commentaires</h3>
          <div className="flex flex-col gap-4">
            {comments.length > 0 ? (
              comments.map((comment) => (
                <CommentComponent
                  key={comment.id}
                  comment={comment}
                  currentUserId={currentUser?.id}
                  userRole={role as Role | null | undefined}
                  onCommentModified={handleUpdateComment}
                  onCommentDeleted={handleDeleteComment}
                  onCommentAdded={handleAddComment} // Changed to handle replies
                />
              ))
            ) : (
              <p className="text-gray-500">Aucun commentaire pour l&apos;instant.</p>
            )}
          </div>
          {currentUser && ( // Only show form if a user is logged in
            <div className="mt-4">
              <CommentForm
                taskId={task.id}
                userId={currentUser.id}
                onCommentAdded={handleAddComment}
              />
            </div>
          )}
        </div>

        <dialog id="my_modal_3" className="modal">
          <div className="modal-box">
            <form method="dialog">
              <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
            </form>
            <h3 className="font-bold text-lg">C&apos;est quoi la solutions ?</h3>
            <p className="py-4">Décrivez ce que vous avez fait exactement</p>

            <ReactQuill
              placeholder='Decrivez la solution'
              value={solution}
              modules={modules}
              onChange={setSolution}
              readOnly={role === Role.CONSULTANT && !canChangeStatus}
            />
            <button onClick={() => closeTask(status)} className='btn mt-4' disabled={role === Role.CONSULTANT && !canChangeStatus}> Terminé(e)</button>
          </div>
        </dialog>
      </div>
      <dialog id="edit_task_modal" className="modal" open={isEditModalOpen}>
        <div className="modal-box w-11/12 max-w-5xl">
          <h3 className="font-bold text-lg">Modifier la tâche</h3>
          {task && project && (
            <>
              {console.log("Task object passed to EditTaskForm:", task)}
              <EditTaskForm task={task} project={project} onClose={() => {
                setIsEditModalOpen(false);
                fetchInfos(task.id); // Recharger les détails complets de la tâche
              }} />
            </>
          )}
        </div>
      </dialog>
    </Wrapper>
  );
};

export default Page;

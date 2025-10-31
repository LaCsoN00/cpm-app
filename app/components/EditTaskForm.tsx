import React, { FC, useState, useEffect } from 'react';
import { Project, Task, ExtendedUser } from '@/type';
import { updateTask, getProjectUsers } from '@/app/actions';
import { toast } from 'react-hot-toast';
import dynamic from 'next/dynamic';
import 'react-quill-new/dist/quill.snow.css';
import { format } from 'date-fns';
import { Priority } from '@prisma/client';

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });

interface EditTaskFormProps {
  task: Task;
  project: Project;
  onClose: () => void;
}

const EditTaskForm: FC<EditTaskFormProps> = ({ task, project, onClose }) => {
  const [name, setName] = useState(task.name);
  const [description, setDescription] = useState(task.description);
  const [deadline, setDeadline] = useState(task.deadline ? format(new Date(task.deadline), 'yyyy-MM-dd') : '');
  const [status, setStatus] = useState(task.status);
  const [assignedToEmail, setAssignedToEmail] = useState(task.user?.email || '');
  const [projectUsers, setProjectUsers] = useState<ExtendedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [priority, setPriority] = useState<Priority>(task.priority || Priority.LOW);
  const [comments, setComments] = useState<string>(task.comments || '');

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

  useEffect(() => {
    const fetchProjectUsers = async () => {
      if (project?.id) {
        try {
          const users = await getProjectUsers(project.id);
          setProjectUsers(users);
        } catch (error) {
          console.error('Error fetching project users:', error);
          toast.error('Erreur lors du chargement des utilisateurs du projet.');
        }
      }
    };
    fetchProjectUsers();
  }, [project?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const formattedDeadline = deadline ? new Date(deadline) : null;
      await updateTask(task.id, name, description, priority, formattedDeadline, assignedToEmail || undefined, status);
      toast.success('Tâche mise à jour avec succès !');
      onClose();
    } catch (error: unknown) {
      console.error('Erreur lors de la mise à jour de la tâche:', error);
      toast.error((error instanceof Error ? error.message : 'Une erreur inconnue est survenue.') || 'Erreur lors de la mise à jour de la tâche.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4">
      <div className="form-control mb-4">
        <label className="label">
          <span className="label-text">Nom de la tâche</span>
        </label>
        <input
          type="text"
          placeholder="Nom de la tâche"
          className="input input-bordered w-full"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="form-control mb-4">
        <label className="label">
          <span className="label-text">Description</span>
        </label>
        <ReactQuill
          placeholder="Description de la tâche"
          value={description}
          modules={modules}
          onChange={setDescription}
        />
      </div>
      <div className="form-control mb-4 mt-6">
        <label className="label">
          <span className="label-text">Deadline</span>
        </label>
        <input
          type="date"
          className="input input-bordered w-full"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
      </div>
      <div className="form-control mb-4">
        <label className="label">
          <span className="label-text">Priorité</span>
        </label>
        <select
          className="select select-bordered w-full"
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority)}
          required
        >
          {Object.values(Priority).map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>
      <div className="form-control mb-4">
        <label className="label">
          <span className="label-text">Commentaires</span>
        </label>
        <textarea
          placeholder="Ajouter des commentaires..."
          className="textarea textarea-bordered h-24 w-full"
          value={comments}
          onChange={(e) => setComments(e.target.value)}
        ></textarea>
      </div>
      <div className="form-control mb-4">
        <label className="label">
          <span className="label-text">Statut</span>
        </label>
        <select
          className="select select-bordered w-full"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          required
        >
          <option value="To Do">A faire</option>
          <option value="In Progress">En cours</option>
          <option value="Done">Terminée</option>
        </select>
      </div>
      <div className="form-control mb-4">
        <label className="label">
          <span className="label-text">Assigné à</span>
        </label>
        <select
          className="select select-bordered w-full"
          value={assignedToEmail}
          onChange={(e) => setAssignedToEmail(e.target.value)}
        >
          <option value="">Non assigné</option>
          {projectUsers.map((user) => (
            <option key={user.id} value={user.email}>
              {user.name} ({user.email})
            </option>
          ))}
        </select>
      </div>
      <div className="modal-action">
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Mise à jour...' : 'Mettre à jour'}
        </button>
        <button type="button" className="btn" onClick={onClose} disabled={loading}>
          Annuler
        </button>
      </div>
    </form>
  );
};

export default EditTaskForm;

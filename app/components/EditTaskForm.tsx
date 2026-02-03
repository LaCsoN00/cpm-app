import React, { FC, useState, useEffect } from 'react';
import { Project, Task, ExtendedUser } from '@/type';
import { Attachment } from '@prisma/client'; // Import Attachment de @prisma/client
import { updateTask, getProjectUsers } from '@/app/actions';
import { toast } from 'react-hot-toast';
import dynamic from 'next/dynamic';
import 'react-quill-new/dist/quill.snow.css';
import { format } from 'date-fns';
import { Priority } from '@prisma/client';
// import Quill from 'quill'; // Déplacer l'importation de Quill

// interface QuillIcons { [key: string]: string; }
// const icons = Quill.import('ui/icons') as QuillIcons;
// icons['file'] = '<i class="fa fa-paperclip"></i>'; // Déplacer la configuration des icônes

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });

const getPriorityBadgeClass = (task: Task & { attachments: Attachment[] }, priority: Priority) => {
  if (task.status === "Done") {
    return 'badge-success';
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

const getPriorityText = (task: Task & { attachments: Attachment[] }, priority: Priority) => {
  if (task.status === "Done") {
    return 'Terminé';
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

interface EditTaskFormProps {
  task: Task & { attachments: Attachment[] }; // Inclure les pièces jointes
  project: Project;
  onClose: () => void;
}

const EditTaskForm: FC<EditTaskFormProps> = ({ task, project, onClose }) => {
  const [name, setName] = useState(task.name);
  const [description, setDescription] = useState(task.description);
  const [deadline, setDeadline] = useState(task.deadline ? format(new Date(task.deadline), 'yyyy-MM-dd') : '');
  const [assignedToEmail, setAssignedToEmail] = useState(task.user?.email || '');
  const [projectUsers, setProjectUsers] = useState<ExtendedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>(task.attachments || []); // Gérer plusieurs pièces jointes

  const isTaskDone = task.status === "Done"; // Nouvelle variable pour vérifier si la tâche est terminée

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
    console.log('handleFileUpload a été appelée.');
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx');
    input.click();

    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) {
        const formData = new FormData();
        formData.append('file', file);

        try {
          const response = await fetch('/api/user/upload-file', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
          }

          const data = await response.json();
          const fileUrl = data.url;

          setAttachments(prev => [...prev, { id: Date.now().toString(), name: file.name, url: fileUrl, taskId: task.id, uploadedById: "temp", createdAt: new Date() }]); // Ajouter le nouveau fichier
          toast.success('Fichier téléchargé avec succès.');
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
        ['link', 'file', 'image'], // Ajout du bouton de fichier
        ['clean']
      ],
      handlers: {
        file: handleFileUpload,
      },
    }
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
      await updateTask(
        task.id,
        name,
        description,
        formattedDeadline,
        assignedToEmail || undefined,
        attachments // Passer le tableau de pièces jointes
      );
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
          disabled={isTaskDone} // Désactiver si la tâche est terminée
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
          readOnly={isTaskDone} // Rendre en lecture seule si la tâche est terminée
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
          disabled={isTaskDone} // Désactiver si la tâche est terminée
        />
      </div>
      <div className="flex flex-wrap gap-4 mb-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text mr-2">Priorité</span>
          </label>
          <div className={`badge ${getPriorityBadgeClass(task, task.priority)}`}>
            {getPriorityText(task, task.priority)}
          </div>
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text mr-2">Statut</span>
          </label>
          <div className={`badge ${getStatusBadgeClass(task.status)}`}>
            {task.status === "To Do" && "À faire"}
            {task.status === "In Progress" && "En cours"}
            {task.status === "Done" && "Terminé"}
            {task.status === "Late" && "En retard"}
          </div>
        </div>
      </div>
      <div className="form-control mb-4">
        <label className="label">
          <span className="label-text">Assigné à</span>
        </label>
        <select
          className="select select-bordered w-full"
          value={assignedToEmail}
          onChange={(e) => setAssignedToEmail(e.target.value)}
          disabled={isTaskDone} // Désactiver si la tâche est terminée
        >
          <option value="">Non assigné</option>
          {projectUsers.map((user) => (
            <option key={user.id} value={user.email}>
              {user.name} ({user.email})
            </option>
          ))}
        </select>
      </div>
      {attachments.length > 0 && (
        <div className="form-control mb-4">
          <label className="label">
            <span className="label-text">Pièces jointes</span>
          </label>
          {attachments.map((att) => (
            <div key={att.id} className="flex items-center mb-2">
              <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline mr-2">
                {att.name}
              </a>
              <button
                type="button"
                className="btn btn-xs btn-outline btn-error"
                onClick={() => setAttachments(prev => prev.filter(a => a.id !== att.id))}
                disabled={isTaskDone} // Désactiver si la tâche est terminée
              >
                Supprimer
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="modal-action">
        <button type="submit" className="btn btn-primary" disabled={loading || isTaskDone}>
          {loading ? 'Mise à jour...' : 'Mettre à jour'}
        </button>
        <button type="button" className="btn" onClick={() => onClose()} disabled={loading}>
          Annuler
        </button>
      </div>
    </form>
  );
};

export default EditTaskForm;

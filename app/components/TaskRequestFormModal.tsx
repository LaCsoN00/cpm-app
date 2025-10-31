import React, { FC, useState } from 'react';
import { createTaskRequest } from '@/app/actions';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { Priority } from '@prisma/client';

interface TaskRequestFormModalProps {
  projectId: string;
  onClose: () => void;
}

const TaskRequestFormModal: FC<TaskRequestFormModalProps> = ({
  projectId,
  onClose,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>(Priority.LOW);
  const [deadline, setDeadline] = useState<string>('');
  const [comments, setComments] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
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

      await createTaskRequest(
        projectId,
        name,
        description,
        calculatedPriority,
        deadline ? new Date(deadline) : null,
        comments || null,
      );
      toast.success('Demande de tâche envoyée avec succès !');
      onClose();
    } catch (error) {
      console.error('Error submitting task request:', error);
      toast.error(error instanceof Error ? error.message : 'Échec de l\'envoi de la demande de tâche.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-4 max-w-lg mx-auto">
      <div className="form-control w-full">
        <label className="label">
          <span className="label-text font-semibold">Nom de la tâche:</span>
        </label>
        <input
          type="text"
          className="input input-bordered w-full rounded-md focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div className="form-control w-full">
        <label className="label">
          <span className="label-text font-semibold">Description:</span>
        </label>
        <textarea
          className="textarea textarea-bordered h-24 w-full rounded-md focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        ></textarea>
      </div>

      <div className="form-control w-full">
        <label className="label">
          <span className="label-text font-semibold">Priorité:</span>
        </label>
        <select
          className="select select-bordered w-full rounded-md focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority)}
          disabled // Rendre le champ non modifiable
        >
          <option value={Priority.LOW}>Basse</option>
          <option value={Priority.MEDIUM}>Moyenne</option>
          <option value={Priority.HIGH}>Haute</option>
        </select>
      </div>

      <div className="form-control w-full">
        <label className="label">
          <span className="label-text font-semibold">Date limite:</span>
        </label>
        <input
          type="date"
          className="input input-bordered w-full rounded-md focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
      </div>

      <div className="form-control w-full">
        <label className="label">
          <span className="label-text font-semibold">Commentaires:</span>
        </label>
        <textarea
          className="textarea textarea-bordered h-24 w-full rounded-md focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
          value={comments}
          onChange={(e) => setComments(e.target.value)}
        ></textarea>
      </div>

      <div className="modal-action mt-6 flex justify-end gap-3">
        <button type="button" className="btn btn-ghost rounded-md" onClick={onClose} disabled={loading}>
          Annuler
        </button>
        <button type="submit" className="btn btn-primary rounded-md" disabled={loading || !name || !description}>
          {loading ? (
            <span className="flex items-center">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Envoi...
            </span>
          ) : (
            'Envoyer la demande'
          )}
        </button>
      </div>
    </form>
  );
};

export default TaskRequestFormModal;

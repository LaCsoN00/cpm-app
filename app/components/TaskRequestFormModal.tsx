import React, { FC, useState } from 'react';
import { createAssistanceRequest } from '@/app/actions';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { Priority } from '@prisma/client';

interface TaskRequestFormModalProps {
  projectId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

const TaskRequestFormModal: FC<TaskRequestFormModalProps> = ({
  projectId,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState<string>('');
  const [autoPriority, setAutoPriority] = useState<Priority>(Priority.LOW);
  const [loading, setLoading] = useState(false);

  const computePriorityFromDeadline = (deadlineValue: string): Priority => {
    if (!deadlineValue) {
      return Priority.LOW;
    }
    const now = new Date();
    const deadlineDate = new Date(deadlineValue);
    const diffTime = deadlineDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 1) {
      return Priority.HIGH;
    }
    if (diffDays <= 3) {
      return Priority.MEDIUM;
    }
    return Priority.LOW;
  };

  const handleDeadlineChange = (value: string) => {
    setDeadline(value);
    setAutoPriority(computePriorityFromDeadline(value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createAssistanceRequest(
        description, // Message principal de la demande
        projectId,
        {
          name,
          description,
          priority: autoPriority,
          deadline: deadline ? new Date(deadline) : null,
        }
      );
      toast.success('Demande d\'assistance envoyée !');
      onSuccess?.(); // Call onSuccess callback if provided
      onClose();
    } catch (error) {
      console.error('Error submitting assistance request:', error);
      toast.error(error instanceof Error ? error.message : 'Échec de l\'envoi de la demande d\'assistance.');
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
          <span className="label-text font-semibold">Date limite:</span>
        </label>
        <input
          type="date"
          className="input input-bordered w-full rounded-md focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
          value={deadline}
          onChange={(e) => handleDeadlineChange(e.target.value)}
        />
      </div>

      <div className="form-control w-full">
        <label className="label">
          <span className="label-text font-semibold">Priorité appliquée automatiquement :</span>
        </label>
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-base-300 bg-base-200/60 px-3 py-2">
          <span
            className={`badge ${
              autoPriority === Priority.HIGH
                ? "badge-error"
                : autoPriority === Priority.MEDIUM
                ? "badge-warning"
                : "badge-info"
            }`}
          >
            {autoPriority === Priority.HIGH
              ? "Haute"
              : autoPriority === Priority.MEDIUM
              ? "Moyenne"
              : "Basse"}
          </span>
          <span className="text-xs text-base-content/70">
            Calculée automatiquement selon la date limite choisie.
          </span>
        </div>
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

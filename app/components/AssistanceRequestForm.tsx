import React, { FC, useState } from 'react';
import { createAssistanceRequest } from '@/app/actions';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

interface AssistanceRequestFormProps {
  projectId?: string; // Optional project ID if the request is project-specific
  onClose: () => void; // Callback to close the modal/form after submission
}

const AssistanceRequestForm: FC<AssistanceRequestFormProps> = ({ projectId, onClose }) => {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createAssistanceRequest(message, projectId);
      toast.success('Demande d\'assistance envoyée avec succès !');
      onClose();
    } catch (error) {
      console.error('Error submitting assistance request:', error);
      toast.error(error instanceof Error ? error.message : 'Échec de l\'envoi de la demande d\'assistance.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4">
      <div className="form-control w-full mb-4">
        <label className="label">
          <span className="label-text">Décrivez votre besoin d&#39;assistance:</span>   
        </label>
        <textarea
          className="textarea textarea-bordered h-24"
          placeholder="Ex: J'ai besoin d'aide pour configurer l'intégration de l'API tiers pour le projet..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
        ></textarea>
      </div>
      <div className="modal-action">
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>
          Annuler
        </button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
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

export default AssistanceRequestForm;

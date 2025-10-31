import React, { FC, useState } from 'react';
import { Project } from '@/type';
import { updateProject } from '@/app/actions';
import { toast } from 'react-hot-toast';

interface EditProjectFormProps {
  project: Project;
  onClose: () => void;
}

const EditProjectForm: FC<EditProjectFormProps> = ({ project, onClose }) => {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateProject(project.id, name, description);
      toast.success('Projet mis à jour avec succès !');
      onClose();
    } catch (error: unknown) {
      console.error('Erreur lors de la mise à jour du projet:', error);
      toast.error((error instanceof Error ? error.message : 'Une erreur inconnue est survenue.') || 'Erreur lors de la mise à jour du projet.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4">
      <div className="form-control mb-4">
        <label className="label">
          <span className="label-text">Nom du projet</span>
        </label>
        <input
          type="text"
          placeholder="Nom du projet"
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
        <textarea
          placeholder="Description du projet"
          className="textarea textarea-bordered h-24 w-full"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
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

export default EditProjectForm;

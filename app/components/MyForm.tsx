'use client';

import { useState } from 'react';
import { useSupabaseUser } from '../hooks/useSupabaseUser';
import { addPendingChange } from '@/lib/idb';
import { Project } from '@/type'; // Assurez-vous que le type Project est bien importé.

const MyForm = () => {
  // Initialisation du state avec les propriétés du projet.
  const [formData, setFormData] = useState<Project>({
    id: '', // id de type string, mais peut être vide au départ
    name: '',
    description: '', // description peut être null, ajustez si nécessaire
    createdAt: new Date(),
    updatedAt: new Date(),
    inviteCode: '',
    createdById: '',
    isConsultantProject: false, // Add missing property
  });

  const { user } = useSupabaseUser(); // Récupérer l'utilisateur via Supabase

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Vérifier si l'utilisateur est authentifié avant de continuer
    if (!user) {
      console.error('Utilisateur non authentifié');
      return;
    }

    // Ajouter l'ID de l'utilisateur dans les données envoyées
    const projectData: Project = { ...formData };

    // Si l'utilisateur est hors ligne, on stocke les données localement dans IndexedDB
    if (!navigator.onLine) {
      await addPendingChange({
        data: projectData,
        timestamp: new Date().toISOString(),
        userId: user.id, // Ajouter l'ID de l'utilisateur
        type: 'project',
      });
      console.log('🟡 Données stockées localement (offline).');
    } else {
      // Si l'utilisateur est en ligne, on envoie les données au serveur
      const response = await fetch('/api/saveProject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData),
      });

      if (response.ok) {
        console.log('✅ Données envoyées au serveur.');
      } else {
        console.error('Erreur lors de l\'envoi des données');
      }
    }

    // Réinitialisation du formulaire après soumission (optionnel)
    setFormData({ 
      id: '', 
      name: '', 
      description: '', 
      createdAt: new Date(), 
      updatedAt: new Date(), 
      inviteCode: '', 
      createdById: '', 
      isConsultantProject: false, // Add missing property
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="name">Nom:</label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
        />
      </div>

      <div>
        <label htmlFor="description">Description:</label>
        <input
          type="text"
          id="description"
          name="description"
          value={formData.description ?? ''}
          onChange={handleChange}
          required
        />
      </div>

      <button type="submit">Envoyer</button>
    </form>
  );
};

export default MyForm;

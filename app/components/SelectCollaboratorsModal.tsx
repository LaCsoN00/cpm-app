import Image from 'next/image';
import React, { FC, useState, useEffect } from 'react';
import { getAllUsersForCollaboration, addMultipleUsersToProject } from '@/app/actions';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { ExtendedUser } from '@/type'; // Use ExtendedUser

interface SelectCollaboratorsModalProps {
  projectId: string;
  onClose: () => void;
  onCollaboratorsSelected: (selectedUserIds: string[]) => void;
}

const SelectCollaboratorsModal: FC<SelectCollaboratorsModalProps> = ({
  projectId,
  onClose,
  onCollaboratorsSelected,
}) => {
  const [allUsers, setAllUsers] = useState<ExtendedUser[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [addingCollaborators, setAddingCollaborators] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const users = await getAllUsersForCollaboration();
        setAllUsers(users);
      } catch (error) {
        console.error('Error fetching users for collaboration:', error);
        toast.error('Échec du chargement des utilisateurs pour la collaboration.');
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, []);

  const handleUserSelect = (userId: string) => {
    setSelectedUsers((prevSelected) =>
      prevSelected.includes(userId)
        ? prevSelected.filter((id) => id !== userId)
        : [...prevSelected, userId]
    );
  };

  const handleAddCollaborators = async () => {
    setAddingCollaborators(true);
    try {
      if (selectedUsers.length === 0) {
        toast.error('Veuillez sélectionner au moins un collaborateur.');
        return;
      }

      const result = await addMultipleUsersToProject(projectId, selectedUsers);

      if (result.success) {
        toast.success(result.message);
        onCollaboratorsSelected(selectedUsers); // Notify parent about selected collaborators
        onClose();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error adding collaborators:', error);
      toast.error(error instanceof Error ? error.message : 'Échec de l\'ajout des collaborateurs.');
    } finally {
      setAddingCollaborators(false);
    }
  };

  const filteredUsers = allUsers.filter(
    (user) =>
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4">
      <input
        type="text"
        placeholder="Rechercher un utilisateur..."
        className="input input-bordered w-full mb-4"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      {loadingUsers ? (
        <div className="flex justify-center items-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-2">Chargement des utilisateurs...</span>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          Aucun utilisateur trouvé.
        </div>
      ) : (
        <div className="max-h-60 overflow-y-auto mb-4 border rounded-lg p-2">
          {filteredUsers.map((user) => {
            const isOccupied = user.tasks && user.tasks.length > 0;
            const statusText = isOccupied ? "Occupé" : "Disponible";
            const isDisabled = isOccupied; // Disable selection if user is occupied

            return (
              <div
                key={user.id}
                className={`flex items-center justify-between p-2 rounded-md ${!isDisabled ? "hover:bg-base-200 cursor-pointer" : "opacity-50 cursor-not-allowed"}`}
                onClick={() => !isDisabled && handleUserSelect(user.id)}
              >
                <div className="flex items-center">
                  {/* Placeholder for user image/avatar */}
                  {user.imageUrl ? (
                    <Image src={user.imageUrl} alt={user.name || user.email} width={32} height={32} className="w-8 h-8 rounded-full mr-2 object-cover" />
                  ) : (
                    <div className="w-8 h-8 bg-base-300 rounded-full flex items-center justify-center text-sm font-bold mr-2">
                      {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="font-semibold">{user.name || user.email}</p>
                    <p className="text-sm text-gray-500">{user.email}</p>
                    <span className={`badge badge-sm ${isOccupied ? "badge-error" : "badge-success"}`}>
                      {statusText}
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary"
                  checked={selectedUsers.includes(user.id)}
                  onChange={() => !isDisabled && handleUserSelect(user.id)}
                  disabled={isDisabled}
                />
              </div>
            );
          })}
        </div>
      )}

      <div className="modal-action">
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={addingCollaborators}>
          Annuler
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleAddCollaborators}
          disabled={selectedUsers.length === 0 || addingCollaborators}
        >
          {addingCollaborators ? (
            <span className="flex items-center">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Ajout...
            </span>
          ) : (
            `Ajouter les ${selectedUsers.length} collaborateurs`
          )}
        </button>
      </div>
    </div>
  );
};

export default SelectCollaboratorsModal;

"use client";
import React, { useState } from 'react';
import { User } from '@supabase/supabase-js';
import { toast } from 'react-hot-toast';
import Image from 'next/image';
import { CameraIcon } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { updateUserProfileImage } from '@/app/actions'; // Import the new action

interface ProfileImageUploadProps {
  user: User | null;
  currentImageUrl: string | null;
  onUploadSuccess: (newImageUrl: string) => void;
}

const ProfileImageUpload: React.FC<ProfileImageUploadProps> = ({ user, currentImageUrl, onUploadSuccess }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl);
  const [isUploading, setIsUploading] = useState(false);
  const supabase = createClient();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setSelectedFile(null);
      setPreviewUrl(currentImageUrl);
    }
  };

  const handleUpload = async () => {
    if (!user) {
      toast.error("Utilisateur non connecté.");
      return;
    }
    if (!selectedFile) {
      toast.error("Veuillez sélectionner un fichier à télécharger.");
      return;
    }

    setIsUploading(true);
    const fileExtension = selectedFile.name.split('.').pop();
    const filePath = `${user.id}/profile.${fileExtension}`;

    try {
      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('avatars') // Assurez-vous que ce bucket existe dans Supabase
        .upload(filePath, selectedFile, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);

      if (!publicUrl) {
        throw new Error("Impossible de récupérer l'URL publique de l'image.");
      }

      // Update imageUrl in the database
      const { success, error: dbError } = await updateUserProfileImage(user.email!, publicUrl);

      if (!success) {
        throw new Error(dbError || "Échec de la mise à jour de l'URL de l'image dans la base de données.");
      }

      toast.success("Image de profil mise à jour avec succès.");
      onUploadSuccess(publicUrl);
      setPreviewUrl(publicUrl); // Update preview with actual public URL
    } catch (error) {
      console.error("Erreur lors de l'upload de l'image:", error);
      toast.error(`Échec de l'upload de l'image: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4 border rounded-lg shadow-md bg-base-100">
      <div className="relative w-32 h-32 rounded-full overflow-hidden border-2 border-primary bg-base-200 flex items-center justify-center">
        {previewUrl ? (
          <Image src={previewUrl} alt="Profile Preview" layout="fill" objectFit="cover" />
        ) : (
          <div className="text-primary flex flex-col items-center">
            <CameraIcon size={48} />
            <span className="text-sm">Pas d&apos;image</span>
          </div>
        )}
        <label htmlFor="file-input" className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 opacity-0 hover:opacity-100 transition-opacity duration-300 cursor-pointer">
          <CameraIcon size={32} className="text-white" />
        </label>
      </div>
      <input
        id="file-input"
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        disabled={isUploading}
      />
      
      <button
        onClick={handleUpload}
        disabled={!selectedFile || isUploading}
        className={`btn btn-primary w-full ${isUploading ? 'btn-disabled' : ''}`}
      >
        {isUploading ? 'Téléchargement...' : 'Télécharger l\'image'}
      </button>
    </div>
  );
};

export default ProfileImageUpload;

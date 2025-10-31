"use client";
import React from 'react';
import { useSupabaseUserWithRole } from '@/app/hooks/useSupabaseUserWithRole';
import ProfileImageUpload from '@/app/components/ProfileImageUpload';
import Wrapper from '@/app/components/Wrapper';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

const UserProfilePage = () => {
  const { user, imageUrl, loading, name, role } = useSupabaseUserWithRole();
  const router = useRouter();

  const handleUploadSuccess = (newImageUrl: string) => {
    router.refresh();
    console.log("New image URL:", newImageUrl);
  };

  if (loading) {
    return (
      <Wrapper userRole="GUEST">
        <div className="flex justify-center items-center h-full">
          <span className="loading loading-spinner loading-lg text-primary"></span>
        </div>
      </Wrapper>
    );
  }

  return (
    <Wrapper userRole={role || "GUEST"} >
      <div className="container mx-auto p-4 md:p-8 max-w-2xl bg-base-100 rounded-lg shadow-xl mt-10">
        <div className="flex items-center mb-6">
          <button onClick={() => router.back()} className="btn btn-ghost btn-circle mr-2">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-3xl font-bold">Mon Profil</h1>
        </div>
        
        <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
          <ProfileImageUpload
            user={user}
            currentImageUrl={imageUrl}
            onUploadSuccess={handleUploadSuccess}
          />
          
          <div className="flex-1 w-full text-center md:text-left">
            <h2 className="text-2xl font-semibold mb-2">{name || "Nom inconnu"}</h2>
            <p className="text-base-content/70 mb-4">{user?.email || "Email inconnu"}</p>
            
            <div className="mt-6">
              <h3 className="text-xl font-semibold mb-3">Autres informations</h3>
              <p className="text-base-content/80">Role: {role || "Non défini"}</p>
            </div>
          </div>
        </div>
      </div>
    </Wrapper>
  );
};

export default UserProfilePage;

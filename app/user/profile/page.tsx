"use client";
import React, { useEffect, useState } from 'react';
import { useSupabaseUserWithRole } from '@/app/hooks/useSupabaseUserWithRole';
import ProfileImageUpload from '@/app/components/ProfileImageUpload';
import Wrapper from '@/app/components/Wrapper';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Shield, AlertCircle, Mail, Hash, UserCircle2, ShieldCheck } from 'lucide-react';
import { Role } from '@prisma/client';

interface UserProfileData {
  id: string;
  name: string;
  email: string;
  imageUrl: string | null;
  role: Role;
  approved: boolean;
  restricted: boolean;
}

const UserProfilePage = () => {
  const { user, imageUrl, loading, name, role } = useSupabaseUserWithRole();
  const router = useRouter();
  const [profileData, setProfileData] = useState<UserProfileData | null>(null);

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!user) {
        return;
      }
      
      try {
        const response = await fetch('/api/user/profile');
        if (response.ok) {
          const data = await response.json();
          // Ne garder que les données du profil, sans les statistiques
          if (data.user) {
            const { statistics, isGlobalStats, ...profileInfo } = data.user;
            void statistics;
            void isGlobalStats;
            setProfileData(profileInfo);
          }
        } else {
          // En cas d'erreur, utiliser les données de base du hook
          setProfileData({
            id: user.id || '',
            name: name || '',
            email: user.email || '',
            imageUrl: imageUrl || null,
            role: role || Role.USER,
            approved: false,
            restricted: false,
          });
        }
      } catch (error) {
        console.error('Error fetching profile data:', error);
        // En cas d'erreur, utiliser les données de base du hook
        setProfileData({
          id: user.id || '',
          name: name || '',
          email: user.email || '',
          imageUrl: imageUrl || null,
          role: role || Role.USER,
          approved: false,
          restricted: false,
        });
      }
    };

    if (!loading && user) {
      fetchProfileData();
    } else if (!loading && !user) {
      setProfileData(null);
    }
  }, [user, loading, name, imageUrl, role]);

  const handleUploadSuccess = (newImageUrl: string) => {
    router.refresh();
    console.log("New image URL:", newImageUrl);
  };

  const getRoleLabel = (role: Role | null) => {
    switch (role) {
      case 'ADMIN':
        return 'Administrateur';
      case 'CONSULTANT':
        return 'Consultant';
      case 'USER':
        return 'Utilisateur';
      default:
        return 'Non défini';
    }
  };

  const getRoleBadgeColor = (role: Role | null) => {
    switch (role) {
      case 'ADMIN':
        return 'badge-error';
      case 'CONSULTANT':
        return 'badge-warning';
      case 'USER':
        return 'badge-info';
      default:
        return 'badge-ghost';
    }
  };

  const displayName = profileData?.name || name || 'Nom inconnu';
  const displayEmail = profileData?.email || user?.email || 'Email inconnu';
  const displayId = profileData?.id || user?.id || 'N/A';
  const displayRole = profileData?.role || role;
  const isApproved = profileData?.approved ?? false;
  const isRestricted = profileData?.restricted ?? false;

  const infoItems = [
    {
      label: 'Identifiant',
      value: displayId,
      icon: Hash,
      className: 'font-mono text-sm break-all',
    },
    {
      label: 'Email',
      value: displayEmail,
      icon: Mail,
      className: 'break-all',
    },
    {
      label: 'Rôle',
      value: getRoleLabel(displayRole),
      icon: UserCircle2,
      className: 'font-semibold',
    },
    {
      label: 'Statut',
      value: isApproved ? 'Approuvé' : 'En attente',
      icon: ShieldCheck,
      className: `font-semibold ${isApproved ? 'text-success' : 'text-warning'}`,
    },
  ];

  return (
    <Wrapper userRole={role || "GUEST"}>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center mb-6">
          <button onClick={() => router.back()} className="btn btn-ghost btn-circle mr-2">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-3xl font-bold">Mon Profil</h1>
        </div>
        
        {/* Carte principale du profil */}
        <div className="bg-base-100 rounded-lg shadow-xl p-6 md:p-8">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
            <ProfileImageUpload
              user={user}
              currentImageUrl={imageUrl}
              onUploadSuccess={handleUploadSuccess}
            />
            
            <div className="flex-1 w-full text-center md:text-left space-y-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-base-200 pb-4">
                <div>
                  <h2 className="text-3xl font-bold mb-2">{displayName}</h2>
                  <p className="text-base-content/70 text-lg mb-3">{displayEmail}</p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center md:justify-end">
                  <div className={`badge ${getRoleBadgeColor(displayRole)} badge-lg`}>
                    {getRoleLabel(displayRole)}
                  </div>
                  {isApproved && (
                    <div className="badge badge-success badge-lg">
                      <Shield size={14} className="mr-1" />
                      Approuvé
                    </div>
                  )}
                  {isRestricted && (
                    <div className="badge badge-error badge-lg">
                      <AlertCircle size={14} className="mr-1" />
                      Restreint
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {infoItems.map(({ label, value, icon: Icon, className }) => (
                  <div key={label} className="flex items-start gap-3 p-4 rounded-xl bg-base-200/60 border border-base-200">
                    <div className="p-3 rounded-full bg-primary/10 text-primary">
                      <Icon size={18} />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-base-content/60 font-semibold mb-1">{label}</p>
                      <p className={className}>{value}</p>
                      {label === 'Statut' && isRestricted && (
                        <span className="badge badge-error badge-sm mt-2">Restreint</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Wrapper>
  );
};

export default UserProfilePage;

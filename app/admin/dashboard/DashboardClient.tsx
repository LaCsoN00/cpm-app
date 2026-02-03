"use client"

import { useEffect, useState, useCallback } from "react";
import { FolderKanban, CheckSquare, MessageSquare, FileText, HelpCircle, Briefcase, Users, UserCheck, BarChart3, TrendingUp, Activity, AlertCircle, RefreshCw } from "lucide-react";
import { Role } from "@prisma/client";
import Wrapper from "@/app/components/Wrapper";
import { useSupabaseUser } from "@/app/hooks/useSupabaseUser";

interface UserStatistics {
  projectsCreated?: number;
  projectsCollaborated?: number;
  totalProjects?: number;
  tasksCreated?: number;
  tasksAssigned?: number;
  totalTasks?: number;
  comments?: number;
  commentReactions?: number;
  assistanceRequestsCreated?: number;
  assistanceRequestsResolvedCount?: number; // Renamed to avoid duplicate
  attachments?: number;
  // Statistiques globales pour admin
  totalUsers?: number;
  activeUsers?: number;
  approvedUsers?: number;
  restrictedUsers?: number;
  adminCount?: number;
  consultantCount?: number;
  userCount?: number;
  tasksToDo?: number;
  tasksInProgress?: number;
  tasksDone?: number;
  totalAssistanceRequests?: number;
  assistanceRequestsPending?: number;
  assistanceRequestsResolved?: number;
  assistanceRequestsRejected?: number;
}

interface UserProfileData {
  id: string;
  name: string;
  email: string;
  imageUrl: string | null;
  role: Role;
  approved: boolean;
  restricted: boolean;
  isGlobalStats?: boolean;
  statistics: UserStatistics;
}

// Composant pour graphique circulaire (Donut Chart)
const DonutChart = ({ 
  data, 
  size = 200, 
  strokeWidth = 20 
}: { 
  data: { label: string; value: number; color: string }[];
  size?: number;
  strokeWidth?: number;
}) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) {
    return (
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <p className="text-sm text-base-content/60">Aucune donnée</p>
      </div>
    );
  }

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  let currentOffset = 0;

  const segments = data
    .filter(item => item.value > 0)
    .map((item) => {
      const percentage = (item.value / total) * 100;
      const strokeDasharray = (item.value / total) * circumference;
      const offset = currentOffset;
      currentOffset += strokeDasharray;

      return {
        ...item,
        percentage,
        strokeDasharray,
        strokeDashoffset: circumference - offset,
      };
    });

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {segments.map((segment, index) => (
          <circle
            key={index}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={segment.color}
            strokeWidth={strokeWidth}
            strokeDasharray={segment.strokeDasharray}
            strokeDashoffset={segment.strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-3xl font-bold">{total}</p>
        <p className="text-xs text-base-content/60">Total</p>
      </div>
    </div>
  );
};

export default function DashboardClient() {
  const { user } = useSupabaseUser();
  const [profileData, setProfileData] = useState<UserProfileData | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const fetchProfileData = useCallback(async () => {
    if (!user) {
      setLoadingStats(false);
      return;
    }
    
    setLoadingStats(true);
    try {
      const response = await fetch('/api/user/profile');
      if (response.ok) {
        const data = await response.json();
        if (data.user && data.user.isGlobalStats) {
          setProfileData(data.user);
        }
      } else {
        console.warn('Failed to fetch profile data, response not ok:', response.status);
        setProfileData(null);
      }
    } catch (error) {
      console.error('Error fetching profile data:', error);
      setProfileData(null);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchProfileData();
    }
  }, [user, fetchProfileData]);

  const stats = profileData?.statistics;

  // Données pour le graphique des tâches
  const tasksChartData = stats ? [
    { label: 'À faire', value: stats.tasksToDo || 0, color: '#fbbf24' }, // warning
    { label: 'En cours', value: stats.tasksInProgress || 0, color: '#3b82f6' }, // info
    { label: 'Terminées', value: stats.tasksDone || 0, color: '#10b981' }, // success
  ] : [];

  // Données pour le graphique des utilisateurs par rôle
  const usersChartData = stats ? [
    { label: 'Admin', value: stats.adminCount || 0, color: '#ef4444' }, // error
    { label: 'Consultant', value: stats.consultantCount || 0, color: '#f59e0b' }, // warning
    { label: 'Utilisateur', value: stats.userCount || 0, color: '#3b82f6' }, // info
  ] : [];

  return (
    <Wrapper userRole={Role.ADMIN}>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 size={24} className="text-primary" />
            <h2 className="text-2xl font-bold">Dashboard Administrateur</h2>
          </div>
          <button
            onClick={fetchProfileData}
            className="btn btn-ghost btn-sm"
            title="Actualiser les statistiques"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <p className="text-base-content/70 mb-6">Vue d&apos;ensemble de la plateforme</p>
      </div>

      {!stats ? (
        <div className='my-40 w-full h-full flex justify-center items-center flex-col'>
          <BarChart3 size={80} className="text-primary mb-4" />
          <p className='text-sm text-base-content/70 mt-2'>Chargement des statistiques</p>
        </div>
      ) : (
        <>
          {/* Statistiques utilisateurs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-primary to-primary/80 rounded-lg shadow-lg p-6 text-white">
              <div className="flex items-center justify-between mb-3">
                <Users size={24} />
                <Activity size={20} className="opacity-70" />
              </div>
              <p className="text-3xl font-bold mb-1">{stats.totalUsers || 0}</p>
              <p className="text-sm opacity-90">Utilisateurs totaux</p>
              <div className="mt-3 pt-3 border-t border-white/20">
                <p className="text-xs opacity-80">
                  {stats.activeUsers || 0} actif{stats.activeUsers !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-success to-success/80 rounded-lg shadow-lg p-6 text-white">
              <div className="flex items-center justify-between mb-3">
                <UserCheck size={24} />
                <TrendingUp size={20} className="opacity-70" />
              </div>
              <p className="text-3xl font-bold mb-1">{stats.approvedUsers || 0}</p>
              <p className="text-sm opacity-90">Utilisateurs approuvés</p>
              <div className="mt-3 pt-3 border-t border-white/20">
                <p className="text-xs opacity-80">
                  {stats.totalUsers ? Math.round((stats.approvedUsers || 0) / stats.totalUsers * 100) : 0}% du total
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-warning to-warning/80 rounded-lg shadow-lg p-6 text-white">
              <div className="flex items-center justify-between mb-3">
                <AlertCircle size={24} />
                <Activity size={20} className="opacity-70" />
              </div>
              <p className="text-3xl font-bold mb-1">{stats.restrictedUsers || 0}</p>
              <p className="text-sm opacity-90">Utilisateurs restreints</p>
              <div className="mt-3 pt-3 border-t border-white/20">
                <p className="text-xs opacity-80">
                  {stats.adminCount || 0} admin{stats.adminCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-info to-info/80 rounded-lg shadow-lg p-6 text-white">
              <div className="flex items-center justify-between mb-3">
                <Users size={24} />
                <BarChart3 size={20} className="opacity-70" />
              </div>
              <p className="text-3xl font-bold mb-1">{stats.userCount || 0}</p>
              <p className="text-sm opacity-90">Utilisateurs standards</p>
              <div className="mt-3 pt-3 border-t border-white/20">
                <p className="text-xs opacity-80">
                  {stats.consultantCount || 0} consultant{stats.consultantCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>

          {/* Graphiques circulaires et statistiques projets/tâches */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Graphique des tâches */}
            <div className="bg-base-100 rounded-lg shadow-lg p-6 border-l-4 border-secondary">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <CheckSquare size={20} className="text-secondary" />
                Répartition des tâches
              </h3>
              <div className="flex flex-col items-center">
                <DonutChart data={tasksChartData} size={200} strokeWidth={25} />
                <div className="mt-4 space-y-2 w-full">
                  {tasksChartData.map((item, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-base-content/70">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{item.value}</span>
                        <span className="text-base-content/60 text-xs">
                          ({tasksChartData.reduce((sum, i) => sum + i.value, 0) > 0 ? Math.round((item.value / tasksChartData.reduce((sum, i) => sum + i.value, 0)) * 100) : 0}%)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Graphique des utilisateurs */}
            <div className="bg-base-100 rounded-lg shadow-lg p-6 border-l-4 border-primary">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Users size={20} className="text-primary" />
                Répartition des utilisateurs
              </h3>
              <div className="flex flex-col items-center">
                <DonutChart data={usersChartData} size={200} strokeWidth={25} />
                <div className="mt-4 space-y-2 w-full">
                  {usersChartData.map((item, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-base-content/70">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{item.value}</span>
                        <span className="text-base-content/60 text-xs">
                          ({usersChartData.reduce((sum, i) => sum + i.value, 0) > 0 ? Math.round((item.value / usersChartData.reduce((sum, i) => sum + i.value, 0)) * 100) : 0}%)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Statistiques projets */}
            <div className="bg-base-100 rounded-lg shadow-lg p-6 border-l-4 border-primary relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-primary/10 rounded-full -mr-10 -mt-10"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <FolderKanban size={24} className="text-primary" />
                  <TrendingUp size={20} className="text-primary/50" />
                </div>
                <p className="text-4xl font-bold text-primary mb-2">{stats.totalProjects || 0}</p>
                <p className="text-sm text-base-content/70 font-semibold">Projets actifs</p>
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs text-base-content/60">
                    Tous les projets de la plateforme
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Statistiques tâches et commentaires */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-base-100 rounded-lg shadow-lg p-6 border-l-4 border-secondary relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-secondary/10 rounded-full -mr-10 -mt-10"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <CheckSquare size={24} className="text-secondary" />
                  <Activity size={20} className="text-secondary/50" />
                </div>
                <p className="text-4xl font-bold text-secondary mb-2">{stats.totalTasks || 0}</p>
                <p className="text-sm text-base-content/70 font-semibold">Tâches totales</p>
                <div className="mt-4 pt-4 border-t">
                  <div className="flex justify-between text-xs">
                    <span className="text-base-content/60">
                      <span className="font-semibold text-warning">{stats.tasksToDo || 0}</span> à faire
                    </span>
                    <span className="text-base-content/60">
                      <span className="font-semibold text-info">{stats.tasksInProgress || 0}</span> en cours
                    </span>
                    <span className="text-base-content/60">
                      <span className="font-semibold text-success">{stats.tasksDone || 0}</span> terminées
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-base-100 rounded-lg shadow-lg p-6 border-l-4 border-accent relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-accent/10 rounded-full -mr-10 -mt-10"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <MessageSquare size={24} className="text-accent" />
                  <TrendingUp size={20} className="text-accent/50" />
                </div>
                <p className="text-4xl font-bold text-accent mb-2">{stats.comments || 0}</p>
                <p className="text-sm text-base-content/70 font-semibold">Commentaires</p>
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs text-base-content/60">
                    {stats.commentReactions || 0} réaction{stats.commentReactions !== 1 ? 's' : ''} au total
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Statistiques demandes d'assistance et de tâches */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-base-100 rounded-lg shadow-lg p-5 border-l-4 border-info">
              <HelpCircle size={20} className="text-info mb-2" />
              <p className="text-2xl font-bold text-info">{stats.totalAssistanceRequests || 0}</p>
              <p className="text-xs text-base-content/70 mb-3">Demandes d&apos;assistance</p>
              <div className="space-y-1 pt-2 border-t border-base-300">
                <div className="flex justify-between text-xs">
                  <span className="text-base-content/60">En attente:</span>
                  <span className="font-semibold text-warning">{stats.assistanceRequestsPending || 0}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-base-content/60">Résolues:</span>
                  <span className="font-semibold text-success">{stats.assistanceRequestsResolved || 0}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-base-content/60">Rejetées:</span>
                  <span className="font-semibold text-error">{stats.assistanceRequestsRejected || 0}</span>
                </div>
              </div>
            </div>
            <div className="bg-base-100 rounded-lg shadow-lg p-5 border-l-4 border-success">
              <FileText size={20} className="text-success mb-2" />
              <p className="text-2xl font-bold text-success">{stats.attachments || 0}</p>
              <p className="text-xs text-base-content/70">Pièces jointes</p>
            </div>
          </div>
        </>
      )}
    </Wrapper>
  );
}


"use client";

import { useState, useEffect } from "react";
import { updateUserRole, getCurrentUser, getAllUsers } from "../actions";
import { Role, User } from "@prisma/client";
import Wrapper from "../components/Wrapper";
import { toast } from "react-hot-toast";
import Link from "next/link";
import { Users, FileText, RefreshCw } from "lucide-react";
import Image from "next/image";

interface AdminClientProps {
  userRole?: Role;
}

export default function AdminClient({}: AdminClientProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const fetchData = async () => {
    try {
      setRefreshing(true);
      const user = await getCurrentUser();
      setCurrentUser(user);
      
      // Récupérer tous les utilisateurs
      const allUsers = await getAllUsers();
      setUsers(allUsers);
    } catch (error) {
      console.error("Erreur lors du chargement des données:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRoleChange = async (email: string, newRole: Role) => {
    try {
      const success = await updateUserRole(email, newRole);
      if (success) {
        toast.success(`Rôle mis à jour pour ${email}`);
        // Recharger les données sans recharger la page
        await fetchData();
      } else {
        toast.error("Erreur lors de la mise à jour du rôle");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la mise à jour du rôle");
    }
  };

  return (
    <Wrapper userRole={Role.ADMIN}>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Administration</h1>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-1 md:flex gap-4 mb-6">
          <Link 
            href="/admin" 
            className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-center"
          >
            <Users className="w-5 h-5" />
            Gestion des Rôles
          </Link>
          <Link 
            href="/admin/manage-users" 
            className="flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold text-center"
          >
            <Users className="w-5 h-5" />
            Restriction & Suppression
          </Link>
          <Link 
            href="/admin/manage-requests" 
            className="flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold text-center"
          >
            <FileText className="w-5 h-5" />
            Demandes d&apos;Inscription
          </Link>
        </div>
        
        <div className="bg-base-100 p-6 rounded-lg shadow-lg">
          <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-4 sm:gap-0">
            <h2 className="text-xl font-semibold">Utilisateurs</h2>
            <button
              onClick={fetchData}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors w-full sm:w-auto justify-center"
              title="Actualiser la liste des utilisateurs"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:block">{refreshing ? 'Actualisation...' : 'Actualiser'}</span>
            </button>
          </div>
          
          {/* Remplacement du tableau par des cartes pour mobile */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.map((user) => (
              <div key={user.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex flex-col items-start gap-3 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 w-full">
                  {user.imageUrl && (
                    <Image
                      src={user.imageUrl}
                      alt={user.name}
                      width={48}
                      height={48}
                      className="rounded-full flex-shrink-0 w-12 h-12 object-cover"
                    />
                  )}
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 text-lg">{user.name}</p>
                    <p className="text-sm text-gray-500">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className={`px-3 py-1 text-xs font-semibold rounded-full ${
                      user.role === Role.ADMIN
                        ? "bg-purple-100 text-purple-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {user.role}
                  </span>
                  <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                    Actif
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 mt-4 w-full">
                  <button
                    className={`flex-grow sm:flex-grow-0 btn btn-sm ${user.role === Role.USER ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => handleRoleChange(user.email, Role.USER)}
                    disabled={user.email === currentUser?.email}
                  >
                    USER
                  </button>
                  <button
                    className={`flex-grow sm:flex-grow-0 btn btn-sm ${user.role === Role.ADMIN ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => handleRoleChange(user.email, Role.ADMIN)}
                    disabled={user.email === currentUser?.email}
                  >
                    ADMIN
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm">
          <h3 className="font-semibold text-blue-800 mb-2">Instructions :</h3>
          <ul className="list-disc list-inside text-blue-700 space-y-1">
            <li>Modifiez le rôle d&apos;un utilisateur en cliquant sur USER ou ADMIN</li>
            <li>Vous ne pouvez pas modifier votre propre rôle</li>
            <li>Les changements prennent effet immédiatement</li>
            <li>Rechargez la page pour voir les changements dans la navbar</li>
          </ul>
        </div>
      </div>
    </Wrapper>
  );
}

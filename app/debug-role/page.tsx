"use client";

import { useState, useEffect } from "react";
import { getCurrentUser } from "../actions";
import { Role, User } from "@prisma/client";
import Wrapper from "../components/Wrapper";
import { toast } from "react-hot-toast";

export default function DebugRolePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    setLoading(true);
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      console.log("User from getCurrentUser:", currentUser);
    } catch (error) {
      console.error("Error fetching user:", error);
      toast.error("Erreur lors du chargement de l'utilisateur");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  if (loading) {
    return (
      <Wrapper userRole={Role.USER}>
        <div className="flex justify-center items-center h-64">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      </Wrapper>
    );
  }

  return (
    <Wrapper userRole={user?.role || Role.USER}>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Debug - Informations Utilisateur</h1>
        
        <div className="bg-base-100 p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Données utilisateur actuelles :</h2>
          
          {user ? (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="font-semibold">ID:</span>
                <span className="font-mono text-sm">{user.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">Nom:</span>
                <span>{user.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">Email:</span>
                <span>{user.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">Rôle:</span>
                <div className={`badge ${user.role === Role.ADMIN ? 'badge-error' : 'badge-success'}`}>
                  {user.role}
                </div>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">Image URL:</span>
                <span className="font-mono text-sm">{user.imageUrl || 'Aucune'}</span>
              </div>
            </div>
          ) : (
            <div className="text-error">Aucun utilisateur trouvé</div>
          )}
        </div>

        <div className="mt-6 flex gap-4">
          <button 
            className="btn btn-primary"
            onClick={fetchUser}
          >
            Actualiser
          </button>
          <button 
            className="btn btn-secondary"
            onClick={() => window.location.reload()}
          >
            Recharger la page
          </button>
        </div>

        <div className="mt-6 p-4 bg-info/10 rounded-lg">
          <h3 className="font-semibold text-info mb-2">Instructions :</h3>
          <ul className="text-sm space-y-1">
            <li>• Vérifiez que votre rôle est bien ADMIN</li>
            <li>• Si ce n&apos;est pas le cas, utilisez la page /promote-admin</li>
            <li>• Cliquez sur &quot;Actualiser&quot; pour recharger les données</li>
            <li>• Cliquez sur &quot;Recharger la page&quot; pour forcer le refresh</li>
          </ul>
        </div>
      </div>
    </Wrapper>
  );
}

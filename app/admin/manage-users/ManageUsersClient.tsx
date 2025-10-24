"use client"

import { useState, useEffect } from "react";
import { Role, User } from "@prisma/client";
import Wrapper from "@/app/components/Wrapper";
import { toast } from "react-hot-toast";
import Link from "next/link";
import { Users, ArrowLeft, RefreshCw, Lock, Unlock, Trash2, AlertCircle, Shield } from "lucide-react";
import Image from "next/image";

interface ManageUsersClientProps {
  userRole: Role;
}

interface UserWithRestriction extends User {
  restricted: boolean;
}

export default function ManageUsersClient({ userRole }: ManageUsersClientProps) {
  const [users, setUsers] = useState<UserWithRestriction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setRefreshing(true);
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Erreur lors du chargement des utilisateurs");
      const data = await res.json();
      setUsers(data.users || []);

      // Get current user
      const response = await fetch("/api/user/role");
      if (response.ok) {
        const userData = await response.json();
        setCurrentUser(userData.user);
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du chargement des utilisateurs");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRestrict = async (userId: string, isCurrentlyRestricted: boolean) => {
    setActionLoading(userId);
    try {
      const res = await fetch("/api/admin/delete-user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          restricted: !isCurrentlyRestricted,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        console.error('API Error:', error);
        throw new Error(error.error || "Erreur lors de la restriction");
      }

      const action = !isCurrentlyRestricted ? "Utilisateur restreint" : "Utilisateur derestreint";
      toast.success(action);
      await fetchData();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error(
        error instanceof Error ? error.message : "Erreur lors de la restriction"
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (userId: string) => {
    setActionLoading(userId);
    try {
      const res = await fetch("/api/admin/delete-user", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erreur lors de la suppression");
      }

      toast.success("Utilisateur supprimé avec succès");
      setDeleteConfirm(null);
      await fetchData();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error(
        error instanceof Error ? error.message : "Erreur lors de la suppression"
      );
    } finally {
      setActionLoading(null);
    }
  };

  const restrictedUsers = users.filter((u) => u.restricted);
  const activeUsers = users.filter((u) => !u.restricted);

  return (
    <Wrapper userRole={userRole}>
      <div className="w-full max-w-6xl mx-auto p-6">
        {/* Back Button */}
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 mb-6 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour à l&apos;administration
        </Link>

        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-600" />
            <h1 className="text-4xl font-bold">Gestion des Utilisateurs</h1>
          </div>
          <button
            onClick={fetchData}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            title="Actualiser la liste des utilisateurs"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Actualisation..." : "Actualiser"}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span className="text-gray-700">Utilisateurs actifs:</span>
              <span className="font-bold text-2xl text-blue-600">{activeUsers.length}</span>
            </div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-red-600" />
              <span className="text-gray-700">Utilisateurs restreints:</span>
              <span className="font-bold text-2xl text-red-600">{restrictedUsers.length}</span>
            </div>
          </div>
        </div>

        {/* Active Users */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-600" />
            Utilisateurs Actifs
          </h2>

          {activeUsers.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">Aucun utilisateur actif</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Email</th>
                    <th>Rôle</th>
                    <th>Statut</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeUsers.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          {user.imageUrl && (
                            <Image
                              src={user.imageUrl}
                              alt={user.name}
                              width={32}
                              height={32}
                              className="rounded-full"
                            />
                          )}
                          <span>{user.name}</span>
                        </div>
                      </td>
                      <td>{user.email}</td>
                      <td>
                        <div
                          className={`badge ${
                            user.role === Role.ADMIN ? "badge-error" : "badge-success"
                          }`}
                        >
                          {user.role}
                        </div>
                      </td>
                      <td>
                        <div className="badge badge-info">Actif</div>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              handleRestrict(user.id, user.restricted)
                            }
                            disabled={
                              user.email === currentUser?.email ||
                              actionLoading === user.id
                            }
                            className="flex items-center gap-1 px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50 transition-colors text-sm"
                            title="Restreindre cet utilisateur"
                          >
                            {actionLoading === user.id ? (
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <Lock className="w-4 h-4" />
                            )}
                            Restreindre
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(user.id)}
                            disabled={
                              user.email === currentUser?.email ||
                              actionLoading === user.id
                            }
                            className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors text-sm"
                            title="Supprimer cet utilisateur"
                          >
                            {actionLoading === user.id ? (
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Restricted Users */}
        {restrictedUsers.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Lock className="w-6 h-6 text-red-600" />
              Utilisateurs Restreints
            </h2>

            <div className="space-y-3">
              {restrictedUsers.map(user => (
                <div
                  key={user.id}
                  className="bg-red-50 border-2 border-red-200 rounded-lg p-4 hover:shadow-lg transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    {/* User Info */}
                    <div className="flex items-start gap-3 flex-1">
                      {user.imageUrl && (
                        <Image
                          src={user.imageUrl}
                          alt={user.name}
                          width={48}
                          height={48}
                          className="rounded-full flex-shrink-0"
                        />
                      )}
                      <div className="flex-1">
                        <p className="font-semibold text-lg text-gray-900">{user.name}</p>
                        <p className="text-sm text-gray-600 mb-2">{user.email}</p>
                        <div className="flex gap-2">
                          <div
                            className={`badge ${
                              user.role === Role.ADMIN
                                ? "badge-error"
                                : "badge-success"
                            }`}
                          >
                            {user.role}
                          </div>
                          <div className="badge badge-warning">Restreint</div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() =>
                          handleRestrict(user.id, user.restricted)
                        }
                        disabled={
                          user.email === currentUser?.email ||
                          actionLoading === user.id
                        }
                        className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                        title="Derestreindre cet utilisateur"
                      >
                        {actionLoading === user.id ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <Unlock className="w-4 h-4" />
                        )}
                        Derestreindre
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(user.id)}
                        disabled={
                          user.email === currentUser?.email ||
                          actionLoading === user.id
                        }
                        className="flex items-center gap-1 px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                        title="Supprimer cet utilisateur"
                      >
                        {actionLoading === user.id ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                        Supprimer
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-red-600" />
              <h3 className="text-xl font-bold">Confirmer la suppression</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Êtes-vous sûr de vouloir supprimer cet utilisateur ? Cette action est irréversible et
              supprimera également tous ses projets et tâches.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  handleDelete(deleteConfirm);
                }}
                disabled={actionLoading !== null}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {actionLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Suppression...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Supprimer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </Wrapper>
  );
}

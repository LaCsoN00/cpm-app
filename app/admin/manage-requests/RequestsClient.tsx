"use client"

import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { CheckCircle, XCircle, Clock, AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import Wrapper from '@/app/components/Wrapper'
import { Role } from '@prisma/client'

interface UserRequest {
  id: string
  email: string
  fullName: string
  createdAt: string
  status: string
}

interface RequestsClientProps {
  userRole: Role
}

export default function RequestsClient({ userRole }: RequestsClientProps) {
  const [requests, setRequests] = useState<UserRequest[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [selectedRole, setSelectedRole] = useState<{ [key: string]: string }>({})
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    fetchRequests()
  }, [])

  const fetchRequests = async () => {
    try {
      setRefreshing(true)
      const res = await fetch('/api/admin/requests')
      if (!res.ok) throw new Error('Erreur lors de la récupération des demandes')
      const data = await res.json()
      setRequests(data.requests || [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue')
    } finally {
      setRefreshing(false)
    }
  }

  const handleApprove = async (requestId: string, email: string) => {
    setActionLoading(requestId)
    try {
      const role = selectedRole[requestId] || 'USER'
      const res = await fetch('/api/admin/approve-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          action: 'approve',
          role,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || 'Erreur lors de l\'approbation')
      }

      toast.success(`Utilisateur ${email} approuvé`)
      await fetchRequests()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue')
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (requestId: string, email: string) => {
    setActionLoading(requestId)
    try {
      const res = await fetch('/api/admin/approve-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          action: 'reject',
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || 'Erreur lors du rejet')
      }

      toast.success(`Demande de ${email} rejetée`)
      await fetchRequests()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue')
    } finally {
      setActionLoading(null)
    }
  }

  const pendingRequests = requests.filter(r => r.status === 'pending')
  const approvedRequests = requests.filter(r => r.status === 'approved')
  const rejectedRequests = requests.filter(r => r.status === 'rejected')

  return (
    <Wrapper userRole={userRole}>
      <div className="w-full max-w-6xl mx-auto p-6">
        {/* Bouton Retour */}
        <Link 
          href="/admin" 
          className="inline-flex items-center gap-2 mb-6 px-4 py-2 text-base-content/70 hover:text-base-content hover:bg-base-200 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </Link>

        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold text-base-content">Gestion des inscriptions</h1>
          <button
            onClick={fetchRequests}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            title="Actualiser la liste des demandes"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:block">{refreshing ? 'Actualisation...' : 'Actualiser'}</span>
          </button>
        </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            <span className="text-base-content">En attente:</span>
            <span className="font-bold text-2xl text-yellow-600 dark:text-yellow-400">{pendingRequests.length}</span>
          </div>
        </div>
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            <span className="text-base-content">Approuvés:</span>
            <span className="font-bold text-2xl text-green-600 dark:text-green-400">{approvedRequests.length}</span>
          </div>
        </div>
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <span className="text-base-content">Rejetés:</span>
            <span className="font-bold text-2xl text-red-600 dark:text-red-400">{rejectedRequests.length}</span>
          </div>
        </div>
      </div>

      {/* Pending Requests */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-base-content">
          <Clock className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
          Demandes en attente
        </h2>

        {pendingRequests.length === 0 ? (
          <div className="bg-base-200 border border-base-300 rounded-lg p-8 text-center">
            <AlertCircle className="w-12 h-12 text-base-content/50 mx-auto mb-2" />
            <p className="text-base-content/70">Aucune demande en attente</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingRequests.map(request => (
              <div key={request.id} className="bg-base-200 border-2 border-yellow-500/30 rounded-lg p-6 hover:shadow-xl transition-all hover:border-yellow-500/50">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                  {/* Infos utilisateur */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                          {request.fullName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-base-content">{request.fullName}</h3>
                        <p className="text-sm text-base-content/70">{request.email}</p>
                      </div>
                    </div>
                    <p className="text-xs text-base-content/50 ml-15">
                      📅 Demandé le {new Date(request.createdAt).toLocaleDateString('fr-FR', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-semibold text-base-content whitespace-nowrap">Rôle:</label>
                      <select
                        value={selectedRole[request.id] || 'USER'}
                        onChange={(e) => setSelectedRole(prev => ({
                          ...prev,
                          [request.id]: e.target.value
                        }))}
                        className="px-4 py-2 border-2 border-base-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium bg-base-100 text-base-content hover:border-base-content/30 transition-colors cursor-pointer"
                      >
                        <option value="USER">👤 Utilisateur</option>
                        <option value="ADMIN">👨‍💼 Admin</option>
                        <option value="CONSULTANT">💼 Consultant</option>
                      </select>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(request.id, request.email)}
                        disabled={actionLoading === request.id}
                        className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm hover:shadow-md"
                      >
                        {actionLoading === request.id ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>En cours...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            <span>Approuver</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleReject(request.id, request.email)}
                        disabled={actionLoading === request.id}
                        className="flex items-center gap-2 px-5 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm hover:shadow-md"
                      >
                        {actionLoading === request.id ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>En cours...</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4" />
                            <span>Rejeter</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Approved Requests */}
      {approvedRequests.length > 0 && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-base-content">
            <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            Utilisateurs approuvés
          </h2>
          <div className="space-y-3">
            {approvedRequests.map(request => (
              <div key={request.id} className="bg-green-500/10 border-2 border-green-500/30 rounded-lg p-6 hover:shadow-md transition-shadow">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-lg font-bold text-base-content">{request.fullName}</p>
                    <p className="text-sm text-base-content/70 mt-1">{request.email}</p>
                  </div>
                  <span className="px-3 py-1 bg-green-600 text-white text-xs font-semibold rounded-full">Approuvé</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rejected Requests */}
      {rejectedRequests.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-base-content">
            <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
            Demandes rejetées
          </h2>
          <div className="space-y-3">
            {rejectedRequests.map(request => (
              <div key={request.id} className="bg-red-500/10 border-2 border-red-500/30 rounded-lg p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-lg font-bold text-base-content">{request.fullName}</p>
                    <p className="text-sm text-base-content/70 mt-1">{request.email}</p>
                  </div>
                  <span className="px-3 py-1 bg-red-600 text-white text-xs font-semibold rounded-full whitespace-nowrap">Rejeté</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    </Wrapper>
  )
}

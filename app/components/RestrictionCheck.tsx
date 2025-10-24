"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'react-hot-toast'

export function RestrictionCheck() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkRestriction = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) return

        // Vérifier auprès de l'API si l'utilisateur est restreint
        const response = await fetch('/api/user/role')
        
        if (response.status === 403) {
          const data = await response.json()
          
          if (data.restricted || data.error === 'Account restricted') {
            // L'utilisateur est restreint
            toast.error('Votre compte a été restreint. Accès refusé.')
            
            // Déconnecter l'utilisateur
            await supabase.auth.signOut()
            
            // Rediriger vers la page de connexion
            router.push('/sign-in')
            return
          }
          
          if (data.error === 'User not found') {
            // L'utilisateur a été supprimé
            toast.error('Votre compte a été supprimé.')
            
            // Déconnecter l'utilisateur
            await supabase.auth.signOut()
            
            // Rediriger vers la page de connexion
            router.push('/sign-in')
            return
          }
        }
      } catch (error) {
        console.error('Error checking restriction:', error)
      }
    }

    // Vérifier au chargement
    checkRestriction()

    // Configurer un interval pour vérifier régulièrement (toutes les 30 secondes)
    const interval = setInterval(checkRestriction, 30000)

    return () => clearInterval(interval)
  }, [supabase.auth, router])

  return null
}

"use client"

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { User } from '@supabase/supabase-js'
import { Role } from '@prisma/client'

interface UserWithRole {
  user: User | null
  role: Role | null
  imageUrl: string | null
  name: string | null
  loading: boolean
}

export function useSupabaseUserWithRole() {
  const [userData, setUserData] = useState<UserWithRole>({
    user: null,
    role: null,
    imageUrl: null,
    name: null,
    loading: true
  })
  const supabase = createClient()

  useEffect(() => {
    const getUserWithRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          // Récupérer le rôle depuis la base de données
          const response = await fetch('/api/user/role', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
            }
          })
          
          if (response.ok) {
            const data = await response.json()
            const { role, imageUrl, name } = data.user || data
            setUserData({ user, role, imageUrl, name, loading: false })
          } else {
            setUserData({ user, role: Role.USER, imageUrl: null, name: null, loading: false })
          }
        } else {
          setUserData({ user: null, role: null, imageUrl: null, name: null, loading: false })
        }
      } catch (error) {
        console.error('Error getting user with role:', error)
        setUserData({ user: null, role: null, imageUrl: null, name: null, loading: false })
      }
    }

    getUserWithRole()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          // Récupérer le rôle lors du changement d'état
          try {
            const response = await fetch('/api/user/role', {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${session.access_token}`
              }
            })
            
            if (response.ok) {
              const data = await response.json()
              const { role, imageUrl, name } = data.user || data
              setUserData({ user: session.user, role, imageUrl, name, loading: false })
            } else {
              setUserData({ user: session.user, role: Role.USER, imageUrl: null, name: null, loading: false })
            }
          } catch {
            setUserData({ user: session.user, role: Role.USER, imageUrl: null, name: null, loading: false })
          }
        } else {
          setUserData({ user: null, role: null, imageUrl: null, name: null, loading: false })
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [supabase.auth])

  return userData
}

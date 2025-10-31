"use client"

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import Link from 'next/link'
import { Eye, EyeOff, Mail, Lock, User, ArrowRight } from 'lucide-react'
import Image from 'next/image'

interface SupabaseAuthProps {
  mode: 'signin' | 'signup'
}

export default function SupabaseAuth({ mode }: SupabaseAuthProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [useMagicLink] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    setIsAnimating(true)
    const timer = setTimeout(() => setIsAnimating(false), 1000)
    return () => clearTimeout(timer)
  }, [mode])

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) throw error

      setEmailSent(true)
      toast.success('Lien magique envoyé ! Vérifiez votre email.')
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()

    if (useMagicLink) {
      return handleSendMagicLink(e)
    }

    setLoading(true)

    try {
      if (mode === 'signup') {
        // First, create a user request (pending approval)
        const requestRes = await fetch('/api/auth/create-request', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            fullName: name,
            password,
          }),
        })

        if (!requestRes.ok) {
          const error = await requestRes.json()
          throw new Error(error.message || 'Erreur lors de la création de la demande')
        }

        toast.success('Demande d\'inscription créée ! Un administrateur examinera votre demande.')
        router.push('/sign-in')
      } else {
        // Check if user is approved
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) throw error

        if (data.user) {
          // Check if user is approved in the database
          const checkRes = await fetch('/api/auth/check-approval', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: data.user.email,
            }),
          })

          const { approved, restricted } = await checkRes.json()

          // Check if user is restricted
          if (restricted) {
            // Sign out the user immediately
            await supabase.auth.signOut()
            toast.error('Votre compte a été restreint. L\'accès est refusé.')
            return
          }

          if (!approved) {
            // Sign out the user immediately
            await supabase.auth.signOut()
            toast.error('Votre compte n\'a pas encore été approuvé par un administrateur.')
            return
          }

          toast.success('Connexion réussie !')
          router.push('/')
        }
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  if (emailSent && useMagicLink) {
    return (
      <div className="w-full max-w-md mx-auto px-4 sm:px-0">
        <div className="transition-all duration-1000 transform scale-100 opacity-100">
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 p-5 sm:p-6 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-black/10"></div>
              <div className="relative z-10">
                <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3 shadow-lg">
                  <Mail className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-blue-600" />
                </div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-0.5 sm:mb-1">Vérifiez votre email</h1>
                <p className="text-white/90 text-xs sm:text-sm">Un lien magique a été envoyé à {email}</p>
              </div>
            </div>
            <div className="p-4 sm:p-6 lg:p-8 text-center">
              <p className="text-gray-600 text-xs sm:text-sm mb-3 sm:mb-4">Cliquez sur le lien dans votre email pour continuer.</p>
              <button
                onClick={() => {
                  setEmailSent(false)
                  setEmail('')
                }}
                className="text-blue-600 hover:text-blue-700 font-semibold transition-colors text-xs sm:text-sm"
              >
                Retour
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md mx-auto px-4 sm:px-0">

      <div className={`transition-all duration-1000 ${isAnimating ? 'transform scale-105 opacity-0' : 'transform scale-100 opacity-100'}`}>
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
          {/* Header */}
          <div className="bg-[#1E3A8A] p-5 sm:p-6 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="relative z-10">
              <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3 shadow-lg">
                <Image 
                  src="/icon-512x512.png" 
                  alt="CPM Project Logo" 
                  width={32} 
                  height={32}
                  className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8"
                />
              </div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-0.5 sm:mb-1">
                {mode === 'signin' ? 'Bienvenue !' : 'Rejoignez-nous !'}
              </h1>
              <p className="text-white/90 text-xs sm:text-sm">
                {mode === 'signin' 
                  ? 'Connectez-vous à votre compte CPM Project' 
                  : 'Créez votre compte et commencez à collaborer'
                }
              </p>
            </div>
          </div>

          {/* Form */}
          <div className="p-4 sm:p-6 lg:p-8">
            <form onSubmit={handleAuth} className="space-y-3 sm:space-y-4 lg:space-y-5">
              {mode === 'signup' && (
                <div className="form-group">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-1.5">
                    Nom complet
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Votre nom complet"
                      className="w-full pl-10 pr-4 py-2 sm:py-2.5 text-xs sm:text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white text-gray-900"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required={mode === 'signup'}
                    />
                  </div>
                </div>
              )}
              
              <div className="form-group">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-1.5">
                  Adresse email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="email"
                    placeholder="votre@email.com"
                    className="w-full pl-10 pr-4 py-2 sm:py-2.5 text-xs sm:text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white text-gray-900"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-1.5">
                  Mot de passe
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2 sm:py-2.5 text-xs sm:text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white text-gray-900"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              
              
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#1E3A8A] text-white py-2 sm:py-2.5 px-6 rounded-lg font-semibold text-xs sm:text-sm hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-xs sm:text-sm">Chargement...</span>
                  </>
                ) : (
                  <>
                        <span className="text-xs sm:text-sm">{mode === 'signin' ? 'Se connecter' : 'Créer mon compte'}</span>
                        <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </>
                )}
              </button>
            </form>
            
            {/* Divider */}
            <div className="relative my-3 sm:my-4 lg:my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-xs sm:text-sm">
                <span className="px-2 sm:px-3 bg-white text-gray-500">ou</span>
              </div>
            </div>
            
            {/* Switch Mode */}
            <div className="text-center">
              <p className="text-gray-600 text-xs sm:text-sm">
                {mode === 'signin' ? (
                  <>
                    Pas encore de compte ?{' '}
                    <Link href="/sign-up" className="text-blue-600 hover:text-blue-700 font-semibold transition-colors">
                      Créer un compte
                    </Link>
                  </>
                ) : (
                  <>
                    Déjà un compte ?{' '}
                    <Link href="/sign-in" className="text-blue-600 hover:text-blue-700 font-semibold transition-colors">
                      Se connecter
                    </Link>
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

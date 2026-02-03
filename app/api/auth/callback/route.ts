import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { Role } from '@prisma/client'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(
      new URL(`/sign-in?error=${encodeURIComponent(error)}`, request.url)
    )
  }

  if (code) {
    const supabase = await createClient()

    try {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

      if (exchangeError) {
        return NextResponse.redirect(
          new URL(
            `/sign-in?error=${encodeURIComponent(exchangeError.message)}`,
            request.url
          )
        )
      }

      // Vérifier le rôle de l'utilisateur et rediriger en conséquence
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: user.email },
            select: { role: true }
          })
          
          if (dbUser?.role === Role.ADMIN) {
            return NextResponse.redirect(new URL('/admin/dashboard', request.url))
          }
        } catch (error) {
          console.error('Error fetching user role:', error)
          // En cas d'erreur, rediriger vers la page d'accueil normale
        }
      }

      return NextResponse.redirect(new URL('/', request.url))
    } catch (error) {
      console.error('Auth callback error:', error)
      return NextResponse.redirect(
        new URL(
          `/sign-in?error=${encodeURIComponent('Une erreur est survenue')}`,
          request.url
        )
      )
    }
  }

  return NextResponse.redirect(new URL('/sign-in', request.url))
}

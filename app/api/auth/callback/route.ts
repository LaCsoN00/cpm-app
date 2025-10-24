import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

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

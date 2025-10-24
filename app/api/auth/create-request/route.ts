import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { email, fullName, password } = await request.json()

    console.log('📝 [CREATE REQUEST] Reçu:', { email, fullName, hasPassword: !!password })

    // Validate inputs
    if (!email || !fullName || !password) {
      console.log('❌ [CREATE REQUEST] Validation échouée')
      return NextResponse.json(
        { message: 'Email, nom et mot de passe sont requis' },
        { status: 400 }
      )
    }

    // Check if request already exists
    const existingRequest = await prisma.userRequest.findUnique({
      where: { email },
    })

    if (existingRequest && existingRequest.status === 'pending') {
      console.log('❌ [CREATE REQUEST] Demande déjà en attente pour:', email)
      return NextResponse.json(
        { message: 'Une demande est déjà en attente pour cet email' },
        { status: 400 }
      )
    }

    // Check if user already exists in Supabase or database
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      console.log('❌ [CREATE REQUEST] Utilisateur existe déjà:', email)
      return NextResponse.json(
        { message: 'Un utilisateur avec cet email existe déjà' },
        { status: 400 }
      )
    }

    // Create user request
    const newRequest = await prisma.userRequest.create({
      data: {
        email,
        fullName,
        password,
        status: 'pending',
      },
    })

    console.log('✅ [CREATE REQUEST] Demande créée:', newRequest.id)

    return NextResponse.json(
      { message: 'Demande d\'inscription créée avec succès', request: newRequest },
      { status: 201 }
    )
  } catch (error) {
    console.error('❌ [CREATE REQUEST] Erreur:', error)
    return NextResponse.json(
      { message: 'Une erreur est survenue', error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

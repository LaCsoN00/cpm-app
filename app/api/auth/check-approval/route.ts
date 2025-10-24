import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { message: 'Email est requis' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      return NextResponse.json(
        { approved: false, restricted: false, message: 'Utilisateur non trouvé' },
        { status: 404 }
      )
    }

    // Les admins sont automatiquement approuvés (ils sont les approbateurs)
    const approved = user.approved || user.role === 'ADMIN'
    const restricted = user.restricted
    
    return NextResponse.json({ approved, restricted })
  } catch (error) {
    console.error('Error checking approval:', error)
    return NextResponse.json(
      { message: 'Une erreur est survenue' },
      { status: 500 }
    )
  }
}

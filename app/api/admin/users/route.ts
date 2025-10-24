import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import prisma from '@/lib/prisma'
import { Role } from '@prisma/client'

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Vérifier si l'utilisateur est admin
    const dbUser = await prisma.user.findUnique({
      where: { email: user.email! },
      select: { role: true }
    })

    if (!dbUser || dbUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Récupérer tous les utilisateurs
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        imageUrl: true,
        approved: true,
        restricted: true,
      },
      orderBy: {
        name: 'asc'
      }
    })

    return NextResponse.json({ users }, { status: 200 })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Vérifier si l'utilisateur est admin
    const dbUser = await prisma.user.findUnique({
      where: { email: user.email! },
      select: { role: true }
    })

    if (!dbUser || dbUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { userId, role } = await request.json()

    if (!userId || !role || !Object.values(Role).includes(role)) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
    }

    // Mettre à jour le rôle
    await prisma.user.update({
      where: { id: userId },
      data: { role }
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error updating user role:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Récupérer l'utilisateur depuis la base de données
    const dbUser = await prisma.user.findUnique({
      where: { email: user.email! },
      select: { id: true, role: true, imageUrl: true, name: true, approved: true, restricted: true }
    })

    // Vérifier si l'utilisateur existe
    if (!dbUser) {
      return NextResponse.json({ 
        error: 'User not found',
        restricted: true
      }, { status: 403 })
    }

    // Vérifier si l'utilisateur est restreint
    if (dbUser.restricted) {
      return NextResponse.json({ 
        error: 'Account restricted',
        restricted: true
      }, { status: 403 })
    }

    return NextResponse.json({ 
      user: {
        id: dbUser.id,
        role: dbUser.role, 
        imageUrl: dbUser.imageUrl,
        name: dbUser.name,
        email: user.email,
        approved: dbUser.approved
      }
    }, { status: 200 })
  } catch (error) {
    console.error('Error fetching user role:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

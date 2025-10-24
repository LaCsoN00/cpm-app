import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { Role } from '@prisma/client'

export async function GET() {
  try {
    console.log('📋 [FETCH REQUESTS] Tentative de récupération des demandes')
    
    const supabase = await createClient()

    // Check if user is admin
    const { data: { user: currentUser } } = await supabase.auth.getUser()

    if (!currentUser) {
      console.log('❌ [FETCH REQUESTS] Utilisateur non authentifié')
      return NextResponse.json(
        { message: 'Non authentifié' },
        { status: 401 }
      )
    }

    console.log('👤 [FETCH REQUESTS] Utilisateur:', currentUser.email)

    const adminUser = await prisma.user.findUnique({
      where: { email: currentUser.email },
    })

    console.log('🔍 [FETCH REQUESTS] Admin user:', { 
      found: !!adminUser, 
      role: adminUser?.role,
      approved: adminUser?.approved 
    })

    if (!adminUser || adminUser.role !== Role.ADMIN) {
      console.log('❌ [FETCH REQUESTS] Accès refusé - pas admin')
      return NextResponse.json(
        { message: 'Accès refusé. Seuls les administrateurs peuvent voir les demandes.' },
        { status: 403 }
      )
    }

    const requests = await prisma.userRequest.findMany({
      orderBy: { createdAt: 'desc' },
    })

    console.log('✅ [FETCH REQUESTS] Demandes trouvées:', requests.length)
    requests.forEach(r => console.log(`  - ${r.email} (${r.status})`))

    return NextResponse.json({ requests })
  } catch (error) {
    console.error('❌ [FETCH REQUESTS] Erreur:', error)
    return NextResponse.json(
      { message: 'Une erreur est survenue', error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

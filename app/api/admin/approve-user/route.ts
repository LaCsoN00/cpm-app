import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { Role } from '@prisma/client'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    // Check if user is admin
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    
    if (!currentUser) {
      return NextResponse.json(
        { message: 'Non authentifié' },
        { status: 401 }
      )
    }

    const adminUser = await prisma.user.findUnique({
      where: { email: currentUser.email },
    })

    if (!adminUser || adminUser.role !== Role.ADMIN) {
      return NextResponse.json(
        { message: 'Accès refusé. Seuls les administrateurs peuvent approuver les utilisateurs.' },
        { status: 403 }
      )
    }

    const { requestId, action, role = Role.USER } = await request.json()

    if (!requestId || !action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { message: 'requestId et action (approve/reject) sont requis' },
        { status: 400 }
      )
    }

    const userRequest = await prisma.userRequest.findUnique({
      where: { id: requestId },
    })

    if (!userRequest) {
      return NextResponse.json(
        { message: 'Demande non trouvée' },
        { status: 404 }
      )
    }

    if (action === 'reject') {
      // Mark request as rejected
      await prisma.userRequest.update({
        where: { id: requestId },
        data: { status: 'rejected' },
      })

      return NextResponse.json({
        message: 'Demande rejetée avec succès',
      })
    }

    // Approve the user
    // Create Supabase user with le mot de passe stocké
    const adminSupabase = createAdminClient()
    
    console.log('🔐 [APPROVE] Tentative de création de compte Supabase:');
    console.log(`   Email: ${userRequest.email}`);
    console.log(`   Mot de passe reçu: ${userRequest.password ? 'OUI' : 'NON'}`);
    console.log(`   Longueur du mot de passe: ${userRequest.password?.length}`);
    
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email: userRequest.email,
      password: userRequest.password,
      email_confirm: true,
      user_metadata: {
        full_name: userRequest.fullName,
      },
    })

    if (authError || !authData.user) {
      console.error('❌ [APPROVE] Erreur Supabase:', authError?.message || authError);
      return NextResponse.json(
        { 
          message: 'Erreur lors de la création du compte utilisateur',
          details: authError?.message || 'Erreur inconnue'
        },
        { status: 500 }
      )
    }
    
    console.log('✅ [APPROVE] Utilisateur Supabase créé:', authData.user.id);

    // Create database user
    const dbUser = await prisma.user.create({
      data: {
        id: authData.user.id,
        name: userRequest.fullName,
        email: userRequest.email,
        role: role as Role,
        approved: true,
      },
    })

    // Mark request as approved
    await prisma.userRequest.update({
      where: { id: requestId },
      data: { status: 'approved' },
    })

    return NextResponse.json({
      message: 'Utilisateur approuvé avec succès',
      user: dbUser,
    })
  } catch (error) {
    console.error('Error approving user:', error)
    return NextResponse.json(
      { message: 'Une erreur est survenue' },
      { status: 500 }
    )
  }
}

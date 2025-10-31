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

    // APPROVE action
    const adminSupabase = createAdminClient();
    let authUserId: string;

    // 1. Attempt to create Supabase user
    console.log('🔐 [APPROVE] Tentative de création ou de recherche de compte Supabase:');
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email: userRequest.email,
      password: userRequest.password,
      email_confirm: true,
      user_metadata: {
        full_name: userRequest.fullName,
      },
    });

    if (authError) {
      if (authError.status === 409) {
        console.log('⚠️ [APPROVE] Utilisateur déjà enregistré dans Supabase. Récupération de l\'utilisateur existant...');
        // User already exists, fetch their ID
        const { data: existingUsers, error: listError } = await adminSupabase.auth.admin.listUsers({
          page: 1,
          perPage: 100, // Augmenter le nombre pour s'assurer de trouver l'utilisateur
        });

        const user = existingUsers?.users.find(u => u.email === userRequest.email);

        if (listError || !user) {
          console.error('❌ [APPROVE] Erreur lors de la récupération de l\'utilisateur existant ou utilisateur non trouvé après erreur 409:', listError?.message || listError);
          return NextResponse.json(
            {
              message: 'Erreur lors de la récupération du compte utilisateur existant',
              details: listError?.message || 'Utilisateur existant non trouvé'
            },
            { status: 500 }
          );
        }
        authUserId = user.id;
        console.log('✅ [APPROVE] Utilisateur Supabase existant trouvé:', authUserId);
      } else {
        console.error('❌ [APPROVE] Erreur Supabase lors de la création ou de la recherche:', authError.message);
        return NextResponse.json(
          {
            message: 'Erreur lors de la création ou de la vérification du compte utilisateur',
            details: authError.message
          },
          { status: 500 }
        );
      }
    } else if (authData.user) {
      authUserId = authData.user.id;
      console.log('✅ [APPROVE] Nouvel utilisateur Supabase créé:', authUserId);
    } else {
        console.error('❌ [APPROVE] Erreur inconnue: ni erreur, ni utilisateur Supabase créé.');
        return NextResponse.json(
            {
                message: 'Une erreur inattendue est survenue lors de la gestion de l\'utilisateur Supabase.',
                details: 'Aucun utilisateur créé et aucune erreur spécifique.'
            },
            { status: 500 }
        );
    }

    // 2. Update or create user in Prisma database
    const dbUser = await prisma.user.upsert({
      where: { email: userRequest.email },
      update: {
        name: userRequest.fullName,
        role: role as Role,
        approved: true,
      },
      create: {
        id: authUserId,
        name: userRequest.fullName,
        email: userRequest.email,
        role: role as Role,
        approved: true,
      },
    });

    console.log('✅ [APPROVE] Utilisateur Prisma mis à jour/créé:', dbUser.id);

    // Mark request as approved
    await prisma.userRequest.update({
      where: { id: requestId },
      data: { status: 'approved' },
    });

    return NextResponse.json({
      message: 'Utilisateur approuvé avec succès',
      user: dbUser,
    });
  } catch (error) {
    console.error('Error approving user:', error)
    return NextResponse.json(
      { message: 'Une erreur est survenue' },
      { status: 500 }
    )
  }
}

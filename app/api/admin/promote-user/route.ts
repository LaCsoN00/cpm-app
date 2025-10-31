import { PrismaClient, Role } from '@prisma/client';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/server';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    // Sécurité: Vérifier une clé secrète dans les en-têtes (pour éviter un accès non autorisé)
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.ADMIN_PROMOTION_SECRET_KEY}`) {
      return NextResponse.json({ message: 'Accès non autorisé' }, { status: 401 });
    }

    const { email, name, password_raw } = await request.json();

    if (!email || !name || !password_raw) {
      return NextResponse.json({ message: 'Email, nom et mot de passe sont requis' }, { status: 400 });
    }

    // Vérifier si les variables d'environnement Supabase sont définies
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Erreur: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ne sont pas définies.");
      return NextResponse.json({ message: 'Configuration Supabase manquante' }, { status: 500 });
    }

    const supabase = createAdminClient();

    let authUserId: string;
    let userImageUrl: string | null = null;

    // Tenter de récupérer l'utilisateur Supabase existant par email
    const { data: existingUsersData, error: listUsersError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 100, // Augmenter le nombre pour s'assurer de trouver l'utilisateur
    });

    if (listUsersError) {
      throw new Error(`Erreur lors de la récupération des utilisateurs Supabase: ${listUsersError.message}`);
    }

    const existingUserAuthData = existingUsersData.users.find(u => u.email === email);

    if (existingUserAuthData) {
      // L'utilisateur existe déjà dans Supabase Auth, le mettre à jour
      console.log(`L'utilisateur ${email} existe déjà dans Supabase Auth. Mise à jour...`);
      const { data: updateAuthData, error: updateAuthError } = await supabase.auth.admin.updateUserById(
        existingUserAuthData.id,
        {
          password: password_raw,
          email_confirm: true, // Correction ici
          user_metadata: { name },
        }
      );
      if (updateAuthError) {
        throw new Error(`Erreur lors de la mise à jour de l'utilisateur Supabase: ${updateAuthError.message}`);
      }
      if (!updateAuthData.user) {
        throw new Error("Aucun utilisateur Supabase retourné après la mise à jour.");
      }
      authUserId = updateAuthData.user.id;
      userImageUrl = updateAuthData.user.user_metadata?.avatar_url || null;

    } else {
      // L'utilisateur n'existe pas dans Supabase Auth, le créer
      console.log(`L'utilisateur ${email} n'existe pas dans Supabase Auth. Création...`);
      const { data: createAuthData, error: createAuthError } = await supabase.auth.admin.createUser({
        email,
        password: password_raw,
        email_confirm: true, // Correction ici
        user_metadata: { name },
      });

      if (createAuthError) {
        throw new Error(`Erreur lors de la création de l'utilisateur Supabase: ${createAuthError.message}`);
      }
      if (!createAuthData.user) {
        throw new Error("Aucun utilisateur Supabase retourné après la création.");
      }
      authUserId = createAuthData.user.id;
      userImageUrl = createAuthData.user.user_metadata?.avatar_url || null;
    }

    // Créer/mettre à jour l'utilisateur dans la base de données Prisma avec le rôle ADMIN et approuvé
    await prisma.user.upsert({
      where: { email },
      update: { role: Role.ADMIN, approved: true, name, imageUrl: userImageUrl },
      create: {
        id: authUserId,
        email,
        name,
        imageUrl: userImageUrl,
        role: Role.ADMIN,
        approved: true,
      },
    });

    return NextResponse.json({ message: `L'utilisateur ${email} a été créé/promu administrateur et approuvé avec succès.` });

  } catch (error) {
    console.error(`Erreur lors de la promotion de l'utilisateur en administrateur:`, error);
    return NextResponse.json({ message: 'Une erreur est survenue', error: (error instanceof Error) ? error.message : String(error) }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

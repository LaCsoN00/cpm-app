import { PrismaClient, Role } from '@prisma/client';
import { createClient as createSupabaseClient } from '@supabase/supabase-js'; // Importer createClient directement

const prisma = new PrismaClient();

// Vérifier si les variables d'environnement sont définies
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Erreur: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ne sont pas définies dans .env");
  process.exit(1);
}

// Affiche les variables d'environnement pour le débogage
console.log("DEBUG: NEXT_PUBLIC_SUPABASE_URL = ", process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log("DEBUG: SUPABASE_SERVICE_ROLE_KEY (partiel) = ", process.env.SUPABASE_SERVICE_ROLE_KEY ? process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 5) + '...' : 'undefined');

const supabase = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Affiche la structure complète du client Supabase pour le débogage
// console.log("DEBUG: Structure complète du client Supabase:", JSON.stringify(Object.keys(supabase), null, 2));
// console.log("DEBUG: Structure de supabase.admin:", JSON.stringify(Object.keys(supabase.admin || {}), null, 2));

async function createAdminUser(email: string, name: string, password_raw: string) {
  try {
    let authUserId: string;
    let userImageUrl: string | null = null;

    // 1. Tenter de récupérer l'utilisateur Supabase existant par email  
    const { data: listUsersData, error: listUsersError } = await supabase.auth.admin.listUsers();

    if (listUsersError) {
      throw new Error(`Erreur lors de la récupération des utilisateurs Supabase: ${listUsersError.message}`);
    }

    const existingUserAuthData = listUsersData.users.find(user => user.email === email);

    if (existingUserAuthData) {
      // L'utilisateur existe déjà dans Supabase Auth, le mettre à jour
      console.log(`L'utilisateur ${email} existe déjà dans Supabase Auth. Mise à jour...`);
      const { data: updateAuthData, error: updateAuthError } = await supabase.auth.admin.updateUserById(
        existingUserAuthData.id,
        {
          password: password_raw, // Mettre à jour le mot de passe
          email_confirm: true, // Confirmer l'email
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
        email_confirm: true, // Confirmer l'email directement
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

    // 2. Créer/mettre à jour l'utilisateur dans la base de données Prisma avec le rôle ADMIN et approuvé
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

    console.log(`L'utilisateur administrateur ${email} a été créé et approuvé avec succès.`);
  } catch (error) {
    console.error(`Erreur lors de la création de l'utilisateur administrateur ${email}:`, error);
  } finally {
    await prisma.$disconnect();
  }
}

// Usage: Remplacez les valeurs par défaut ou utilisez des variables d'environnement
const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
const adminName = process.env.ADMIN_NAME || 'Admin User';
const adminPassword = process.env.ADMIN_PASSWORD || 'supersecretpassword'; // IMPORTANT: Change this in .env

createAdminUser(adminEmail, adminName, adminPassword);

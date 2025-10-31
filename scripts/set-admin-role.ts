import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function setAdminRole(userId: string, email: string, name: string) {
  try {
    // Mettre à jour ou créer l'utilisateur dans la base de données Prisma
    // avec le rôle ADMIN et approuvé.
    const user = await prisma.user.upsert({
      where: { email },
      update: { role: Role.ADMIN, approved: true, name }, // Mettre à jour le nom si nécessaire
      create: {
        id: userId,
        email,
        name,
        role: Role.ADMIN,
        approved: true,
      },
    });

    console.log(`L'utilisateur ${email} (ID: ${userId}) a été défini comme administrateur et approuvé dans Prisma.`);
  } catch (error) {
    console.error(`Erreur lors de la définition du rôle administrateur pour ${email}:`, error);
  } finally {
    await prisma.$disconnect();
  }
}

// IMPORTANT: REMPLACEZ CES VALEURS PAR CELLES DE L'UTILISATEUR QUE VOUS AVEZ CRÉÉ MANUELLEMENT DANS SUPABASE
const ADMIN_USER_ID = process.env.ADMIN_USER_ID || "VOTRE_ID_UUID_SUPABASE_ICI"; // L'UUID de l'utilisateur créé manuellement
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";           // L'email de cet utilisateur
const ADMIN_NAME = process.env.ADMIN_NAME || "Admin User";                   // Le nom de cet utilisateur

if (ADMIN_USER_ID === "VOTRE_ID_UUID_SUPABASE_ICI") {
  console.error("Erreur: Veuillez remplacer 'VOTRE_ID_UUID_SUPABASE_ICI' par l'ID réel de l'utilisateur Supabase dans le script ou via ADMIN_USER_ID dans .env");
  process.exit(1);
}

setAdminRole(ADMIN_USER_ID, ADMIN_EMAIL, ADMIN_NAME);

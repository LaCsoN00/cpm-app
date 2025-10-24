import prisma from '../lib/prisma';

async function debug() {
  try {
    console.log('🔍 DEBUG: Vérification de l\'état de la base de données\n');

    // Vérifier les demandes en attente
    const pendingRequests = await prisma.userRequest.findMany({
      where: { status: 'pending' }
    });
    console.log('📋 Demandes en attente (PENDING):');
    console.log(JSON.stringify(pendingRequests, null, 2));

    // Vérifier tous les utilisateurs et leurs rôles
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        approved: true
      }
    });
    console.log('\n👥 Tous les utilisateurs:');
    console.log(JSON.stringify(allUsers, null, 2));

    // Vérifier toutes les demandes
    const allRequests = await prisma.userRequest.findMany();
    console.log('\n📝 Toutes les demandes d\'inscription:');
    console.log(JSON.stringify(allRequests, null, 2));

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debug();

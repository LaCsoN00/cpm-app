import prisma from '../lib/prisma';

async function createRealRequest() {
  try {
    // ⚙️ MODIFIER CES VALEURS AVEC LES VRAIES DONNÉES
    const userEmail = 'votre.email@example.com'; // 👈 Changez ceci
    const userName = 'Votre Nom Complet'; // 👈 Changez ceci
    const userPassword = 'MotDePasseSecurisé123'; // 👈 Changez ceci

    console.log('✨ CRÉATION D\'UNE VRAIE DEMANDE D\'INSCRIPTION\n');
    console.log('📝 Données:');
    console.log(`   📧 Email: ${userEmail}`);
    console.log(`   👤 Nom: ${userName}`);
    console.log(`   🔐 Mot de passe: ${userPassword}\n`);

    // Vérifier si la demande existe déjà
    const existingRequest = await prisma.userRequest.findUnique({
      where: { email: userEmail }
    });

    if (existingRequest) {
      console.log(`❌ Une demande existe déjà pour ${userEmail}`);
      console.log(`   Statut: ${existingRequest.status}`);
      return;
    }

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await prisma.user.findUnique({
      where: { email: userEmail }
    });

    if (existingUser) {
      console.log(`❌ Un utilisateur existe déjà avec l'email ${userEmail}`);
      return;
    }

    // Créer la demande
    const newRequest = await prisma.userRequest.create({
      data: {
        email: userEmail,
        fullName: userName,
        password: userPassword,
        status: 'pending',
      },
    });

    console.log('✅ Demande créée avec succès!\n');
    console.log(JSON.stringify(newRequest, null, 2));
    console.log('\n🎯 Allez vérifier sur: http://localhost:3000/admin/manage-requests');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createRealRequest();

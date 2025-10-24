import prisma from '../lib/prisma';

async function testRegistration() {
  try {
    const testEmail = `test-${Date.now()}@example.com`;
    const testName = 'Test User';
    const testPassword = 'test123456';

    console.log('🧪 TEST: Création d\'une demande d\'inscription\n');
    console.log('📝 Données de test:');
    console.log(`   - Email: ${testEmail}`);
    console.log(`   - Nom: ${testName}`);
    console.log(`   - Mot de passe: ${testPassword}\n`);

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await prisma.user.findUnique({
      where: { email: testEmail }
    });

    if (existingUser) {
      console.log('❌ Utilisateur existe déjà!');
      return;
    }

    // Créer la demande
    const newRequest = await prisma.userRequest.create({
      data: {
        email: testEmail,
        fullName: testName,
        password: testPassword,
        status: 'pending',
      },
    });

    console.log('✅ Demande créée avec succès!');
    console.log(JSON.stringify(newRequest, null, 2));

    // Vérifier que c'est bien en base
    const verifyRequest = await prisma.userRequest.findUnique({
      where: { email: testEmail }
    });

    console.log('\n✅ Vérification - Demande retrouvée en base:');
    console.log(JSON.stringify(verifyRequest, null, 2));

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testRegistration();

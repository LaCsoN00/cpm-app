import prisma from '../lib/prisma';

async function testRealSignup() {
  try {
    const testEmail = `real-user-${Date.now()}@example.com`;
    const testName = 'Jean Dupont';
    const testPassword = 'SecurePass123!';

    console.log('🔐 TEST: Simulation d\'une vraie inscription\n');
    console.log('📝 Données de test:');
    console.log(`   - Email: ${testEmail}`);
    console.log(`   - Nom: ${testName}`);
    console.log(`   - Mot de passe: ${testPassword}\n`);

    // Simuler l'appel API POST /api/auth/create-request
    console.log('📡 Envoi d\'une requête POST à /api/auth/create-request...\n');
    
    const response = await fetch('http://localhost:3000/api/auth/create-request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: testEmail,
        fullName: testName,
        password: testPassword,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.log('❌ Erreur API:');
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    console.log('✅ Réponse API:');
    console.log(JSON.stringify(data, null, 2));

    // Vérifier que c'est bien en base
    await new Promise(resolve => setTimeout(resolve, 500)); // Attendre un peu
    
    const verifyRequest = await prisma.userRequest.findUnique({
      where: { email: testEmail }
    });

    console.log('\n✅ Vérification - Demande retrouvée en base:');
    console.log(JSON.stringify(verifyRequest, null, 2));

    console.log('\n🎯 Allez maintenant vérifier sur: http://localhost:3000/admin/manage-requests');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testRealSignup();

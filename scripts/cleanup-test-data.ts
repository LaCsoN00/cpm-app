import prisma from '@/lib/prisma'

async function cleanupTestData() {
  console.log('🧹 Nettoyage des données de test...')
  
  try {
    // Supprimer toutes les demandes UserRequest
    const deletedRequests = await prisma.userRequest.deleteMany({})
    console.log(`✅ ${deletedRequests.count} demandes d'inscription supprimées`)
    
    // Supprimer tous les utilisateurs sauf celui en cours (vous pouvez spécifier un email à garder)
    const allUsers = await prisma.user.findMany({
      select: { id: true, email: true }
    })
    
    console.log(`📋 Utilisateurs trouvés: ${allUsers.length}`)
    allUsers.forEach(u => console.log(`  - ${u.email}`))
    
    console.log('\n⚠️  Pour supprimer les utilisateurs, ouvrez Prisma Studio:')
    console.log('   npx prisma studio')
    console.log('\n   Puis supprimez manuellement les utilisateurs de test via l\'interface.')
    
  } catch (error) {
    console.error('❌ Erreur:', error)
  } finally {
    await prisma.$disconnect()
  }
}

cleanupTestData()

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function promoteToAdmin(email: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      console.error(`❌ Utilisateur avec l'email ${email} introuvable`)
      return
    }

    if (user.role === 'ADMIN' && user.approved) {
      console.log(`✅ L'utilisateur ${email} est déjà admin et approuvé`)
      return
    }

    await prisma.user.update({
      where: { email },
      data: { role: 'ADMIN', approved: true }
    })

    console.log(`🎉 ${email} promu au rang d'administrateur et approuvé !`)
  } catch (error) {
    console.error('❌ Erreur lors de la promotion:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Utilisation
const email = process.argv[2]
if (!email) {
  console.error('❌ Veuillez fournir un email: npm run promote-admin user@example.com')
  process.exit(1)
}

promoteToAdmin(email)

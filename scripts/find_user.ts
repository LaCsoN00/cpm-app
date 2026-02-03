
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { name: { contains: "Rose", mode: 'insensitive' } }
  });
  console.log("User found:", user);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

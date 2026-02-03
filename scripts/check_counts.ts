
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.project.count();
  console.log("Projects Count:", count);
  const requests = await prisma.assistanceRequest.count();
  console.log("Requests Count:", requests);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

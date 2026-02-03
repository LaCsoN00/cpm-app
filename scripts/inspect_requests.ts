
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const allRequests = await prisma.assistanceRequest.findMany({
    select: { id: true, status: true, taskName: true, projectId: true }
  });
  console.log("ALL REQUESTS:", JSON.stringify(allRequests, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

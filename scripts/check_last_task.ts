
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const lastTask = await prisma.task.findFirst({
    orderBy: { createdAt: 'desc' },
    include: { project: true }
  });
  console.log("LAST TASK:", JSON.stringify(lastTask, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

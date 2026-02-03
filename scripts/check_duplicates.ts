
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany({
    where: { name: { contains: "Test 1", mode: 'insensitive' } },
    include: {
        _count: { select: { tasks: true, assistanceRequests: true } }
    }
  });

  console.log(`Found ${projects.length} projects matching 'Test 1':`);
  projects.forEach(p => {
      console.log(`- ID: ${p.id} | Name: ${p.name} | Tasks: ${p._count.tasks} | Requests: ${p._count.assistanceRequests}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

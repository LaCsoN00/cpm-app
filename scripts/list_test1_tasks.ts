
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.findFirst({
    where: { name: { contains: "Test 1", mode: 'insensitive' } },
    include: {
        tasks: { 
            orderBy: { createdAt: 'desc' },
            select: { id: true, name: true, status: true, priority: true, createdAt: true } 
        }
    }
  });

  if (!project) {
      console.log("Project 'Test 1' not found.");
  } else {
      console.log(`Project: ${project.name} (${project.id})`);
      console.log(`Total Tasks: ${project.tasks.length}`);
      project.tasks.forEach((t, i) => {
          console.log(`${i+1}. [${t.status}] ${t.name} (Priority: ${t.priority}) - ${t.createdAt.toISOString()}`);
      });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

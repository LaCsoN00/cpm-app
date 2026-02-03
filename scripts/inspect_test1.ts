
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.findFirst({
    where: { name: { contains: "Test 1", mode: 'insensitive' } },
    include: {
        tasks: { select: { id: true, name: true, status: true, priority: true } },
        assistanceRequests: { select: { id: true, status: true, taskName: true } }
    }
  });

  if (!project) {
      console.log("Project 'Test 1' not found.");
  } else {
      console.log(`Project: ${project.name} (${project.id})`);
      console.log(`Assistance Requests: ${project.assistanceRequests.length}`);
      project.assistanceRequests.forEach(r => console.log(` - [${r.status}] ${r.taskName}`));

      console.log(`Tasks: ${project.tasks.length}`);
      project.tasks.forEach(t => console.log(` - [${t.status}] ${t.name}`));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

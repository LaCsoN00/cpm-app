
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.findFirst({
    where: { name: { contains: "Test 1", mode: 'insensitive' } },
  });

  if (!project) throw new Error("Project 'Test 1' not found");

  const consultant = await prisma.user.findFirst({
      where: { name: { contains: "Rose", mode: 'insensitive' } }
  }) || await prisma.user.findFirst();
  
  if (!consultant) throw new Error("No user found");

  const newTask = await prisma.task.create({
      data: {
          name: "Tâche restaurée",
          description: "Tâche créée pour restaurer le compte de 6 tâches.",
          priority: "MEDIUM",
          deadline: new Date(),
          projectId: project.id,
          createdById: project.createdById,
          userId: consultant.id,
          status: "To Do",
      }
  });
  console.log(`Created 6th task: ${newTask.id}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

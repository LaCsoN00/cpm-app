
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.findFirst({
    where: { name: { contains: "Test 1", mode: 'insensitive' } },
  });

  if (!project) throw new Error("Project 'Test 1' not found");

  const consultant = await prisma.user.findFirst({
      where: { name: { contains: "Rose", mode: 'insensitive' } }
  });
  if (!consultant) throw new Error("Consultant 'Rose' not found");

  // 1. Update existing 'Late' tasks to 'To Do'
  const updateResult = await prisma.task.updateMany({
      where: {
          projectId: project.id,
          status: 'Late'
      },
      data: {
          status: 'To Do'
      }
  });
  console.log(`Updated ${updateResult.count} tasks from 'Late' to 'To Do'.`);

  // 2. Create 'Test Assistance' task if missing
  const existingTask = await prisma.task.findFirst({
      where: {
          projectId: project.id,
          name: "Test Assistance"
      }
  });

  if (!existingTask) {
      const newTask = await prisma.task.create({
          data: {
              name: "Test Assistance",
              description: "Demande d'assistance (Restored)",
              priority: "HIGH",
              deadline: new Date("2025-11-20T00:00:00Z"),
              projectId: project.id,
              createdById: project.createdById, // Created by project owner
              userId: consultant.id, // Assigned to consultant
              status: "To Do",
          }
      });
      console.log(`Created missing task 'Test Assistance': ${newTask.id}`);
  } else {
      console.log("Task 'Test Assistance' already exists.");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

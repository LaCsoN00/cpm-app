
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.findFirst();
  if (!project) {
    console.error("No project found to attach request to.");
    return;
  }

  const consultant = await prisma.user.findFirst({ where: { role: 'CONSULTANT' } }) || await prisma.user.findFirst();
   if (!consultant) {
    console.error("No user found.");
    return;
  }

  const request = await prisma.assistanceRequest.create({
    data: {
      status: 'approved',
      message: 'Test Assistance Request',
      projectId: project.id,
      consultantId: consultant.id,
      taskName: 'Task from Assistance',
      taskDescription: 'Created via seed script',
      taskPriority: 'HIGH',
      taskDeadline: new Date(),
    }
  });

  console.log("Created test request:", request.id);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

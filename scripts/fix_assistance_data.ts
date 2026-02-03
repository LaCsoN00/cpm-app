
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('--- Fixing Assistance Requests Data ---');

  // 1. Find 'approved' requests
  const approvedRequests = await prisma.assistanceRequest.findMany({
    where: { status: 'approved' },
    include: { project: true }
  });

  console.log(`Found ${approvedRequests.length} approved requests to process.`);

  for (const request of approvedRequests) {
    if (!request.projectId || !request.project) {
      console.warn(`Skipping request ${request.id}: No linked project.`);
      continue;
    }

    // Create the task
    try {
      const newTask = await prisma.task.create({
        data: {
          name: request.taskName || "Nouvelle tâche (Assistance)",
          description: request.taskDescription || request.message || "",
          priority: request.taskPriority || 'LOW',
          deadline: request.taskDeadline,
          projectId: request.projectId,
          createdById: request.project.createdById, // Use project creator as task creator
          userId: request.consultantId, // Assign to the consultant who asked
          status: 'To Do',
          solutionDescription: null,
        }
      });
      console.log(`Created Task ${newTask.id} for Request ${request.id}`);

      // Update the request to resolved
      await prisma.assistanceRequest.update({
        where: { id: request.id },
        data: {
          status: 'resolved',
          resolvedAt: new Date(),
          resolvedById: request.project.createdById // Assume project creator resolved it
        }
      });
      console.log(`Updated Request ${request.id} to 'resolved'.`);

    } catch (error) {
      console.error(`Failed to process request ${request.id}:`, error);
    }
  }

  // 2. Delete orphans if any still exist (optional, kept from previous version)
  const deletedOrphans = await prisma.assistanceRequest.deleteMany({
    where: { projectId: null },
  });
  if (deletedOrphans.count > 0) {
      console.log(`Deleted ${deletedOrphans.count} orphan requests.`);
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

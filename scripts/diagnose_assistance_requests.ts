import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('--- Diagnosis of Assistance Requests ---');

  // Count by status
  const byStatus = await prisma.assistanceRequest.groupBy({
    by: ['status'],
    _count: { status: true }
  });
  console.log('Counts by Status:', byStatus);

  // Check for orphan requests (null projectId)
  const orphans = await prisma.assistanceRequest.findMany({
    where: { projectId: null },
    select: { id: true, status: true, message: true, consultantId: true }
  });
  console.log('Orphan Requests (projectId is null):', orphans);

  // Check for "approved" status (improper value)
  const approved = await prisma.assistanceRequest.findMany({
    where: { status: 'approved' },
    select: { id: true, projectId: true, message: true }
  });
  console.log('Requests with status "approved":', approved);

  // Check all pending requests detailed
  const pending = await prisma.assistanceRequest.findMany({
    where: { status: 'pending' },
    include: { project: { select: { name: true, id: true } } }
  });
  console.log('Pending Requests Details:', JSON.stringify(pending, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  console.log('--- USERS START ---');
  users.forEach(u => console.log(`${u.email} | ${u.role} | Approved: ${u.approved}`));
  console.log('--- USERS END ---');

  const requests = await prisma.userRequest.findMany();
  console.log('--- REQUESTS START ---');
  requests.forEach(r => console.log(`${r.email} | ${r.status}`));
  console.log('--- REQUESTS END ---');
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());

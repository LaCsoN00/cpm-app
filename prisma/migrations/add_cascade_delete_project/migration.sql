-- DropForeignKey
ALTER TABLE "Project" DROP CONSTRAINT "Project_createdById_fkey";

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

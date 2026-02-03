/*
  Warnings:

  - You are about to drop the `TaskRequest` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "TaskRequest" DROP CONSTRAINT "TaskRequest_consultantId_fkey";

-- DropForeignKey
ALTER TABLE "TaskRequest" DROP CONSTRAINT "TaskRequest_projectId_fkey";

-- DropForeignKey
ALTER TABLE "TaskRequest" DROP CONSTRAINT "TaskRequest_resolvedById_fkey";

-- AlterTable
ALTER TABLE "AssistanceRequest" ADD COLUMN     "taskDeadline" TIMESTAMP(3),
ADD COLUMN     "taskDescription" TEXT,
ADD COLUMN     "taskName" TEXT,
ADD COLUMN     "taskPriority" "Priority";

-- DropTable
DROP TABLE "TaskRequest";

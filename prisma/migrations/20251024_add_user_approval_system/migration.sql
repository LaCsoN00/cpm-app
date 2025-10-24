-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN "approved" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."UserRequest" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "UserRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserRequest_email_key" ON "public"."UserRequest"("email");

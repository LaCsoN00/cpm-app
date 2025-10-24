-- AddColumn restricted to User table
ALTER TABLE "User" ADD COLUMN "restricted" BOOLEAN NOT NULL DEFAULT false;

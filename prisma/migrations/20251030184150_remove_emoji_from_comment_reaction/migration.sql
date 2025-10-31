/*
  Warnings:

  - You are about to drop the column `emoji` on the `CommentReaction` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ReactionType" AS ENUM ('UPVOTE', 'DOWNVOTE');

-- AlterTable
ALTER TABLE "CommentReaction" DROP COLUMN "emoji";

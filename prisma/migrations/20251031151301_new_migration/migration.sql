/*
  Warnings:

  - A unique constraint covering the columns `[userId,commentId]` on the table `CommentReaction` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "CommentReaction_userId_commentId_key" ON "CommentReaction"("userId", "commentId");

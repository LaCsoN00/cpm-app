-- AlterTable
ALTER TABLE "CommentReaction" ADD COLUMN     "type" "ReactionType" NOT NULL DEFAULT 'UPVOTE';

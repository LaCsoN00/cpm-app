import { Project as PrismaProject, Task as PrismaTask, User as PrismaUser, Priority , Comment , CommentReaction , Role } from '@prisma/client';

export { Role };

export type AppUser = PrismaUser & { approved: boolean; restricted: boolean; imageUrl: string | null; };
export type User = AppUser; // Use AppUser as the main User type for the app

export type ExtendedUser = User & {
  tasks?: { id: string; status: string }[];
};

export type ProjectUserExtended = {
  user: ExtendedUser;
};

export type Project = PrismaProject & {
  totalTasks?: number;
  collaboratorsCount?: number;
  taskStats?: {
    toDo: number;
    inProgress: number;
    done: number;
  };
  percentages?: {
    progressPercentage: number;
    inProgressPercentage: number;
    toDoPercentage: number;
  };
  tasks?: Task[];
  users?: ProjectUserExtended[]; // Update to reflect `ProjectUser` structure
  createdBy?: ExtendedUser; // Use ExtendedUser here
};

export type Task = PrismaTask & {
  user?: ExtendedUser | null; // Use ExtendedUser here
  createdBy?: ExtendedUser | null;
  project?: Project; // Make project optional
  priority: Priority; // Rendre obligatoire
  deadline?: Date | null;
  comments?: string | null;
};

export enum ReactionType {
  UPVOTE = 'UPVOTE',
  DOWNVOTE = 'DOWNVOTE',
};

export type ReactionWithUser = CommentReaction & {
  user: User;
};

export type CommentWithUserAndReactions = Comment & {
  user: User;
  reactions: ReactionWithUser[];
};

export type CommentWithUserAndReactionsAndReplies = CommentWithUserAndReactions & {
  replies: CommentWithUserAndReactionsAndReplies[];
};

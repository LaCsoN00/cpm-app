import { Task as PrismaTask, Project as PrismaProject, User as PrismaUser, Comment as PrismaComment, CommentReaction as PrismaCommentReaction, Attachment as PrismaAttachment, AssistanceRequest as PrismaAssistanceRequest, Role, Priority } from '@prisma/client';

export interface ExtendedUser extends PrismaUser {
  projects?: PrismaProject[];
  userProjects?: { userId: string, projectId: string }[]; // Plus précis
  createdTasks?: PrismaTask[];
  tasks?: PrismaTask[];
  assistanceRequests?: AssistanceRequest[];
  resolvedAssistanceRequests?: AssistanceRequest[];
  comments?: PrismaComment[];
  commentReactions?: PrismaCommentReaction[];
}

export interface AssistanceRequest extends PrismaAssistanceRequest {
  consultant: ExtendedUser;
  resolvedBy?: ExtendedUser | null;
  project?: Project | null;
  taskName?: string | null;
  taskDescription?: string | null;
  taskPriority?: Priority | null;
  taskDeadline?: Date | null;
}

export interface Project extends PrismaProject {
  createdBy?: ExtendedUser;
  users?: { user: ExtendedUser }[];
  tasks?: Task[]; // Use our extended Task type here
  assistanceRequests?: AssistanceRequest[];
}

// We need to extend Prisma's Task to include relations that we fetch
export interface Task extends PrismaTask {
  user?: ExtendedUser | null;
  createdBy?: ExtendedUser;
  project?: Project;
  attachments?: Attachment[]; // Utiliser notre interface Attachment définie localement
}

export interface CommentWithUserAndReactionsAndReplies extends PrismaComment {
  user?: ExtendedUser;
  reactions?: PrismaCommentReaction[];
  replies?: CommentWithUserAndReactionsAndReplies[];
}

export interface Attachment extends PrismaAttachment {
  uploadedBy?: ExtendedUser;
  task?: Task;
}

// Export all enums directly from Prisma to avoid duplication
export { Role, Priority };

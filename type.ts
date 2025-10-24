import { Project as PrismaProject, Task as PrismaTask, User } from '@prisma/client';

export type ExtendedUser = User;

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
  users?: ExtendedUser[]; // Use ExtendedUser here
  createdBy?: ExtendedUser; // Use ExtendedUser here
};

export type Task = PrismaTask & {
  user?: ExtendedUser | null; // Use ExtendedUser here
  createdBy?: ExtendedUser | null ;
  title?: string; // Ajout explicite de la propriété title
}

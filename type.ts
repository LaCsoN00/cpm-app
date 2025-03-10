import { Project as PrismaProject, Task  as  PrismaTask, User } from '@prisma/client';

// Fusion du type PrismaProject avec vos propriétés supplémentaires
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
  tasks?: Task[]; // Assurez-vous que la relation tasks est incluse
  users?: User[]; 
  createdBy?: User, 
};

export type Task = PrismaTask & {
  user?: User | null; 
  createdBy?: User | null ;
}

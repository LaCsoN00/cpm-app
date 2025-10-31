import { openDB } from 'idb';
import { Project as AppProject, Task as AppTask, User as AppUser } from '@/type'; // Import types from '@/type'

// Nom de la base de données et du store
const DB_NAME = 'cpmapp-db';
export const STORE_PENDING_CHANGES = 'pendingChanges';
const STORE_PROJECTS = 'projects';
export const STORE_USER_DATA = 'userData'; // Nouveau store pour les données utilisateur

// Types pour les données stockées
export type Project = AppProject; // Use AppProject from '@/type'

export type Task = AppTask; // Use AppTask from '@/type'

export type User = AppUser; // Use AppUser from '@/type'

// Interface représentant une modification en attente
export interface PendingChange {
  id?: number;
  userId: string; // ID de l'utilisateur pour associer la donnée
  data: Project | Task | { inviteCode: string; offlineProjectId?: string } | { id: string }; // Peut être un projet, une tâche, un objet d'invitation ou un objet avec un ID
  timestamp: string;
  type: 'project' | 'task' | 'project_delete' | 'project_add_user'; // Type de la modification
}

// Ouverture ou création de la base de données IndexedDB
export async function getDB() {
  return openDB(DB_NAME, 2, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_PENDING_CHANGES)) {
        db.createObjectStore(STORE_PENDING_CHANGES, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_USER_DATA)) {
        db.createObjectStore(STORE_USER_DATA, { keyPath: 'key' });
      }
    },
  });
}

// Fonctions pour les changements en attente
export async function addPendingChange(data: PendingChange) {
  const db = await getDB();
  await db.add(STORE_PENDING_CHANGES, data);
  console.log('✅ Donnée stockée localement pour l\'utilisateur', data.userId);
}

export async function getPendingData(userId: string) {
  const db = await getDB();
  const pendingChanges = await db.getAll(STORE_PENDING_CHANGES);
  return pendingChanges.filter(change => change.userId === userId);
}

export async function removeFromPending(id: number) {
  const db = await getDB();
  await db.delete(STORE_PENDING_CHANGES, id);
}

export async function updatePendingChange(id: number, updatedData: PendingChange['data']) {
  const db = await getDB();
  const store = db.transaction(STORE_PENDING_CHANGES, 'readwrite').objectStore(STORE_PENDING_CHANGES);
  const pendingChange = await store.get(id);

  if (pendingChange) {
    pendingChange.data = updatedData;
    store.put(pendingChange);
  }
}

export async function getFirstPendingChangeEmail(): Promise<string> {
  const db = await getDB();
  const firstChange = await db.get(STORE_PENDING_CHANGES, 1); // Tente de récupérer la première entrée, si autoIncrement est utilisé.
  return firstChange?.userId || "";
}

// Nouvelles fonctions pour gérer l'e-mail de l'utilisateur
export async function saveUserEmail(email: string) {
  const db = await getDB();
  await db.put(STORE_USER_DATA, { key: 'userEmail', value: email });
  console.log('✅ E-mail utilisateur sauvegardé localement:', email);
}

export async function getUserEmail(): Promise<string | undefined> {
  const db = await getDB();
  const userData = await db.get(STORE_USER_DATA, 'userEmail');
  return userData?.value;
}

// Fonctions pour les projets
export async function addProject(project: Project) {
  const db = await getDB();
  await db.put(STORE_PROJECTS, project);
}

export async function getProjects(): Promise<Project[]> {
  const db = await getDB();
  return db.getAll(STORE_PROJECTS);
}

export async function deleteProjectFromIdb(projectId: string) {
  const db = await getDB();
  await db.delete(STORE_PROJECTS, projectId);
  console.log(`Projet avec l'ID ${projectId} supprimé d'IndexedDB.`);
}

export async function getProjectById(id: string): Promise<Project | undefined> {
  const db = await getDB();
  return db.get(STORE_PROJECTS, id);
}

// Fonctions pour les tâches
export async function addTask(task: Task) {
  const db = await getDB();
  // Lors de l'ajout d'une tâche, nous mettons à jour le projet parent
  const project = await db.get(STORE_PROJECTS, task.projectId as string);
  if (project) {
    const updatedTasks = project.tasks ? [...project.tasks, task] : [task];
    await db.put(STORE_PROJECTS, { ...project, tasks: updatedTasks });
  } else {
    console.warn(`Projet parent de la tâche ${task.id} introuvable pour la mise à jour.`);
  }
}

export async function getTasks(): Promise<Task[]> {
  const db = await getDB();
  const allProjects = await db.getAll(STORE_PROJECTS);
  const allTasks: Task[] = [];
  allProjects.forEach(project => {
    if (project.tasks) {
      allTasks.push(...project.tasks);
    }
  });
  return allTasks;
}

export async function getTaskById(id: string): Promise<Task | undefined> {
  const db = await getDB();
  const allProjects = await db.getAll(STORE_PROJECTS);
  for (const project of allProjects) {
    if (project.tasks) {
      const task = project.tasks.find((t: Task) => t.id === id);
      if (task) return task;
    }
  }
  return undefined;
}

export async function getProjectTasks(projectId: string): Promise<Task[]> {
  const db = await getDB();
  const project = await db.get(STORE_PROJECTS, projectId);
  return project?.tasks || [];
}

export async function clearAllStores() {
  const db = await getDB();
  await db.clear(STORE_PENDING_CHANGES);
  await db.clear(STORE_PROJECTS);
  await db.clear(STORE_USER_DATA);
  console.log('Tous les stores IndexedDB ont été effacés.');
}
import { openDB } from 'idb';

// Nom de la base de données et du store
const DB_NAME = 'cpmapp-db';
const STORE_NAME = 'pendingChanges';

// Ouverture ou création de la base de données IndexedDB
export async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    },
  });
}

// Interface représentant les projets ou autres données que tu souhaites stocker
export interface Project {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'synced'; // Pour suivre l'état de la synchronisation
  userId?: string;  // Ajout de l'ID de l'utilisateur
}

// Type représentant une modification en attente (peut être un projet ou d'autres données)
export interface PendingChange {
  id?: number;
  userId: string; // ID de l'utilisateur pour associer la donnée
  data: Project; // Utilisation du type `Project` au lieu de `unknown`
  timestamp: string;
}

// Fonction pour ajouter une modification en attente (projet, par exemple)
export async function addPendingChange(data: PendingChange) {
  const db = await getDB();
  await db.add(STORE_NAME, data);
  console.log('✅ Donnée stockée localement pour l\'utilisateur', data.userId);
}

// Fonction pour récupérer toutes les modifications en attente (projets)
export async function getPendingData(userId: string) {
  const db = await getDB();
  const pendingChanges = await db.getAll(STORE_NAME);
  return pendingChanges.filter(change => change.userId === userId);
}

// Fonction pour supprimer une modification de la liste des changements en attente (utile après la synchronisation)
export async function removeFromPending(id: number) {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}

// Fonction pour mettre à jour un projet une fois synchronisé avec le serveur
export async function updatePendingChange(id: number, updatedData: Project) {
  const db = await getDB();
  const store = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME);
  const pendingChange = await store.get(id);

  if (pendingChange) {
    pendingChange.data = updatedData;
    store.put(pendingChange); // Mettre à jour la modification
  }
}

// Fonction pour récupérer un projet spécifique depuis IndexedDB (utile pour l'édition)
export async function getProjectById(id: number) {
  const db = await getDB();
  const store = db.transaction(STORE_NAME).objectStore(STORE_NAME);
  return store.get(id);
}
/**
 * IndexedDB-backed offline photo queue.
 * DB: "canteiro-offline-db" v1 — store: "photo_queue"
 */

export interface PhotoMetadata {
  captured_at: string;
  latitude: number | null;
  longitude: number | null;
  accuracy_meters: number | null;
  address: string | null;
  weather_description: string | null;
  device_info: string;
}

export interface QueueItem {
  localId?: number;
  rdoDiaId: string;
  companyId: string;
  base64: string;
  mimeType: string;
  fileName: string;
  metadata: PhotoMetadata;
  status: "pending" | "uploading" | "done" | "error";
  attempts: number;
  createdAt: string;
  errorMessage?: string;
}

const DB_NAME = "canteiro-offline-db";
const DB_VERSION = 1;
const STORE = "photo_queue";

let _db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "localId", autoIncrement: true });
      }
    };
    req.onsuccess = (e) => {
      _db = (e.target as IDBOpenDBRequest).result;
      resolve(_db);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function initPhotoQueue(): Promise<void> {
  await openDB();
}

export async function addToQueue(
  item: Omit<QueueItem, "localId" | "status" | "attempts" | "createdAt">
): Promise<number> {
  const db = await openDB();
  const record: Omit<QueueItem, "localId"> = {
    ...item,
    status: "pending",
    attempts: 0,
    createdAt: new Date().toISOString(),
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).add(record);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

export async function getPendingItems(): Promise<QueueItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      const all: QueueItem[] = req.result;
      resolve(all.filter((i) => i.status === "pending" || i.status === "uploading"));
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getAllItems(): Promise<QueueItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function updateItemStatus(
  localId: number,
  status: QueueItem["status"],
  errorMessage?: string
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const getReq = store.get(localId);
    getReq.onsuccess = () => {
      const item: QueueItem = getReq.result;
      if (!item) { resolve(); return; }
      item.status = status;
      if (errorMessage !== undefined) item.errorMessage = errorMessage;
      if (status === "error") item.attempts = (item.attempts || 0) + 1;
      const putReq = store.put(item);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function removeItem(localId: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).delete(localId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getPendingCount(): Promise<number> {
  const items = await getPendingItems();
  return items.length;
}

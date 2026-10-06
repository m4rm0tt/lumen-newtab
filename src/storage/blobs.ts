// Images et GIF dans IndexedDB. Ils restent sur l'appareil, jamais dans storage.sync.
import { uid } from '../lib/id';

const DB_NAME = 'lumen';
const STORE = 'blobs';
const VERSION = 1;

export interface StoredBlob {
  id: string;
  blob: Blob;
  name: string;
  type: string;
  createdAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        reject(req.error);
      };
    });
  }
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        t.oncomplete = () => resolve(req.result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      }),
  );
}

export async function putBlob(blob: Blob, name: string, id = uid('b_')): Promise<string> {
  const rec: StoredBlob = { id, blob, name: name.slice(0, 200), type: blob.type, createdAt: Date.now() };
  await tx('readwrite', (s) => s.put(rec));
  return id;
}

export async function getBlob(id: string): Promise<StoredBlob | undefined> {
  return tx('readonly', (s) => s.get(id) as IDBRequest<StoredBlob | undefined>);
}

export async function deleteBlob(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id));
}

export async function listBlobs(): Promise<StoredBlob[]> {
  return tx('readonly', (s) => s.getAll() as IDBRequest<StoredBlob[]>);
}

export async function clearBlobs(): Promise<void> {
  await tx('readwrite', (s) => s.clear());
}

/** Cache d'object URLs : une seule URL par blob pendant la vie de la page. */
const urlCache = new Map<string, Promise<string | null>>();

export function blobUrl(id: string): Promise<string | null> {
  let p = urlCache.get(id);
  if (!p) {
    p = getBlob(id)
      .then((rec) => (rec ? URL.createObjectURL(rec.blob) : null))
      .catch(() => null);
    urlCache.set(id, p);
  }
  return p;
}

export function forgetBlobUrl(id: string): void {
  const p = urlCache.get(id);
  urlCache.delete(id);
  p?.then((u) => u && URL.revokeObjectURL(u));
}

/** Supprime les blobs qui ne sont plus référencés. */
export async function collectGarbage(referenced: Set<string>): Promise<number> {
  const all = await listBlobs().catch(() => [] as StoredBlob[]);
  let removed = 0;
  for (const b of all) {
    if (!referenced.has(b.id)) {
      await deleteBlob(b.id).catch(() => undefined);
      forgetBlobUrl(b.id);
      removed++;
    }
  }
  return removed;
}

// Au démarrage : rendu depuis localStorage (lumen:boot), puis lecture de storage.local et
// storage.sync, le plus récent gagne.
// En écriture : storage.local après 300 ms, storage.sync après 2 s et seulement les morceaux modifiés.
import { signal } from '@preact/signals';
import type { SyncDoc } from '../types';
import { area, hasChromeStorage, onStorageChange } from './backend';
import { META_KEY, SYNC_BUDGET, SYNC_PREFIX, buildSyncPayload, diffSync, joinSync } from './chunks';
import { normalizeDoc } from './schema';
import { debounce } from '../lib/timing';

export const BOOT_KEY = 'lumen:boot';
export const LOCAL_DOC_KEY = 'doc';

/** Identifiant de cette page : permet d'ignorer l'écho de nos propres écritures. */
export const WRITER_ID = `t_${Math.random().toString(36).slice(2, 10)}`;

export type SyncState = 'off' | 'idle' | 'saving' | 'ok' | 'too-large' | 'error' | 'unavailable';

export const syncStatus = signal<{ state: SyncState; bytes: number; message?: string; at?: number }>({
  state: hasChromeStorage ? 'idle' : 'unavailable',
  bytes: 0,
});

// ---------------------------------------------------------------------------
// Lecture

export function readBootCache(): SyncDoc | null {
  try {
    const raw = localStorage.getItem(BOOT_KEY);
    return raw ? normalizeDoc(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

async function readLocalDoc(): Promise<SyncDoc | null> {
  try {
    const { [LOCAL_DOC_KEY]: raw } = await area('local').get([LOCAL_DOC_KEY]);
    return raw ? normalizeDoc(raw) : null;
  } catch {
    return null;
  }
}

/** Dernier contenu connu de storage.sync (pour n'écrire que les différences). */
let lastSyncItems: Record<string, unknown> = {};

async function readSyncDoc(): Promise<SyncDoc | null> {
  if (!hasChromeStorage) return null;
  try {
    const all = await area('sync').get(null);
    lastSyncItems = Object.fromEntries(Object.entries(all).filter(([k]) => k.startsWith(`${SYNC_PREFIX}.`)));
    const joined = joinSync(all);
    return joined ? normalizeDoc(JSON.parse(joined.json)) : null;
  } catch {
    return null;
  }
}

export interface LoadResult {
  doc: SyncDoc | null;
  source: 'local' | 'sync' | 'none';
}

/** Charge le document le plus récent entre local et sync. */
export async function loadDoc(): Promise<LoadResult> {
  const [local, sync] = await Promise.all([readLocalDoc(), readSyncDoc()]);
  // Si l'utilisateur a désactivé la synchro sur cet appareil, on ignore la copie distante.
  const syncAllowed = local ? local.settings.sync : true;
  if (sync && syncAllowed && (!local || sync.updatedAt > local.updatedAt)) return { doc: sync, source: 'sync' };
  if (local) return { doc: local, source: 'local' };
  return { doc: null, source: 'none' };
}

// ---------------------------------------------------------------------------
// Écriture

export function writeBootCache(doc: SyncDoc) {
  try {
    localStorage.setItem(BOOT_KEY, JSON.stringify(doc));
  } catch {
    /* quota localStorage plein : le cache de démarrage est facultatif */
  }
}

async function writeLocal(doc: SyncDoc) {
  writeBootCache(doc);
  try {
    await area('local').set({ [LOCAL_DOC_KEY]: doc });
  } catch {
    /* ignoré : le cache de démarrage garde une copie */
  }
}

async function writeSync(doc: SyncDoc) {
  if (!hasChromeStorage) return;
  if (!doc.settings.sync) {
    syncStatus.value = { state: 'off', bytes: syncStatus.value.bytes };
    return;
  }
  const json = JSON.stringify(doc);
  const payload = buildSyncPayload(json, doc.writer, doc.updatedAt);
  if (payload.totalBytes > SYNC_BUDGET) {
    syncStatus.value = {
      state: 'too-large',
      bytes: payload.totalBytes,
      message: 'La configuration dépasse le quota de Chrome Sync. Elle reste enregistrée sur cet appareil.',
    };
    return;
  }
  // Relit l'état distant : un autre onglet ou appareil a pu écrire depuis notre dernière lecture.
  try {
    const all = await area('sync').get(null);
    lastSyncItems = Object.fromEntries(Object.entries(all).filter(([k]) => k.startsWith(`${SYNC_PREFIX}.`)));
  } catch {
    /* on garde la dernière copie connue */
  }
  const prevMeta = lastSyncItems[META_KEY] as { hash?: string } | undefined;
  if (prevMeta?.hash === payload.meta.hash) {
    syncStatus.value = { state: 'ok', bytes: payload.totalBytes, at: Date.now() };
    return;
  }
  const { set, remove } = diffSync(lastSyncItems, payload.items);
  syncStatus.value = { state: 'saving', bytes: payload.totalBytes };
  try {
    // Les fragments d'abord, la meta en dernier : un lecteur ne voit jamais une meta qui pointe vers des fragments absents.
    const { [META_KEY]: meta, ...chunks } = set;
    if (Object.keys(chunks).length) await area('sync').set(chunks);
    await area('sync').set({ [META_KEY]: meta });
    if (remove.length) await area('sync').remove(remove);
    lastSyncItems = payload.items;
    syncStatus.value = { state: 'ok', bytes: payload.totalBytes, at: Date.now() };
  } catch (e) {
    syncStatus.value = {
      state: 'error',
      bytes: payload.totalBytes,
      message: e instanceof Error ? e.message : 'Écriture refusée par Chrome Sync.',
    };
  }
}

export interface Persister {
  schedule(doc: SyncDoc): void;
  flush(): void;
}

export function createPersister(): Persister {
  const local = debounce((d: SyncDoc) => void writeLocal(d), 300);
  const sync = debounce((d: SyncDoc) => void writeSync(d), 2000);
  const p: Persister = {
    schedule(doc) {
      local(doc);
      sync(doc);
    },
    flush() {
      local.flush();
      sync.flush();
    },
  };
  // Garantit l'écriture si l'onglet est fermé pendant le debounce.
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => p.flush());
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && p.flush());
  }
  return p;
}

/** Écrit immédiatement partout (import, réinitialisation). */
export async function persistNow(doc: SyncDoc): Promise<void> {
  await writeLocal(doc);
  await writeSync(doc);
}

// ---------------------------------------------------------------------------
// Changements venant d'un autre onglet ou d'un autre appareil

export function watchRemoteChanges(apply: (doc: SyncDoc) => void): () => void {
  let pendingSyncRead = false;
  return onStorageChange(async (changes, areaName) => {
    if (areaName === 'local' && changes[LOCAL_DOC_KEY]?.newValue) {
      const incoming = normalizeDoc(changes[LOCAL_DOC_KEY].newValue);
      if (incoming.writer !== WRITER_ID) apply(incoming);
      return;
    }
    if (areaName === 'sync' && changes[META_KEY]?.newValue) {
      const meta = changes[META_KEY].newValue as { writer?: string };
      if (meta.writer === WRITER_ID || pendingSyncRead) return;
      pendingSyncRead = true;
      try {
        const doc = await readSyncDoc();
        if (doc && doc.writer !== WRITER_ID) apply(doc);
      } finally {
        pendingSyncRead = false;
      }
    }
  });
}

/** Statistiques affichées dans Réglages › Données. */
export async function storageUsage(): Promise<{ local: number; sync: number }> {
  const [local, sync] = await Promise.all([
    area('local').bytesInUse().catch(() => 0),
    hasChromeStorage ? area('sync').bytesInUse().catch(() => 0) : Promise.resolve(0),
  ]);
  return { local, sync };
}

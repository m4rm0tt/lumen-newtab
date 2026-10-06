// chrome.storage dans l'extension ; localStorage (vite dev) ou mémoire (tests) ailleurs.
export type AreaName = 'local' | 'sync';

export interface StorageArea {
  get(keys?: string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string[]): Promise<void>;
  bytesInUse(): Promise<number>;
}

export type ChangeListener = (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, area: AreaName) => void;

export const hasChromeStorage = typeof chrome !== 'undefined' && !!chrome.storage?.local;
export const isExtension = typeof chrome !== 'undefined' && !!chrome.runtime?.id;

function chromeArea(name: AreaName): StorageArea {
  const a = chrome.storage[name];
  return {
    get: (keys) => a.get(keys ?? null) as Promise<Record<string, unknown>>,
    set: (items) => a.set(items),
    remove: (keys) => a.remove(keys),
    bytesInUse: () => a.getBytesInUse(null),
  };
}

/** Zone simulée persistée dans localStorage (dev) ou en mémoire (tests). */
export function createFallbackArea(name: AreaName, persistent = typeof localStorage !== 'undefined'): StorageArea {
  const prefix = `lumen-dev:${name}:`;
  const mem = new Map<string, string>();
  const read = (k: string) => (persistent ? localStorage.getItem(prefix + k) : mem.get(k) ?? null);
  const write = (k: string, v: string) => (persistent ? localStorage.setItem(prefix + k, v) : mem.set(k, v));
  const del = (k: string) => (persistent ? localStorage.removeItem(prefix + k) : mem.delete(k));
  const allKeys = (): string[] =>
    persistent
      ? Object.keys(localStorage).filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length))
      : [...mem.keys()];

  return {
    async get(keys) {
      const out: Record<string, unknown> = {};
      for (const k of keys ?? allKeys()) {
        const v = read(k);
        if (v !== null) out[k] = JSON.parse(v);
      }
      return out;
    },
    async set(items) {
      const changes: Record<string, { oldValue?: unknown; newValue?: unknown }> = {};
      for (const [k, v] of Object.entries(items)) {
        const old = read(k);
        write(k, JSON.stringify(v));
        changes[k] = { oldValue: old === null ? undefined : JSON.parse(old), newValue: v };
      }
      emit(changes, name);
    },
    async remove(keys) {
      const changes: Record<string, { oldValue?: unknown; newValue?: unknown }> = {};
      for (const k of keys) {
        const old = read(k);
        if (old !== null) changes[k] = { oldValue: JSON.parse(old) };
        del(k);
      }
      if (Object.keys(changes).length) emit(changes, name);
    },
    async bytesInUse() {
      let n = 0;
      for (const k of allKeys()) n += k.length + (read(k)?.length ?? 0);
      return n;
    },
  };
}

const listeners = new Set<ChangeListener>();
function emit(changes: Parameters<ChangeListener>[0], area: AreaName) {
  for (const l of listeners) l(changes, area);
}

const areas: Record<AreaName, StorageArea> = hasChromeStorage
  ? { local: chromeArea('local'), sync: chromeArea('sync') }
  : { local: createFallbackArea('local'), sync: createFallbackArea('sync') };

export function area(name: AreaName): StorageArea {
  return areas[name];
}

/** Pour les tests : remplace les zones par des implémentations en mémoire. */
export function useMemoryBackend(): void {
  areas.local = createFallbackArea('local', false);
  areas.sync = createFallbackArea('sync', false);
}

export function onStorageChange(cb: ChangeListener): () => void {
  if (hasChromeStorage) {
    const handler = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName === 'local' || areaName === 'sync') cb(changes, areaName);
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }
  listeners.add(cb);
  // En dev, relaie aussi les modifications faites dans un autre onglet.
  const onWindowStorage = (e: StorageEvent) => {
    const m = e.key?.match(/^lumen-dev:(local|sync):(.+)$/);
    if (!m) return;
    cb({ [m[2]]: { oldValue: e.oldValue ? JSON.parse(e.oldValue) : undefined, newValue: e.newValue ? JSON.parse(e.newValue) : undefined } }, m[1] as AreaName);
  };
  if (typeof window !== 'undefined') window.addEventListener('storage', onWindowStorage);
  return () => {
    listeners.delete(cb);
    if (typeof window !== 'undefined') window.removeEventListener('storage', onWindowStorage);
  };
}

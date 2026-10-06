// Données locales des widgets (notes, tâches, minuteur). Pas synchronisées, mais les autres
// onglets ouverts suivent via storage.onChanged.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { area, onStorageChange } from '../storage/backend';
import { debounce } from '../lib/timing';

const cache = new Map<string, unknown>();

export async function readLocal<T>(key: string, fallback: T): Promise<T> {
  if (cache.has(key)) return cache.get(key) as T;
  try {
    const { [key]: v } = await area('local').get([key]);
    const value = (v ?? fallback) as T;
    cache.set(key, value);
    return value;
  } catch {
    return fallback;
  }
}

export async function writeLocal(key: string, value: unknown): Promise<void> {
  cache.set(key, value);
  try {
    if (value === undefined) await area('local').remove([key]);
    else await area('local').set({ [key]: value });
  } catch {
    /* quota ou stockage indisponible : la valeur reste en mémoire pour cette page */
  }
}

export async function removeLocal(keys: string[]): Promise<void> {
  keys.forEach((k) => cache.delete(k));
  try {
    await area('local').remove(keys);
  } catch {
    /* ignoré */
  }
}

/**
 * const [value, setValue, loaded] = useLocal('w:abc', { text: '' });
 * Les écritures sont regroupées (debounce) ; les changements des autres onglets sont reflétés.
 */
export function useLocal<T>(key: string, fallback: T, writeDelay = 400): [T, (next: T | ((prev: T) => T)) => void, boolean] {
  const [value, setValue] = useState<T>(() => (cache.has(key) ? (cache.get(key) as T) : fallback));
  const [loaded, setLoaded] = useState(cache.has(key));
  const latest = useRef(value);
  latest.current = value;
  const localWrite = useRef(false);

  const persist = useMemo(() => debounce((v: T) => void writeLocal(key, v), writeDelay), [key, writeDelay]);

  useEffect(() => {
    let alive = true;
    readLocal(key, fallback).then((v) => {
      if (!alive) return;
      setValue(v);
      setLoaded(true);
    });
    const off = onStorageChange((changes, areaName) => {
      if (areaName !== 'local' || !(key in changes)) return;
      if (localWrite.current) {
        localWrite.current = false;
        return;
      }
      const nv = changes[key].newValue as T | undefined;
      cache.set(key, nv ?? fallback);
      setValue(nv ?? fallback);
    });
    const flush = () => persist.flush();
    window.addEventListener('pagehide', flush);
    return () => {
      alive = false;
      off();
      persist.flush();
      window.removeEventListener('pagehide', flush);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const set = (next: T | ((prev: T) => T)) => {
    const v = typeof next === 'function' ? (next as (p: T) => T)(latest.current) : next;
    latest.current = v;
    cache.set(key, v);
    setValue(v);
    localWrite.current = true;
    persist(v);
  };

  return [value, set, loaded];
}

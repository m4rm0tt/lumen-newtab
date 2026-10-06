// Cache réseau des widgets : on affiche la dernière valeur connue, puis on rafraîchit.
// Une API en panne ne touche que son widget, et rien ne part avant le premier rendu.
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { readLocal, writeLocal } from '../state/local';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function fetchJson<T>(url: string, init: RequestInit = {}, timeoutMs = 12000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!res.ok) throw new HttpError(res.status, httpMessage(res.status));
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    if ((e as Error).name === 'AbortError') throw new Error('Délai dépassé.');
    throw new Error(navigator.onLine ? 'Service injoignable.' : 'Hors ligne.');
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchText(url: string, timeoutMs = 12000): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!res.ok) throw new HttpError(res.status, httpMessage(res.status));
    return await res.text();
  } catch (e) {
    if (e instanceof HttpError) throw e;
    if ((e as Error).name === 'AbortError') throw new Error('Délai dépassé.');
    throw new Error(navigator.onLine ? 'Accès refusé ou service injoignable.' : 'Hors ligne.');
  } finally {
    clearTimeout(timer);
  }
}

function httpMessage(status: number): string {
  if (status === 401 || status === 403) return 'Accès refusé (jeton ou clé invalide ?).';
  if (status === 404) return 'Introuvable.';
  if (status === 429) return 'Trop de requêtes, réessayez plus tard.';
  if (status >= 500) return 'Le service rencontre un problème.';
  return `Erreur ${status}.`;
}

interface CacheEntry<T> {
  at: number;
  data: T;
}

export interface RemoteState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  updatedAt: number | null;
  refresh: () => void;
}

/**
 * useRemote('cache:weather:48.8,2.3', () => fetchJson(...), 15 * 60_000)
 * - affiche immédiatement la dernière valeur en cache ;
 * - rafraîchit si elle est plus vieille que ttl, et toutes les ttl tant que l'onglet est visible ;
 * - key = null désactive le chargement (widget non configuré).
 */
export function useRemote<T>(key: string | null, fetcher: () => Promise<T>, ttl: number): RemoteState<T> {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean; updatedAt: number | null }>({
    data: null,
    error: null,
    loading: !!key,
    updatedAt: null,
  });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const inflight = useRef(false);

  const load = useCallback(
    async (force: boolean) => {
      if (!key || inflight.current) return;
      const cached = await readLocal<CacheEntry<T> | null>(key, null);
      if (cached) setState((s) => ({ ...s, data: cached.data, updatedAt: cached.at }));
      if (!force && cached && Date.now() - cached.at < ttl) {
        setState((s) => ({ ...s, loading: false, error: null }));
        return;
      }
      inflight.current = true;
      setState((s) => ({ ...s, loading: true }));
      try {
        const data = await fetcherRef.current();
        const at = Date.now();
        await writeLocal(key, { at, data } satisfies CacheEntry<T>);
        setState({ data, error: null, loading: false, updatedAt: at });
      } catch (e) {
        setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : 'Erreur inconnue.' }));
      } finally {
        inflight.current = false;
      }
    },
    [key, ttl],
  );

  useEffect(() => {
    if (!key) {
      setState({ data: null, error: null, loading: false, updatedAt: null });
      return;
    }
    // Laisse le navigateur peindre l'interface principale avant toute requête.
    const idle = (window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 50))) as (cb: () => void) => number;
    idle(() => void load(false));
    const interval = setInterval(() => document.visibilityState === 'visible' && void load(false), Math.max(ttl, 60_000));
    const onVisible = () => document.visibilityState === 'visible' && void load(false);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [key, load, ttl]);

  return { ...state, refresh: () => void load(true) };
}

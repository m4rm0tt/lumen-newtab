// Les favicons viennent du cache de Chrome (/_favicon/), donc sans requête réseau.
// Pour un site jamais visité, Chrome renvoie un globe générique : on le repère en le
// comparant à l'icône d'un domaine qui n'existe pas, et on affiche un monogramme à la place.
import { isExtension } from '../storage/backend';

export const faviconSupported = isExtension && typeof chrome.runtime.getURL === 'function';

export function faviconUrl(pageUrl: string, size = 64): string {
  const u = new URL(chrome.runtime.getURL('/_favicon/'));
  u.searchParams.set('pageUrl', pageUrl);
  u.searchParams.set('size', String(size));
  return u.toString();
}

async function digest(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const h = await crypto.subtle.digest('SHA-1', buf);
    return Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

let defaultDigest: Promise<string | null> | null = null;
const results = new Map<string, Promise<string | null>>();
const SESSION_KEY = 'lumen:favicons';
let known: Record<string, 0 | 1> = {};
try {
  known = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? '{}');
} catch {
  known = {};
}

function remember(key: string, ok: boolean) {
  known[key] = ok ? 1 : 0;
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(known));
  } catch {
    /* facultatif */
  }
}

/** Renvoie l'URL de la favicon si Chrome en connaît une vraie, sinon null. */
export function resolveFavicon(pageUrl: string, size = 64): Promise<string | null> {
  if (!faviconSupported) return Promise.resolve(null);
  const key = `${size}|${pageUrl}`;
  const url = faviconUrl(pageUrl, size);
  if (key in known) return Promise.resolve(known[key] ? url : null);
  let p = results.get(key);
  if (!p) {
    defaultDigest ??= digest(faviconUrl('https://lumen-default.invalid/', size));
    p = Promise.all([defaultDigest, digest(url)]).then(([def, mine]) => {
      const ok = !!mine && mine !== def;
      remember(key, ok);
      return ok ? url : null;
    });
    results.set(key, p);
  }
  return p;
}

/** Résultat déjà connu (pour un premier rendu sans clignotement). */
export function knownFavicon(pageUrl: string, size = 64): string | null | undefined {
  if (!faviconSupported) return null;
  const key = `${size}|${pageUrl}`;
  if (!(key in known)) return undefined;
  return known[key] ? faviconUrl(pageUrl, size) : null;
}

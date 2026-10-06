// storage.sync limite à 8 192 octets par clé et ~100 Ko au total. Le document JSON est
// découpé en lumen.doc.0, lumen.doc.1… et décrit par lumen.doc.meta (taille, hash).
export const SYNC_PREFIX = 'lumen.doc';
export const META_KEY = `${SYNC_PREFIX}.meta`;
export const QUOTA_BYTES_PER_ITEM = 8192;
export const QUOTA_BYTES = 102_400;
/** Marge de sécurité : au-delà, on désactive la synchro plutôt que de risquer une écriture partielle. */
export const SYNC_BUDGET = 90_000;

export interface ChunkMeta {
  v: 1;
  n: number;
  size: number;
  hash: string;
  writer: string;
  updatedAt: number;
}

const encoder = new TextEncoder();

export function byteLength(s: string): number {
  return encoder.encode(s).length;
}

/** Taille comptée par Chrome pour un élément : clé + valeur sérialisée en JSON. */
export function itemBytes(key: string, value: unknown): number {
  return byteLength(key) + byteLength(JSON.stringify(value));
}

export function chunkKey(i: number): string {
  return `${SYNC_PREFIX}.${i}`;
}

/** Hash FNV-1a 32 bits, suffisant pour détecter un changement de contenu. */
export function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** Découpe une chaîne en fragments dont chaque élément respecte le quota par élément. */
export function splitString(json: string, maxItemBytes = QUOTA_BYTES_PER_ITEM - 192): string[] {
  const chunks: string[] = [];
  let i = 0;
  const keyBytes = byteLength(chunkKey(999));
  while (i < json.length) {
    let len = Math.min(json.length - i, maxItemBytes);
    let slice = json.slice(i, i + len);
    // Réduit jusqu'à tenir dans le quota (échappements JSON et caractères multi-octets).
    while (keyBytes + byteLength(JSON.stringify(slice)) > maxItemBytes) {
      const over = keyBytes + byteLength(JSON.stringify(slice)) - maxItemBytes;
      len = Math.max(1, len - Math.max(1, Math.ceil(over / 3)));
      slice = json.slice(i, i + len);
    }
    // Ne coupe jamais une paire de substitution UTF-16.
    const last = slice.charCodeAt(slice.length - 1);
    if (last >= 0xd800 && last <= 0xdbff && slice.length > 1) slice = slice.slice(0, -1);
    chunks.push(slice);
    i += slice.length;
  }
  return chunks;
}

export interface SyncPayload {
  items: Record<string, unknown>;
  meta: ChunkMeta;
  totalBytes: number;
}

export function buildSyncPayload(json: string, writer: string, updatedAt: number): SyncPayload {
  const chunks = splitString(json);
  const meta: ChunkMeta = { v: 1, n: chunks.length, size: json.length, hash: hash(json), writer, updatedAt };
  const items: Record<string, unknown> = { [META_KEY]: meta };
  chunks.forEach((c, i) => (items[chunkKey(i)] = c));
  let totalBytes = 0;
  for (const [k, v] of Object.entries(items)) totalBytes += itemBytes(k, v);
  return { items, meta, totalBytes };
}

/**
 * Calcule les écritures nécessaires par rapport au contenu déjà présent :
 * fragments modifiés + meta, et clés obsolètes à supprimer.
 */
export function diffSync(previous: Record<string, unknown>, next: Record<string, unknown>): { set: Record<string, unknown>; remove: string[] } {
  const set: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(next)) {
    if (k === META_KEY || previous[k] !== v) set[k] = v;
  }
  const remove = Object.keys(previous).filter((k) => k.startsWith(`${SYNC_PREFIX}.`) && !(k in next));
  return { set, remove };
}

/** Recompose le document ; renvoie null si les fragments sont incomplets ou incohérents (écriture en cours ailleurs). */
export function joinSync(items: Record<string, unknown>): { json: string; meta: ChunkMeta } | null {
  const meta = items[META_KEY] as ChunkMeta | undefined;
  if (!meta || meta.v !== 1 || typeof meta.n !== 'number' || meta.n < 1) return null;
  let json = '';
  for (let i = 0; i < meta.n; i++) {
    const c = items[chunkKey(i)];
    if (typeof c !== 'string') return null;
    json += c;
  }
  if (json.length !== meta.size || hash(json) !== meta.hash) return null;
  return { json, meta };
}

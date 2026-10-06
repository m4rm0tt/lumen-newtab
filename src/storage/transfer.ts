// Export : le document, les données des widgets (w:*) et, si demandé, les images en base64.
// Les secrets (secret:*) et les caches restent dehors.
import type { SyncDoc } from '../types';
import { area } from './backend';
import { listBlobs, putBlob } from './blobs';
import { normalizeDoc } from './schema';

export const EXPORT_FORMAT = 1;

/** Préfixe des clés de storage.local qui contiennent des données de widgets. */
export const WIDGET_DATA_PREFIX = 'w:';
/** Clés locales jamais exportées (secrets, caches). */
const PRIVATE_PREFIXES = ['secret:', 'cache:'];

export interface ExportFile {
  app: 'lumen';
  format: number;
  exportedAt: string;
  doc: SyncDoc;
  local: Record<string, unknown>;
  blobs?: { id: string; name: string; type: string; data: string }[];
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  // Par tranches : String.fromCharCode(...grand tableau) dépasserait la pile.
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function base64ToBlob(data: string, type: string): Blob {
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

export async function buildExport(doc: SyncDoc, includeImages: boolean): Promise<ExportFile> {
  const all = await area('local').get(null);
  const local: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(all)) {
    if (k.startsWith(WIDGET_DATA_PREFIX) && !PRIVATE_PREFIXES.some((p) => k.startsWith(p))) local[k] = v;
  }
  const file: ExportFile = { app: 'lumen', format: EXPORT_FORMAT, exportedAt: new Date().toISOString(), doc, local };
  if (includeImages) {
    const blobs = await listBlobs().catch(() => []);
    file.blobs = await Promise.all(
      blobs.map(async (b) => ({ id: b.id, name: b.name, type: b.type, data: await blobToBase64(b.blob) })),
    );
  }
  return file;
}

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface ParsedImport {
  doc: SyncDoc;
  local: Record<string, unknown>;
  blobs: { id: string; name: string; type: string; data: string }[];
  summary: { groups: number; shortcuts: number; widgets: number; images: number };
}

const MAX_IMPORT_BYTES = 200 * 1024 * 1024;

export async function parseImport(file: File): Promise<ParsedImport> {
  if (file.size > MAX_IMPORT_BYTES) throw new Error('Fichier trop volumineux.');
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    throw new Error("Ce fichier n'est pas un JSON valide.");
  }
  if (typeof raw !== 'object' || raw === null || (raw as ExportFile).app !== 'lumen') {
    throw new Error("Ce fichier ne provient pas d'un export Lumen.");
  }
  const f = raw as Partial<ExportFile>;
  if (typeof f.format !== 'number' || f.format > EXPORT_FORMAT) {
    throw new Error('Ce fichier vient d’une version plus récente de Lumen. Mettez l’extension à jour.');
  }
  const doc = normalizeDoc(f.doc);
  const local: Record<string, unknown> = {};
  if (f.local && typeof f.local === 'object') {
    for (const [k, v] of Object.entries(f.local)) if (k.startsWith(WIDGET_DATA_PREFIX)) local[k] = v;
  }
  const blobs = Array.isArray(f.blobs)
    ? f.blobs.filter(
        (b) => b && typeof b.id === 'string' && typeof b.data === 'string' && typeof b.type === 'string' && b.type.startsWith('image/'),
      )
    : [];
  return {
    doc,
    local,
    blobs,
    summary: {
      groups: doc.groups.length,
      shortcuts: doc.groups.reduce((n, g) => n + g.shortcuts.length, 0),
      widgets: doc.widgets.length,
      images: blobs.length,
    },
  };
}

/** Restaure les données locales et les images ; le document est appliqué par le store. */
export async function applyImportSideData(parsed: ParsedImport): Promise<void> {
  if (Object.keys(parsed.local).length) await area('local').set(parsed.local);
  for (const b of parsed.blobs) {
    await putBlob(base64ToBlob(b.data, b.type), b.name, b.id);
  }
}

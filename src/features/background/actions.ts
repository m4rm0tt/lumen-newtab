import { settings, updateSettings, doc } from '../../state/store';
import { putBlob } from '../../storage/blobs';
import { analyzeImage, isAcceptedImage, MAX_IMAGE_BYTES } from '../../lib/image';
import { readLocal, writeLocal } from '../../state/local';
import { toast, undoToast } from '../../app/ui';
import type { BackgroundSettings } from '../../types';

export const BOOT_THUMB_KEY = 'lumen:bgthumb';
export const RECENTS_KEY = 'bg:recent';
const MAX_RECENTS = 8;

export interface RecentImage {
  id: string;
  name: string;
  luminance: number;
  thumb: string;
  type: string;
}

export function readBootThumb(id: string | undefined): string | null {
  if (!id) return null;
  try {
    const raw = JSON.parse(localStorage.getItem(BOOT_THUMB_KEY) ?? 'null') as { id: string; thumb: string } | null;
    return raw?.id === id ? raw.thumb : null;
  } catch {
    return null;
  }
}

function writeBootThumb(id: string, thumb: string) {
  try {
    localStorage.setItem(BOOT_THUMB_KEY, JSON.stringify({ id, thumb }));
  } catch {
    /* facultatif */
  }
}

export async function getRecents(): Promise<RecentImage[]> {
  return readLocal<RecentImage[]>(RECENTS_KEY, []);
}

async function addRecent(r: RecentImage) {
  const list = (await getRecents()).filter((x) => x.id !== r.id);
  await writeLocal(RECENTS_KEY, [r, ...list].slice(0, MAX_RECENTS));
}

export async function removeRecent(id: string) {
  const list = (await getRecents()).filter((x) => x.id !== id);
  await writeLocal(RECENTS_KEY, list);
}

/** Importe une image ou un GIF et l'applique comme fond. */
export async function setBackgroundFromFile(file: File, opts: { undoable?: boolean } = {}): Promise<boolean> {
  if (!isAcceptedImage(file)) {
    toast('Ce format n’est pas pris en charge (PNG, JPEG, WebP, GIF, AVIF, SVG).', { tone: 'error' });
    return false;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    toast('Image trop lourde (40 Mo maximum).', { tone: 'error' });
    return false;
  }
  try {
    const analysis = await analyzeImage(file);
    const id = await putBlob(file, file.name);
    writeBootThumb(id, analysis.thumb);
    await addRecent({ id, name: file.name, luminance: analysis.luminance, thumb: analysis.thumb, type: file.type });
    const previous = settings.value.background;
    applyImage({ id, name: file.name, luminance: analysis.luminance, thumb: analysis.thumb, type: file.type });
    if (opts.undoable) undoToast('Arrière-plan modifié', () => updateSettings('background', previous));
    return true;
  } catch {
    toast("Impossible de lire cette image.", { tone: 'error' });
    return false;
  }
}

export function applyImage(r: RecentImage) {
  writeBootThumb(r.id, r.thumb);
  const patch: Partial<BackgroundSettings> = { type: 'image', imageId: r.id, imageName: r.name, imageLuminance: r.luminance };
  updateSettings('background', patch);
}

/** Identifiants d'images à conserver lors du ménage IndexedDB. */
export async function protectedBlobIds(): Promise<Set<string>> {
  const ids = new Set((await getRecents()).map((r) => r.id));
  const bg = doc.value.settings.background;
  if (bg.imageId) ids.add(bg.imageId);
  return ids;
}

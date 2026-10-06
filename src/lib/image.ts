export const MAX_IMAGE_BYTES = 40 * 1024 * 1024;
export const ACCEPTED_IMAGES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml'];

export function isAcceptedImage(file: File | Blob): boolean {
  return ACCEPTED_IMAGES.includes(file.type);
}

async function decode(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window && blob.type !== 'image/svg+xml') {
    try {
      return await createImageBitmap(blob);
    } catch {
      /* repli sur <img> */
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export interface ImageAnalysis {
  /** Miniature JPEG de 1 à 3 Ko en data URL, affichée au premier rendu. */
  thumb: string;
  /** Luminance moyenne 0..1. */
  luminance: number;
  width: number;
  height: number;
}

/** Pour un GIF, analyse la première image : suffisant pour le contraste. */
export async function analyzeImage(blob: Blob): Promise<ImageAnalysis> {
  const img = await decode(blob);
  const w = 'naturalWidth' in img ? img.naturalWidth : img.width;
  const h = 'naturalHeight' in img ? img.naturalHeight : img.height;
  const tw = 48;
  const th = Math.max(1, Math.round((h / Math.max(1, w)) * tw));
  const canvas = document.createElement('canvas');
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { thumb: '', luminance: 0.3, width: w, height: h };
  ctx.drawImage(img, 0, 0, tw, th);
  const { data } = ctx.getImageData(0, 0, tw, th);
  let sum = 0;
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  for (let i = 0; i < data.length; i += 4) sum += 0.2126 * lin(data[i]) + 0.7152 * lin(data[i + 1]) + 0.0722 * lin(data[i + 2]);
  const luminance = sum / (data.length / 4);
  if ('close' in img) img.close();
  return { thumb: canvas.toDataURL('image/jpeg', 0.6), luminance, width: w, height: h };
}

/** Réduit une image (icône personnalisée) à une taille raisonnable, en PNG. */
export async function downscale(blob: Blob, max = 128): Promise<Blob> {
  if (blob.type === 'image/svg+xml' || blob.type === 'image/gif') return blob;
  const img = await decode(blob);
  const w = 'naturalWidth' in img ? img.naturalWidth : img.width;
  const h = 'naturalHeight' in img ? img.naturalHeight : img.height;
  const scale = Math.min(1, max / Math.max(w, h));
  if (scale === 1) return blob;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? blob), 'image/png'));
}

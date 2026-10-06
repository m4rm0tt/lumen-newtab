import { useEffect, useState } from 'preact/hooks';
import type { IconRef } from '../types';
import { knownFavicon, resolveFavicon } from '../lib/favicon';
import { colorForText } from '../lib/color';
import { hostnameOf } from '../lib/url';
import { blobUrl } from '../storage/blobs';
import { Symbol } from './Icon';

export function monogramFor(title: string, url: string): string {
  const base = (title || hostnameOf(url)).trim();
  const words = base.split(/[\s\-_.]+/).filter(Boolean);
  if (words.length >= 2 && words[0].length + words[1].length <= 10) return (words[0][0] + words[1][0]).toUpperCase();
  return (Array.from(base)[0] ?? '?').toUpperCase();
}

interface Props {
  icon: IconRef;
  title: string;
  url: string;
  color?: string;
  size: number;
}

/** Contenu de la plaque d'icône. La plaque elle-même est stylée par le parent. */
export function ShortcutIcon({ icon, title, url, color, size }: Props) {
  const glyph = Math.round(size * 0.5);

  if (icon.kind === 'emoji') {
    return <span class="sc-emoji" style={{ fontSize: `${Math.round(size * 0.52)}px` }} aria-hidden="true">{icon.value}</span>;
  }
  if (icon.kind === 'symbol') {
    return (
      <span class="sc-symbol" style={color ? { color: '#fff' } : undefined} aria-hidden="true">
        <Symbol name={icon.name} size={glyph} strokeWidth={1.8} />
      </span>
    );
  }
  if (icon.kind === 'image') return <BlobImage id={icon.blobId} size={size} fallback={<Monogram text={monogramFor(title, url)} color={color} size={size} />} />;
  if (icon.kind === 'url') return <RemoteImage src={icon.src} size={size} fallback={<Monogram text={monogramFor(title, url)} color={color} size={size} />} />;
  if (icon.kind === 'monogram') return <Monogram text={icon.text || monogramFor(title, url)} color={color} size={size} />;
  return <Favicon url={url} size={size} fallback={<Monogram text={monogramFor(title, url)} color={color} size={size} />} />;
}

/** La tuile a-t-elle besoin d'une plaque colorée (monogramme) plutôt que neutre ? */
export function usesColoredPlate(icon: IconRef): boolean {
  return icon.kind === 'monogram' || icon.kind === 'symbol';
}

export function Monogram({ text, color, size }: { text: string; color?: string; size: number }) {
  const bg = color ?? colorForText(text);
  return (
    <span class="sc-monogram" style={{ '--mono': bg, fontSize: `${Math.round(size * (text.length > 1 ? 0.36 : 0.44))}px` } as Record<string, string>} aria-hidden="true">
      {text}
    </span>
  );
}

function Favicon({ url, size, fallback }: { url: string; size: number; fallback: preact.ComponentChildren }) {
  const px = size > 48 ? 64 : 32;
  const [src, setSrc] = useState<string | null | undefined>(() => knownFavicon(url, px));
  useEffect(() => {
    let alive = true;
    if (src === undefined) resolveFavicon(url, px).then((s) => alive && setSrc(s));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, px]);
  if (!src) return <>{fallback}</>;
  return <img class="sc-favicon" src={src} width={Math.round(size * 0.5)} height={Math.round(size * 0.5)} alt="" draggable={false} decoding="async" />;
}

function BlobImage({ id, size, fallback }: { id: string; size: number; fallback: preact.ComponentChildren }) {
  const [src, setSrc] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    blobUrl(id).then((u) => alive && setSrc(u));
    return () => {
      alive = false;
    };
  }, [id]);
  if (src === null) return <>{fallback}</>;
  if (!src) return null;
  return <img class="sc-image" src={src} width={size} height={size} alt="" draggable={false} />;
}

function RemoteImage({ src, size, fallback }: { src: string; size: number; fallback: preact.ComponentChildren }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  return <img class="sc-image" src={src} width={size} height={size} alt="" draggable={false} referrerpolicy="no-referrer" onError={() => setFailed(true)} />;
}

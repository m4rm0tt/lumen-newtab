export type RGB = [number, number, number];

export function parseHex(hex: string): RGB | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function toHex([r, g, b]: RGB): string {
  return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}

/** Luminance relative WCAG (0 = noir, 1 = blanc). */
export function luminance([r, g, b]: RGB): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function hexLuminance(hex: string, fallback = 0.2): number {
  const rgb = parseHex(hex);
  return rgb ? luminance(rgb) : fallback;
}

export function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function isValidHex(v: string): boolean {
  return parseHex(v) !== null;
}

/** Palette douce pour les monogrammes : stable pour un même texte. */
const MONOGRAM_PALETTE = [
  '#FF6B6B', '#F59E0B', '#22C55E', '#14B8A6', '#0EA5E9', '#6366F1',
  '#A855F7', '#EC4899', '#F97316', '#84CC16', '#06B6D4', '#8B5CF6',
];

export function colorForText(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return MONOGRAM_PALETTE[h % MONOGRAM_PALETTE.length];
}

/** Couleurs d'accent inspirées de macOS. */
export const ACCENTS: { name: string; value: string }[] = [
  { name: 'Bleu', value: '#0A84FF' },
  { name: 'Violet', value: '#BF5AF2' },
  { name: 'Rose', value: '#FF375F' },
  { name: 'Rouge', value: '#FF453A' },
  { name: 'Orange', value: '#FF9F0A' },
  { name: 'Jaune', value: '#FFD60A' },
  { name: 'Vert', value: '#30D158' },
  { name: 'Menthe', value: '#63E6E2' },
  { name: 'Graphite', value: '#8E8E93' },
];

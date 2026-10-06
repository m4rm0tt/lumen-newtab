// Les réglages d'apparence deviennent des variables CSS sur <html>. Bouger un curseur
// ne re-rend aucun composant.
import { effect, computed, signal } from '@preact/signals';
import { settings } from '../state/store';
import { hexLuminance, parseHex } from '../lib/color';
import { presetById } from '../features/background/presets';
import type { BackgroundSettings, Settings } from '../types';

const systemDark = signal(typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches);
if (typeof matchMedia !== 'undefined') {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => (systemDark.value = e.matches));
}

/** Le fond est-il sombre ? Sert au choix automatique de la couleur du texte. */
export function backgroundIsDark(bg: BackgroundSettings, imageAvailable = true): boolean {
  let lum: number;
  switch (bg.type) {
    case 'preset':
      return presetById(bg.preset).tone === 'dark' || bg.overlay === 'dark' && bg.overlayOpacity > 0.45;
    case 'color':
      lum = hexLuminance(bg.color);
      break;
    case 'gradient':
      lum = (hexLuminance(bg.gradient.from) + hexLuminance(bg.gradient.to)) / 2;
      break;
    case 'image':
      if (!imageAvailable || !bg.imageId) return presetById(bg.preset).tone === 'dark';
      lum = (bg.imageLuminance ?? 0.25) * bg.brightness;
      break;
    case 'url':
      lum = 0.25 * bg.brightness; // inconnu : on suppose une photo plutôt sombre + voile
      break;
  }
  // Effet du voile coloré.
  const target = bg.overlay === 'dark' ? 0 : 1;
  lum = lum + (target - lum) * bg.overlayOpacity;
  return lum < 0.36;
}

export const imageMissing = signal(false);

/** Ton du tableau de bord : 'light' = texte clair sur fond sombre. */
export const tone = computed<'light' | 'dark'>(() => {
  const s = settings.value;
  if (s.tone !== 'auto') return s.tone;
  return backgroundIsDark(s.background, !imageMissing.value) ? 'light' : 'dark';
});

export const uiTheme = computed<'light' | 'dark'>(() => {
  const t = settings.value.theme;
  return t === 'auto' ? (systemDark.value ? 'dark' : 'light') : t;
});

const FONTS: Record<Settings['font'], string> = {
  system: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI Variable Text", "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif`,
  rounded: `ui-rounded, "SF Pro Rounded", "Hiragino Maru Gothic ProN", Quicksand, Nunito, "Varela Round", -apple-system, "Segoe UI", sans-serif`,
  serif: `ui-serif, "New York", "Iowan Old Style", "Charter", Georgia, Cambria, "Times New Roman", serif`,
  mono: `ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, "Liberation Mono", monospace`,
};

const WIDTHS = { compact: '760px', normal: '980px', wide: '1240px' };

export function startTheme(root = document.documentElement) {
  return effect(() => {
    const s = settings.value;
    const t = tone.value;
    const ui = uiTheme.value;
    const c = s.cards;
    const v: Record<string, string> = {
      '--accent': s.accent,
      '--accent-rgb': (parseHex(s.accent) ?? [10, 132, 255]).join(' '),
      '--font': FONTS[s.font],
      '--content-width': WIDTHS[s.layout.width],
      '--space': String(s.layout.spacing),
      '--tile': `${s.shortcuts.size}px`,
      '--clock-scale': String(s.clock.scale),
      '--clock-weight': String(s.clock.weight),
      '--card-opacity': String(c.opacity),
      '--card-blur': `${c.style === 'glass' ? c.blur : 0}px`,
      '--radius': `${c.radius}px`,
    };
    for (const [k, val] of Object.entries(v)) root.style.setProperty(k, val);
    root.dataset.tone = t;
    root.dataset.theme = ui;
    root.dataset.cards = c.style;
    root.dataset.font = s.font;
    root.dataset.motion = s.reduceMotion === 'on' ? 'reduced' : 'system';
    root.style.colorScheme = ui;
  });
}

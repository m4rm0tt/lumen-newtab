// Tout ce qui entre (stockage, autre appareil, import) passe par normalizeDoc() : champs
// inconnus ignorés, valeurs invalides remplacées, nombres bornés.
import type { Group, IconRef, Settings, Shortcut, SyncDoc, WidgetInstance, WidgetSize } from '../types';
import { DEFAULT_SETTINGS, SCHEMA_VERSION, defaultDoc } from '../state/defaults';
import { uid } from '../lib/id';
import { normalizeUrl } from '../lib/url';

export { SCHEMA_VERSION };

export const LIMITS = {
  groups: 40,
  shortcutsPerGroup: 120,
  widgets: 30,
  text: 200,
  url: 2048,
};

type Migration = (doc: Record<string, unknown>) => Record<string, unknown>;

/**
 * migrations[n] transforme un document de version n en version n + 1.
 * Ajouter ici une entrée à chaque changement de format, sans jamais modifier les anciennes.
 */
export const MIGRATIONS: Record<number, Migration> = {};

export function migrate(raw: Record<string, unknown>, migrations = MIGRATIONS, target = SCHEMA_VERSION): Record<string, unknown> {
  let doc = raw;
  let v = typeof doc.schemaVersion === 'number' ? doc.schemaVersion : 1;
  while (v < target) {
    const step = migrations[v];
    if (step) doc = step(doc);
    v += 1;
    doc = { ...doc, schemaVersion: v };
  }
  return doc;
}

// ---------------------------------------------------------------------------
// Contraintes sur les réglages : énumérations et bornes numériques par chemin.

const ENUMS: Record<string, readonly unknown[]> = {
  theme: ['auto', 'light', 'dark'],
  tone: ['auto', 'light', 'dark'],
  font: ['system', 'rounded', 'serif', 'mono'],
  reduceMotion: ['system', 'on'],
  'clock.format': ['auto', '24', '12'],
  'clock.weight': [200, 300, 400, 600],
  'clock.dateStyle': ['full', 'long', 'short'],
  'shortcuts.display': ['tabs', 'sections'],
  'shortcuts.style': ['tile', 'plain'],
  'layout.hero': ['center', 'top'],
  'layout.widgets': ['bottom', 'left', 'right'],
  'layout.width': ['compact', 'normal', 'wide'],
  'cards.style': ['glass', 'solid', 'clear'],
  'background.type': ['preset', 'color', 'gradient', 'image', 'url'],
  'background.fit': ['cover', 'contain'],
  'background.position': ['center', 'top', 'bottom', 'left', 'right', 'top left', 'top right', 'bottom left', 'bottom right'],
  'background.overlay': ['dark', 'light'],
};

const RANGES: Record<string, [number, number]> = {
  'clock.scale': [0.5, 2],
  'shortcuts.size': [40, 88],
  'shortcuts.columns': [0, 12],
  'layout.spacing': [0.6, 1.6],
  'cards.opacity': [0, 1],
  'cards.blur': [0, 40],
  'cards.radius': [0, 32],
  'background.brightness': [0.3, 1.3],
  'background.blur': [0, 40],
  'background.overlayOpacity': [0, 0.8],
  'background.gradient.angle': [0, 360],
  'background.imageLuminance': [0, 1],
};

const OPTIONAL_KEYS = new Set(['background.imageId', 'background.imageName', 'background.imageLuminance']);

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: unknown, fallback: string, max = LIMITS.text): string {
  return typeof v === 'string' ? v.slice(0, max) : fallback;
}

/** Fusionne récursivement `raw` sur la forme de `defaults`, en validant chaque feuille. */
function mergeShape(defaults: Record<string, unknown>, raw: unknown, path: string): Record<string, unknown> {
  const src = isObj(raw) ? raw : {};
  const out: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(defaults)) {
    const p = path ? `${path}.${key}` : key;
    out[key] = mergeValue(def, src[key], p);
  }
  for (const key of Object.keys(src)) {
    const p = path ? `${path}.${key}` : key;
    if (OPTIONAL_KEYS.has(p) && !(key in out)) {
      const v = src[key];
      if (RANGES[p] && typeof v === 'number' && Number.isFinite(v)) out[key] = Math.min(RANGES[p][1], Math.max(RANGES[p][0], v));
      else if (typeof v === 'string') out[key] = v.slice(0, LIMITS.text);
    }
  }
  return out;
}

function mergeValue(def: unknown, v: unknown, path: string): unknown {
  if (ENUMS[path]) return ENUMS[path].includes(v) ? v : def;
  if (isObj(def)) return mergeShape(def, v, path);
  if (typeof def === 'number') {
    if (typeof v !== 'number' || !Number.isFinite(v)) return def;
    const r = RANGES[path];
    return r ? Math.min(r[1], Math.max(r[0], v)) : v;
  }
  if (typeof def === 'boolean') return typeof v === 'boolean' ? v : def;
  if (typeof def === 'string') return str(v, def, path === 'background.url' || path === 'search.customUrl' ? LIMITS.url : LIMITS.text);
  return def;
}

export function normalizeSettings(raw: unknown): Settings {
  return mergeShape(DEFAULT_SETTINGS as unknown as Record<string, unknown>, raw, '') as unknown as Settings;
}

// ---------------------------------------------------------------------------

export function normalizeIcon(raw: unknown, fallback: IconRef = { kind: 'auto' }): IconRef {
  if (!isObj(raw)) return fallback;
  switch (raw.kind) {
    case 'auto':
      return { kind: 'auto' };
    case 'monogram':
      return typeof raw.text === 'string' && raw.text ? { kind: 'monogram', text: raw.text.slice(0, 3) } : { kind: 'monogram' };
    case 'emoji':
      return typeof raw.value === 'string' && raw.value ? { kind: 'emoji', value: raw.value.slice(0, 16) } : fallback;
    case 'symbol':
      return typeof raw.name === 'string' && raw.name ? { kind: 'symbol', name: raw.name.slice(0, 40) } : fallback;
    case 'image':
      return typeof raw.blobId === 'string' && raw.blobId ? { kind: 'image', blobId: raw.blobId.slice(0, 64) } : fallback;
    case 'url': {
      const src = typeof raw.src === 'string' ? normalizeUrl(raw.src) : null;
      return src && /^https?:/.test(src) ? { kind: 'url', src: src.slice(0, LIMITS.url) } : fallback;
    }
    default:
      return fallback;
  }
}

const HEX_RE = /^#[0-9a-f]{6}$/i;

function normalizeShortcut(raw: unknown, seen: Set<string>): Shortcut | null {
  if (!isObj(raw)) return null;
  const url = typeof raw.url === 'string' ? normalizeUrl(raw.url) : null;
  if (!url) return null;
  let id = str(raw.id, '', 64);
  if (!id || seen.has(id)) id = uid('s_');
  seen.add(id);
  const s: Shortcut = {
    id,
    title: str(raw.title, '').trim() || url,
    url: url.slice(0, LIMITS.url),
    icon: normalizeIcon(raw.icon),
  };
  if (typeof raw.color === 'string' && HEX_RE.test(raw.color)) s.color = raw.color;
  return s;
}

function normalizeGroup(raw: unknown, seen: Set<string>): Group | null {
  if (!isObj(raw)) return null;
  let id = str(raw.id, '', 64);
  if (!id || seen.has(id)) id = uid('g_');
  seen.add(id);
  const shortcuts = Array.isArray(raw.shortcuts)
    ? raw.shortcuts
        .map((s) => normalizeShortcut(s, seen))
        .filter((s): s is Shortcut => s !== null)
        .slice(0, LIMITS.shortcutsPerGroup)
    : [];
  const g: Group = {
    id,
    name: str(raw.name, '').trim() || 'Groupe',
    icon: normalizeIcon(raw.icon, { kind: 'symbol', name: 'folder' }),
    shortcuts,
  };
  if (typeof raw.accent === 'string' && HEX_RE.test(raw.accent)) g.accent = raw.accent;
  return g;
}

const SIZES: WidgetSize[] = ['s', 'm', 'l', 't'];

function normalizeWidget(raw: unknown, seen: Set<string>): WidgetInstance | null {
  if (!isObj(raw) || typeof raw.type !== 'string' || !raw.type) return null;
  let id = str(raw.id, '', 64);
  if (!id || seen.has(id)) id = uid('w_');
  seen.add(id);
  return {
    id,
    type: raw.type.slice(0, 40),
    size: SIZES.includes(raw.size as WidgetSize) ? (raw.size as WidgetSize) : 's',
    // La config est revalidée par chaque widget ; on garantit seulement un objet JSON.
    config: isObj(raw.config) ? (JSON.parse(JSON.stringify(raw.config)) as Record<string, unknown>) : {},
  };
}

/** Transforme n'importe quelle entrée en SyncDoc valide. Ne lève jamais d'exception. */
export function normalizeDoc(input: unknown): SyncDoc {
  if (!isObj(input)) return defaultDoc();
  let raw: Record<string, unknown>;
  try {
    raw = migrate(input);
  } catch {
    return defaultDoc();
  }
  const seen = new Set<string>();
  const groups = Array.isArray(raw.groups)
    ? raw.groups
        .map((g) => normalizeGroup(g, seen))
        .filter((g): g is Group => g !== null)
        .slice(0, LIMITS.groups)
    : defaultDoc().groups;
  const widgets = Array.isArray(raw.widgets)
    ? raw.widgets
        .map((w) => normalizeWidget(w, seen))
        .filter((w): w is WidgetInstance => w !== null)
        .slice(0, LIMITS.widgets)
    : [];
  const active = typeof raw.activeGroupId === 'string' && groups.some((g) => g.id === raw.activeGroupId)
    ? raw.activeGroupId
    : groups[0]?.id ?? null;
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt) ? raw.updatedAt : 0,
    writer: str(raw.writer, '', 64),
    settings: normalizeSettings(raw.settings),
    groups,
    activeGroupId: active,
    widgets,
  };
}

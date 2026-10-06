// Chaque widget est importé à la demande : tant qu'on ne l'ajoute pas, il ne coûte rien.
import type { WidgetDefinition, WidgetModule } from './types';
import { widgetKey } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyDef = WidgetDefinition<any>;

const str = (v: unknown, d: string) => (typeof v === 'string' ? v : d);
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
const num = (v: unknown, d: number, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d);
const strArr = (v: unknown, d: string[], max = 20) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, max) : d);

export const WIDGETS: AnyDef[] = [
  {
    type: 'notes',
    name: 'Notes',
    description: 'Un bloc-notes enregistré automatiquement.',
    icon: 'pen',
    category: 'productivite',
    sizes: ['s', 'm', 't', 'l'],
    defaultSize: 't',
    defaultConfig: { title: 'Notes' },
    normalize: (r) => ({ title: str(r.title, 'Notes').slice(0, 40) }),
    title: (c) => c.title,
    dataKeys: (id) => [widgetKey(id)],
    load: () => import('./notes') as Promise<WidgetModule<any>>,
  },
  {
    type: 'todo',
    name: 'Tâches',
    description: 'Une liste de choses à faire, simple et rapide.',
    icon: 'target',
    category: 'productivite',
    sizes: ['s', 'm', 't', 'l'],
    defaultSize: 't',
    defaultConfig: { title: 'À faire', hideDone: false },
    normalize: (r) => ({ title: str(r.title, 'À faire').slice(0, 40), hideDone: bool(r.hideDone, false) }),
    title: (c) => c.title,
    dataKeys: (id) => [widgetKey(id)],
    load: () => import('./todo') as Promise<WidgetModule<any>>,
  },
  {
    type: 'calendar',
    name: 'Calendrier',
    description: 'Le mois en cours, la semaine et les numéros de semaine.',
    icon: 'calendar',
    category: 'essentiels',
    sizes: ['s', 't', 'l'],
    defaultSize: 't',
    defaultConfig: { weekNumbers: false },
    normalize: (r) => ({ weekNumbers: bool(r.weekNumbers, false) }),
    load: () => import('./calendar') as Promise<WidgetModule<any>>,
  },
  {
    type: 'timer',
    name: 'Minuteur & Pomodoro',
    description: 'Compte à rebours et cycles de concentration, partagés entre onglets.',
    icon: 'clock',
    category: 'productivite',
    sizes: ['s', 'm'],
    defaultSize: 's',
    defaultConfig: { focus: 25, short: 5, long: 15, sound: true },
    normalize: (r) => ({
      focus: num(r.focus, 25, 1, 180),
      short: num(r.short, 5, 1, 60),
      long: num(r.long, 15, 1, 90),
      sound: bool(r.sound, true),
    }),
    dataKeys: (id) => [widgetKey(id)],
    load: () => import('./timer') as Promise<WidgetModule<any>>,
  },
  {
    type: 'worldclock',
    name: 'Horloges du monde',
    description: "L'heure dans d'autres villes, avec le décalage.",
    icon: 'earth',
    category: 'essentiels',
    sizes: ['s', 'm', 't'],
    defaultSize: 's',
    defaultConfig: { zones: [{ tz: 'America/New_York', label: 'New York' }, { tz: 'Asia/Tokyo', label: 'Tokyo' }] },
    normalize: (r) => ({
      zones: Array.isArray(r.zones)
        ? (r.zones as unknown[])
            .filter((z): z is { tz: string; label: string } => !!z && typeof (z as { tz?: unknown }).tz === 'string')
            .map((z) => ({ tz: z.tz, label: str(z.label, z.tz).slice(0, 30) }))
            .slice(0, 8)
        : [],
    }),
    load: () => import('./worldclock') as Promise<WidgetModule<any>>,
  },
  {
    type: 'weather',
    name: 'Météo',
    description: 'Conditions actuelles et prévisions, sans clé ni compte.',
    icon: 'sun',
    category: 'infos',
    sizes: ['s', 'm', 'l'],
    defaultSize: 's',
    defaultConfig: { place: null, unit: 'c' },
    normalize: (r) => {
      const p = r.place as Record<string, unknown> | null;
      const place =
        p && typeof p.lat === 'number' && typeof p.lon === 'number'
          ? { name: str(p.name, '').slice(0, 60), country: str(p.country, '').slice(0, 60), lat: p.lat, lon: p.lon }
          : null;
      return { place, unit: r.unit === 'f' ? 'f' : 'c' };
    },
    network: ['open-meteo.com'],
    load: () => import('./weather') as Promise<WidgetModule<any>>,
  },
  {
    type: 'rss',
    name: 'Actualités (RSS)',
    description: 'Les derniers articles de vos flux RSS ou Atom.',
    icon: 'rss',
    category: 'infos',
    sizes: ['m', 't', 'l'],
    defaultSize: 't',
    defaultConfig: { title: 'Actualités', feeds: [], max: 10 },
    normalize: (r) => ({ title: str(r.title, 'Actualités').slice(0, 40), feeds: strArr(r.feeds, [], 10), max: num(r.max, 10, 3, 30) }),
    title: (c) => c.title,
    network: ['les sites des flux choisis'],
    load: () => import('./rss') as Promise<WidgetModule<any>>,
  },
  {
    type: 'crypto',
    name: 'Crypto',
    description: 'Cours et variation sur 24 h, avec mini-graphique 7 jours.',
    icon: 'bitcoin',
    category: 'infos',
    sizes: ['s', 'm', 't'],
    defaultSize: 's',
    defaultConfig: { coins: ['bitcoin', 'ethereum', 'solana'], currency: 'eur' },
    normalize: (r) => ({ coins: strArr(r.coins, ['bitcoin', 'ethereum'], 12), currency: str(r.currency, 'eur').slice(0, 5) }),
    network: ['api.coingecko.com'],
    load: () => import('./crypto') as Promise<WidgetModule<any>>,
  },
  {
    type: 'stocks',
    name: 'Bourse',
    description: 'Cotations d’actions et d’ETF via Finnhub.',
    icon: 'chart',
    category: 'infos',
    sizes: ['s', 'm', 't'],
    defaultSize: 's',
    defaultConfig: { symbols: ['AAPL', 'MSFT', 'NVDA'] },
    normalize: (r) => ({ symbols: strArr(r.symbols, ['AAPL'], 12).map((s) => s.toUpperCase().slice(0, 15)) }),
    network: ['finnhub.io'],
    requirement: 'Clé gratuite Finnhub',
    load: () => import('./stocks') as Promise<WidgetModule<any>>,
  },
  {
    type: 'github',
    name: 'GitHub',
    description: 'Profil, dépôts récents et, avec un jeton, contributions et revues en attente.',
    icon: 'git-branch',
    category: 'integrations',
    sizes: ['s', 'm', 'l'],
    defaultSize: 'm',
    defaultConfig: { username: '' },
    normalize: (r) => ({ username: str(r.username, '').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 39) }),
    network: ['api.github.com'],
    requirement: 'Jeton facultatif',
    load: () => import('./github') as Promise<WidgetModule<any>>,
  },
  {
    type: 'spotify',
    name: 'Spotify',
    description: 'Le titre en cours et les commandes de lecture.',
    icon: 'headphones',
    category: 'integrations',
    sizes: ['s', 'm'],
    defaultSize: 'm',
    defaultConfig: { clientId: '' },
    normalize: (r) => ({ clientId: str(r.clientId, '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 64) }),
    network: ['accounts.spotify.com', 'api.spotify.com'],
    requirement: 'Application Spotify (Client ID)',
    load: () => import('./spotify') as Promise<WidgetModule<any>>,
  },
  {
    type: 'custom',
    name: 'Widget personnalisé',
    description: 'Une page intégrée, des valeurs tirées d’une API JSON, ou un texte.',
    icon: 'sparkles',
    category: 'perso',
    sizes: ['s', 'm', 't', 'l'],
    defaultSize: 'm',
    defaultConfig: { mode: 'text', title: 'Mon widget', text: '', url: '', fields: [], refresh: 15 },
    network: ['l’adresse que vous indiquez'],
    load: () => import('./custom') as Promise<WidgetModule<any>>,
  },
];

const byType = new Map(WIDGETS.map((w) => [w.type, w]));

export function getWidgetDef(type: string): AnyDef | undefined {
  return byType.get(type);
}

export function normalizeConfig(def: AnyDef, raw: Record<string, unknown>): any {
  if (def.normalize) return def.normalize({ ...def.defaultConfig, ...raw });
  return { ...def.defaultConfig, ...raw };
}

const moduleCache = new Map<string, Promise<WidgetModule<any>>>();

export function loadWidget(def: AnyDef): Promise<WidgetModule<any>> {
  let p = moduleCache.get(def.type);
  if (!p) {
    p = def.load();
    // En cas d'échec (rare : extension mise à jour pendant que l'onglet est ouvert), permettre de réessayer.
    p.catch(() => moduleCache.delete(def.type));
    moduleCache.set(def.type, p);
  }
  return p;
}

export const CATEGORY_LABELS: Record<string, string> = {
  essentiels: 'Essentiels',
  productivite: 'Productivité',
  infos: 'Informations',
  integrations: 'Intégrations',
  perso: 'Personnalisé',
};

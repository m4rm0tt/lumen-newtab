// Le contrat d'un widget. Le reste de l'appli ne connaît que ça : ajouter un widget, c'est
// ajouter une entrée dans registry.ts.
import type { ComponentType } from 'preact';
import type { WidgetInstance, WidgetSize } from '../types';

export type WidgetCategory = 'essentiels' | 'productivite' | 'infos' | 'integrations' | 'perso';

export interface WidgetProps<C> {
  instance: WidgetInstance;
  config: C;
  setConfig: (patch: Partial<C>) => void;
  size: WidgetSize;
  /** Ouvre la fenêtre de réglages du widget. */
  openSettings: () => void;
}

export interface WidgetSettingsProps<C> {
  instance: WidgetInstance;
  config: C;
  setConfig: (patch: Partial<C>) => void;
}

export interface WidgetModule<C> {
  default: ComponentType<WidgetProps<C>>;
  Settings?: ComponentType<WidgetSettingsProps<C>>;
}

export interface WidgetDefinition<C = Record<string, unknown>> {
  type: string;
  name: string;
  description: string;
  /** Nom d'un symbole de la bibliothèque d'icônes. */
  icon: string;
  category: WidgetCategory;
  sizes: WidgetSize[];
  defaultSize: WidgetSize;
  defaultConfig: C;
  /** Valide la config venant du stockage ; par défaut, fusion superficielle avec defaultConfig. */
  normalize?: (raw: Record<string, unknown>) => C;
  /** Titre affiché dans l'en-tête (peut dépendre de la config). */
  title?: (config: C) => string;
  /** Services externes contactés (transparence : affiché dans la bibliothèque). */
  network?: string[];
  /** Ce qu'il faut à l'utilisateur pour l'activer (clé, compte…). */
  requirement?: string;
  /** Clés de storage.local à supprimer quand le widget est retiré. */
  dataKeys?: (id: string) => string[];
  load: () => Promise<WidgetModule<C>>;
}

/** Clé de données locales d'un widget (préfixe exporté avec la configuration). */
export function widgetKey(id: string, suffix = ''): string {
  return `w:${id}${suffix ? `:${suffix}` : ''}`;
}

/** Clé de cache réseau (jamais exportée). */
export function cacheKey(...parts: (string | number)[]): string {
  return `cache:${parts.join(':')}`;
}

/** Clé de secret local (jeton, clé d'API) : jamais synchronisée ni exportée. */
export function secretKey(name: string): string {
  return `secret:${name}`;
}

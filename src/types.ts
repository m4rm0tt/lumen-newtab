// Le SyncDoc doit rester léger pour tenir dans storage.sync. Les images n'y figurent que
// par leur identifiant IndexedDB.
export type ID = string;

/** Icône d'un raccourci ou d'un groupe. */
export type IconRef =
  | { kind: 'auto' } // favicon si Chrome la connaît, sinon monogramme
  | { kind: 'monogram'; text?: string }
  | { kind: 'emoji'; value: string }
  | { kind: 'symbol'; name: string } // icône de la bibliothèque intégrée
  | { kind: 'image'; blobId: ID } // image importée, locale à l'appareil
  | { kind: 'url'; src: string }; // image distante choisie par l'utilisateur

export interface Shortcut {
  id: ID;
  title: string;
  url: string;
  icon: IconRef;
  /** Couleur de la tuile (monogramme ou fond de plaque). */
  color?: string;
}

export interface Group {
  id: ID;
  name: string;
  icon: IconRef;
  accent?: string;
  shortcuts: Shortcut[];
}

export type WidgetSize = 's' | 'm' | 'l' | 't';

export interface WidgetInstance {
  id: ID;
  type: string;
  size: WidgetSize;
  config: Record<string, unknown>;
}

export type BackgroundType = 'preset' | 'color' | 'gradient' | 'image' | 'url';

export type Anchor =
  | 'center'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top left'
  | 'top right'
  | 'bottom left'
  | 'bottom right';

export interface BackgroundSettings {
  type: BackgroundType;
  preset: string;
  color: string;
  gradient: { from: string; to: string; angle: number };
  /** Image locale (IndexedDB). Absente sur un autre appareil : on retombe sur le préréglage. */
  imageId?: ID;
  imageName?: string;
  /** Luminance moyenne 0..1 calculée à l'import, sert au contraste automatique. */
  imageLuminance?: number;
  url: string;
  fit: 'cover' | 'contain';
  position: Anchor;
  brightness: number; // 0.3 .. 1.3
  blur: number; // px, 0 .. 40
  overlay: 'dark' | 'light';
  overlayOpacity: number; // 0 .. 0.8
}

export type ThemeMode = 'auto' | 'light' | 'dark';
export type Tone = 'auto' | 'light' | 'dark';
export type FontChoice = 'system' | 'rounded' | 'serif' | 'mono';

export interface ClockSettings {
  enabled: boolean;
  format: 'auto' | '24' | '12';
  seconds: boolean;
  scale: number; // 0.5 .. 2
  weight: 200 | 300 | 400 | 600;
  showDate: boolean;
  dateStyle: 'full' | 'long' | 'short';
  greeting: boolean;
  name: string;
}

export interface SearchSettings {
  enabled: boolean;
  /** 'chrome' = moteur par défaut de Chrome via chrome.search. */
  engine: string;
  customUrl: string;
  newTab: boolean;
  suggestShortcuts: boolean;
  /** Recharge la page une fois pour donner le focus au champ (au lieu de la barre d'adresse). */
  grabFocus: boolean;
}

export interface ShortcutSettings {
  display: 'tabs' | 'sections';
  style: 'tile' | 'plain';
  size: number; // px 40 .. 88
  columns: number; // 0 = auto
  labels: boolean;
  newTab: boolean;
}

export interface LayoutSettings {
  hero: 'center' | 'top';
  widgets: 'bottom' | 'left' | 'right';
  width: 'compact' | 'normal' | 'wide';
  spacing: number; // 0.6 .. 1.6
}

export interface CardSettings {
  style: 'glass' | 'solid' | 'clear';
  opacity: number; // 0 .. 1
  blur: number; // px
  radius: number; // px
}

export interface Settings {
  theme: ThemeMode;
  tone: Tone;
  accent: string;
  font: FontChoice;
  locale: string; // 'auto' ou balise BCP 47
  reduceMotion: 'system' | 'on';
  clock: ClockSettings;
  search: SearchSettings;
  shortcuts: ShortcutSettings;
  layout: LayoutSettings;
  cards: CardSettings;
  background: BackgroundSettings;
  sync: boolean;
  onboarded: boolean;
}

/** Document synchronisable. Doit rester bien en dessous de ~90 Ko une fois sérialisé. */
export interface SyncDoc {
  schemaVersion: number;
  updatedAt: number;
  /** Identifiant de l'appareil/onglet qui a écrit en dernier (évite de relire ses propres écritures). */
  writer: string;
  settings: Settings;
  groups: Group[];
  activeGroupId: ID | null;
  widgets: WidgetInstance[];
}

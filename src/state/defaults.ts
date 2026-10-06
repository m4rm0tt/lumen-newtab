import type { Group, Settings, Shortcut, SyncDoc } from '../types';
import { uid } from '../lib/id';
import { guessTitle } from '../lib/url';

export const SCHEMA_VERSION = 1;

export const DEFAULT_SETTINGS: Settings = {
  theme: 'auto',
  tone: 'auto',
  accent: '#0A84FF',
  font: 'system',
  locale: 'auto',
  reduceMotion: 'system',
  clock: {
    enabled: true,
    format: 'auto',
    seconds: false,
    scale: 1,
    weight: 300,
    showDate: true,
    dateStyle: 'full',
    greeting: false,
    name: '',
  },
  search: {
    enabled: true,
    engine: 'chrome',
    customUrl: '',
    newTab: false,
    suggestShortcuts: true,
    grabFocus: false,
  },
  shortcuts: {
    display: 'tabs',
    style: 'tile',
    size: 56,
    columns: 0,
    labels: true,
    newTab: false,
  },
  layout: {
    hero: 'center',
    widgets: 'bottom',
    width: 'normal',
    spacing: 1,
  },
  cards: {
    style: 'glass',
    opacity: 0.45,
    blur: 24,
    radius: 18,
  },
  background: {
    type: 'preset',
    preset: 'crepuscule',
    color: '#1C1C1E',
    gradient: { from: '#4F46E5', to: '#EC4899', angle: 135 },
    url: '',
    fit: 'cover',
    position: 'center',
    brightness: 1,
    blur: 0,
    overlay: 'dark',
    overlayOpacity: 0.12,
  },
  sync: true,
  onboarded: false,
};

function sc(url: string, title?: string): Shortcut {
  return { id: uid('s_'), title: title ?? guessTitle(url), url, icon: { kind: 'auto' } };
}

export function defaultGroups(): Group[] {
  return [
    {
      id: uid('g_'),
      name: 'Favoris',
      icon: { kind: 'symbol', name: 'star' },
      shortcuts: [
        sc('https://www.youtube.com/'),
        sc('https://mail.google.com/'),
        sc('https://fr.wikipedia.org/'),
        sc('https://github.com/'),
        sc('https://www.reddit.com/'),
        sc('https://maps.google.com/'),
      ],
    },
    {
      id: uid('g_'),
      name: 'Travail',
      icon: { kind: 'symbol', name: 'briefcase' },
      shortcuts: [
        sc('https://calendar.google.com/'),
        sc('https://drive.google.com/'),
        sc('https://www.notion.so/'),
        sc('https://www.figma.com/'),
      ],
    },
    {
      id: uid('g_'),
      name: 'Détente',
      icon: { kind: 'symbol', name: 'music' },
      shortcuts: [
        sc('https://open.spotify.com/'),
        sc('https://www.netflix.com/'),
        sc('https://www.twitch.tv/'),
      ],
    },
  ];
}

export function defaultDoc(): SyncDoc {
  const groups = defaultGroups();
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: 0,
    writer: '',
    settings: structuredClone(DEFAULT_SETTINGS),
    groups,
    activeGroupId: groups[0].id,
    widgets: [],
  };
}

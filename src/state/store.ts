// Les actions recréent seulement les objets qui changent : modifier un réglage ne touche pas
// au tableau des groupes, et les raccourcis ne se re-rendent pas.
import { batch, computed, signal } from '@preact/signals';
import type { Group, IconRef, Settings, Shortcut, SyncDoc, WidgetInstance, WidgetSize } from '../types';
import { defaultDoc, DEFAULT_SETTINGS } from './defaults';
import { uid } from '../lib/id';
import { WRITER_ID, createPersister, persistNow, writeBootCache } from '../storage/persistence';
import { normalizeDoc } from '../storage/schema';

export const doc = signal<SyncDoc>(defaultDoc());
/** true une fois le stockage réel lu (le premier rendu peut venir du cache de démarrage). */
export const hydrated = signal(false);

export const settings = computed(() => doc.value.settings);
export const groups = computed(() => doc.value.groups);
export const widgets = computed(() => doc.value.widgets);
export const activeGroupId = computed(() => doc.value.activeGroupId);

const persister = createPersister();

function commit(next: SyncDoc) {
  next.updatedAt = Math.max(Date.now(), doc.value.updatedAt + 1);
  next.writer = WRITER_ID;
  doc.value = next;
  persister.schedule(next);
}

/** Remplace le document sans le réécrire (chargement initial, changement distant). */
export function hydrate(next: SyncDoc) {
  batch(() => {
    doc.value = next;
    hydrated.value = true;
  });
  writeBootCache(next);
}

/** Applique un document venu d'un autre onglet/appareil s'il est plus récent. */
export function applyRemote(next: SyncDoc) {
  if (next.updatedAt <= doc.value.updatedAt) return;
  doc.value = next;
  writeBootCache(next);
}

export async function replaceDoc(next: SyncDoc) {
  const d = normalizeDoc(next);
  d.updatedAt = Date.now();
  d.writer = WRITER_ID;
  doc.value = d;
  await persistNow(d);
}

export function flushPersistence() {
  persister.flush();
}

// ---------------------------------------------------------------------------
// Réglages

type SectionKeys = { [K in keyof Settings]: Settings[K] extends object ? K : never }[keyof Settings];

/** updateSettings('clock', { seconds: true }) ou updateSettings('accent', '#FF375F'). */
export function updateSettings<K extends keyof Settings>(
  key: K,
  value: K extends SectionKeys ? Partial<Settings[K]> : Settings[K],
) {
  const cur = doc.value.settings;
  const prev = cur[key];
  const nextVal =
    typeof prev === 'object' && prev !== null && typeof value === 'object' && value !== null
      ? { ...(prev as object), ...(value as object) }
      : value;
  commit({ ...doc.value, settings: { ...cur, [key]: nextVal } });
}

export function resetSettings(section?: keyof Settings) {
  const cur = doc.value.settings;
  const next: Settings = section
    ? { ...cur, [section]: structuredClone(DEFAULT_SETTINGS[section]) }
    : { ...structuredClone(DEFAULT_SETTINGS), onboarded: true, sync: cur.sync, background: cur.background };
  commit({ ...doc.value, settings: next });
}

// ---------------------------------------------------------------------------
// Groupes

function setGroups(groups: Group[], activeGroupId = doc.value.activeGroupId) {
  const active = groups.some((g) => g.id === activeGroupId) ? activeGroupId : groups[0]?.id ?? null;
  commit({ ...doc.value, groups, activeGroupId: active });
}

export function setActiveGroup(id: string) {
  if (doc.value.activeGroupId === id) return;
  commit({ ...doc.value, activeGroupId: id });
}

export function addGroup(data: { name: string; icon: IconRef; accent?: string }): Group {
  const g: Group = { id: uid('g_'), name: data.name.trim() || 'Nouveau groupe', icon: data.icon, shortcuts: [] };
  if (data.accent) g.accent = data.accent;
  setGroups([...doc.value.groups, g], g.id);
  return g;
}

export function updateGroup(id: string, patch: Partial<Omit<Group, 'id' | 'shortcuts'>>) {
  setGroups(doc.value.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)));
}

/** Supprime un groupe ; renvoie une fonction d'annulation. */
export function removeGroup(id: string): () => void {
  const index = doc.value.groups.findIndex((g) => g.id === id);
  if (index < 0) return () => undefined;
  const removed = doc.value.groups[index];
  const wasActive = doc.value.activeGroupId === id;
  const rest = doc.value.groups.filter((g) => g.id !== id);
  setGroups(rest, wasActive ? rest[Math.max(0, index - 1)]?.id ?? null : doc.value.activeGroupId);
  return () => {
    const gs = [...doc.value.groups];
    gs.splice(Math.min(index, gs.length), 0, removed);
    setGroups(gs, wasActive ? removed.id : doc.value.activeGroupId);
  };
}

export function moveGroup(id: string, toIndex: number) {
  const gs = [...doc.value.groups];
  const from = gs.findIndex((g) => g.id === id);
  if (from < 0) return;
  const [g] = gs.splice(from, 1);
  gs.splice(Math.max(0, Math.min(toIndex, gs.length)), 0, g);
  setGroups(gs);
}

// ---------------------------------------------------------------------------
// Raccourcis

export function findShortcut(id: string): { group: Group; shortcut: Shortcut; index: number } | null {
  for (const group of doc.value.groups) {
    const index = group.shortcuts.findIndex((s) => s.id === id);
    if (index >= 0) return { group, shortcut: group.shortcuts[index], index };
  }
  return null;
}

export function addShortcut(groupId: string, data: Omit<Shortcut, 'id'>, index?: number): Shortcut {
  const s: Shortcut = { ...data, id: uid('s_') };
  setGroups(
    doc.value.groups.map((g) => {
      if (g.id !== groupId) return g;
      const list = [...g.shortcuts];
      list.splice(index ?? list.length, 0, s);
      return { ...g, shortcuts: list };
    }),
  );
  return s;
}

export function updateShortcut(id: string, patch: Partial<Omit<Shortcut, 'id'>>) {
  setGroups(
    doc.value.groups.map((g) =>
      g.shortcuts.some((s) => s.id === id)
        ? { ...g, shortcuts: g.shortcuts.map((s) => (s.id === id ? cleanShortcut({ ...s, ...patch }) : s)) }
        : g,
    ),
  );
}

function cleanShortcut(s: Shortcut): Shortcut {
  if (!s.color) delete s.color;
  return s;
}

export function removeShortcut(id: string): () => void {
  const found = findShortcut(id);
  if (!found) return () => undefined;
  const { group, shortcut, index } = found;
  setGroups(doc.value.groups.map((g) => (g.id === group.id ? { ...g, shortcuts: g.shortcuts.filter((s) => s.id !== id) } : g)));
  return () => {
    if (!doc.value.groups.some((g) => g.id === group.id)) return;
    setGroups(
      doc.value.groups.map((g) => {
        if (g.id !== group.id) return g;
        const list = [...g.shortcuts];
        list.splice(Math.min(index, list.length), 0, shortcut);
        return { ...g, shortcuts: list };
      }),
    );
  };
}

/** Déplace un raccourci, éventuellement vers un autre groupe. toIndex = position dans la liste cible (sans l'élément déplacé). */
export function moveShortcut(id: string, toGroupId: string, toIndex?: number) {
  const found = findShortcut(id);
  if (!found) return;
  const { group: from, shortcut } = found;
  setGroups(
    doc.value.groups.map((g) => {
      let list = g.shortcuts;
      if (g.id === from.id) list = list.filter((s) => s.id !== id);
      if (g.id === toGroupId) {
        list = [...list];
        list.splice(Math.max(0, Math.min(toIndex ?? list.length, list.length)), 0, shortcut);
      }
      return list === g.shortcuts ? g : { ...g, shortcuts: list };
    }),
  );
}

export function importShortcuts(groupName: string, items: { title: string; url: string }[], icon: IconRef) {
  const g: Group = {
    id: uid('g_'),
    name: groupName,
    icon,
    shortcuts: items.map((i) => ({ id: uid('s_'), title: i.title, url: i.url, icon: { kind: 'auto' } })),
  };
  setGroups([...doc.value.groups, g], g.id);
  return g;
}

// ---------------------------------------------------------------------------
// Widgets

export function addWidget(type: string, size: WidgetSize, config: Record<string, unknown> = {}): WidgetInstance {
  const w: WidgetInstance = { id: uid('w_'), type, size, config };
  commit({ ...doc.value, widgets: [...doc.value.widgets, w] });
  return w;
}

export function updateWidget(id: string, patch: { size?: WidgetSize; config?: Record<string, unknown> }) {
  commit({
    ...doc.value,
    widgets: doc.value.widgets.map((w) =>
      w.id === id ? { ...w, ...(patch.size ? { size: patch.size } : {}), ...(patch.config ? { config: { ...w.config, ...patch.config } } : {}) } : w,
    ),
  });
}

export function removeWidget(id: string): () => void {
  const index = doc.value.widgets.findIndex((w) => w.id === id);
  if (index < 0) return () => undefined;
  const removed = doc.value.widgets[index];
  commit({ ...doc.value, widgets: doc.value.widgets.filter((w) => w.id !== id) });
  return () => {
    const ws = [...doc.value.widgets];
    ws.splice(Math.min(index, ws.length), 0, removed);
    commit({ ...doc.value, widgets: ws });
  };
}

export function moveWidget(id: string, toIndex: number) {
  const ws = [...doc.value.widgets];
  const from = ws.findIndex((w) => w.id === id);
  if (from < 0) return;
  const [w] = ws.splice(from, 1);
  ws.splice(Math.max(0, Math.min(toIndex, ws.length)), 0, w);
  commit({ ...doc.value, widgets: ws });
}

// ---------------------------------------------------------------------------

export function resetEverything() {
  const fresh = defaultDoc();
  fresh.settings.onboarded = true;
  fresh.settings.sync = doc.value.settings.sync;
  commit(fresh);
}

/** Identifiants de blobs encore référencés (pour le ramasse-miettes IndexedDB). */
export function referencedBlobIds(): Set<string> {
  const ids = new Set<string>();
  const bg = doc.value.settings.background;
  if (bg.imageId) ids.add(bg.imageId);
  for (const g of doc.value.groups) {
    if (g.icon.kind === 'image') ids.add(g.icon.blobId);
    for (const s of g.shortcuts) if (s.icon.kind === 'image') ids.add(s.icon.blobId);
  }
  for (const w of doc.value.widgets) {
    const b = w.config.blobId;
    if (typeof b === 'string') ids.add(b);
  }
  return ids;
}

import { beforeEach, describe, expect, it } from 'vitest';
import {
  addGroup, addShortcut, addWidget, doc, findShortcut, hydrate, moveGroup, moveShortcut, moveWidget, removeGroup,
  removeShortcut, removeWidget, updateSettings, updateShortcut,
} from '../src/state/store';
import { defaultDoc } from '../src/state/defaults';

const names = () => doc.value.groups.map((g) => g.name);
const titles = (i = 0) => doc.value.groups[i].shortcuts.map((s) => s.title);

beforeEach(() => hydrate(defaultDoc()));

describe('raccourcis', () => {
  it('ajoute, modifie et supprime avec annulation', () => {
    const g = doc.value.groups[0];
    const s = addShortcut(g.id, { title: 'Ex', url: 'https://ex.com/', icon: { kind: 'auto' } }, 1);
    expect(titles()[1]).toBe('Ex');
    updateShortcut(s.id, { title: 'Exemple', color: '#FF0000' });
    expect(findShortcut(s.id)?.shortcut).toMatchObject({ title: 'Exemple', color: '#FF0000' });
    updateShortcut(s.id, { color: undefined });
    expect('color' in findShortcut(s.id)!.shortcut).toBe(false);
    const undo = removeShortcut(s.id);
    expect(findShortcut(s.id)).toBeNull();
    undo();
    expect(titles()[1]).toBe('Exemple');
  });

  it('réordonne dans un groupe et déplace vers un autre', () => {
    const [a, b] = doc.value.groups;
    const first = a.shortcuts[0];
    moveShortcut(first.id, a.id, 3);
    expect(doc.value.groups[0].shortcuts[3].id).toBe(first.id);
    moveShortcut(first.id, b.id, 0);
    expect(doc.value.groups[0].shortcuts.some((s) => s.id === first.id)).toBe(false);
    expect(doc.value.groups[1].shortcuts[0].id).toBe(first.id);
    moveShortcut(first.id, b.id); // à la fin
    expect(doc.value.groups[1].shortcuts.at(-1)!.id).toBe(first.id);
  });

  it('partage la structure : modifier un réglage ne recrée pas les groupes', () => {
    const before = doc.value.groups;
    updateSettings('clock', { seconds: true });
    expect(doc.value.groups).toBe(before);
    expect(doc.value.settings.clock.seconds).toBe(true);
    expect(doc.value.settings.clock.weight).toBe(300);
  });
});

describe('groupes', () => {
  it('crée, déplace et supprime avec annulation', () => {
    const g = addGroup({ name: 'Dev', icon: { kind: 'symbol', name: 'code' } });
    expect(doc.value.activeGroupId).toBe(g.id);
    moveGroup(g.id, 0);
    expect(names()[0]).toBe('Dev');
    const undo = removeGroup(g.id);
    expect(names()).not.toContain('Dev');
    expect(doc.value.activeGroupId).not.toBe(g.id);
    undo();
    expect(names()[0]).toBe('Dev');
    expect(doc.value.activeGroupId).toBe(g.id);
  });
});

describe('widgets', () => {
  it('ajoute, réordonne et retire', () => {
    const a = addWidget('notes', 't');
    const b = addWidget('calendar', 's');
    moveWidget(b.id, 0);
    expect(doc.value.widgets.map((w) => w.id)).toEqual([b.id, a.id]);
    const undo = removeWidget(a.id);
    expect(doc.value.widgets).toHaveLength(1);
    undo();
    expect(doc.value.widgets).toHaveLength(2);
  });
});

describe('horodatage', () => {
  it('chaque modification avance updatedAt', () => {
    const t0 = doc.value.updatedAt;
    updateSettings('accent', '#FF375F');
    const t1 = doc.value.updatedAt;
    updateSettings('accent', '#30D158');
    expect(t1).toBeGreaterThan(t0);
    expect(doc.value.updatedAt).toBeGreaterThan(t1);
  });
});

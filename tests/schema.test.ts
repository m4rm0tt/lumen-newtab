import { describe, expect, it } from 'vitest';
import { LIMITS, migrate, normalizeDoc, normalizeIcon, normalizeSettings } from '../src/storage/schema';
import { DEFAULT_SETTINGS, SCHEMA_VERSION, defaultDoc } from '../src/state/defaults';

describe('normalizeDoc', () => {
  it('renvoie un document par défaut pour une entrée invalide', () => {
    for (const bad of [null, undefined, 42, 'x', []]) {
      const d = normalizeDoc(bad);
      expect(d.schemaVersion).toBe(SCHEMA_VERSION);
      expect(d.groups.length).toBeGreaterThan(0);
    }
  });

  it('conserve un document valide à l’identique', () => {
    const d = defaultDoc();
    d.updatedAt = 123;
    expect(normalizeDoc(JSON.parse(JSON.stringify(d)))).toEqual(d);
  });

  it('borne les nombres et rejette les valeurs hors énumération', () => {
    const s = normalizeSettings({
      theme: 'violet',
      clock: { scale: 99, weight: 250, seconds: 'oui' },
      cards: { opacity: -3 },
      background: { overlayOpacity: 5, position: 'top left', imageLuminance: 3 },
    });
    expect(s.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(s.clock.scale).toBe(2);
    expect(s.clock.weight).toBe(DEFAULT_SETTINGS.clock.weight);
    expect(s.clock.seconds).toBe(false);
    expect(s.cards.opacity).toBe(0);
    expect(s.background.overlayOpacity).toBe(0.8);
    expect(s.background.position).toBe('top left');
    expect(s.background.imageLuminance).toBe(1);
  });

  it('écarte les raccourcis dangereux ou invalides et répare les identifiants', () => {
    const d = normalizeDoc({
      groups: [
        {
          id: 'g1',
          name: '',
          shortcuts: [
            { id: 'a', title: 'ok', url: 'example.com' },
            { id: 'a', title: 'doublon', url: 'https://b.com' },
            { id: 'x', title: 'xss', url: 'javascript:alert(1)' },
            { title: 'sans url' },
          ],
        },
      ],
      activeGroupId: 'inconnu',
    });
    const g = d.groups[0];
    expect(g.name).toBe('Groupe');
    expect(g.shortcuts.map((s) => s.url)).toEqual(['https://example.com/', 'https://b.com/']);
    expect(new Set(g.shortcuts.map((s) => s.id)).size).toBe(2);
    expect(d.activeGroupId).toBe('g1');
  });

  it('applique les limites de taille', () => {
    const groups = Array.from({ length: LIMITS.groups + 10 }, (_, i) => ({ id: `g${i}`, name: `G${i}`, shortcuts: [] }));
    expect(normalizeDoc({ groups }).groups).toHaveLength(LIMITS.groups);
  });

  it('valide les widgets', () => {
    const d = normalizeDoc({ groups: [], widgets: [{ type: 'notes', size: 'énorme', config: { title: 'x' } }, { size: 's' }] });
    expect(d.widgets).toHaveLength(1);
    expect(d.widgets[0].size).toBe('s');
    expect(d.widgets[0].id).toMatch(/^w_/);
  });
});

describe('normalizeIcon', () => {
  it('accepte les formes connues', () => {
    expect(normalizeIcon({ kind: 'emoji', value: '🎵' })).toEqual({ kind: 'emoji', value: '🎵' });
    expect(normalizeIcon({ kind: 'symbol', name: 'star' })).toEqual({ kind: 'symbol', name: 'star' });
    expect(normalizeIcon({ kind: 'url', src: 'https://x.com/i.png' })).toEqual({ kind: 'url', src: 'https://x.com/i.png' });
  });

  it('rejette les images non http', () => {
    expect(normalizeIcon({ kind: 'url', src: 'javascript:1' })).toEqual({ kind: 'auto' });
    expect(normalizeIcon({ kind: 'bizarre' })).toEqual({ kind: 'auto' });
  });
});

describe('migrate', () => {
  it('applique les migrations dans l’ordre jusqu’à la version cible', () => {
    const calls: number[] = [];
    const migrations = {
      1: (d: Record<string, unknown>) => (calls.push(1), { ...d, a: 1 }),
      2: (d: Record<string, unknown>) => (calls.push(2), { ...d, b: (d.a as number) + 1 }),
    };
    const out = migrate({ schemaVersion: 1 }, migrations, 3);
    expect(calls).toEqual([1, 2]);
    expect(out).toMatchObject({ schemaVersion: 3, a: 1, b: 2 });
  });

  it('ne touche pas un document déjà à jour', () => {
    expect(migrate({ schemaVersion: 3, x: 1 }, {}, 3)).toEqual({ schemaVersion: 3, x: 1 });
  });
});

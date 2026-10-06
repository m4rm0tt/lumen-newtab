import { describe, expect, it } from 'vitest';
import { WIDGETS, getWidgetDef, normalizeConfig } from '../src/widgets/registry';
import { formatValue, getPath, normalizeCustom } from '../src/widgets/custom';
import { parseFeed } from '../src/widgets/rss';
import { levels } from '../src/widgets/github';
import { isoWeek, monthGrid } from '../src/widgets/calendar';
import { nextPhase, remainingMs, type TimerState } from '../src/widgets/timer';
import { describe as weather } from '../src/widgets/weather';
import { pkcePair } from '../src/widgets/spotify';

describe('registre', () => {
  it('chaque définition est cohérente', () => {
    const types = new Set<string>();
    for (const w of WIDGETS) {
      expect(types.has(w.type)).toBe(false);
      types.add(w.type);
      expect(w.sizes).toContain(w.defaultSize);
      expect(normalizeConfig(w, {})).toBeTypeOf('object');
    }
  });

  it('chaque module se charge et exporte un composant', async () => {
    for (const w of WIDGETS) {
      const mod = await w.load();
      expect(mod.default).toBeTypeOf('function');
    }
  });

  it('normalise une configuration hostile', () => {
    const gh = getWidgetDef('github')!;
    expect(normalizeConfig(gh, { username: '<script>octo cat' }).username).toBe('scriptoctocat');
    const timer = getWidgetDef('timer')!;
    expect(normalizeConfig(timer, { focus: 9999 }).focus).toBe(180);
  });
});

describe('widget personnalisé', () => {
  it('lit des chemins sans évaluer de code', () => {
    const data = { a: { b: [{ c: 42 }] } };
    expect(getPath(data, 'a.b[0].c')).toBe(42);
    expect(getPath(data, 'a.x.y')).toBeUndefined();
    expect(getPath(data, '__proto__.polluted')).toBeUndefined();
    expect(getPath(data, 'constructor')).toBeUndefined();
  });

  it('formate les valeurs', () => {
    expect(formatValue(1234.5, 'number', 'fr-FR')).toMatch(/1\s?234,5/);
    expect(formatValue(undefined, 'text', 'fr-FR')).toBe('—');
    expect(formatValue({ a: 1 }, 'text', 'fr-FR')).toBe('{"a":1}');
  });

  it('nettoie une définition importée', () => {
    const c = normalizeCustom({ mode: 'eval', url: 'javascript:alert(1)', fields: [{ label: 1, path: 'a', format: 'html' }], refresh: 0 });
    expect(c.mode).toBe('text');
    expect(c.url).toBe('');
    expect(c.fields[0]).toEqual({ label: '', path: 'a', format: 'text' });
    expect(c.refresh).toBe(1);
  });
});

describe('RSS', () => {
  it('lit RSS 2.0 et Atom, ignore les liens non http', () => {
    const rss = `<?xml version="1.0"?><rss><channel><title>Blog</title>
      <item><title>Un</title><link>https://b.com/1</link><pubDate>Tue, 06 Oct 2026 10:00:00 GMT</pubDate></item>
      <item><title>Piège</title><link>javascript:alert(1)</link></item></channel></rss>`;
    const items = parseFeed(rss, 'https://b.com/feed');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ title: 'Un', link: 'https://b.com/1', source: 'Blog' });
    const atom = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>A</title>
      <entry><title>Deux</title><link href="/2"/><updated>2026-10-05T10:00:00Z</updated></entry></feed>`;
    expect(parseFeed(atom, 'https://a.org/atom.xml')[0].link).toBe('https://a.org/2');
  });

  it('signale un flux invalide', () => {
    expect(() => parseFeed('<pas<du>xml', 'https://x.com')).toThrow();
  });
});

describe('calendrier', () => {
  it('numéros de semaine ISO', () => {
    expect(isoWeek(new Date(2026, 0, 1))).toBe(1);
    expect(isoWeek(new Date(2026, 9, 6))).toBe(41);
    expect(isoWeek(new Date(2027, 0, 1))).toBe(53);
  });

  it('la grille commence le lundi (ou le dimanche)', () => {
    const monday = monthGrid(2026, 9, 1);
    expect(monday[0].getDay()).toBe(1);
    expect(monday).toHaveLength(42);
    expect(monthGrid(2026, 9, 7)[0].getDay()).toBe(0);
  });
});

describe('minuteur', () => {
  const base: TimerState = { mode: 'pomodoro', duration: 1500000, endsAt: null, remaining: 1500000, phase: 'focus', cycles: 0, notified: null };
  const cfg = { focus: 25, short: 5, long: 15, sound: false };

  it('alterne concentration et pauses, pause longue toutes les 4 sessions', () => {
    expect(nextPhase(base, cfg)).toEqual({ phase: 'short', duration: 300000, cycles: 1 });
    expect(nextPhase({ ...base, cycles: 3 }, cfg).phase).toBe('long');
    expect(nextPhase({ ...base, phase: 'short' }, cfg)).toEqual({ phase: 'focus', duration: 1500000, cycles: 0 });
  });

  it('calcule le temps restant depuis une heure de fin absolue', () => {
    expect(remainingMs({ ...base, endsAt: 10000 }, 4000)).toBe(6000);
    expect(remainingMs({ ...base, endsAt: 10000 }, 20000)).toBe(0);
    expect(remainingMs(base)).toBe(1500000);
  });
});

describe('divers', () => {
  it('codes météo WMO', () => {
    expect(weather(0).label).toBe('Ciel dégagé');
    expect(weather(63).label).toBe('Pluie');
    expect(weather(95).label).toBe('Orage');
  });

  it('niveaux du calendrier GitHub', () => {
    const l = levels([[0, 1, 2, 3, 4, 5, 50]]);
    expect(l[0][0]).toBe(0);
    expect(l[0][6]).toBe(4);
  });

  it('paire PKCE conforme (base64url, 43+ caractères)', async () => {
    const { verifier, challenge } = await pkcePair();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

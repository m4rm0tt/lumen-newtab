import { describe, expect, it } from 'vitest';
import { BOOT_KEY, LOCAL_DOC_KEY, loadDoc, persistNow, readBootCache } from '../src/storage/persistence';
import { area } from '../src/storage/backend';
import { defaultDoc } from '../src/state/defaults';

describe('persistance', () => {
  it('écrit le stockage local et le cache de démarrage', async () => {
    const d = defaultDoc();
    d.updatedAt = 10;
    d.settings.accent = '#FF375F';
    await persistNow(d);
    const { [LOCAL_DOC_KEY]: stored } = await area('local').get([LOCAL_DOC_KEY]);
    expect((stored as typeof d).settings.accent).toBe('#FF375F');
    expect(readBootCache()?.settings.accent).toBe('#FF375F');
    expect((await loadDoc()).doc?.settings.accent).toBe('#FF375F');
  });

  it('ignore un cache de démarrage corrompu', () => {
    localStorage.setItem(BOOT_KEY, '{pas du json');
    expect(readBootCache()).toBeNull();
  });

  it('renvoie « none » au premier lancement', async () => {
    expect(await loadDoc()).toEqual({ doc: null, source: 'none' });
  });

  it('normalise une copie locale altérée', async () => {
    await area('local').set({ [LOCAL_DOC_KEY]: { groups: [{ name: 'X', shortcuts: [{ url: 'javascript:1' }] }], settings: { theme: 42 } } });
    const { doc } = await loadDoc();
    expect(doc?.groups[0].shortcuts).toEqual([]);
    expect(doc?.settings.theme).toBe('auto');
  });
});

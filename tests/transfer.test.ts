// @vitest-environment node
// Environnement Node : ses Blob natifs survivent au clonage de fake-indexeddb (ceux de happy-dom non).
import { describe, expect, it } from 'vitest';
import { applyImportSideData, buildExport, parseImport } from '../src/storage/transfer';
import { area } from '../src/storage/backend';
import { getBlob, putBlob } from '../src/storage/blobs';
import { defaultDoc } from '../src/state/defaults';

function file(data: unknown): File {
  return new File([typeof data === 'string' ? data : JSON.stringify(data)], 'export.json', { type: 'application/json' });
}

describe('export / import', () => {
  it('exporte les données des widgets mais jamais les secrets ni les caches', async () => {
    await area('local').set({ 'w:abc': { text: 'note' }, 'secret:github': 'ghp_x', 'cache:weather': { at: 1 }, doc: {} });
    const out = await buildExport(defaultDoc(), false);
    expect(out.app).toBe('lumen');
    expect(out.local).toEqual({ 'w:abc': { text: 'note' } });
    expect(out.blobs).toBeUndefined();
  });

  it('aller-retour complet avec images', async () => {
    const id = await putBlob(new Blob(['png-bytes'], { type: 'image/png' }), 'fond.png');
    const d = defaultDoc();
    d.settings.background = { ...d.settings.background, type: 'image', imageId: id };
    await area('local').set({ 'w:n1': { text: 'bonjour' } });
    const out = await buildExport(d, true);
    expect(out.blobs).toHaveLength(1);

    const parsed = await parseImport(file(out));
    expect(parsed.summary.images).toBe(1);
    expect(parsed.doc.settings.background.imageId).toBe(id);

    await area('local').remove(['w:n1']);
    await applyImportSideData(parsed);
    expect((await area('local').get(['w:n1']))['w:n1']).toEqual({ text: 'bonjour' });
    expect((await getBlob(id))?.name).toBe('fond.png');
  });

  it('refuse les fichiers étrangers ou trop récents', async () => {
    await expect(parseImport(file('pas du json'))).rejects.toThrow(/JSON/);
    await expect(parseImport(file({ app: 'autre' }))).rejects.toThrow(/Lumen/);
    await expect(parseImport(file({ app: 'lumen', format: 99 }))).rejects.toThrow(/récente/);
  });

  it('ignore les clés locales non autorisées dans un import', async () => {
    const parsed = await parseImport(file({ app: 'lumen', format: 1, doc: defaultDoc(), local: { 'w:ok': 1, 'secret:x': 'vol', doc: 'écrase' } }));
    expect(parsed.local).toEqual({ 'w:ok': 1 });
  });
});

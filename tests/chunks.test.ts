import { describe, expect, it } from 'vitest';
import { META_KEY, QUOTA_BYTES_PER_ITEM, buildSyncPayload, diffSync, itemBytes, joinSync, splitString } from '../src/storage/chunks';

describe('découpage pour storage.sync', () => {
  it('respecte le quota par élément, y compris avec échappements et emoji', () => {
    const json = JSON.stringify({ text: '"\\'.repeat(3000) + '🎵é'.repeat(4000) + 'x'.repeat(9000) });
    const chunks = splitString(json);
    expect(chunks.join('')).toBe(json);
    chunks.forEach((c, i) => expect(itemBytes(`lumen.doc.${i}`, c)).toBeLessThanOrEqual(QUOTA_BYTES_PER_ITEM));
  });

  it('ne coupe jamais une paire de substitution', () => {
    const json = '🎵'.repeat(10000);
    for (const c of splitString(json, 1000)) {
      const last = c.charCodeAt(c.length - 1);
      expect(last >= 0xd800 && last <= 0xdbff).toBe(false);
    }
  });

  it('recompose le document et détecte les fragments incohérents', () => {
    const json = JSON.stringify({ a: 'b'.repeat(20000) });
    const { items, meta } = buildSyncPayload(json, 'w1', 42);
    expect(meta.n).toBeGreaterThan(1);
    expect(joinSync(items)?.json).toBe(json);
    const broken = { ...items, 'lumen.doc.1': 'x' };
    expect(joinSync(broken)).toBeNull();
    const missing = { ...items };
    delete missing['lumen.doc.0'];
    expect(joinSync(missing)).toBeNull();
    expect(joinSync({})).toBeNull();
  });

  it("n'écrit que les fragments modifiés et supprime les clés obsolètes", () => {
    const big = buildSyncPayload(JSON.stringify({ a: 'x'.repeat(30000) }), 'w', 1).items;
    const small = buildSyncPayload(JSON.stringify({ a: 'x'.repeat(30000).slice(0, 100) }), 'w', 2).items;
    const { set, remove } = diffSync(big, small);
    expect(set[META_KEY]).toBeDefined();
    expect(remove.length).toBeGreaterThan(0);
    const same = diffSync(big, big);
    expect(Object.keys(same.set)).toEqual([META_KEY]);
    expect(same.remove).toEqual([]);
  });
});

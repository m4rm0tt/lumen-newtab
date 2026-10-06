import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Arborescence de favoris simulée (même forme que chrome.bookmarks.getTree()).
type Node = { id: string; title: string; url?: string; children?: Node[] };
const tree: Node[] = [
  {
    id: '0',
    title: '',
    children: [
      {
        id: '1',
        title: 'Barre de favoris',
        children: [
          { id: '10', title: 'GitHub', url: 'https://github.com/' },
          { id: '11', title: '', url: 'https://www.youtube.com/' },
          { id: '12', title: 'Doublon', url: 'https://github.com/' },
          { id: '13', title: 'Piège', url: 'javascript:alert(1)' },
          {
            id: '2',
            title: 'Dev',
            children: [
              { id: '20', title: 'MDN', url: 'https://developer.mozilla.org/' },
              { id: '3', title: 'Vide', children: [] },
            ],
          },
        ],
      },
      { id: '4', title: 'Autres favoris', children: [] },
    ],
  },
];

function find(nodes: Node[], id: string): Node | undefined {
  for (const n of nodes) {
    if (n.id === id) return n;
    const f = n.children && find(n.children, id);
    if (f) return f;
  }
}

let granted = true;
let mod: typeof import('../src/features/shortcuts/importers');
let store: typeof import('../src/state/store');
let defaults: typeof import('../src/state/defaults');

beforeAll(async () => {
  // L'API chrome doit exister avant le chargement des modules (détection au chargement).
  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: { id: 'test-extension' },
    permissions: { request: async () => granted, contains: async () => granted },
    bookmarks: {
      getTree: async () => tree,
      getChildren: async (id: string) => find(tree, id)?.children ?? [],
    },
  };
  vi.resetModules();
  store = await import('../src/state/store');
  defaults = await import('../src/state/defaults');
  mod = await import('../src/features/shortcuts/importers');
});

beforeEach(() => {
  granted = true;
  store.hydrate(defaults.defaultDoc());
});

describe('import des favoris', () => {
  it('liste les dossiers contenant des liens, avec leur chemin', async () => {
    const folders = await mod.listBookmarkFolders();
    expect(folders).toEqual([
      { id: '1', title: 'Barre de favoris', path: 'Barre de favoris', count: 3 },
      { id: '2', title: 'Dev', path: 'Barre de favoris › Dev', count: 1 },
    ]);
  });

  it('renvoie null si l’accès est refusé', async () => {
    granted = false;
    expect(await mod.listBookmarkFolders()).toBeNull();
  });

  it('crée un groupe par dossier, sans doublon ni lien dangereux', async () => {
    const folders = (await mod.listBookmarkFolders())!;
    const s = await mod.importBookmarkFolders(folders);
    expect(s).toEqual({ groups: 2, shortcuts: 3 });
    const bar = store.groups.value.find((g) => g.name === 'Barre de favoris')!;
    expect(bar.shortcuts.map((x) => [x.title, x.url])).toEqual([
      ['GitHub', 'https://github.com/'],
      ['YouTube', 'https://www.youtube.com/'],
    ]);
    expect(bar.icon).toEqual({ kind: 'symbol', name: 'bookmark' });
    // Le premier groupe importé devient le groupe affiché.
    expect(store.activeGroupId.value).toBe(bar.id);
  });

  it('réimporter complète le groupe existant au lieu de le dupliquer', async () => {
    const folders = (await mod.listBookmarkFolders())!;
    await mod.importBookmarkFolders(folders);
    const again = await mod.importBookmarkFolders(folders);
    expect(again.shortcuts).toBe(0);
    expect(store.groups.value.filter((g) => g.name === 'Barre de favoris')).toHaveLength(1);
  });
});

import { describe, expect, it } from 'vitest';
import { arrange, insertionIndex, type DragState } from '../src/lib/dnd';

// Grille 3 colonnes de cases 100×100, sans marge.
const grid = Array.from({ length: 6 }, (_, i) => ({ left: (i % 3) * 100, top: Math.floor(i / 3) * 100, width: 100, height: 100 }));

describe('insertionIndex', () => {
  it('grille : avant la case dont le centre est à droite du pointeur', () => {
    expect(insertionIndex(grid, 10, 50, 'grid')).toBe(0);
    expect(insertionIndex(grid, 60, 50, 'grid')).toBe(1);
    expect(insertionIndex(grid, 290, 50, 'grid')).toBe(3); // fin de la 1re ligne
    expect(insertionIndex(grid, 10, 150, 'grid')).toBe(3);
    expect(insertionIndex(grid, 290, 190, 'grid')).toBe(6);
    expect(insertionIndex(grid, 500, 500, 'grid')).toBe(6);
  });

  it('axe horizontal et vertical', () => {
    const row = [0, 1, 2].map((i) => ({ left: i * 80, top: 0, width: 80, height: 30 }));
    expect(insertionIndex(row, 30, 10, 'x')).toBe(0);
    expect(insertionIndex(row, 130, 10, 'x')).toBe(2);
    const col = [0, 1, 2].map((i) => ({ left: 0, top: i * 40, width: 200, height: 40 }));
    expect(insertionIndex(col, 5, 61, 'y')).toBe(2);
  });
});

describe('arrange', () => {
  const items = ['a', 'b', 'c', 'd'];
  const id = (s: string) => s;
  const st = (over: DragState['over'], container = 'g1'): DragState => ({ item: { kind: 'shortcut', id: 'b', container }, over, target: null });

  it('sans drag, la liste est inchangée', () => {
    expect(arrange(items, id, 'g1', null)).toBe(items);
  });

  it('déplace l’élément à la position survolée', () => {
    expect(arrange(items, id, 'g1', st({ container: 'g1', index: 3 }))).toEqual(['a', 'c', 'd', 'b']);
    expect(arrange(items, id, 'g1', st({ container: 'g1', index: 0 }))).toEqual(['b', 'a', 'c', 'd']);
  });

  it('retire l’élément de son conteneur quand il en survole un autre', () => {
    expect(arrange(items, id, 'g1', st({ container: 'g2', index: 0 }))).toEqual(['a', 'c', 'd']);
  });

  it('insère un emplacement vide dans le conteneur cible', () => {
    expect(arrange(['x', 'y'], id, 'g2', st({ container: 'g2', index: 1 }))).toEqual(['x', 'slot', 'y']);
  });

  it('hors de toute zone, l’élément reste à sa place', () => {
    expect(arrange(items, id, 'g1', st(null))).toEqual(items);
  });
});

// Un dossier de favoris = un groupe. Réimporter le même dossier complète le groupe existant.
import { requestPermission } from '../../lib/permissions';
import { guessTitle, normalizeUrl } from '../../lib/url';
import { addShortcut, groups, importShortcuts, setActiveGroup } from '../../state/store';
import { LIMITS } from '../../storage/schema';
import { isExtension } from '../../storage/backend';

export const importersAvailable = isExtension;

export interface BookmarkFolder {
  id: string;
  title: string;
  /** Chemin lisible, ex. « Barre de favoris › Dev ». */
  path: string;
  /** Nombre de liens directement dans ce dossier (hors sous-dossiers). */
  count: number;
}

/** Liste les dossiers de favoris qui contiennent des liens. null = permission refusée. */
export async function listBookmarkFolders(): Promise<BookmarkFolder[] | null> {
  if (!(await requestPermission('bookmarks'))) return null;
  const tree = await chrome.bookmarks.getTree();
  const out: BookmarkFolder[] = [];
  const walk = (nodes: chrome.bookmarks.BookmarkTreeNode[], path: string) => {
    for (const n of nodes) {
      if (n.url || !n.children) continue;
      const links = n.children.filter((c) => c.url && normalizeUrl(c.url)).length;
      const p = n.title ? (path ? `${path} › ${n.title}` : n.title) : path;
      if (links > 0 && n.title) out.push({ id: n.id, title: n.title, path: p, count: links });
      walk(n.children, p);
    }
  };
  walk(tree, '');
  return out;
}

export interface ImportSummary {
  groups: number;
  shortcuts: number;
}

/** Importe les dossiers choisis, chacun dans un groupe ; ouvre le premier groupe importé. */
export async function importBookmarkFolders(folders: BookmarkFolder[]): Promise<ImportSummary> {
  const summary: ImportSummary = { groups: 0, shortcuts: 0 };
  let firstGroupId: string | null = null;

  for (const folder of folders) {
    const children = await chrome.bookmarks.getChildren(folder.id);
    const seen = new Set<string>();
    const items = children
      .filter((c) => c.url)
      .map((c) => {
        const url = normalizeUrl(c.url!) ?? '';
        return { title: (c.title?.trim() || (url ? guessTitle(url) : '')).slice(0, 60), url };
      })
      .filter((c) => c.url && !seen.has(c.url) && seen.add(c.url))
      .slice(0, LIMITS.shortcutsPerGroup);
    if (!items.length) continue;

    const name = folder.title.trim().slice(0, 40) || 'Favoris';
    const existing = groups.value.find((g) => g.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      // Même nom : on complète le groupe avec les liens qu'il n'a pas encore.
      const known = new Set(existing.shortcuts.map((s) => s.url));
      const room = LIMITS.shortcutsPerGroup - existing.shortcuts.length;
      const fresh = items.filter((i) => !known.has(i.url)).slice(0, Math.max(0, room));
      for (const i of fresh) addShortcut(existing.id, { title: i.title, url: i.url, icon: { kind: 'auto' } });
      summary.shortcuts += fresh.length;
      if (fresh.length) summary.groups++;
      firstGroupId ??= existing.id;
    } else {
      const g = importShortcuts(name, items, { kind: 'symbol', name: 'bookmark' });
      summary.groups++;
      summary.shortcuts += items.length;
      firstGroupId ??= g.id;
    }
  }

  if (firstGroupId) setActiveGroup(firstGroupId);
  return summary;
}

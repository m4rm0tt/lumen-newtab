// « chrome » passe par chrome.search.query, qui respecte le moteur choisi dans Chrome.
// Les autres moteurs ne sont que des URL de recherche.
import { fillTemplate, looksLikeUrl, normalizeUrl } from '../../lib/url';
import { isExtension } from '../../storage/backend';

export interface Engine {
  id: string;
  name: string;
  url: string; // modèle avec %s
}

export const ENGINES: Engine[] = [
  { id: 'google', name: 'Google', url: 'https://www.google.com/search?q=%s' },
  { id: 'duckduckgo', name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s' },
  { id: 'bing', name: 'Bing', url: 'https://www.bing.com/search?q=%s' },
  { id: 'brave', name: 'Brave Search', url: 'https://search.brave.com/search?q=%s' },
  { id: 'ecosia', name: 'Ecosia', url: 'https://www.ecosia.org/search?q=%s' },
  { id: 'qwant', name: 'Qwant', url: 'https://www.qwant.com/?q=%s' },
  { id: 'startpage', name: 'Startpage', url: 'https://www.startpage.com/do/search?q=%s' },
  { id: 'kagi', name: 'Kagi', url: 'https://kagi.com/search?q=%s' },
];

export const chromeSearchAvailable = isExtension && !!chrome.search?.query;

export function engineLabel(id: string, customUrl: string): string {
  if (id === 'chrome') return 'le moteur de Chrome';
  if (id === 'custom') {
    try {
      return new URL(customUrl.replace('%s', 'x')).hostname.replace(/^www\./, '');
    } catch {
      return 'moteur personnalisé';
    }
  }
  return ENGINES.find((e) => e.id === id)?.name ?? 'Google';
}

export function isValidTemplate(t: string): boolean {
  if (!t.includes('%s')) return false;
  const u = normalizeUrl(t.replace('%s', 'test'));
  return !!u && /^https?:/.test(u);
}

export type SearchAction = { kind: 'url'; url: string } | { kind: 'chrome'; text: string };

/** Décide quoi faire d'une saisie : ouvrir une adresse ou lancer une recherche. */
export function resolveQuery(input: string, engineId: string, customUrl: string): SearchAction | null {
  const text = input.trim();
  if (!text) return null;
  if (looksLikeUrl(text)) {
    const url = normalizeUrl(text);
    if (url) return { kind: 'url', url };
  }
  if (engineId === 'chrome' && chromeSearchAvailable) return { kind: 'chrome', text };
  if (engineId === 'custom' && isValidTemplate(customUrl)) return { kind: 'url', url: fillTemplate(customUrl, text) };
  const engine = ENGINES.find((e) => e.id === engineId) ?? ENGINES[0];
  return { kind: 'url', url: fillTemplate(engine.url, text) };
}

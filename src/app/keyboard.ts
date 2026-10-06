// Raccourcis globaux : taper n'importe où lance la recherche, « / » y met le curseur,
// Alt+1…9 change de groupe.
import { groups, setActiveGroup, settings } from '../state/store';
import { SEARCH_INPUT_ID } from '../features/search/Search';
import { editor, settingsPage } from './ui';

function isTyping(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el as HTMLElement).isContentEditable;
}

export function startKeyboard(): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (e.defaultPrevented || editor.value || document.querySelector('dialog[open]')) return;

    if (e.altKey && !e.ctrlKey && !e.metaKey && /^Digit[1-9]$/.test(e.code)) {
      const g = groups.value[Number(e.code.slice(5)) - 1];
      if (g && settings.value.shortcuts.display === 'tabs') {
        e.preventDefault();
        setActiveGroup(g.id);
      }
      return;
    }

    if (e.ctrlKey || e.metaKey || e.altKey || isTyping(document.activeElement)) return;
    const input = document.getElementById(SEARCH_INPUT_ID) as HTMLInputElement | null;
    if (!input || settingsPage.value) return;

    if (e.key === '/') {
      e.preventDefault();
      input.focus();
      return;
    }
    // Un caractère imprimable : on bascule vers la recherche, le caractère y est inséré.
    if (e.key.length === 1 && e.key !== ' ' && !(document.activeElement instanceof HTMLButtonElement || document.activeElement instanceof HTMLAnchorElement)) {
      input.focus();
    }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}

/**
 * Option « placer le curseur dans Lumen » : Chrome donne le focus à la barre
 * d'adresse pour les pages Nouvel onglet. Recharger la page via chrome.tabs.update
 * le donne à la page. Coût : l'adresse de l'extension s'affiche dans la barre.
 */
export function maybeGrabFocus() {
  if (!settings.value.search.grabFocus || !settings.value.search.enabled) return;
  if (typeof chrome === 'undefined' || !chrome.tabs?.getCurrent) return;
  if (location.hash === '#focus') {
    document.getElementById(SEARCH_INPUT_ID)?.focus();
    return;
  }
  void chrome.tabs.getCurrent().then((tab) => {
    if (tab?.id !== undefined) void chrome.tabs.update(tab.id, { url: chrome.runtime.getURL('newtab.html#focus') });
  });
}

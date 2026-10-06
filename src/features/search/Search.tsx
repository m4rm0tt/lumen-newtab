import { useMemo, useRef, useState } from 'preact/hooks';
import { Search as SearchIcon } from 'lucide-preact';
import { settings, groups } from '../../state/store';
import { engineLabel, resolveQuery } from './engines';
import { ShortcutIcon, usesColoredPlate } from '../../components/ShortcutIcon';
import { hostnameOf } from '../../lib/url';
import type { Shortcut } from '../../types';

export const SEARCH_INPUT_ID = 'lumen-search';

function fold(s: string) {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function matchShortcuts(q: string, all: Shortcut[]): Shortcut[] {
  const f = fold(q.trim());
  if (f.length < 1) return [];
  const scored: [number, Shortcut][] = [];
  for (const s of all) {
    const t = fold(s.title);
    const h = fold(hostnameOf(s.url));
    let score = -1;
    if (t.startsWith(f)) score = 3;
    else if (h.startsWith(f)) score = 2.5;
    else if (t.split(/\s+/).some((w) => w.startsWith(f))) score = 2;
    else if (f.length >= 2 && (t.includes(f) || h.includes(f))) score = 1;
    if (score > 0) scored.push([score, s]);
  }
  return scored.sort((a, b) => b[0] - a[0]).slice(0, 5).map(([, s]) => s);
}

/** Ouvre une URL. Les pages internes (chrome://…) exigent l'API tabs : une page web ne peut pas y naviguer. */
export function navigate(url: string, newTab: boolean) {
  const internal = /^(chrome|chrome-extension|edge|about|file):/i.test(url);
  if (internal && typeof chrome !== 'undefined' && chrome.tabs) {
    if (newTab) void chrome.tabs.create({ url });
    else void chrome.tabs.update({ url });
    return;
  }
  if (newTab) window.open(url, '_blank', 'noopener');
  else location.assign(url);
}

export function Search() {
  const s = settings.value.search;
  const [q, setQ] = useState('');
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const all = useMemo(() => groups.value.flatMap((g) => g.shortcuts), [groups.value]);
  const suggestions = s.suggestShortcuts ? matchShortcuts(q, all) : [];
  const open = suggestions.length > 0;

  function submit(e?: Event) {
    e?.preventDefault();
    if (active >= 0 && suggestions[active]) {
      navigate(suggestions[active].url, s.newTab);
      return;
    }
    const action = resolveQuery(q, s.engine, s.customUrl);
    if (!action) return;
    if (action.kind === 'chrome') {
      void chrome.search.query({ text: action.text, disposition: s.newTab ? 'NEW_TAB' : 'CURRENT_TAB' });
    } else {
      navigate(action.url, s.newTab);
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' && open) {
      e.preventDefault();
      setActive((a) => (a + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp' && open) {
      e.preventDefault();
      setActive((a) => (a <= 0 ? suggestions.length - 1 : a - 1));
    } else if (e.key === 'Escape') {
      if (q) {
        e.stopPropagation();
        setQ('');
        setActive(-1);
      } else inputRef.current?.blur();
    } else if (e.key === 'Tab' && open && active < 0 && !e.shiftKey) {
      e.preventDefault();
      setActive(0);
    }
  }

  if (!s.enabled) return null;

  return (
    <form class={`search ${open ? 'is-open' : ''}`} role="search" onSubmit={submit} autocomplete="off">
      <SearchIcon class="search-icon" size={18} strokeWidth={2} aria-hidden />
      <input
        ref={inputRef}
        id={SEARCH_INPUT_ID}
        class="search-input"
        type="search"
        value={q}
        placeholder={`Rechercher avec ${engineLabel(s.engine, s.customUrl)} ou saisir une adresse`}
        aria-label="Rechercher sur le web"
        aria-autocomplete="list"
        aria-controls="search-suggestions"
        aria-expanded={open}
        aria-activedescendant={active >= 0 ? `sugg-${active}` : undefined}
        spellcheck={false}
        enterKeyHint="search"
        onInput={(e) => {
          setQ((e.currentTarget as HTMLInputElement).value);
          setActive(-1);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setActive(-1), 120)}
      />
      {open && (
        <ul class="search-suggestions" id="search-suggestions" role="listbox" aria-label="Raccourcis correspondants">
          {suggestions.map((sc, i) => (
            <li
              key={sc.id}
              id={`sugg-${i}`}
              role="option"
              aria-selected={i === active}
              class={`sugg ${i === active ? 'is-active' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                navigate(sc.url, s.newTab);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span class={`sugg-icon plate ${usesColoredPlate(sc.icon) ? 'is-colored' : ''}`} style={sc.color ? { '--plate': sc.color } as Record<string, string> : undefined}>
                <ShortcutIcon icon={sc.icon} title={sc.title} url={sc.url} color={sc.color} size={28} />
              </span>
              <span class="sugg-title">{sc.title}</span>
              <span class="sugg-host">{hostnameOf(sc.url)}</span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

// Tiroir latéral plutôt que modale : on voit le tableau de bord changer pendant qu'on règle.
import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { ChevronLeft, ChevronRight, Clock, Database, Image, Info, LayoutGrid, Palette, Puzzle, Search, Settings2, X } from 'lucide-preact';
import { settingsPage, type SettingsPage } from '../../app/ui';
import { AboutSection, AppearanceSection, ClockSection, GeneralSection, SearchSection, ShortcutsSection, WidgetsSection } from './sections';
import { BackgroundSection } from './BackgroundSection';
import { DataSection } from './DataSection';

interface PageDef {
  id: Exclude<SettingsPage, 'home'>;
  label: string;
  icon: ComponentChildren;
  color: string;
  render: () => ComponentChildren;
}

const PAGES: PageDef[] = [
  { id: 'background', label: 'Arrière-plan', icon: <Image size={15} />, color: '#30B0C7', render: () => <BackgroundSection /> },
  { id: 'appearance', label: 'Apparence', icon: <Palette size={15} />, color: '#AF52DE', render: () => <AppearanceSection /> },
  { id: 'clock', label: 'Heure et date', icon: <Clock size={15} />, color: '#FF9500', render: () => <ClockSection /> },
  { id: 'search', label: 'Recherche', icon: <Search size={15} />, color: '#34C759', render: () => <SearchSection /> },
  { id: 'shortcuts', label: 'Raccourcis', icon: <LayoutGrid size={15} />, color: '#007AFF', render: () => <ShortcutsSection /> },
  { id: 'widgets', label: 'Widgets', icon: <Puzzle size={15} />, color: '#FF2D55', render: () => <WidgetsSection /> },
  { id: 'general', label: 'Général', icon: <Settings2 size={15} />, color: '#8E8E93', render: () => <GeneralSection /> },
  { id: 'data', label: 'Données et synchronisation', icon: <Database size={15} />, color: '#5856D6', render: () => <DataSection /> },
  { id: 'about', label: 'À propos', icon: <Info size={15} />, color: '#636366', render: () => <AboutSection /> },
];

export function SettingsPanel() {
  const page = settingsPage.value;
  const ref = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    opener.current = document.activeElement as HTMLElement;
    return () => opener.current?.focus?.({ preventScroll: true });
  }, []);

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
    ref.current?.querySelector('.drawer-scroll')?.scrollTo({ top: 0 });
  }, [page]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('dialog[open], .menu')) return;
      e.preventDefault();
      settingsPage.value = page && page !== 'home' ? 'home' : null;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [page]);

  if (!page) return null;
  const def = PAGES.find((p) => p.id === page);

  return (
    <div ref={ref} class="drawer" role="dialog" aria-modal="false" aria-labelledby="drawer-title">
      <header class="drawer-head">
        {def ? (
          <button type="button" class="drawer-back" onClick={() => (settingsPage.value = 'home')}>
            <ChevronLeft size={18} /> Réglages
          </button>
        ) : (
          <span />
        )}
        <h2 id="drawer-title" ref={titleRef} tabIndex={-1} class={def ? 'sr-only' : ''}>
          {def?.label ?? 'Réglages'}
        </h2>
        <button type="button" class="icon-btn" aria-label="Fermer les réglages" onClick={() => (settingsPage.value = null)}>
          <X size={16} />
        </button>
      </header>
      <div class="drawer-scroll">
        {def ? (
          <div class="drawer-page" key={def.id}>
            <h2 class="drawer-page-title" aria-hidden="true">{def.label}</h2>
            {def.render()}
          </div>
        ) : (
          <nav class="drawer-home" aria-label="Catégories de réglages">
            {[PAGES.slice(0, 6), PAGES.slice(6)].map((chunk, i) => (
              <ul key={i} class="set-group-body nav-list">
                {chunk.map((p) => (
                  <li key={p.id}>
                    <button type="button" class="nav-row" onClick={() => (settingsPage.value = p.id)}>
                      <span class="nav-icon" style={{ background: p.color }}>
                        {p.icon}
                      </span>
                      <span class="nav-label">{p.label}</span>
                      <ChevronRight size={15} class="nav-chevron" />
                    </button>
                  </li>
                ))}
              </ul>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}

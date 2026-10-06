import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { LayoutGrid, Plus, Settings as SettingsIcon } from 'lucide-preact';
import { Background } from '../features/background/Background';
import { setBackgroundFromFile } from '../features/background/actions';
import { Clock } from '../features/clock/Clock';
import { Search } from '../features/search/Search';
import { Shortcuts } from '../features/shortcuts/Shortcuts';
import { WidgetArea, WidgetSettings } from '../widgets/WidgetArea';
import { MenuHost, openMenu } from '../components/Menu';
import { ToastHost } from '../components/Toast';
import { activeGroupId, groups, hydrated, settings, widgets } from '../state/store';
import { editor, openEditor, openSettings, settingsPage, toast } from './ui';
import { normalizeUrl } from '../lib/url';
import { drag } from '../lib/dnd';

/*
 * Réglages, éditeurs et présentation ne servent pas au premier affichage :
 * ils sont chargés à part, puis préchargés quand le navigateur est inactif.
 */
const loaders = {
  settings: () => import('../features/settings/Settings'),
  shortcut: () => import('../features/shortcuts/ShortcutEditor'),
  group: () => import('../features/shortcuts/GroupEditor'),
  library: () => import('../widgets/WidgetLibrary'),
  onboarding: () => import('../features/onboarding/Onboarding'),
};

export function preloadPanels() {
  for (const load of Object.values(loaders)) void load();
}

function Lazy<T>({ load, render }: { load: () => Promise<T>; render: (mod: T) => ComponentChildren }) {
  const [mod, setMod] = useState<T | null>(null);
  useEffect(() => {
    let alive = true;
    load().then((m) => alive && setMod(() => m));
    return () => {
      alive = false;
    };
  }, [load]);
  return mod ? <>{render(mod)}</> : null;
}

function Editors() {
  const e = editor.value;
  if (!e) return null;
  switch (e.kind) {
    case 'shortcut':
      return (
        <Lazy
          load={loaders.shortcut}
          render={({ ShortcutEditor }) => <ShortcutEditor key={e.shortcutId ?? 'new'} groupId={e.groupId} shortcutId={e.shortcutId} initialUrl={e.url} index={e.index} />}
        />
      );
    case 'group':
      return <Lazy load={loaders.group} render={({ GroupEditor }) => <GroupEditor key={e.groupId ?? 'new'} groupId={e.groupId} />} />;
    case 'widget-library':
      return <Lazy load={loaders.library} render={({ WidgetLibrary }) => <WidgetLibrary />} />;
    case 'widget-settings':
      return <WidgetSettings key={e.widgetId} widgetId={e.widgetId} />;
    case 'onboarding':
      return <Lazy load={loaders.onboarding} render={({ Onboarding }) => <Onboarding />} />;
  }
}

/** Dépôt de fichiers et de liens venant d'ailleurs (bureau, autre fenêtre). */
function useExternalDrop() {
  const [over, setOver] = useState<'image' | 'link' | null>(null);
  useEffect(() => {
    let depth = 0;
    const kind = (dt: DataTransfer | null): 'image' | 'link' | null => {
      if (!dt || drag.peek()) return null;
      if (Array.from(dt.items).some((i) => i.kind === 'file' && i.type.startsWith('image/'))) return 'image';
      if (dt.types.includes('text/uri-list') || dt.types.includes('text/plain')) return 'link';
      return null;
    };
    const onEnter = (e: DragEvent) => {
      const k = kind(e.dataTransfer);
      if (!k) return;
      depth++;
      setOver(k);
    };
    const onOver = (e: DragEvent) => {
      if (kind(e.dataTransfer)) e.preventDefault();
    };
    const onLeave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setOver(null);
    };
    const onDrop = (e: DragEvent) => {
      depth = 0;
      setOver(null);
      const dt = e.dataTransfer;
      if (!dt || e.defaultPrevented) return;
      const file = Array.from(dt.files).find((f) => f.type.startsWith('image/'));
      if (file) {
        e.preventDefault();
        void setBackgroundFromFile(file, { undoable: true });
        return;
      }
      const raw = (dt.getData('text/uri-list') || dt.getData('text/plain')).split('\n').find((l) => l && !l.startsWith('#'));
      const url = raw ? normalizeUrl(raw.trim()) : null;
      if (url && /^https?:/.test(url)) {
        e.preventDefault();
        const g = groups.value.find((x) => x.id === activeGroupId.value) ?? groups.value[0];
        if (g) openEditor({ kind: 'shortcut', groupId: g.id, url });
      } else if (raw) {
        e.preventDefault();
        toast('Déposez un lien ou une image.');
      }
    };
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragover', onOver);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, []);
  return over;
}

export function App() {
  const s = settings.value;
  const hasWidgets = widgets.value.length > 0;
  const dropping = useExternalDrop();
  const side = hasWidgets && s.layout.widgets !== 'bottom' ? s.layout.widgets : null;

  useEffect(() => {
    if (hydrated.value && !s.onboarded && !editor.value) openEditor({ kind: 'onboarding' });
  }, [hydrated.value]);

  function backgroundMenu(e: MouseEvent) {
    // Menu personnalisé seulement sur le fond vide, pas sur le texte ou les éléments.
    const t = e.target as HTMLElement;
    if (t.closest('a, button, input, textarea, .widget, .search, .clock, .tile, .menu')) return;
    const g = groups.value.find((x) => x.id === activeGroupId.value) ?? groups.value[0];
    openMenu(e, [
      { label: 'Ajouter un raccourci', icon: <Plus size={14} />, disabled: !g, onSelect: () => g && openEditor({ kind: 'shortcut', groupId: g.id }) },
      { label: 'Ajouter un widget', icon: <LayoutGrid size={14} />, onSelect: () => openEditor({ kind: 'widget-library' }) },
      { type: 'separator' },
      { label: 'Changer l’arrière-plan…', onSelect: () => openSettings('background') },
      { label: 'Réglages…', icon: <SettingsIcon size={14} />, onSelect: () => openSettings() },
    ]);
  }

  return (
    <>
      <Background />
      <div class={`shell hero-${s.layout.hero} ${side ? `has-side side-${side}` : ''} ${settingsPage.value ? 'has-drawer' : ''}`} onContextMenu={backgroundMenu}>
        <main class="main" id="main">
          <section class="hero" aria-label="Heure et recherche">
            <Clock />
            <Search />
          </section>
          <Shortcuts />
          {!side && <WidgetArea />}
        </main>
        {side && (
          <aside class="side" aria-label="Widgets">
            <WidgetArea />
          </aside>
        )}
      </div>
      <nav class="dock" aria-label="Actions">
        <button type="button" class="dock-btn" aria-label="Ajouter un widget" title="Ajouter un widget" onClick={() => openEditor({ kind: 'widget-library' })}>
          <LayoutGrid size={17} />
        </button>
        <button
          type="button"
          class={`dock-btn ${settingsPage.value ? 'is-on' : ''}`}
          aria-label="Réglages"
          title="Réglages"
          aria-expanded={!!settingsPage.value}
          onClick={() => (settingsPage.value = settingsPage.value ? null : 'home')}
        >
          <SettingsIcon size={17} />
        </button>
      </nav>
      {settingsPage.value && <Lazy load={loaders.settings} render={({ SettingsPanel }) => <SettingsPanel />} />}
      <Editors />
      <MenuHost />
      <ToastHost />
      {dropping && (
        <div class="drop-overlay" aria-hidden="true">
          <p>{dropping === 'image' ? 'Déposez pour en faire votre arrière-plan' : 'Déposez pour créer un raccourci'}</p>
        </div>
      )}
    </>
  );
}

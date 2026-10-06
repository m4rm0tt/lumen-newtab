// Deux affichages : « tabs » (une grille, celle du groupe actif) et « sections » (tous les groupes).
import { useEffect, useRef } from 'preact/hooks';
import { useSignalEffect } from '@preact/signals';
import { Copy, ExternalLink, FolderInput, GripVertical, Pencil, Plus, Trash } from 'lucide-preact';
import type { Group, Shortcut } from '../../types';
import {
  activeGroupId, groups, moveGroup, moveShortcut, removeGroup, removeShortcut, setActiveGroup, settings,
} from '../../state/store';
import { arrange, drag, pointerDownDrag, registerDropHandler } from '../../lib/dnd';
import { useFlip } from '../../lib/flip';
import { openMenu, type MenuEntry } from '../../components/Menu';
import { GroupGlyph } from '../../components/Icon';
import { ShortcutIcon, usesColoredPlate } from '../../components/ShortcutIcon';
import { openEditor, toast, undoToast } from '../../app/ui';
import { navigate } from '../search/Search';
import { hostnameOf } from '../../lib/url';

// ---------------------------------------------------------------------------
// Dépose

function useDropHandlers() {
  useEffect(() => {
    const offShortcut = registerDropHandler('shortcut', (item, res) => {
      if ('target' in res) {
        if (res.target === groupOfShortcut(item.id)) return;
        moveShortcut(item.id, res.target);
        const g = groups.value.find((x) => x.id === res.target);
        if (g) toast(`Déplacé dans « ${g.name} »`);
      } else if (res.container.startsWith('grid:')) {
        moveShortcut(item.id, res.container.slice(5), res.index);
      }
    });
    const offGroup = registerDropHandler('group', (item, res) => {
      if ('container' in res) moveGroup(item.id, res.index);
    });
    return () => {
      offShortcut();
      offGroup();
    };
  }, []);

  // Survoler un onglet de groupe pendant un drag l'ouvre (comme les dossiers à ressort de macOS).
  useSignalEffect(() => {
    const d = drag.value;
    if (!d || d.item.kind !== 'shortcut' || !d.target || settings.value.shortcuts.display !== 'tabs') return;
    const target = d.target;
    const t = setTimeout(() => {
      if (drag.peek()?.target === target) setActiveGroup(target);
    }, 550);
    return () => clearTimeout(t);
  });
}

function groupOfShortcut(id: string): string | undefined {
  return groups.value.find((g) => g.shortcuts.some((s) => s.id === id))?.id;
}

// ---------------------------------------------------------------------------

export function Shortcuts() {
  useDropHandlers();
  const s = settings.value.shortcuts;
  const gs = groups.value;

  if (gs.length === 0) {
    return (
      <div class="shortcuts-empty">
        <p>Aucun groupe pour l'instant.</p>
        <button type="button" class="btn btn-primary" onClick={() => openEditor({ kind: 'group' })}>
          <Plus size={16} /> Créer un groupe
        </button>
      </div>
    );
  }

  if (s.display === 'sections') return <Sections groups={gs} />;

  const active = gs.find((g) => g.id === activeGroupId.value) ?? gs[0];
  return (
    <div class="shortcuts">
      <GroupBar groups={gs} activeId={active.id} />
      <div role="tabpanel" id={`panel-${active.id}`} aria-labelledby={`tab-${active.id}`} class="panel" key={active.id}>
        <ShortcutGrid group={active} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Barre de groupes

function groupMenu(g: Group): MenuEntry[] {
  return [
    { label: 'Ajouter un raccourci', icon: <Plus size={14} />, onSelect: () => openEditor({ kind: 'shortcut', groupId: g.id }) },
    { label: 'Modifier le groupe…', icon: <Pencil size={14} />, onSelect: () => openEditor({ kind: 'group', groupId: g.id }) },
    { label: 'Ouvrir tous les raccourcis', icon: <ExternalLink size={14} />, disabled: g.shortcuts.length === 0, onSelect: () => openAll(g) },
    { type: 'separator' },
    { label: 'Supprimer le groupe', icon: <Trash size={14} />, danger: true, onSelect: () => deleteGroup(g) },
  ];
}

function openAll(g: Group) {
  if (g.shortcuts.length > 12 && !confirm(`Ouvrir ${g.shortcuts.length} onglets ?`)) return;
  for (const s of g.shortcuts) navigate(s.url, true);
}

export function deleteGroup(g: Group) {
  const undo = removeGroup(g.id);
  undoToast(`Groupe « ${g.name} » supprimé${g.shortcuts.length ? ` (${g.shortcuts.length} raccourci${g.shortcuts.length > 1 ? 's' : ''})` : ''}`, undo);
}

function GroupBar({ groups: gs, activeId }: { groups: Group[]; activeId: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useFlip(ref);
  const d = drag.value;
  const list = arrange(gs, (g) => g.id, 'groups', d);

  function onKeyDown(e: KeyboardEvent, g: Group, index: number) {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (dir && e.altKey) {
      e.preventDefault();
      moveGroup(g.id, Math.max(0, index + dir));
      requestAnimationFrame(() => document.getElementById(`tab-${g.id}`)?.focus());
    } else if (dir) {
      e.preventDefault();
      const next = gs[(index + dir + gs.length) % gs.length];
      setActiveGroup(next.id);
      document.getElementById(`tab-${next.id}`)?.focus();
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      const next = e.key === 'Home' ? gs[0] : gs[gs.length - 1];
      setActiveGroup(next.id);
      document.getElementById(`tab-${next.id}`)?.focus();
    } else if (e.key === 'F2' || (e.key === 'Enter' && e.altKey)) {
      e.preventDefault();
      openEditor({ kind: 'group', groupId: g.id });
    } else if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
      openMenu(e, groupMenu(g));
    }
  }

  return (
    <div class="group-bar-wrap">
      <div ref={ref} class="group-bar" role="tablist" aria-label="Groupes de raccourcis" data-dnd-container="groups" data-dnd-accept="group" data-dnd-axis="x">
        {list.map((g, i) => {
          if (g === 'slot') return <span key="__slot" class="group-pill is-slot" data-dnd-item="__slot" />;
          const on = g.id === activeId;
          const dragging = d?.item.id === g.id;
          const dropTarget = d?.item.kind === 'shortcut' && d.target === g.id;
          return (
            <button
              key={g.id}
              id={`tab-${g.id}`}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls={`panel-${g.id}`}
              tabIndex={on ? 0 : -1}
              class={`group-pill ${on ? 'is-active' : ''} ${dragging ? 'is-dragging' : ''} ${dropTarget ? 'is-drop' : ''}`}
              style={g.accent ? ({ '--group-accent': g.accent } as Record<string, string>) : undefined}
              data-dnd-item={g.id}
              data-dnd-target={g.id}
              data-dnd-accept="shortcut"
              data-flip={g.id}
              title={`${g.name} (${g.shortcuts.length} raccourci${g.shortcuts.length > 1 ? 's' : ''})`}
              onClick={() => setActiveGroup(g.id)}
              onDblClick={() => openEditor({ kind: 'group', groupId: g.id })}
              onContextMenu={(e) => openMenu(e, groupMenu(g))}
              onPointerDown={(e) => pointerDownDrag(e, { kind: 'group', id: g.id, container: 'groups' })}
              onKeyDown={(e) => onKeyDown(e, g, i)}
            >
              <GroupGlyph icon={g.icon} size={15} />
              <span class="group-name">{g.name}</span>
            </button>
          );
        })}
        <button type="button" class="group-pill is-add" aria-label="Nouveau groupe" title="Nouveau groupe" onClick={() => openEditor({ kind: 'group' })}>
          <Plus size={15} />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grille

export function ShortcutGrid({ group, compact }: { group: Group; compact?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useFlip(ref);
  const s = settings.value.shortcuts;
  const d = drag.value;
  const containerId = `grid:${group.id}`;
  const list = arrange(group.shortcuts, (x) => x.id, containerId, d);
  const cols = s.columns > 0 && !compact ? `repeat(${s.columns}, var(--cell))` : undefined;
  const receiving = d?.item.kind === 'shortcut' && d.over?.container === containerId && d.item.container !== containerId;

  return (
    <div
      ref={ref}
      class={`grid ${s.labels ? '' : 'no-labels'} ${receiving ? 'is-receiving' : ''} ${group.shortcuts.length === 0 ? 'is-empty' : ''}`}
      style={cols ? { gridTemplateColumns: cols } : undefined}
      data-dnd-container={containerId}
      data-dnd-accept="shortcut"
      data-dnd-axis="grid"
      aria-label={`Raccourcis du groupe ${group.name}`}
    >
      {list.map((sc, i) =>
        sc === 'slot' ? (
          <div key="__slot" class="tile is-slot" data-dnd-item="__slot" data-flip="__slot">
            <span class="plate" />
          </div>
        ) : (
          <Tile key={sc.id} sc={sc} group={group} index={i} dragging={d?.item.id === sc.id} />
        ),
      )}
      <button
        type="button"
        class="tile is-add"
        data-flip="__add"
        aria-label={`Ajouter un raccourci à ${group.name}`}
        title="Ajouter un raccourci"
        onClick={() => openEditor({ kind: 'shortcut', groupId: group.id })}
      >
        <span class="plate">
          <Plus size={Math.round(s.size * 0.38)} strokeWidth={1.8} />
        </span>
        {s.labels && <span class="tile-label">Ajouter</span>}
      </button>
    </div>
  );
}

function shortcutMenu(sc: Shortcut, group: Group): MenuEntry[] {
  const others = groups.value.filter((g) => g.id !== group.id);
  const entries: MenuEntry[] = [
    { label: 'Ouvrir dans un nouvel onglet', icon: <ExternalLink size={14} />, onSelect: () => navigate(sc.url, true) },
    { label: 'Modifier…', icon: <Pencil size={14} />, hint: 'E', onSelect: () => openEditor({ kind: 'shortcut', groupId: group.id, shortcutId: sc.id }) },
    {
      label: 'Copier l’adresse',
      icon: <Copy size={14} />,
      onSelect: () => navigator.clipboard.writeText(sc.url).then(() => toast('Adresse copiée'), () => toast('Copie impossible', { tone: 'error' })),
    },
  ];
  if (others.length) {
    entries.push({ type: 'separator' }, { type: 'label', label: 'Déplacer vers' });
    for (const g of others.slice(0, 12)) {
      entries.push({ label: g.name, icon: <FolderInput size={14} />, onSelect: () => moveShortcut(sc.id, g.id) });
    }
  }
  entries.push({ type: 'separator' }, { label: 'Supprimer', icon: <Trash size={14} />, danger: true, hint: '⌫', onSelect: () => deleteShortcut(sc) });
  return entries;
}

function deleteShortcut(sc: Shortcut) {
  const undo = removeShortcut(sc.id);
  undoToast(`« ${sc.title} » supprimé`, undo);
}

function Tile({ sc, group, index, dragging }: { sc: Shortcut; group: Group; index: number; dragging: boolean }) {
  const s = settings.value.shortcuts;
  const colored = usesColoredPlate(sc.icon) || (sc.icon.kind === 'auto' && !!sc.color);

  function onKeyDown(e: KeyboardEvent) {
    const el = e.currentTarget as HTMLElement;
    if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      moveShortcut(sc.id, group.id, Math.max(0, index + (e.key === 'ArrowRight' ? 1 : -1)));
      requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-dnd-item="${sc.id}"]`)?.focus());
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      const next = (el.nextElementSibling ?? el.previousElementSibling) as HTMLElement | null;
      deleteShortcut(sc);
      next?.focus();
    } else if (e.key === 'e' || e.key === 'F2') {
      e.preventDefault();
      openEditor({ kind: 'shortcut', groupId: group.id, shortcutId: sc.id });
    } else if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
      openMenu(e, shortcutMenu(sc, group));
    } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      moveFocusInGrid(el, e.key);
    }
  }

  return (
    <a
      class={`tile ${s.style === 'plain' ? 'is-plain' : ''} ${dragging ? 'is-dragging' : ''}`}
      href={sc.url}
      target={s.newTab ? '_blank' : undefined}
      rel="noopener noreferrer"
      draggable={false}
      data-dnd-item={sc.id}
      data-flip={sc.id}
      title={s.labels ? hostnameOf(sc.url) : `${sc.title} (${hostnameOf(sc.url)})`}
      aria-label={sc.title}
      onPointerDown={(e) => pointerDownDrag(e, { kind: 'shortcut', id: sc.id, container: `grid:${group.id}` })}
      onContextMenu={(e) => openMenu(e, shortcutMenu(sc, group))}
      onKeyDown={onKeyDown}
      onClick={(e) => {
        if (/^(chrome|chrome-extension|edge|about|file):/i.test(sc.url)) {
          e.preventDefault();
          navigate(sc.url, s.newTab || e.metaKey || e.ctrlKey);
        }
      }}
    >
      <span class={`plate ${colored ? 'is-colored' : ''}`} style={sc.color ? ({ '--plate': sc.color } as Record<string, string>) : undefined}>
        <ShortcutIcon icon={sc.icon} title={sc.title} url={sc.url} color={sc.color} size={s.size} />
      </span>
      {s.labels && <span class="tile-label">{sc.title}</span>}
    </a>
  );
}

/** Navigation au clavier dans la grille (flèches), en tenant compte des colonnes réelles. */
function moveFocusInGrid(el: HTMLElement, key: string) {
  const grid = el.parentElement;
  if (!grid) return;
  const tiles = Array.from(grid.querySelectorAll<HTMLElement>(':scope > .tile:not(.is-slot)'));
  const i = tiles.indexOf(el);
  const top = el.offsetTop;
  const perRow = tiles.filter((t) => t.offsetTop === top).length || 1;
  const delta = key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : key === 'ArrowUp' ? -perRow : perRow;
  tiles[Math.max(0, Math.min(tiles.length - 1, i + delta))]?.focus();
}

// ---------------------------------------------------------------------------
// Mode sections

function Sections({ groups: gs }: { groups: Group[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useFlip(ref);
  const d = drag.value;
  const list = arrange(gs, (g) => g.id, 'sections', d);
  return (
    <div class="sections-wrap">
      <div ref={ref} class="sections" data-dnd-container="sections" data-dnd-accept="group" data-dnd-axis="grid">
        {list.map((g) =>
          g === 'slot' ? (
            <section key="__slot" class="section card is-slot" data-dnd-item="__slot" />
          ) : (
            <section
              key={g.id}
              class={`section card ${d?.item.id === g.id ? 'is-dragging' : ''}`}
              data-dnd-item={g.id}
              data-flip={g.id}
              style={g.accent ? ({ '--group-accent': g.accent } as Record<string, string>) : undefined}
              aria-label={g.name}
            >
              <header class="section-head" onContextMenu={(e) => openMenu(e, groupMenu(g))}>
                <span class="section-handle" title="Glisser pour déplacer le groupe" onPointerDown={(e) => pointerDownDrag(e, { kind: 'group', id: g.id, container: 'sections' }, (e.currentTarget as HTMLElement).closest('section')!)}>
                  <GripVertical size={14} />
                </span>
                <GroupGlyph icon={g.icon} size={15} />
                <h2 class="section-title" onDblClick={() => openEditor({ kind: 'group', groupId: g.id })}>{g.name}</h2>
                <button type="button" class="icon-btn section-more" aria-label={`Options du groupe ${g.name}`} onClick={(e) => openMenu(e, groupMenu(g))}>
                  <Pencil size={13} />
                </button>
              </header>
              <ShortcutGrid group={g} compact />
            </section>
          ),
        )}
        <button type="button" class="section card is-add" onClick={() => openEditor({ kind: 'group' })}>
          <Plus size={18} /> Nouveau groupe
        </button>
      </div>
    </div>
  );
}

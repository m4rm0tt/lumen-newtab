// Glisser-déposer sur les Pointer Events. L'API HTML5 ne sait pas animer les voisins
// ni déposer sur un onglet de groupe.
//
// Côté DOM :
//   data-dnd-container="<id>" data-dnd-accept="shortcut" data-dnd-axis="grid|x|y"  liste triable
//   data-dnd-item="<id>"                                                            un élément de la liste
//   data-dnd-target="<id>" data-dnd-accept="shortcut"                               cible simple (onglet)
import { signal } from '@preact/signals';
import { layoutRect, prefersReducedMotion } from './flip';

export type DragKind = 'shortcut' | 'group' | 'widget' | 'todo';
export type Axis = 'x' | 'y' | 'grid';

export interface DragItem {
  kind: DragKind;
  id: string;
  container: string;
}

export type DropResult = { container: string; index: number } | { target: string };

export interface DragState {
  item: DragItem;
  over: { container: string; index: number } | null;
  target: string | null;
}

export const drag = signal<DragState | null>(null);

type DropHandler = (item: DragItem, result: DropResult) => void;
const handlers = new Map<DragKind, DropHandler>();

export function registerDropHandler(kind: DragKind, fn: DropHandler): () => void {
  handlers.set(kind, fn);
  return () => handlers.get(kind) === fn && handlers.delete(kind);
}

interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Index d'insertion (dans la liste sans l'élément déplacé) pour un pointeur en (x, y). */
export function insertionIndex(rects: RectLike[], x: number, y: number, axis: Axis): number {
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (axis === 'x') {
      if (x < r.left + r.width / 2) return i;
    } else if (axis === 'y') {
      if (y < r.top + r.height / 2) return i;
    } else {
      if (y < r.top) return i;
      if (y <= r.top + r.height && x < r.left + r.width / 2) return i;
    }
  }
  return rects.length;
}

/**
 * Liste à afficher pendant un drag pour un conteneur donné :
 * l'élément déplacé est inséré à sa position de survol, ou retiré s'il survole un autre conteneur.
 * 'slot' = emplacement vide pour un élément venant d'un autre conteneur.
 */
export function arrange<T>(items: T[], getId: (t: T) => string, containerId: string, state: DragState | null): (T | 'slot')[] {
  if (!state) return items;
  const { item, over } = state;
  const fromHere = item.container === containerId;
  if (!fromHere && over?.container !== containerId) return items;
  const rest: (T | 'slot')[] = fromHere ? items.filter((t) => getId(t) !== item.id) : [...items];
  const self = fromHere ? items.find((t) => getId(t) === item.id) : undefined;
  if (over?.container === containerId) {
    rest.splice(Math.min(over.index, rest.length), 0, self ?? 'slot');
    return rest;
  }
  if (fromHere && over === null && self) {
    // Hors de toute zone : l'élément reste visible (estompé) à sa place d'origine.
    return items;
  }
  return rest;
}

// ---------------------------------------------------------------------------

const THRESHOLD = 6;

interface Session {
  item: DragItem;
  source: HTMLElement;
  ghost: HTMLElement;
  offsetX: number;
  offsetY: number;
  lastContainer: Element | null;
}

let session: Session | null = null;
let layer: HTMLElement | null = null;

function ensureLayer(): HTMLElement {
  if (!layer || !layer.isConnected) {
    layer = document.createElement('div');
    layer.className = 'dnd-layer';
    document.body.appendChild(layer);
  }
  return layer;
}

function accepts(el: Element, kind: DragKind): boolean {
  return (el.getAttribute('data-dnd-accept') ?? '').split(' ').includes(kind);
}

function findDropAt(x: number, y: number, kind: DragKind): { container: Element | null; target: Element | null } {
  let el = document.elementFromPoint(x, y);
  while (el) {
    if (el.hasAttribute('data-dnd-target') && accepts(el, kind)) return { container: null, target: el };
    if (el.hasAttribute('data-dnd-container') && accepts(el, kind)) return { container: el, target: null };
    el = el.parentElement;
  }
  // Tolérance : près du dernier conteneur survolé, on reste dedans (bords de grille).
  const last = session?.lastContainer;
  if (last?.isConnected) {
    const r = last.getBoundingClientRect();
    const m = 40;
    if (x > r.left - m && x < r.right + m && y > r.top - m && y < r.bottom + m) return { container: last, target: null };
  }
  return { container: null, target: null };
}

function computeOver(container: Element, item: DragItem, x: number, y: number): { container: string; index: number } {
  const id = container.getAttribute('data-dnd-container')!;
  const axis = (container.getAttribute('data-dnd-axis') as Axis) ?? 'grid';
  const children = Array.from(container.querySelectorAll<HTMLElement>(':scope > [data-dnd-item], :scope > * > [data-dnd-item]'))
    .filter((el) => el.closest('[data-dnd-container]') === container)
    .filter((el) => el.dataset.dndItem !== item.id && el.dataset.dndItem !== '__slot');
  return { container: id, index: insertionIndex(children.map(layoutRect), x, y, axis) };
}

function onMove(e: PointerEvent) {
  if (!session) return;
  const { ghost, offsetX, offsetY, item } = session;
  ghost.style.transform = `translate3d(${e.clientX - offsetX}px, ${e.clientY - offsetY}px, 0) scale(1.04)`;
  const { container, target } = findDropAt(e.clientX, e.clientY, item.kind);
  const cur = drag.peek();
  if (target) {
    const t = target.getAttribute('data-dnd-target')!;
    if (cur?.target !== t || cur.over !== null) drag.value = { item, over: null, target: t };
  } else if (container) {
    session.lastContainer = container;
    const over = computeOver(container, item, e.clientX, e.clientY);
    if (cur?.over?.container !== over.container || cur.over.index !== over.index || cur.target)
      drag.value = { item, over, target: null };
  } else if (cur?.over || cur?.target) {
    drag.value = { item, over: null, target: null };
  }
  // Défilement automatique près des bords de la fenêtre.
  const edge = 56;
  if (e.clientY < edge) scrollBy(0, -12);
  else if (e.clientY > innerHeight - edge) scrollBy(0, 12);
}

function finish(commit: boolean) {
  if (!session) return;
  const { ghost, item } = session;
  const state = drag.peek();
  session = null;
  window.removeEventListener('pointermove', onMove);
  window.removeEventListener('keydown', onKey, true);
  document.documentElement.classList.remove('is-dragging');

  if (commit && state) {
    const handler = handlers.get(item.kind);
    if (state.target) handler?.(item, { target: state.target });
    else if (state.over) handler?.(item, state.over);
  }
  drag.value = null;

  // Animation de dépose : le fantôme rejoint la position finale de l'élément.
  requestAnimationFrame(() => {
    const dest = document.querySelector<HTMLElement>(`[data-dnd-item="${CSS.escape(item.id)}"]`);
    if (!dest || prefersReducedMotion() || (commit && state?.target)) {
      ghost.remove();
      return;
    }
    const r = dest.getBoundingClientRect();
    const a = ghost.animate([{ transform: ghost.style.transform, opacity: 1 }, { transform: `translate3d(${r.left}px, ${r.top}px, 0) scale(1)`, opacity: 1 }], {
      duration: 180,
      easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    });
    a.onfinish = () => ghost.remove();
    a.oncancel = () => ghost.remove();
  });
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    finish(false);
  }
}

function suppressNextClick() {
  const stop = (ev: Event) => {
    ev.preventDefault();
    ev.stopPropagation();
  };
  window.addEventListener('click', stop, { capture: true, once: true });
  // Si aucun clic ne suit (relâché hors de l'élément), retire l'écouteur.
  setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 50);
}

function begin(item: DragItem, source: HTMLElement, e: PointerEvent, startX: number, startY: number) {
  const rect = source.getBoundingClientRect();
  const ghost = source.cloneNode(true) as HTMLElement;
  ghost.removeAttribute('data-dnd-item');
  ghost.removeAttribute('data-flip');
  ghost.removeAttribute('id');
  ghost.classList.add('dnd-ghost');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.style.width = `${rect.width}px`;
  ghost.style.height = `${rect.height}px`;
  const offsetX = startX - rect.left;
  const offsetY = startY - rect.top;
  ghost.style.transform = `translate3d(${e.clientX - offsetX}px, ${e.clientY - offsetY}px, 0) scale(1.04)`;
  ensureLayer().appendChild(ghost);
  session = { item, source, ghost, offsetX, offsetY, lastContainer: source.closest('[data-dnd-container]') };
  document.documentElement.classList.add('is-dragging');
  drag.value = { item, over: { container: item.container, index: indexIn(source, item) }, target: null };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('keydown', onKey, true);
}

function indexIn(source: HTMLElement, item: DragItem): number {
  const container = source.closest('[data-dnd-container]');
  if (!container) return 0;
  const items = Array.from(container.querySelectorAll<HTMLElement>('[data-dnd-item]')).filter(
    (el) => el.closest('[data-dnd-container]') === container,
  );
  return Math.max(0, items.findIndex((el) => el.dataset.dndItem === item.id));
}

/**
 * À brancher sur onPointerDown d'un élément déplaçable (ou de sa poignée).
 * Le drag ne démarre qu'après un déplacement de quelques pixels : un simple clic reste un clic.
 */
export function pointerDownDrag(e: PointerEvent, item: DragItem, source?: HTMLElement) {
  if (e.button !== 0 || e.pointerType === 'touch' || session) return;
  const el = source ?? (e.currentTarget as HTMLElement);
  const startX = e.clientX;
  const startY = e.clientY;
  let started = false;

  const move = (ev: PointerEvent) => {
    if (started) return;
    if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < THRESHOLD) return;
    started = true;
    window.getSelection()?.removeAllRanges();
    begin(item, el, ev, startX, startY);
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', cancel);
    if (started) {
      suppressNextClick();
      finish(true);
    }
  };
  const cancel = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', cancel);
    if (started) finish(false);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', cancel);
}

// Animations FLIP pour les listes qui se réordonnent. On garde aussi la position de layout
// de chaque élément : le drag & drop s'en sert pour ne pas trembler pendant les animations.
import { useLayoutEffect, useRef } from 'preact/hooks';
import type { RefObject } from 'preact';

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

const layoutBoxes = new WeakMap<Element, Box & { sx: number; sy: number }>();

export function prefersReducedMotion(): boolean {
  return document.documentElement.dataset.motion === 'reduced' || matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Position de layout (coordonnées viewport) d'un élément, sans ses transformations en cours. */
export function layoutRect(el: Element): Box {
  const b = layoutBoxes.get(el);
  if (b) return { left: b.left - (scrollX - b.sx), top: b.top - (scrollY - b.sy), width: b.width, height: b.height };
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

function currentTranslate(el: HTMLElement): [number, number] {
  const t = getComputedStyle(el).transform;
  if (!t || t === 'none') return [0, 0];
  const m = new DOMMatrixReadOnly(t);
  return [m.m41, m.m42];
}

/**
 * Anime les enfants [data-flip] d'un conteneur à chaque rendu.
 * La clé de chaque enfant est la valeur de son attribut data-flip.
 */
export function useFlip(ref: RefObject<HTMLElement | null>, duration = 240): void {
  const prev = useRef(new Map<string, Box>());

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const reduce = prefersReducedMotion();
    const next = new Map<string, Box>();
    const els = root.querySelectorAll<HTMLElement>('[data-flip]');
    const firsts = new Map<HTMLElement, [number, number]>();

    // 1. Position visuelle actuelle = ancien layout + transformation en cours.
    for (const el of els) {
      const id = el.dataset.flip!;
      const old = prev.current.get(id);
      if (old && !reduce) {
        const [tx, ty] = currentTranslate(el);
        firsts.set(el, [old.left + tx, old.top + ty]);
      }
      el.getAnimations().forEach((a) => a.id === 'flip' && a.cancel());
    }
    // 2. Nouveau layout, puis animation de l'écart.
    for (const el of els) {
      const id = el.dataset.flip!;
      const r = el.getBoundingClientRect();
      const box = { left: r.left, top: r.top, width: r.width, height: r.height };
      next.set(id, box);
      layoutBoxes.set(el, { ...box, sx: scrollX, sy: scrollY });
      const first = firsts.get(el);
      if (!first) continue;
      const dx = first[0] - r.left;
      const dy = first[1] - r.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      const anim = el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], {
        duration,
        easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      });
      anim.id = 'flip';
    }
    prev.current = next;
  });
}

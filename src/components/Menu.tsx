// Un seul menu contextuel pour toute l'appli, ouvert par openMenu().
import type { ComponentChildren } from 'preact';
import { signal } from '@preact/signals';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Check } from 'lucide-preact';

export type MenuEntry =
  | { type?: 'item'; label: string; icon?: ComponentChildren; onSelect: () => void; danger?: boolean; disabled?: boolean; checked?: boolean; hint?: string }
  | { type: 'separator' }
  | { type: 'label'; label: string };

interface MenuState {
  x: number;
  y: number;
  entries: MenuEntry[];
  returnFocus: HTMLElement | null;
}

const menuState = signal<MenuState | null>(null);

/** Ouvre le menu à la position du pointeur, ou sous l'élément si ouvert au clavier. */
export function openMenu(e: MouseEvent | KeyboardEvent | { currentTarget: EventTarget | null }, entries: MenuEntry[]) {
  if ('preventDefault' in e) (e as Event).preventDefault();
  if ('stopPropagation' in e) (e as Event).stopPropagation();
  let x = 0;
  let y = 0;
  const target = e.currentTarget as HTMLElement | null;
  if ('clientX' in e && (e.clientX || e.clientY)) {
    x = e.clientX;
    y = e.clientY;
  } else if (target) {
    const r = target.getBoundingClientRect();
    x = r.left;
    y = r.bottom + 6;
  }
  menuState.value = { x, y, entries, returnFocus: (document.activeElement as HTMLElement) ?? null };
}

export function closeMenu() {
  const s = menuState.peek();
  menuState.value = null;
  s?.returnFocus?.focus?.({ preventScroll: true });
}

export function MenuHost() {
  const s = menuState.value;
  if (!s) return null;
  return <MenuPanel state={s} />;
}

function MenuPanel({ state }: { state: MenuState }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: state.x, y: state.y });
  const items = state.entries;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.min(state.x, innerWidth - r.width - 8);
    const y = state.y + r.height > innerHeight - 8 ? Math.max(8, state.y - r.height) : state.y;
    setPos({ x: Math.max(8, x), y });
    el.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')?.focus({ preventScroll: true });
  }, [state]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) closeMenu();
    };
    const onBlur = () => closeMenu();
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('blur', onBlur);
    window.addEventListener('resize', onBlur);
    window.addEventListener('wheel', onBlur, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', onBlur);
      window.removeEventListener('wheel', onBlur);
    };
  }, []);

  function onKeyDown(e: KeyboardEvent) {
    const els = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? []);
    const i = els.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      els[(i + 1) % els.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      els[(i - 1 + els.length) % els.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      els[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      els[els.length - 1]?.focus();
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault();
      closeMenu();
    }
  }

  return (
    <div ref={ref} class="menu" role="menu" style={{ left: `${pos.x}px`, top: `${pos.y}px` }} onKeyDown={onKeyDown} onContextMenu={(e) => e.preventDefault()}>
      {items.map((it, i) => {
        if (it.type === 'separator') return <div key={i} class="menu-sep" role="separator" />;
        if (it.type === 'label') return <div key={i} class="menu-label">{it.label}</div>;
        return (
          <button
            key={i}
            type="button"
            role="menuitem"
            class={`menu-item ${it.danger ? 'is-danger' : ''}`}
            aria-disabled={it.disabled ? 'true' : undefined}
            tabIndex={-1}
            onClick={() => {
              if (it.disabled) return;
              closeMenu();
              it.onSelect();
            }}
          >
            <span class="menu-icon">{it.checked ? <Check size={14} /> : it.icon}</span>
            <span class="menu-text">{it.label}</span>
            {it.hint && <span class="menu-hint">{it.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

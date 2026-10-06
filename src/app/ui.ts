import { signal } from '@preact/signals';
import type { WidgetSize } from '../types';

export type SettingsPage =
  | 'home'
  | 'general'
  | 'appearance'
  | 'background'
  | 'clock'
  | 'search'
  | 'shortcuts'
  | 'widgets'
  | 'data'
  | 'about';

export const settingsPage = signal<SettingsPage | null>(null);

export function openSettings(page: SettingsPage = 'home') {
  settingsPage.value = page;
}

export type Editor =
  | { kind: 'shortcut'; groupId: string; shortcutId?: string; url?: string; index?: number }
  | { kind: 'group'; groupId?: string }
  | { kind: 'widget-library' }
  | { kind: 'widget-settings'; widgetId: string }
  | { kind: 'onboarding' };

export const editor = signal<Editor | null>(null);

export function openEditor(e: Editor) {
  editor.value = e;
}

export function closeEditor() {
  editor.value = null;
}

export interface Toast {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
  tone?: 'info' | 'error';
}

export const toasts = signal<Toast[]>([]);
let toastSeq = 0;

export function toast(message: string, opts: { action?: Toast['action']; tone?: Toast['tone']; duration?: number } = {}) {
  const t: Toast = { id: ++toastSeq, message, action: opts.action, tone: opts.tone };
  toasts.value = [...toasts.value.slice(-2), t];
  setTimeout(() => dismissToast(t.id), opts.duration ?? (opts.action ? 6000 : 3200));
}

export function dismissToast(id: number) {
  toasts.value = toasts.value.filter((t) => t.id !== id);
}

/** Toast avec un bouton Annuler. */
export function undoToast(message: string, undo: () => void) {
  toast(message, { action: { label: 'Annuler', run: undo } });
}

export const SIZE_LABELS: Record<WidgetSize, string> = { s: 'Petit', m: 'Large', t: 'Haut', l: 'Grand' };

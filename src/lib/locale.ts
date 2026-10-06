import { computed } from '@preact/signals';
import { settings } from '../state/store';

/** Locale effective : réglage explicite ou langue du navigateur. */
export const locale = computed(() => {
  const l = settings.value.locale;
  if (l && l !== 'auto') {
    try {
      return Intl.getCanonicalLocales(l)[0] ?? navigator.language;
    } catch {
      return navigator.language || 'fr-FR';
    }
  }
  return navigator.language || 'fr-FR';
});

export function uses12h(loc: string, format: 'auto' | '24' | '12'): boolean {
  if (format === '12') return true;
  if (format === '24') return false;
  const hc = new Intl.DateTimeFormat(loc, { hour: 'numeric' }).resolvedOptions().hourCycle;
  return hc === 'h12' || hc === 'h11';
}

/** Premier jour de la semaine (1 = lundi … 7 = dimanche) selon la locale. */
export function firstDayOfWeek(loc: string): number {
  try {
    const l = new Intl.Locale(loc) as Intl.Locale & { getWeekInfo?: () => { firstDay: number }; weekInfo?: { firstDay: number } };
    const info = l.getWeekInfo?.() ?? l.weekInfo;
    if (info?.firstDay) return info.firstDay;
  } catch {
    /* ignoré */
  }
  return /^(en-US|en-CA|ja|pt-BR|he|ar-SA)/.test(loc) ? 7 : 1;
}

export const LOCALES: { value: string; label: string }[] = [
  { value: 'auto', label: 'Langue du navigateur' },
  { value: 'fr-FR', label: 'Français (France)' },
  { value: 'fr-CA', label: 'Français (Canada)' },
  { value: 'fr-BE', label: 'Français (Belgique)' },
  { value: 'fr-CH', label: 'Français (Suisse)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'es-ES', label: 'Español' },
  { value: 'de-DE', label: 'Deutsch' },
  { value: 'it-IT', label: 'Italiano' },
  { value: 'pt-PT', label: 'Português' },
];

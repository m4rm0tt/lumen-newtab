import type { ComponentChildren } from 'preact';
import { RefreshCw, TriangleAlert, WifiOff } from 'lucide-preact';
import { relativeTime } from '../lib/timing';
import { locale } from '../lib/locale';

export function WidgetMessage({ icon, title, children, action }: { icon?: ComponentChildren; title: string; children?: ComponentChildren; action?: ComponentChildren }) {
  return (
    <div class="w-message">
      {icon && <span class="w-message-icon">{icon}</span>}
      <p class="w-message-title">{title}</p>
      {children && <p class="w-message-text">{children}</p>}
      {action}
    </div>
  );
}

/** Erreur discrète avec bouton Réessayer ; garde les données en cache visibles si elles existent. */
export function WidgetError({ message, onRetry, compact }: { message: string; onRetry: () => void; compact?: boolean }) {
  const offline = !navigator.onLine;
  if (compact) {
    return (
      <button type="button" class="w-stale" onClick={onRetry} title={`${message} Cliquer pour réessayer.`}>
        {offline ? <WifiOff size={12} /> : <TriangleAlert size={12} />}
        <span>{offline ? 'Hors ligne' : 'Non actualisé'}</span>
      </button>
    );
  }
  return (
    <WidgetMessage
      icon={offline ? <WifiOff size={18} /> : <TriangleAlert size={18} />}
      title={offline ? 'Hors ligne' : 'Impossible de charger'}
      action={
        <button type="button" class="btn btn-secondary is-small" onClick={onRetry}>
          <RefreshCw size={13} /> Réessayer
        </button>
      }
    >
      {message}
    </WidgetMessage>
  );
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div class="w-skeleton" aria-busy="true" aria-label="Chargement">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} style={{ width: `${90 - i * 14}%` }} />
      ))}
    </div>
  );
}

export function UpdatedAt({ at, loading, onRefresh }: { at: number | null; loading: boolean; onRefresh: () => void }) {
  return (
    <button type="button" class={`w-updated ${loading ? 'is-loading' : ''}`} onClick={onRefresh} title="Actualiser" aria-label="Actualiser">
      <RefreshCw size={11} />
      {at ? relativeTime(at, locale.value) : '…'}
    </button>
  );
}

/** Mini-graphique SVG (sans dépendance). */
export function Sparkline({ values, width = 80, height = 24, positive }: { values: number[]; width?: number; height?: number; positive?: boolean }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(1)}`).join(' ');
  return (
    <svg class={`sparkline ${positive === undefined ? '' : positive ? 'is-up' : 'is-down'}`} width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={pts} fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
    </svg>
  );
}

export function formatNumber(v: number, loc: string, opts: Intl.NumberFormatOptions = {}): string {
  try {
    return new Intl.NumberFormat(loc, opts).format(v);
  } catch {
    return String(v);
  }
}

export function Change({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined || !Number.isFinite(value)) return <span class="w-change">—</span>;
  const up = value >= 0;
  return (
    <span class={`w-change ${up ? 'is-up' : 'is-down'}`}>
      {up ? '+' : '−'}
      {formatNumber(Math.abs(value), locale.value, { maximumFractionDigits: 2, minimumFractionDigits: 2 })} %
    </span>
  );
}

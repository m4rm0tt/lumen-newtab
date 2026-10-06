import { Fragment } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { ChevronLeft, ChevronRight } from 'lucide-preact';
import { locale, firstDayOfWeek } from '../lib/locale';
import { Row, Switch } from '../components/controls';
import type { WidgetProps, WidgetSettingsProps } from './types';

interface Config {
  weekNumbers: boolean;
}

/** Numéro de semaine ISO 8601. */
export function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Grille de 6 semaines commençant au premier jour de semaine de la locale. */
export function monthGrid(year: number, month: number, firstDay: number): Date[] {
  const first = new Date(year, month, 1);
  const jsFirst = firstDay % 7; // dimanche : 7 chez Intl, 0 chez Date
  const offset = (first.getDay() - jsFirst + 7) % 7;
  const start = new Date(year, month, 1 - offset);
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

function useToday() {
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const now = new Date();
    const ms = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
    const t = setTimeout(() => setToday(new Date()), ms + 1000);
    return () => clearTimeout(t);
  }, [today]);
  return today;
}

export default function Calendar({ config, size }: WidgetProps<Config>) {
  const today = useToday();
  if (size === 's') return <Today today={today} weekNumbers={config.weekNumbers} />;
  return <Month today={today} config={config} />;
}

/** Petit format : la date du jour, lisible d'un coup d'œil. */
function Today({ today, weekNumbers }: { today: Date; weekNumbers: boolean }) {
  const loc = locale.value;
  const weekday = new Intl.DateTimeFormat(loc, { weekday: 'long' }).format(today);
  const month = new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric' }).format(today);
  return (
    <div class="w-cal-today">
      <span class="w-cal-today-wd">{weekday}</span>
      <span class="w-cal-today-n">{today.getDate()}</span>
      <span class="w-cal-today-m">
        {month}
        {weekNumbers && ` · S${isoWeek(today)}`}
      </span>
    </div>
  );
}

function Month({ today, config }: { today: Date; config: Config }) {
  const [cursor, setCursor] = useState(() => ({ y: today.getFullYear(), m: today.getMonth() }));
  const loc = locale.value;
  const fdw = firstDayOfWeek(loc);
  const days = monthGrid(cursor.y, cursor.m, fdw);
  const weekdayFmt = new Intl.DateTimeFormat(loc, { weekday: 'narrow' });
  const monthLabel = new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric' }).format(new Date(cursor.y, cursor.m, 1));
  const isCurrent = cursor.y === today.getFullYear() && cursor.m === today.getMonth();
  const shift = (n: number) => setCursor(({ y, m }) => ({ y: m + n < 0 ? y - 1 : m + n > 11 ? y + 1 : y, m: (m + n + 12) % 12 }));
  // Supprime la 6e semaine si elle est entièrement dans le mois suivant.
  const weeks = days[35].getMonth() !== cursor.m ? 5 : 6;

  return (
    <div class={`w-cal ${config.weekNumbers ? 'has-weeks' : ''}`}>
      <div class="w-cal-head">
        <button type="button" class="w-cal-month" onClick={() => setCursor({ y: today.getFullYear(), m: today.getMonth() })} title="Revenir à aujourd'hui" disabled={isCurrent}>
          {monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}
        </button>
        <div class="w-cal-nav">
          <button type="button" class="icon-btn" aria-label="Mois précédent" onClick={() => shift(-1)}>
            <ChevronLeft size={15} />
          </button>
          <button type="button" class="icon-btn" aria-label="Mois suivant" onClick={() => shift(1)}>
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
      <div class="w-cal-grid" role="grid" aria-label={monthLabel}>
        {config.weekNumbers && <span class="w-cal-wd" />}
        {days.slice(0, 7).map((d) => (
          <span key={`wd${d.getDay()}`} class="w-cal-wd" role="columnheader">
            {weekdayFmt.format(d)}
          </span>
        ))}
        {Array.from({ length: weeks }, (_, w) => (
          <Fragment key={w}>
            {config.weekNumbers && <span class="w-cal-wn">{isoWeek(days[w * 7 + 3])}</span>}
            {days.slice(w * 7, w * 7 + 7).map((d) => {
              const isToday = d.toDateString() === today.toDateString();
              const out = d.getMonth() !== cursor.m;
              return (
                <span
                  key={d.toISOString()}
                  role="gridcell"
                  aria-current={isToday ? 'date' : undefined}
                  class={`w-cal-day ${isToday ? 'is-today' : ''} ${out ? 'is-out' : ''} ${d.getDay() === 0 || d.getDay() === 6 ? 'is-weekend' : ''}`}
                >
                  {d.getDate()}
                </span>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

export function Settings({ config, setConfig }: WidgetSettingsProps<Config>) {
  return (
    <Row label="Numéros de semaine">
      <Switch label="Numéros de semaine" checked={config.weekNumbers} onChange={(v) => setConfig({ weekNumbers: v })} />
    </Row>
  );
}

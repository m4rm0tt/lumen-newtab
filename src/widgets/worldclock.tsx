import { useEffect, useMemo, useState } from 'preact/hooks';
import { Moon, Sun, X } from 'lucide-preact';
import { locale } from '../lib/locale';
import { TextField } from '../components/controls';
import { WidgetMessage } from './kit';
import type { WidgetProps, WidgetSettingsProps } from './types';

interface Zone {
  tz: string;
  label: string;
}
interface Config {
  zones: Zone[];
}

function useMinute() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      const d = new Date();
      setNow(d);
      t = setTimeout(tick, 60000 - d.getSeconds() * 1000 - d.getMilliseconds() + 5);
    };
    tick();
    return () => clearTimeout(t);
  }, []);
  return now;
}

/** Décalage en minutes d'un fuseau à une date donnée. */
export function tzOffset(tz: string, d: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  return Math.round((asUtc - Math.floor(d.getTime() / 60000) * 60000) / 60000);
}

export default function WorldClock({ config, openSettings }: WidgetProps<Config>) {
  const now = useMinute();
  const loc = locale.value;
  const here = -now.getTimezoneOffset();
  if (!config.zones.length) {
    return (
      <WidgetMessage
        title="Aucune ville"
        action={
          <button type="button" class="btn btn-secondary is-small" onClick={openSettings}>
            Ajouter une ville
          </button>
        }
      />
    );
  }
  return (
    <ul class="w-world">
      {config.zones.map((z) => {
        let time = '—';
        let diff = 0;
        let hour = 12;
        try {
          time = new Intl.DateTimeFormat(loc, { timeZone: z.tz, hour: 'numeric', minute: '2-digit' }).format(now);
          hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: z.tz, hour: 'numeric', hourCycle: 'h23' }).format(now));
          diff = (tzOffset(z.tz, now) - here) / 60;
        } catch {
          /* fuseau invalide */
        }
        const day = hour >= 7 && hour < 20;
        return (
          <li key={z.tz} class="w-world-row">
            <span class="w-world-icon" aria-hidden="true">{day ? <Sun size={13} /> : <Moon size={13} />}</span>
            <span class="w-world-city">
              {z.label}
              <small>{diff === 0 ? 'même heure' : `${diff > 0 ? '+' : '−'}${Math.abs(diff)} h`}</small>
            </span>
            <span class="w-world-time">{time}</span>
          </li>
        );
      })}
    </ul>
  );
}

function cityOf(tz: string) {
  return tz.split('/').pop()!.replace(/_/g, ' ');
}

export function Settings({ config, setConfig }: WidgetSettingsProps<Config>) {
  const [q, setQ] = useState('');
  const all = useMemo(() => {
    try {
      return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf('timeZone');
    } catch {
      return ['Europe/Paris', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo', 'Australia/Sydney'];
    }
  }, []);
  const f = q.trim().toLowerCase().replace(/\s+/g, '_');
  const results = f.length >= 2 ? all.filter((tz) => tz.toLowerCase().includes(f)).slice(0, 8) : [];

  return (
    <>
      <ul class="list-editor">
        {config.zones.map((z, i) => (
          <li key={z.tz}>
            <input
              class="field is-quiet"
              value={z.label}
              aria-label={`Nom affiché pour ${z.tz}`}
              onInput={(e) => setConfig({ zones: config.zones.map((x, j) => (j === i ? { ...x, label: (e.currentTarget as HTMLInputElement).value.slice(0, 30) } : x)) })}
            />
            <small class="muted">{z.tz}</small>
            <button type="button" class="icon-btn" aria-label={`Retirer ${z.label}`} onClick={() => setConfig({ zones: config.zones.filter((_, j) => j !== i) })}>
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>
      {config.zones.length < 8 && (
        <label class="field-label">
          Ajouter une ville ou un fuseau
          <TextField value={q} onValue={setQ} placeholder="Tokyo, New York, Montreal…" />
        </label>
      )}
      {results.length > 0 && (
        <ul class="pick-list">
          {results.map((tz) => (
            <li key={tz}>
              <button
                type="button"
                onClick={() => {
                  if (!config.zones.some((z) => z.tz === tz)) setConfig({ zones: [...config.zones, { tz, label: cityOf(tz) }] });
                  setQ('');
                }}
              >
                {cityOf(tz)} <small class="muted">{tz}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

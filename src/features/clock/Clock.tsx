import { useEffect, useState } from 'preact/hooks';
import { settings } from '../../state/store';
import { locale, uses12h } from '../../lib/locale';

function useNow(precision: 'second' | 'minute'): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const d = new Date();
      setNow(d);
      const ms = precision === 'second' ? 1000 - d.getMilliseconds() : 60000 - (d.getSeconds() * 1000 + d.getMilliseconds());
      timer = setTimeout(tick, ms + 5);
    };
    tick();
    // Au retour sur l'onglet, resynchronise immédiatement.
    const onVis = () => document.visibilityState === 'visible' && (clearTimeout(timer), tick());
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [precision]);
  return now;
}

function greetingFor(h: number): string {
  if (h < 5) return 'Bonne nuit';
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

export function Clock() {
  const c = settings.value.clock;
  const loc = locale.value;
  const now = useNow(c.seconds ? 'second' : 'minute');
  if (!c.enabled && !c.showDate && !c.greeting) return null;

  const h12 = uses12h(loc, c.format);
  const parts = new Intl.DateTimeFormat(loc, {
    hour: h12 ? 'numeric' : '2-digit',
    minute: '2-digit',
    second: c.seconds ? '2-digit' : undefined,
    hour12: h12,
  }).formatToParts(now);
  const dayPeriod = parts.find((p) => p.type === 'dayPeriod')?.value;
  const time = parts
    .filter((p) => p.type !== 'dayPeriod')
    .map((p) => p.value)
    .join('')
    .trim();
  const secIndex = c.seconds ? time.lastIndexOf(parts.find((p) => p.type === 'second')?.value ?? '') : -1;

  const dateOpts: Intl.DateTimeFormatOptions =
    c.dateStyle === 'full'
      ? { weekday: 'long', day: 'numeric', month: 'long' }
      : c.dateStyle === 'long'
        ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
        : { weekday: 'short', day: 'numeric', month: 'short' };
  const date = new Intl.DateTimeFormat(loc, dateOpts).format(now);

  return (
    <div class="clock">
      {c.greeting && (
        <p class="clock-greeting">
          {greetingFor(now.getHours())}
          {c.name ? `, ${c.name}` : ''}
        </p>
      )}
      {c.enabled && (
        <time class="clock-time" dateTime={now.toISOString()} aria-label={new Intl.DateTimeFormat(loc, { hour: 'numeric', minute: '2-digit', hour12: h12 }).format(now)}>
          {secIndex > 0 ? (
            <>
              {time.slice(0, secIndex)}
              <span class="clock-sec">{time.slice(secIndex)}</span>
            </>
          ) : (
            time
          )}
          {dayPeriod && <span class="clock-period">{dayPeriod}</span>}
        </time>
      )}
      {c.showDate && <p class="clock-date">{date.charAt(0).toUpperCase() + date.slice(1)}</p>}
    </div>
  );
}

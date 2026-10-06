// Open-Meteo : gratuit, sans clé. La ville se cherche par nom, sans géolocalisation.
import { useEffect, useState } from 'preact/hooks';
import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudSnow, CloudSun, MapPin, Moon, Sun } from 'lucide-preact';
import { fetchJson, useRemote } from '../lib/remote';
import { locale } from '../lib/locale';
import { Row, Segmented, TextField } from '../components/controls';
import { Skeleton, UpdatedAt, WidgetError } from './kit';
import { cacheKey, type WidgetProps, type WidgetSettingsProps } from './types';

interface Place {
  name: string;
  country: string;
  lat: number;
  lon: number;
}
interface Config {
  place: Place | null;
  unit: 'c' | 'f';
}

interface Forecast {
  current: { temperature_2m: number; apparent_temperature: number; weather_code: number; is_day: number; wind_speed_10m: number };
  daily: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[] };
}

/** Libellé et icône pour chaque code météo WMO. */
export function describe(code: number, day = true): { label: string; Icon: typeof Sun } {
  if (code === 0) return { label: 'Ciel dégagé', Icon: day ? Sun : Moon };
  if (code <= 2) return { label: 'Éclaircies', Icon: day ? CloudSun : CloudMoon };
  if (code === 3) return { label: 'Couvert', Icon: Cloud };
  if (code === 45 || code === 48) return { label: 'Brouillard', Icon: CloudFog };
  if (code >= 51 && code <= 57) return { label: 'Bruine', Icon: CloudDrizzle };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { label: 'Pluie', Icon: CloudRain };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { label: 'Neige', Icon: CloudSnow };
  if (code >= 95) return { label: 'Orage', Icon: CloudLightning };
  return { label: 'Variable', Icon: Cloud };
}

function forecastUrl(p: Place, unit: 'c' | 'f') {
  const u = new URL('https://api.open-meteo.com/v1/forecast');
  u.searchParams.set('latitude', p.lat.toFixed(3));
  u.searchParams.set('longitude', p.lon.toFixed(3));
  u.searchParams.set('current', 'temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m');
  u.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min');
  u.searchParams.set('timezone', 'auto');
  u.searchParams.set('forecast_days', '6');
  if (unit === 'f') u.searchParams.set('temperature_unit', 'fahrenheit');
  return u.toString();
}

export default function Weather({ config, setConfig, size }: WidgetProps<Config>) {
  const p = config.place;
  const key = p ? cacheKey('weather', p.lat.toFixed(2), p.lon.toFixed(2), config.unit) : null;
  const r = useRemote<Forecast>(key, () => fetchJson<Forecast>(forecastUrl(p!, config.unit)), 20 * 60_000);
  const loc = locale.value;

  if (!p) return <PlaceSearch onPick={(place) => setConfig({ place })} />;
  if (!r.data) return r.error ? <WidgetError message={r.error} onRetry={r.refresh} /> : <Skeleton />;

  const cur = r.data.current;
  const { label, Icon } = describe(cur.weather_code, cur.is_day === 1);
  const days = r.data.daily.time.slice(0, size === 's' ? 0 : size === 'm' ? 4 : 6);
  const t = (v: number) => `${Math.round(v)}°`;

  return (
    <div class={`w-weather size-${size}`}>
      <div class="w-weather-now">
        <Icon size={size === 's' ? 34 : 40} strokeWidth={1.5} class="w-weather-icon" aria-hidden />
        <div>
          <div class="w-weather-temp">{t(cur.temperature_2m)}</div>
          <div class="w-weather-label">{label}</div>
        </div>
      </div>
      <div class="w-weather-meta">
        <span>
          <MapPin size={11} /> {p.name}
        </span>
        <span>
          ↑{t(r.data.daily.temperature_2m_max[0])} ↓{t(r.data.daily.temperature_2m_min[0])}
        </span>
        {size !== 's' && <span>Ressenti {t(cur.apparent_temperature)}</span>}
      </div>
      {days.length > 0 && (
        <ul class="w-weather-days">
          {days.map((d, i) => {
            const D = describe(r.data!.daily.weather_code[i]).Icon;
            const name = i === 0 ? 'Auj.' : new Intl.DateTimeFormat(loc, { weekday: 'short' }).format(new Date(`${d}T12:00`));
            return (
              <li key={d}>
                <span class="muted">{name}</span>
                <D size={16} strokeWidth={1.6} aria-hidden />
                <span>{t(r.data!.daily.temperature_2m_max[i])}</span>
                <span class="muted">{t(r.data!.daily.temperature_2m_min[i])}</span>
              </li>
            );
          })}
        </ul>
      )}
      <div class="w-foot">
        {r.error && <WidgetError compact message={r.error} onRetry={r.refresh} />}
        <UpdatedAt at={r.updatedAt} loading={r.loading} onRefresh={r.refresh} />
      </div>
    </div>
  );
}

interface GeoResult {
  results?: { name: string; country?: string; admin1?: string; latitude: number; longitude: number }[];
}

function PlaceSearch({ onPick, compact }: { onPick: (p: Place) => void; compact?: boolean }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<(Place & { region?: string })[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const lang = locale.value.slice(0, 2);
        const data = await fetchJson<GeoResult>(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(term)}&count=5&language=${lang}&format=json`);
        setError(null);
        setResults((data.results ?? []).map((g) => ({ name: g.name, country: g.country ?? '', region: g.admin1, lat: g.latitude, lon: g.longitude })));
      } catch (e) {
        setError((e as Error).message);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div class={`w-place ${compact ? '' : 'is-inline'}`}>
      {!compact && <p class="w-message-title">Quelle ville ?</p>}
      <TextField value={q} onValue={setQ} placeholder="Paris, Lyon, Montréal…" aria-label="Rechercher une ville" onKeyDown={(e: KeyboardEvent) => e.stopPropagation()} />
      {error && <p class="field-error">{error}</p>}
      {results.length > 0 && (
        <ul class="pick-list">
          {results.map((r) => (
            <li key={`${r.lat},${r.lon}`}>
              <button type="button" onClick={() => onPick({ name: r.name, country: r.country, lat: r.lat, lon: r.lon })}>
                {r.name} <small class="muted">{[r.region, r.country].filter(Boolean).join(', ')}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Settings({ config, setConfig }: WidgetSettingsProps<Config>) {
  return (
    <>
      <div class="field-label">
        Ville {config.place && <strong>· {config.place.name}</strong>}
        <PlaceSearch compact onPick={(place) => setConfig({ place })} />
      </div>
      <Row label="Unité">
        <Segmented label="Unité" value={config.unit} options={[{ value: 'c', label: '°C' }, { value: 'f', label: '°F' }]} onChange={(unit) => setConfig({ unit })} />
      </Row>
    </>
  );
}

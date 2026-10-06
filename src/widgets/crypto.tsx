// API publique CoinGecko, sans clé.
import { useEffect, useState } from 'preact/hooks';
import { X } from 'lucide-preact';
import { fetchJson, useRemote } from '../lib/remote';
import { locale } from '../lib/locale';
import { Row, Select, TextField } from '../components/controls';
import { Change, Skeleton, Sparkline, UpdatedAt, WidgetError, formatNumber } from './kit';
import { cacheKey, type WidgetProps, type WidgetSettingsProps } from './types';

interface Config {
  coins: string[];
  currency: string;
}

interface Market {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  price_change_percentage_24h: number | null;
  sparkline_in_7d?: { price: number[] };
}

const CURRENCIES = [
  { value: 'eur', label: 'Euro (€)' },
  { value: 'usd', label: 'Dollar US ($)' },
  { value: 'cad', label: 'Dollar canadien' },
  { value: 'chf', label: 'Franc suisse' },
  { value: 'gbp', label: 'Livre sterling' },
];

function downsample(values: number[], n = 40): number[] {
  if (values.length <= n) return values;
  const step = values.length / n;
  return Array.from({ length: n }, (_, i) => values[Math.floor(i * step)]);
}

export default function Crypto({ config, size }: WidgetProps<Config>) {
  const ids = config.coins.join(',');
  const key = ids ? cacheKey('crypto', ids, config.currency) : null;
  const r = useRemote<Market[]>(
    key,
    () =>
      fetchJson<Market[]>(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=${encodeURIComponent(config.currency)}&ids=${encodeURIComponent(ids)}&sparkline=true&price_change_percentage=24h`,
      ),
    5 * 60_000,
  );
  const loc = locale.value;

  if (!r.data) return r.error ? <WidgetError message={r.error} onRetry={r.refresh} /> : <Skeleton />;
  const order = new Map(config.coins.map((c, i) => [c, i]));
  const rows = [...r.data].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  return (
    <div class="w-market">
      <ul class="w-market-list">
        {rows.map((m) => {
          const change = m.price_change_percentage_24h;
          return (
            <li key={m.id}>
              <span class="w-market-name">
                <strong>{m.symbol.toUpperCase()}</strong>
                {size !== 's' && <small>{m.name}</small>}
              </span>
              {size !== 's' && m.sparkline_in_7d && <Sparkline values={downsample(m.sparkline_in_7d.price)} positive={(change ?? 0) >= 0} />}
              <span class="w-market-price">
                {formatNumber(m.current_price, loc, { style: 'currency', currency: config.currency.toUpperCase(), maximumSignificantDigits: m.current_price < 1 ? 4 : 7 })}
                <Change value={change} />
              </span>
            </li>
          );
        })}
      </ul>
      <div class="w-foot">
        {r.error && <WidgetError compact message={r.error} onRetry={r.refresh} />}
        <UpdatedAt at={r.updatedAt} loading={r.loading} onRefresh={r.refresh} />
      </div>
    </div>
  );
}

interface SearchResult {
  coins: { id: string; name: string; symbol: string; market_cap_rank: number | null }[];
}

export function Settings({ config, setConfig }: WidgetSettingsProps<Config>) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResult['coins']>([]);
  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      fetchJson<SearchResult>(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q.trim())}`)
        .then((d) => setResults(d.coins.slice(0, 6)))
        .catch(() => setResults([]));
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <>
      <Row label="Devise">
        <Select label="Devise" value={config.currency} options={CURRENCIES} onChange={(currency) => setConfig({ currency })} />
      </Row>
      <ul class="list-editor">
        {config.coins.map((c) => (
          <li key={c}>
            <span>{c}</span>
            <button type="button" class="icon-btn" aria-label={`Retirer ${c}`} onClick={() => setConfig({ coins: config.coins.filter((x) => x !== c) })}>
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>
      <label class="field-label">
        Ajouter une crypto
        <TextField value={q} onValue={setQ} placeholder="Bitcoin, Cardano, DOGE…" />
      </label>
      {results.length > 0 && (
        <ul class="pick-list">
          {results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  if (!config.coins.includes(c.id)) setConfig({ coins: [...config.coins, c.id].slice(0, 12) });
                  setQ('');
                }}
              >
                {c.name} <small class="muted">{c.symbol}{c.market_cap_rank ? ` · #${c.market_cap_rank}` : ''}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p class="muted small">Données CoinGecko, actualisées toutes les 5 minutes au plus.</p>
    </>
  );
}

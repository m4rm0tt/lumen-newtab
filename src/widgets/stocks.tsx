// Finnhub avec la clé gratuite de l'utilisateur. La clé reste dans storage.local.
import { useState } from 'preact/hooks';
import { KeyRound, X } from 'lucide-preact';
import { fetchJson, useRemote } from '../lib/remote';
import { useLocal } from '../state/local';
import { locale } from '../lib/locale';
import { Button, TextField } from '../components/controls';
import { Change, Skeleton, UpdatedAt, WidgetError, WidgetMessage, formatNumber } from './kit';
import { cacheKey, secretKey, type WidgetProps, type WidgetSettingsProps } from './types';

interface Config {
  symbols: string[];
}

interface Quote {
  symbol: string;
  c: number;
  dp: number | null;
}

const KEY = secretKey('finnhub');

async function loadQuotes(symbols: string[], token: string): Promise<Quote[]> {
  const out = await Promise.all(
    symbols.map(async (symbol) => {
      const q = await fetchJson<{ c: number; dp: number | null }>(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(token)}`);
      return { symbol, c: q.c, dp: q.dp };
    }),
  );
  return out.filter((q) => q.c > 0);
}

export default function Stocks({ config, openSettings }: WidgetProps<Config>) {
  const [token] = useLocal<string>(KEY, '');
  const key = token && config.symbols.length ? cacheKey('stocks', config.symbols.join(',')) : null;
  const r = useRemote<Quote[]>(key, () => loadQuotes(config.symbols, token), 5 * 60_000);
  const loc = locale.value;

  if (!token) {
    return (
      <WidgetMessage
        icon={<KeyRound size={18} />}
        title="Clé Finnhub requise"
        action={
          <button type="button" class="btn btn-secondary is-small" onClick={openSettings}>
            Configurer
          </button>
        }
      >
        Gratuite, à créer sur finnhub.io.
      </WidgetMessage>
    );
  }
  if (!r.data) return r.error ? <WidgetError message={r.error} onRetry={r.refresh} /> : <Skeleton />;

  return (
    <div class="w-market">
      <ul class="w-market-list">
        {r.data.map((q) => (
          <li key={q.symbol}>
            <span class="w-market-name">
              <strong>{q.symbol}</strong>
            </span>
            <span class="w-market-price">
              {formatNumber(q.c, loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <Change value={q.dp} />
            </span>
          </li>
        ))}
        {r.data.length === 0 && <li class="muted">Aucun symbole reconnu.</li>}
      </ul>
      <div class="w-foot">
        {r.error && <WidgetError compact message={r.error} onRetry={r.refresh} />}
        <UpdatedAt at={r.updatedAt} loading={r.loading} onRefresh={r.refresh} />
      </div>
    </div>
  );
}

export function Settings({ config, setConfig }: WidgetSettingsProps<Config>) {
  const [token, setToken] = useLocal<string>(KEY, '');
  const [sym, setSym] = useState('');
  return (
    <>
      <label class="field-label">
        Clé d'API Finnhub
        <TextField value={token} onValue={(v) => setToken(v.trim())} type="password" placeholder="Collez votre clé" autoComplete="off" spellcheck={false} />
      </label>
      <p class="muted small">
        Créez une clé gratuite sur <a href="https://finnhub.io/register" target="_blank" rel="noopener noreferrer">finnhub.io</a>. Elle reste sur cet appareil :
        elle n'est ni synchronisée, ni exportée.
      </p>
      <ul class="list-editor">
        {config.symbols.map((s) => (
          <li key={s}>
            <span>{s}</span>
            <button type="button" class="icon-btn" aria-label={`Retirer ${s}`} onClick={() => setConfig({ symbols: config.symbols.filter((x) => x !== s) })}>
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>
      <form
        class="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          const s = sym.trim().toUpperCase();
          if (s && !config.symbols.includes(s)) setConfig({ symbols: [...config.symbols, s].slice(0, 12) });
          setSym('');
        }}
      >
        <TextField value={sym} onValue={setSym} placeholder="AAPL, MC.PA, VOO…" aria-label="Symbole" />
        <Button type="submit" small>
          Ajouter
        </Button>
      </form>
    </>
  );
}

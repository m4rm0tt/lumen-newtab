// Widget personnalisé sans code : texte, iframe sandboxée, ou valeurs lues dans une réponse
// JSON par chemin (« data.items[0].price »). Une définition se partage en JSON.
import { useState } from 'preact/hooks';
import { Plus, ShieldCheck, X } from 'lucide-preact';
import { fetchJson, useRemote } from '../lib/remote';
import { hasOrigin, requestOrigin } from '../lib/permissions';
import { normalizeUrl } from '../lib/url';
import { relativeTime } from '../lib/timing';
import { locale } from '../lib/locale';
import { isExtension } from '../storage/backend';
import { Button, Row, Segmented, Select, Slider, TextField } from '../components/controls';
import { Skeleton, UpdatedAt, WidgetError, WidgetMessage, formatNumber } from './kit';
import { cacheKey, type WidgetProps, type WidgetSettingsProps } from './types';
import { toast } from '../app/ui';

type Format = 'text' | 'number' | 'percent' | 'eur' | 'usd' | 'date';

interface Field {
  label: string;
  path: string;
  format: Format;
}

export interface CustomConfig {
  mode: 'text' | 'embed' | 'json';
  title: string;
  text: string;
  url: string;
  fields: Field[];
  refresh: number;
}

const FORMATS: { value: Format; label: string }[] = [
  { value: 'text', label: 'Texte' },
  { value: 'number', label: 'Nombre' },
  { value: 'percent', label: 'Pourcentage' },
  { value: 'eur', label: 'Euros' },
  { value: 'usd', label: 'Dollars' },
  { value: 'date', label: 'Date' },
];

/** Normalise une définition (config ou import) : seuls les champs connus, typés, bornés. */
export function normalizeCustom(raw: unknown): CustomConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const mode = r.mode === 'embed' || r.mode === 'json' ? r.mode : 'text';
  const url = typeof r.url === 'string' ? normalizeUrl(r.url) ?? '' : '';
  const fields = Array.isArray(r.fields)
    ? (r.fields as unknown[])
        .filter((f): f is Record<string, unknown> => !!f && typeof f === 'object')
        .map((f) => ({
          label: typeof f.label === 'string' ? f.label.slice(0, 40) : '',
          path: typeof f.path === 'string' ? f.path.slice(0, 200) : '',
          format: (FORMATS.some((x) => x.value === f.format) ? f.format : 'text') as Format,
        }))
        .slice(0, 8)
    : [];
  return {
    mode,
    title: typeof r.title === 'string' ? r.title.slice(0, 40) : 'Mon widget',
    text: typeof r.text === 'string' ? r.text.slice(0, 2000) : '',
    url: /^https?:/.test(url) ? url : '',
    fields,
    refresh: typeof r.refresh === 'number' && Number.isFinite(r.refresh) ? Math.min(1440, Math.max(1, r.refresh)) : 15,
  };
}

const FORBIDDEN = new Set(['__proto__', 'prototype', 'constructor']);

/** Lit « a.b[0].c » dans un objet JSON. Aucune évaluation de code. */
export function getPath(obj: unknown, path: string): unknown {
  const parts = path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .map((p) => p.trim())
    .filter(Boolean);
  let cur: unknown = obj;
  for (const p of parts) {
    if (FORBIDDEN.has(p) || cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

export function formatValue(v: unknown, f: Format, loc: string): string {
  if (v === undefined || v === null) return '—';
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 80);
  const n = typeof v === 'number' ? v : Number(v);
  switch (f) {
    case 'number':
      return Number.isFinite(n) ? formatNumber(n, loc, { maximumFractionDigits: 2 }) : String(v);
    case 'percent':
      return Number.isFinite(n) ? `${formatNumber(n, loc, { maximumFractionDigits: 2 })} %` : String(v);
    case 'eur':
    case 'usd':
      return Number.isFinite(n) ? formatNumber(n, loc, { style: 'currency', currency: f.toUpperCase() }) : String(v);
    case 'date': {
      const t = typeof v === 'number' ? (v < 1e12 ? v * 1000 : v) : Date.parse(String(v));
      return Number.isFinite(t) ? relativeTime(t, loc) : String(v);
    }
    default:
      return String(v).slice(0, 200);
  }
}

export default function Custom({ config: raw, openSettings }: WidgetProps<CustomConfig>) {
  const config = normalizeCustom(raw);
  if (config.mode === 'text') {
    if (!config.text.trim()) return <WidgetMessage title="Widget vide" action={<button type="button" class="btn btn-secondary is-small" onClick={openSettings}>Configurer</button>} />;
    return <p class="w-quote">{config.text}</p>;
  }
  if (!config.url) return <WidgetMessage title="Adresse manquante" action={<button type="button" class="btn btn-secondary is-small" onClick={openSettings}>Configurer</button>} />;
  if (config.mode === 'embed') {
    return (
      <iframe
        class="w-embed"
        src={config.url}
        title={config.title}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        referrerpolicy="no-referrer"
        loading="lazy"
      />
    );
  }
  return <JsonView config={config} />;
}

function JsonView({ config }: { config: CustomConfig }) {
  const key = cacheKey('custom', config.url, config.fields.map((f) => f.path).join(','));
  const r = useRemote<unknown>(key, () => fetchJson<unknown>(config.url), config.refresh * 60_000);
  const loc = locale.value;
  if (!r.data) {
    if (!r.error) return <Skeleton />;
    return (
      <div class="stack">
        <WidgetError message={r.error} onRetry={r.refresh} />
        {isExtension && (
          <Button small onClick={async () => (await requestOrigin(config.url)) && r.refresh()}>
            <ShieldCheck size={13} /> Autoriser ce domaine
          </Button>
        )}
      </div>
    );
  }
  return (
    <div class="w-json">
      <dl class="w-json-grid">
        {config.fields.map((f, i) => (
          <div key={i} class="w-json-stat">
            <dt>{f.label || f.path}</dt>
            <dd>{formatValue(getPath(r.data, f.path), f.format, loc)}</dd>
          </div>
        ))}
      </dl>
      <div class="w-foot">
        {r.error && <WidgetError compact message={r.error} onRetry={r.refresh} />}
        <UpdatedAt at={r.updatedAt} loading={r.loading} onRefresh={r.refresh} />
      </div>
    </div>
  );
}

export function Settings({ config: raw, setConfig }: WidgetSettingsProps<CustomConfig>) {
  const config = normalizeCustom(raw);
  const [preview, setPreview] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const setFields = (fields: Field[]) => setConfig({ fields });

  async function test() {
    if (!config.url) return;
    if (isExtension && !(await hasOrigin(config.url))) await requestOrigin(config.url);
    try {
      const data = await fetchJson<unknown>(config.url);
      setPreview(JSON.stringify(data, null, 2).slice(0, 1500));
    } catch (e) {
      setPreview(`Erreur : ${(e as Error).message}`);
    }
  }

  function share() {
    const def = { lumenWidget: 1, ...config };
    navigator.clipboard.writeText(JSON.stringify(def, null, 2)).then(
      () => toast('Définition copiée'),
      () => toast('Copie impossible', { tone: 'error' }),
    );
  }

  function applyImport() {
    try {
      const parsed = JSON.parse(importText) as Record<string, unknown>;
      if (parsed.lumenWidget !== 1) throw new Error();
      setConfig(normalizeCustom(parsed));
      setShowImport(false);
      setImportText('');
      toast('Définition importée');
    } catch {
      toast('Définition invalide.', { tone: 'error' });
    }
  }

  return (
    <>
      <Row label="Type">
        <Segmented
          label="Type"
          value={config.mode}
          options={[
            { value: 'text', label: 'Texte' },
            { value: 'embed', label: 'Page' },
            { value: 'json', label: 'Données JSON' },
          ]}
          onChange={(mode) => setConfig({ mode })}
        />
      </Row>
      <label class="field-label">
        Titre
        <TextField value={config.title} onValue={(v) => setConfig({ title: v })} maxLength={40} />
      </label>
      {config.mode === 'text' ? (
        <label class="field-label">
          Texte
          <textarea class="field" rows={4} value={config.text} maxLength={2000} onInput={(e) => setConfig({ text: (e.currentTarget as HTMLTextAreaElement).value })} />
        </label>
      ) : (
        <label class="field-label">
          Adresse
          <TextField value={raw.url} onValue={(v) => setConfig({ url: v })} placeholder="https://…" spellcheck={false} />
        </label>
      )}
      {config.mode === 'embed' && (
        <p class="muted small">La page s'affiche dans un cadre isolé. Beaucoup de sites (Google, banques…) interdisent l'intégration : ils resteront vides.</p>
      )}
      {config.mode === 'json' && (
        <>
          <ul class="list-editor is-fields">
            {config.fields.map((f, i) => (
              <li key={i}>
                <input class="field is-quiet" placeholder="Libellé" value={f.label} aria-label="Libellé" onInput={(e) => setFields(config.fields.map((x, j) => (j === i ? { ...x, label: (e.currentTarget as HTMLInputElement).value } : x)))} />
                <input class="field is-quiet" placeholder="chemin.vers[0].valeur" value={f.path} aria-label="Chemin" spellcheck={false} onInput={(e) => setFields(config.fields.map((x, j) => (j === i ? { ...x, path: (e.currentTarget as HTMLInputElement).value } : x)))} />
                <Select label="Format" value={f.format} options={FORMATS} onChange={(format) => setFields(config.fields.map((x, j) => (j === i ? { ...x, format } : x)))} />
                <button type="button" class="icon-btn" aria-label="Retirer" onClick={() => setFields(config.fields.filter((_, j) => j !== i))}>
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
          <div class="inline-form">
            <Button small onClick={() => setFields([...config.fields, { label: '', path: '', format: 'text' }])} disabled={config.fields.length >= 8}>
              <Plus size={14} /> Ajouter une valeur
            </Button>
            <Button small variant="ghost" onClick={test} disabled={!config.url}>
              Tester l'adresse
            </Button>
          </div>
          {preview && <pre class="json-preview">{preview}</pre>}
          <Row label="Actualisation">
            <Slider label="Actualisation" value={config.refresh} min={1} max={240} onChange={(refresh) => setConfig({ refresh })} format={(v) => `${v} min`} />
          </Row>
        </>
      )}
      <div class="inline-form">
        <Button small variant="ghost" onClick={share}>
          Copier la définition
        </Button>
        <Button small variant="ghost" onClick={() => setShowImport((v) => !v)}>
          Coller une définition…
        </Button>
      </div>
      {showImport && (
        <div class="stack">
          <textarea class="field" rows={5} placeholder='{"lumenWidget": 1, "mode": "json", …}' value={importText} onInput={(e) => setImportText((e.currentTarget as HTMLTextAreaElement).value)} />
          <Button small variant="primary" onClick={applyImport} disabled={!importText.trim()}>
            Importer
          </Button>
        </div>
      )}
    </>
  );
}

// Beaucoup de flux n'envoient pas d'en-têtes CORS : on demande alors l'accès à leur seul
// domaine. Le contenu est affiché en texte brut.
import { useState } from 'preact/hooks';
import { Plus, ShieldCheck, X } from 'lucide-preact';
import { fetchText, useRemote } from '../lib/remote';
import { hasOrigin, requestOrigin } from '../lib/permissions';
import { hostnameOf, normalizeUrl } from '../lib/url';
import { relativeTime } from '../lib/timing';
import { locale } from '../lib/locale';
import { Button, Row, Slider, TextField } from '../components/controls';
import { Skeleton, UpdatedAt, WidgetError, WidgetMessage } from './kit';
import { cacheKey, type WidgetProps, type WidgetSettingsProps } from './types';
import { isExtension } from '../storage/backend';

interface Config {
  title: string;
  feeds: string[];
  max: number;
}

export interface FeedItem {
  title: string;
  link: string;
  date: number;
  source: string;
}

const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

function safeLink(href: string, base: string): string {
  try {
    const u = new URL(href, base);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : '';
  } catch {
    return '';
  }
}

/** Analyse un flux RSS 2.0, RSS 1.0 (RDF) ou Atom. */
export function parseFeed(xml: string, feedUrl: string): FeedItem[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  if (doc.querySelector('parsererror')) throw new Error("Ce n'est pas un flux RSS ou Atom valide.");
  const channelTitle = text(doc.querySelector('channel > title, feed > title')) || hostnameOf(feedUrl);
  const items: FeedItem[] = [];
  for (const it of Array.from(doc.querySelectorAll('item'))) {
    const link = safeLink(text(it.querySelector('link')) || it.querySelector('guid')?.textContent || '', feedUrl);
    const date = Date.parse(text(it.querySelector('pubDate')) || text(it.getElementsByTagName('dc:date')[0]) || '');
    const title = text(it.querySelector('title'));
    if (title && link) items.push({ title, link, date: Number.isFinite(date) ? date : 0, source: channelTitle });
  }
  for (const en of Array.from(doc.querySelectorAll('entry'))) {
    const linkEl = en.querySelector('link[rel="alternate"]') ?? en.querySelector('link');
    const link = safeLink(linkEl?.getAttribute('href') ?? '', feedUrl);
    const date = Date.parse(text(en.querySelector('published')) || text(en.querySelector('updated')));
    const title = text(en.querySelector('title'));
    if (title && link) items.push({ title, link, date: Number.isFinite(date) ? date : 0, source: channelTitle });
  }
  return items;
}

async function loadFeeds(feeds: string[], max: number): Promise<{ items: FeedItem[]; failed: string[] }> {
  const settled = await Promise.allSettled(feeds.map(async (f) => parseFeed(await fetchText(f), f)));
  const items: FeedItem[] = [];
  const failed: string[] = [];
  settled.forEach((r, i) => (r.status === 'fulfilled' ? items.push(...r.value) : failed.push(feeds[i])));
  if (!items.length && failed.length) throw new Error(failed.length === 1 ? `Flux injoignable : ${hostnameOf(failed[0])}` : 'Aucun flux n’a pu être chargé.');
  const seen = new Set<string>();
  return {
    items: items
      .filter((i) => !seen.has(i.link) && seen.add(i.link))
      .sort((a, b) => b.date - a.date)
      .slice(0, max),
    failed,
  };
}

export default function Rss({ config, openSettings }: WidgetProps<Config>) {
  const key = config.feeds.length ? cacheKey('rss', config.feeds.join('|'), config.max) : null;
  const r = useRemote(key, () => loadFeeds(config.feeds, config.max), 30 * 60_000);
  const [granting, setGranting] = useState(false);
  const loc = locale.value;

  if (!config.feeds.length) {
    return (
      <WidgetMessage
        title="Aucun flux"
        action={
          <button type="button" class="btn btn-secondary is-small" onClick={openSettings}>
            Ajouter un flux
          </button>
        }
      >
        Ajoutez l'adresse d'un flux RSS ou Atom.
      </WidgetMessage>
    );
  }
  if (!r.data) {
    if (r.error) {
      return (
        <div class="stack">
          <WidgetError message={r.error} onRetry={r.refresh} />
          {isExtension && (
            <Button
              small
              disabled={granting}
              onClick={async () => {
                setGranting(true);
                for (const f of config.feeds) if (!(await hasOrigin(f))) await requestOrigin(f);
                setGranting(false);
                r.refresh();
              }}
            >
              <ShieldCheck size={13} /> Autoriser l'accès aux flux
            </Button>
          )}
        </div>
      );
    }
    return <Skeleton lines={5} />;
  }

  return (
    <div class="w-rss">
      <ul class="w-rss-list">
        {r.data.items.map((it) => (
          <li key={it.link}>
            <a href={it.link} target="_blank" rel="noopener noreferrer">
              <span class="w-rss-title">{it.title}</span>
              <span class="w-rss-meta">
                {config.feeds.length > 1 && <>{it.source} · </>}
                {it.date ? relativeTime(it.date, loc) : ''}
              </span>
            </a>
          </li>
        ))}
      </ul>
      <div class="w-foot">
        {(r.error || r.data.failed.length > 0) && <WidgetError compact message={r.error ?? `${r.data.failed.length} flux injoignable(s).`} onRetry={r.refresh} />}
        <UpdatedAt at={r.updatedAt} loading={r.loading} onRefresh={r.refresh} />
      </div>
    </div>
  );
}

export function Settings({ config, setConfig }: WidgetSettingsProps<Config>) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function add(e: Event) {
    e.preventDefault();
    const u = normalizeUrl(url);
    if (!u || !/^https?:/.test(u)) {
      setError('Adresse invalide.');
      return;
    }
    if (config.feeds.includes(u)) return;
    setError(null);
    // Demande l'accès au domaine maintenant (geste utilisateur) ; refus = on tentera sans.
    if (isExtension && !(await hasOrigin(u))) await requestOrigin(u);
    setConfig({ feeds: [...config.feeds, u].slice(0, 10) });
    setUrl('');
  }

  return (
    <>
      <label class="field-label">
        Titre
        <TextField value={config.title} onValue={(v) => setConfig({ title: v })} maxLength={40} />
      </label>
      <ul class="list-editor">
        {config.feeds.map((f) => (
          <li key={f}>
            <span class="truncate">{f}</span>
            <button type="button" class="icon-btn" aria-label={`Retirer ${f}`} onClick={() => setConfig({ feeds: config.feeds.filter((x) => x !== f) })}>
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>
      <form class="inline-form" onSubmit={add}>
        <TextField value={url} onValue={setUrl} placeholder="https://exemple.com/feed.xml" aria-label="Adresse du flux" />
        <Button type="submit" small>
          <Plus size={14} /> Ajouter
        </Button>
      </form>
      {error && <p class="field-error">{error}</p>}
      <Row label="Articles affichés">
        <Slider label="Articles affichés" value={config.max} min={3} max={30} onChange={(v) => setConfig({ max: v })} />
      </Row>
      <p class="muted small">
        Si un flux bloque les requêtes d'extensions, Chrome vous demandera l'autorisation d'accéder à ce seul domaine.
      </p>
    </>
  );
}

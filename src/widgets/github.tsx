// Sans jeton : profil et dépôts publics. Avec un jeton en lecture seule : contributions
// (GraphQL), revues demandées et PR ouvertes. Pas d'OAuth, il faudrait un client secret.
import { useState } from 'preact/hooks';
import { GitPullRequest, Star, Users } from 'lucide-preact';
import { fetchJson, useRemote } from '../lib/remote';
import { useLocal } from '../state/local';
import { relativeTime } from '../lib/timing';
import { locale } from '../lib/locale';
import { TextField } from '../components/controls';
import { Skeleton, UpdatedAt, WidgetError, WidgetMessage, formatNumber } from './kit';
import { cacheKey, secretKey, type WidgetProps, type WidgetSettingsProps } from './types';

interface Config {
  username: string;
}

interface GhData {
  profile: { login: string; name: string | null; avatar_url: string; public_repos: number; followers: number; html_url: string };
  repos: { name: string; html_url: string; stargazers_count: number; language: string | null; pushed_at: string }[];
  calendar?: { total: number; weeks: number[][] };
  reviews?: number;
  openPrs?: number;
}

const TOKEN = secretKey('github');

async function load(username: string, token: string): Promise<GhData> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const base = 'https://api.github.com';
  const [profile, repos] = await Promise.all([
    fetchJson<GhData['profile']>(`${base}/users/${encodeURIComponent(username)}`, { headers }),
    fetchJson<GhData['repos']>(`${base}/users/${encodeURIComponent(username)}/repos?sort=pushed&per_page=6&type=owner`, { headers }),
  ]);
  const data: GhData = { profile, repos };
  if (token) {
    const q = `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{contributionCount}}}}}}`;
    const [cal, reviews, prs] = await Promise.allSettled([
      fetchJson<{ data?: { user?: { contributionsCollection: { contributionCalendar: { totalContributions: number; weeks: { contributionDays: { contributionCount: number }[] }[] } } } } }>(
        `${base}/graphql`,
        { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q, variables: { login: username } }) },
      ),
      fetchJson<{ total_count: number }>(`${base}/search/issues?q=${encodeURIComponent(`is:open is:pr review-requested:${username}`)}&per_page=1`, { headers }),
      fetchJson<{ total_count: number }>(`${base}/search/issues?q=${encodeURIComponent(`is:open is:pr author:${username}`)}&per_page=1`, { headers }),
    ]);
    if (cal.status === 'fulfilled' && cal.value.data?.user) {
      const c = cal.value.data.user.contributionsCollection.contributionCalendar;
      data.calendar = { total: c.totalContributions, weeks: c.weeks.map((w) => w.contributionDays.map((d) => d.contributionCount)) };
    }
    if (reviews.status === 'fulfilled') data.reviews = reviews.value.total_count;
    if (prs.status === 'fulfilled') data.openPrs = prs.value.total_count;
  }
  return data;
}

/** Niveaux 0..4 par quantiles, comme le calendrier de GitHub. */
export function levels(weeks: number[][]): number[][] {
  const nonZero = weeks.flat().filter((n) => n > 0).sort((a, b) => a - b);
  const q = (p: number) => nonZero[Math.min(nonZero.length - 1, Math.floor(p * nonZero.length))] ?? 1;
  const t = [q(0.25), q(0.5), q(0.75)];
  return weeks.map((w) => w.map((n) => (n === 0 ? 0 : n <= t[0] ? 1 : n <= t[1] ? 2 : n <= t[2] ? 3 : 4)));
}

function Heatmap({ weeks, count }: { weeks: number[][]; count: number }) {
  const shown = levels(weeks.slice(-count));
  return (
    <div class="w-gh-heat" style={{ gridTemplateColumns: `repeat(${shown.length}, 1fr)` }} aria-hidden="true">
      {shown.map((w, i) => (
        <div key={i} class="w-gh-week">
          {w.map((l, j) => (
            <span key={j} class={`lvl-${l}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function GitHub({ config, size, openSettings }: WidgetProps<Config>) {
  const [token] = useLocal<string>(TOKEN, '');
  const key = config.username ? cacheKey('github', config.username, token ? 'auth' : 'anon') : null;
  const r = useRemote(key, () => load(config.username, token), 15 * 60_000);
  const loc = locale.value;

  if (!config.username) {
    return (
      <WidgetMessage
        title="Quel compte GitHub ?"
        action={
          <button type="button" class="btn btn-secondary is-small" onClick={openSettings}>
            Configurer
          </button>
        }
      />
    );
  }
  if (!r.data) return r.error ? <WidgetError message={r.error} onRetry={r.refresh} /> : <Skeleton />;
  const d = r.data;
  const weeksShown = size === 's' ? 12 : size === 'm' ? 26 : 40;

  return (
    <div class={`w-gh size-${size}`}>
      <a class="w-gh-profile" href={d.profile.html_url} target="_blank" rel="noopener noreferrer">
        <img src={d.profile.avatar_url} alt="" width={32} height={32} referrerpolicy="no-referrer" />
        <span>
          <strong>{d.profile.name || d.profile.login}</strong>
          <small>
            <Users size={11} /> {formatNumber(d.profile.followers, loc)} · {d.profile.public_repos} dépôts
          </small>
        </span>
      </a>
      {d.calendar && (
        <div class="w-gh-cal">
          <Heatmap weeks={d.calendar.weeks} count={weeksShown} />
          <small class="muted">{formatNumber(d.calendar.total, loc)} contributions sur un an</small>
        </div>
      )}
      {(d.reviews !== undefined || d.openPrs !== undefined) && (
        <div class="w-gh-stats">
          {d.reviews !== undefined && (
            <a href="https://github.com/pulls/review-requested" target="_blank" rel="noopener noreferrer" class={d.reviews > 0 ? 'is-hot' : ''}>
              <GitPullRequest size={13} /> {d.reviews} revue{d.reviews > 1 ? 's' : ''} demandée{d.reviews > 1 ? 's' : ''}
            </a>
          )}
          {d.openPrs !== undefined && (
            <a href="https://github.com/pulls" target="_blank" rel="noopener noreferrer">
              {d.openPrs} PR ouverte{d.openPrs > 1 ? 's' : ''}
            </a>
          )}
        </div>
      )}
      {(size === 'l' || (!d.calendar && size !== 's')) && (
        <ul class="w-gh-repos">
          {d.repos.slice(0, size === 'l' ? 6 : 4).map((repo) => (
            <li key={repo.name}>
              <a href={repo.html_url} target="_blank" rel="noopener noreferrer">
                <span class="truncate">{repo.name}</span>
                <small class="muted">
                  {repo.language ? `${repo.language} · ` : ''}
                  {relativeTime(Date.parse(repo.pushed_at), loc)}
                </small>
                {repo.stargazers_count > 0 && (
                  <small class="w-gh-stars">
                    <Star size={11} /> {formatNumber(repo.stargazers_count, loc, { notation: 'compact' })}
                  </small>
                )}
              </a>
            </li>
          ))}
        </ul>
      )}
      <div class="w-foot">
        {r.error && <WidgetError compact message={r.error} onRetry={r.refresh} />}
        <UpdatedAt at={r.updatedAt} loading={r.loading} onRefresh={r.refresh} />
      </div>
    </div>
  );
}

export function Settings({ config, setConfig }: WidgetSettingsProps<Config>) {
  const [token, setToken] = useLocal<string>(TOKEN, '');
  const [show, setShow] = useState(!!token);
  return (
    <>
      <label class="field-label">
        Nom d'utilisateur GitHub
        <TextField value={config.username} onValue={(v) => setConfig({ username: v.trim() })} placeholder="octocat" spellcheck={false} autoComplete="off" />
      </label>
      {!show ? (
        <button type="button" class="link-btn" onClick={() => setShow(true)}>
          Ajouter un jeton pour les contributions et les revues…
        </button>
      ) : (
        <>
          <label class="field-label">
            Jeton personnel (facultatif)
            <TextField value={token} onValue={(v) => setToken(v.trim())} type="password" placeholder="github_pat_…" autoComplete="off" spellcheck={false} />
          </label>
          <p class="muted small">
            Créez un <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer">jeton à granularité fine</a> en
            lecture seule, sans aucune permission de dépôt. Il reste sur cet appareil : ni synchronisé, ni exporté.
          </p>
        </>
      )}
    </>
  );
}

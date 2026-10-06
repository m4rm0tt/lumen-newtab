// OAuth PKCE via chrome.identity, sans client secret. Chaque utilisateur déclare sa propre
// appli Spotify et colle son Client ID.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Copy, Music, Pause, Play, SkipBack, SkipForward } from 'lucide-preact';
import { useLocal, writeLocal, readLocal } from '../state/local';
import { requestPermission } from '../lib/permissions';
import { isExtension } from '../storage/backend';
import { Button, TextField } from '../components/controls';
import { WidgetMessage } from './kit';
import { secretKey, type WidgetProps, type WidgetSettingsProps } from './types';
import { toast } from '../app/ui';

interface Config {
  clientId: string;
}

interface Tokens {
  access: string;
  refresh: string;
  expiresAt: number;
  clientId: string;
}

interface Playing {
  is_playing: boolean;
  progress_ms: number | null;
  item: {
    name: string;
    duration_ms: number;
    external_urls?: { spotify?: string };
    artists?: { name: string }[];
    album?: { images: { url: string; width: number }[] };
    show?: { name: string; images: { url: string }[] };
    images?: { url: string }[];
  } | null;
}

const KEY = secretKey('spotify');
const SCOPES = 'user-read-currently-playing user-read-playback-state user-modify-playback-state';

export function redirectUri(): string {
  return isExtension ? `https://${chrome.runtime.id}.chromiumapp.org/spotify` : 'https://<id-extension>.chromiumapp.org/spotify';
}

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function pkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  return { verifier, challenge };
}

async function tokenRequest(body: Record<string, string>): Promise<Tokens> {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
    credentials: 'omit',
  });
  if (!res.ok) throw new Error('Spotify a refusé la connexion.');
  const j = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
  return { access: j.access_token, refresh: j.refresh_token ?? body.refresh_token ?? '', expiresAt: Date.now() + j.expires_in * 1000, clientId: body.client_id };
}

async function connect(clientId: string): Promise<Tokens> {
  if (!(await requestPermission('identity'))) throw new Error('Permission refusée.');
  const { verifier, challenge } = await pkcePair();
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const auth = new URL('https://accounts.spotify.com/authorize');
  auth.search = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: SCOPES,
    redirect_uri: redirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
  }).toString();
  const result = await chrome.identity.launchWebAuthFlow({ url: auth.toString(), interactive: true });
  if (!result) throw new Error('Connexion annulée.');
  const params = new URL(result).searchParams;
  if (params.get('state') !== state) throw new Error('Réponse inattendue de Spotify.');
  const code = params.get('code');
  if (!code) throw new Error(params.get('error') === 'access_denied' ? 'Accès refusé.' : 'Connexion échouée.');
  const tokens = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri(), client_id: clientId, code_verifier: verifier });
  await writeLocal(KEY, tokens);
  return tokens;
}

let refreshing: Promise<Tokens | null> | null = null;

async function accessToken(): Promise<string | null> {
  const t = await readLocal<Tokens | null>(KEY, null);
  if (!t) return null;
  if (Date.now() < t.expiresAt - 60_000) return t.access;
  refreshing ??= tokenRequest({ grant_type: 'refresh_token', refresh_token: t.refresh, client_id: t.clientId })
    .then(async (n) => {
      await writeLocal(KEY, n);
      return n;
    })
    .catch(async () => {
      await writeLocal(KEY, null);
      return null;
    })
    .finally(() => (refreshing = null));
  return (await refreshing)?.access ?? null;
}

async function api(path: string, method = 'GET'): Promise<Response> {
  const token = await accessToken();
  if (!token) throw new Error('Session expirée, reconnectez-vous.');
  return fetch(`https://api.spotify.com/v1${path}`, { method, headers: { Authorization: `Bearer ${token}` }, credentials: 'omit' });
}

export default function Spotify({ config, size, openSettings }: WidgetProps<Config>) {
  const [tokens] = useLocal<Tokens | null>(KEY, null);
  const [playing, setPlaying] = useState<Playing | null>(null);
  const [fetchedAt, setFetchedAt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [, tick] = useState(0);
  const pollRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (!tokens) return;
    let alive = true;
    const poll = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await api('/me/player/currently-playing?additional_types=episode');
        if (!alive) return;
        if (res.status === 204) setPlaying(null);
        else if (res.ok) setPlaying((await res.json()) as Playing);
        else if (res.status === 401) throw new Error('Session expirée, reconnectez-vous.');
        else throw new Error('Spotify ne répond pas.');
        setFetchedAt(Date.now());
        setError(null);
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    };
    pollRef.current = poll;
    void poll();
    const i = setInterval(poll, 10_000);
    const t = setInterval(() => tick((n) => n + 1), 1000);
    document.addEventListener('visibilitychange', poll);
    return () => {
      alive = false;
      clearInterval(i);
      clearInterval(t);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [tokens?.access, tokens?.refresh]);

  async function control(path: string, method: string) {
    try {
      const res = await api(path, method);
      if (res.status === 403) toast('Le contrôle de la lecture nécessite Spotify Premium.', { tone: 'error' });
      else if (res.status === 404) toast('Aucun appareil Spotify actif.', { tone: 'error' });
      setTimeout(() => pollRef.current(), 400);
    } catch (e) {
      toast((e as Error).message, { tone: 'error' });
    }
  }

  if (!config.clientId || !tokens) {
    return (
      <WidgetMessage
        icon={<Music size={18} />}
        title="Connecter Spotify"
        action={
          <button type="button" class="btn btn-secondary is-small" onClick={openSettings}>
            Configurer
          </button>
        }
      >
        Nécessite une application Spotify gratuite (2 minutes).
      </WidgetMessage>
    );
  }

  const item = playing?.item;
  if (!item) {
    return <WidgetMessage icon={<Music size={18} />} title={error ?? 'Rien en lecture'}>{!error && 'Lancez un titre sur l’un de vos appareils.'}</WidgetMessage>;
  }

  const art = item.album?.images ?? item.images ?? item.show?.images ?? [];
  const cover = [...art].sort((a, b) => ((a as { width?: number }).width ?? 0) - ((b as { width?: number }).width ?? 0)).find((i) => ((i as { width?: number }).width ?? 300) >= 120) ?? art[0];
  const artist = item.artists?.map((a) => a.name).join(', ') ?? item.show?.name ?? '';
  const progress = Math.min(item.duration_ms, (playing!.progress_ms ?? 0) + (playing!.is_playing ? Date.now() - fetchedAt : 0));

  return (
    <div class={`w-spotify size-${size}`}>
      {cover && <img class="w-spotify-cover" src={cover.url} alt="" referrerpolicy="no-referrer" />}
      <div class="w-spotify-info">
        <a class="w-spotify-title truncate" href={item.external_urls?.spotify} target="_blank" rel="noopener noreferrer">
          {item.name}
        </a>
        <span class="w-spotify-artist truncate">{artist}</span>
        <div class="w-progress" role="progressbar" aria-valuemin={0} aria-valuemax={item.duration_ms} aria-valuenow={progress}>
          <span style={{ width: `${(progress / item.duration_ms) * 100}%` }} />
        </div>
        <div class="w-spotify-controls">
          <button type="button" class="icon-btn" aria-label="Précédent" onClick={() => control('/me/player/previous', 'POST')}>
            <SkipBack size={16} />
          </button>
          <button type="button" class="round-btn is-primary" aria-label={playing!.is_playing ? 'Pause' : 'Lecture'} onClick={() => control(playing!.is_playing ? '/me/player/pause' : '/me/player/play', 'PUT')}>
            {playing!.is_playing ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <button type="button" class="icon-btn" aria-label="Suivant" onClick={() => control('/me/player/next', 'POST')}>
            <SkipForward size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Settings({ config, setConfig }: WidgetSettingsProps<Config>) {
  const [tokens, setTokens] = useLocal<Tokens | null>(KEY, null);
  const [busy, setBusy] = useState(false);
  const uri = redirectUri();
  return (
    <>
      <ol class="steps">
        <li>
          Créez une application sur <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener noreferrer">developer.spotify.com</a> (API : « Web API »).
        </li>
        <li>
          Ajoutez cette URI de redirection :
          <span class="copy-line">
            <code>{uri}</code>
            <button type="button" class="icon-btn" aria-label="Copier l'URI" onClick={() => navigator.clipboard.writeText(uri).then(() => toast('URI copiée'))}>
              <Copy size={13} />
            </button>
          </span>
        </li>
        <li>Collez le Client ID ci-dessous, puis connectez-vous.</li>
      </ol>
      <label class="field-label">
        Client ID
        <TextField value={config.clientId} onValue={(v) => setConfig({ clientId: v.trim() })} spellcheck={false} autoComplete="off" placeholder="32 caractères" />
      </label>
      {tokens ? (
        <Button variant="secondary" onClick={() => setTokens(null)}>
          Se déconnecter de Spotify
        </Button>
      ) : (
        <Button
          variant="primary"
          disabled={!config.clientId || busy || !isExtension}
          onClick={async () => {
            setBusy(true);
            try {
              setTokens(await connect(config.clientId));
              toast('Spotify connecté');
            } catch (e) {
              toast((e as Error).message, { tone: 'error' });
            } finally {
              setBusy(false);
            }
          }}
        >
          Se connecter à Spotify
        </Button>
      )}
      <p class="muted small">
        Aucun client secret n'est utilisé (PKCE). Les jetons restent sur cet appareil. En mode développement, Spotify limite une application à 25
        utilisateurs que vous ajoutez vous-même dans son tableau de bord. Le contrôle de la lecture nécessite un compte Premium.
      </p>
    </>
  );
}

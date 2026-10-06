const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;
const ALLOWED_SCHEMES = new Set(['http:', 'https:', 'ftp:', 'file:', 'chrome:', 'chrome-extension:', 'edge:', 'about:', 'mailto:']);

/**
 * Transforme une saisie utilisateur en URL navigable, ou null si ce n'est pas une URL.
 * « github.com » donne « https://github.com/ ». Refuse javascript: et data:.
 */
export function normalizeUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw || /\s/.test(raw)) return null;
  const withScheme = SCHEME_RE.test(raw) && !/^[^/]+:\d+/.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme);
    if (!ALLOWED_SCHEMES.has(u.protocol)) return null;
    if ((u.protocol === 'http:' || u.protocol === 'https:') && !isPlausibleHost(u.hostname)) return null;
    return u.href;
  } catch {
    return null;
  }
}

function isPlausibleHost(host: string): boolean {
  if (host === 'localhost') return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  if (host.startsWith('[')) return true; // IPv6
  // Il faut au moins un point et un TLD alphabétique (ou punycode).
  return /^([a-z0-9-]+\.)+([a-z]{2,63}|xn--[a-z0-9-]+)$/i.test(host);
}

/** La saisie de la barre de recherche ressemble-t-elle à une adresse plutôt qu'à une requête ? */
export function looksLikeUrl(input: string): boolean {
  const raw = input.trim();
  if (!raw || /\s/.test(raw)) return false;
  if (/^(https?|ftp|file|chrome|about):/i.test(raw)) return true;
  if (/^localhost(:\d+)?(\/|$)/i.test(raw)) return true;
  return normalizeUrl(raw) !== null && /\.[a-z]{2,}(?::\d+)?(\/|$|\?|#)/i.test(raw);
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function originPattern(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return `${u.protocol}//${u.hostname}/*`;
  } catch {
    return null;
  }
}

/** Quelques noms de marque dont la casse ne se devine pas depuis le domaine. */
const KNOWN_NAMES: Record<string, string> = {
  'youtube.com': 'YouTube',
  'github.com': 'GitHub',
  'gitlab.com': 'GitLab',
  'linkedin.com': 'LinkedIn',
  'mail.google.com': 'Gmail',
  'gmail.com': 'Gmail',
  'calendar.google.com': 'Agenda',
  'drive.google.com': 'Drive',
  'docs.google.com': 'Docs',
  'maps.google.com': 'Maps',
  'google.com': 'Google',
  'wikipedia.org': 'Wikipédia',
  'fr.wikipedia.org': 'Wikipédia',
  'en.wikipedia.org': 'Wikipedia',
  'reddit.com': 'Reddit',
  'x.com': 'X',
  'twitter.com': 'Twitter',
  'twitch.tv': 'Twitch',
  'netflix.com': 'Netflix',
  'open.spotify.com': 'Spotify',
  'spotify.com': 'Spotify',
  'notion.so': 'Notion',
  'figma.com': 'Figma',
  'stackoverflow.com': 'Stack Overflow',
  'developer.mozilla.org': 'MDN',
  'news.ycombinator.com': 'Hacker News',
  'amazon.fr': 'Amazon',
  'amazon.com': 'Amazon',
  'leboncoin.fr': 'leboncoin',
  'instagram.com': 'Instagram',
  'facebook.com': 'Facebook',
  'whatsapp.com': 'WhatsApp',
  'web.whatsapp.com': 'WhatsApp',
  'discord.com': 'Discord',
  'chatgpt.com': 'ChatGPT',
  'vercel.com': 'Vercel',
  'npmjs.com': 'npm',
  'deezer.com': 'Deezer',
  'primevideo.com': 'Prime Video',
  'disneyplus.com': 'Disney+',
  'soundcloud.com': 'SoundCloud',
  'outlook.live.com': 'Outlook',
  'outlook.office.com': 'Outlook',
};

/** Nom lisible tiré de l'URL, par ex. « Hacker News » pour news.ycombinator.com. */
export function guessTitle(url: string): string {
  const host = hostnameOf(url).toLowerCase();
  if (KNOWN_NAMES[host]) return KNOWN_NAMES[host];
  const parts = host.split('.');
  // Domaine enregistrable approximatif : avant-dernier libellé (ignore co.uk, com.au, etc.)
  let label = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  if (parts.length >= 3 && ['co', 'com', 'org', 'net', 'gouv', 'ac'].includes(label)) label = parts[parts.length - 3];
  const parentHost = parts.slice(-2).join('.');
  if (KNOWN_NAMES[parentHost]) return KNOWN_NAMES[parentHost];
  if (!label) return host;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Construit l'URL de recherche d'un modèle contenant %s. */
export function fillTemplate(template: string, query: string): string {
  return template.replace(/%s/g, encodeURIComponent(query));
}

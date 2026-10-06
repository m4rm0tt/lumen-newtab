// Toutes ces demandes doivent partir d'un clic, sinon Chrome les refuse.
import { isExtension } from '../storage/backend';
import { originPattern } from './url';

type OptionalPermission = 'bookmarks' | 'identity';

export async function hasPermission(p: OptionalPermission): Promise<boolean> {
  if (!isExtension || !chrome.permissions) return false;
  try {
    return await chrome.permissions.contains({ permissions: [p] });
  } catch {
    return false;
  }
}

/** Doit être appelé depuis un geste utilisateur (clic). */
export async function requestPermission(p: OptionalPermission): Promise<boolean> {
  if (!isExtension || !chrome.permissions) return false;
  try {
    return await chrome.permissions.request({ permissions: [p] });
  } catch {
    return false;
  }
}

export async function hasOrigin(url: string): Promise<boolean> {
  const origin = originPattern(url);
  if (!origin || !isExtension || !chrome.permissions) return false;
  try {
    return await chrome.permissions.contains({ origins: [origin] });
  } catch {
    return false;
  }
}

/** Accès à un domaine précis (ex. un flux RSS sans en-têtes CORS). Doit suivre un clic. */
export async function requestOrigin(url: string): Promise<boolean> {
  const origin = originPattern(url);
  if (!origin || !isExtension || !chrome.permissions) return false;
  try {
    return await chrome.permissions.request({ origins: [origin] });
  } catch {
    return false;
  }
}

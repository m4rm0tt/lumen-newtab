// Environnement de test : IndexedDB simulée et stockage en mémoire (pas d'API chrome).
import 'fake-indexeddb/auto';
import { beforeEach } from 'vitest';
import { useMemoryBackend } from '../src/storage/backend';

beforeEach(() => {
  useMemoryBackend();
  globalThis.localStorage?.clear?.();
});

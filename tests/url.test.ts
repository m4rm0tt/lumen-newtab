import { describe, expect, it } from 'vitest';
import { fillTemplate, guessTitle, looksLikeUrl, normalizeUrl, originPattern } from '../src/lib/url';
import { resolveQuery, isValidTemplate } from '../src/features/search/engines';

describe('normalizeUrl', () => {
  it('ajoute https:// aux domaines nus', () => {
    expect(normalizeUrl('github.com')).toBe('https://github.com/');
    expect(normalizeUrl('  fr.wikipedia.org/wiki/Paris ')).toBe('https://fr.wikipedia.org/wiki/Paris');
  });

  it('accepte localhost avec port et les IP', () => {
    expect(normalizeUrl('localhost:3000')).toBe('https://localhost:3000/');
    expect(normalizeUrl('http://192.168.1.1')).toBe('http://192.168.1.1/');
  });

  it('accepte les pages internes de Chrome', () => {
    expect(normalizeUrl('chrome://settings')).toBe('chrome://settings');
  });

  it('refuse javascript:, data: et le texte libre', () => {
    expect(normalizeUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeUrl('data:text/html,<b>x</b>')).toBeNull();
    expect(normalizeUrl('bonjour tout le monde')).toBeNull();
    expect(normalizeUrl('motseul')).toBeNull();
    expect(normalizeUrl('')).toBeNull();
  });
});

describe('looksLikeUrl', () => {
  it('distingue adresse et requête', () => {
    expect(looksLikeUrl('github.com')).toBe(true);
    expect(looksLikeUrl('https://exemple.fr/a?b=1')).toBe(true);
    expect(looksLikeUrl('localhost:5173')).toBe(true);
    expect(looksLikeUrl('meteo paris')).toBe(false);
    expect(looksLikeUrl('node.js')).toBe(true);
    expect(looksLikeUrl('3.14')).toBe(false);
  });
});

describe('guessTitle', () => {
  it('connaît les marques courantes', () => {
    expect(guessTitle('https://www.youtube.com/')).toBe('YouTube');
    expect(guessTitle('https://mail.google.com/mail/u/0')).toBe('Gmail');
  });

  it('dérive un nom du domaine', () => {
    expect(guessTitle('https://www.lemonde.fr/')).toBe('Lemonde');
    expect(guessTitle('https://shop.example.co.uk/')).toBe('Example');
  });
});

describe('modèles de recherche', () => {
  it('encode la requête', () => {
    expect(fillTemplate('https://s.com/?q=%s', 'a & b')).toBe('https://s.com/?q=a%20%26%20b');
  });

  it('valide un modèle personnalisé', () => {
    expect(isValidTemplate('https://kagi.com/search?q=%s')).toBe(true);
    expect(isValidTemplate('https://kagi.com/search')).toBe(false);
    expect(isValidTemplate('javascript:%s')).toBe(false);
  });

  it('ouvre une adresse au lieu de la chercher', () => {
    expect(resolveQuery('github.com', 'google', '')).toEqual({ kind: 'url', url: 'https://github.com/' });
  });

  it('utilise le moteur choisi, et retombe sur Google hors extension', () => {
    expect(resolveQuery('chat', 'duckduckgo', '')).toEqual({ kind: 'url', url: 'https://duckduckgo.com/?q=chat' });
    expect(resolveQuery('chat', 'chrome', '')).toEqual({ kind: 'url', url: 'https://www.google.com/search?q=chat' });
    expect(resolveQuery('chat', 'custom', 'https://x.org/?s=%s')).toEqual({ kind: 'url', url: 'https://x.org/?s=chat' });
    expect(resolveQuery('   ', 'google', '')).toBeNull();
  });

  it('calcule le motif de permission d’origine', () => {
    expect(originPattern('https://blog.example.com/feed.xml')).toBe('https://blog.example.com/*');
    expect(originPattern('ftp://x.org')).toBeNull();
  });
});

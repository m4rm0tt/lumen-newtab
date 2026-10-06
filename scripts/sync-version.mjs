// Lancé par `npm version` : recopie la version de package.json dans le manifeste.
import { readFileSync, writeFileSync } from 'node:fs';

const pkgUrl = new URL('../package.json', import.meta.url);
const manifestUrl = new URL('../public/manifest.json', import.meta.url);
const { version } = JSON.parse(readFileSync(pkgUrl, 'utf8'));
const manifest = readFileSync(manifestUrl, 'utf8');
// Remplacement ciblé : garde la mise en forme du fichier intacte.
const next = manifest.replace(/("version"\s*:\s*")[^"]*(")/, `$1${version}$2`);
if (next === manifest && !manifest.includes(`"version": "${version}"`)) {
  console.error('Champ "version" introuvable dans public/manifest.json');
  process.exit(1);
}
writeFileSync(manifestUrl, next);
console.log(`manifest.json : version ${version}`);

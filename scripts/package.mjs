// Zippe dist/ dans release/lumen-<version>.zip pour le Chrome Web Store.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const dist = resolve(root, 'dist');
const { version } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const outDir = resolve(root, 'release');
const out = resolve(outDir, `lumen-${version}.zip`);

if (!existsSync(resolve(dist, 'manifest.json'))) {
  console.error('dist/ est vide : lancez « npm run build ».');
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });
rmSync(out, { force: true });

if (process.platform === 'win32') {
  execFileSync('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path '${dist}\\*' -DestinationPath '${out}'`], { stdio: 'inherit' });
} else {
  // -X : sans attributs étendus macOS ; manifest.json à la racine de l'archive.
  execFileSync('zip', ['-r', '-X', '-q', out, '.', '-x', '.*', '-x', '__MACOSX'], { cwd: dist, stdio: 'inherit' });
}
console.log(`Archive prête : release/lumen-${version}.zip (${(statSync(out).size / 1024).toFixed(0)} Ko)`);

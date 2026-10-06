// Relit dist/ après le build et échoue si le manifeste, les permissions ou la CSP
// ne passeraient pas la revue du Chrome Web Store.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
const errors = [];
const warnings = [];

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

if (!existsSync(join(DIST, 'manifest.json'))) {
  console.error('dist/manifest.json introuvable : lancez « vite build » d’abord.');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(join(DIST, 'manifest.json'), 'utf8'));
const files = walk(DIST);
const rel = (p) => p.slice(DIST.length);

// 1. Manifeste
if (manifest.manifest_version !== 3) errors.push('manifest_version doit valoir 3.');
if (manifest.version !== pkg.version) errors.push(`Version du manifeste (${manifest.version}) ≠ package.json (${pkg.version}).`);
if ((manifest.description ?? '').length > 132) errors.push('La description dépasse 132 caractères (limite du Web Store).');
if ((manifest.name ?? '').length > 75) errors.push('Le nom dépasse 75 caractères.');
for (const [size, path] of Object.entries(manifest.icons ?? {})) {
  if (!existsSync(join(DIST, path))) errors.push(`Icône ${size} manquante : ${path}`);
}
if (!manifest.icons?.['128']) errors.push('Icône 128 px obligatoire.');
const newtab = manifest.chrome_url_overrides?.newtab;
if (!newtab || !existsSync(join(DIST, newtab))) errors.push('chrome_url_overrides.newtab doit pointer vers un fichier existant.');

// 2. Permissions : seule la liste attendue est autorisée.
const ALLOWED = new Set(['storage', 'favicon', 'search']);
const ALLOWED_OPTIONAL = new Set(['bookmarks', 'identity']);
for (const p of manifest.permissions ?? []) if (!ALLOWED.has(p)) errors.push(`Permission inattendue : ${p}`);
for (const p of manifest.optional_permissions ?? []) if (!ALLOWED_OPTIONAL.has(p)) errors.push(`Permission facultative inattendue : ${p}`);
if (manifest.host_permissions?.length) errors.push('Aucune host_permissions obligatoire ne doit être déclarée (utiliser optional_host_permissions).');

// 3. CSP : pas d'assouplissement.
const csp = manifest.content_security_policy?.extension_pages ?? '';
if (/unsafe-eval|unsafe-inline|https?:/.test(csp)) errors.push(`CSP trop permissive : ${csp}`);

// 4. Code : pas de script inline, pas de code distant, pas d'eval.
for (const f of files) {
  const ext = extname(f);
  if (ext === '.html') {
    const html = readFileSync(f, 'utf8');
    for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (!/\bsrc=/.test(m[1])) errors.push(`${rel(f)} : script inline interdit par MV3.`);
      else if (/src=["']?(https?:)?\/\//.test(m[1])) errors.push(`${rel(f)} : script distant interdit par MV3.`);
    }
    if (/\son[a-z]+=["']/i.test(html)) errors.push(`${rel(f)} : gestionnaire d'événement inline interdit.`);
  }
  if (ext === '.js') {
    const js = readFileSync(f, 'utf8');
    if (/\beval\s*\(/.test(js)) errors.push(`${rel(f)} : eval() détecté.`);
    if (/new\s+Function\s*\(/.test(js)) errors.push(`${rel(f)} : new Function() détecté.`);
    if (/import\s*\(\s*["']https?:/.test(js)) errors.push(`${rel(f)} : import() distant détecté.`);
  }
}

// 5. Taille
const total = files.reduce((n, f) => n + statSync(f).size, 0);
const mainJs = files.filter((f) => /assets\/newtab-.*\.js$/.test(f)).reduce((n, f) => n + statSync(f).size, 0);
if (mainJs > 250 * 1024) warnings.push(`Bundle principal volumineux : ${(mainJs / 1024).toFixed(0)} Ko.`);

console.log('\nVérification du build Lumen');
console.log(`  manifeste      MV3 · v${manifest.version}`);
console.log(`  permissions    ${(manifest.permissions ?? []).join(', ')}`);
console.log(`  facultatives   ${(manifest.optional_permissions ?? []).join(', ')} + accès aux sites à la demande`);
console.log(`  bundle initial ${(mainJs / 1024).toFixed(0)} Ko · total ${(total / 1024).toFixed(0)} Ko · ${files.length} fichiers`);
for (const w of warnings) console.log(`  ⚠ ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log('  ✓ conforme\n');

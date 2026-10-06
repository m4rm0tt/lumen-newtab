# Contribuer

Tu veux corriger un bug, ajouter un widget ou changer un détail qui t'agace ? Voilà comment récupérer le projet et proposer ta modification.

## Récupérer le code

Il te faut Git, Node.js 20 ou plus récent, et Chrome.

```bash
git clone https://github.com/m4rm0tt/lumen-newtab.git
cd lumen-newtab
npm install
```

Si tu n'as pas les droits d'écriture sur le dépôt, fais d'abord un fork depuis GitHub et clone ton fork à la place.

## Travailler

`npm run dev` ouvre l'interface dans un onglet normal et la recharge à chaque sauvegarde. C'est le plus rapide pour tout ce qui est visuel. Les API propres à Chrome (favicons, favoris, synchro) n'existent pas dans ce mode : le stockage passe par `localStorage` et les fonctions qui en dépendent sont désactivées.

Pour tester la vraie extension, lance `npm run build`, puis charge le dossier `dist/` dans `chrome://extensions` (mode développeur, « Charger l'extension non empaquetée »). Après chaque modification, relance le build et clique sur la flèche de rechargement de la carte Lumen.

`npm test` lance les tests. Le README décrit l'organisation de `src/`, et [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) explique comment marchent le stockage, la synchro, les widgets et le glisser-déposer.

## Proposer une modification

```bash
git switch -c ma-modif
# … tes changements …
npm test && npm run build
git add -A
git commit -m "Ajoute un widget citations"
git push -u origin ma-modif
```

Ouvre ensuite une pull request sur GitHub. La CI relance les tests et le build ; une fois terminée, l'extension compilée est téléchargeable dans l'onglet Checks de la PR (artefact `lumen-dist`), ce qui permet de l'essayer sans rien installer.

Pour récupérer les changements des autres :

```bash
git switch main
git pull                 # depuis un fork : git pull upstream main
npm install              # si package.json a bougé
```

## Ce que j'attends d'une modification

Lumen n'a ni serveur, ni compte, ni télémétrie, et ça doit rester comme ça. Rien ne sort du navigateur, sauf ce qu'envoie un widget que la personne a choisi d'ajouter.

Une nouvelle permission doit rester facultative et être demandée au moment où elle sert (voir `src/lib/permissions.ts`). Le script `scripts/verify-build.mjs` fait échouer le build si une permission imprévue apparaît, si du code utilise `eval` ou si la CSP est assouplie.

Avant d'ajouter une dépendance, parle-m'en dans la PR. Il n'y en a que trois aujourd'hui.

Si tu changes la forme des données stockées, ajoute une migration dans `MIGRATIONS` (`src/storage/schema.ts`) avec un test. Sans elle, les configurations existantes risquent d'être remises à zéro.

Pour un nouveau widget, il faut un fichier dans `src/widgets/` (export par défaut pour le composant, export `Settings` si le widget a des réglages) et une entrée dans `src/widgets/registry.ts`. S'il appelle un service externe, déclare-le dans le champ `network` et ajoute un paragraphe dans `docs/INTEGRATIONS.md`.

L'interface est en français, et j'essaie de garder le moins de boutons visibles possible.

## Publier une version

C'est pour moi, mais au cas où :

```bash
npm version minor        # ou patch, ou major
git push --follow-tags
```

`npm version` met à jour `package.json` et `public/manifest.json`, fait le commit et pose le tag. Le tag `vX.Y.Z` déclenche le workflow de release, qui lance les tests, construit l'extension et publie `lumen-X.Y.Z.zip` dans les releases GitHub.

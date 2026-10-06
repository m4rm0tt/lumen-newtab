# Publier sur le Chrome Web Store

Ma liste de contrôle pour mettre Lumen en ligne, puis pour chaque nouvelle version.

## Avant d'envoyer quoi que ce soit

- [ ] Monter la version avec `npm version patch|minor|major`. La commande met à jour `package.json` et `public/manifest.json` ensemble, et le build refuse de passer si les deux ne correspondent pas.
- [ ] `npm test`
- [ ] `npm run package`, qui doit afficher « ✓ conforme » et produire `release/lumen-x.y.z.zip`.
- [ ] Charger `dist/` dans Chrome et dérouler la recette manuelle plus bas.
- [ ] Vérifier qu'aucune erreur n'apparaît sous la carte Lumen dans `chrome://extensions`.
- [ ] Mettre une adresse de contact dans `docs/PRIVACY.md` et publier ce texte à une adresse publique (GitHub Pages, un gist, une page Notion publique).

## Le compte développeur

- [ ] Créer le compte sur https://chrome.google.com/webstore/devconsole (5 $, une seule fois).
- [ ] Vérifier l'adresse de contact, sans quoi le store refuse de publier.
- [ ] Activer la validation en deux étapes sur le compte Google.

## La fiche

Le paquet à téléverser est `release/lumen-x.y.z.zip`. `manifest.json` doit se trouver à la racine de l'archive, ce que fait `scripts/package.mjs`.

- [ ] Nom : Lumen.
- [ ] Description courte : celle du manifeste, 132 caractères au plus.
- [ ] Description longue : ce que fait l'extension, le fait qu'il n'y a ni compte ni télémétrie, et la liste des services contactés par les widgets facultatifs.
- [ ] Catégorie : Productivité.
- [ ] Langue : français.
- [ ] Icône 128 × 128 : `public/icons/icon-128.png`.
- [ ] Captures en 1280 × 800, de une à cinq. `docs/screenshots/` en a déjà quatre (à exporter dans ce format) : l'accueil, les widgets, les réglages et le fond clair avec le menu contextuel.
- [ ] Petite vignette promotionnelle 440 × 280, facultative mais conseillée.

## L'onglet « Pratiques de confidentialité »

Objectif unique, à coller tel quel : « Remplacer la page Nouvel onglet par un tableau de bord personnel : heure, recherche, raccourcis, fond et widgets. »

Justifications des permissions :

| Permission | Texte à coller |
| --- | --- |
| `storage` | Enregistrer les réglages, raccourcis et widgets de l'utilisateur, et les synchroniser via Chrome Sync. |
| `favicon` | Afficher l'icône des sites raccourcis depuis le cache de Chrome, sans requête réseau. |
| `search` | Lancer les recherches avec le moteur par défaut choisi par l'utilisateur dans Chrome. |
| `bookmarks` (facultative) | Importer, à la demande de l'utilisateur, les dossiers de favoris qu'il choisit comme groupes de raccourcis. Lecture seule. |
| `identity` (facultative) | Connexion OAuth à Spotify pour le widget Spotify, à la demande de l'utilisateur. |
| accès aux sites (facultatif) | Lire un flux RSS ou une API JSON indiqués par l'utilisateur quand ce site bloque les requêtes d'autres origines. Demandé domaine par domaine. |

- [ ] Code distant : non. Tout le JavaScript est dans le paquet.
- [ ] Données collectées : ne rien cocher. Les données restent dans le navigateur ou passent par Chrome Sync.
- [ ] Cocher les trois engagements (pas de vente, pas d'usage hors de l'objectif unique, pas d'évaluation de solvabilité).
- [ ] Coller l'adresse de la politique de confidentialité.

Pour la visibilité, « Non répertoriée » suffit pour partager l'extension par lien avec des amis. Il faut choisir « Publique » pour qu'elle apparaisse dans les recherches du store.

## Recette manuelle

- [ ] Un nouvel onglet s'affiche tout de suite, sans flash blanc. Au premier lancement, la présentation apparaît et le bouton « Passer » la ferme.
- [ ] Taper un mot lance une recherche, `github.com` ouvre le site, et le nom d'un raccourci apparaît en suggestion.
- [ ] Ajouter un raccourci par son adresse (le nom se remplit seul), changer son icône (emoji, symbole, image), le supprimer puis annuler.
- [ ] Glisser un raccourci dans la grille, puis sur l'onglet d'un autre groupe ; survoler un onglet pour l'ouvrir ; Échap annule.
- [ ] Créer un groupe avec une icône et une couleur, le déplacer, le supprimer et annuler. Essayer le mode « Tous visibles ».
- [ ] Importer un dossier de favoris, puis le réimporter : le groupe se complète au lieu de se dédoubler.
- [ ] Déposer un JPEG puis un GIF sur la page, régler le flou, la luminosité et le voile, puis recharger : l'image est toujours là, sans flash.
- [ ] Dans les réglages, chaque curseur agit en direct et « Rétablir » fonctionne.
- [ ] Exporter, réinitialiser, puis importer : raccourcis, widgets, notes et images (si on les a incluses) reviennent.
- [ ] Avec deux onglets ouverts, une modification faite dans l'un apparaît dans l'autre.
- [ ] Hors ligne (DevTools › Network › Offline), la page fonctionne et les widgets réseau gardent leur dernière valeur.
- [ ] Au clavier seul, Tab parcourt tout, le focus reste visible et les menus s'ouvrent.
- [ ] Avec « Réduire les animations » activé dans macOS, plus rien ne bouge.
- [ ] Dans une fenêtre d'environ 800 pixels de large, rien ne déborde et les widgets latéraux passent dessous.

## Après la publication

Les mises à jour suivent le même chemin : nouvelle version, nouveau zip, nouvelle soumission. La revue prend de quelques heures à quelques jours.

L'extension publiée n'a pas le même identifiant que la version chargée à la main, donc l'URI de redirection Spotify change aussi. Il faut l'ajouter dans l'application Spotify.

Tout changement du format des données s'accompagne d'une migration dans `src/storage/schema.ts`, avec son test.

# Architecture

Notes sur la façon dont Lumen est construit et sur les choix que j'ai faits en route. Le README donne la vue d'ensemble ; ici on entre dans le détail.

## Les contraintes de départ

Une page Nouvel onglet est une page d'extension comme une autre, avec les règles de Manifest V3. Pas de script inline, pas d'`eval`, pas de code chargé depuis Internet : tout le JavaScript est dans le paquet. `scripts/verify-build.mjs` relit `dist/` après chaque build et échoue s'il trouve l'un des trois.

Chrome met le curseur dans la barre d'adresse quand on ouvre un onglet, et une page ne peut pas le reprendre proprement. J'ai laissé ce comportement par défaut : taper dans la barre d'adresse lance une recherche avec le moteur de Chrome, ce qui convient à la plupart des gens. Une option recharge la page via `chrome.tabs.update` pour placer le curseur dans la recherche de Lumen. En contrepartie, l'adresse de l'extension s'affiche dans la barre.

Je voulais aussi que l'installation n'affiche aucun avertissement. Lumen demande donc seulement trois permissions au départ, et le reste quand on en a besoin :

| Permission | Quand | Pour quoi |
| --- | --- | --- |
| `storage` | installation | `chrome.storage.local` et `chrome.storage.sync` |
| `favicon` | installation | lire les icônes des sites dans le cache de Chrome, sans requête réseau |
| `search` | installation | chercher avec le moteur choisi dans Chrome (`chrome.search.query`) |
| `bookmarks` | au clic sur « Importer mes favoris » | lire les dossiers de favoris |
| `identity` | au clic sur « Se connecter à Spotify » | `chrome.identity.launchWebAuthFlow` |
| accès à un site | quand un flux RSS ou une API JSON refuse les requêtes d'autres origines | lire ce site-là, et seulement lui |

## Stack

Preact 11 et `@preact/signals` pour l'interface, TypeScript en mode strict, Vite 8 pour le build, Vitest pour les tests. Vite n'a besoin d'aucun plugin d'extension : `newtab.html` sert de point d'entrée et `public/manifest.json` est copié tel quel.

L'apparence passe entièrement par des variables CSS posées sur `<html>` (`src/app/theme.ts`). Bouger le curseur d'opacité des cartes change une variable ; aucun composant ne se re-rend.

## Stockage

Les données vivent à trois endroits.

La configuration (réglages, groupes, raccourcis, liste des widgets) forme un seul document, le `SyncDoc`. Il est écrit dans `chrome.storage.local` sous la clé `doc`, recopié dans `localStorage` (`lumen:boot`) pour le démarrage, et envoyé dans `chrome.storage.sync` si la synchro est activée.

Les données propres à chaque widget (texte des notes, tâches, état du minuteur) sont dans `chrome.storage.local` sous des clés `w:<id>`. Elles ne sont pas synchronisées, mais l'export les inclut. Les jetons et clés d'API vont sous `secret:*` et ne sont jamais exportés. Les réponses réseau en cache vont sous `cache:*`.

Les fichiers lourds (images et GIF de fond, icônes importées) vont dans IndexedDB, base `lumen`, magasin `blobs`. Ils ne quittent jamais l'appareil.

### La synchro

`chrome.storage.sync` impose 8 192 octets par élément, 102 400 au total, 512 éléments et 120 écritures par minute. Une configuration avec cent cinquante raccourcis dépasse déjà la limite par élément.

Lumen sérialise donc le document en JSON et le découpe en morceaux `lumen.doc.0`, `lumen.doc.1`, etc. Une clé `lumen.doc.meta` décrit le tout : nombre de morceaux, taille, hash FNV, auteur et date. À chaque sauvegarde, Lumen relit l'état distant, n'envoie que les morceaux qui ont changé, puis la meta en dernier. Un appareil qui lit pendant l'écriture ne peut donc pas voir une meta qui pointe vers des morceaux absents. S'il tombe sur des morceaux incohérents, le hash ne correspond pas et il garde sa copie. Les écritures attendent deux secondes de calme avant de partir, ce qui reste loin des 120 par minute. Au-delà de 90 Ko, la synchro se met en pause avec un message et la configuration reste en local.

En cas de conflit, la dernière écriture gagne, au niveau du document entier (`updatedAt`). Chaque page tire un identifiant au chargement pour ignorer l'écho de ses propres écritures, et les autres onglets ouverts se mettent à jour via `chrome.storage.onChanged`. J'ai préféré ça à une fusion champ par champ : il faudrait modifier le même tableau de bord sur deux machines dans les mêmes deux secondes pour perdre quelque chose.

Une image importée sur un ordinateur n'existe pas sur l'autre. Si le fond choisi y est introuvable, Lumen affiche le dernier fond intégré utilisé, et la page Arrière-plan des réglages explique pourquoi.

### Validation et migrations

Tout ce qui entre passe par `normalizeDoc()` dans `src/storage/schema.ts` : lecture du stockage, document venu d'un autre appareil, fichier importé. La fonction ignore les champs inconnus, vérifie les types et les valeurs autorisées, borne les nombres, refuse les URL `javascript:` et `data:`, répare les identifiants en double et limite les tailles (40 groupes, 120 raccourcis par groupe, 30 widgets). Une configuration abîmée donne les réglages par défaut au lieu d'une page blanche.

Le document porte un `schemaVersion`. Chaque changement de format ajoute une entrée à `MIGRATIONS`, qui fait passer un document de la version n à n + 1. On n'édite jamais une migration existante.

## Le démarrage

`main.tsx` lit `lumen:boot` dans `localStorage`, ce qui est synchrone, et affiche la page complète tout de suite. Il lit ensuite `chrome.storage.local` et `chrome.storage.sync`, garde le plus récent, puis attend que le navigateur soit inactif pour précharger les réglages et faire le ménage dans IndexedDB.

Les fonds intégrés sont du CSS (des dégradés radiaux superposés), donc rien à télécharger. Pour une image importée, une miniature floue d'environ 2 Ko stockée dans `localStorage` s'affiche au premier rendu, puis l'image complète apparaît en fondu.

Chaque widget est un chunk JavaScript séparé, chargé seulement s'il est utilisé. Les widgets réseau affichent d'abord leur cache et ne lancent leur requête qu'après le premier rendu, et jamais quand l'onglet est en arrière-plan. L'horloge se réveille une fois par minute, ou une fois par seconde si on affiche les secondes, calée sur le changement visible.

Résultat mesuré sur le build actuel : 41 Ko compressés pour le code initial, 9 Ko pour les réglages chargés à part.

## La mise en page

Je n'ai pas fait de grille libre où l'on place chaque bloc à des coordonnées. Avec ce système, un bloc finit tôt ou tard par en chevaucher un autre ou par disparaître hors de l'écran quand la fenêtre change de taille.

Le bloc principal (heure, recherche, raccourcis) est centré dans une largeur réglable. Les widgets sont dans une grille CSS en placement automatique (`grid-auto-flow: dense`) : on choisit leur ordre par glisser-déposer et leur taille (petit, large, haut, grand), et le navigateur les place. La zone des widgets peut aller en bas, à gauche ou à droite. Sous 1 100 pixels de large, les colonnes latérales passent dessous, et une container query ramène les widgets larges à une colonne quand il n'y a pas la place.

## Le glisser-déposer

`src/lib/dnd.ts` fait environ 300 lignes, sans dépendance. Il ne démarre qu'après 6 pixels de mouvement, ce qui laisse les clics normaux tranquilles, et il annule le clic qui suit un glisser.

Pendant le geste, un clone de l'élément suit le pointeur dans un calque fixe, et les voisins se décalent avec une animation FLIP (`src/lib/flip.ts`). Le calcul de la position d'insertion utilise la position de layout mémorisée de chaque élément, pas sa position animée ; sinon tout tremble pendant que les voisins bougent.

Les zones de dépôt se déclarent dans le DOM avec des attributs `data-dnd-container` et `data-dnd-target`. Un onglet de groupe est une cible : si on le survole 550 ms avec un raccourci, il s'ouvre et on peut déposer le raccourci à l'endroit précis voulu dans la grille. Échap annule. Au clavier, `Alt` avec les flèches déplace l'élément sélectionné, et le menu contextuel propose « Déplacer vers ».

Le même code sert pour les raccourcis, les groupes, les widgets et les tâches.

## Les widgets

Un widget est une définition (`src/widgets/types.ts`) plus un module chargé à la demande :

```ts
interface WidgetDefinition<C> {
  type, name, description, icon, category,
  sizes, defaultSize,
  defaultConfig: C,
  normalize?(raw): C,       // valide la config lue dans le stockage
  title?(config): string,
  network?: string[],       // services contactés, affichés dans la bibliothèque
  requirement?: string,     // ce qu'il faut à l'utilisateur, ex. « Clé gratuite Finnhub »
  dataKeys?(id): string[],  // données locales à effacer avec le widget
  load(): Promise<{ default: Composant, Settings?: Composant }>
}
```

Le reste de l'application ne connaît que cette interface. `WidgetArea.tsx` place chaque widget dans un cadre qui gère le chargement, le menu (réglages, taille, retrait avec annulation), le glisser-déposer et une frontière d'erreur : un widget qui plante affiche « Réessayer », et le reste de la page continue. `useRemote()` dans `src/lib/remote.ts` s'occupe du cache réseau.

Pour les widgets personnalisés, exécuter du JavaScript fourni par l'utilisateur était exclu : c'est interdit par Manifest V3, et ce serait lui donner les droits de l'extension. Un widget personnalisé est donc une définition JSON, avec trois modes. Le mode texte affiche une phrase. Le mode page charge une URL dans une `<iframe sandbox>`, sur sa propre origine. Le mode données lit des valeurs dans une réponse JSON grâce à des chemins comme `data.items[0].price`, puis les affiche avec un format (nombre, pourcentage, euros, dollars, date). La lecture par chemin n'évalue rien et bloque `__proto__` et `constructor`. Une définition se partage par copier-coller (`{"lumenWidget": 1, …}`) et passe par le même validateur à l'import.

## Accessibilité

Tout se fait au clavier. Les onglets de groupes forment un vrai `tablist` (flèches, Début, Fin), la grille se parcourt aux flèches et les menus contextuels répondent aux flèches, à Entrée et à Échap. Chaque bouton qui n'a qu'une icône a un `aria-label`. Les interrupteurs utilisent `role="switch"` et les contrôles segmentés sont des `radiogroup`.

Les modales utilisent `<dialog>` : le navigateur fournit le piège à focus et la touche Échap, et le focus revient où il était à la fermeture. Lumen respecte `prefers-reduced-motion`, et un réglage permet de couper les animations à la main. La couleur du texte suit la luminosité du fond, calculée à l'import de l'image, avec un voile et une ombre portée réglables.

## Ce que j'ai laissé de côté

Afficher le processeur ou la mémoire demanderait des permissions `system.*` qui déclenchent un avertissement, pour pas grand-chose sur une page Nouvel onglet.

Les suggestions de recherche en ligne enverraient chaque lettre tapée à un service tiers. Lumen ne suggère que vos propres raccourcis, en local.

La météo se règle par nom de ville. La géolocalisation aurait demandé une permission qui affiche un avertissement.

Le calendrier est local. Brancher Google Agenda reste faisable avec `chrome.identity`, mais le Web Store demande alors une vérification de l'application par Google.

Il n'existe pas d'API boursière gratuite, fiable et sans clé. Le widget Bourse utilise donc une clé Finnhub gratuite que chacun crée.

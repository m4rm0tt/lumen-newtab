# Intégrations

Les widgets qui parlent à un service extérieur sont tous facultatifs. Tant qu'on n'en ajoute pas un, aucune requête ne part. L'extension ne contient aucun secret.

| Widget | Service | Ce qu'il faut | Données envoyées |
| --- | --- | --- | --- |
| Météo | Open-Meteo | rien | le nom tapé pour chercher la ville, puis ses coordonnées |
| Crypto | CoinGecko (API publique) | rien | les cryptos choisies et la devise |
| Bourse | Finnhub | une clé gratuite | les symboles et la clé |
| RSS | les sites des flux | rien, parfois l'accès au domaine | une requête GET par flux |
| GitHub | api.github.com | rien, ou un jeton personnel | le nom d'utilisateur, et le jeton s'il y en a un |
| Spotify | accounts.spotify.com, api.spotify.com | une application Spotify à soi | l'échange OAuth et les commandes de lecture |
| Personnalisé | l'adresse indiquée | selon l'adresse | une requête GET vers cette adresse |

Toutes les requêtes partent avec `credentials: 'omit'` et `referrerPolicy: 'no-referrer'`, donc sans cookies ni référent.

## Spotify

L'API Web de Spotify donne le titre en cours (`/me/player/currently-playing`) et les commandes lecture, pause, suivant et précédent (`/me/player/*`). Les commandes demandent un compte Premium ; sans lui, le widget affiche seulement le titre.

Spotify propose pour les clients publics le flux OAuth « Authorization Code with PKCE », qui se passe de client secret, y compris pour rafraîchir le jeton. Comme il n'y a pas de secret à protéger, il n'y a pas besoin de serveur.

Côté utilisateur, ça se passe en quatre temps. On crée une application gratuite sur developer.spotify.com, avec la Web API. On y ajoute l'URI de redirection que le widget affiche (`https://<id-extension>.chromiumapp.org/spotify`). On colle le Client ID dans les réglages du widget. Enfin, « Se connecter » demande la permission `identity` et ouvre la page de connexion de Spotify via `chrome.identity.launchWebAuthFlow`, avec un challenge S256 et un paramètre `state` vérifié au retour.

Les jetons restent dans `chrome.storage.local` (`secret:spotify`) : ils ne sont ni synchronisés ni exportés. Le widget interroge Spotify toutes les dix secondes, et seulement quand l'onglet est visible.

Il y a deux limites. Une application Spotify en mode développement ne fonctionne que pour les comptes ajoutés à la main dans son tableau de bord, 25 au maximum. Pour des amis, le plus simple est que chacun crée sa propre application, ou que le propriétaire les ajoute à sa liste ; le mode « extended quota » est réservé aux entreprises. Ensuite, l'identifiant de l'extension change entre la version chargée à la main et celle du Web Store, et il faut déclarer les deux URI de redirection.

## GitHub

Sans jeton, le widget utilise l'API REST publique (`/users/{u}` et `/users/{u}/repos`), limitée à 60 requêtes par heure et par adresse IP. Avec un cache de quinze minutes, on en est loin.

Avec un jeton personnel à granularité fine, en lecture seule et sans aucune permission sur les dépôts, le widget affiche en plus le calendrier des contributions (GraphQL, `contributionsCollection`) ainsi que le nombre de revues demandées et de PR ouvertes (API de recherche).

Le flux OAuth web de GitHub exige un client secret, donc un serveur. Le device flow s'en passe, mais son endpoint de jeton n'envoie pas d'en-têtes CORS. Le jeton personnel reste la solution la plus simple : il ne quitte pas la machine (`secret:github`), et on peut le révoquer à tout moment depuis GitHub.

Je n'affiche pas les notifications : `/notifications` refuse les jetons à granularité fine, et je ne voulais pas pousser les gens vers un jeton classique aux droits bien plus larges.

## Météo

Open-Meteo est gratuit pour un usage non commercial, sans clé, et répond aux requêtes d'autres origines. On choisit la ville par son nom (`geocoding-api.open-meteo.com`) plutôt que par géolocalisation, ce qui évite la permission `geolocation` et son avertissement. Les prévisions restent vingt minutes en cache.

## Crypto

Le widget appelle `/coins/markets` pour le prix, la variation sur 24 heures et la courbe sur 7 jours, et `/search` pour ajouter une crypto. L'API publique de CoinGecko limite le nombre d'appels par IP ; avec cinq minutes de cache, il faut beaucoup d'onglets ouverts pour l'atteindre. Si elle répond 429, le widget garde la dernière valeur et affiche « Non actualisé ».

## Bourse

Je n'ai pas trouvé d'API boursière à la fois gratuite, fiable, sans clé et accessible depuis une autre origine. Yahoo n'a pas d'API officielle, et le quota gratuit d'Alpha Vantage est très bas. Finnhub accepte 60 requêtes par minute avec une clé gratuite et répond avec `Access-Control-Allow-Origin: *`. La clé reste sur la machine (`secret:finnhub`).

## RSS

Beaucoup de flux RSS ne renvoient pas d'en-têtes CORS. Lumen tente d'abord la requête directement. Si elle échoue, le widget propose « Autoriser l'accès aux flux », qui demande via `chrome.permissions.request` l'accès au seul domaine du flux. Le flux est lu avec `DOMParser` en mode XML, affiché en texte brut, et les liens qui ne sont pas en http ou https sont écartés.

## Widget personnalisé

Il n'exécute aucun code ; [ARCHITECTURE.md](ARCHITECTURE.md#les-widgets) décrit ses trois modes. L'iframe est sandboxée et chargée sur l'origine du site. Une requête JSON vers un domaine sans CORS passe par la même permission d'accès facultative que le RSS.

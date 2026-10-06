# Politique de confidentialité de Lumen

Mise à jour le 6 octobre 2026.

Lumen est une extension Chrome qui remplace la page Nouvel onglet. Elle ne collecte aucune donnée personnelle et ne communique avec aucun serveur appartenant à son auteur.

## Ce que Lumen enregistre

Vos réglages, vos groupes, vos raccourcis et la configuration de vos widgets sont enregistrés dans le stockage de Chrome. Si la synchronisation est activée dans Chrome et dans Lumen, ces données passent par Chrome Sync, et Google les traite comme le reste de vos données synchronisées.

Les images et GIF que vous importez comme fond, ainsi que les icônes personnalisées, restent dans une base IndexedDB de l'extension, sur votre ordinateur.

Vos notes, vos tâches et l'état du minuteur restent dans le stockage local de Chrome. Ils ne sortent de votre ordinateur que si vous exportez vous-même votre configuration.

Les jetons et clés que vous saisissez pour GitHub, Spotify ou Finnhub restent dans le stockage local de Chrome. Ils ne sont jamais inclus dans un export.

Lumen ne lit pas votre historique de navigation. Vos favoris Chrome ne sont lus que si vous cliquez sur « Importer mes favoris » et acceptez l'autorisation demandée par Chrome. Seuls les dossiers que vous cochez sont copiés dans Lumen, et vos favoris ne sont jamais modifiés.

Les icônes des sites viennent du cache de Chrome (permission `favicon`) ; Lumen ne fait aucune requête pour les obtenir.

## Statistiques et publicité

Il n'y en a pas : aucune mesure d'audience, aucune télémétrie, aucun rapport de plantage, aucune publicité, aucune revente de données.

## Services tiers

Lumen ne contacte un service tiers que si vous ajoutez le widget correspondant, et ne lui envoie que ce dont le widget a besoin :

- Météo (Open-Meteo) : le nom de la ville recherchée, puis ses coordonnées.
- Crypto (CoinGecko) : les cryptomonnaies choisies et la devise.
- Bourse (Finnhub) : les symboles choisis et votre clé d'API.
- GitHub (api.github.com) : le nom d'utilisateur indiqué, et votre jeton si vous en avez fourni un.
- Spotify (accounts.spotify.com et api.spotify.com) : l'échange de connexion OAuth et les requêtes de lecture liées à votre compte.
- RSS et widget personnalisé : une requête vers les adresses que vous avez indiquées.
- Fond par adresse : l'image est chargée depuis l'adresse que vous avez indiquée.

Ces requêtes partent sans cookies et sans référent. Chacun de ces services applique sa propre politique de confidentialité.

La barre de recherche envoie votre requête au moteur choisi (par défaut celui de Chrome) quand vous la validez. Les suggestions qui s'affichent pendant la frappe viennent uniquement de vos raccourcis et sont calculées sur votre ordinateur.

## Garder la main sur vos données

Réglages › Données et synchronisation permet d'exporter toute votre configuration, de tout réinitialiser ou de couper la synchronisation. Si vous désinstallez l'extension, Chrome efface ses données locales.

## Contact

Pour toute question : esteban.madrazo-bb@proton.me.

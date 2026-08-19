# Journal des versions

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).
Versionnage sémantique — le `version` du manifeste doit être bumpé à chaque
envoi au Chrome Web Store, sinon Google refuse le paquet.

## [Non publié]

### Ajouté
- Onglets : plusieurs dashboards indépendants, chacun avec ses modules et,
  en option, son propre thème/accent
- Modules : outils Google, dossier compact (façon écran d'accueil), météo
  (Open-Meteo), compte à rebours
- Vue « Pastilles » pour le module Dossier de favoris (icônes seules)
- Renommage local d'un favori (alias affiché sans toucher au vrai favori)
- Horloge : second fuseau horaire optionnel
- Recherche par préfixe (`g:` `yt:` `gh:` `wiki:` `maps:` `img:` `ddg:`)
- Raccourci `Alt+1`…`9` pour sauter à un module

### Modifié
- Schéma de configuration v2 (dashboards multiples) — migration automatique
  depuis les configurations existantes, sans perte

### Sécurité
- Nouveau `host_permissions` (api.open-meteo.com, geocoding-api.open-meteo.com)
  pour le module Météo optionnel — seul appel réseau de l'extension

## [0.1.0] — 2026-08-16

### Ajouté
- Remplacement du nouvel onglet par une feuille modulable
- Modules : dossier de favoris, horloge, bloc-notes, sites fréquents
- Mode plan : déplacement, redimensionnement, règle de colonnes
- Recherche dans les favoris avec repli sur un moteur web
- Thème encre/papier, accent réglable, fond d'écran, densité
- Export/import JSON de la mise en page

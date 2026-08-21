# Journal des versions

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).
Versionnage sémantique — le `version` du manifeste doit être bumpé à chaque
envoi au Chrome Web Store, sinon Google refuse le paquet.

## [Non publié]

## [1.9.0] — 2026-08-21

### Modifié
- Design wrappé (vue Pastilles) revu : le module devient une vraie
  pastille allongée, sans cartouche (titre/dimensions/réglages) ni cadre
  rectangulaire — juste les pastilles à la file, contour arrondi au
  maximum, collé à leur hauteur. La cartouche reste accessible en mode
  plan pour déplacer/régler/supprimer le module.

## [1.8.0] — 2026-08-20

### Ajouté
- Vue Pastilles du module Dossier : nouvelle option **Design wrappé**, qui
  réduit la marge du module au minimum pour qu'il prenne le moins de place
  possible autour des pastilles.
- « Ajouter un module » regroupe maintenant les modules par catégorie —
  Principal (Dossier, Dossier à onglets), Productivité (Bloc-notes), Autre
  (Horloge, Compte à rebours, Sites fréquents, Météo). Les futurs modules
  se classeront au fur et à mesure dans la bonne catégorie.

### Retiré
- Module « Outils Google » retiré complètement (plus dans le sélecteur, le
  code est supprimé). Un module déjà présent sur ton tableau de bord
  n'empêche rien de fonctionner mais n'affiche plus rien — retire-le et
  remplace-le au besoin par un module Dossier pointant vers ce dont tu as
  besoin.

## [1.7.0] — 2026-08-20

### Modifié
- « Icône compacte (ouvre une fenêtre) » retirée des choix d'« Affichage »
  du module Dossier lui-même — un module Dossier affiché sur la feuille
  reste toujours en tuiles/icônes/liste/pastilles. Ce rendu compact devient
  entièrement automatique pour les **sous-dossiers** créés par clic droit
  (voir ci-dessous), qui l'utilisent toujours, quel que soit l'Affichage
  du module qui les contient.

### Ajouté
- Sous-dossier créé par clic droit → + Nouveau sous-dossier : affiche
  maintenant un aperçu de son contenu (jusqu'à 4 icônes) directement sur sa
  tuile, façon écran d'accueil de téléphone, et accepte un favori déposé
  directement dessus (glisser depuis le panneau latéral ou un autre
  module) — plus besoin de l'ouvrir pour y classer quelque chose. La
  fenêtre qui s'ouvre au clic accepte elle aussi un dépôt direct.

## [1.6.0] — 2026-08-20

### Modifié
- Fusion des modules **Dossier de favoris** et **Dossier** en un seul
  module **Dossier**. « Dossier de favoris » disparaît du sélecteur
  « Ajouter un module » ; ses réglages (tuiles, liste, liste dense,
  icônes, pastilles) sont maintenant des options d'« Affichage » du
  module Dossier, aux côtés d'une nouvelle option **Icône compacte**
  (l'ancien comportement de Dossier : une icône façon écran d'accueil de
  téléphone qui s'ouvre en fenêtre au clic). Les modules Dossier de
  favoris déjà présents sur ton tableau de bord continuent de fonctionner
  sans aucun changement — rien à refaire.

### Ajouté
- Clic droit dans un dossier (mode Icône compacte comme mode tuiles/liste) :
  **+ Nouveau sous-dossier**. Crée un sous-dossier fait main, avec son
  propre style façon dossier d'écran d'accueil de téléphone (glyphe 📁),
  entièrement local à Atelier — jamais créé dans tes vrais favoris Chrome.
  Se renomme et se supprime via le menu contextuel ; le supprimer libère
  les favoris qu'il contenait au lieu de les faire disparaître.

## [1.5.0] — 2026-08-20

### Ajouté
- Les modules Dossier de favoris, Dossier à onglets et Dossier n'exigent
  plus d'assigner un vrai dossier Chrome : laisse le champ « Dossier »
  vide et le module devient un **dossier virtuel**, un bac vide que tu
  remplis toi-même en y glissant des favoris depuis le panneau latéral
  (mode plan) ou un autre module. Rien n'est créé dans tes vrais favoris
  Chrome — le classement reste entièrement local à Atelier.
- Message d'aide dans un dossier virtuel vide, pour indiquer quoi faire.
- La suppression d'un module libère maintenant les favoris qui y étaient
  classés virtuellement (ils redeviennent visibles sous leur dossier réel
  ailleurs dans Atelier, au lieu de devenir invisibles partout).

## [1.4.1] — 2026-08-20

### Corrigé
- Panneau latéral « Tous les favoris » : sa position (`top: 0` fixe) ne
  tenait pas compte de la cartouche (`position: sticky`, hauteur variable),
  ce qui le faisait passer sous elle. Sa position est maintenant mesurée en
  JS et réajustée à l'ouverture et au redimensionnement de la fenêtre.

## [1.4.0] — 2026-08-20

### Corrigé
- Module Dossier (aperçu compact) : n'acceptait aucun favori glissé depuis
  un autre module — seuls Dossier de favoris et Dossier à onglets géraient
  le dépôt. Corrigé, même protocole que les autres.
- Bug plus profond trouvé en corrigeant ce qui précède : la zone de dépôt
  était re-câblée (dupliquée) à chaque rafraîchissement du module au lieu
  d'être câblée une seule fois. Après plusieurs rafraîchissements, un dépôt
  pouvait viser un dossier obsolète. Corrigé dans bmview.js et folder.js.

### Ajouté
- Panneau latéral « Tous les favoris », visible en mode plan : liste (avec
  filtre) l'ensemble de tes favoris, avec leur chemin de dossier réel.
  Glisse n'importe quelle ligne vers un module Dossier de favoris / Dossier
  à onglets / Dossier pour la classer là — même mécanisme de classement
  virtuel que le glisser entre modules (rien n'est écrit dans tes vrais
  favoris Chrome).

## [1.3.0] — 2026-08-20

### Corrigé
- Mode plan : glisser un favori vers un **autre** module ne fonctionnait pas
  si ce module était plus grand que son contenu (zone de dépôt limitée aux
  tuiles elles-mêmes). La zone de dépôt couvre maintenant tout le module.
  Idem pour déposer dans un dossier vide.

### Ajouté
- Vue « Icônes seules » pour Dossier de favoris et Dossier à onglets : juste
  l'icône, sans nom en dessous — plus épuré que la vue Tuiles.
- Couleur personnalisée par module (n'importe lequel, pas juste les
  dossiers) : réglages du module → Couleur. La bordure et le fond du module
  reprennent cette teinte, dans le même style visuel qu'aujourd'hui (juste
  teinté, pas un nouveau style).

## [1.2.0] — 2026-08-20

### Modifié — changement de comportement important
- **L'organisation dans Atelier (ordre, classement entre modules) est
  maintenant entièrement locale à Atelier et n'écrit plus jamais dans tes
  vrais favoris Chrome.** Avant, réordonner ou glisser un favori vers un
  autre module modifiait réellement tes favoris (`chrome.bookmarks.move`).
  Ce n'est plus le cas : le CONTENU (existence, titre, lien) continue de
  suivre Chrome en direct — ajoute/renomme/supprime un favori dans Chrome,
  ça se reflète toujours ici — mais l'ordre affiché et le dossier dans
  lequel un favori apparaît dans Atelier sont désormais deux surcouches
  locales séparées (`chrome.storage.local`), jamais écrites dans Chrome.
- Glisser un favori vers un autre module « classe » virtuellement ce favori
  dans ce module (menu clic droit → « ↩ Remettre à sa place réelle » pour
  annuler) — le vrai favori Chrome ne bouge pas d'un poil.
- Petit point discret au survol d'un favori/dossier classé virtuellement,
  pour distinguer sa place « réelle » (Chrome) de sa place « affichée »
  (Atelier).
- Le tri « Ordre du dossier » est renommé « Ordre local (glisser-déposer) »
  pour que ce soit sans équivoque.

## [1.1.0] — 2026-08-19

### Ajouté
- Mode plan : glisser un favori (ou un dossier) d'un module Dossier de
  favoris vers un autre pour le déplacer réellement entre dossiers
  (`chrome.bookmarks.move`) — les modules restent interactifs pendant le
  mode plan pour permettre ce glisser
- Clic droit sur un favori : menu contextuel « Renommer le favori » /
  « Voir les détails » (titre, lien complet, date d'ajout, copier le lien)
- Module « Dossier à onglets » : plusieurs dossiers de favoris regroupés
  dans un seul module, avec des onglets pour basculer entre eux (même
  glisser-déposer, alias local et clic droit que le module Dossier de favoris)
- Mode plan : le glisser d'un favori dépose maintenant précisément entre
  deux éléments (indicateur visuel du voisin ciblé), pour réordonner un
  dossier facilement — plus seulement le déplacer à la fin
- Numéro de version + lien « Changelog » discrets dans la cartouche : ouvre
  ce même journal des versions dans une fenêtre, sans quitter le tableau
  de bord

### Corrigé
- `docs/apercu.html` (aperçu GitHub Pages) : les imports JS écrits sur
  plusieurs lignes n'étaient pas retirés à la génération, ce qui cassait la
  page en silence (erreur de syntaxe). `scripts/build-preview.py` corrigé.

### Modifié
- La logique d'affichage d'un dossier de favoris (tuiles/liste/pastilles,
  glisser, alias, clic droit) est factorisée dans `js/bmview.js`, réutilisée
  par les modules Dossier de favoris et Dossier à onglets
- `CHANGELOG.md` est maintenant embarqué dans le paquet (`scripts/build.sh`) :
  c'est lui qui alimente la fenêtre Changelog, aucun doublon à maintenir

## [1.0.0] — 2026-08-19

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

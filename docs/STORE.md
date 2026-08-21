# Fiche Chrome Web Store — à copier-coller

## Avant le premier envoi

- [ ] Compte développeur créé, frais de 5 $ US payés (une fois, à vie)
- [ ] **Validation en deux étapes activée** sur le compte Google — sans ça, aucun envoi n'est possible
- [ ] Adresse courriel de contact vérifiée
- [ ] Déclaration **Trader / Non-trader** remplie (voir plus bas)
- [ ] Politique de confidentialité en ligne à une URL publique (`docs/PRIVACY.md` publié sur GitHub Pages fait l'affaire)
- [ ] Icône 128×128 ✔ (`assets/icon128.png`)
- [ ] Au moins **une capture d'écran** en 1280×800 ou 640×400
- [ ] Nom vérifié comme non déjà pris sur le store

## Trader ou non-trader

Le Digital Services Act européen oblige tous les développeurs à se déclarer.
Publier sous une entreprise = **trader**, ce qui rend publics sur la fiche :
nom légal, adresse physique et numéro de téléphone. Publier à titre personnel
sur un projet gratuit = **non-trader**, et rien de tout ça n'est affiché.

C'est une décision à prendre avant l'envoi : le passage non-trader → trader
déclenche une vérification d'identité supplémentaire.

## Métadonnées

**Nom** (45 car. max)
```
Atelier — tableau de bord de favoris
```

**Description courte** (132 car. max)
```
Transforme le nouvel onglet en tableau de bord modulable bâti sur tes dossiers de favoris. Local, sans compte, sans pub.
```

**Catégorie** : Productivité
**Langue** : Français (Canada)

**Description longue**
```
Atelier remplace la page du nouvel onglet par une feuille de travail que tu
construis toi-même. Chaque dossier de favoris devient un module qu'on déplace
et redimensionne à la souris.

CE QUE ÇA FAIT
• Chaque dossier de favoris devient un module — tuiles, liste ou liste dense
• Navigation dans les sous-dossiers, sans quitter le tableau de bord
• Recherche instantanée dans tous les favoris (touche /), avec repli sur le
  moteur de recherche de ton choix
• Modules additionnels : horloge, bloc-notes, sites fréquents
• Mode plan : glisse pour réordonner, tire un coin pour redimensionner

ENTIÈREMENT PERSONNALISABLE
• Thème encre ou papier, couleur d'accent au choix
• Nombre de colonnes, espacement, hauteur des rangées, arrondi des coins
• Fond d'écran, densité d'affichage, taille des icônes
• Export et import de ta mise en page en JSON
• Ta mise en page se synchronise automatiquement sur tes autres appareils
  via ton compte Chrome (aucun serveur ni compte propres à Atelier)

RESPECTUEUX
• Aucun compte propre à Atelier, aucune inscription
• Aucun serveur, aucun analytique, aucune publicité
• Tout reste dans ton navigateur (ou circule via ton propre compte Chrome
  pour la synchro, jamais vers un tiers)
• Tes favoris ne sont jamais modifiés — l'extension les lit, point

Code source ouvert : <URL du dépôt>
```

## Justification des permissions

Le tableau ci-dessous répond aux champs obligatoires du formulaire
« Confidentialité » du dashboard. Une justification vague est le motif de
rejet le plus courant : sois précis sur *quelle fonctionnalité* a besoin de
*quelle* permission.

**`bookmarks`**
```
L'extension affiche le contenu des dossiers de favoris choisis par
l'utilisateur dans les modules du tableau de bord, et alimente la barre de
recherche. Lecture seule : aucun favori n'est créé, modifié ni supprimé.
```

**`storage`**
```
Enregistre localement (chrome.storage.local) la mise en page du tableau de
bord, les préférences d'affichage et le contenu du module bloc-notes. Si le
volume le permet (sous ~70 Ko), la mise en page est aussi recopiée dans
chrome.storage.sync — la synchronisation native de Chrome, liée au compte
Google de l'utilisateur — pour qu'elle apparaisse automatiquement sur ses
autres appareils connectés au même compte. Aucun serveur ni compte propres
à Atelier ; aucune donnée n'est transmise à un tiers.
```

**`favicon`**
```
Affiche l'icône de chaque site à côté du lien correspondant, via l'API
_favicon fournie par Chrome. Aucune requête réseau externe.
```

**`topSites`**
```
Alimente le module optionnel « Sites fréquents », qui affiche les sites les
plus visités selon Chrome. Utilisé uniquement quand l'utilisateur ajoute ce
module à son tableau de bord.
```

**`host_permissions` — api.open-meteo.com, geocoding-api.open-meteo.com**
```
Alimente le module optionnel « Météo » : géocodage du nom de ville saisi par
l'utilisateur, puis lecture de la température et des conditions actuelles.
Service gratuit, sans clé API, sans compte. Utilisé uniquement quand
l'utilisateur ajoute ce module et saisit une ville — c'est la seule requête
réseau de toute l'extension. Aucune autre donnée que le nom de la ville
n'est transmise ; aucun favori, aucun historique, aucune donnée de
navigation.
```

**Utilisation à distance du code**
```
Aucune. Tout le JavaScript est empaqueté dans l'extension. Aucun script
distant, aucun eval, aucun CDN. Le module Météo (optionnel) fait un appel
réseau vers Open-Meteo pour récupérer des données météo — pas du code.
```

**Objectif unique**
```
Remplacer la page du nouvel onglet par un tableau de bord de favoris
personnalisable.
```

**Collecte de données** : cocher *ne collecte aucune donnée utilisateur*, et
les trois attestations de conformité en bas du formulaire. Nuances à ajouter
dans le texte libre si le formulaire le permet :
- le module optionnel Météo transmet le nom de ville saisi à Open-Meteo
  (tiers) pour obtenir la prévision ;
- la mise en page du tableau de bord peut être recopiée via
  chrome.storage.sync (la synchronisation native de Chrome) pour apparaître
  sur les autres appareils de l'utilisateur — géré entièrement par
  l'infrastructure Chrome/Google, aucun serveur Atelier.

Rien n'est collecté ou stocké par Atelier lui-même au-delà des préférences
locales de l'utilisateur.

## Après l'envoi

La révision prend habituellement de quelques jours à une semaine. Une
extension qui remplace le nouvel onglet et lit les favoris attire un examen
plus attentif que la moyenne — attends-toi à un délai dans le haut de la
fourchette pour la première soumission.

**Astuce** : la visibilité **Non répertoriée** publie l'extension sans
l'afficher dans les résultats de recherche du store. Elle s'installe par lien
direct et reçoit quand même les mises à jour automatiques. Parfait pour un
usage perso ou pour la faire tester par des clients avant de la rendre
publique.

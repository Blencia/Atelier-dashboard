# Atelier — tableau de bord de favoris

Remplace le nouvel onglet de Chrome par une feuille de plan modulable : chaque
dossier de favoris devient un module qu'on déplace et redimensionne.

[![build](https://img.shields.io/badge/build-passing-e3a008)](.github/workflows/build.yml)
[![licence](https://img.shields.io/badge/licence-MIT-e3a008)](LICENSE)

**[Voir l'aperçu →](docs/apercu.html)** (l'extension complète dans un seul
fichier, avec des favoris fictifs — ouvre-le dans n'importe quel navigateur)

## Développer

```bash
git clone <url-du-dépôt> atelier
cd atelier
```

Puis `chrome://extensions` → Mode développeur → **Charger l'extension non
empaquetée** → choisis le dossier du dépôt. C'est tout : pas de build, pas de
`npm install`.

Boucle d'itération :

| Ce que tu changes | Ce que tu fais |
|---|---|
| CSS, JS, HTML | Recharge l'onglet (`Ctrl+R`) |
| `manifest.json` | Bouton ↻ sur `chrome://extensions`, puis recharge l'onglet |

```bash
scripts/build.sh          # vérifie tout et produit dist/atelier-X.Y.Z.zip
scripts/build-preview.py  # régénère docs/apercu.html
scripts/release.sh 0.2.0  # bump + changelog + commit + tag + build
```

## Installer sans le store

1. `chrome://extensions`
2. Active **Mode développeur** (coin haut droit)
3. **Charger l'extension non empaquetée** → choisis le dossier `atelier/`
4. Ouvre un nouvel onglet. Chrome demande de confirmer le changement de page d'accueil.

Rien ne sort de la machine : aucune requête réseau, aucun compte.

## Utiliser

| Geste | Effet |
|---|---|
| `/` ou `Ctrl/Cmd + K` | Recherche dans les favoris |
| `Alt + 1`…`9` | Saute au module à cette position sur la feuille active |
| `E` | Bascule le **mode plan** |
| `Échap` | Sort du mode plan |
| Glisser l'en-tête d'un module | Le déplacer |
| Tirer le coin bas-droit | Le redimensionner |
| ⚙ dans l'en-tête | Réglages du module (dimensions, couleur, options propres au module) |
| ✎ au survol d'un favori | Renomme l'affichage localement (le favori Chrome n'est pas touché) |
| Glisser un favori vers un autre module | Le classe virtuellement là (voir « Organisation locale » plus bas) |

En mode plan, la feuille révèle le papier millimétré, la règle de colonnes et les
dimensions de chaque module (`4×2` = 4 colonnes sur 2 rangées).

### Recherche par préfixe

Tape `g:`, `yt:`, `gh:`, `wiki:`, `maps:`, `img:` ou `ddg:` suivi de ta requête
pour sauter direct sur ce moteur (ex. `yt: chats` ouvre YouTube), sans passer
par la recherche de favoris.

### Onglets

Plusieurs feuilles indépendantes (ex. « Principal », « Streaming »), chacune
avec ses propres modules et, si tu veux, son propre thème/accent. Barre
d'onglets sous la cartouche : `+` pour en créer un, ⚙ sur l'onglet actif pour
le renommer, personnaliser son thème, ou le supprimer (le dernier onglet
restant ne peut pas être supprimé).

## Architecture

```
manifest.json          MV3, override du newtab
newtab.html            structure : cartouche + onglets + feuille
css/app.css            tout le thème via variables CSS
js/store.js            config dans chrome.storage.local + pubsub, plusieurs dashboards
js/registry.js         registre des types de modules
js/ui.js               helpers DOM, favicons, arbre des favoris, modale
js/settings.js         formulaires générés à partir d'un schéma
js/app.js              thème, rendu, drag, resize, onglets, recherche, raccourcis
js/bmview.js            navigateur de dossier partagé : tuiles/liste/pastilles,
                        glisser entre modules, alias, clic droit — utilisé par
                        Dossier de favoris et Dossier à onglets
js/widgets/bookmarks.js    dossier de favoris (tuiles/liste/pastilles), alias local
js/widgets/foldertabs.js   plusieurs dossiers dans un seul module, avec onglets
js/widgets/misc.js       horloge (+ second fuseau), bloc-notes, sites fréquents, compte à rebours
js/widgets/googletools.js  raccourcis vers les outils Google
js/widgets/folder.js       dossier compact façon écran d'accueil, grille en modale
js/widgets/weather.js      météo (Open-Meteo, seul module avec appel réseau)
```

## Ajouter un module

Crée `js/widgets/meteo.js` :

```js
import { defineWidget } from '../registry.js';
import { el, clear } from '../ui.js';

defineWidget({
  type: 'meteo',                       // identifiant stable, stocké dans la config
  name: 'Météo',
  blurb: 'Température du jour.',
  defaultSize: { w: 3, h: 1 },
  defaults: { ville: 'Saint-Hippolyte' },
  fields: [
    { key: 'ville', label: 'Ville', type: 'text' },
  ],
  title: (w) => w.settings.ville,
  mount(body, ctx) {
    clear(body);
    body.append(el('p', { text: ctx.settings.ville }));
    return () => {};                   // nettoyage optionnel (timers, listeners)
  },
});
```

Puis une ligne dans `js/app.js` :

```js
import './widgets/meteo.js';
```

Le module apparaît dans « Ajouter un module » et son formulaire de réglages est
généré tout seul.

### Types de champs disponibles

`text` · `number` · `boolean` · `select` (avec `options: [[valeur, libellé]]`) ·
`range` (`min`, `max`, `step`) · `color` · `folder` (sélecteur de dossier de favoris)

Options communes : `hint` (texte d'aide), `when: (settings) => bool` (champ
conditionnel), `gates: true` (ce champ pilote l'affichage d'autres champs et
force le re-rendu du formulaire).

## Organisation locale vs. vrais favoris

Atelier et Chrome sont deux entités séparées : le **contenu** (existence,
titre, lien d'un favori) est toujours lu en direct depuis `chrome.bookmarks`
— rien de local ne s'en écarte, ajoute/renomme/supprime dans Chrome et ça se
reflète ici. Mais l'**organisation** que tu construis dans Atelier (l'ordre
dans un module, le fait qu'un favori apparaisse dans tel module plutôt que
tel autre après un glisser-déposer) est stockée à part
(`store.data.folderOrder`, `store.data.folderOverride`) et n'est **jamais**
écrite dans tes vrais favoris Chrome. Aucun `chrome.bookmarks.move` /
`create` / `remove` / `update` nulle part dans le code — vérifiable avec
`grep -rn "bookmarks\.\(move\|create\|remove\|update\)" js/`.

Concrètement : glisser un favori vers un autre module en mode plan le
« classe » virtuellement là — un petit point apparaît au survol pour le
signaler, et le clic droit propose « ↩ Remettre à sa place réelle » pour
annuler. Réordonner (tri « Ordre local ») ne touche jamais l'ordre réel dans
Chrome non plus.

## Sauvegarde

Réglages → Données → **Exporter** produit un `.json` avec toute la mise en page.
À l'import sur une autre machine, les IDs de dossiers ne correspondent pas :
chaque module de favoris se répare tout seul en retrouvant le dossier par son
chemin (`Barre de favoris / Dev / Docs`). L'ordre local et le classement
virtuel (`folderOrder`/`folderOverride`) voyagent aussi dans l'export, mais
comme ils sont indexés par ID de favori, ils ne se répareront pas tout seuls
sur un profil où les favoris ont été recréés avec de nouveaux IDs.

## Publier

- `docs/STORE.md` — texte de la fiche, justification de chaque permission, checklist
- `docs/privacy.html` — politique de confidentialité, servie par GitHub Pages
- `docs/index.html` — page d'accueil publique avec le lien vers l'aperçu

GitHub Pages : Settings → Pages → source `main` / dossier `/docs`. Pas de
Jekyll (`.nojekyll`), parce qu'un `_config.yml` empêcherait Chrome de charger
l'extension non empaquetée.

`scripts/release.sh X.Y.Z` bumpe, tague et empaquette. Pousse le tag et le
workflow GitHub crée la release — et envoie au Chrome Web Store si les secrets
`CWS_*` sont configurés dans le dépôt.

⚠ Ne committe jamais le `.pem` : c'est la clé qui fixe l'ID de ton extension.
Le `.gitignore` l'exclut déjà.

## Licence

MIT — voir [LICENSE](LICENSE).

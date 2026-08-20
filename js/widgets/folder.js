import { defineWidget } from '../registry.js';
import { findFolderByPath } from '../ui.js';
import { mountFolderBrowser, virtualFolderId } from '../bmview.js';

/* Widget unique pour un dossier de favoris (réel ou virtuel) : Tuiles /
   Icônes seules / Liste / Liste dense / Pastilles, toujours affiché sur la
   feuille. Peut rester entièrement virtuel — laisse le dossier vide et
   remplis-le à la main par glisser-déposer (panneau latéral ou clic droit
   → nouveau sous-dossier, voir bmview.js). Un sous-dossier créé ainsi
   s'affiche toujours en icône compacte façon écran d'accueil de téléphone,
   qui s'ouvre en fenêtre au clic — ce n'est plus un réglage du widget
   lui-même, seulement le rendu inhérent des sous-dossiers faits main.

   Le type "bookmarks" reste enregistré (caché du sélecteur "Ajouter un
   module", voir hidden ci-dessous) uniquement pour que les modules créés
   avant la fusion des deux anciens widgets continuent de fonctionner tels
   quels, sans migration de données. Un widget déjà réglé sur l'ancienne vue
   "app" (Icône compacte, retirée du sélecteur) continue aussi de fonctionner
   telle quelle — voir le rendu `s.view === 'app'` dans bmview.js. */

const shared = {
  name: 'Dossier',
  category: 'principal',
  blurb: 'Un dossier de favoris — tuiles, icônes, liste ou pastilles. Clic droit dedans pour créer des sous-dossiers façon écran d\'accueil de téléphone. Peut rester virtuel, rempli à la main.',
  defaultSize: { w: 4, h: 2 },
  defaults: {
    folderId: null,
    folderPath: '',
    label: '',
    view: 'tiles',
    tile: 76,
    icon: 26,
    limit: 0,
    openIn: 'current',
    sort: 'manual',
    showCrumbs: true,
    wrapped: false,
  },
  fields: [
    {
      key: 'folderId', label: 'Dossier', type: 'folder',
      hint: 'Optionnel — laisse vide pour un dossier virtuel que tu remplis toi-même par glisser-déposer, sans toucher à un vrai dossier Chrome.',
    },
    { key: 'label', label: 'Titre (vide = nom du dossier)', type: 'text' },
    {
      key: 'view', label: 'Affichage', type: 'select', gates: true,
      options: [
        ['tiles', 'Tuiles'], ['icons', 'Icônes seules'], ['list', 'Liste'],
        ['compact', 'Liste dense'], ['badges', 'Pastilles'],
      ],
      hint: 'Les sous-dossiers créés par clic droit s\'affichent toujours en icône compacte, quel que soit ce réglage.',
    },
    { key: 'tile', label: 'Largeur des tuiles', type: 'range', min: 56, max: 140, step: 4, when: (s) => s.view === 'tiles' || s.view === 'icons' },
    {
      key: 'icon', label: 'Taille des icônes', type: 'range', min: 16, max: 44, step: 2,
      when: (s) => s.view === 'tiles' || s.view === 'icons' || s.view === 'badges',
    },
    {
      key: 'sort', label: 'Tri', type: 'select',
      options: [['manual', 'Ordre local (glisser-déposer)'], ['alpha', 'Alphabétique'], ['recent', 'Ajout récent']],
      hint: 'L\'ordre local est propre à Atelier — il ne change jamais l\'ordre réel dans Chrome.',
    },
    { key: 'limit', label: 'Nombre max (0 = tout)', type: 'number', min: 0, max: 200 },
    {
      key: 'openIn', label: 'Ouvrir les liens', type: 'select',
      options: [['current', 'Dans cet onglet'], ['new', 'Dans un nouvel onglet']],
    },
    { key: 'showCrumbs', label: 'Afficher le fil d\'Ariane', type: 'boolean' },
    {
      key: 'wrapped', label: 'Design wrappé (contour collé aux pastilles)', type: 'boolean',
      when: (s) => s.view === 'badges',
      hint: 'Réduit la marge du module au minimum pour qu\'il prenne le moins de place possible autour des pastilles.',
    },
  ],

  title(w) {
    return w.settings.label || w.settings.folderPath?.split(' / ').pop() || 'Dossier';
  },

  mount(body, ctx) {
    const s = ctx.settings;
    body.classList.toggle('is-wrapped', s.view === 'badges' && !!s.wrapped);

    async function resolveRoot() {
      if (s.folderId) {
        try {
          const [node] = await chrome.bookmarks.get(String(s.folderId));
          if (node) return node.id;
        } catch { /* id mort : on tente le chemin */ }
      }
      if (s.folderPath) {
        const found = await findFolderByPath(s.folderPath);
        if (found) {
          ctx.update({ folderId: found.id });   // auto-réparation après import
          return found.id;
        }
      }
      // Aucun dossier Chrome assigné : ce module devient un dossier virtuel,
      // un simple bac qu'on remplit par glisser-déposer (panneau latéral,
      // un autre module, ou clic droit → nouveau sous-dossier).
      return virtualFolderId(ctx.widget.id);
    }

    const browser = mountFolderBrowser(body, {
      resolveRoot, settings: s,
      persistSettings: (patch) => ctx.update(patch, { silent: true }),
    });
    return () => browser.stop();
  },
};

defineWidget({ ...shared, type: 'folder' });
defineWidget({ ...shared, type: 'bookmarks', hidden: true });

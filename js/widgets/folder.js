import { defineWidget } from '../registry.js';
import { findFolderByPath } from '../ui.js';
import { mountFolderBrowser, virtualFolderId } from '../bmview.js';

/* Widget unique pour un dossier de favoris (réel ou virtuel) : Tuiles /
   Icônes seules / Liste / Liste dense / Pastilles pour un affichage
   toujours visible sur la feuille, ou Icône compacte pour un aperçu façon
   écran d'accueil de téléphone qui s'ouvre en fenêtre au clic. Peut aussi
   rester entièrement virtuel — laisse le dossier vide et remplis-le à la
   main par glisser-déposer (panneau latéral ou clic droit → nouveau
   sous-dossier, voir bmview.js).

   Le type "bookmarks" reste enregistré (caché du sélecteur "Ajouter un
   module", voir hidden ci-dessous) uniquement pour que les modules créés
   avant la fusion des deux anciens widgets continuent de fonctionner tels
   quels, sans migration de données. */

const shared = {
  name: 'Dossier',
  blurb: 'Un dossier de favoris — tuiles, liste, ou icône compacte qui s\'ouvre en fenêtre. Peut rester virtuel, rempli à la main.',
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
        ['app', 'Icône compacte (ouvre une fenêtre)'],
      ],
    },
    { key: 'tile', label: 'Largeur des tuiles', type: 'range', min: 56, max: 140, step: 4, when: (s) => s.view === 'tiles' || s.view === 'icons' },
    {
      key: 'icon', label: 'Taille des icônes', type: 'range', min: 16, max: 44, step: 2,
      when: (s) => s.view === 'tiles' || s.view === 'icons' || s.view === 'badges' || s.view === 'app',
    },
    {
      key: 'sort', label: 'Tri', type: 'select', when: (s) => s.view !== 'app',
      options: [['manual', 'Ordre local (glisser-déposer)'], ['alpha', 'Alphabétique'], ['recent', 'Ajout récent']],
      hint: 'L\'ordre local est propre à Atelier — il ne change jamais l\'ordre réel dans Chrome.',
    },
    { key: 'limit', label: 'Nombre max (0 = tout)', type: 'number', min: 0, max: 200, when: (s) => s.view !== 'app' },
    {
      key: 'openIn', label: 'Ouvrir les liens', type: 'select',
      options: [['current', 'Dans cet onglet'], ['new', 'Dans un nouvel onglet']],
    },
    { key: 'showCrumbs', label: 'Afficher le fil d\'Ariane', type: 'boolean', when: (s) => s.view !== 'app' },
  ],

  title(w) {
    return w.settings.label || w.settings.folderPath?.split(' / ').pop() || 'Dossier';
  },

  mount(body, ctx) {
    const s = ctx.settings;

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

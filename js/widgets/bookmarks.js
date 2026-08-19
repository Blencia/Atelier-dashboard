import { defineWidget } from '../registry.js';
import { findFolderByPath } from '../ui.js';
import { mountFolderBrowser } from '../bmview.js';

defineWidget({
  type: 'bookmarks',
  name: 'Dossier de favoris',
  blurb: 'Affiche un dossier, avec navigation dans les sous-dossiers.',
  defaultSize: { w: 4, h: 2 },
  defaults: {
    folderId: null,
    folderPath: '',
    view: 'tiles',
    tile: 76,
    icon: 26,
    limit: 0,
    openIn: 'current',
    sort: 'manual',
    showCrumbs: true,
  },
  fields: [
    { key: 'folderId', label: 'Dossier', type: 'folder' },
    {
      key: 'view', label: 'Affichage', type: 'select', gates: true,
      options: [['tiles', 'Tuiles'], ['list', 'Liste'], ['compact', 'Liste dense'], ['badges', 'Pastilles']],
    },
    { key: 'tile', label: 'Largeur des tuiles', type: 'range', min: 56, max: 140, step: 4, when: (s) => s.view === 'tiles' },
    { key: 'icon', label: 'Taille des icônes', type: 'range', min: 16, max: 44, step: 2, when: (s) => s.view === 'tiles' || s.view === 'badges' },
    {
      key: 'sort', label: 'Tri', type: 'select',
      options: [['manual', 'Ordre du dossier'], ['alpha', 'Alphabétique'], ['recent', 'Ajout récent']],
    },
    { key: 'limit', label: 'Nombre max (0 = tout)', type: 'number', min: 0, max: 200 },
    {
      key: 'openIn', label: 'Ouvrir les liens', type: 'select',
      options: [['current', 'Dans cet onglet'], ['new', 'Dans un nouvel onglet']],
    },
    { key: 'showCrumbs', label: 'Afficher le fil d\'Ariane', type: 'boolean' },
  ],

  title(w) {
    return w.settings.folderPath?.split(' / ').pop() || 'Favoris';
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
      return null;
    }

    const browser = mountFolderBrowser(body, { resolveRoot, settings: s });
    return () => browser.stop();
  },
});

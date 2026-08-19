import { defineWidget } from '../registry.js';
import { el, clear, findFolderByPath } from '../ui.js';
import { mountFolderBrowser } from '../bmview.js';

defineWidget({
  type: 'foldertabs',
  name: 'Dossier à onglets',
  blurb: 'Plusieurs dossiers de favoris dans un seul module, avec des onglets pour basculer.',
  defaultSize: { w: 4, h: 3 },
  defaults: {
    tabs: [],
    active: 0,
    view: 'tiles',
    tile: 76,
    icon: 26,
    limit: 0,
    openIn: 'current',
    sort: 'manual',
  },
  fields: [
    {
      key: 'tabs', label: 'Onglets', type: 'folderList',
      hint: 'Chaque onglet affiche un dossier de favoris différent.',
    },
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
  ],

  title(w) {
    const tabs = Array.isArray(w.settings.tabs) ? w.settings.tabs : [];
    const active = tabs[w.settings.active];
    return active ? (active.label || active.folderPath?.split(' / ').pop() || 'Sans nom') : 'Dossier à onglets';
  },

  mount(body, ctx) {
    const s = ctx.settings;
    const tabs = Array.isArray(s.tabs) ? s.tabs : (s.tabs = []);

    clear(body);
    if (!tabs.length) {
      body.append(el('p', { class: 'note', text: 'Aucun onglet configuré. Ouvre les réglages du module.' }));
      return () => {};
    }

    let activeIdx = Math.min(Math.max(s.active || 0, 0), tabs.length - 1);

    const nav = el('nav', { class: 'foldertabs-nav' });
    const content = el('div', { class: 'foldertabs-content' });
    body.append(nav, content);

    function renderNav() {
      clear(nav);
      tabs.forEach((tab, i) => {
        nav.append(el('button', {
          class: `foldertabs-tab${i === activeIdx ? ' is-active' : ''}`,
          type: 'button',
          text: tab.label || tab.folderPath?.split(' / ').pop() || 'Sans nom',
          onclick: () => {
            if (i === activeIdx) return;
            activeIdx = i;
            renderNav();
            browser.resetStack();
            browser.render();
            ctx.update({ active: activeIdx }, { silent: true });
          },
        }));
      });
    }
    renderNav();

    async function resolveRoot() {
      const tab = tabs[activeIdx];
      if (!tab) return null;
      if (tab.folderId) {
        try {
          const [node] = await chrome.bookmarks.get(String(tab.folderId));
          if (node) return node.id;
        } catch { /* id mort : on tente le chemin */ }
      }
      if (tab.folderPath) {
        const found = await findFolderByPath(tab.folderPath);
        if (found) {
          tab.folderId = found.id;               // auto-réparation en mémoire
          ctx.update({ tabs }, { silent: true });
          return found.id;
        }
      }
      return null;
    }

    const browser = mountFolderBrowser(content, { resolveRoot, settings: s });
    return () => browser.stop();
  },
});

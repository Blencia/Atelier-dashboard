import { defineWidget } from '../registry.js';
import { el, clear, faviconUrl, hostOf, initial, openLink, findFolderByPath } from '../ui.js';

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
      options: [['tiles', 'Tuiles'], ['list', 'Liste'], ['compact', 'Liste dense']],
    },
    { key: 'tile', label: 'Largeur des tuiles', type: 'range', min: 56, max: 140, step: 4, when: (s) => s.view === 'tiles' },
    { key: 'icon', label: 'Taille des icônes', type: 'range', min: 16, max: 44, step: 2, when: (s) => s.view === 'tiles' },
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
    let stack = [];          // navigation interne, non persistée
    let alive = true;

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

    async function render() {
      if (!alive) return;
      clear(body);

      const rootId = await resolveRoot();
      if (!rootId) {
        body.append(el('p', {
          class: 'note',
          text: s.folderId || s.folderPath
            ? 'Dossier introuvable. Choisis-en un autre dans les réglages du module.'
            : 'Aucun dossier choisi. Ouvre les réglages du module.',
        }));
        return;
      }

      const currentId = stack.length ? stack[stack.length - 1].id : rootId;
      let children;
      try {
        children = await chrome.bookmarks.getChildren(currentId);
      } catch {
        body.append(el('p', { class: 'note', text: 'Lecture du dossier impossible.' }));
        return;
      }

      if (s.showCrumbs && stack.length) {
        const crumbs = el('nav', { class: 'bm-crumbs' });
        crumbs.append(el('button', {
          type: 'button', text: '← racine',
          onclick: () => { stack = []; render(); },
        }));
        stack.forEach((node, i) => {
          crumbs.append(el('span', { text: '/' }));
          crumbs.append(el('button', {
            type: 'button', text: node.title || '(sans nom)',
            onclick: () => { stack = stack.slice(0, i + 1); render(); },
          }));
        });
        body.append(crumbs);
      }

      let items = children.slice();
      if (s.sort === 'alpha') {
        items.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'fr'));
      } else if (s.sort === 'recent') {
        items.sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0));
      }
      // Les dossiers d'abord, toujours.
      items.sort((a, b) => (!!a.url) - (!!b.url));
      if (s.limit > 0) items = items.slice(0, s.limit);

      if (!items.length) {
        body.append(el('p', { class: 'note', text: 'Dossier vide.' }));
        return;
      }

      const tiles = s.view === 'tiles';
      const wrap = el('div', {
        class: tiles ? 'bm-tiles' : `bm-list${s.view === 'compact' ? ' is-dense' : ''}`,
      });
      if (tiles) {
        wrap.style.setProperty('--tile', `${s.tile}px`);
        wrap.style.setProperty('--icon', `${s.icon}px`);
      }

      for (const node of items) {
        wrap.append(node.url ? linkNode(node, tiles) : folderNode(node, tiles));
      }
      body.append(wrap);
    }

    function iconFor(node, tiles) {
      if (!node.url) {
        return el('span', { class: 'glyph', text: '▸' });
      }
      const img = el('img', {
        src: faviconUrl(node.url, tiles ? Math.max(32, s.icon * 2) : 32),
        alt: '', loading: 'lazy',
      });
      img.addEventListener('error', () => {
        img.replaceWith(el('span', { class: 'glyph', text: initial(node.title, node.url) }));
      });
      return img;
    }

    function linkNode(node, tiles) {
      // textContent partout : un titre de favori peut contenir du HTML.
      const label = node.title || hostOf(node.url);
      const a = el('a', {
        class: tiles ? 'tile' : 'row',
        href: node.url,
        title: `${label}\n${node.url}`,
        onclick: (e) => openLink(node.url, s.openIn, e),
        onauxclick: (e) => openLink(node.url, s.openIn, e),
      });
      a.append(iconFor(node, tiles));
      a.append(el('span', { class: 'label', text: label }));
      if (!tiles) a.append(el('span', { class: 'host', text: hostOf(node.url) }));
      return a;
    }

    function folderNode(node, tiles) {
      const b = el('button', {
        class: tiles ? 'tile' : 'row',
        type: 'button',
        title: node.title,
        style: { background: 'none', border: 0, cursor: 'pointer', font: 'inherit', width: '100%' },
        onclick: () => { stack.push(node); render(); },
      });
      b.append(el('span', { class: 'glyph', text: '▸' }));
      b.append(el('span', { class: 'label', text: node.title || '(sans nom)' }));
      return b;
    }

    // Rafraîchit quand les favoris changent ailleurs dans Chrome.
    const refresh = () => render();
    chrome.bookmarks.onCreated.addListener(refresh);
    chrome.bookmarks.onRemoved.addListener(refresh);
    chrome.bookmarks.onChanged.addListener(refresh);
    chrome.bookmarks.onMoved.addListener(refresh);

    render();

    return () => {
      alive = false;
      chrome.bookmarks.onCreated.removeListener(refresh);
      chrome.bookmarks.onRemoved.removeListener(refresh);
      chrome.bookmarks.onChanged.removeListener(refresh);
      chrome.bookmarks.onMoved.removeListener(refresh);
    };
  },
});

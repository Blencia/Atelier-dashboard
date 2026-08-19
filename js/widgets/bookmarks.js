import { defineWidget } from '../registry.js';
import { store } from '../store.js';
import { el, clear, faviconUrl, hostOf, initial, openLink, findFolderByPath, openModal, toast } from '../ui.js';

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
      const badges = s.view === 'badges';
      const wrap = el('div', {
        class: badges ? 'bm-badges' : tiles ? 'bm-tiles' : `bm-list${s.view === 'compact' ? ' is-dense' : ''}`,
      });
      if (tiles) {
        wrap.style.setProperty('--tile', `${s.tile}px`);
        wrap.style.setProperty('--icon', `${s.icon}px`);
      } else if (badges) {
        wrap.style.setProperty('--icon', `${s.icon}px`);
      }

      for (const node of items) {
        wrap.append(node.url ? linkNode(node, tiles, badges) : folderNode(node, tiles, badges));
      }
      body.append(wrap);
    }

    function iconFor(node, size) {
      if (!node.url) {
        return el('span', { class: 'glyph', text: '▸' });
      }
      const img = el('img', {
        src: faviconUrl(node.url, size ? Math.max(32, s.icon * 2) : 32),
        alt: '', loading: 'lazy',
      });
      img.addEventListener('error', () => {
        img.replaceWith(el('span', { class: 'glyph', text: initial(node.title, node.url) }));
      });
      return img;
    }

    /** Renomme localement un favori — n'écrit jamais dans les vrais favoris Chrome. */
    function renameNode(node) {
      const current = store.data.aliases[node.id] || '';
      const input = el('input', { type: 'text', value: current, placeholder: node.title || hostOf(node.url) });
      const body2 = el('div', { class: 'field' }, [
        el('label', { text: 'Nom affiché (local à Atelier, le favori n\'est pas modifié)' }), input,
      ]);
      const commit = async (value) => {
        await store.setAlias(node.id, value);
        close();
        render();
        toast(value ? 'Nom mis à jour' : 'Nom réinitialisé');
      };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') commit(input.value); });
      const footer = el('div', { style: { display: 'flex', gap: '8px', width: '100%' } }, [
        current ? el('button', { class: 'btn', type: 'button', text: 'Réinitialiser', onclick: () => commit('') }) : null,
        el('span', { style: { flex: '1' } }),
        el('button', { class: 'btn btn-primary', type: 'button', text: 'Enregistrer', onclick: () => commit(input.value) }),
      ]);
      const close = openModal({ title: 'Renommer ce favori', body: body2, footer });
    }

    function linkNode(node, tiles, badges) {
      // textContent partout : un titre de favori peut contenir du HTML.
      const alias = store.data.aliases[node.id];
      const label = alias || node.title || hostOf(node.url);
      const a = el('a', {
        class: badges ? 'badge' : tiles ? 'tile' : 'row',
        href: node.url,
        title: `${label}\n${node.url}`,
        onclick: (e) => openLink(node.url, s.openIn, e),
        onauxclick: (e) => openLink(node.url, s.openIn, e),
      });
      a.append(iconFor(node, tiles || badges));
      if (!badges) {
        a.append(el('span', { class: 'label', text: label }));
        a.append(el('button', {
          class: 'bm-rename', type: 'button', title: 'Renommer (local)', text: '✎',
          onclick: (e) => { e.preventDefault(); e.stopPropagation(); renameNode(node); },
        }));
      }
      if (!tiles && !badges) a.append(el('span', { class: 'host', text: hostOf(node.url) }));
      return a;
    }

    function folderNode(node, tiles, badges) {
      const b = el('button', {
        class: badges ? 'badge' : tiles ? 'tile' : 'row',
        type: 'button',
        title: node.title,
        style: { background: 'none', border: 0, cursor: 'pointer', font: 'inherit', width: '100%' },
        onclick: () => { stack.push(node); render(); },
      });
      b.append(el('span', { class: 'glyph', text: '▸' }));
      if (!badges) b.append(el('span', { class: 'label', text: node.title || '(sans nom)' }));
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

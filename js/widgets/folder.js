import { defineWidget } from '../registry.js';
import { el, clear, faviconUrl, hostOf, initial, openLink, findFolderByPath, openModal } from '../ui.js';

/* Petit widget « dossier » façon écran d'accueil de téléphone : un aperçu
   réduit sur la feuille, qui s'ouvre en grille plein écran au clic. */

defineWidget({
  type: 'folder',
  name: 'Dossier',
  blurb: 'Aperçu compact d\'un dossier de favoris — s\'ouvre en grille au clic.',
  defaultSize: { w: 2, h: 1 },
  defaults: { folderId: null, folderPath: '', label: '' },
  fields: [
    { key: 'folderId', label: 'Dossier', type: 'folder' },
    { key: 'label', label: 'Titre (vide = nom du dossier)', type: 'text' },
  ],

  title(w) {
    return w.settings.label || w.settings.folderPath?.split(' / ').pop() || 'Dossier';
  },

  mount(body, ctx) {
    const s = ctx.settings;
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
          ctx.update({ folderId: found.id });
          return found.id;
        }
      }
      return null;
    }

    function thumb(node) {
      if (!node.url) return el('span', { class: 'glyph', text: '▸' });
      const img = el('img', { src: faviconUrl(node.url, 32), alt: '', loading: 'lazy' });
      img.addEventListener('error', () => {
        img.replaceWith(el('span', { class: 'glyph', text: initial(node.title, node.url) }));
      });
      return img;
    }

    async function render() {
      if (!alive) return;
      clear(body);

      const rootId = await resolveRoot();
      if (!rootId) {
        body.append(el('p', { class: 'note', text: 'Aucun dossier choisi. Ouvre les réglages du module.' }));
        return;
      }

      let children = [];
      try { children = await chrome.bookmarks.getChildren(rootId); } catch { /* dossier introuvable */ }

      const name = s.label || s.folderPath?.split(' / ').pop() || 'Dossier';
      const preview = el('div', { class: 'folder-preview' });
      children.slice(0, 4).forEach((n) => preview.append(thumb(n)));
      for (let i = children.length; i < 4; i++) preview.append(el('span', { class: 'folder-slot-empty' }));

      body.append(el('button', {
        class: 'folder-open', type: 'button', title: name,
        onclick: () => openFolderModal(rootId, name),
      }, [preview, el('span', { class: 'folder-name', text: name })]));
    }

    render();
    const refresh = () => render();
    for (const ev of ['onCreated', 'onRemoved', 'onChanged', 'onMoved']) {
      chrome.bookmarks[ev].addListener(refresh);
    }

    return () => {
      alive = false;
      for (const ev of ['onCreated', 'onRemoved', 'onChanged', 'onMoved']) {
        chrome.bookmarks[ev].removeListener(refresh);
      }
    };
  },
});

/** Grille plein écran, façon écran d'accueil, avec navigation dans les sous-dossiers. */
function openFolderModal(rootId, title) {
  let stack = [];
  const grid = el('div', { class: 'folder-grid' });
  const crumbs = el('nav', { class: 'bm-crumbs' });

  async function draw() {
    clear(grid);
    clear(crumbs);
    const currentId = stack.length ? stack[stack.length - 1].id : rootId;
    let children = [];
    try { children = await chrome.bookmarks.getChildren(currentId); } catch { /* rien */ }

    if (stack.length) {
      crumbs.append(el('button', { type: 'button', text: '← racine', onclick: () => { stack = []; draw(); } }));
      stack.forEach((node, i) => {
        crumbs.append(el('span', { text: '/' }));
        crumbs.append(el('button', {
          type: 'button', text: node.title || '(sans nom)',
          onclick: () => { stack = stack.slice(0, i + 1); draw(); },
        }));
      });
    }

    for (const node of children) {
      grid.append(node.url ? linkTile(node) : folderTile(node));
    }
    if (!children.length) grid.append(el('p', { class: 'note', text: 'Dossier vide.' }));
  }

  function linkTile(node) {
    const label = node.title || hostOf(node.url);
    const a = el('a', {
      class: 'tile', href: node.url, title: `${label}\n${node.url}`,
      onclick: (e) => openLink(node.url, 'current', e),
      onauxclick: (e) => openLink(node.url, 'current', e),
    });
    const img = el('img', { src: faviconUrl(node.url, 48), alt: '', loading: 'lazy' });
    img.addEventListener('error', () => {
      img.replaceWith(el('span', { class: 'glyph', text: initial(node.title, node.url) }));
    });
    a.append(img, el('span', { class: 'label', text: label }));
    return a;
  }

  function folderTile(node) {
    const b = el('button', {
      class: 'tile', type: 'button',
      style: { background: 'none', border: 0, cursor: 'pointer', font: 'inherit' },
      onclick: () => { stack.push(node); draw(); },
    });
    b.append(el('span', { class: 'glyph', text: '▸' }), el('span', { class: 'label', text: node.title || '(sans nom)' }));
    return b;
  }

  draw();
  openModal({ title, body: el('div', {}, [crumbs, grid]) });
}

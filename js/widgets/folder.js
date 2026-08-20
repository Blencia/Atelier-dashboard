import { defineWidget } from '../registry.js';
import { el, clear, faviconUrl, hostOf, initial, openLink, findFolderByPath, openModal, isEditing, toast } from '../ui.js';
import { DND_TYPE, classifyIntoFolder, virtualFolderId, resolveDisplayedChildren } from '../bmview.js';

/* Petit widget « dossier » façon écran d'accueil de téléphone : un aperçu
   réduit sur la feuille, qui s'ouvre en grille plein écran au clic. */

defineWidget({
  type: 'folder',
  name: 'Dossier',
  blurb: 'Aperçu compact d\'un dossier de favoris — s\'ouvre en grille au clic.',
  defaultSize: { w: 2, h: 1 },
  defaults: { folderId: null, folderPath: '', label: '' },
  fields: [
    {
      key: 'folderId', label: 'Dossier', type: 'folder',
      hint: 'Optionnel — laisse vide pour un dossier virtuel que tu remplis toi-même par glisser-déposer.',
    },
    { key: 'label', label: 'Titre (vide = nom du dossier)', type: 'text' },
  ],

  title(w) {
    return w.settings.label || w.settings.folderPath?.split(' / ').pop() || 'Dossier';
  },

  mount(body, ctx) {
    const s = ctx.settings;
    let alive = true;
    let currentRootId = null; // mis à jour par render(), lu par wireDrop() câblé une seule fois
    body.classList.add('bm-dnd'); // reste interactif en mode plan pour accepter un glisser

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
      // Aucun dossier Chrome assigné : dossier virtuel, rempli par glisser-déposer.
      return virtualFolderId(ctx.widget.id);
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
      currentRootId = rootId;
      if (!rootId) {
        body.append(el('p', { class: 'note', text: 'Aucun dossier choisi. Ouvre les réglages du module.' }));
        return;
      }

      let children = [];
      try { children = await resolveDisplayedChildren(rootId); } catch { /* dossier introuvable */ }

      const name = s.label || s.folderPath?.split(' / ').pop() || 'Dossier';
      const preview = el('div', { class: 'folder-preview' });
      children.slice(0, 4).forEach((n) => preview.append(thumb(n)));
      for (let i = children.length; i < 4; i++) preview.append(el('span', { class: 'folder-slot-empty' }));

      body.append(el('button', {
        class: 'folder-open', type: 'button', title: name,
        onclick: () => { if (!isEditing()) openFolderModal(rootId, name); },
      }, [preview, el('span', { class: 'folder-name', text: name })]));
    }

    /** Câblé une seule fois sur `body` (élément stable) — accepte un
        favori/dossier glissé depuis un autre module et le classe
        virtuellement ici (jamais un vrai chrome.bookmarks.move). */
    function wireDrop() {
      body.addEventListener('dragover', (e) => {
        if (!isEditing() || !currentRootId || !e.dataTransfer.types.includes(DND_TYPE)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        body.classList.add('bm-drop-target');
      });
      body.addEventListener('dragleave', (e) => {
        if (e.target === body) body.classList.remove('bm-drop-target');
      });
      body.addEventListener('drop', async (e) => {
        body.classList.remove('bm-drop-target');
        if (!isEditing() || !currentRootId) return;
        const bmId = e.dataTransfer.getData(DND_TYPE);
        if (!bmId) return;
        e.preventDefault();
        const ok = await classifyIntoFolder(bmId, currentRootId);
        toast(ok ? 'Classé ici — les vrais favoris Chrome ne sont pas touchés' : 'Déplacement impossible');
        if (ok) render();
      });
    }

    wireDrop();
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
    try { children = await resolveDisplayedChildren(currentId); } catch { /* rien */ }

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
    if (!children.length) {
      const text = currentId.startsWith('atelier:') && !stack.length
        ? 'Dossier virtuel, vide pour l\'instant — glisse un favori du panneau latéral (mode plan) ou d\'un autre module pour le classer ici.'
        : 'Dossier vide.';
      grid.append(el('p', { class: 'note', text }));
    }
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

import { store } from './store.js';
import {
  el, clear, faviconUrl, hostOf, initial, openLink,
  openModal, toast, isEditing, openContextMenu,
} from './ui.js';

/* Navigateur de dossier de favoris réutilisable : tuiles/liste/pastilles,
   sous-dossiers, glisser vers un autre module (chrome.bookmarks.move),
   alias local, menu clic droit (renommer/détails). Utilisé par les modules
   Dossier de favoris et Dossier à onglets — voir js/widgets/bookmarks.js et
   js/widgets/foldertabs.js. */

const DND_TYPE = 'application/x-atelier-bookmark-id';

/**
 * @param {HTMLElement} body      conteneur à remplir (vidé et rempli à chaque rendu)
 * @param {object} opts
 * @param {() => Promise<string|null>} opts.resolveRoot  id du dossier racine à afficher
 * @param {object} opts.settings  { view, tile, icon, sort, limit, openIn, showCrumbs }
 */
export function mountFolderBrowser(body, opts) {
  const { resolveRoot, settings: s } = opts;
  let stack = [];   // navigation interne, remise à zéro par resetStack()
  let alive = true;
  body.classList.add('bm-dnd');

  async function render() {
    if (!alive) return;
    clear(body);

    const rootId = await resolveRoot();
    if (!rootId) {
      body.append(el('p', { class: 'note', text: 'Aucun dossier choisi. Ouvre les réglages du module.' }));
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
    items.sort((a, b) => (!!a.url) - (!!b.url)); // dossiers d'abord, toujours
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
    wireDrop(wrap, currentId);
    body.append(wrap);
  }

  /** Le voisin le plus proche du pointeur, et si on dépose avant ou après lui. */
  function nearestSibling(wrap, x, y) {
    const nodes = [...wrap.children].filter((n) => n.dataset.bmId && !n.classList.contains('dragging-bm'));
    let best = null;
    let bestDist = Infinity;
    for (const n of nodes) {
      const r = n.getBoundingClientRect();
      const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
      if (d < bestDist) { bestDist = d; best = n; }
    }
    if (!best) return { el: null, before: false };
    const r = best.getBoundingClientRect();
    const sameRow = Math.abs(y - (r.top + r.height / 2)) < r.height / 2;
    const before = sameRow ? x < r.left + r.width / 2 : y < r.top + r.height / 2;
    return { el: best, before };
  }

  function wireDrop(wrap, targetFolderId) {
    let marked = null;
    const unmark = () => { marked?.classList.remove('bm-insert-target'); marked = null; };

    wrap.addEventListener('dragover', (e) => {
      if (!isEditing() || !e.dataTransfer.types.includes(DND_TYPE)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      wrap.classList.add('bm-drop-target');
      const { el: near } = nearestSibling(wrap, e.clientX, e.clientY);
      if (near !== marked) { unmark(); if (near) { near.classList.add('bm-insert-target'); marked = near; } }
    });
    wrap.addEventListener('dragleave', (e) => {
      if (e.target === wrap) { wrap.classList.remove('bm-drop-target'); unmark(); }
    });
    wrap.addEventListener('drop', async (e) => {
      wrap.classList.remove('bm-drop-target');
      const { el: near, before } = nearestSibling(wrap, e.clientX, e.clientY);
      unmark();
      if (!isEditing()) return;
      const bmId = e.dataTransfer.getData(DND_TYPE);
      if (!bmId) return;
      e.preventDefault();

      const dest = { parentId: targetFolderId };
      const refId = near?.dataset.bmId;
      if (refId && refId !== bmId) {
        try {
          // Index dans la vraie liste (non triée à l'affichage) du dossier —
          // Chrome ajuste lui-même le décalage si le favori vient du même dossier.
          const raw = await chrome.bookmarks.getChildren(targetFolderId);
          const refIdx = raw.findIndex((c) => c.id === refId);
          if (refIdx !== -1) dest.index = before ? refIdx : refIdx + 1;
        } catch { /* tant pis, on dépose à la fin */ }
      }

      try {
        await chrome.bookmarks.move(bmId, dest);
        toast('Favori déplacé');
      } catch {
        toast('Déplacement impossible — dossier invalide ?');
      }
    });
  }

  function iconFor(node, size) {
    if (!node.url) return el('span', { class: 'glyph', text: '▸' });
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

  /** Fiche détaillée : titre réel, lien complet, date d'ajout, copier le lien. */
  function showDetails(node) {
    const alias = store.data.aliases[node.id];
    const rows = [
      ['Titre', node.title || '(sans titre)'],
      alias ? ['Nom affiché (local)', alias] : null,
      ['Lien', node.url],
      [
        'Ajouté le',
        node.dateAdded
          ? new Intl.DateTimeFormat('fr-CA', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(node.dateAdded))
          : '—',
      ],
    ].filter(Boolean);

    const body2 = el('div', { class: 'bm-details' });
    for (const [label, value] of rows) {
      body2.append(el('div', { class: 'bm-details-row' }, [
        el('span', { class: 'bm-details-label', text: label }),
        el('span', { class: 'bm-details-value', text: value }),
      ]));
    }

    const footer = el('div', { style: { display: 'flex', gap: '8px', width: '100%' } }, [
      el('button', {
        class: 'btn', type: 'button', text: 'Copier le lien',
        onclick: async () => {
          try { await navigator.clipboard.writeText(node.url); toast('Lien copié'); }
          catch { toast('Copie impossible'); }
        },
      }),
      el('span', { style: { flex: '1' } }),
      el('a', { class: 'btn btn-primary', href: node.url, target: '_blank', rel: 'noopener', text: 'Ouvrir le lien' }),
    ]);

    openModal({ title: 'Détails du favori', body: body2, footer });
  }

  function linkNode(node, tiles, badges) {
    // textContent partout : un titre de favori peut contenir du HTML.
    const alias = store.data.aliases[node.id];
    const label = alias || node.title || hostOf(node.url);
    const a = el('a', {
      class: badges ? 'badge' : tiles ? 'tile' : 'row',
      href: node.url,
      title: `${label}\n${node.url}`,
      'data-bm-id': node.id,
      draggable: 'true', // el() ne stringifie que `true` littéral en "" — 'draggable' exige la chaîne "true"
      onclick: (e) => { if (isEditing()) return e.preventDefault(); openLink(node.url, s.openIn, e); },
      onauxclick: (e) => { if (isEditing()) return e.preventDefault(); openLink(node.url, s.openIn, e); },
      oncontextmenu: (e) => {
        e.preventDefault();
        openContextMenu(e.clientX, e.clientY, [
          { label: 'Renommer le favori', onClick: () => renameNode(node) },
          { label: 'Voir les détails', onClick: () => showDetails(node) },
        ]);
      },
      ondragstart: (e) => {
        if (!isEditing()) return e.preventDefault();
        // stopPropagation : sans ça, ce dragstart remonte jusqu'à l'article
        // .widget et déclenche AUSSI le déplacement du module entier (app.js).
        e.stopPropagation();
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData(DND_TYPE, node.id);
        a.classList.add('dragging-bm');
      },
      ondragend: (e) => { e.stopPropagation(); a.classList.remove('dragging-bm'); },
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
      'data-bm-id': node.id,
      draggable: 'true',
      onclick: () => { if (isEditing()) return; stack.push(node); render(); },
      ondragstart: (e) => {
        if (!isEditing()) return e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData(DND_TYPE, node.id);
        b.classList.add('dragging-bm');
      },
      ondragend: (e) => { e.stopPropagation(); b.classList.remove('dragging-bm'); },
    });
    b.append(el('span', { class: 'glyph', text: '▸' }));
    if (!badges) b.append(el('span', { class: 'label', text: node.title || '(sans nom)' }));
    return b;
  }

  const refresh = () => render();
  chrome.bookmarks.onCreated.addListener(refresh);
  chrome.bookmarks.onRemoved.addListener(refresh);
  chrome.bookmarks.onChanged.addListener(refresh);
  chrome.bookmarks.onMoved.addListener(refresh);

  render();

  return {
    render,
    resetStack() { stack = []; },
    stop() {
      alive = false;
      chrome.bookmarks.onCreated.removeListener(refresh);
      chrome.bookmarks.onRemoved.removeListener(refresh);
      chrome.bookmarks.onChanged.removeListener(refresh);
      chrome.bookmarks.onMoved.removeListener(refresh);
    },
  };
}

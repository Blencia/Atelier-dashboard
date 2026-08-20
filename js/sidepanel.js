import { el, clear, faviconUrl, hostOf, initial, listAllBookmarks, debounce } from './ui.js';
import { DND_TYPE } from './bmview.js';

/* Panneau latéral, visible seulement en mode plan : liste tous les favoris
   pour qu'on puisse en glisser un directement vers un module Dossier de
   favoris / Dossier à onglets / Dossier — même protocole de glisser
   (DND_TYPE) que les modules eux-mêmes, aucune logique de dépôt en plus à
   écrire ici. */

let all = [];
let panel, list, searchInput;
let listening = false;

/** La cartouche est `position: sticky`, pas fixe — son décalage top:0 en dur
    la faisait passer SOUS elle. On mesure sa hauteur réelle (qui varie si
    elle retombe sur 2 lignes) plutôt que de deviner une valeur. */
function syncTop() {
  if (!panel) return;
  const titleblock = document.getElementById('titleblock');
  panel.style.top = `${titleblock ? titleblock.getBoundingClientRect().bottom : 0}px`;
}
window.addEventListener('resize', debounce(syncTop, 100));

function row(bm) {
  const label = bm.title || hostOf(bm.url);
  const r = el('div', {
    class: 'sp-row',
    title: `${label}\n${bm.url}${bm.path ? `\n${bm.path}` : ''}`,
    draggable: 'true',
    ondragstart: (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData(DND_TYPE, bm.id);
      r.classList.add('dragging-bm');
    },
    ondragend: () => r.classList.remove('dragging-bm'),
  });
  const img = el('img', { src: faviconUrl(bm.url, 28), alt: '', loading: 'lazy' });
  img.addEventListener('error', () => {
    img.replaceWith(el('span', { class: 'glyph', text: initial(bm.title, bm.url) }));
  });
  r.append(img, el('div', { class: 'sp-row-text' }, [
    el('span', { class: 'sp-row-title', text: label }),
    el('span', { class: 'sp-row-path', text: bm.path || '—' }),
  ]));
  return r;
}

function renderList() {
  const q = searchInput.value.trim().toLowerCase();
  clear(list);
  const filtered = q
    ? all.filter((bm) => `${bm.title} ${bm.url} ${bm.path}`.toLowerCase().includes(q))
    : all;
  if (!filtered.length) {
    list.append(el('p', { class: 'note', text: 'Aucun favori.' }));
    return;
  }
  for (const bm of filtered) list.append(row(bm));
}

async function refresh() {
  try { all = await listAllBookmarks(); } catch { all = []; }
  renderList();
}

function ensurePanel() {
  if (panel) return;
  searchInput = el('input', { type: 'text', placeholder: 'Filtrer les favoris…', class: 'sp-search' });
  searchInput.addEventListener('input', debounce(renderList, 80));
  list = el('div', { class: 'sp-list' });
  panel = el('aside', { class: 'side-panel', id: 'sidePanel' }, [
    el('div', { class: 'sp-head' }, [
      el('span', { class: 'sp-title', text: 'Tous les favoris' }),
      el('span', { class: 'sp-hint', text: 'Glisse vers un module dossier' }),
    ]),
    searchInput,
    list,
  ]);
  document.body.append(panel);
}

export function showSidePanel() {
  ensurePanel();
  syncTop();
  panel.hidden = false;
  if (!listening) {
    listening = true;
    for (const ev of ['onCreated', 'onRemoved', 'onChanged', 'onMoved']) {
      chrome.bookmarks[ev].addListener(refresh);
    }
  }
  refresh();
}

export function hideSidePanel() {
  if (!panel) return;
  panel.hidden = true;
  if (listening) {
    listening = false;
    for (const ev of ['onCreated', 'onRemoved', 'onChanged', 'onMoved']) {
      chrome.bookmarks[ev].removeListener(refresh);
    }
  }
}

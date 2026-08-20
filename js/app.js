import { store, makeWidget, clamp } from './store.js';
import { getWidget } from './registry.js';
import { el, clear, faviconUrl, hostOf, initial, countBookmarks, debounce, toast } from './ui.js';
import { openSettings, openWidgetSettings, openAddWidget, openAddBoard, openBoardSettings, openChangelog } from './settings.js';
import { showSidePanel, hideSidePanel } from './sidepanel.js';

/* Enregistrement des modules. Ajoute ton import ici pour en brancher un nouveau. */
import './widgets/bookmarks.js';
import './widgets/misc.js';
import './widgets/googletools.js';
import './widgets/folder.js';
import './widgets/foldertabs.js';
import './widgets/weather.js';

const $ = (id) => document.getElementById(id);
const grid = $('grid');
const mounted = new Map();      // id -> fonction de nettoyage
let editing = false;
let lastSig = '';

/* ============================================================
   Thème
   ============================================================ */

function applyTheme() {
  const board = store.board();
  const t = { ...store.data.theme, ...(board.theme || {}) };
  const { layout: l } = store.data;
  const r = document.documentElement;

  r.dataset.mode = t.mode;
  r.style.setProperty('--accent', t.accent);
  r.style.setProperty('--accent-ink', contrastInk(t.accent));
  r.style.setProperty('--radius', `${t.radius}px`);
  r.style.setProperty('--cols', l.cols);
  r.style.setProperty('--gap', `${l.gap}px`);
  r.style.setProperty('--row', `${l.row}px`);
  r.style.setProperty('--maxw', `${l.maxWidth}px`);
  r.style.setProperty('--wall-dim', t.wallpaperDim);

  document.body.dataset.density = t.density;
  document.body.dataset.labels = t.showLabels ? 'on' : 'off';
  document.body.classList.toggle('show-grid', !!t.showGrid);
  document.body.classList.toggle('has-wallpaper', !!store.wallpaper);
  $('wallpaper').style.backgroundImage = store.wallpaper ? `url("${store.wallpaper}")` : '';

  // Règle de colonnes du mode plan
  const ruler = $('ruler');
  if (ruler.childElementCount !== l.cols) {
    clear(ruler);
    for (let i = 0; i < l.cols; i++) ruler.append(el('span', { text: String(i + 1) }));
  }
}

/** Noir ou blanc au-dessus de l'accent, selon sa luminance. */
function contrastInk(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#14161a';
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? '#14161a' : '#ffffff';
}

/* ============================================================
   Onglets (dashboards)
   ============================================================ */

function renderBoards() {
  const bar = $('boards');
  clear(bar);
  for (const b of store.data.boards) {
    const active = b.id === store.data.activeBoard;
    const tab = el('button', {
      class: `board-tab${active ? ' is-active' : ''}`,
      type: 'button',
      onclick: () => store.setActiveBoard(b.id),
    }, [el('span', { class: 'board-tab-name', text: b.name })]);
    if (active) {
      tab.append(el('button', {
        class: 'board-tab-gear', type: 'button', title: 'Réglages de l\'onglet',
        onclick: (e) => { e.stopPropagation(); openBoardSettings(b.id); },
        text: '⚙',
      }));
    }
    bar.append(tab);
  }
  bar.append(el('button', {
    class: 'board-tab board-tab-add', type: 'button', title: 'Nouvel onglet', text: '+',
    onclick: openAddBoard,
  }));
}

/* ============================================================
   Rendu de la feuille
   ============================================================ */

function sig() {
  return store.data.activeBoard + '|' + JSON.stringify(store.board().widgets);
}

function render() {
  renderBoards();
  applyTheme();
  const s = sig();
  if (s === lastSig) return;   // changement de thème seul : pas de remontage
  lastSig = s;
  rebuild();
}

function rebuild() {
  for (const stop of mounted.values()) { try { stop?.(); } catch { /* ignore */ } }
  mounted.clear();
  clear(grid);

  const list = store.board().widgets;
  $('empty').hidden = list.length > 0;

  list.forEach((w, i) => {
    const node = buildWidget(w);
    node.style.animationDelay = `${Math.min(i, 8) * 28}ms`;
    grid.append(node);
  });
}

function buildWidget(w) {
  const def = getWidget(w.type);
  const node = el('article', { class: `widget${w.color ? ' has-accent' : ''}`, 'data-id': w.id });
  node.style.setProperty('--w', w.w);
  node.style.setProperty('--h', w.h);
  if (w.color) node.style.setProperty('--widget-accent', w.color);

  const head = el('div', { class: 'widget-head' }, [
    el('span', { class: 'widget-title', text: def ? def.title(w) : 'Module inconnu' }),
    el('span', { class: 'widget-dim', text: `${w.w}×${w.h}` }),
    el('div', { class: 'widget-tools' }, [
      def ? el('button', {
        class: 'btn btn-ghost', type: 'button', title: 'Réglages du module', text: '⚙',
        onclick: () => openWidgetSettings(w.id),
      }) : null,
      el('button', {
        class: 'btn btn-ghost btn-danger', type: 'button', title: 'Retirer', text: '✕',
        onclick: () => store.removeWidget(w.id),
      }),
    ]),
  ]);

  const body = el('div', { class: 'widget-body' });
  node.append(head, body, el('div', { class: 'handle', title: 'Redimensionner' }));
  wireDrag(node, head);
  wireResize(node, w);

  if (!def) {
    body.append(el('p', { class: 'note', text: `Type « ${w.type} » non enregistré.` }));
    return node;
  }

  const ctx = {
    widget: w,
    settings: { ...def.defaults, ...w.settings },
    config: store.data,
    update: (patch, opts) => {
      Object.assign(ctx.settings, patch);
      return store.patchSettings(w.id, patch, opts);
    },
  };

  try {
    mounted.set(w.id, def.mount(body, ctx));
  } catch (err) {
    console.error('[Atelier]', w.type, err);
    body.append(el('p', { class: 'note', text: 'Ce module a planté. Voir la console.' }));
  }

  return node;
}

/* ============================================================
   Déplacement
   ============================================================ */

let dragged = null;

function wireDrag(node, head) {
  head.addEventListener('pointerdown', () => {
    node.draggable = editing;   // draggable seulement en mode plan
  });
  node.addEventListener('dragstart', (e) => {
    if (!editing) return e.preventDefault();
    dragged = node;
    node.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', node.dataset.id);
  });
  node.addEventListener('dragend', async () => {
    node.classList.remove('dragging');
    node.draggable = false;
    dragged = null;
    const ids = [...grid.querySelectorAll('.widget')].map((n) => n.dataset.id);
    await store.reorder(ids);
    lastSig = sig();
  });
}

grid.addEventListener('dragover', (e) => {
  if (!dragged) return;
  e.preventDefault();
  const ref = nearestSlot(e.clientX, e.clientY);
  if (ref === dragged) return;
  if (ref) grid.insertBefore(dragged, ref);
  else grid.append(dragged);
});

function nearestSlot(x, y) {
  const nodes = [...grid.querySelectorAll('.widget:not(.dragging)')];
  let best = null;
  let bestDist = Infinity;
  for (const n of nodes) {
    const b = n.getBoundingClientRect();
    const d = Math.hypot(x - (b.left + b.width / 2), y - (b.top + b.height / 2));
    if (d < bestDist) { bestDist = d; best = n; }
  }
  if (!best) return null;
  const b = best.getBoundingClientRect();
  const sameRow = Math.abs(y - (b.top + b.height / 2)) < b.height / 2;
  const before = sameRow ? x < b.left + b.width / 2 : y < b.top + b.height / 2;
  return before ? best : best.nextElementSibling;
}

/* ============================================================
   Redimensionnement
   ============================================================ */

function wireResize(node, w) {
  const handle = node.querySelector('.handle');
  handle.addEventListener('pointerdown', (e) => {
    if (!editing) return;
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    node.classList.add('resizing');

    const { cols, gap, row } = store.data.layout;
    const gridW = grid.getBoundingClientRect().width;
    const colUnit = (gridW - gap * (cols - 1)) / cols + gap;
    const rowUnit = row + gap;
    const start = { x: e.clientX, y: e.clientY, w: w.w, h: w.h };
    const dim = node.querySelector('.widget-dim');

    const move = (ev) => {
      const nw = clamp(Math.round(start.w + (ev.clientX - start.x) / colUnit), 1, cols);
      const nh = clamp(Math.round(start.h + (ev.clientY - start.y) / rowUnit), 1, 6);
      if (nw === w.w && nh === w.h) return;
      w.w = nw; w.h = nh;
      node.style.setProperty('--w', nw);
      node.style.setProperty('--h', nh);
      dim.textContent = `${nw}×${nh}`;
    };

    const up = async () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      node.classList.remove('resizing');
      await store.patchWidget(w.id, { w: w.w, h: w.h }, { silent: true });
      lastSig = sig();
    };

    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
  });
}

/* ============================================================
   Mode plan
   ============================================================ */

function setEditing(on) {
  editing = on;
  document.body.classList.toggle('is-editing', on);
  $('dock').hidden = !on;
  $('btnEdit').setAttribute('aria-pressed', String(on));
  if (!on) grid.querySelectorAll('.widget').forEach((n) => { n.draggable = false; });
  if (on) showSidePanel(); else hideSidePanel();
}

/* ============================================================
   Recherche
   ============================================================ */

/* Préfixes de recherche : "yt: chats" saute direct sur YouTube. */
const SEARCH_PREFIXES = [
  ['g:', 'Google', 'https://www.google.com/search?q=%s'],
  ['yt:', 'YouTube', 'https://www.youtube.com/results?search_query=%s'],
  ['gh:', 'GitHub', 'https://github.com/search?q=%s'],
  ['wiki:', 'Wikipédia', 'https://fr.wikipedia.org/w/index.php?search=%s'],
  ['maps:', 'Maps', 'https://www.google.com/maps/search/%s'],
  ['img:', 'Images', 'https://www.google.com/search?tbm=isch&q=%s'],
  ['ddg:', 'DuckDuckGo', 'https://duckduckgo.com/?q=%s'],
];

function matchPrefix(q) {
  const trimmed = q.trimStart();
  const low = trimmed.toLowerCase();
  for (const [prefix, label, tpl] of SEARCH_PREFIXES) {
    if (low.startsWith(prefix)) {
      const rest = trimmed.slice(prefix.length).trim();
      return { label, rest, url: tpl.replace('%s', encodeURIComponent(rest)) };
    }
  }
  return null;
}

const omni = $('omni');
const results = $('omniResults');
let hits = [];
let cursor = -1;

const search = debounce(async (q) => {
  if (!q.trim()) return hideResults();
  const prefixed = matchPrefix(q);
  if (prefixed) {
    hits = [];
    cursor = -1;
    drawPrefixResult(prefixed);
    return;
  }
  let found = [];
  try {
    found = await chrome.bookmarks.search({ query: q });
  } catch { /* rien */ }
  hits = found.filter((n) => n.url).slice(0, 8);
  cursor = hits.length ? 0 : -1;
  drawResults(q);
}, 90);

function drawPrefixResult(p) {
  clear(results);
  results.hidden = false;
  results.append(el('li', {
    class: 'omni-item', role: 'option', 'aria-selected': 'true',
    onclick: (e) => go(p.url, e),
  }, [
    el('span', { class: 'glyph', text: '↵' }),
    el('span', {
      class: 'omni-title',
      text: p.rest ? `Rechercher « ${p.rest} » sur ${p.label}` : `Rechercher sur ${p.label}`,
    }),
  ]));
}

function drawResults(q) {
  clear(results);
  results.hidden = false;

  if (!hits.length) {
    results.append(el('li', {
      class: 'omni-empty',
      text: `Aucun favori. Entrée pour chercher « ${q} » sur le web.`,
    }));
    return;
  }

  hits.forEach((n, i) => {
    const img = el('img', { src: faviconUrl(n.url, 32), alt: '' });
    img.addEventListener('error', () => {
      img.replaceWith(el('span', { class: 'glyph', text: initial(n.title, n.url) }));
    });
    const li = el('li', {
      class: 'omni-item', role: 'option', 'aria-selected': String(i === cursor),
      onmouseenter: () => { cursor = i; syncSelection(); },
      onclick: (e) => go(n.url, e),
    }, [
      img,
      el('span', { class: 'omni-title', text: n.title || hostOf(n.url) }),
      el('span', { class: 'omni-url', text: hostOf(n.url) }),
    ]);
    results.append(li);
  });
}

function syncSelection() {
  [...results.children].forEach((li, i) => li.setAttribute('aria-selected', String(i === cursor)));
  results.children[cursor]?.scrollIntoView({ block: 'nearest' });
}

function hideResults() {
  results.hidden = true;
  clear(results);
  hits = [];
  cursor = -1;
}

function go(url, ev) {
  const openIn = store.data.search.openIn;
  if (openIn === 'new' || ev?.ctrlKey || ev?.metaKey) {
    if (chrome.tabs?.create) chrome.tabs.create({ url });
    else window.open(url, '_blank', 'noopener');
  } else {
    location.href = url;
  }
}

omni.addEventListener('input', () => search(omni.value));
omni.addEventListener('focus', () => { if (omni.value.trim()) search(omni.value); });
omni.addEventListener('blur', () => setTimeout(hideResults, 140));
omni.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' && hits.length) { e.preventDefault(); cursor = (cursor + 1) % hits.length; syncSelection(); }
  else if (e.key === 'ArrowUp' && hits.length) { e.preventDefault(); cursor = (cursor - 1 + hits.length) % hits.length; syncSelection(); }
  else if (e.key === 'Enter') {
    e.preventDefault();
    const prefixed = matchPrefix(omni.value);
    if (prefixed) { go(prefixed.url, e); return; }
    const pick = hits[cursor];
    if (pick) go(pick.url, e);
    else if (omni.value.trim()) {
      go(store.data.search.engine.replace('%s', encodeURIComponent(omni.value.trim())), e);
    }
  } else if (e.key === 'Escape') {
    if (results.hidden) omni.blur();
    else hideResults();
  }
});

/* ============================================================
   Cartouche : heure et compteur
   ============================================================ */

function startTitleBlock() {
  try {
    $('tbVersion').textContent = `v${chrome.runtime.getManifest().version}`;
  } catch {
    $('tbVersion').textContent = '';
  }

  const timeFmt = new Intl.DateTimeFormat('fr-CA', { hour: '2-digit', minute: '2-digit', hour12: false });
  const dateFmt = new Intl.DateTimeFormat('fr-CA', { weekday: 'short', day: 'numeric', month: 'short' });
  const tick = () => {
    const now = new Date();
    $('tbTime').textContent = timeFmt.format(now);
    $('tbDate').textContent = dateFmt.format(now).replace('.', '');
  };
  tick();
  setInterval(tick, 20000);

  countBookmarks()
    .then((n) => { $('tbCount').textContent = `${n} favoris`; })
    .catch(() => { $('tbCount').textContent = ''; });
}

/* ============================================================
   Raccourcis clavier
   ============================================================ */

document.addEventListener('keydown', (e) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
  const modalOpen = !$('modalRoot').hidden;

  if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    omni.focus();
    omni.select();
    return;
  }
  if (typing || modalOpen) return;

  if (e.key === '/') { e.preventDefault(); omni.focus(); }
  else if (e.key === 'e' || e.key === 'E') { setEditing(!editing); }
  else if (e.key === 'Escape' && editing) { setEditing(false); }
  else if (e.altKey && /^[1-9]$/.test(e.key)) {
    // Alt+1..9 : saute au module correspondant à sa position sur la feuille active.
    const node = grid.children[+e.key - 1];
    if (node) {
      e.preventDefault();
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      node.classList.add('flash');
      setTimeout(() => node.classList.remove('flash'), 900);
    }
  }
});

/* ============================================================
   Premier lancement
   ============================================================ */

async function seed() {
  const tree = await chrome.bookmarks.getTree();
  const roots = tree[0]?.children || [];
  const bar = roots.find((n) => !n.url) || roots[0];

  store.board().widgets = [
    makeWidget('bookmarks', {
      folderId: bar?.id ?? null,
      folderPath: bar?.title || '',
      view: 'tiles',
    }, { w: 8, h: 3 }),
    makeWidget('clock', { label: 'Horloge' }, { w: 4, h: 1 }),
    makeWidget('topsites', {}, { w: 4, h: 2 }),
  ];
  await store.save();
}

/* ============================================================
   Démarrage
   ============================================================ */

(async function boot() {
  await store.load();
  if (!store.board().widgets.length) {
    try { await seed(); } catch { /* pas de favoris : feuille vide */ }
  }

  store.on(render);
  render();
  startTitleBlock();
  requestAnimationFrame(() => document.body.classList.remove('booting'));

  $('btnEdit').addEventListener('click', () => setEditing(!editing));
  $('btnDone').addEventListener('click', () => setEditing(false));
  $('btnSettings').addEventListener('click', openSettings);
  $('btnChangelog').addEventListener('click', openChangelog);
  $('btnAdd').addEventListener('click', openAddWidget);
  $('emptyAdd').addEventListener('click', openAddWidget);

  // Config modifiée dans un autre onglet : on se resynchronise.
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'local') return;
    if (store.selfWrites > 0) { store.selfWrites--; return; }
    if (changes.config || changes.wallpaper) {
      await store.load();
      render();
    }
  });
})().catch((err) => {
  console.error('[Atelier] démarrage impossible', err);
  toast('Démarrage impossible — voir la console');
});

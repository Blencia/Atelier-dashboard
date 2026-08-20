import { store } from './store.js';
import {
  el, clear, faviconUrl, hostOf, initial, openLink,
  openModal, toast, isEditing, openContextMenu,
} from './ui.js';

/* Navigateur de dossier de favoris réutilisable : tuiles/liste/icônes seules/
   pastilles/icône compacte, sous-dossiers (réels ou créés à la main),
   glisser vers un autre module, alias local, menu clic droit
   (renommer/détails). Utilisé par les modules Dossier et Dossier à onglets
   — voir js/widgets/folder.js et js/widgets/foldertabs.js.

   IMPORTANT — organisation virtuelle : Atelier NE modifie JAMAIS tes vrais
   favoris Chrome (ni leur ordre, ni leur dossier). Le contenu (existence,
   titre, lien) reste toujours lu en direct depuis chrome.bookmarks. Seuls
   l'ORDRE affiché (store.data.folderOrder) et le DOSSIER D'AFFICHAGE
   (store.data.folderOverride, quand tu glisses un favori vers un autre
   module) sont des surcouches locales, stockées à part. Un favori supprimé
   ou renommé dans Chrome se reflète toujours immédiatement ici. */

/* Type de dataTransfer utilisé par TOUT glisser de favori dans Atelier —
   exporté pour que les modules qui n'utilisent pas mountFolderBrowser
   (ex. le module Dossier compact) puissent quand même être une cible de
   dépôt valide, avec le même protocole. */
export const DND_TYPE = 'application/x-atelier-bookmark-id';

/* store.setFolderOrder/setFolderOverride sauvegardent en silencieux (pas de
   rebuild global de app.js, et de toute façon folderOrder/folderOverride ne
   font pas partie de la signature qui déclenche ce rebuild) — sans ceci,
   glisser un favori dans UN module ne rafraîchirait pas les autres modules
   qui affichent le même dossier réel. */
const liveBrowsers = new Set();
export function refreshAllBrowsers() {
  for (const render of liveBrowsers) render();
}

// Ménage : si un favori/dossier disparaît vraiment de Chrome, son classement
// et sa position locale n'ont plus de sens — un seul listener pour toute
// l'extension (module ES = singleton), pas un par module monté.
chrome.bookmarks.onRemoved.addListener((id) => {
  let changed = false;
  if (store.data.folderOverride[id]) { delete store.data.folderOverride[id]; changed = true; }
  if (store.data.folderOrder[id]) { delete store.data.folderOrder[id]; changed = true; }
  for (const order of Object.values(store.data.folderOrder)) {
    const i = order.indexOf(id);
    if (i !== -1) { order.splice(i, 1); changed = true; }
  }
  if (changed) store.save({ silent: true });
});

/** Identifiant d'un dossier « virtuel » : n'existe pas dans les vrais
    favoris Chrome, purement local à Atelier — un module Dossier sans
    dossier Chrome assigné en fabrique un (voir virtualFolderId ci-dessous),
    pour devenir un simple bac qu'on remplit par glisser-déposer. */
function isVirtualFolder(id) {
  return typeof id === 'string' && id.startsWith('atelier:');
}

/** Id stable et unique d'un dossier virtuel pour un module (et, pour Dossier
    à onglets, un onglet précis). Jamais transmis à l'API chrome.bookmarks —
    seulement utilisé comme clé dans folderOrder/folderOverride. */
export function virtualFolderId(widgetId, tabId) {
  return tabId ? `atelier:${widgetId}:${tabId}` : `atelier:${widgetId}`;
}

/** Id d'un sous-dossier créé à la main (clic droit → Nouveau sous-dossier) —
    même préfixe "atelier:" donc déjà traité comme virtuel partout, mais un
    sous-préfixe "vf:" distinct pour le repérer (renommer/supprimer). */
function newVirtualSubfolderId() {
  return `atelier:vf:${Math.random().toString(36).slice(2, 10)}`;
}

function isVirtualSubfolder(id) {
  return typeof id === 'string' && id.startsWith('atelier:vf:');
}

/** À appeler quand un module (ou un de ses onglets) est supprimé pour de bon :
    libère les favoris qui y étaient classés virtuellement, pour qu'ils ne
    deviennent pas invisibles partout dans Atelier (ils restent, eux, intacts
    dans les vrais favoris Chrome — seul leur classement local est perdu ici). */
export async function releaseVirtualFolder(prefix) {
  let changed = false;
  for (const [id, target] of Object.entries(store.data.folderOverride)) {
    if (typeof target === 'string' && target.startsWith(prefix)) {
      delete store.data.folderOverride[id];
      changed = true;
    }
  }
  for (const key of Object.keys(store.data.folderOrder)) {
    if (key.startsWith(prefix)) { delete store.data.folderOrder[key]; changed = true; }
  }
  if (changed) await store.save({ silent: true });
  refreshAllBrowsers();
}

/** Classe virtuellement `nodeId` sous `targetFolderId` (jamais un vrai
    chrome.bookmarks.move) et renvoie le nœud Chrome à jour, ou null s'il
    n'existe plus. Partagé par mountFolderBrowser et les modules simples
    (ex. Dossier compact) qui n'ont pas de liste où positionner précisément. */
export async function setDisplayFolder(nodeId, targetFolderId) {
  let node;
  try { [node] = await chrome.bookmarks.get(nodeId); } catch { return null; }
  const displayFolder = store.data.folderOverride[nodeId] || node.parentId;
  if (displayFolder !== targetFolderId) {
    await store.setFolderOverride(nodeId, targetFolderId === node.parentId ? null : targetFolderId);
  }
  return node;
}

/** Variante simple de dropInto, pour les modules sans liste déroulée où
    positionner précisément (ex. l'aperçu compact du module Dossier) —
    classe le favori/dossier à la fin de `targetFolderId`. */
export async function classifyIntoFolder(nodeId, targetFolderId) {
  const node = await setDisplayFolder(nodeId, targetFolderId);
  if (!node) return false;
  const order = store.data.folderOrder[targetFolderId] || [];
  if (!order.includes(nodeId)) {
    await store.setFolderOrder(targetFolderId, [...order, nodeId]);
  }
  refreshAllBrowsers();
  return true;
}

/** Enfants réellement affichés dans `folderId` : ceux de Chrome, moins ceux
    classés virtuellement ailleurs, plus ceux classés virtuellement ici.
    Pour un dossier virtuel (aucun dossier Chrome derrière), il n'y a pas
    d'enfants réels — seulement ce qui a été classé ici par glisser. Exporté
    pour être réutilisé par les modules qui n'utilisent pas
    mountFolderBrowser (ex. Dossier compact) mais doivent quand même
    afficher un dossier virtuel correctement. */
export async function resolveDisplayedChildren(folderId) {
  const overrides = store.data.folderOverride;
  let items = [];
  if (!isVirtualFolder(folderId)) {
    const real = await chrome.bookmarks.getChildren(folderId);
    items = real.filter((c) => !(overrides[c.id] && overrides[c.id] !== folderId));
  }

  const incomingIds = Object.keys(overrides).filter((id) => overrides[id] === folderId);
  for (const id of incomingIds) {
    if (items.some((c) => c.id === id)) continue;
    try {
      const [node] = await chrome.bookmarks.get(id);
      if (node && node.parentId !== folderId) items.push(node);
    } catch { /* favori supprimé entretemps : classement caduc, ignoré */ }
  }

  // Sous-dossiers créés à la main (clic droit → Nouveau sous-dossier) : de
  // simples nœuds locaux, jamais dans chrome.bookmarks.
  for (const [vfId, vf] of Object.entries(store.data.virtualFolders)) {
    if (vf.parent === folderId) items.push({ id: vfId, title: vf.name, parentId: folderId });
  }
  return items;
}

/**
 * @param {HTMLElement} body      conteneur à remplir (vidé et rempli à chaque rendu)
 * @param {object} opts
 * @param {() => Promise<string|null>} opts.resolveRoot  id du dossier racine à afficher
 * @param {object} opts.settings  { view, tile, icon, sort, limit, openIn, showCrumbs }
 * @param {(patch: object) => Promise} [opts.persistSettings]  pour basculer
 *        automatiquement en tri « Ordre du dossier » quand on glisse-dépose
 */
export function mountFolderBrowser(body, opts) {
  const { resolveRoot, settings: s, persistSettings } = opts;
  let stack = [];   // navigation interne, remise à zéro par resetStack()
  let alive = true;
  body.classList.add('bm-dnd');
  // Cible courante du dépôt, mise à jour à chaque render() — wireDrop() est
  // câblé UNE SEULE FOIS sur `body` (élément stable) ; le re-câbler à chaque
  // rendu empilerait des écouteurs en double sur le même élément persistant.
  let currentWrap = null;
  let currentTargetFolderId = null;

  async function render() {
    if (!alive) return;
    clear(body);

    const rootId = await resolveRoot();
    if (!rootId) {
      body.append(el('p', { class: 'note', text: 'Aucun dossier choisi. Ouvre les réglages du module.' }));
      currentWrap = null;
      currentTargetFolderId = null;
      return;
    }

    if (s.view === 'app') {
      await renderAppView(rootId);
      return;
    }

    const currentId = stack.length ? stack[stack.length - 1].id : rootId;
    let items;
    try {
      items = await resolveDisplayedChildren(currentId);
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

    if (s.sort === 'alpha') {
      items.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'fr'));
      items.sort((a, b) => (!!a.url) - (!!b.url)); // dossiers d'abord, toujours
    } else if (s.sort === 'recent') {
      items.sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0));
      items.sort((a, b) => (!!a.url) - (!!b.url));
    } else {
      // manuel : ordre local (glisser-déposer dans Atelier), jamais écrit dans Chrome
      const order = store.data.folderOrder[currentId];
      if (order?.length) {
        const pos = new Map(order.map((id, i) => [id, i]));
        items.sort((a, b) => {
          const pa = pos.has(a.id) ? pos.get(a.id) : Infinity;
          const pb = pos.has(b.id) ? pos.get(b.id) : Infinity;
          return pa !== pb ? pa - pb : (!!a.url) - (!!b.url);
        });
      } else {
        items.sort((a, b) => (!!a.url) - (!!b.url));
      }
    }
    if (s.limit > 0) items = items.slice(0, s.limit);

    if (!items.length) {
      body.append(el('p', {
        class: 'note',
        text: isVirtualFolder(currentId) && !stack.length
          ? 'Dossier virtuel, vide pour l\'instant — glisse un favori depuis le panneau latéral (mode plan) ou un autre module pour le classer ici.'
          : 'Dossier vide.',
      }));
      currentWrap = body; // pas de tuiles, mais on peut quand même y déposer un favori
      currentTargetFolderId = currentId;
      return;
    }

    const iconsOnly = s.view === 'icons';
    const tiles = s.view === 'tiles' || iconsOnly;
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
      wrap.append(node.url ? linkNode(node, tiles, badges, iconsOnly) : folderNode(node, tiles, badges, iconsOnly));
    }
    body.append(wrap);
    currentWrap = wrap;
    currentTargetFolderId = currentId;
  }

  /** Vue « Icône compacte » : aperçu réduit façon écran d'accueil de
      téléphone, tout le contenu vit dans une fenêtre ouverte au clic. */
  async function renderAppView(rootId) {
    let children;
    try {
      children = await resolveDisplayedChildren(rootId);
    } catch {
      body.append(el('p', { class: 'note', text: 'Lecture du dossier impossible.' }));
      currentWrap = null;
      currentTargetFolderId = null;
      return;
    }

    const name = s.label || s.folderPath?.split(' / ').pop() || 'Dossier';
    const preview = el('div', { class: 'folder-preview' });
    children.slice(0, 4).forEach((n) => preview.append(n.url ? appThumb(n) : el('span', { class: 'glyph', text: '📁' })));
    for (let i = children.length; i < 4; i++) preview.append(el('span', { class: 'folder-slot-empty' }));

    body.append(el('button', {
      class: 'folder-open', type: 'button', title: name,
      onclick: () => { if (!isEditing()) openAppModal(rootId, name); },
    }, [preview, el('span', { class: 'folder-name', text: name })]));

    // Pas de tuiles avec data-bm-id ici : nearestSibling ne trouvera rien,
    // un dépôt s'ajoute donc toujours à la fin — comportement voulu.
    currentWrap = body;
    currentTargetFolderId = rootId;
  }

  function appThumb(node) {
    const img = el('img', { src: faviconUrl(node.url, 32), alt: '', loading: 'lazy' });
    img.addEventListener('error', () => {
      img.replaceWith(el('span', { class: 'glyph', text: initial(node.title, node.url) }));
    });
    return img;
  }

  /** Grille plein écran, façon écran d'accueil, avec sa propre navigation
      dans les sous-dossiers — réutilise linkNode/folderNode : même
      glisser-sortant, alias, clic droit que la vue inline. */
  function openAppModal(rootId, title) {
    let modalStack = [];
    let modalCurrentId = rootId;
    const grid = el('div', { class: 'folder-grid' });
    grid.style.setProperty('--icon', `${s.icon}px`);
    const crumbs = el('nav', { class: 'bm-crumbs' });

    grid.addEventListener('contextmenu', (e) => {
      if (e.target !== grid) return; // clic sur un item : son propre menu s'en charge
      e.preventDefault();
      openContextMenu(e.clientX, e.clientY, [
        { label: '+ Nouveau sous-dossier', onClick: () => createSubfolder(modalCurrentId) },
      ]);
    });

    async function draw() {
      clear(grid);
      clear(crumbs);
      modalCurrentId = modalStack.length ? modalStack[modalStack.length - 1].id : rootId;
      let children;
      try { children = await resolveDisplayedChildren(modalCurrentId); } catch { children = []; }

      if (modalStack.length) {
        crumbs.append(el('button', { type: 'button', text: '← racine', onclick: () => { modalStack = []; draw(); } }));
        modalStack.forEach((node, i) => {
          crumbs.append(el('span', { text: '/' }));
          crumbs.append(el('button', {
            type: 'button', text: node.title || '(sans nom)',
            onclick: () => { modalStack = modalStack.slice(0, i + 1); draw(); },
          }));
        });
      }

      for (const node of children) {
        grid.append(node.url
          ? linkNode(node, true, false, false)
          : folderNode(node, true, false, false, (n) => { modalStack.push(n); draw(); }));
      }
      if (!children.length) {
        grid.append(el('p', {
          class: 'note',
          text: isVirtualFolder(modalCurrentId) && !modalStack.length
            ? 'Dossier virtuel, vide pour l\'instant — glisse un favori depuis le panneau latéral (mode plan) ou un autre module pour le classer ici.'
            : 'Dossier vide.',
        }));
      }
    }

    draw();
    openModal({ title, body: el('div', {}, [crumbs, grid]) });
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

  /** Classe virtuellement `bmId` dans `targetFolderId`, à la position visuelle
      demandée — jamais un chrome.bookmarks.move. Le vrai favori ne bouge pas. */
  async function dropInto(wrap, targetFolderId, bmId, refId, before) {
    const node = await setDisplayFolder(bmId, targetFolderId);
    if (!node) return false;

    // Ordre local : la séquence actuellement affichée dans ce module, avec
    // bmId inséré au bon endroit.
    const currentIds = [...wrap.children].map((n) => n.dataset.bmId).filter((id) => id && id !== bmId);
    let insertAt = currentIds.length;
    if (refId) {
      const idx = currentIds.indexOf(refId);
      if (idx !== -1) insertAt = before ? idx : idx + 1;
    }
    currentIds.splice(insertAt, 0, bmId);
    await store.setFolderOrder(targetFolderId, currentIds);

    // Le dépôt ne se voit que si ce module est trié « Ordre du dossier » —
    // on y bascule automatiquement, sinon le glisser semblerait ne rien faire.
    if (s.sort !== 'manual' && persistSettings) {
      s.sort = 'manual';
      await persistSettings({ sort: 'manual' });
    }
    return true;
  }

  /** Câblé UNE SEULE FOIS sur `body` (élément stable pendant toute la vie du
      module) — lit `currentWrap`/`currentTargetFolderId`, mis à jour par
      chaque render(), plutôt que d'être re-câblé (et donc dupliqué) à
      chaque rendu. `body` reçoit les écouteurs pour couvrir tout le module,
      pas juste la grille de tuiles. */
  function wireDrop() {
    let marked = null;
    const unmark = () => { marked?.classList.remove('bm-insert-target'); marked = null; };

    body.addEventListener('dragover', (e) => {
      if (!isEditing() || !currentTargetFolderId || !e.dataTransfer.types.includes(DND_TYPE)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      body.classList.add('bm-drop-target');
      const { el: near } = nearestSibling(currentWrap, e.clientX, e.clientY);
      if (near !== marked) { unmark(); if (near) { near.classList.add('bm-insert-target'); marked = near; } }
    });
    body.addEventListener('dragleave', (e) => {
      if (e.target === body) { body.classList.remove('bm-drop-target'); unmark(); }
    });
    body.addEventListener('drop', async (e) => {
      body.classList.remove('bm-drop-target');
      const { el: near, before } = nearestSibling(currentWrap, e.clientX, e.clientY);
      unmark();
      if (!isEditing() || !currentTargetFolderId) return;
      const bmId = e.dataTransfer.getData(DND_TYPE);
      if (!bmId) return;
      e.preventDefault();

      const ok = await dropInto(currentWrap, currentTargetFolderId, bmId, near?.dataset.bmId, before);
      if (ok) {
        toast('Classé ici — les vrais favoris Chrome ne sont pas touchés');
        refreshAllBrowsers();
      } else {
        toast('Déplacement impossible');
      }
    });
  }

  /** Câblé une seule fois sur `body`, comme wireDrop() — clic droit sur
      l'espace vide (pas sur un item, qui a déjà son propre menu) propose
      de créer un sous-dossier virtuel, façon écran d'accueil de téléphone. */
  function wireContextMenu() {
    body.addEventListener('contextmenu', (e) => {
      if (!currentTargetFolderId) return;
      const onEmptySpace = e.target === currentWrap || (currentWrap === body && e.target === body);
      if (!onEmptySpace) return;
      e.preventDefault();
      openContextMenu(e.clientX, e.clientY, [
        { label: '+ Nouveau sous-dossier', onClick: () => createSubfolder(currentTargetFolderId) },
      ]);
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

  /** Renomme localement un favori (alias) ou un sous-dossier virtuel (son
      seul nom) — n'écrit jamais dans les vrais favoris Chrome. */
  function renameNode(node) {
    const virtualSub = isVirtualSubfolder(node.id);
    const current = virtualSub ? node.title : (store.data.aliases[node.id] || '');
    const input = el('input', { type: 'text', value: current, placeholder: node.title || hostOf(node.url) });
    const body2 = el('div', { class: 'field' }, [
      el('label', { text: virtualSub ? 'Nom du sous-dossier' : 'Nom affiché (local à Atelier, le favori n\'est pas modifié)' }), input,
    ]);
    const commit = async (value) => {
      if (virtualSub) await store.renameVirtualFolder(node.id, value || 'Sans nom');
      else await store.setAlias(node.id, value);
      close();
      refreshAllBrowsers();
      toast('Nom mis à jour');
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') commit(input.value); });
    const footer = el('div', { style: { display: 'flex', gap: '8px', width: '100%' } }, [
      !virtualSub && current ? el('button', { class: 'btn', type: 'button', text: 'Réinitialiser', onclick: () => commit('') }) : null,
      el('span', { style: { flex: '1' } }),
      el('button', { class: 'btn btn-primary', type: 'button', text: 'Enregistrer', onclick: () => commit(input.value) }),
    ]);
    const close = openModal({ title: virtualSub ? 'Renommer ce sous-dossier' : 'Renommer ce favori', body: body2, footer });
  }

  /** Retire un favori/dossier de son classement virtuel — il redevient
      affiché sous son vrai dossier Chrome. */
  async function unclassify(node) {
    await store.setFolderOverride(node.id, null);
    refreshAllBrowsers();
    toast('Remis à sa place réelle dans Chrome');
  }

  /** Supprime un sous-dossier créé à la main. Les favoris qui y étaient
      classés sont libérés (pas perdus) plutôt que de devenir invisibles. */
  async function deleteSubfolder(node) {
    if (!confirm(`Supprimer le sous-dossier « ${node.title} » ? Son contenu ne sera pas supprimé, seulement libéré.`)) return;
    await releaseVirtualFolder(node.id);
    await store.removeVirtualFolder(node.id);
    refreshAllBrowsers();
    toast('Sous-dossier supprimé');
  }

  /** Clic droit sur un espace vide : proposer de créer un sous-dossier
      virtuel ici, façon écran d'accueil de téléphone. */
  function createSubfolder(parentId) {
    const input = el('input', { type: 'text', placeholder: 'Ex. Clients', value: 'Nouveau dossier' });
    const body2 = el('div', { class: 'field' }, [el('label', { text: 'Nom du sous-dossier' }), input]);
    const create = async () => {
      await store.setVirtualFolder(newVirtualSubfolderId(), input.value, parentId);
      close();
      refreshAllBrowsers();
      toast('Sous-dossier créé');
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') create(); });
    const footer = el('div', { style: { display: 'flex', justifyContent: 'flex-end', width: '100%' } }, [
      el('button', { class: 'btn btn-primary', type: 'button', text: 'Créer', onclick: create }),
    ]);
    const close = openModal({ title: 'Nouveau sous-dossier', body: body2, footer });
  }

  /** Fiche détaillée : titre réel, lien complet, date d'ajout, copier le lien. */
  function showDetails(node) {
    const alias = store.data.aliases[node.id];
    const rows = [
      ['Titre', node.title || '(sans titre)'],
      alias ? ['Nom affiché (local)', alias] : null,
      node.url ? ['Lien', node.url] : null,
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

    const footer = node.url ? el('div', { style: { display: 'flex', gap: '8px', width: '100%' } }, [
      el('button', {
        class: 'btn', type: 'button', text: 'Copier le lien',
        onclick: async () => {
          try { await navigator.clipboard.writeText(node.url); toast('Lien copié'); }
          catch { toast('Copie impossible'); }
        },
      }),
      el('span', { style: { flex: '1' } }),
      el('a', { class: 'btn btn-primary', href: node.url, target: '_blank', rel: 'noopener', text: 'Ouvrir le lien' }),
    ]) : null;

    openModal({ title: node.url ? 'Détails du favori' : 'Détails du dossier', body: body2, footer });
  }

  function contextItems(node) {
    const virtualSub = isVirtualSubfolder(node.id);
    const items = [
      { label: 'Renommer' + (node.url ? ' le favori' : ' le dossier') + ' (local)', onClick: () => renameNode(node) },
      { label: 'Voir les détails', onClick: () => showDetails(node) },
    ];
    if (store.data.folderOverride[node.id]) {
      items.push('-', { label: '↩ Remettre à sa place réelle', onClick: () => unclassify(node) });
    }
    if (virtualSub) {
      items.push('-', { label: '🗑 Supprimer ce sous-dossier', onClick: () => deleteSubfolder(node) });
    }
    return items;
  }

  function linkNode(node, tiles, badges, iconsOnly) {
    // textContent partout : un titre de favori peut contenir du HTML.
    const alias = store.data.aliases[node.id];
    const label = alias || node.title || hostOf(node.url);
    const virtual = !!store.data.folderOverride[node.id];
    const a = el('a', {
      class: `${badges ? 'badge' : tiles ? 'tile' : 'row'}${iconsOnly ? ' is-icon-only' : ''}${virtual ? ' bm-virtual' : ''}`,
      href: node.url,
      title: `${label}\n${node.url}${virtual ? '\n(classé ici dans Atelier seulement)' : ''}`,
      'data-bm-id': node.id,
      draggable: 'true', // el() ne stringifie que `true` littéral en "" — 'draggable' exige la chaîne "true"
      onclick: (e) => { if (isEditing()) return e.preventDefault(); openLink(node.url, s.openIn, e); },
      onauxclick: (e) => { if (isEditing()) return e.preventDefault(); openLink(node.url, s.openIn, e); },
      oncontextmenu: (e) => { e.preventDefault(); openContextMenu(e.clientX, e.clientY, contextItems(node)); },
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
    if (!badges && !iconsOnly) {
      a.append(el('span', { class: 'label', text: label }));
      a.append(el('button', {
        class: 'bm-rename', type: 'button', title: 'Renommer (local)', text: '✎',
        onclick: (e) => { e.preventDefault(); e.stopPropagation(); renameNode(node); },
      }));
    }
    if (!tiles && !badges) a.append(el('span', { class: 'host', text: hostOf(node.url) }));
    return a;
  }

  /** `onOpen` : par défaut, navigue dans la liste inline (stack/render).
      La modale du mode « Icône compacte » passe sa propre navigation. */
  function folderNode(node, tiles, badges, iconsOnly, onOpen) {
    const nav = onOpen || ((n) => { stack.push(n); render(); });
    const virtual = !!store.data.folderOverride[node.id];
    const virtualSub = isVirtualSubfolder(node.id);
    const b = el('button', {
      class: `${badges ? 'badge' : tiles ? 'tile' : 'row'}${iconsOnly ? ' is-icon-only' : ''}${virtual ? ' bm-virtual' : ''}`,
      type: 'button',
      title: virtual ? `${node.title}\n(classé ici dans Atelier seulement)` : node.title,
      style: { background: 'none', border: 0, cursor: 'pointer', font: 'inherit', width: '100%' },
      'data-bm-id': node.id,
      draggable: 'true',
      onclick: () => { if (isEditing()) return; nav(node); },
      oncontextmenu: (e) => { e.preventDefault(); openContextMenu(e.clientX, e.clientY, contextItems(node)); },
      ondragstart: (e) => {
        if (!isEditing()) return e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData(DND_TYPE, node.id);
        b.classList.add('dragging-bm');
      },
      ondragend: (e) => { e.stopPropagation(); b.classList.remove('dragging-bm'); },
    });
    b.append(el('span', { class: 'glyph', text: virtualSub ? '📁' : '▸' }));
    if (!badges && !iconsOnly) b.append(el('span', { class: 'label', text: node.title || '(sans nom)' }));
    return b;
  }

  const refresh = () => render();
  chrome.bookmarks.onCreated.addListener(refresh);
  chrome.bookmarks.onRemoved.addListener(refresh);
  chrome.bookmarks.onChanged.addListener(refresh);
  chrome.bookmarks.onMoved.addListener(refresh);
  liveBrowsers.add(render);

  wireDrop();
  wireContextMenu();
  render();

  return {
    render,
    resetStack() { stack = []; },
    stop() {
      alive = false;
      liveBrowsers.delete(render);
      chrome.bookmarks.onCreated.removeListener(refresh);
      chrome.bookmarks.onRemoved.removeListener(refresh);
      chrome.bookmarks.onChanged.removeListener(refresh);
      chrome.bookmarks.onMoved.removeListener(refresh);
    },
  };
}

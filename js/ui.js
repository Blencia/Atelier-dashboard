/* Petits utilitaires partagés. Rien ici ne connaît la config. */

/** el('div', {class:'x', onclick:fn}, [enfants|texte]) */
export function el(tag, attrs = {}, kids = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v; // réservé au markup statique
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of [].concat(kids)) {
    if (kid === null || kid === undefined || kid === false) continue;
    node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** Favicon servi par Chrome. Exige la permission "favicon" dans le manifeste. */
export function faviconUrl(pageUrl, size = 32) {
  const u = new URL(chrome.runtime.getURL('/_favicon/'));
  u.searchParams.set('pageUrl', pageUrl);
  u.searchParams.set('size', String(size));
  return u.toString();
}

export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Première lettre utilisable, pour la pastille de repli. */
export function initial(title, url) {
  const src = (title || hostOf(url) || '?').trim();
  return (src[0] || '?').toUpperCase();
}

/** Ouvre un lien selon la préférence, en respectant ctrl/cmd/molette. */
export function openLink(url, openIn, ev) {
  const newTab = openIn === 'new' || ev?.ctrlKey || ev?.metaKey || ev?.button === 1;
  if (newTab) {
    ev?.preventDefault();
    if (chrome.tabs?.create) chrome.tabs.create({ url, active: !ev?.shiftKey });
    else window.open(url, '_blank', 'noopener');
  }
  // sinon : on laisse le <a href> faire son travail
}

/* ---------- Arbre des favoris ---------- */

/** Liste plate des dossiers, avec chemin lisible. */
export async function listFolders() {
  const tree = await chrome.bookmarks.getTree();
  const out = [];
  const walk = (node, depth, path) => {
    for (const child of node.children || []) {
      if (child.url) continue;
      const label = child.title || '(sans nom)';
      const full = path ? `${path} / ${label}` : label;
      out.push({ id: child.id, title: label, path: full, depth });
      walk(child, depth + 1, full);
    }
  };
  walk(tree[0], 0, '');
  return out;
}

/** Retrouve un dossier par son chemin — utile après un import sur un autre profil. */
export async function findFolderByPath(path) {
  if (!path) return null;
  const folders = await listFolders();
  return folders.find((f) => f.path === path) || null;
}

export async function countBookmarks() {
  const tree = await chrome.bookmarks.getTree();
  let n = 0;
  const walk = (node) => {
    for (const c of node.children || []) {
      if (c.url) n++;
      else walk(c);
    }
  };
  walk(tree[0]);
  return n;
}

/* ---------- Modale ---------- */

const root = () => document.getElementById('modalRoot');

export function openModal({ title, body, footer, onClose }) {
  const host = root();
  clear(host);
  host.hidden = false;

  const onBackdrop = (e) => { if (e.target === host) close(); };
  const close = () => {
    host.hidden = true;
    clear(host);
    document.removeEventListener('keydown', onKey);
    host.removeEventListener('click', onBackdrop);
    onClose?.();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
  };
  document.addEventListener('keydown', onKey);

  const modal = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' }, [
    el('div', { class: 'modal-head' }, [
      el('h2', { text: title }),
      el('button', { class: 'btn btn-ghost', type: 'button', 'aria-label': 'Fermer', onclick: close, text: '✕' }),
    ]),
    el('div', { class: 'modal-body' }, [body]),
    footer ? el('div', { class: 'modal-foot' }, [footer]) : null,
  ]);

  host.addEventListener('click', onBackdrop);
  host.append(modal);
  modal.querySelector('input, select, textarea, button')?.focus();
  return close;
}

/* ---------- Toast ---------- */

let toastTimer;
export function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

export function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

/** Vrai pendant le mode plan. Les widgets s'en servent pour désarmer la
    navigation normale (clic sur un lien) sans désactiver le glisser. */
export function isEditing() {
  return document.body.classList.contains('is-editing');
}

/* ---------- Menu contextuel ---------- */

let closeCtxMenu = null;

/** items : [{label, onClick}] ou '-' pour un séparateur. */
export function openContextMenu(x, y, items) {
  closeCtxMenu?.();

  const menu = el('div', { class: 'ctx-menu', style: { left: `${x}px`, top: `${y}px` } });
  for (const item of items) {
    if (item === '-') { menu.append(el('div', { class: 'ctx-sep' })); continue; }
    menu.append(el('button', {
      class: 'ctx-item', type: 'button', text: item.label,
      onclick: () => { close(); item.onClick(); },
    }));
  }
  document.body.append(menu);

  requestAnimationFrame(() => {
    const r = menu.getBoundingClientRect();
    if (r.right > window.innerWidth) menu.style.left = `${Math.max(4, window.innerWidth - r.width - 8)}px`;
    if (r.bottom > window.innerHeight) menu.style.top = `${Math.max(4, window.innerHeight - r.height - 8)}px`;
  });

  const onDocDown = (e) => { if (!menu.contains(e.target)) close(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  function close() {
    menu.remove();
    document.removeEventListener('mousedown', onDocDown, true);
    document.removeEventListener('keydown', onKey);
    if (closeCtxMenu === close) closeCtxMenu = null;
  }
  closeCtxMenu = close;
  // Différé : évite que le mousedown du clic droit qui ouvre le menu le referme aussitôt.
  setTimeout(() => {
    document.addEventListener('mousedown', onDocDown, true);
    document.addEventListener('keydown', onKey);
  }, 0);
  return close;
}

/* Config : lecture/écriture dans chrome.storage.local + abonnements.
   Le fond d'écran vit dans une clé séparée pour garder l'export léger. */

const KEY = 'config';
const WALL = 'wallpaper';
export const SCHEMA_VERSION = 2;

function uid(prefix = 'w') {
  return prefix + Math.random().toString(36).slice(2, 9);
}

function defaultBoard() {
  return { id: uid('b'), name: 'Principal', widgets: [], theme: null };
}

export const DEFAULT_CONFIG = {
  version: SCHEMA_VERSION,
  theme: {
    mode: 'dark',
    accent: '#e3a008',
    density: 'comfy',
    radius: 6,
    showGrid: false,
    showLabels: true,
    wallpaperDim: 55,
  },
  layout: { cols: 12, gap: 14, row: 132, maxWidth: 1440 },
  search: {
    engine: 'https://www.google.com/search?q=%s',
    openIn: 'current',
  },
  aliases: {},
  boards: [defaultBoard()],
  activeBoard: null, // résolu vers boards[0].id à la migration
};

export function makeWidget(type, settings = {}, size = {}) {
  return {
    id: uid(),
    type,
    w: size.w ?? 3,
    h: size.h ?? 2,
    settings,
  };
}

function sanitizeWidgets(list) {
  return (Array.isArray(list) ? list : [])
    .filter((w) => w && typeof w.type === 'string')
    .map((w) => ({
      id: w.id || uid(),
      type: w.type,
      w: clamp(+w.w || 3, 1, 12),
      h: clamp(+w.h || 2, 1, 6),
      settings: w.settings && typeof w.settings === 'object' ? w.settings : {},
    }));
}

function sanitizeBoard(b) {
  const theme = b && b.theme && typeof b.theme === 'object' && (b.theme.mode || b.theme.accent)
    ? {
        mode: b.theme.mode === 'light' ? 'light' : DEFAULT_CONFIG.theme.mode,
        accent: typeof b.theme.accent === 'string' ? b.theme.accent : DEFAULT_CONFIG.theme.accent,
      }
    : null;
  return {
    id: (b && b.id) || uid('b'),
    name: (b && typeof b.name === 'string' && b.name.trim()) || 'Sans titre',
    widgets: sanitizeWidgets(b && b.widgets),
    theme,
  };
}

function migrate(cfg) {
  if (!cfg || typeof cfg !== 'object') return migrate({});
  // Fusion superficielle par section : les nouvelles clés d'une version
  // future arrivent avec leur valeur par défaut sans écraser l'existant.
  const out = structuredClone(DEFAULT_CONFIG);
  for (const k of ['theme', 'layout', 'search']) {
    out[k] = { ...out[k], ...(cfg[k] || {}) };
  }
  out.aliases = cfg.aliases && typeof cfg.aliases === 'object' ? { ...cfg.aliases } : {};

  if (Array.isArray(cfg.boards) && cfg.boards.length) {
    // Schéma v2 : plusieurs feuilles.
    out.boards = cfg.boards.map(sanitizeBoard);
  } else if (Array.isArray(cfg.widgets)) {
    // Schéma v1 : une seule liste de modules à la racine — on l'enveloppe.
    out.boards = [{ ...defaultBoard(), name: 'Principal', widgets: sanitizeWidgets(cfg.widgets) }];
  } else {
    out.boards = [defaultBoard()];
  }

  out.activeBoard = out.boards.some((b) => b.id === cfg.activeBoard)
    ? cfg.activeBoard
    : out.boards[0].id;

  out.version = SCHEMA_VERSION;
  return out;
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

const listeners = new Set();

export const store = {
  data: structuredClone(DEFAULT_CONFIG),
  wallpaper: null,
  /* Compteur d'écritures locales : chrome.storage.onChanged se déclenche
     aussi dans l'onglet qui écrit, on ne veut pas recharger pour rien. */
  selfWrites: 0,

  async load() {
    const got = await chrome.storage.local.get([KEY, WALL]);
    this.data = migrate(got[KEY]);
    this.wallpaper = got[WALL] || null;
    return this.data;
  },

  /** Persiste et notifie. `silent` évite le re-rendu complet (ex. autosave notes). */
  async save({ silent = false } = {}) {
    this.selfWrites++;
    await chrome.storage.local.set({ [KEY]: this.data });
    if (!silent) listeners.forEach((fn) => fn(this.data));
  },

  async setWallpaper(dataUrl) {
    this.wallpaper = dataUrl;
    this.selfWrites++;
    if (dataUrl) await chrome.storage.local.set({ [WALL]: dataUrl });
    else await chrome.storage.local.remove(WALL);
    listeners.forEach((fn) => fn(this.data));
  },

  on(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  emit() {
    listeners.forEach((fn) => fn(this.data));
  },

  /** Le dashboard actif — celui qu'on affiche et qu'on édite. */
  board() {
    return this.data.boards.find((b) => b.id === this.data.activeBoard) || this.data.boards[0];
  },

  async addBoard(name) {
    const b = { id: uid('b'), name: name?.trim() || 'Sans titre', widgets: [], theme: null };
    this.data.boards.push(b);
    this.data.activeBoard = b.id;
    await this.save();
    return b;
  },

  async renameBoard(id, name) {
    const b = this.data.boards.find((x) => x.id === id);
    if (!b || !name?.trim()) return;
    b.name = name.trim();
    await this.save();
  },

  async setBoardTheme(id, theme) {
    const b = this.data.boards.find((x) => x.id === id);
    if (!b) return;
    b.theme = theme;
    await this.save();
  },

  /** Refuse de supprimer le dernier dashboard restant. */
  async removeBoard(id) {
    if (this.data.boards.length <= 1) return false;
    this.data.boards = this.data.boards.filter((b) => b.id !== id);
    if (this.data.activeBoard === id) this.data.activeBoard = this.data.boards[0].id;
    await this.save();
    return true;
  },

  async setActiveBoard(id) {
    if (!this.data.boards.some((b) => b.id === id) || id === this.data.activeBoard) return;
    this.data.activeBoard = id;
    await this.save();
  },

  widget(id) {
    return this.board().widgets.find((w) => w.id === id);
  },

  async patchWidget(id, patch, opts) {
    const w = this.widget(id);
    if (!w) return;
    Object.assign(w, patch);
    await this.save(opts);
  },

  async patchSettings(id, patch, opts) {
    const w = this.widget(id);
    if (!w) return;
    w.settings = { ...w.settings, ...patch };
    await this.save(opts);
  },

  async addWidget(w) {
    this.board().widgets.push(w);
    await this.save();
    return w;
  },

  async removeWidget(id) {
    const b = this.board();
    b.widgets = b.widgets.filter((w) => w.id !== id);
    await this.save();
  },

  async reorder(ids) {
    const b = this.board();
    const map = new Map(b.widgets.map((w) => [w.id, w]));
    b.widgets = ids.map((id) => map.get(id)).filter(Boolean);
    await this.save({ silent: true });
  },

  /** Alias local d'un favori (titre affiché seulement) — le vrai favori Chrome n'est jamais touché. */
  async setAlias(bookmarkId, text) {
    const clean = text?.trim();
    if (clean) this.data.aliases[bookmarkId] = clean;
    else delete this.data.aliases[bookmarkId];
    await this.save({ silent: true });
  },

  async bytesInUse() {
    try {
      return await chrome.storage.local.getBytesInUse(null);
    } catch {
      return 0;
    }
  },

  export() {
    return JSON.stringify({ ...this.data, version: SCHEMA_VERSION }, null, 2);
  },

  async import(json) {
    const parsed = JSON.parse(json);
    this.data = migrate(parsed);
    await this.save();
  },

  async reset() {
    this.data = migrate(structuredClone(DEFAULT_CONFIG));
    await chrome.storage.local.remove(WALL);
    this.wallpaper = null;
    await this.save();
  },
};

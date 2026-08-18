/* Config : lecture/écriture dans chrome.storage.local + abonnements.
   Le fond d'écran vit dans une clé séparée pour garder l'export léger. */

const KEY = 'config';
const WALL = 'wallpaper';
export const SCHEMA_VERSION = 1;

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
  widgets: [],
};

function uid() {
  return 'w' + Math.random().toString(36).slice(2, 9);
}

export function makeWidget(type, settings = {}, size = {}) {
  return {
    id: uid(),
    type,
    w: size.w ?? 3,
    h: size.h ?? 2,
    settings,
  };
}

function migrate(cfg) {
  if (!cfg || typeof cfg !== 'object') return structuredClone(DEFAULT_CONFIG);
  // Fusion superficielle par section : les nouvelles clés d'une version
  // future arrivent avec leur valeur par défaut sans écraser l'existant.
  const out = structuredClone(DEFAULT_CONFIG);
  for (const k of ['theme', 'layout', 'search']) {
    out[k] = { ...out[k], ...(cfg[k] || {}) };
  }
  out.widgets = Array.isArray(cfg.widgets) ? cfg.widgets : [];
  out.widgets = out.widgets
    .filter((w) => w && typeof w.type === 'string')
    .map((w) => ({
      id: w.id || uid(),
      type: w.type,
      w: clamp(+w.w || 3, 1, 12),
      h: clamp(+w.h || 2, 1, 6),
      settings: w.settings && typeof w.settings === 'object' ? w.settings : {},
    }));
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

  widget(id) {
    return this.data.widgets.find((w) => w.id === id);
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
    this.data.widgets.push(w);
    await this.save();
    return w;
  },

  async removeWidget(id) {
    this.data.widgets = this.data.widgets.filter((w) => w.id !== id);
    await this.save();
  },

  async reorder(ids) {
    const map = new Map(this.data.widgets.map((w) => [w.id, w]));
    this.data.widgets = ids.map((id) => map.get(id)).filter(Boolean);
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
    this.data = structuredClone(DEFAULT_CONFIG);
    await chrome.storage.local.remove(WALL);
    this.wallpaper = null;
    await this.save();
  },
};

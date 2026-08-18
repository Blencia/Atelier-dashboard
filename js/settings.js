import { store, makeWidget, clamp } from './store.js';
import { allWidgets, getWidget } from './registry.js';
import { el, clear, openModal, toast, listFolders } from './ui.js';

const ACCENTS = ['#e3a008', '#5eead4', '#f97362', '#8b9dff', '#b5cc4a', '#e879bd', '#9aa3af'];
const ENGINES = [
  ['https://www.google.com/search?q=%s', 'Google'],
  ['https://duckduckgo.com/?q=%s', 'DuckDuckGo'],
  ['https://www.bing.com/search?q=%s', 'Bing'],
  ['https://search.brave.com/search?q=%s', 'Brave'],
  ['https://www.perplexity.ai/search?q=%s', 'Perplexity'],
];

/* ============================================================
   Rendu de formulaire piloté par schéma
   ============================================================ */

let folderCache = null;

// L'utilisateur peut créer un dossier dans un autre onglet pendant que la modale est ouverte.
for (const ev of ['onCreated', 'onRemoved', 'onChanged', 'onMoved']) {
  chrome.bookmarks[ev].addListener(() => { folderCache = null; });
}

export async function renderFields(fields, values, onChange) {
  const host = el('div');

  const rebuild = async () => {
    clear(host);
    for (const f of fields) {
      if (f.when && !f.when(values)) continue;
      host.append(await renderField(f, values, async (key, val) => {
        values[key] = val;
        await onChange(key, val);
        if (f.gates) rebuild();   // ce champ pilote l'affichage d'autres champs
      }));
    }
  };

  await rebuild();
  return host;
}

async function renderField(f, values, set) {
  const id = `f_${f.key}_${Math.random().toString(36).slice(2, 6)}`;
  const val = values[f.key];

  if (f.type === 'boolean') {
    const input = el('input', { type: 'checkbox', id, checked: !!val });
    input.addEventListener('change', () => set(f.key, input.checked));
    return el('div', { class: 'field field-inline' }, [
      el('label', { for: id, text: f.label }), input,
    ]);
  }

  let control;

  if (f.type === 'select') {
    control = el('select', { id });
    for (const [v, label] of f.options) {
      control.append(el('option', { value: v, text: label, selected: String(v) === String(val) }));
    }
    control.addEventListener('change', () => set(f.key, control.value));
  } else if (f.type === 'folder') {
    folderCache ??= await listFolders();
    control = el('select', { id });
    control.append(el('option', { value: '', text: '— choisir un dossier —' }));
    for (const folder of folderCache) {
      control.append(el('option', {
        value: folder.id,
        text: `${'\u00A0\u00A0'.repeat(folder.depth)}${folder.title}`,
        selected: String(folder.id) === String(val),
      }));
    }
    control.addEventListener('change', async () => {
      const picked = folderCache.find((x) => x.id === control.value);
      values.folderPath = picked?.path || '';
      await set('folderPath', values.folderPath);
      await set(f.key, control.value || null);
    });
  } else if (f.type === 'range') {
    const out = el('span', { class: 'tb-val', text: String(val) });
    control = el('input', {
      type: 'range', id, min: f.min, max: f.max, step: f.step || 1, value: val,
    });
    control.addEventListener('input', () => { out.textContent = control.value; });
    control.addEventListener('change', () => set(f.key, +control.value));
    return el('div', { class: 'field' }, [
      el('label', { for: id }, [f.label, ' ', out]),
      control,
      f.hint ? el('p', { class: 'field-hint', text: f.hint }) : null,
    ]);
  } else if (f.type === 'number') {
    control = el('input', { type: 'number', id, min: f.min, max: f.max, value: val ?? 0 });
    control.addEventListener('change', () => set(f.key, clamp(+control.value || 0, f.min ?? 0, f.max ?? 9999)));
  } else if (f.type === 'color') {
    control = el('input', { type: 'color', id, value: val || '#000000' });
    control.addEventListener('change', () => set(f.key, control.value));
  } else {
    control = el('input', { type: 'text', id, value: val ?? '' });
    control.addEventListener('change', () => set(f.key, control.value));
  }

  return el('div', { class: 'field' }, [
    el('label', { for: id, text: f.label }),
    control,
    f.hint ? el('p', { class: 'field-hint', text: f.hint }) : null,
  ]);
}

/* ============================================================
   Réglages d'un module
   ============================================================ */

export async function openWidgetSettings(widgetId) {
  const widget = store.widget(widgetId);
  const def = getWidget(widget?.type);
  if (!widget || !def) return;

  const values = { ...def.defaults, ...widget.settings };
  const body = el('div');

  body.append(await renderFields(def.fields, values, async () => {
    await store.patchSettings(widget.id, values);
  }));

  body.append(el('p', { class: 'section-label', text: 'Dimensions' }));
  const dims = el('div', { class: 'field-row' });
  dims.append(
    numberField('Largeur (colonnes)', widget.w, 1, store.data.layout.cols, (v) =>
      store.patchWidget(widget.id, { w: v })),
    numberField('Hauteur (rangées)', widget.h, 1, 6, (v) =>
      store.patchWidget(widget.id, { h: v })),
  );
  body.append(dims);

  const footer = el('div', { style: { display: 'flex', gap: '8px', width: '100%' } }, [
    el('button', {
      class: 'btn btn-danger', type: 'button', text: 'Supprimer le module',
      onclick: async () => { await store.removeWidget(widget.id); close(); toast('Module supprimé'); },
    }),
    el('span', { style: { flex: '1' } }),
    el('button', { class: 'btn btn-primary', type: 'button', text: 'Fermer', onclick: () => close() }),
  ]);

  const close = openModal({ title: def.name, body, footer });
}

function numberField(label, value, min, max, onSet) {
  const input = el('input', { type: 'number', min, max, value });
  input.addEventListener('change', () => {
    const v = clamp(+input.value || min, min, max);
    input.value = v;
    onSet(v);
  });
  return el('div', { class: 'field' }, [el('label', { text: label }), input]);
}

/* ============================================================
   Ajouter un module
   ============================================================ */

export function openAddWidget() {
  const grid = el('div', { class: 'picker' });
  for (const def of allWidgets()) {
    grid.append(el('button', {
      type: 'button',
      onclick: async () => {
        const w = makeWidget(def.type, { ...def.defaults }, def.defaultSize);
        await store.addWidget(w);
        close();
        if (def.fields.length) openWidgetSettings(w.id);
      },
    }, [
      el('strong', { text: def.name }),
      el('small', { text: def.blurb }),
    ]));
  }
  const close = openModal({ title: 'Ajouter un module', body: grid });
}

/* ============================================================
   Réglages généraux
   ============================================================ */

export async function openSettings() {
  const t = store.data.theme;
  const l = store.data.layout;
  const s = store.data.search;
  const body = el('div');

  const save = () => store.save();

  /* — Apparence — */
  body.append(el('p', { class: 'section-label', text: 'Apparence' }));

  body.append(await renderFields([
    { key: 'mode', label: 'Thème', type: 'select', options: [['dark', 'Encre'], ['light', 'Papier']] },
    { key: 'density', label: 'Densité', type: 'select', options: [['comfy', 'Confortable'], ['compact', 'Compacte']] },
    { key: 'radius', label: 'Arrondi des coins', type: 'range', min: 0, max: 18 },
    { key: 'showGrid', label: 'Papier millimétré visible', type: 'boolean' },
    { key: 'showLabels', label: 'Titres sous les tuiles', type: 'boolean' },
  ], t, save));

  const swatches = el('div', { class: 'swatches' });
  const custom = el('input', { type: 'color', value: t.accent });
  const paint = (hex) => {
    t.accent = hex;
    custom.value = hex;
    [...swatches.children].forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.hex === hex)));
    save();
  };
  for (const hex of ACCENTS) {
    const b = el('button', {
      class: 'swatch', type: 'button', 'data-hex': hex,
      'aria-label': hex, 'aria-pressed': String(t.accent === hex),
      style: { background: hex },
      onclick: () => paint(hex),
    });
    swatches.append(b);
  }
  custom.addEventListener('change', () => paint(custom.value));
  swatches.append(custom);
  body.append(el('div', { class: 'field' }, [el('label', { text: 'Couleur d\'accent' }), swatches]));

  /* — Fond — */
  body.append(el('p', { class: 'section-label', text: 'Fond d\'écran' }));

  const file = el('input', { type: 'file', accept: 'image/*' });
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (!f) return;
    try {
      const dataUrl = await downscale(f, 2560, 0.82);
      await store.setWallpaper(dataUrl);
      toast('Fond d\'écran appliqué');
    } catch {
      toast('Image illisible');
    }
  });
  body.append(el('div', { class: 'field' }, [el('label', { text: 'Image' }), file]));

  body.append(await renderFields([
    { key: 'wallpaperDim', label: 'Assombrissement', type: 'range', min: 0, max: 95 },
  ], t, save));

  if (store.wallpaper) {
    body.append(el('button', {
      class: 'btn', type: 'button', text: 'Retirer le fond',
      onclick: async () => { await store.setWallpaper(null); toast('Fond retiré'); },
    }));
  }

  /* — Grille — */
  body.append(el('p', { class: 'section-label', text: 'Grille' }));
  body.append(await renderFields([
    { key: 'cols', label: 'Colonnes', type: 'range', min: 4, max: 16 },
    { key: 'gap', label: 'Espacement (px)', type: 'range', min: 4, max: 32, step: 2 },
    { key: 'row', label: 'Hauteur d\'une rangée (px)', type: 'range', min: 80, max: 240, step: 4 },
    { key: 'maxWidth', label: 'Largeur max (px)', type: 'range', min: 900, max: 2400, step: 20 },
  ], l, save));

  /* — Recherche — */
  body.append(el('p', { class: 'section-label', text: 'Recherche' }));
  body.append(await renderFields([
    {
      key: 'engine', label: 'Moteur de repli', type: 'select', options: ENGINES,
      hint: 'Utilisé quand ta recherche ne correspond à aucun favori.',
    },
    {
      key: 'openIn', label: 'Ouvrir les résultats', type: 'select',
      options: [['current', 'Dans cet onglet'], ['new', 'Dans un nouvel onglet']],
    },
  ], s, save));

  /* — Données — */
  body.append(el('p', { class: 'section-label', text: 'Données' }));
  const bytes = await store.bytesInUse();
  body.append(el('p', {
    class: 'field-hint',
    text: `Stockage local utilisé : ${(bytes / 1024).toFixed(0)} Ko. Tout reste sur cet appareil.`,
  }));

  const importFile = el('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' } });
  importFile.addEventListener('change', async () => {
    const f = importFile.files?.[0];
    if (!f) return;
    try {
      await store.import(await f.text());
      toast('Configuration importée');
    } catch {
      toast('Fichier invalide');
    }
  });

  body.append(el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' } }, [
    el('button', { class: 'btn', type: 'button', text: 'Exporter', onclick: exportConfig }),
    el('button', { class: 'btn', type: 'button', text: 'Importer', onclick: () => importFile.click() }),
    el('button', {
      class: 'btn btn-danger', type: 'button', text: 'Tout réinitialiser',
      onclick: async () => {
        if (confirm('Remettre la configuration à zéro ? Les favoris de Chrome ne sont pas touchés.')) {
          await store.reset();
          toast('Configuration réinitialisée');
        }
      },
    }),
    importFile,
  ]));

  openModal({ title: 'Réglages', body });
}

function exportConfig() {
  const blob = new Blob([store.export()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: `atelier-${new Date().toISOString().slice(0, 10)}.json` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Réduit une image avant stockage : une photo 8 Mo remplit vite le quota. */
function downscale(file, maxW, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        if (scale === 1 && file.size < 900_000) return resolve(reader.result);
        const canvas = el('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

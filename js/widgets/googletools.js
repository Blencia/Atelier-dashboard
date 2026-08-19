import { defineWidget } from '../registry.js';
import { el, clear, faviconUrl, initial, openLink } from '../ui.js';

/* Liste fixe : pas d'appel réseau, juste des liens vers les outils Google usuels. */
const TOOLS = [
  ['Gmail', 'https://mail.google.com/'],
  ['Agenda', 'https://calendar.google.com/'],
  ['Drive', 'https://drive.google.com/'],
  ['Docs', 'https://docs.google.com/document/u/0/'],
  ['Sheets', 'https://docs.google.com/spreadsheets/u/0/'],
  ['Slides', 'https://docs.google.com/presentation/u/0/'],
  ['Meet', 'https://meet.google.com/'],
  ['Photos', 'https://photos.google.com/'],
  ['Maps', 'https://maps.google.com/'],
  ['Keep', 'https://keep.google.com/'],
  ['Traduction', 'https://translate.google.com/'],
  ['Actualités', 'https://news.google.com/'],
];

defineWidget({
  type: 'googletools',
  name: 'Outils Google',
  blurb: 'Raccourcis vers Gmail, Drive, Agenda, etc. Aucune donnée transmise par l\'extension.',
  defaultSize: { w: 4, h: 2 },
  defaults: { view: 'tiles', tile: 76, icon: 26, openIn: 'current' },
  fields: [
    { key: 'view', label: 'Affichage', type: 'select', gates: true, options: [['tiles', 'Tuiles'], ['list', 'Liste']] },
    { key: 'tile', label: 'Largeur des tuiles', type: 'range', min: 56, max: 140, step: 4, when: (s) => s.view === 'tiles' },
    { key: 'icon', label: 'Taille des icônes', type: 'range', min: 16, max: 44, step: 2, when: (s) => s.view === 'tiles' },
    {
      key: 'openIn', label: 'Ouvrir les liens', type: 'select',
      options: [['current', 'Dans cet onglet'], ['new', 'Dans un nouvel onglet']],
    },
  ],
  title: () => 'Outils Google',

  mount(body, ctx) {
    const s = ctx.settings;
    const tiles = s.view === 'tiles';
    const wrap = el('div', { class: tiles ? 'bm-tiles' : 'bm-list' });
    if (tiles) {
      wrap.style.setProperty('--tile', `${s.tile}px`);
      wrap.style.setProperty('--icon', `${s.icon}px`);
    }

    for (const [label, url] of TOOLS) {
      const a = el('a', {
        class: tiles ? 'tile' : 'row',
        href: url,
        title: `${label}\n${url}`,
        onclick: (e) => openLink(url, s.openIn, e),
        onauxclick: (e) => openLink(url, s.openIn, e),
      });
      const img = el('img', { src: faviconUrl(url, tiles ? 48 : 32), alt: '', loading: 'lazy' });
      img.addEventListener('error', () => {
        img.replaceWith(el('span', { class: 'glyph', text: initial(label, url) }));
      });
      a.append(img, el('span', { class: 'label', text: label }));
      if (!tiles) a.append(el('span', { class: 'host', text: new URL(url).hostname.replace(/^www\./, '') }));
      wrap.append(a);
    }

    clear(body);
    body.append(wrap);
    return () => {};
  },
});

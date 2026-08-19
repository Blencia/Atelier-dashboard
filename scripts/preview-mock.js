/* ============================================================
   Bouchon de l'API Chrome — aperçu hors extension.
   Le reste du code est identique à l'extension réelle.
   ============================================================ */
(function () {
  // jsdom / vieux navigateurs
  window.structuredClone ||= (o) => JSON.parse(JSON.stringify(o));

  const B = {};
  let nextId = 100;

  function folder(title, parentId, children) {
    const id = String(nextId++);
    B[id] = { id, title, parentId, children: [] };
    for (const c of children) {
      const kid = typeof c === 'string' ? null : c;
      if (kid) B[id].children.push(kid(id));
    }
    return id;
  }
  const link = (title, url, added) => (parentId) => {
    const id = String(nextId++);
    B[id] = { id, title, url, parentId, dateAdded: added || Date.now() };
    return id;
  };
  const sub = (title, kids) => (parentId) => folder(title, parentId, kids);

  const rootId = folder('', null, [
    sub('Barre de favoris', [
      sub('Dev', [
        link('WordPress Developer Resources', 'https://developer.wordpress.org/', 5),
        link('Breakdance — Documentation', 'https://breakdance.com/documentation/', 9),
        link('SureCart Developer Docs', 'https://developer.surecart.com/', 8),
        link('MDN Web Docs', 'https://developer.mozilla.org/', 7),
        link('Can I use', 'https://caniuse.com/', 6),
        link('PHP: Manual', 'https://www.php.net/manual/en/', 4),
        link('Supabase Docs', 'https://supabase.com/docs', 3),
        link('Cloudflare Workers', 'https://developers.cloudflare.com/workers/', 2),
      ]),
      sub('Clients', [
        link('Centre canin des ruisseaux', 'https://centrecanindesruisseaux.com/', 9),
        link('GoBrien Production', 'https://gobrien.ca/', 8),
        link('Maison Nectar', 'https://maisonnectar.com/', 7),
        link('NorthTrucks', 'https://northtrucks.ca/', 6),
        link('PG Esthétique Mobile', 'https://pgesthetiquemobile.com/', 5),
        link('Mariève Bergeron — check-in', 'https://app.marievebergeron.com/', 4),
      ]),
      sub('Outils', [
        link('Hostinger hPanel', 'https://hpanel.hostinger.com/', 9),
        link('Cloudflare Dashboard', 'https://dash.cloudflare.com/', 8),
        link('Vercel', 'https://vercel.com/dashboard', 7),
        link('Figma', 'https://www.figma.com/files', 6),
        link('Canva', 'https://www.canva.com/', 5),
        link('Notion', 'https://www.notion.so/', 4),
        link('AppSumo', 'https://appsumo.com/account/products/', 3),
        link('Stripe', 'https://dashboard.stripe.com/', 2),
      ]),
      sub('Veille IA', [
        link('Claude', 'https://claude.ai/', 9),
        link('Anthropic — Docs', 'https://docs.claude.com/', 8),
        link('Hacker News', 'https://news.ycombinator.com/', 7),
        link('Product Hunt', 'https://www.producthunt.com/', 6),
      ]),
      link('Gmail', 'https://mail.google.com/', 9),
      link('Google Agenda', 'https://calendar.google.com/', 8),
    ]),
    sub('Autres favoris', [
      link('Radio-Canada', 'https://ici.radio-canada.ca/', 3),
      link('MétéoMédia', 'https://www.meteomedia.com/', 2),
    ]),
  ]);
  B[rootId].title = '';

  const hydrate = (id) => {
    const n = { ...B[id] };
    if (n.children) n.children = n.children.map(hydrate);
    return n;
  };
  const noop = () => ({ addListener() {}, removeListener() {} });

  /* Mise en page pré-remplie pour l'aperçu */
  const ids = Object.values(B);
  const byTitle = (t) => ids.find((n) => n.title === t && !n.url)?.id ?? null;
  const preset = {
    version: 2,
    theme: { mode: 'dark', accent: '#e3a008', density: 'comfy', radius: 6, showGrid: false, showLabels: true, wallpaperDim: 55 },
    layout: { cols: 12, gap: 14, row: 132, maxWidth: 1440 },
    search: { engine: 'https://www.google.com/search?q=%s', openIn: 'current' },
    aliases: {},
    activeBoard: 'b1',
    boards: [
      {
        id: 'b1', name: 'Principal', theme: null,
        widgets: [
          { id: 'w1', type: 'bookmarks', w: 5, h: 3, settings: { folderId: byTitle('Dev'), folderPath: 'Barre de favoris / Dev', view: 'tiles', tile: 78, icon: 26, sort: 'manual', limit: 0, openIn: 'current', showCrumbs: true } },
          { id: 'w2', type: 'bookmarks', w: 4, h: 3, settings: { folderId: byTitle('Clients'), folderPath: 'Barre de favoris / Clients', view: 'list', sort: 'manual', limit: 0, openIn: 'new', showCrumbs: true } },
          { id: 'w3', type: 'clock', w: 3, h: 1, settings: { label: 'Laval', date: true, seconds: false, hour12: false, tz2: 'Europe/Paris', tz2Label: 'Paris' } },
          { id: 'w4', type: 'notes', w: 3, h: 2, settings: { label: 'À faire', text: '— Repasser sur le calculateur de financement\n— Relancer pour les visuels\n— Tester le webhook SureCart' } },
          { id: 'w5', type: 'bookmarks', w: 4, h: 2, settings: { folderId: byTitle('Outils'), folderPath: 'Barre de favoris / Outils', view: 'badges', icon: 30, sort: 'manual', limit: 0, openIn: 'new', showCrumbs: true } },
          { id: 'w6', type: 'bookmarks', w: 3, h: 2, settings: { folderId: byTitle('Veille IA'), folderPath: 'Barre de favoris / Veille IA', view: 'compact', sort: 'manual', limit: 0, openIn: 'new', showCrumbs: true } },
          { id: 'w7', type: 'topsites', w: 5, h: 2, settings: { limit: 8, view: 'tiles', tile: 74, icon: 26, openIn: 'current' } },
          { id: 'w8', type: 'folder', w: 2, h: 1, settings: { folderId: byTitle('Clients'), folderPath: 'Barre de favoris / Clients', label: 'Clients' } },
          { id: 'w9', type: 'countdown', w: 3, h: 1, settings: { label: 'Réveillon', target: '2026-12-24T18:00', doneText: 'Joyeux Noël !' } },
        ],
      },
      {
        id: 'b2', name: 'Streaming', theme: { mode: 'dark', accent: '#8b9dff' },
        widgets: [
          { id: 'w10', type: 'googletools', w: 4, h: 2, settings: { view: 'tiles', tile: 76, icon: 26, openIn: 'new' } },
          { id: 'w11', type: 'weather', w: 3, h: 1, settings: { city: 'Montréal, QC', label: '' } },
          { id: 'w12', type: 'clock', w: 3, h: 1, settings: { label: 'Horloge', date: true, seconds: false, hour12: false } },
        ],
      },
    ],
  };

  const mem = {};
  try {
    const saved = localStorage.getItem('atelier-preview');
    Object.assign(mem, saved ? JSON.parse(saved) : { config: preset });
  } catch { Object.assign(mem, { config: preset }); }
  const persist = () => { try { localStorage.setItem('atelier-preview', JSON.stringify(mem)); } catch {} };

  window.chrome = {
    runtime: { getURL: (p) => 'preview://' + p },
    storage: {
      local: {
        async get(keys) {
          const list = keys == null ? Object.keys(mem) : [].concat(keys);
          return Object.fromEntries(list.filter((k) => k in mem).map((k) => [k, mem[k]]));
        },
        async set(obj) { Object.assign(mem, obj); persist(); },
        async remove(k) { [].concat(k).forEach((x) => delete mem[x]); persist(); },
        async getBytesInUse() { return JSON.stringify(mem).length; },
      },
      onChanged: noop(),
    },
    bookmarks: {
      async getTree() { return [hydrate(rootId)]; },
      async get(id) { return B[id] ? [{ ...B[id] }] : []; },
      async getChildren(id) { return (B[id]?.children || []).map((c) => ({ ...B[c] })); },
      async search({ query }) {
        const q = String(query).toLowerCase();
        return Object.values(B).filter((b) => b.url && (b.title.toLowerCase().includes(q) || b.url.toLowerCase().includes(q)));
      },
      onCreated: noop(), onRemoved: noop(), onChanged: noop(), onMoved: noop(),
    },
    topSites: {
      async get() {
        return [
          { title: 'Gmail', url: 'https://mail.google.com/' },
          { title: 'GitHub', url: 'https://github.com/' },
          { title: 'YouTube', url: 'https://www.youtube.com/' },
          { title: 'Claude', url: 'https://claude.ai/' },
          { title: 'Cloudflare', url: 'https://dash.cloudflare.com/' },
          { title: 'Hostinger', url: 'https://hpanel.hostinger.com/' },
          { title: 'Stripe', url: 'https://dashboard.stripe.com/' },
          { title: 'Figma', url: 'https://www.figma.com/' },
        ];
      },
    },
    tabs: { create({ url }) { window.open(url, '_blank', 'noopener'); } },
  };

  /* Dans l'extension, Chrome sert les favicons via /_favicon/.
     Ici on passe par un service public pour que l'aperçu ressemble au vrai. */
  window.__previewFavicon = (pageUrl, size) => {
    try {
      return `https://www.google.com/s2/favicons?domain=${new URL(pageUrl).hostname}&sz=${size >= 32 ? 64 : 32}`;
    } catch { return ''; }
  };
})();

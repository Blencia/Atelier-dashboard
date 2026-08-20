import { defineWidget } from '../registry.js';
import { el, clear, faviconUrl, hostOf, initial, openLink, debounce } from '../ui.js';

/* ---------- Horloge ---------- */

defineWidget({
  type: 'clock',
  name: 'Horloge',
  category: 'autre',
  blurb: 'Heure et date, format québécois.',
  defaultSize: { w: 3, h: 1 },
  defaults: { seconds: false, hour12: false, date: true, label: 'Horloge', tz2: '', tz2Label: '' },
  fields: [
    { key: 'label', label: 'Titre du module', type: 'text' },
    { key: 'hour12', label: 'Format 12 h (AM/PM)', type: 'boolean' },
    { key: 'seconds', label: 'Afficher les secondes', type: 'boolean' },
    { key: 'date', label: 'Afficher la date', type: 'boolean' },
    {
      key: 'tz2', label: 'Second fuseau horaire', type: 'text',
      hint: 'Nom IANA, ex. Europe/Paris ou Asia/Tokyo. Vide = désactivé.',
    },
    { key: 'tz2Label', label: 'Étiquette du second fuseau', type: 'text', when: (s) => !!s.tz2 },
  ],
  title: (w) => w.settings.label || 'Horloge',

  mount(body, ctx) {
    const s = ctx.settings;
    const time = el('div', { class: 'clock-time', text: '--:--' });
    const date = el('div', { class: 'clock-date' });
    const tz2 = el('div', { class: 'clock-tz2' });
    const wrap = el('div', { class: 'clock' }, [time, s.date ? date : null, s.tz2 ? tz2 : null]);
    clear(body);
    body.append(wrap);

    const tf = new Intl.DateTimeFormat('fr-CA', {
      hour: '2-digit', minute: '2-digit',
      second: s.seconds ? '2-digit' : undefined,
      hour12: !!s.hour12,
    });
    const df = new Intl.DateTimeFormat('fr-CA', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
    let tf2 = null;
    if (s.tz2) {
      try {
        tf2 = new Intl.DateTimeFormat('fr-CA', { hour: '2-digit', minute: '2-digit', hour12: !!s.hour12, timeZone: s.tz2 });
      } catch { tf2 = null; }
    }

    const tick = () => {
      const now = new Date();
      time.textContent = tf.format(now);
      if (s.date) date.textContent = df.format(now);
      if (s.tz2) tz2.textContent = tf2 ? `${s.tz2Label || s.tz2} · ${tf2.format(now)}` : 'Fuseau invalide';
    };
    tick();
    const id = setInterval(tick, s.seconds ? 1000 : 15000);
    return () => clearInterval(id);
  },
});

/* ---------- Compte à rebours ---------- */

defineWidget({
  type: 'countdown',
  name: 'Compte à rebours',
  category: 'autre',
  blurb: 'Temps restant jusqu\'à une date : rendez-vous, échéance.',
  defaultSize: { w: 3, h: 1 },
  defaults: { label: 'Compte à rebours', target: '', doneText: 'C\'est aujourd\'hui !' },
  fields: [
    { key: 'label', label: 'Titre du module', type: 'text' },
    { key: 'target', label: 'Date et heure cible', type: 'datetime' },
    { key: 'doneText', label: 'Texte à l\'échéance', type: 'text' },
  ],
  title: (w) => w.settings.label || 'Compte à rebours',

  mount(body, ctx) {
    const s = ctx.settings;
    const big = el('div', { class: 'countdown-big', text: '—' });
    const sub = el('div', { class: 'countdown-sub' });
    clear(body);
    body.append(el('div', { class: 'countdown' }, [big, sub]));

    if (!s.target) {
      sub.textContent = 'Choisis une date dans les réglages du module.';
      return () => {};
    }

    const targetMs = new Date(s.target).getTime();
    const df = new Intl.DateTimeFormat('fr-CA', { dateStyle: 'long', timeStyle: 'short' });

    const tick = () => {
      if (Number.isNaN(targetMs)) { big.textContent = '—'; sub.textContent = 'Date invalide.'; return; }
      const diff = targetMs - Date.now();
      if (diff <= 0) { big.textContent = '🎉'; sub.textContent = s.doneText || 'C\'est aujourd\'hui !'; return; }
      const days = Math.floor(diff / 86_400_000);
      const hours = Math.floor((diff % 86_400_000) / 3_600_000);
      const mins = Math.floor((diff % 3_600_000) / 60_000);
      big.textContent = days > 0 ? `${days} j` : hours > 0 ? `${hours} h ${mins} min` : `${mins} min`;
      sub.textContent = df.format(new Date(targetMs));
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  },
});

/* ---------- Bloc-notes ---------- */

defineWidget({
  type: 'notes',
  name: 'Bloc-notes',
  category: 'productivite',
  blurb: 'Un carré de texte sauvegardé automatiquement.',
  defaultSize: { w: 3, h: 2 },
  defaults: { label: 'Notes', text: '' },
  fields: [{ key: 'label', label: 'Titre du module', type: 'text' }],
  title: (w) => w.settings.label || 'Notes',

  mount(body, ctx) {
    const ta = el('textarea', {
      class: 'notes-area',
      placeholder: 'Écris ici. Sauvegarde automatique.',
      spellcheck: 'false',
    });
    ta.value = ctx.settings.text || '';
    // silent: true — on ne veut pas re-rendre la feuille à chaque frappe.
    const save = debounce(() => ctx.update({ text: ta.value }, { silent: true }), 400);
    ta.addEventListener('input', save);
    clear(body);
    body.append(ta);
    // Au démontage on écrit tout de suite : le debounce en attente serait perdu.
    return () => ctx.update({ text: ta.value }, { silent: true });
  },
});

/* ---------- Sites fréquents ---------- */

defineWidget({
  type: 'topsites',
  name: 'Sites fréquents',
  category: 'autre',
  blurb: 'Les sites que Chrome te voit visiter le plus.',
  defaultSize: { w: 4, h: 2 },
  defaults: { limit: 10, view: 'tiles', tile: 76, icon: 26, openIn: 'current' },
  fields: [
    { key: 'view', label: 'Affichage', type: 'select', gates: true, options: [['tiles', 'Tuiles'], ['list', 'Liste']] },
    { key: 'limit', label: 'Nombre max', type: 'number', min: 1, max: 30 },
    { key: 'tile', label: 'Largeur des tuiles', type: 'range', min: 56, max: 140, step: 4, when: (s) => s.view === 'tiles' },
    { key: 'icon', label: 'Taille des icônes', type: 'range', min: 16, max: 44, step: 2, when: (s) => s.view === 'tiles' },
    {
      key: 'openIn', label: 'Ouvrir les liens', type: 'select',
      options: [['current', 'Dans cet onglet'], ['new', 'Dans un nouvel onglet']],
    },
  ],
  title: () => 'Sites fréquents',

  mount(body, ctx) {
    const s = ctx.settings;
    let alive = true;

    chrome.topSites.get().then((sites) => {
      if (!alive) return;
      clear(body);
      if (!sites?.length) {
        body.append(el('p', { class: 'note', text: 'Chrome n\'a pas encore assez d\'historique.' }));
        return;
      }
      const tiles = s.view === 'tiles';
      const wrap = el('div', { class: tiles ? 'bm-tiles' : 'bm-list' });
      if (tiles) {
        wrap.style.setProperty('--tile', `${s.tile}px`);
        wrap.style.setProperty('--icon', `${s.icon}px`);
      }
      for (const site of sites.slice(0, s.limit)) {
        const label = site.title || hostOf(site.url);
        const a = el('a', {
          class: tiles ? 'tile' : 'row',
          href: site.url,
          title: `${label}\n${site.url}`,
          onclick: (e) => openLink(site.url, s.openIn, e),
        });
        const img = el('img', { src: faviconUrl(site.url, tiles ? 48 : 32), alt: '', loading: 'lazy' });
        img.addEventListener('error', () => {
          img.replaceWith(el('span', { class: 'glyph', text: initial(site.title, site.url) }));
        });
        a.append(img, el('span', { class: 'label', text: label }));
        if (!tiles) a.append(el('span', { class: 'host', text: hostOf(site.url) }));
        wrap.append(a);
      }
      body.append(wrap);
    }).catch(() => {
      if (alive) {
        clear(body);
        body.append(el('p', { class: 'note', text: 'Accès aux sites fréquents refusé.' }));
      }
    });

    return () => { alive = false; };
  },
});

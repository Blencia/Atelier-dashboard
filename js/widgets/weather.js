import { defineWidget } from '../registry.js';
import { el, clear } from '../ui.js';

/* Open-Meteo : gratuit, sans clé API. Seul widget de l'extension qui fait
   une requête réseau — voir docs/STORE.md pour la justification du
   host_permissions correspondant dans le manifeste. */

function weatherIcon(code) {
  if (code === 0) return '☀️';
  if (code === 1 || code === 2) return '⛅';
  if (code === 3) return '☁️';
  if (code === 45 || code === 48) return '🌫️';
  if ([51, 53, 55, 56, 57].includes(code)) return '🌦️';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return '🌧️';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return '🌨️';
  if ([95, 96, 99].includes(code)) return '⛈️';
  return '🌡️';
}

defineWidget({
  type: 'weather',
  name: 'Météo',
  blurb: 'Température et conditions actuelles, via Open-Meteo (aucune clé API).',
  defaultSize: { w: 3, h: 1 },
  defaults: { city: '', label: '', lat: null, lon: null, resolvedName: '', geocodedCity: '' },
  fields: [
    { key: 'city', label: 'Ville', type: 'text', hint: 'Ex. Saint-Hippolyte, QC' },
    { key: 'label', label: 'Titre du module (vide = ville)', type: 'text' },
  ],
  title: (w) => w.settings.label || w.settings.resolvedName || 'Météo',

  mount(body, ctx) {
    const s = ctx.settings;
    let alive = true;
    const wrap = el('div', { class: 'weather' });
    clear(body);
    body.append(wrap);

    async function geocode(city) {
      const u = new URL('https://geocoding-api.open-meteo.com/v1/search');
      u.searchParams.set('name', city);
      u.searchParams.set('count', '1');
      u.searchParams.set('language', 'fr');
      u.searchParams.set('format', 'json');
      const res = await fetch(u);
      if (!res.ok) throw new Error('geocode');
      const hit = (await res.json()).results?.[0];
      if (!hit) throw new Error('not-found');
      return { lat: hit.latitude, lon: hit.longitude, name: [hit.name, hit.admin1].filter(Boolean).join(', ') };
    }

    async function fetchCurrent(lat, lon) {
      const u = new URL('https://api.open-meteo.com/v1/forecast');
      u.searchParams.set('latitude', lat);
      u.searchParams.set('longitude', lon);
      u.searchParams.set('current', 'temperature_2m,weather_code');
      u.searchParams.set('timezone', 'auto');
      const res = await fetch(u);
      if (!res.ok) throw new Error('forecast');
      return (await res.json()).current;
    }

    async function load() {
      if (!s.city?.trim()) {
        clear(wrap);
        wrap.append(el('p', { class: 'note', text: 'Choisis une ville dans les réglages du module.' }));
        return;
      }
      clear(wrap);
      wrap.append(el('p', { class: 'note', text: 'Chargement…' }));
      try {
        let { lat, lon, resolvedName } = s;
        if (!lat || !lon || s.geocodedCity !== s.city) {
          const g = await geocode(s.city);
          lat = g.lat; lon = g.lon; resolvedName = g.name;
          await ctx.update({ lat, lon, resolvedName, geocodedCity: s.city }, { silent: true });
        }
        const cur = await fetchCurrent(lat, lon);
        if (!alive) return;
        clear(wrap);
        wrap.append(
          el('div', { class: 'weather-icon', text: weatherIcon(cur.weather_code) }),
          el('div', { class: 'weather-temp', text: `${Math.round(cur.temperature_2m)}°C` }),
          el('div', { class: 'weather-place', text: resolvedName || s.city }),
        );
      } catch {
        if (!alive) return;
        clear(wrap);
        wrap.append(el('p', { class: 'note', text: 'Météo indisponible. Vérifie la ville ou ta connexion.' }));
      }
    }

    load();
    const id = setInterval(load, 15 * 60_000);
    return () => { alive = false; clearInterval(id); };
  },
});

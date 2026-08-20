/* Registre des modules.
   Pour en ajouter un : crée js/widgets/mon-module.js, appelle defineWidget(),
   puis importe le fichier dans js/app.js. C'est tout. */

const defs = new Map();

/** Catégories affichées dans « Ajouter un module », dans cet ordre. Un
    module sans `category` reconnue tombe dans « Autre ». La liste est
    appelée à grandir au fil des nouveaux modules — voir groupedVisibleWidgets. */
export const CATEGORIES = [
  ['principal', 'Principal'],
  ['productivite', 'Productivité'],
  ['autre', 'Autre'],
];
const DEFAULT_CATEGORY = 'autre';

/**
 * @param {object} def
 * @param {string} def.type            identifiant stable, stocké dans la config
 * @param {string} def.name            nom affiché dans « Ajouter un module »
 * @param {string} def.blurb           une ligne de description
 * @param {string} [def.category]      groupe dans « Ajouter un module », voir CATEGORIES
 * @param {{w:number,h:number}} def.defaultSize
 * @param {object} def.defaults        réglages par défaut
 * @param {Array}  def.fields          schéma du formulaire de réglages
 * @param {(w:object)=>string} def.title  titre affiché dans l'en-tête
 * @param {(body:HTMLElement, ctx:object)=>(void|Function)} def.mount
 *        rend le contenu ; peut retourner une fonction de nettoyage
 */
export function defineWidget(def) {
  defs.set(def.type, {
    defaultSize: { w: 3, h: 2 },
    defaults: {},
    fields: [],
    category: DEFAULT_CATEGORY,
    title: (w) => def.name,
    ...def,
  });
}

export const getWidget = (type) => defs.get(type);
export const allWidgets = () => [...defs.values()];
/** Comme allWidgets(), sans les types cachés (alias gardés pour compatibilité
    arrière — ex. l'ancien type "bookmarks", fusionné dans "folder"). */
export const visibleWidgets = () => [...defs.values()].filter((d) => !d.hidden);
/** visibleWidgets(), regroupés par catégorie dans l'ordre de CATEGORIES —
    pour « Ajouter un module ». Les catégories sans module visible sont omises. */
export function groupedVisibleWidgets() {
  const visible = visibleWidgets();
  return CATEGORIES
    .map(([key, label]) => [key, label, visible.filter((d) => (d.category || DEFAULT_CATEGORY) === key)])
    .filter(([, , list]) => list.length);
}

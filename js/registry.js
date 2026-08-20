/* Registre des modules.
   Pour en ajouter un : crée js/widgets/mon-module.js, appelle defineWidget(),
   puis importe le fichier dans js/app.js. C'est tout. */

const defs = new Map();

/**
 * @param {object} def
 * @param {string} def.type            identifiant stable, stocké dans la config
 * @param {string} def.name            nom affiché dans « Ajouter un module »
 * @param {string} def.blurb           une ligne de description
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
    title: (w) => def.name,
    ...def,
  });
}

export const getWidget = (type) => defs.get(type);
export const allWidgets = () => [...defs.values()];
/** Comme allWidgets(), sans les types cachés (alias gardés pour compatibilité
    arrière — ex. l'ancien type "bookmarks", fusionné dans "folder"). */
export const visibleWidgets = () => [...defs.values()].filter((d) => !d.hidden);

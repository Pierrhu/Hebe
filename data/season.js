// season.js — v226 : plats de saison.
// Les plats « froid » (mijotés, crèmes, courges, châtaignes, soupes d'hiver) ne sortent que d'octobre à avril,
// les plats « chaud » (salades et bols froids, tomates cerises, herbes fraîches) que de mai à septembre.
// Tous les autres plats sortent toute l'année. Le Catalogue montre toujours toutes les recettes.

const COLD = [
  'W63', 'W81', 'W82', 'W84', 'W85', 'W89', 'W90', 'W93', 'W94', 'W95', 'W97', 'W98', 'W101',
  'W102', 'W104', 'W105', 'W106', 'W107', 'W109', 'W110', 'W114', // v281
  'SO04', 'SO06', 'SO07', 'SO08', 'SO09', 'SO10', 'SO11', 'SO15',
  'K23', 'K24',
];
const WARM = ['W02', 'W19', 'W47', 'W52', 'W53', 'W59'];

const COLD_MONTHS = [10, 11, 12, 1, 2, 3, 4];
const WARM_MONTHS = [5, 6, 7, 8, 9];

// Saison d'une recette : 'froid', 'chaud' ou null (toute l'année). Les versions sans whey suivent leur recette.
export function seasonOf(r) {
  const id = r?.wheyOf || r?.id;
  if (COLD.includes(id)) return 'froid';
  if (WARM.includes(id)) return 'chaud';
  return null;
}

// La recette est-elle de saison à cette date (« AAAA-MM-JJ », un objet Date, ou aujourd'hui) ?
export function inSeason(r, when = new Date()) {
  const s = seasonOf(r);
  if (!s) return true;
  const month = typeof when === 'string' ? +when.slice(5, 7) : when.getMonth() + 1;
  return (s === 'froid' ? COLD_MONTHS : WARM_MONTHS).includes(month);
}

// Filtre de saison, sans jamais trop vider la liste : en dessous de `min` recettes, on garde la liste entière
export function seasonal(list, when, min = 1) {
  const f = list.filter(r => inSeason(r, when));
  return f.length >= min ? f : list;
}

// v306 : fruit de la semaine. Pierre : « des suggestions de fruit, plus précis, ça changerait d'une semaine à l'autre ».
// Mois de pleine saison en France (fruits de France, ou d'Espagne et d'Italie pour les agrumes).
export const FRUIT_MONTHS = {
  F01: [11, 12, 1, 2],     // clémentines
  F02: [11, 12, 1, 2, 3, 4], // kiwis
  F03: [12, 1, 2, 3, 4],   // oranges
  F04: [10, 11, 12],       // kakis
  F05: [9, 10],            // raisin
  F06: [5, 6],             // fraises
  F07: [6, 7],             // abricots
  F08: [7, 8, 9],          // pêches
  F09: [8, 9],             // prunes
  F10: [1, 2, 3, 4],       // pamplemousse
  F11: [9, 10, 11, 12, 1, 2, 3, 4], // pommes
  F12: [8, 9, 10, 11, 12, 1], // poires
};
// Fruit de la semaine qui commence à `date` (« AAAA-MM-JJ ») : un fruit de saison, différent d'une semaine à
// l'autre (rotation sur les fruits du mois), parmi ceux qui conviennent (`ok`). null : aucun, on garde le fruit de saison.
// Le même fruit toute la semaine (du lundi au dimanche), même quand elle est à cheval sur deux mois.
export function fruitOfWeek(date, ok = () => true) {
  const days = Math.floor(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) / 864e5);
  const week = Math.floor((days + 3) / 7); // le 1er janvier 1970 était un jeudi : semaines du lundi au dimanche
  const month = new Date((week * 7 - 3) * 864e5).getUTCMonth() + 1; // mois du lundi
  const list = Object.keys(FRUIT_MONTHS).filter(id => FRUIT_MONTHS[id].includes(month) && ok(id));
  if (!list.length) return null;
  return list[week % list.length];
}

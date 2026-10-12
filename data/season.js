// season.js — v226 : plats de saison.
// Les plats « froid » (mijotés, crèmes, courges, châtaignes, soupes d'hiver) ne sortent que d'octobre à avril,
// les plats « chaud » (salades et bols froids, tomates cerises, herbes fraîches) que de mai à septembre.
// Tous les autres plats sortent toute l'année. Le Catalogue montre toujours toutes les recettes.

const COLD = [
  'W63', 'W81', 'W82', 'W84', 'W85', 'W89', 'W90', 'W93', 'W94', 'W95', 'W97', 'W98', 'W101',
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

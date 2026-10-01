// prefs.js — Tes goûts : 👍 / 👎 sur les recettes.
//   👍 : la recette sort plus souvent au tirage
//   👎 : la recette ne sort plus (sauf s'il ne reste rien d'autre)

const RATINGS_KEY = 'hebe_ratings';

export function getRatings() {
  try { return JSON.parse(localStorage.getItem(RATINGS_KEY) || '{}'); } catch { return {}; }
}
export function getRating(id) { return getRatings()[id] || 0; }
export function setRating(id, value) {
  const r = getRatings();
  if (!value || r[id] === value) delete r[id]; else r[id] = value;
  localStorage.setItem(RATINGS_KEY, JSON.stringify(r));
  return r[id] || 0;
}

// weekgen.js — Génère une semaine pensée pour le batch cooking.
//
// Organisation :
//   Session 1 (dimanche)  → plats pour lundi, mardi, mercredi
//   Session 2 (mercredi)  → plats pour jeudi → dimanche
// Chaque session = 2 plats (parfois 3) cuisinés en plusieurs portions IDENTIQUES.
// Midi et soir sont interchangeables : on ne mange jamais le même plat deux fois le même jour.
//
// Règles de choix des plats :
//   - variété : pas deux fois la même protéine si possible, féculents variés
//   - tirage aléatoire pondéré (variété des protéines/féculents, plats récents évités)
//   - poisson frais (saumon, colin, crevettes) : max 1 plat, dans la session 1, mangé sous 2 jours
//   - coût visé ~60 €, semaines > 70 € retirées
//
// Portions : chaque plat est calibré UNE fois (js/optimizer.js) dans des bornes réalistes.
// Les collations s'adaptent jour par jour pour boucler les objectifs.

import { dietOk, householdLactose, householdGluten, lactoseOf, glutenOf, applyDiet, proteinBoost } from './diet.js';
import { getMains, getSweets, getBreakfasts, getById, hasWhey, proteinFamily, isFreshFish, mainStarch } from '../data/recipes.js';
import { INGREDIENTS, ingCost, NATURAL_UNITS } from '../data/ingredients.js';
import { optimizeRecipe, calibratePlate, plateTarget, portionScale, plateFloor, mainProteinIdx, PLATE_SHARE, breakfastTarget, computeMealMacros, subtractMacros, fillRemainder, itemQuantities, CHARC_MAX, CHARC_KEYS, charcOfEntry, charcGrams, RED_MEAT_KEYS, calciumPer100kcal } from './optimizer.js';
import { weekMicros } from './micros.js';
import { getWeekDates, getNextWeekDates, getTodayDate, getEntry, saveEntry, localYMD } from '../data/log.js';
import { getRating } from '../data/prefs.js';
import { USER } from '../data/user.js';
import { isAvailable } from './adapt.js';
import { getActiveMember, getMembers, weekBudget } from '../data/household.js';

const PLAN_KEY = 'hebe_week_plan';
export function getWeekPlan() {
  try { return JSON.parse(localStorage.getItem(PLAN_KEY) || 'null'); } catch { return null; }
}
function saveWeekPlan(p) { localStorage.setItem(PLAN_KEY, JSON.stringify(p)); }
// Plan affiché : le dernier généré, tant que sa semaine n'est pas terminée.
export function getActivePlan() {
  const plan = getWeekPlan();
  if (!plan || !plan.dates || !plan.sessions) return null;
  return plan.dates[plan.dates.length - 1] >= getTodayDate() ? plan : null;
}

// Objectifs d'une personne pour la semaine générée (anciens plans : objectifs uniques)
export const planTargets = (plan, memberId) => plan?.targetsBy?.[memberId || getActiveMember().id] || plan?.targets || USER.targets;
// Personnes concernées par le plan (anciens plans : la personne active seulement)
// Part de chaque plat selon la formule de la personne (jeûne 40 %, classique 32 %)
export const planShare = (plan, memberId) => PLATE_SHARE[plan?.formulaBy?.[memberId || getActiveMember().id] || 'jeune'] || 0.40;
export const planMembers = plan => (plan?.members && plan.members.length ? plan.members : [getActiveMember().id]);

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Légumes frais d'une recette (le surgelé et les conserves ne comptent pas pour l'anti-gaspi)
const FRESH_VEG = ['courgette', 'poivron', 'carotte', 'tomates_cerise', 'champignons', 'concombre', 'salade', 'avocat', 'patate_douce'];
const freshVeg = r => new Set(r.ingredients.map(i => i.key).filter(k => FRESH_VEG.includes(k)));

// Coût réel d'un item planifié (avec ses quantités ajustées)
export function itemCost(item) {
  const r = getById(item.id);
  if (!r || (r.tags || []).includes('cantine')) return 0;
  const qs = itemQuantities(item);
  return r.ingredients.reduce((a, ing, i) => a + ingCost(ing.key, qs[i]), 0);
}

// ── Tirage d'un plat : VRAIMENT aléatoire, pondéré seulement pour la variété ──
//   - même famille de protéine déjà choisie → beaucoup moins probable
//   - même féculent → un peu moins probable
//   - plat mangé récemment (semaines précédentes / régénération) → très peu probable
//   - poisson frais : 1 max par semaine, session 1 seulement
// ── Conservation : tout est cuisiné en une seule session, le dimanche ──
// Lundi, mardi et mercredi : boîtes au frigo (1 à 3 jours). Au-delà : boîtes congelées, décongelées la veille au frigo.
// Poisson et fruits de mer : mangés lundi ou mardi. Plats qui ne se congèlent pas bien (frites, panures
// croustillantes, crudités et sauces au yaourt dans la boîte) : mangés dans les 3 premiers jours.
export const FRESH_ONLY = ['W02', 'W04', 'W09', 'W10', 'W11', 'W13', 'W15', 'W19', 'W31', 'W33', 'W35', 'W36', 'W40', 'W41', 'W42', 'W74'];
export const FRIDGE_DAYS = 3;
const isFreshOnly = r => FRESH_ONLY.includes(r.id);
const deadlineOf = r => (isFreshFish(r) ? 1 : isFreshOnly(r) ? FRIDGE_DAYS - 1 : 99);
// une boîte mangée le jour dayIdx (0 = lundi) passe par le congélateur si elle dépasse 3 jours de frigo
export const goesToFreezer = (r, dayIdx) => dayIdx >= FRIDGE_DAYS && !isFreshFish(r) && !isFreshOnly(r);
// Viande rouge (repère : 500 g cuits par semaine au plus) : un seul plat de bœuf par semaine, mangé 2 fois au plus.
// Les plus grosses assiettes portent environ 330 g de bœuf cru, soit 660 g crus (≈ 500 g cuits) sur la semaine.
const isRedMeat = r => r.ingredients.some(i => RED_MEAT_KEYS.includes(i.key));
// v174 (demande de Pierre) : jusqu'à 2 plats de bœuf par semaine, 3 repas au total (2 au plus pour un même plat).
// Soit ~1 kg cru (~750 g cuits) pour une grosse assiette : au-dessus du repère de 500 g cuits, choix assumé.
const RED_MEAT_DISHES = 1, RED_MEAT_MEALS = 4, RED_MEAT_PER_DISH = 4; // v184 : un plat de bœuf par semaine, jusqu'à 4 portions (portions homogènes)
// Portions homogènes (v184) : au moins 2 portions par plat, au plus 2 portions d'écart entre les plats
const MIN_PORTIONS = 2, MAX_SPREAD = 2;
// Variété des glucides : familles de féculents ; 2 plats au plus de la même famille par semaine
const STARCH_FAMILY = {
  riz: 'riz', riz_blanc: 'riz', nouilles_riz: 'riz',
  pates: 'pates', pates_classiques: 'pates', nouilles_oeufs: 'pates', orzo: 'pates', pates_sg: 'pates',
  pain: 'pain', farine: 'pain', pita: 'pain', baguette: 'pain', tortilla: 'pain', pain_burger: 'pain', pain_sg: 'pain', wrap_sg: 'pain',
  pdt: 'pdt', patate_douce: 'pdt', gnocchis: 'pdt',
  boulghour: 'cereale', semoule: 'cereale', quinoa: 'cereale',
};
const starchFamily = r => STARCH_FAMILY[mainStarch(r)] || mainStarch(r) || 'autre';
const STARCH_MAX = 3;
const FITS = new Map(); // plat × assiette → peut remplir l'assiette (voir generateWeekOnce)
// v191 : produits vendus en gros paquet pour de petites quantités (lait de coco, feta…) : si la semaine en contient,
// les autres plats, collations et petits-déjeuners qui les utilisent sont favorisés, pour finir le paquet
export const SHARE_KEYS = ['lait_coco', 'creme_coco', 'feta', 'fromage_frais', 'carre_frais', 'creme', 'houmous', 'cottage', 'avocat',
  'tortilla', 'pita', 'pain_burger', 'jambon_blanc', 'poulet_tranches', 'fromage_blanc', 'yaourt_grec'];
const SHARE_BONUS = 3;
const recipeKeysOf = r => (r?.ingredients || []).map(i => i.key);
const sharesWith = (r, keys) => keys.size && recipeKeysOf(r).some(k => keys.has(k));
const shareKeysOf = recs => new Set(recs.flatMap(recipeKeysOf).filter(k => SHARE_KEYS.includes(k)));
// produits qui se gardent au moins 2 semaines (carrés frais emballés à l'unité ; pains, wraps, lait de coco et feta au congélateur) :
// le reste est reporté à la semaine suivante, qui favorise les recettes qui l'utilisent (mémoire hebe_leftovers)
export const KEEP_2W = ['carre_frais', 'tortilla', 'pita', 'pain_burger', 'pain', 'baguette', 'lait_coco', 'feta']; // lait de coco (bac à glaçons) et feta émiettée : au congélateur
const LEFT_KEY = 'hebe_leftovers';
const getLeftovers = () => { try { return JSON.parse(localStorage.getItem(LEFT_KEY) || '{}'); } catch { return {}; } };

function pickMain(pool, chosen, { allowFish, served = { n: 0, last: {} }, earlySlots = 6, fishSlots = 4, extraKeys = [] }) {
  const prefer = new Set([...shareKeysOf(chosen), ...extraKeys]);
  // 👎 : jamais tiré, sauf s'il ne reste vraiment rien d'autre
  const liked = pool.filter(r => getRating(r.id) >= 0);
  if (liked.length >= 4) pool = liked;
  // Ce qui ne se congèle pas se mange dans les 3 premiers jours (6 repas) : au plus un poisson frais,
  // et 2 plats « à manger frais » (un seul s'il y a déjà un poisson frais, qui prend aussi des premiers jours).
  // … et seulement s'il reste assez de repas dans ces 3 jours (des midis libres en réduisent le nombre) : 2 portions par plat
  // earlySlots = jours cuisinés parmi les 3 premiers : chaque plat frais y prend au moins 2 jours, 2 plats peuvent partager un jour (midi et soir)
  const freshOnlyMax = earlySlots < MIN_PORTIONS ? 0 : Math.min(chosen.some(isFreshFish) ? 1 : 2, Math.floor(earlySlots * 2 / MIN_PORTIONS / (chosen.some(isFreshFish) ? 2 : 1)));
  const nFreshOnly = chosen.filter(isFreshOnly).length;
  if (fishSlots < MIN_PORTIONS) allowFish = false; // pas assez de repas les 2 premiers jours pour un poisson frais
  let cands = pool.filter(r => !chosen.some(c => c.id === r.id) && (allowFish || !isFreshFish(r))
    && !(isFreshFish(r) && (chosen.some(isFreshFish) || nFreshOnly >= 2))
    && !(isFreshOnly(r) && nFreshOnly >= freshOnlyMax));
  // un seul plat de bœuf par semaine (sauf si on n'a choisi que du bœuf comme protéine)
  if (chosen.filter(isRedMeat).length >= RED_MEAT_DISHES && cands.some(r => !isRedMeat(r))) cands = cands.filter(r => !isRedMeat(r));
  // garde-fou : jamais plus de 2 plats de la même famille de féculents dans la semaine (s'il reste d'autres choix)
  const famCount = f => chosen.filter(c => starchFamily(c) === f).length;
  if (cands.some(r => famCount(starchFamily(r)) < STARCH_MAX)) cands = cands.filter(r => famCount(starchFamily(r)) < STARCH_MAX);
  if (!cands.length) return null;
  // Répartition uniforme (v176) : chaque plat a la même chance au départ, puis un tour de rôle.
  // Un plat servi il y a « age » semaines pèse (age / cycle)⁴, plafonné à 1, où cycle ≈ le nombre de semaines
  // pour faire le tour de tous les plats possibles. Plus un plat attend, plus il a de chances de sortir.
  // Aucune pénalité de famille de féculents ou de protéine : s'il y a plus de plats au riz, il y a plus de riz.
  const cycle = Math.max(2, pool.length / 4);
  const weights = cands.map(r => {
    let w = 1;
    if (getRating(r.id) > 0) w *= 2.2;   // 👍 : revient plus souvent
    if (sharesWith(r, prefer)) w *= SHARE_BONUS; // partage un produit en gros paquet déjà pris (ou un reste reporté)
    if (isFreshFish(r) && chosen.some(isFreshFish)) w *= 0.01;
    const last = served.last[r.id];
    if (last !== undefined) w *= Math.min(1, ((served.n - last) / cycle) ** 4);
    return w;
  });
  let x = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < cands.length; i++) { x -= weights[i]; if (x <= 0) return cands[i]; }
  return cands[cands.length - 1];
}

// Répartit n repas entre des plats : un plat ne revient qu'une fois par jour,
// et le poisson frais au plus 2 fois (2 premiers jours). Renvoie null si impossible.
function allocate(n, plats, days, level = 2, early = 99, fishEarly = 99, earlyMeals = 99) {
  const onlyRed = plats.every(isRedMeat);
  let redLeft = RED_MEAT_MEALS;
  let freshLeft = earlyMeals; // repas des 3 premiers jours, à partager entre poisson frais et plats à manger frais
  const caps = plats.map(p => {
    // poisson frais : repas des 2 premiers jours ; à manger frais : repas des 3 premiers jours (des repas libres en réduisent le nombre)
    let c = isFreshFish(p) ? Math.min(2, days, fishEarly, freshLeft) : isFreshOnly(p) ? Math.min(FRIDGE_DAYS, days, early, freshLeft) : days;
    if (isFreshFish(p) || isFreshOnly(p)) freshLeft -= c;
    if (isRedMeat(p) && !onlyRed) { c = Math.min(c, RED_MEAT_PER_DISH, redLeft); redLeft -= c; }
    return c;
  });
  const counts = plats.map(() => 0);
  let left = n;
  while (left > 0) {
    let progressed = false;
    // on remplit d'abord les plats non-poisson, en restant équilibré
    const order = plats.map((p, i) => i).sort((a, b) => counts[a] - counts[b]);
    for (const i of order) {
      if (left === 0) break;
      if (counts[i] < caps[i]) { counts[i]++; left--; progressed = true; }
    }
    if (!progressed) return null;
  }
  // une répartition déséquilibrée (un plat pour une seule portion, 7-3-2-2…) est refusée : le moteur ajoute un plat ou en tire d'autres
  // level 2 : au moins 2 portions et au plus 2 d'écart ; level 1 : au moins 2 portions ; level 0 : dernier recours
  if (level >= 1 && Math.min(...counts) < MIN_PORTIONS) return null;
  if (level >= 2 && Math.max(...counts) - Math.min(...counts) > MAX_SPREAD) return null;
  return counts;
}

// Place les portions dans les créneaux d'une session (earliest-deadline-first)
function schedule(slots, plats, counts) {
  const remaining = [...counts];
  const deadline = plats.map(deadlineOf); // poisson : lundi ou mardi ; plats à manger frais : avant jeudi
  const result = [];
  let prevId = null;
  // v196 : on mélange l'ordre des plats dans la semaine. La date limite d'un plat ne décide plus de tout :
  // un plat n'est « obligé » de passer que s'il ne lui reste plus assez de jours avant sa date limite.
  // Sinon on évite le même plat au même repas que la veille (ou l'avant-veille), et le même plat deux repas de suite.
  const days = [...new Set(slots.map(sl => sl.dayIdx))];
  slots.forEach((slot, si) => {
    const sameDay = result.filter(r => r.slot.dayIdx === slot.dayIdx).map(r => r.plat.id);
    const atMeal = back => result.find(r => r.slot.dayIdx === slot.dayIdx - back && r.slot.meal === slot.meal)?.plat.id;
    const yesterday = atMeal(1), twoAgo = atMeal(2);
    const cands = plats.map((p, i) => i).filter(i => remaining[i] > 0 && !sameDay.includes(plats[i].id));
    const pool = cands.length ? cands : plats.map((p, i) => i).filter(i => remaining[i] > 0);
    // jours encore possibles pour ce plat (un repas par jour au plus), d'aujourd'hui à sa date limite
    const room = i => days.filter(d => d <= deadline[i] && (d > slot.dayIdx || (d === slot.dayIdx && !sameDay.includes(plats[i].id)))).length;
    // obligé ce jour-là… mais s'il a déjà été mangé à ce repas la veille et que le soir est libre pour lui, il attend le soir
    const dinnerLater = slot.meal === 'lunch' && slots.some(sl => sl.dayIdx === slot.dayIdx && sl.meal === 'dinner');
    const forced = i => remaining[i] >= room(i) && !(dinnerLater && plats[i].id === yesterday);
    const pen = i => (plats[i].id === yesterday ? 4 : 0) + (plats[i].id === twoAgo ? 1.5 : 0) + (plats[i].id === prevId ? 1 : 0);
    const rnd = new Map(pool.map(i => [i, Math.random()]));
    pool.sort((a, b) =>
      (forced(b) - forced(a)) ||
      (forced(a) && forced(b) ? deadline[a] - deadline[b] : 0) ||
      (pen(a) - pen(b)) ||
      // urgence douce : moins il reste de jours libres par portion, plus le plat passe tôt
      ((room(a) / remaining[a]) - (room(b) / remaining[b])) ||
      (rnd.get(a) - rnd.get(b)));
    const i = pool[0];
    remaining[i]--;
    prevId = plats[i].id;
    result.push({ slot, plat: plats[i] });
  });
  // correction (v185) : jamais le même plat midi et soir le même jour, si un échange avec un autre jour le permet
  // (sans créer de doublon ailleurs et en respectant les dates limites des plats frais)
  const ok = (o, dayIdx) => dayIdx <= deadlineOf(o.plat);
  for (let pass = 0; pass < 4; pass++) {
    let fixed = false;
    for (const r of result) {
      if (!result.some(o => o !== r && o.slot.dayIdx === r.slot.dayIdx && o.plat.id === r.plat.id)) continue;
      const swap = result.find(o => o.slot.dayIdx !== r.slot.dayIdx && o.plat.id !== r.plat.id
        && !result.some(x => x !== o && x.slot.dayIdx === o.slot.dayIdx && x.plat.id === r.plat.id)
        && !result.some(x => x !== r && x.slot.dayIdx === r.slot.dayIdx && x.plat.id === o.plat.id)
        && ok(o, r.slot.dayIdx) && ok(r, o.slot.dayIdx));
      if (swap) { const p = r.plat; r.plat = swap.plat; swap.plat = p; fixed = true; }
    }
    if (!fixed) break;
  }
  return result;
}

// Choisit les collations de la semaine : un mix sucré / salé, rapides, sans répétition lassante.
// Collations proposées : sans whey (variantes au skyr) pour qui n'a pas de protéine en poudre
function snackPool(whey = true, lac = 0, glu = 0) {
  // avec whey : la version d'origine, sauf si le régime l'interdit (lactose) ; alors sa version sans whey
  const wheyBlocked = r => r.wheyOf && !dietOk(getById(r.wheyOf), lac, glu);
  return getSweets().filter(r => isAvailable(r) && dietOk(r, lac, glu) && getRating(r.id) >= 0
    && (whey === false ? !hasWhey(r) : (!(r.tags || []).includes('sans-whey') || wheyBlocked(r))));
}
// ordre aléatoire pondéré : les recettes qui partagent un produit déjà pris passent plus souvent devant
const weightedOrder = (list, prefer) => list.map(r => ({ r, k: Math.random() ** (1 / (sharesWith(r, prefer) ? SHARE_BONUS : 1)) })).sort((a, b) => b.k - a.k).map(x => x.r);
// v195 : mémoire des collations préparées servies (même principe que les plats), versions avec et sans whey confondues
const SNK_KEY = 'hebe_served_snacks';
const baseSnackId = id => String(id).replace(/S$/, '');
function getServedSnacks() {
  try { const v = JSON.parse(localStorage.getItem(SNK_KEY) || 'null'); if (v && typeof v.n === 'number' && v.last) return v; } catch {}
  return { n: 0, last: {} };
}
// v195 : portion minimale d'une collation (pour ne proposer que des préparées qui tiennent dans la journée)
const snackFloorCache = {};
const snackFloor = r => (snackFloorCache[r.id] ??= optimizeRecipe(r, { kcal: 50, protein: 5, carbs: 5, fat: 2 }, 'S', 1).macros.kcal);
function pickSnacks(whey = true, lac = 0, glu = 0, prefer = new Set(), room = Infinity, bought = null) {
  const all = snackPool(whey, lac, glu);
  // v196 : une collation rapide qui demande un produit frais vendu à la pièce ou en sachet (avocat, salade, concombre…)
  // n'est proposée que si ce produit est déjà acheté pour les plats : sinon on achèterait un avocat entier pour 30 g
  const PACK_FRESH = ['avocat', 'salade', 'concombre', 'herbes', 'tomates_cerise', 'champignons', 'poivron', 'courgette', 'aubergine'];
  const needsPack = s => !!bought && s.ingredients.some(i => PACK_FRESH.includes(i.key) && !bought.has(i.key));
  const quick = all.filter(s => !s.batch && (s.prepTime + s.cookTime) <= 10 && !needsPack(s));
  // v195 / v199 : tour de rôle, pour les collations préparées comme pour les rapides. Celles servies récemment passent
  // leur tour (s'il en reste assez) ; ensuite, plus une collation attend, plus elle a de chances de sortir.
  // Le partage d'un produit avec les plats ne donne plus qu'un petit coup de pouce.
  const sv = getServedSnacks();
  const ageOf = id => (sv.last[id] == null ? 8 : Math.min(8, sv.n - sv.last[id]));
  const byAge = list => list.map(r => ({ r, k: Math.random() ** (1 / (ageOf(baseSnackId(r.id)) ** 2 * (sharesWith(r, prefer) ? 1.3 : 1))) })).sort((a, b) => b.k - a.k).map(x => x.r);
  const restedQ = list => { const r = list.filter(s => ageOf(baseSnackId(s.id)) >= 2); return r.length >= 2 ? r : list; };
  const sweet = byAge(restedQ(quick.filter(s => (s.tags || []).includes('sucré') || !(s.tags || []).includes('salé'))));
  const salty = byAge(restedQ(quick.filter(s => (s.tags || []).includes('salé'))));
  // préparée à l'avance : seulement ce qui tient toute la semaine (energy balls ; pancakes, qui se congèlent)
  let batchPool = all.filter(s => s.batch && (/^K0[68]/.test(s.id) || (s.tags || []).includes('semaine')) && snackFloor(s) <= room);
  const rested = batchPool.filter(s => ageOf(baseSnackId(s.id)) >= 3);
  if (rested.length >= 2) batchPool = rested;
  const batchy = batchPool.map(r => ({ r, k: Math.random() ** (1 / (ageOf(baseSnackId(r.id)) ** 2 * (sharesWith(r, prefer) ? 1.3 : 1))) })).sort((a, b) => b.k - a.k).map(x => x.r);
  // v188 : 1 ou 2 collations préparées le dimanche, en alternance avec des collations rapides (fromage blanc, yaourt…).
  // Rotation [préparée, rapide, préparée ou rapide, rapide] : chaque jour, le choix se fait entre 2 voisines,
  // donc une préparée et une rapide ; une préparée revient ainsi 3 à 4 jours dans la semaine.
  const nBatch = Math.random() < 0.5 ? 1 : 2;
  const picks = nBatch === 2 && batchy[1]
    ? [batchy[0], sweet[0], batchy[1], salty[0] || sweet[1]]
    : [batchy[0], sweet[0], salty[0], sweet[1]];
  return [...new Set(picks.filter(Boolean).map(p => p.id))];
}
const planSnacks = (plan, mid) => plan?.snacksBy?.[mid] || plan?.snacks || pickSnacks();

// ── Petits-déjeuners (formule classique) ──
// Une recette préparée au batch par session. Si elle ne se garde que 3 jours, le 4e jour de la
// 2e session reçoit un petit-déjeuner minute (menemen, tartines).
const fridgeDays = r => parseInt((r.tags || []).find(t => /^frigo-\d+$/.test(t))?.slice(6) || '0');
function weightedPick(list, bonus = () => 1) {
  if (!list.length) return null;
  const w = list.map(r => (getRating(r.id) > 0 ? 2.2 : 1) * bonus(r));
  let x = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let k = 0; k < list.length; k++) { x -= w[k]; if (x <= 0) return list[k]; }
  return list[list.length - 1];
}
// Par personne : selon sa préférence (sucré, salé ou les deux) et la whey.
// Deux recettes par session, en alternance ; une recette préparée à l'avance ne dépasse pas sa durée au frigo.
function breakfastPool(m) {
  return getBreakfasts().filter(r => {
    if (getRating(r.id) < 0 || !isAvailable(r) || !dietOk(r, m.lactose ?? lactoseOf(m.id), m.gluten ?? glutenOf(m.id))) return false;
    // sans whey : la version sans whey de chaque recette ; avec whey : la version d'origine
    if (m.whey === false ? hasWhey(r) : (r.tags || []).includes('sans-whey')) return false;
    const t = r.tags || [];
    if (m.breakfast === 'sucre') return t.includes('sucré');
    if (m.breakfast === 'sale') return t.includes('salé');
    return true;
  });
}
// Charcuterie : ce qu'il reste du plafond de la semaine pour une journée donnée.
// getE(date) renvoie l'état actuel de chaque jour ; e est la journée en cours (déjà vidée de ses collations).
// Variété (v187) : jours où chaque collation ou complément est déjà servi dans les autres jours de la semaine
function weekUseOf(dates, getE, e) {
  const use = {};
  dates.forEach(d => { const x = getE(d); if (!x || x === e || x?.date === e?.date) return;
    new Set(['sides', 'sweet'].flatMap(s => (x.meals?.[s] || []).filter(it => !it.with).map(it => it.id))).forEach(id => { use[id] = (use[id] || 0) + 1; }); });
  return use;
}
// Produits frais consommés en entier (v190, généralise les laitages de la v189) : viande, charcuterie, laitages frais,
// pains, légumes vendus à la pièce ou en barquette, conserves une fois ouvertes. Sur toute la semaine du foyer, les
// quantités de tous les repas qui en contiennent sont ajustées pour tomber sur des paquets entiers (pack, ou poids
// d'une pièce : buy) : finir le paquet entamé, ou réduire un peu si on dépasse d'au plus 20 % pour ne pas en ouvrir un autre.
// Bornes : min et max de l'ingrédient (ou ±20 % / +60 % s'il n'en a pas) ; une petite quantité ne baisse que de 20 %.
// Produits comptés à l'unité (wraps, tranches, carrés) : ajustés par unités entières.
// S'il reste encore un bon morceau, il va dans un complément qui l'utilise, à la place d'un autre (un jour qui le permet).
export const FRESH_KEYS = ['poulet', 'poulet_hache', 'boeuf', 'saumon', 'haut_cuisse', 'boeuf_emince', 'tofu', 'poulet_tranches', 'jambon_blanc',
  'fromage_blanc', 'yaourt_grec', 'yaourt_sl', 'cottage', 'fromage_frais', 'carre_frais', 'feta', 'creme', 'creme_coco', 'houmous', 'lait',
  'tortilla', 'pita', 'pain_burger', 'baguette', 'pain', 'gnocchis',
  'concombre', 'avocat', 'poivron', 'courgette', 'aubergine', 'salade', 'herbes', 'tomates_cerise', 'champignons', 'chou_chinois',
  'pois_chiches', 'haricots_rouges', 'haricots_blancs', 'tomates_conc', 'lait_coco', 'mais', 'thon'];
const LEFTOVER_FILLER = { fromage_blanc: 'S08', carre_frais: 'S12', pain: 'S12', tortilla: 'K13', avocat: 'K12' };
const DAIRY_BOWL_KEYS = ['fromage_blanc', 'yaourt_grec', 'yaourt_sl'];
// phase 'repas' (avant les collations) : on ajuste les plats et petits-déjeuners, pas de complément de reste ;
// phase 'collations' (après) : on ne retouche que collations et compléments (les repas sont comptés mais fixes), et on
// place les compléments de reste. Ainsi les collations compensent les calories ajoutées aux repas.
function snapFresh(entries, canTake = () => true, phase = 'collations') {
  const MEAL_SLOTS = ['breakfast', 'starter', 'lunch', 'dinner'];
  const adjustable = slot => (phase === 'repas' ? MEAL_SLOTS.includes(slot) : !MEAL_SLOTS.includes(slot));
  // deux tours : un complément de reste utilise lui-même d'autres produits frais déjà ouverts (la tartine : pain et carré frais)
  for (let round = 0; round < 2; round++) FRESH_KEYS.forEach(key => {
    const db = INGREDIENTS[key];
    const P = db?.pack || db?.buy;
    if (!P) return;
    const g = NATURAL_UNITS[key]?.g || 1; // pas d'ajustement : 1 g, ou une unité entière (wrap, tranche…)
    const spots = [];
    entries.forEach(e => ['breakfast', 'starter', 'lunch', 'dinner', 'sides', 'sweet'].forEach(slot => (e?.meals?.[slot] || []).forEach(it => {
      const r = getById(it.id); if (!r) return;
      const qs = itemQuantities(it);
      r.ingredients.forEach((ing, ix) => {
        if (ing.key !== key || !qs[ix]) return;
        const q = qs[ix];
        // repas : ±15 % / −30 % au plus (les assiettes restent calées, on préfère un paquet de moins) ; collations : bornes de l'ingrédient
        const min = phase === 'repas' ? q * 0.7 : (db.min != null ? (q < db.min ? q * 0.8 : db.min) : q * 0.8);
        // collations : un produit léger (≤ 100 kcal pour 100 g : fromage blanc, yaourt, lait, crudités) peut monter jusqu'à son
        // maximum, presque sans calories ; un produit dense (carré frais, feta, pain…) ne monte pas
        const light = ((db.per?.kcal ?? 999) <= 100 && db.unit !== 'pièce') || CHARC_KEYS.includes(key); // charcuterie : par tranche, sous le plafond
        const max = light ? Math.max(q, db.max ?? q * 1.6) : (phase === 'repas' ? q * 1.15 : q);
        if (!adjustable(slot)) { spots.push({ it, ix, q, min: q, max: q, fixed: true }); return; }
        spots.push({ it, ix, q, min: Math.ceil(min / g) * g > q ? q : Math.ceil(min / g) * g, max: Math.max(q, Math.floor(max / g) * g) });
      });
    })));
    if (!spots.length) return;
    const sum = () => spots.reduce((a, x) => a + x.q, 0);
    const total = sum();
    const down = Math.floor(total / P + 1e-9) * P, up = Math.ceil(total / P - 1e-9) * P;
    if (up - total >= 0.5) {
      const room = spots.reduce((a, x) => a + (x.max - x.q), 0), slack = spots.reduce((a, x) => a + (x.q - x.min), 0);
      let target = (down > 0 && total - down <= Math.min(slack, total * (phase === 'repas' ? 0.3 : 0.2))) ? down : Math.min(up, total + room);
      // charcuterie : jamais au-delà de 4 tranches par personne et par semaine (une barquette)
      if (CHARC_KEYS.includes(key)) { const cap = CHARC_MAX * Math.max(1, Math.round(entries.length / 7)); if (target > cap) target = Math.max(down, Math.min(total, cap)); }
      let diff = target - total;
      for (let pass = 0; pass < 6 && Math.abs(diff) >= g / 2; pass++) {
        const open = spots.filter(x => (diff > 0 ? x.max - x.q : x.q - x.min) >= g / 2);
        if (!open.length) break;
        const each = diff / open.length;
        open.forEach(x => { const nq = Math.max(x.min, Math.min(x.max, x.q + each)); diff -= nq - x.q; x.q = nq; });
      }
      // arrondi (au gramme ou à l'unité), puis la différence d'arrondi sur un seul ingrédient : le total tombe pile
      spots.forEach(x => { if (!x.fixed) x.q = Math.max(g, Math.round(x.q / g) * g); });
      const want = Math.round(target / g) * g, drift = want - sum();
      if (drift) {
        const free = spots.filter(x => !x.fixed);
        const fix = free.find(x => x.q + drift >= x.min && x.q + drift <= x.max) || (free.length ? free.reduce((x, y) => (y.q > x.q ? y : x)) : null);
        if (fix)
        fix.q = Math.max(g, fix.q + drift);
      }
      spots.forEach(x => { if (!x.fixed) x.it.overrides = { ...(x.it.overrides || {}), [x.ix]: x.q }; });
    }
    if (phase === 'repas') return;
    // reste encore un bon morceau du paquet : un complément qui l'utilise, à la place d'un autre complément ou d'une collation rapide
    const fillerId = LEFTOVER_FILLER[key], filler = fillerId && getById(fillerId);
    if (!filler) return;
    const fIx = filler.ingredients.findIndex(i => i.key === key);
    if (fIx < 0) return;
    // le complément ne doit pas faire ouvrir un autre produit frais : ses autres produits frais sont déjà achetés cette semaine
    const bought = k => entries.some(e => ['breakfast', 'starter', 'lunch', 'dinner', 'sides', 'sweet'].some(sl => (e?.meals?.[sl] || []).some(it => {
      const r = getById(it.id); if (!r) return false; const qs = itemQuantities(it);
      return r.ingredients.some((i, ix) => i.key === k && qs[ix] > 0);
    })));
    if (filler.ingredients.some(i => i.key !== key && FRESH_KEYS.includes(i.key) && !bought(i.key))) return;
    for (let n = 0; n < 7; n++) { // plusieurs jours si un seul complément ne suffit pas (pot de 1 kg…)
    const left = Math.ceil(sum() / P - 1e-9) * P - sum();
    if (left < Math.max(g, (db.min ?? 0) * 0.5, P * 0.15)) break;
    const qty = Math.min(db.max ?? Math.max(left, filler.ingredients[fIx].qty * 2), Math.max(g, Math.floor(left / g) * g));
    const item = { id: fillerId, servings: 1, overrides: { [fIx]: qty } };
    const kc = computeMealMacros(item).kcal;
    const isBowl = DAIRY_BOWL_KEYS.includes(key);
    const hasBowl = e => ['breakfast', 'sides', 'sweet'].some(sl => (e?.meals?.[sl] || []).some(it => getById(it.id)?.ingredients.some(i => DAIRY_BOWL_KEYS.includes(i.key))));
    let placed = false;
    for (const pick of [it => !it.with && /^S/.test(it.id) && it.id !== fillerId, it => !it.with && !getById(it.id)?.batch && it.id !== fillerId]) {
      const e = entries.find(x => x?.meals && canTake(x, fillerId) && !(isBowl && hasBowl(x))
        && !['sides', 'sweet'].some(sl => (x.meals[sl] || []).some(it => it.id === fillerId))
        && ['sides', 'sweet'].some(sl => (x.meals[sl] || []).some(pick)));
      if (!e) continue;
      const cands = ['sides', 'sweet'].flatMap(sl => (e.meals[sl] || []).filter(pick).map(it => ({ sl, it })));
      const out = cands.reduce((x, y) => (Math.abs(computeMealMacros(y.it).kcal - kc) < Math.abs(computeMealMacros(x.it).kcal - kc) ? y : x));
      // mêmes calories que le complément remplacé : on réduit la quantité du produit à finir si besoin
      const kOut = computeMealMacros(out.it).kcal;
      if (kc > kOut * 1.1) {
        const per = (kc - computeMealMacros({ id: fillerId, servings: 1, overrides: { [fIx]: 0 } }).kcal) / qty; // kcal par g du produit
        const q2 = Math.floor(Math.max(0, qty - (kc - kOut * 1.1) / Math.max(per, 1e-6)) / g) * g;
        if (q2 < Math.max(g, (db.min ?? 0) * 0.5)) continue;
        item.overrides = { [fIx]: q2 };
      }
      const qPlaced = item.overrides[fIx];
      e.meals[out.sl] = e.meals[out.sl].filter(it => it !== out.it);
      e.meals.sides = [...(e.meals.sides || []), item];
      spots.push({ it: item, ix: fIx, q: qPlaced, min: qPlaced, max: qPlaced });
      placed = true;
      break;
    }
    if (!placed) break;
    }
  });
}
// Rééquilibrage après le calage des produits frais : retire les compléments ou collations sans produit frais
// (fruit, amandes, collation de placard) tant que la journée dépasse sa cible de plus de 3 %
function trimOver(e, T) {
  const hasFresh = it => getById(it.id)?.ingredients.some(i => FRESH_KEYS.includes(i.key));
  for (let n = 0; n < 4; n++) {
    const over = computeDayMacros(e).kcal - T.kcal;
    if (over <= T.kcal * 0.03) return;
    const cands = ['sides', 'sweet'].flatMap(sl => (e.meals[sl] || []).filter(it => !it.with && !hasFresh(it) && !getById(it.id)?.batch).map(it => ({ sl, it, kc: computeMealMacros(it).kcal })));
    if (!cands.length) return;
    // celui qui ramène le plus près de la cible, sans trop descendre en dessous
    const best = cands.reduce((x, y) => (Math.abs(over - y.kc) < Math.abs(over - x.kc) ? y : x));
    if (over - best.kc < -T.kcal * 0.05) return; // le retirer creuserait trop
    e.meals[best.sl] = e.meals[best.sl].filter(it => it !== best.it);
  }
}
function charcLeft(dates, getE, e) {
  return CHARC_MAX - dates.reduce((a, d) => { const x = getE(d); return a + (x === e || x?.date === e?.date ? 0 : charcOfEntry(x)); }, 0) - charcOfEntry(e);
}
// Petit-déjeuner de remplacement sans charcuterie, dans les préférences de la personne
function breakfastNoCharc(m, r) {
  const pool = breakfastPool(m).filter(x => !x.ingredients.some(i => ['jambon_blanc', 'poulet_tranches'].includes(i.key)));
  const t = x => ((x.tags || []).includes('salé') ? 'salé' : 'sucré');
  const quick = pool.filter(x => !x.batch);
  return weightedPick(quick.filter(x => t(x) === t(r))) || weightedPick(quick) || weightedPick(pool) || null;
}
// Calcium : un petit-déjeuner riche en calcium (≥ 70 mg pour 100 kcal : laitages, lait) est deux fois plus probable
const caBreakfast = r => (calciumPer100kcal(r) >= 70 ? 2 : 1);
function pickBreakfasts(m, sessionDays, prefer = new Set()) {
  const pool = breakfastPool(m);
  const used = [];
  return sessionDays.map(days => {
    const fresh = pool.filter(r => !used.includes(r.id));
    const src = fresh.length >= 2 ? fresh : pool;
    const a = weightedPick(src, r => caBreakfast(r) * (sharesWith(r, prefer) ? SHARE_BONUS : 1));
    if (!a) return days.map(() => null);
    // « les deux » : un sucré et un salé ; sinon deux recettes différentes
    const t = r => ((r.tags || []).includes('salé') ? 'salé' : 'sucré');
    let rest = src.filter(r => r.id !== a.id);
    if (m.breakfast !== 'sucre' && m.breakfast !== 'sale' && rest.some(r => t(r) !== t(a))) rest = rest.filter(r => t(r) !== t(a));
    // si la première se prépare à l'avance, la seconde se fait le matin même (elle couvre les jours au-delà du frigo)
    const restQuick = a.batch ? rest.filter(r => !r.batch) : rest;
    const b2 = weightedPick(restQuick.length ? restQuick : rest, r => caBreakfast(r) * (sharesWith(r, prefer) ? SHARE_BONUS : 1)) || a;
    used.push(a.id, b2.id);
    const out = days.map((_, k) => (k % 2 ? b2 : a));
    // au frigo : préparé le dimanche, un petit-déjeuner n'est mangé que tant qu'il se garde (lundi = 1 jour)
    out.forEach((x, k) => {
      if (!x.batch || k + 1 <= fridgeDays(x)) return;
      const other = x === a ? b2 : a;
      out[k] = !other.batch || k + 1 <= fridgeDays(other) ? other : (weightedPick(pool.filter(r => !r.batch)) || other);
    });
    return out;
  });
}

// ── Génère la semaine ──
// opts = { members: [{ id, targets, free, formula, breakfast, whey }], nextWeek, proteins: [familles] }
// Budget : on vise ~60 €. Une semaine tirée au-dessus de 70 € est simplement retirée
// (on ne choisit PAS la semaine « la mieux calibrée », sinon les mêmes plats reviennent toujours).
const COST_MAX = 70;
// Tour de rôle des plats : n = nombre de semaines générées, last[id] = semaine où le plat est sorti la dernière fois
const SERVED_KEY = 'hebe_served_mains';
const getServed = () => {
  try { const v = JSON.parse(localStorage.getItem(SERVED_KEY) || 'null'); if (v && typeof v.n === 'number' && v.last) return v; } catch {}
  return { n: 0, last: {} };
};

export function generateWeek(opts = {}) {
  const served = getServed();
  // On retire au plus quelques tirages trop chers (> 70 €). Si aucun ne passe (protéines chères
  // sélectionnées), on garde le PREMIER tirage : surtout pas « le moins cher », qui ramènerait
  // toujours les mêmes plats.
  const costMax = (opts.members ? weekBudget() * 1.17 : COST_MAX) * (7 - Math.max(0, Math.min(6, opts.startFrom | 0))) / 7; // environ +15 % de marge, au prorata des jours planifiés
  const first = generateWeekOnce({ ...opts, served });
  let cand = first;
  for (let i = 0; i < 5 && cand.plan.cost > costMax; i++) cand = generateWeekOnce({ ...opts, served });
  if (cand.plan.cost > costMax) cand = first;
  // mémoire du tour de rôle : ces plats viennent de sortir
  served.n += 1;
  cand.mains.forEach(m => { served.last[m.id] = served.n; });
  localStorage.setItem(SERVED_KEY, JSON.stringify(served));
  localStorage.removeItem('hebe_recent_mains'); // ancienne mémoire (12 derniers plats)
  // collations préparées réellement servies cette semaine
  try {
    const sv = getServedSnacks(); sv.n += 1;
    Object.values(cand.entriesBy || {}).forEach(E => Object.values(E).forEach(e => (e?.meals?.sweet || []).forEach(it => { if (getById(it.id)?.category === 'sweet') sv.last[baseSnackId(it.id)] = sv.n; })));
    localStorage.setItem(SNK_KEY, JSON.stringify(sv));
  } catch {}
  // restes des produits qui se gardent 2 semaines (carrés frais, pains et wraps au congélateur) : reportés à la semaine suivante
  try {
    const tot = {};
    Object.values(cand.entriesBy || {}).forEach(E => Object.values(E).forEach(e => Object.values(e?.meals || {}).forEach(a => (a || []).forEach(it => {
      const r = getById(it.id); if (!r) return; const qs = itemQuantities(it);
      r.ingredients.forEach((i, ix) => { if (KEEP_2W.includes(i.key)) tot[i.key] = (tot[i.key] || 0) + qs[ix]; });
    }))));
    const left = {};
    Object.entries(tot).forEach(([k, t]) => { const P = INGREDIENTS[k]?.pack || INGREDIENTS[k]?.buy; if (P) { const l = Math.ceil(t / P - 1e-9) * P - t; if (l > 0.5) left[k] = Math.round(l); } });
    localStorage.setItem(LEFT_KEY, JSON.stringify(left));
  } catch {}
  saveWeekPlan(cand.plan);
  return cand;
}

// opts.members = [{ id, targets, free }] : un seul planning de plats pour tout le foyer,
// puis des portions calculées pour chaque personne (sans opts.members : la personne active seule).
// m.free = ['0-lunch', '3-dinner', …] : repas libres (non calculés) de la personne
function generateWeekOnce({ nextWeek = true, targets, proteins = null, served = { n: 0, last: {} }, members = null, startFrom = 0 } = {}) {
  targets = targets || { kcal: 2200, protein: 150, carbs: 230, fat: 70 };
  members = members && members.length ? members : [{ id: getActiveMember().id, targets, free: [] }];
  // v195 : semaine commencée en cours de route (startFrom = 1 à 6, 0 = lundi) : on cuisine aujourd'hui
  // et on ne planifie que les jours restants. Les indices de jour deviennent relatifs à la session
  // (fraîcheur, congélation, collations préparées), et les repas libres sont décalés d'autant.
  const skip = Math.max(0, Math.min(6, startFrom | 0));
  const dates = (nextWeek ? getNextWeekDates() : getWeekDates()).slice(skip);
  if (skip) members = members.map(m => ({ ...m, free: (m.free || []).map(k => k.split('-')).filter(([d]) => +d >= skip).map(([d, meal]) => `${+d - skip}-${meal}`) }));

  // Pool : plats complets, batchables, filtrés par les protéines choisies
  applyDiet(); // régime du foyer à jour (lactose)
  let pool = getMains().filter(r => r.batch && isAvailable(r) && dietOk(r, householdLactose(), householdGluten()));
  if (proteins && proteins.length) {
    const f = pool.filter(r => proteins.includes(proteinFamily(r)));
    if (f.length >= 4) pool = f;
  }
  // Petits besoins : on écarte les plats trop copieux même au minimum (pour le plus petit appétit du foyer)
  const shares = members.map(m => PLATE_SHARE[m.formula || 'jeune'] || 0.40);
  const pts = members.map((m, mi) => plateTarget(m.targets, shares[mi], proteinBoost(m.id)));
  const bts = members.map(m => breakfastTarget(m.targets));
  const scales = pts.map(pt => portionScale(pt.kcal));
  const ptMin = pts.reduce((x, y) => (x.kcal <= y.kcal ? x : y));
  const scaleMin = portionScale(ptMin.kcal);
  if (scaleMin < 1) {
    const light = pool.filter(r => plateFloor(r, scaleMin) <= ptMin.kcal * 1.1);
    if (light.length >= 8) pool = light;
  }
  const onlyFish = pool.every(isFreshFish);

  // une seule session de cuisine, le dimanche, pour toute la semaine
  const SESSIONS = [{ key: 'A', label: skip ? "Aujourd'hui" : 'Dimanche', days: dates.map((_, i) => i) }];

  const caches = members.map(() => ({})); // assiette calibrée par personne et par plat
  const calibrate = (mi, r) => (caches[mi][r.id] ||= calibratePlate(r, pts[mi]));
  // plats capables de remplir au moins 85 % de l'assiette de chacun (un wrap plafonne à 3 galettes pour les très gros profils ;
  // au-delà, les collations et compléments complètent)
  const fits = (r, mi) => {
    const key = `${r.id}|${r.macros.kcal}|${pts[mi].kcal}|${pts[mi].protein}`; // la recette change avec le régime et le riz
    if (!FITS.has(key)) FITS.set(key, calibrate(mi, r).macros.kcal >= 0.85 * pts[mi].kcal);
    return FITS.get(key);
  };
  const fitting = pool.filter(r => members.every((_, mi) => fits(r, mi)));
  if (fitting.length >= 12) pool = fitting;
  const isFree = (mi, dayIdx, meal) => (members[mi].free || []).includes(`${dayIdx}-${meal}`);
  // un repas ne sort du batch que s'il est libre pour tout le foyer
  const allFree = (dayIdx, meal) => members.every((_, mi) => isFree(mi, dayIdx, meal));

  const byMember = members.map(() => {
    const e = {};
    dates.forEach(d => e[d] = { date: d, meals: { breakfast: [], starter: [], lunch: [], dinner: [], sides: [], sweet: [] } });
    return e;
  });

  const chosen = [];
  const leftKeys = Object.keys(getLeftovers()).filter(k => getLeftovers()[k] > 0); // restes reportés de la semaine passée
  const sessions = [];
  SESSIONS.forEach((S, si) => {
    const slots = [];
    S.days.forEach((dayIdx, k) => {
      if (!allFree(dayIdx, 'lunch')) slots.push({ dayIdx, k, meal: 'lunch' });
      if (!allFree(dayIdx, 'dinner')) slots.push({ dayIdx, k, meal: 'dinner' });
    });
    const n = slots.length;
    if (!n) return;
    const nDays = S.days.length;
    // jours (pas repas : un plat ne revient pas midi et soir le même jour) cuisinés parmi les 3 premiers, et parmi les 2 premiers
    const early = new Set(slots.filter(sl => sl.dayIdx < FRIDGE_DAYS).map(sl => sl.dayIdx)).size;
    const fishEarly = new Set(slots.filter(sl => sl.dayIdx < 2).map(sl => sl.dayIdx)).size;
    const earlyMeals = slots.filter(sl => sl.dayIdx < FRIDGE_DAYS).length;
    // environ 3 à 4 portions par plat : 4 plats pour une semaine complète
    let plats = [], counts = null, placed = null;
    for (let attempt = 0; attempt < 24 && !placed; attempt++) {
      let k = Math.max(n >= 3 ? 2 : 1, Math.ceil(n / 4));
      plats = [];
      counts = null;
      for (let guard = 0; guard < 6; guard++) {
        while (plats.length < k) {
          const p = pickMain(pool, [...chosen, ...plats], { allowFish: attempt < 20, served, earlySlots: early, fishSlots: fishEarly, extraKeys: leftKeys }); // derniers essais sans poisson frais, plus facile à placer
          if (!p) break;
          plats.push(p);
        }
        counts = allocate(n, plats, nDays, attempt < 16 ? 2 : attempt < 22 ? 1 : 0, early, fishEarly, earlyMeals); // derniers essais moins exigeants, pour toujours trouver une semaine
        if (counts) break;
        // les premiers essais gardent le nombre de plats habituel (≈ 4 portions chacun) et tirent d'autres plats ;
        // un plat de plus seulement ensuite : moins de plats à cuisiner le dimanche
        if (attempt < 8 && plats.length >= Math.ceil(n / 4)) break;
        k++;
      }
      if (!counts) continue;
      const tryPlaced = schedule(slots, plats, counts);
      // chaque plat reste dans sa fenêtre de fraîcheur
      // … et, dans les premiers essais, jamais le même plat midi et soir le même jour (sinon on tire d'autres plats)
      const twice = tryPlaced.some(a => tryPlaced.some(b => b !== a && b.slot.dayIdx === a.slot.dayIdx && b.plat.id === a.plat.id));
      if (tryPlaced.every(({ slot, plat }) => slot.dayIdx <= deadlineOf(plat)) && (!twice || attempt >= 16)) placed = tryPlaced;
    }
    if (!placed) return;
    chosen.push(...plats);
    const boxes = {}; // nombre de boîtes réellement mangées par plat (toutes personnes confondues)
    placed.forEach(({ slot, plat }) => {
      const date = dates[slot.dayIdx];
      members.forEach((_, mi) => {
        if (isFree(mi, slot.dayIdx, slot.meal)) return;
        const res = calibrate(mi, plat);
        const e = byMember[mi][date];
        const item = { id: plat.id, servings: 1, overrides: { ...res.main.overrides } };
        if (goesToFreezer(plat, slot.dayIdx)) item.frozen = true;
        e.meals[slot.meal].push(item);
        if (res.side) e.meals.sides.push({ id: res.side.id, servings: 1, overrides: { ...res.side.overrides }, with: slot.meal });
        boxes[plat.id] = (boxes[plat.id] || 0) + 1;
      });
    });
    sessions.push({
      key: S.key, label: S.label,
      dates: S.days.map(i => dates[i]),
      recipes: plats.map(p => ({ id: p.id, portions: boxes[p.id] || 0, side: calibrate(0, p).side?.id || null })).filter(x => x.portions > 0),
    });
  });

  // Petits-déjeuners de la formule classique : même recette pour le foyer, portion de chacun
  const bCaches = members.map(() => ({}));
  if (members.some(m => m.formula === 'classique')) {
    const preferB = new Set([...shareKeysOf(chosen), ...leftKeys]);
    const picks = members.map(m => (m.formula === 'classique' ? pickBreakfasts(m, SESSIONS.map(S => S.days), preferB) : null));
    SESSIONS.forEach((S, si) => {
      const count = {};
      S.days.forEach((dayIdx, k) => {
        members.forEach((m, mi) => {
          if (m.formula !== 'classique') return;
          let r = picks[mi][si][k];
          if (!r) return;
          let res = (bCaches[mi][r.id] ||= optimizeRecipe(r, bts[mi], 'B', scales[mi]));
          // charcuterie : au-delà du plafond de la semaine, un autre petit-déjeuner
          const item = { id: r.id, servings: 1, overrides: { ...res.overrides } };
          if (charcGrams(item) && charcLeft(dates, d => byMember[mi][d], null) < charcGrams(item)) {
            const alt = breakfastNoCharc(m, r);
            if (alt) { r = alt; res = (bCaches[mi][r.id] ||= optimizeRecipe(r, bts[mi], 'B', scales[mi])); }
          }
          byMember[mi][dates[dayIdx]].meals.breakfast.push({ id: r.id, servings: 1, overrides: { ...res.overrides } });
          count[r.id] = (count[r.id] || 0) + 1;
        });
      });
      const sess = sessions.find(x => x.key === S.key);
      if (sess) sess.breakfasts = Object.entries(count).map(([id, portions]) => ({ id, portions, batch: !!getById(id)?.batch }));
    });
  }

  // Totaux achetables : viandes et poissons sur des barquettes entières, pour tout le foyer
  snapToPacks(byMember, dates, scales, pts, bts);
  // produits frais des repas en paquets entiers, avant les collations (qui compenseront les calories)
  snapFresh(byMember.flatMap(entries => dates.map(d => entries[d])), () => false, 'repas');

  // Repas libres, puis collations recalées chaque jour sur ce qu'il manque à chacun
  // collations : favorise celles qui partagent un produit des plats ou petits-déjeuners de la semaine (ou un reste reporté)
  const usedRecs = byMember.flatMap(entries => dates.flatMap(d => ['breakfast', 'lunch', 'dinner'].flatMap(sl => (entries[d].meals[sl] || []).map(it => getById(it.id))))).filter(Boolean);
  const preferS = new Set([...shareKeysOf(usedRecs), ...leftKeys]);
  // place habituelle pour une collation : la médiane de ce qu'il reste après repas et petit-déjeuner (jours sans repas libre)
  const roomOf = (m, mi) => {
    const v = dates.filter((d, i) => !(m.free || []).some(k => k.startsWith(i + '-')))
      .map(d => m.targets.kcal - computeDayTotals(byMember[mi][d]).kcal).sort((a, b) => a - b);
    return v.length ? v[Math.floor(v.length / 2)] : Infinity;
  };
  const boughtKeys = new Set(usedRecs.flatMap(r => r.ingredients.map(i => i.key)));
  const snackBy = members.map((m, mi) => pickSnacks(m.whey !== false, lactoseOf(m.id), glutenOf(m.id), preferS, roomOf(m, mi), boughtKeys));
  const batchDaysBy = {};
  members.forEach((m, mi) => {
    // repas libres : part de la journée réservée (par tranches de 100 kcal), rien à cuisiner ni à acheter
    (m.free || []).forEach(key => {
      const [d, meal] = key.split('-');
      // calories réservées : choisies par la personne, sinon la part habituelle d'un plat
      const kcal = m.freeKcal || pts[mi].kcal;
      if (dates[+d]) byMember[mi][dates[+d]].meals[meal].push({ id: 'L01', servings: 1, overrides: { 0: Math.round(kcal / 100) } });
    });
    // v198 : chaque collation préparée doit servir au moins 3 fois (sinon on ne la cuisine pas pour 1 ou 2 portions)
    const E = byMember[mi];
    const refill = (dayIdx, P) => {
      const e = E[dates[dayIdx]];
      e.meals.sweet = []; e.meals.sides = (e.meals.sides || []).filter(sd => sd.with);
      fillDay(e, dayIdx, snackBy[mi], m.targets, lactoseOf(m.id), glutenOf(m.id), charcLeft(dates, x => E[x], e), weekUseOf(dates, x => E[x], e), P[dayIdx]);
    };
    const servedOn = id => dates.map((d, i) => (E[d].meals.sweet || []).some(it => it.id === id) ? i : -1).filter(i => i >= 0);
    let P = batchPattern(snackBy[mi].filter(id => getById(id)?.batch), dates.length);
    dates.forEach((d, dayIdx) => refill(dayIdx, P));
    // (plusieurs passes : retirer une préparée refait toute la semaine, ce qui peut changer le compte des autres)
    for (let pass = 0; pass < 3; pass++) for (const id of snackBy[mi].filter(x => getById(x)?.batch)) {
      // pas assez de portions : on la propose d'autres jours (à la place d'une collation rapide)
      for (let d = 0; d < dates.length && servedOn(id).length < 3; d++) {
        if (P[d] || (E[dates[d]].meals.sweet || []).some(it => getById(it.id)?.batch)) continue;
        P[d] = id; refill(d, P);
        if (!servedOn(id).includes(d)) { P[d] = null; refill(d, P); }
      }
      // toujours moins de 3 : on ne la cuisine pas cette semaine
      if (servedOn(id).length < 3) {
        snackBy[mi] = snackBy[mi].filter(x => x !== id);
        P = P.map(x => (x === id ? null : x));
        dates.forEach((d, dayIdx) => refill(dayIdx, P));
      }
    }
    batchDaysBy[m.id] = P;
  });
  // produits frais consommés en entier ; un complément de reste ne va qu'à qui son régime l'autorise
  const owner = new Map(byMember.flatMap((entries, mi) => dates.map(d => [entries[d], members[mi].id])));
  snapFresh(byMember.flatMap(entries => dates.map(d => entries[d])),
    (e, fid) => { const mid = owner.get(e); return !!getById(fid) && dietOk(getById(fid), lactoseOf(mid), glutenOf(mid)); }, 'collations');
  // finir les paquets ajoute des calories : une journée qui dépasse sa cible de plus de 3 % perd un complément sans produit frais
  members.forEach((m, mi) => dates.forEach(d => trimOver(byMember[mi][d], m.targets)));

  // Coût estimé de la semaine (ce qui est réellement mangé, hors repas libres et placard)
  let cost = 0;
  byMember.forEach(entries => dates.forEach(d => ['breakfast', 'starter', 'lunch', 'dinner', 'sides', 'sweet'].forEach(s =>
    (entries[d].meals[s] || []).forEach(it => cost += itemCost(it)))));

  const ids = members.map(m => m.id);
  const plan = {
    start: dates[0], dates, sessions, startFrom: skip, batchDaysBy, snacks: snackBy[0], snacksBy: Object.fromEntries(members.map((m, mi) => [m.id, snackBy[mi]])),
    targets: members[0].targets, targetsBy: Object.fromEntries(members.map(m => [m.id, m.targets])), members: ids,
    formulaBy: Object.fromEntries(members.map(m => [m.id, m.formula || 'jeune'])),
    prefsBy: Object.fromEntries(members.map(m => [m.id, { breakfast: m.breakfast || 'mix', whey: m.whey !== false }])),
    lactoseBy: Object.fromEntries(members.map(m => [m.id, lactoseOf(m.id)])),
    glutenBy: Object.fromEntries(members.map(m => [m.id, glutenOf(m.id)])),
    cost: Math.round(cost), generatedAt: Date.now(),
    // fibres, sel, vitamines et minéraux : moyenne par jour, calculée mais pas encore affichée
    microsBy: Object.fromEntries(members.map((m, mi) => [m.id, weekMicros(byMember[mi], dates)])),
  };
  const entriesBy = Object.fromEntries(ids.map((id, mi) => [id, byMember[mi]]));
  return { dates, entries: byMember[0], entriesBy, plan, mains: chosen };
}

// ── Formats du commerce ──
// Pour chaque ingrédient « snap » (viandes, poissons, tofu), on additionne ce que la semaine utilise,
// on vise le multiple de barquette le plus proche, et on applique le même facteur à toutes les portions.
// Contrainte : chaque portion reste dans sa fourchette réaliste (tolérance de 10 % vers le bas uniquement).
// Les collations, ajoutées ensuite, rattrapent les calories d'écart.
// entries peut être une liste (une par personne du foyer), avec une liste de facteurs de portion.
// Toute la viande achetée est utilisée : le total tombe toujours sur des barquettes entières
// (formats de data/ingredients.js → packs). Si plateTargets est fourni, le reste de chaque assiette
// modifiée (féculent, protéine secondaire) est ensuite recalculé pour rester dans la cible.
// base = { ingrédient: grammes } déjà consommés les jours passés (recalcul en cours de semaine)
export function snapToPacks(entries, dates, scale = 1, plateTargets = null, breakfastTargets = null, base = null) {
  const lists = Array.isArray(entries) ? entries : [entries];
  const scales = Array.isArray(scale) ? scale : lists.map(() => scale);
  const uses = {}; // key → [{ item, idx, qty, sc, main, li, entry, slot }]
  lists.forEach((ent, li) => dates.forEach(d => ['breakfast', 'lunch', 'dinner'].forEach(slot => (ent[d].meals[slot] || []).forEach(item => {
    const r = getById(item.id);
    if (!r || (r.tags || []).includes('cantine')) return;
    const qs = itemQuantities(item);
    const mp = mainProteinIdx(r);
    r.ingredients.forEach((ing, idx) => {
      const db = INGREDIENTS[ing.key];
      if (db && db.snap && qs[idx] > 0) (uses[ing.key] ||= []).push({ item, idx, qty: qs[idx], sc: scales[li] ?? 1, main: idx === mp, li, entry: ent[d], slot });
    });
  }))));
  const report = {};
  const touched = new Set();
  Object.entries(uses).forEach(([key, list]) => {
    const db = INGREDIENTS[key];
    const unit = Math.min(...(db.packs || [db.pack]));
    const total = list.reduce((a, u) => a + u.qty, 0);
    const done = base?.[key] || 0;
    // bornes d'une portion : protéine principale dans sa fourchette réaliste,
    // petite quantité d'appoint (bœuf d'un mapo tofu) entre -15 % et +80 %
    const lo = u => (u.main ? Math.min((db.min || 0) * u.sc * 0.9, u.qty) : u.qty * 0.85);
    const hi = u => (u.main ? Math.max(db.max || Infinity, u.qty) : u.qty * 1.8);
    let best = null;
    const jMax = Math.ceil((total + done) / unit) + 4;
    for (let j = 1; j <= jMax; j++) {
      const target = j * unit;
      if (target <= done) continue;
      const f = (target - done) / total;
      if (!list.every(u => u.qty * f >= lo(u) - 1e-6 && u.qty * f <= hi(u) + 1e-6)) continue;
      // on préfère arrondir vers le haut (on mange toute la barquette), un peu moins vers le bas
      const need = total + done;
      const dist = target >= need ? target - need : (need - target) * 1.6;
      if (!best || dist < best.dist) best = { target, f, dist };
    }
    if (!best) { report[key] = { total, target: null }; return; }
    list.forEach(u => {
      if (!u.item.overrides) u.item.overrides = {};
      // quantité exacte (non arrondie) : le total de la semaine tombe pile sur les barquettes
      u.item.overrides[u.idx] = Math.round(u.qty * best.f * 10) / 10;
      if (Math.abs(best.f - 1) > 0.03) touched.add(u);
    });
    report[key] = { total, target: best.target };
  });
  // le reste de l'assiette s'ajuste autour de la viande calée
  if (plateTargets) {
    const seen = new Set();
    touched.forEach(u => {
      if (seen.has(u.item)) return;
      seen.add(u.item);
      const r = getById(u.item.id);
      const fixed = {};
      r.ingredients.forEach((ing, i) => { if (INGREDIENTS[ing.key]?.snap) fixed[i] = u.item.overrides[i] ?? ing.qty; });
      const isB = u.slot === 'breakfast';
      const pt = isB ? breakfastTargets?.[u.li] : plateTargets[u.li];
      if (!pt) return;
      const side = isB ? null : (u.entry.meals.sides || []).find(sd => sd.with === u.slot);
      const rest = { ...pt };
      if (side) { const sm = computeMealMacros(side); Object.keys(rest).forEach(k => rest[k] = Math.max(0, rest[k] - sm[k])); }
      const res = optimizeRecipe(r, rest, isB ? 'B' : 'P', scales[u.li] ?? 1, fixed);
      u.item.overrides = { ...res.overrides };
    });
  }
  return report;
}

// Collations et compléments d'une journée, recalés sur ce qu'il manque après les plats
// v198 : jours des collations préparées. 1 préparée : lun, mer, ven, dim ; 2 : A lun/jeu/dim, B mar/ven/sam (3 portions chacune au moins)
function batchPattern(batchIds, n) {
  const out = Array(n).fill(null);
  if (batchIds.length === 1) for (let d = 0; d < n; d += 2) out[d] = batchIds[0];
  else if (batchIds.length >= 2) { const pat = ['A', 'B', null, 'A', 'B', 'B', 'A']; for (let d = 0; d < n; d++) { const k = pat[d % 7]; if (k) out[d] = batchIds[k === 'A' ? 0 : 1]; } }
  return out;
}
// batchDay : undefined = jours habituels ; null = pas de collation préparée ce jour-là ; id = celle-ci
function fillDay(e, dayIdx, snackIds, targets, lac = 0, glu = 0, charcBudget = CHARC_MAX, weekUse = {}, batchDay = undefined) {
  // ignore les recettes supprimées depuis la génération du plan, ou exclues par le régime
  snackIds = snackIds.filter(id => getById(id) && !getById(id).retired && dietOk(getById(id), lac, glu) && getRating(id) >= 0);
  if (!snackIds.length) snackIds = pickSnacks(true, lac, glu);
  const used = computeDayTotals(e);
  const rem = subtractMacros(targets, used);
  // pas de thon / d'œufs en collation si le plat du jour en contient déjà
  const dayKeys = new Set(['breakfast', 'lunch', 'dinner'].flatMap(s => e.meals[s] || []).flatMap(it => getById(it.id)?.ingredients.map(i => i.key) || []));
  const clash = id => (getById(id)?.ingredients || []).some(i => ['thon', 'oeuf'].includes(i.key) && dayKeys.has(i.key));
  // v195 : les collations préparées le dimanche ont leurs jours réservés (avant, elles perdaient souvent
  // face aux collations rapides et n'étaient jamais servies, surtout sans whey).
  //   1 préparée  : lundi, mercredi, vendredi, dimanche ; collations rapides les autres jours
  //   2 préparées : lun A, mar B, jeu A, ven B, dim A ; collations rapides mercredi et samedi
  const batchIds = snackIds.filter(id => getById(id)?.batch);
  const quickIds = snackIds.filter(id => !getById(id)?.batch);
  const quickRot = quickIds.map((_, i) => quickIds[(i + dayIdx) % quickIds.length]);
  const qOrdered = [...quickRot.filter(id => !clash(id)), ...quickRot.filter(clash)];
  let todayBatch = batchDay !== undefined ? (batchDay && batchIds.includes(batchDay) ? batchDay : null) : batchPattern(batchIds, 7)[dayIdx % 7];
  // trop copieuse pour ce qu'il reste à manger ce jour-là : collation rapide à la place (la préparée n'est pas cuisinée pour ce jour)
  if (todayBatch) {
    const rem0 = subtractMacros(targets, computeDayTotals(e));
    const k = optimizeRecipe(getById(todayBatch), { ...rem0, kcal: Math.min(650, rem0.kcal) }, 'S', portionScale(plateTarget(targets).kcal)).macros.kcal;
    if (k > rem0.kcal * 1.06 + 20) todayBatch = null;
  }
  let rot;
  if (todayBatch) rot = [todayBatch, todayBatch, ...qOrdered];
  else if (qOrdered.length) rot = [...qOrdered, ...batchIds];
  else { rot = snackIds.map((_, i) => snackIds[(i + dayIdx) % snackIds.length]); rot = [...rot.filter(id => !clash(id)), ...rot.filter(clash)]; }
  // compléments sans préparation : les 2 tartines carré frais d'abord (elles alternent), puis les autres
  const okFill = id => { const r = getById(id); return r && !r.retired && dietOk(r, lac, glu) && getRating(id) >= 0; };
  const TARTINES = (dayIdx % 2 ? ['S11', 'S12'] : ['S12', 'S11']).filter(okFill);
  // poignée d'amandes et fruit de saison d'abord : ce sont eux qui complètent la journée en priorité
  const OTHERS = ['S07', 'S05', 'S08', 'S09', 'S16'].filter(okFill);
  const fillers = [...TARTINES, ...OTHERS];
  fillRemainder(rem, rot, fillers, portionScale(plateTarget(targets).kcal), dayKeys, Math.max(0, charcBudget), weekUse).forEach(f => e.meals[f.slot].push(f.item));
}

// ── Remplacer un plat de la semaine ──
// Tire un autre plat (même protéine si possible), recalcule ses portions, l'applique à toutes
// ses portions de la session, puis recale barquettes et collations. Renvoie le nouveau plat ou null.
// v195 : 3 propositions au choix pour « Changer »
export function replaceOptions(oldId, n = 3) {
  const pool = replacePool(oldId);
  if (!pool || !pool.length) return [];
  const left = [...pool], out = [];
  while (out.length < n && left.length) {
    const w = left.map(r => getRating(r.id) > 0 ? 2.2 : 1);
    let x = Math.random() * w.reduce((a, b) => a + b, 0), k = left.length - 1;
    for (let i = 0; i < left.length; i++) { x -= w[i]; if (x <= 0) { k = i; break; } }
    out.push(left.splice(k, 1)[0]);
  }
  return out;
}
function replacePool(oldId) {
  const plan = getActivePlan();
  if (!plan) return null;
  const old = getById(oldId);
  const sess = plan.sessions.find(s => s.recipes.some(r => r.id === oldId));
  if (!old || !sess) return null;
  const inPlan = new Set(plan.sessions.flatMap(s => s.recipes.map(r => r.id)));
  const sessIdx = plan.sessions.indexOf(sess);
  const fishOk = sessIdx === 0 && !plan.sessions.some(s => s.recipes.some(r => r.id !== oldId && isFreshFish(getById(r.id))));
  let pool = getMains().filter(r => r.batch && isAvailable(r) && dietOk(r, householdLactose(), householdGluten()) && !inPlan.has(r.id) && getRating(r.id) >= 0 && (fishOk || !isFreshFish(r)));
  const mids = planMembers(plan);
  const ptOf = mid => plateTarget(planTargets(plan, mid), planShare(plan, mid), proteinBoost(mid));
  const ptMin = mids.map(ptOf).reduce((x, y) => (x.kcal <= y.kcal ? x : y));
  const sc = portionScale(ptMin.kcal);
  if (sc < 1) {
    const light = pool.filter(r => plateFloor(r, sc) <= ptMin.kcal * 1.1);
    if (light.length) pool = light;
  }
  // le remplaçant doit tenir jusqu'au dernier jour où l'ancien plat est mangé
  const lastDay = Math.max(...plan.dates.map((d, i) => (planMembers(plan).some(mid => ['lunch', 'dinner'].some(m => (getEntry(d, mid).meals[m] || []).some(it => it.id === oldId))) ? i : -1)));
  pool = pool.filter(r => deadlineOf(r) >= lastDay);
  const otherRed = plan.sessions.flatMap(s => s.recipes).filter(x => x.id !== oldId && getById(x.id) && isRedMeat(getById(x.id))).length;
  if (otherRed >= RED_MEAT_DISHES && pool.some(r => !isRedMeat(r))) pool = pool.filter(r => !isRedMeat(r));
  // glucides variés : pas de 3e plat de la même famille de féculents
  const others = plan.sessions.flatMap(s => s.recipes.map(x => getById(x.id))).filter(r => r && r.id !== oldId);
  const okStarch = pool.filter(r => others.filter(o => starchFamily(o) === starchFamily(r)).length < STARCH_MAX);
  if (okStarch.length) pool = okStarch;
  const same = pool.filter(r => proteinFamily(r) === proteinFamily(old));
  if (same.length) pool = same;
  return pool;
}
export function replaceDish(oldId, chosenId = null) {
  const plan = getActivePlan();
  if (!plan) return null;
  const old = getById(oldId);
  const sess = plan.sessions.find(s => s.recipes.some(r => r.id === oldId));
  if (!old || !sess) return null;
  const mids = planMembers(plan);
  const ptOf = mid => plateTarget(planTargets(plan, mid), planShare(plan, mid), proteinBoost(mid));
  const pool = replacePool(oldId);
  if (!pool || !pool.length) return null;
  let next = chosenId && pool.find(r => r.id === chosenId);
  if (!next) {
    const weights = pool.map(r => getRating(r.id) > 0 ? 2.2 : 1);
    let x = Math.random() * weights.reduce((a, b) => a + b, 0); next = pool[pool.length - 1];
    for (let k = 0; k < pool.length; k++) { x -= weights[k]; if (x <= 0) { next = pool[k]; break; } }
  }

  // même plat pour tout le foyer, portions recalculées pour chacun
  const cals = mids.map(mid => calibratePlate(next, ptOf(mid)));
  const all = mids.map((mid, mi) => {
    const entries = {};
    plan.dates.forEach(d => {
      const e = getEntry(d, mid);
      ['lunch', 'dinner'].forEach(meal => {
        const list = e.meals[meal] || [];
        if (!list.some(it => it.id === oldId)) return;
        e.meals[meal] = list.map(it => it.id === oldId ? { id: next.id, servings: 1, overrides: { ...cals[mi].main.overrides }, ...(goesToFreezer(next, plan.dates.indexOf(d)) ? { frozen: true } : {}) } : it);
        e.meals.sides = (e.meals.sides || []).filter(sd => sd.with !== meal);
        if (cals[mi].side) e.meals.sides.push({ id: cals[mi].side.id, servings: 1, overrides: { ...cals[mi].side.overrides }, with: meal });
      });
      entries[d] = e;
    });
    return entries;
  });
  // barquettes entières pour le foyer, puis collations recalées jour par jour
  snapToPacks(all, plan.dates, mids.map(mid => portionScale(ptOf(mid).kcal)), mids.map(ptOf), mids.map(mid => breakfastTarget(planTargets(plan, mid))));
  mids.forEach((mid, mi) => plan.dates.forEach((d, dayIdx) => {
    const e = all[mi][d];
    e.meals.sweet = [];
    e.meals.sides = (e.meals.sides || []).filter(sd => sd.with);
    fillDay(e, dayIdx, planSnacks(plan, mid), planTargets(plan, mid), lactoseOf(mid), glutenOf(mid),
      charcLeft(plan.dates, x => all[mi][x] || getEntry(x, mid), e), weekUseOf(plan.dates, x => all[mi][x] || getEntry(x, mid), e), plan.batchDaysBy?.[mid]?.[dayIdx]);
    saveEntry(e, mid);
  }));
  const cal = cals[0];
  sess.recipes = sess.recipes.map(r => r.id === oldId ? { id: next.id, portions: r.portions, side: cal.side?.id || null } : r);
  plan.generatedAt = Date.now(); // nouvelle liste de courses et nouvelle session à cocher
  saveWeekPlan(plan);
  return next;
}

// ── Besoins modifiés en cours de semaine ──
// Garde les mêmes plats et recalcule les portions de chacun à partir d'aujourd'hui
// (nouveaux objectifs), puis recale barquettes et collations. targetsBy = { idPersonne: objectifs }.
export function recalcPortions(targetsBy) {
  const plan = getActivePlan();
  if (!plan) return false;
  const today = getTodayDate();
  const from = Math.max(0, plan.dates.findIndex(d => d >= today));
  const dates = plan.dates.slice(from);
  const mids = planMembers(plan);
  plan.targetsBy = { ...(plan.targetsBy || {}), ...targetsBy };
  const pts = mids.map(mid => plateTarget(planTargets(plan, mid), planShare(plan, mid), proteinBoost(mid)));
  const bts = mids.map(mid => breakfastTarget(planTargets(plan, mid)));
  const scales = pts.map(pt => portionScale(pt.kcal));
  const all = mids.map((mid, mi) => {
    const cache = {}, bcache = {};
    const entries = {};
    dates.forEach(d => {
      const e = getEntry(d, mid);
      ['lunch', 'dinner'].forEach(meal => {
        const list = e.meals[meal] || [];
        const main = list[0] && getById(list[0].id);
        if (!main || (main.tags || []).includes('cantine') || (main.tags || []).includes('imprevu')) return;
        const cal = (cache[main.id] ||= calibratePlate(main, pts[mi]));
        e.meals[meal] = [{ id: main.id, servings: 1, overrides: { ...cal.main.overrides }, ...(list[0].frozen ? { frozen: true } : {}) }, ...list.slice(1)];
        e.meals.sides = (e.meals.sides || []).filter(sd => sd.with !== meal);
        if (cal.side) e.meals.sides.push({ id: cal.side.id, servings: 1, overrides: { ...cal.side.overrides }, with: meal });
      });
      e.meals.breakfast = (e.meals.breakfast || []).map(it => {
        const r = getById(it.id);
        if (!r) return it;
        const res = (bcache[r.id] ||= optimizeRecipe(r, bts[mi], 'B', scales[mi]));
        return { id: r.id, servings: 1, overrides: { ...res.overrides } };
      });
      entries[d] = e;
    });
    return entries;
  });
  // viande déjà mangée les jours passés : elle compte dans les barquettes achetées
  const base = {};
  mids.forEach(mid => plan.dates.slice(0, from).forEach(d => ['breakfast', 'lunch', 'dinner'].forEach(slot => (getEntry(d, mid).meals[slot] || []).forEach(it => {
    const r = getById(it.id);
    if (!r || (r.tags || []).includes('cantine')) return;
    const qs = itemQuantities(it);
    r.ingredients.forEach((ing, i) => { if (INGREDIENTS[ing.key]?.snap) base[ing.key] = (base[ing.key] || 0) + qs[i]; });
  }))));
  snapToPacks(all, dates, scales, pts, bts, base);
  // collations recalées sur les nouveaux objectifs (sans reporter les jours passés, mangés avec les anciens)
  mids.forEach((mid, mi) => dates.forEach((d, k) => {
    const e = all[mi][d];
    e.meals.sweet = [];
    e.meals.sides = (e.meals.sides || []).filter(sd => sd.with);
    fillDay(e, from + k, planSnacks(plan, mid), planTargets(plan, mid), lactoseOf(mid), glutenOf(mid),
      charcLeft(plan.dates, x => all[mi][x] || getEntry(x, mid), e), weekUseOf(plan.dates, x => all[mi][x] || getEntry(x, mid), e), plan.batchDaysBy?.[mid]?.[from + k]);
    saveEntry(e, mid);
  }));
  saveWeekPlan(plan);
  return true;
}

// ── Préférences modifiées en cours de semaine (petit-déjeuner, whey) ──
// Les plats du midi et du soir ne bougent pas : on remplace seulement les petits-déjeuners
// et les collations à partir d'aujourd'hui. prefsBy = { idPersonne: { breakfast, whey } }.
export function refreshExtras(prefsBy) {
  const plan = getActivePlan();
  if (!plan) return false;
  const today = getTodayDate();
  const from = Math.max(0, plan.dates.findIndex(d => d >= today));
  plan.prefsBy = { ...(plan.prefsBy || {}) };
  plan.snacksBy = { ...(plan.snacksBy || {}) };
  Object.entries(prefsBy).forEach(([mid, pr]) => {
    plan.prefsBy[mid] = { breakfast: pr.breakfast || 'mix', whey: pr.whey !== false };
    plan.snacksBy[mid] = pickSnacks(pr.whey !== false, lactoseOf(mid), glutenOf(mid));
    if (plan.batchDaysBy) delete plan.batchDaysBy[mid]; // nouvelles collations : jours habituels
    const T = planTargets(plan, mid);
    const bt = breakfastTarget(T);
    const sc = portionScale(plateTarget(T, planShare(plan, mid)).kcal);
    const classic = (plan.formulaBy?.[mid] || 'jeune') === 'classique';
    // nouveaux petits-déjeuners, session par session, pour les jours restants
    const picks = classic ? pickBreakfasts({ ...pr, whey: pr.whey !== false }, plan.sessions.map(S => S.dates)) : null;
    const cache = {};
    plan.dates.slice(from).forEach((d, k) => {
      const e = getEntry(d, mid);
      if (classic) {
        const si = plan.sessions.findIndex(S => S.dates.includes(d));
        let r = si >= 0 ? picks[si][plan.sessions[si].dates.indexOf(d)] : null;
        e.meals.breakfast = [];
        e.meals.sweet = [];
        e.meals.sides = (e.meals.sides || []).filter(sd => sd.with);
        if (r) {
          const it = () => ({ id: r.id, servings: 1, overrides: { ...(cache[r.id] ||= optimizeRecipe(r, bt, 'B', sc)).overrides } });
          if (charcGrams(it()) > charcLeft(plan.dates, x => getEntry(x, mid), e)) r = breakfastNoCharc({ ...pr, id: mid, whey: pr.whey !== false }, r) || r;
          e.meals.breakfast = [it()];
        }
      }
      e.meals.sweet = [];
      e.meals.sides = (e.meals.sides || []).filter(sd => sd.with);
      fillDay(e, from + k, plan.snacksBy[mid], T, lactoseOf(mid), glutenOf(mid), charcLeft(plan.dates, x => getEntry(x, mid), e), weekUseOf(plan.dates, x => getEntry(x, mid), e), plan.batchDaysBy?.[mid]?.[from + k]);
      saveEntry(e, mid);
    });
  });
  // petits-déjeuners à préparer dans chaque session, recomptés pour tout le foyer
  plan.sessions.forEach(S => {
    const count = {};
    planMembers(plan).forEach(mid => S.dates.forEach(d => (getEntry(d, mid).meals.breakfast || []).forEach(it => { count[it.id] = (count[it.id] || 0) + 1; })));
    S.breakfasts = Object.entries(count).map(([id, portions]) => ({ id, portions, batch: !!getById(id)?.batch }));
  });
  saveWeekPlan(plan);
  return true;
}

// ── Imprévu : repas pris dehors ──
// Le plat prévu est remplacé par une estimation (léger / normal / copieux). Les collations du jour
// se recalent ; ce qui dépasse encore est réparti sur les 2 jours suivants en allégeant les
// collations (les plats et les protéines ne bougent pas).
export const OUTSIDE_LEVELS = {
  light:  { q: 2,   label: 'Léger',   kcal: 600 },
  normal: { q: 3,   label: 'Normal',  kcal: 900 },
  big:    { q: 4.5, label: 'Copieux', kcal: 1350 },
};

export function logOutsideMeal(date, meal, level) {
  const plan = getActivePlan();
  const dayIdx = plan ? plan.dates.indexOf(date) : -1;
  if (dayIdx < 0 || !OUTSIDE_LEVELS[level]) return null;
  const e = getEntry(date);
  e.outside = e.outside || {};
  if (!e.outside[meal]) {
    e.outside[meal] = {
      items: e.meals[meal] || [],
      sides: (e.meals.sides || []).filter(sd => sd.with === meal),
    };
  }
  e.outside[meal].level = level;
  e.meals[meal] = [{ id: 'X01', servings: 1, overrides: { 0: OUTSIDE_LEVELS[level].q } }];
  e.meals.sides = (e.meals.sides || []).filter(sd => sd.with !== meal);
  saveEntry(e);
  rebalanceFrom(plan, dayIdx, getActiveMember().id);
  const skipped = getById(e.outside[meal].items[0]?.id);
  return { skipped: skipped && !(skipped.tags || []).includes('imprevu') ? skipped : null };
}

export function undoOutsideMeal(date, meal) {
  const plan = getActivePlan();
  const dayIdx = plan ? plan.dates.indexOf(date) : -1;
  const e = getEntry(date);
  if (dayIdx < 0 || !e.outside?.[meal]) return false;
  const prev = e.outside[meal];
  e.meals[meal] = prev.items;
  e.meals.sides = [...(e.meals.sides || []).filter(sd => sd.with !== meal), ...prev.sides];
  delete e.outside[meal];
  saveEntry(e);
  rebalanceFrom(plan, dayIdx, getActiveMember().id);
  return true;
}

// Après un changement de recette (ingrédient ajouté ou retiré) : recale les collations
// de la semaine en cours, à partir d'aujourd'hui. Renvoie le nombre de jours concernés.
export function rebalanceAfterRecipeChange(recipeId) {
  const plan = getActivePlan();
  if (!plan) return 0;
  const today = getTodayDate();
  let from = plan.dates.findIndex(d => d >= today);
  if (from < 0) return 0;
  const touched = plan.dates.slice(from).filter(d => ['lunch', 'dinner'].some(m => (getEntry(d).meals[m] || []).some(it => it.id === recipeId))).length;
  if (!touched) return 0;
  planMembers(plan).forEach(mid => rebalanceFrom(plan, from, mid));
  return touched;
}

// Recalcule collations et compléments à partir d'un jour, en reportant les dépassements
function rebalanceFrom(plan, fromIdx, mid) {
  const T = planTargets(plan, mid); // objectifs de la semaine générée
  const snacks = planSnacks(plan, mid);
  const debt = plan.dates.map(() => 0);
  const spill = (i, over) => {
    if (over <= 80) return;
    const next = [i + 1, i + 2].filter(k => k < plan.dates.length);
    next.forEach(k => { debt[k] += over / next.length; });
  };
  // dépassements des 2 jours précédents, déjà figés
  for (let i = Math.max(0, fromIdx - 2); i < fromIdx; i++) {
    spill(i, computeDayTotals(getEntry(plan.dates[i], mid)).kcal - T.kcal);
  }
  for (let i = fromIdx; i < plan.dates.length; i++) {
    const e = getEntry(plan.dates[i], mid);
    e.meals.sweet = [];
    e.meals.sides = (e.meals.sides || []).filter(sd => sd.with);
    const cut = Math.min(debt[i], 700); // on n'allège jamais plus que les collations
    const target = {
      kcal: T.kcal - cut,
      protein: T.protein,
      carbs: Math.max(0, T.carbs - cut * 0.6 / 4),
      fat: Math.max(0, T.fat - cut * 0.4 / 9),
    };
    fillDay(e, i, snacks, target, lactoseOf(mid), glutenOf(mid), charcLeft(plan.dates, x => getEntry(x, mid), e), weekUseOf(plan.dates, x => getEntry(x, mid), e), plan.batchDaysBy?.[mid]?.[i]);
    saveEntry(e, mid);
    spill(i, computeDayTotals(e).kcal - T.kcal);
  }
}

function computeDayTotals(e) {
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  ['breakfast', 'starter', 'lunch', 'dinner', 'sides', 'sweet'].forEach(s => (e.meals[s] || []).forEach(it => {
    const m = computeMealMacros(it);
    Object.keys(t).forEach(k => t[k] += m[k]);
  }));
  return t;
}

// v195 : jour de la session de cuisine = la veille du premier jour planifié (le dimanche, ou aujourd'hui
// pour une semaine commencée en cours de route). Texte : « aujourd'hui », « demain » ou « dimanche 11 octobre ».
export function sessionDate(plan) {
  if (!plan?.dates?.length) return null;
  const d = new Date(plan.dates[0] + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  return localYMD(d);
}
export function sessionWhen(plan, { short = false } = {}) {
  const sd = sessionDate(plan);
  if (!sd) return '';
  const today = localYMD();
  const t = new Date(today + 'T12:00:00'); t.setDate(t.getDate() + 1);
  if (sd === today) return "aujourd'hui";
  if (sd === localYMD(t)) return 'demain';
  return new Date(sd + 'T12:00:00').toLocaleDateString('fr-FR', short ? { weekday: 'long', day: 'numeric' } : { weekday: 'long', day: 'numeric', month: 'long' });
}

// v195 : « ce que tu vas réellement manger » pour une recette, partout dans l'app.
// 1. Si elle est dans ta semaine : la portion prévue (le prochain jour où tu la manges, sinon le dernier).
// 2. Sinon : la portion calculée pour toi (assiette, petit-déjeuner ou collation selon la recette).
// Renvoie { item, date } (date = null pour une estimation).
export function portionFor(recipeId, mid = null) {
  const r = getById(recipeId);
  if (!r) return null;
  const m = mid ? getMembers().find(x => x.id === mid) : getActiveMember();
  const plan = getActivePlan();
  if (plan) {
    const today = getTodayDate();
    const dates = [...plan.dates.filter(d => d >= today), ...plan.dates.filter(d => d < today).reverse()];
    for (const d of dates) {
      const it = Object.values(getEntry(d, m.id).meals || {}).flat().find(x => x && x.id === recipeId);
      if (it) return { item: it, date: d };
    }
  }
  if ((r.tags || []).includes('cantine') || (r.tags || []).includes('libre')) return null;
  const T = planTargets(plan, m.id);
  const share = PLATE_SHARE[m.formula || 'jeune'] || 0.40;
  let overrides;
  if (r.batch && ['lunch', 'dinner', 'main'].includes(r.category) || ['lunch', 'dinner'].includes(r.category)) {
    overrides = calibratePlate(r, plateTarget(T, share, proteinBoost(m.id))).main.overrides;
  } else if (r.category === 'breakfast') {
    overrides = optimizeRecipe(r, breakfastTarget(T), 'B', portionScale(plateTarget(T, share).kcal)).overrides;
  } else {
    const f = 0.12;
    overrides = optimizeRecipe(r, { kcal: T.kcal * f, protein: T.protein * f, carbs: T.carbs * f, fat: T.fat * f }, 'S', portionScale(plateTarget(T, share).kcal)).overrides;
  }
  return { item: { id: r.id, servings: 1, overrides: { ...overrides } }, date: null };
}

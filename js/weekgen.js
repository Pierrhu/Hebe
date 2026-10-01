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

import { getMains, getSweets, getById, proteinFamily, isFreshFish, mainStarch } from '../data/recipes.js';
import { INGREDIENTS, ingCost } from '../data/ingredients.js';
import { optimizeRecipe, calibratePlate, plateTarget, computeMealMacros, subtractMacros, fillRemainder, itemQuantities } from './optimizer.js';
import { getWeekDates, getNextWeekDates, getTodayDate, getEntry, saveEntry } from '../data/log.js';
import { getRating } from '../data/prefs.js';
import { USER } from '../data/user.js';

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
function pickMain(pool, chosen, { allowFish, recent = [] }) {
  // 👎 : jamais tiré, sauf s'il ne reste vraiment rien d'autre
  const liked = pool.filter(r => getRating(r.id) >= 0);
  if (liked.length >= 4) pool = liked;
  const cands = pool.filter(r => !chosen.some(c => c.id === r.id) && (allowFish || !isFreshFish(r)));
  if (!cands.length) return null;
  const weights = cands.map(r => {
    const fam = proteinFamily(r);
    let w = 1;
    if (getRating(r.id) > 0) w *= 2.2;   // 👍 : revient plus souvent
    w /= 1 + 3 * chosen.filter(c => proteinFamily(c) === fam).length;
    w /= 1 + 0.3 * chosen.filter(c => mainStarch(c) === mainStarch(r)).length;
    if (isFreshFish(r) && chosen.some(isFreshFish)) w *= 0.01;
    // recent est rangé du plus ancien au plus récent : les 4 derniers = semaine qu'on vient d'avoir
    const k = recent.indexOf(r.id);
    if (k !== -1) w *= (recent.length - k) <= 4 ? 0.03 : 0.25;
    return w;
  });
  let x = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < cands.length; i++) { x -= weights[i]; if (x <= 0) return cands[i]; }
  return cands[cands.length - 1];
}

// Répartit n repas entre des plats : un plat ne revient qu'une fois par jour,
// et le poisson frais au plus 2 fois (2 premiers jours). Renvoie null si impossible.
function allocate(n, plats, days) {
  const caps = plats.map(p => isFreshFish(p) ? Math.min(2, days) : days);
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
  return counts;
}

// Place les portions dans les créneaux d'une session (earliest-deadline-first)
function schedule(slots, plats, counts) {
  const remaining = [...counts];
  const deadline = plats.map(p => isFreshFish(p) ? 1 : 99); // poisson : jour 0-1 de la session
  const result = [];
  let prevId = null;
  slots.forEach(slot => {
    const sameDay = result.filter(r => r.slot.dayIdx === slot.dayIdx).map(r => r.plat.id);
    // ce qu'on a mangé à ce même repas la veille → on alterne midi/soir
    const yesterday = result.find(r => r.slot.dayIdx === slot.dayIdx - 1 && r.slot.meal === slot.meal)?.plat.id;
    const cands = plats.map((p, i) => i).filter(i => remaining[i] > 0 && !sameDay.includes(plats[i].id));
    const pool = cands.length ? cands : plats.map((p, i) => i).filter(i => remaining[i] > 0);
    pool.sort((a, b) =>
      (deadline[a] - deadline[b]) ||
      ((plats[a].id === yesterday) - (plats[b].id === yesterday)) ||
      (remaining[b] - remaining[a]) ||
      ((plats[a].id === prevId) - (plats[b].id === prevId)));
    const i = pool[0];
    remaining[i]--;
    prevId = plats[i].id;
    result.push({ slot, plat: plats[i] });
  });
  return result;
}

// Choisit les collations de la semaine : un mix sucré / salé, rapides, sans répétition lassante.
function pickSnacks() {
  const all = getSweets().filter(r => getRating(r.id) >= 0);
  const quick = all.filter(s => (s.prepTime + s.cookTime) <= 10);
  const sweet = shuffle(quick.filter(s => (s.tags || []).includes('sucré') || !(s.tags || []).includes('salé')));
  const salty = shuffle(quick.filter(s => (s.tags || []).includes('salé')));
  const batchy = shuffle(all.filter(s => s.batch));
  const picks = [sweet[0], salty[0], sweet[1], batchy[0]].filter(Boolean);
  return [...new Set(picks.map(p => p.id))];
}

// ── Génère la semaine ──
// opts = { cantineDays: [0..6], nextWeek, targets, proteins: [familles] }
// Budget : on vise ~60 €. Une semaine tirée au-dessus de 70 € est simplement retirée
// (on ne choisit PAS la semaine « la mieux calibrée », sinon les mêmes plats reviennent toujours).
const COST_MAX = 70;
const RECENT_KEY = 'hebe_recent_mains';
const getRecent = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; } };

export function generateWeek(opts = {}) {
  const recent = getRecent(); // du plus ancien au plus récent
  // On retire au plus quelques tirages trop chers (> 70 €). Si aucun ne passe (protéines chères
  // sélectionnées), on garde le PREMIER tirage : surtout pas « le moins cher », qui ramènerait
  // toujours les mêmes plats.
  const first = generateWeekOnce({ ...opts, recent });
  let cand = first;
  for (let i = 0; i < 5 && cand.plan.cost > COST_MAX; i++) cand = generateWeekOnce({ ...opts, recent });
  if (cand.plan.cost > COST_MAX) cand = first;
  // mémoire : les 12 derniers plats servis (≈ 3 semaines)
  const ids = cand.mains.map(m => m.id);
  const next = [...recent.filter(id => !ids.includes(id)), ...ids].slice(-12);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  saveWeekPlan(cand.plan);
  return cand;
}

function generateWeekOnce({ cantineDays = [], nextWeek = true, targets, proteins = null, recent = [] } = {}) {
  targets = targets || { kcal: 2200, protein: 150, carbs: 230, fat: 70 };
  const dates = nextWeek ? getNextWeekDates() : getWeekDates();

  // Pool : plats complets, batchables, filtrés par les protéines choisies
  let pool = getMains().filter(r => r.batch);
  if (proteins && proteins.length) {
    const f = pool.filter(r => proteins.includes(proteinFamily(r)));
    if (f.length >= 4) pool = f;
  }
  const onlyFish = pool.every(isFreshFish);

  const SESSIONS = [
    { key: 'A', label: 'Dimanche', days: [0, 1, 2] },
    { key: 'B', label: 'Mercredi soir', days: [3, 4, 5, 6] },
  ];

  const pt = plateTarget(targets);
  const portionCache = {}; // id → assiette calibrée (plat + accompagnement éventuel)
  const calibrate = (r) => {
    if (!portionCache[r.id]) portionCache[r.id] = calibratePlate(r, pt);
    return portionCache[r.id];
  };

  const entries = {};
  dates.forEach(d => entries[d] = { date: d, meals: { starter: [], lunch: [], dinner: [], sides: [], sweet: [] } });

  const chosen = [];
  const sessions = [];
  SESSIONS.forEach((S, si) => {
    const slots = [];
    S.days.forEach((dayIdx, k) => {
      if (!cantineDays.includes(dayIdx)) slots.push({ dayIdx, k, meal: 'lunch' });
      slots.push({ dayIdx, k, meal: 'dinner' });
    });
    const n = slots.length;
    if (!n) return;
    const nDays = S.days.length;
    let k = Math.max(n >= 3 ? 2 : 1, Math.ceil(n / nDays));
    const plats = [];
    let counts = null;
    for (let guard = 0; guard < 6; guard++) {
      while (plats.length < k) {
        const p = pickMain(pool, [...chosen, ...plats], { allowFish: si === 0 || onlyFish, recent });
        if (!p) break;
        plats.push(p);
      }
      counts = allocate(n, plats, nDays);
      if (counts) break;
      k++;
    }
    if (!counts) return;
    chosen.push(...plats);
    const placed = schedule(slots, plats, counts);
    placed.forEach(({ slot, plat }) => {
      const date = dates[slot.dayIdx];
      const res = calibrate(plat);
      entries[date].meals[slot.meal].push({ id: plat.id, servings: 1, overrides: { ...res.main.overrides } });
      if (res.side) entries[date].meals.sides.push({ id: res.side.id, servings: 1, overrides: { ...res.side.overrides }, with: slot.meal });
    });
    sessions.push({
      key: S.key, label: S.label,
      dates: S.days.map(i => dates[i]),
      recipes: plats.map((p, i) => ({ id: p.id, portions: counts[i], side: calibrate(p).side?.id || null })).filter(x => x.portions > 0),
    });
  });

  // Totaux achetables : on ajuste les portions pour que viandes / poissons tombent sur des barquettes entières
  snapToPacks(entries, dates);

  // Midis cantine
  cantineDays.forEach(i => entries[dates[i]].meals.lunch.push({ id: 'C01', servings: 1 }));

  // Collations : recalées chaque jour sur ce qu'il manque
  const snackIds = pickSnacks();
  dates.forEach((d, dayIdx) => fillDay(entries[d], dayIdx, snackIds, targets));

  // Coût estimé de la semaine (ce qui est réellement mangé, hors cantine et placard)
  let cost = 0;
  dates.forEach(d => ['starter', 'lunch', 'dinner', 'sides', 'sweet'].forEach(s =>
    (entries[d].meals[s] || []).forEach(it => cost += itemCost(it))));

  const plan = { start: dates[0], dates, sessions, snacks: snackIds, targets, cost: Math.round(cost), generatedAt: Date.now() };
  return { dates, entries, plan, mains: chosen, cantineDays };
}

// ── Formats du commerce ──
// Pour chaque ingrédient « snap » (viandes, poissons, tofu), on additionne ce que la semaine utilise,
// on vise le multiple de barquette le plus proche, et on applique le même facteur à toutes les portions.
// Contrainte : chaque portion reste dans sa fourchette réaliste (tolérance de 10 % vers le bas uniquement).
// Les collations, ajoutées ensuite, rattrapent les calories d'écart.
export function snapToPacks(entries, dates) {
  const uses = {}; // key → [{ item, idx, qty }]
  dates.forEach(d => ['lunch', 'dinner'].forEach(slot => (entries[d].meals[slot] || []).forEach(item => {
    const r = getById(item.id);
    if (!r || (r.tags || []).includes('cantine')) return;
    const qs = itemQuantities(item);
    r.ingredients.forEach((ing, idx) => {
      const db = INGREDIENTS[ing.key];
      if (db && db.snap && qs[idx] > 0) (uses[ing.key] ||= []).push({ item, idx, qty: qs[idx] });
    });
  })));
  const report = {};
  Object.entries(uses).forEach(([key, list]) => {
    const db = INGREDIENTS[key];
    const total = list.reduce((a, u) => a + u.qty, 0);
    const lo = (db.min || 0) * 0.9, hi = db.max || Infinity; // jamais au-dessus du max autorisé
    let best = null;
    const kMax = Math.ceil(total / db.pack) + 2;
    for (let k = 1; k <= kMax; k++) {
      const target = k * db.pack;
      const f = target / total;
      const ok = list.every(u => u.qty * f >= lo && u.qty * f <= hi);
      if (!ok) continue;
      // on préfère arrondir vers le haut : réduire la viande coûte plus cher en protéines qu'en ajouter
      const dist = target >= total ? target - total : (total - target) * 1.6;
      if (!best || dist < best.dist) best = { target, f, dist };
    }
    if (!best) { report[key] = { total, target: null }; return; }
    list.forEach(u => {
      if (!u.item.overrides) u.item.overrides = {};
      // quantité exacte (non arrondie) : le total de la semaine tombe pile sur les barquettes
      u.item.overrides[u.idx] = Math.round(u.qty * best.f * 10) / 10;
    });
    report[key] = { total, target: best.target };
  });
  return report;
}

// Collations et compléments d'une journée, recalés sur ce qu'il manque après les plats
function fillDay(e, dayIdx, snackIds, targets) {
  // ignore les recettes supprimées depuis la génération du plan (ex. onigiri)
  snackIds = snackIds.filter(id => getById(id) && getRating(id) >= 0);
  if (!snackIds.length) snackIds = pickSnacks();
  const used = computeDayTotals(e);
  const rem = subtractMacros(targets, used);
  // rotation : on commence par une collation différente chaque jour
  let rot = snackIds.map((_, i) => snackIds[(i + dayIdx) % snackIds.length]);
  // pas de thon / d'œufs en collation si le plat du jour en contient déjà
  const dayKeys = new Set(['lunch', 'dinner'].flatMap(s => e.meals[s] || []).flatMap(it => getById(it.id)?.ingredients.map(i => i.key) || []));
  const clash = id => (getById(id)?.ingredients || []).some(i => ['thon', 'oeuf'].includes(i.key) && dayKeys.has(i.key));
  rot = [...rot.filter(id => !clash(id)), ...rot.filter(clash)];
  // compléments sans préparation : les 2 tartines carré frais d'abord (elles alternent), puis les autres
  const TARTINES = dayIdx % 2 ? ['S11', 'S12'] : ['S12', 'S11'];
  const OTHERS = ['S09', 'S07', 'S08', 'S05', 'S16'].filter(id => getRating(id) >= 0);
  const off = Math.floor(Math.random() * Math.max(OTHERS.length, 1));
  const fillers = [...TARTINES.filter(id => getRating(id) >= 0), ...OTHERS.map((_, i) => OTHERS[(i + off + dayIdx) % OTHERS.length])];
  fillRemainder(rem, rot, fillers).forEach(f => e.meals[f.slot].push(f.item));
}

// ── Remplacer un plat de la semaine ──
// Tire un autre plat (même protéine si possible), recalcule ses portions, l'applique à toutes
// ses portions de la session, puis recale barquettes et collations. Renvoie le nouveau plat ou null.
export function replaceDish(oldId) {
  const plan = getActivePlan();
  if (!plan) return null;
  const old = getById(oldId);
  const sess = plan.sessions.find(s => s.recipes.some(r => r.id === oldId));
  if (!old || !sess) return null;
  const inPlan = new Set(plan.sessions.flatMap(s => s.recipes.map(r => r.id)));
  const sessIdx = plan.sessions.indexOf(sess);
  const fishOk = sessIdx === 0 && !plan.sessions.some(s => s.recipes.some(r => r.id !== oldId && isFreshFish(getById(r.id))));
  let pool = getMains().filter(r => r.batch && !inPlan.has(r.id) && getRating(r.id) >= 0 && (fishOk || !isFreshFish(r)));
  const same = pool.filter(r => proteinFamily(r) === proteinFamily(old));
  if (same.length) pool = same;
  if (!pool.length) return null;
  const weights = pool.map(r => getRating(r.id) > 0 ? 2.2 : 1);
  let x = Math.random() * weights.reduce((a, b) => a + b, 0), next = pool[pool.length - 1];
  for (let k = 0; k < pool.length; k++) { x -= weights[k]; if (x <= 0) { next = pool[k]; break; } }

  const targets = plan.targets || USER.targets;
  const cal = calibratePlate(next, plateTarget(targets));
  const entries = {};
  plan.dates.forEach(d => {
    const e = getEntry(d);
    ['lunch', 'dinner'].forEach(meal => {
      const list = e.meals[meal] || [];
      if (!list.some(it => it.id === oldId)) return;
      e.meals[meal] = list.map(it => it.id === oldId ? { id: next.id, servings: 1, overrides: { ...cal.main.overrides } } : it);
      e.meals.sides = (e.meals.sides || []).filter(sd => sd.with !== meal);
      if (cal.side) e.meals.sides.push({ id: cal.side.id, servings: 1, overrides: { ...cal.side.overrides }, with: meal });
    });
    entries[d] = e;
  });
  // barquettes entières, puis collations recalées jour par jour
  snapToPacks(entries, plan.dates);
  plan.dates.forEach((d, dayIdx) => {
    const e = entries[d];
    e.meals.sweet = [];
    e.meals.sides = (e.meals.sides || []).filter(sd => sd.with);
    fillDay(e, dayIdx, plan.snacks || pickSnacks(), targets);
    saveEntry(e);
  });
  sess.recipes = sess.recipes.map(r => r.id === oldId ? { id: next.id, portions: r.portions, side: cal.side?.id || null } : r);
  plan.generatedAt = Date.now(); // nouvelle liste de courses et nouvelle session à cocher
  saveWeekPlan(plan);
  return next;
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
  rebalanceFrom(plan, dayIdx);
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
  rebalanceFrom(plan, dayIdx);
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
  rebalanceFrom(plan, from);
  return touched;
}

// Recalcule collations et compléments à partir d'un jour, en reportant les dépassements
function rebalanceFrom(plan, fromIdx) {
  const T = plan.targets || USER.targets; // objectifs de la semaine générée
  const snacks = plan.snacks || pickSnacks();
  const debt = plan.dates.map(() => 0);
  const spill = (i, over) => {
    if (over <= 80) return;
    const next = [i + 1, i + 2].filter(k => k < plan.dates.length);
    next.forEach(k => { debt[k] += over / next.length; });
  };
  // dépassements des 2 jours précédents, déjà figés
  for (let i = Math.max(0, fromIdx - 2); i < fromIdx; i++) {
    spill(i, computeDayTotals(getEntry(plan.dates[i])).kcal - T.kcal);
  }
  for (let i = fromIdx; i < plan.dates.length; i++) {
    const e = getEntry(plan.dates[i]);
    e.meals.sweet = [];
    e.meals.sides = (e.meals.sides || []).filter(sd => sd.with);
    const cut = Math.min(debt[i], 700); // on n'allège jamais plus que les collations
    const target = {
      kcal: T.kcal - cut,
      protein: T.protein,
      carbs: Math.max(0, T.carbs - cut * 0.6 / 4),
      fat: Math.max(0, T.fat - cut * 0.4 / 9),
    };
    fillDay(e, i, snacks, target);
    saveEntry(e);
    spill(i, computeDayTotals(e).kcal - T.kcal);
  }
}

function computeDayTotals(e) {
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  ['starter', 'lunch', 'dinner', 'sides', 'sweet'].forEach(s => (e.meals[s] || []).forEach(it => {
    const m = computeMealMacros(it);
    Object.keys(t).forEach(k => t[k] += m[k]);
  }));
  return t;
}

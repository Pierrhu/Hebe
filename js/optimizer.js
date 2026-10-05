// optimizer.js — Ajuste les quantités d'une recette pour viser des macros,
// SANS sortir de portions humaines.
//
// Principes :
//  1. On optimise un REPAS à la fois (pas une journée entière dans un seul plat).
//  2. Seuls certains ingrédients bougent (« leviers ») et chacun reste dans sa fourchette
//     réaliste définie dans data/ingredients.js (ex. riz cru 50-110 g, poulet 110-200 g).
//  3. On reste proche de la recette d'origine (pénalité d'écart) : le plat garde son identité.
//  4. Ce qu'une assiette ne peut pas absorber est donné aux collations — pas au riz.

import { getById, isCantine } from '../data/recipes.js';
import { INGREDIENTS, isCountableUnit, ingCost, NATURAL_UNITS } from '../data/ingredients.js';

const MACROS = ['kcal', 'protein', 'carbs', 'fat'];

// Réglages du moteur (modifiables pour tester)
export const OPT = {
  priceWeight: 0.15,      // poids du prix dans le calibrage des portions
  plateProteinShare: 1.1, // part des protéines portée par les assiettes (le reste : collation / whey)
  autoSides: true,        // ajouter un accompagnement à l'assiette si ça aide…
  autoSideIds: [], // plus d'accompagnement : les plats sont complets
};

// Compat : classification par nom (utilisée par d'anciens modules)
export function classifyIngredient(name) {
  const db = Object.values(INGREDIENTS).find(i => i.name === name);
  if (!db) return 'fixed';
  if (db.role === 'protein') return 'protein';
  if (db.role === 'carb') return 'carb';
  if (db.role === 'legume') return 'both';
  return 'fixed';
}

// Arrondi « cuisine » selon l'ingrédient
export function snapQty(q, countable, key) {
  if (countable) return Math.max(0, Math.round(q));
  const db = key ? INGREDIENTS[key] : null;
  if (key && NATURAL_UNITS[key]) { const g = NATURAL_UNITS[key].g; return Math.max(g, Math.round(q / g) * g); } // tranche entière
  if (db) {
    if (key === 'huile' || key === 'huile_sesame') return Math.round(q);
    if (['whey', 'beurre_cacahuete', 'amandes'].includes(key)) return Math.round(q / 5) * 5;
    if (['pdt', 'patate_douce', 'fromage_blanc', 'skyr', 'yaourt_grec'].includes(key)) return Math.round(q / 25) * 25;
    if (db.role === 'protein' || (db.max && db.max > 130)) return Math.round(q / 10) * 10;
    return Math.round(q / 5) * 5;
  }
  if (q >= 200) return Math.round(q / 25) * 25;
  if (q >= 60) return Math.round(q / 10) * 10;
  return Math.round(q / 5) * 5;
}

function perUnit(ing) {
  const q = ing.qty || 1;
  return { kcal: ing.kcal / q, protein: ing.protein / q, carbs: ing.carbs / q, fat: ing.fat / q };
}

// Quantités effectives d'un item planifié
export function itemQuantities(item) {
  const r = getById(item.id);
  if (!r) return [];
  const s = item.servings || 1;
  const ov = item.overrides || {};
  return r.ingredients.map((ing, i) => (ov[i] != null ? ov[i] : ing.qty * s));
}

// ── Repères de qualité (Santé publique France) ──
// Charcuterie : 150 g par semaine au plus. Viande rouge : 500 g cuits par semaine au plus (voir weekgen.js).
export const CHARC_KEYS = ['jambon_blanc', 'poulet_tranches'];
export const CHARC_MAX = 160; // v191 : 4 tranches de 40 g par semaine, soit une barquette entière
export const RED_MEAT_KEYS = ['boeuf', 'boeuf_emince'];
// Fruits et oléagineux : les compléments qui en contiennent sont préférés à macros équivalentes
export const FRUIT_KEYS = ['banane', 'pomme', 'fruits_rouges', 'fruit_saison', 'mangue', 'dattes'];
export const NUT_KEYS = ['amandes', 'beurre_cacahuete', 'cacahuetes', 'pistaches', 'chia', 'sesame', 'tahini'];
export const FRUIT_NUT_KEYS = [...FRUIT_KEYS, ...NUT_KEYS];
// score multiplié (plus bas = meilleur) : les oléagineux, plus caloriques, ont besoin d'un coup de pouce plus fort
const FRUIT_BONUS = 0.85, NUT_BONUS = 0.6;
export const hasFruitOrNut = r => !!r && r.ingredients.some(i => FRUIT_NUT_KEYS.includes(i.key));
// Calcium d'une recette, en mg pour 100 kcal (table micros.js)
export function calciumPer100kcal(r) {
  if (typeof MICROS === 'undefined' || !r?.macros?.kcal) return 0;
  const ca = r.ingredients.reduce((a, i) => { const row = MICROS[i.key]; return row ? a + row[3] * (INGREDIENTS[i.key]?.unit === 'pièce' ? i.qty : i.qty / 100) : a; }, 0);
  return ca / r.macros.kcal * 100;
}
const qualityBonus = r => (r.ingredients.some(i => NUT_KEYS.includes(i.key)) ? NUT_BONUS : r.ingredients.some(i => FRUIT_KEYS.includes(i.key)) ? FRUIT_BONUS : 1);
export function charcGrams(item) {
  const r = getById(item.id);
  if (!r || !r.ingredients.some(i => CHARC_KEYS.includes(i.key))) return 0;
  const qs = itemQuantities(item);
  return r.ingredients.reduce((a, ing, i) => a + (CHARC_KEYS.includes(ing.key) ? qs[i] : 0), 0);
}
export const charcOfEntry = e => ['breakfast', 'starter', 'lunch', 'dinner', 'sides', 'sweet']
  .reduce((a, s) => a + (e?.meals?.[s] || []).reduce((b, it) => b + charcGrams(it), 0), 0);

export function computeMealMacros(item) {
  const r = getById(item.id);
  if (!r) return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const qs = itemQuantities(item);
  return r.ingredients.reduce((acc, ing, i) => {
    const pu = perUnit(ing);
    MACROS.forEach(m => acc[m] += pu[m] * qs[i]);
    return acc;
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });
}

export function computeDayFromItems(items) {
  return items.reduce((acc, it) => {
    const m = computeMealMacros(it);
    MACROS.forEach(k => acc[k] += m[k]);
    return acc;
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });
}

// Écart aux cibles. kcal en priorité, protéines : manquer coûte cher, dépasser un peu non.
function score(t, T) {
  const d = m => (t[m] - T[m]) / Math.max(T[m], 1);
  const dK = d('kcal'), dP = d('protein'), dC = d('carbs'), dF = d('fat');
  // Les lipides manquants pèsent autant que les protéines manquantes : sinon le moteur
  // « bouche » les calories avec des glucides et les journées sont trop maigres.
  return 6 * dK * dK + (dP < 0 ? 5 : 0.8) * dP * dP + (dC > 0 ? 1.2 : 0.6) * dC * dC + (dF < 0 ? 4 : 1.5) * dF * dF;
}

// ── Optimise UNE recette pour une cible de repas ──
// mode : 'P' (plat) ou 'S' (collation) → choisit quels ingrédients servent de leviers.
// Renvoie { overrides: {idx: qty}, macros }
// Les minimums « plat » (féculent principal, protéine) sont pensés pour une assiette d'environ
// 1 140 kcal. Pour de plus petits besoins, ils diminuent en proportion (jusqu'à 60 %).
export const PLATE_REF_KCAL = 1140;
export const portionScale = plateKcal => Math.min(1, Math.max(0.5, plateKcal / PLATE_REF_KCAL));
// Plancher d'une assiette : ses calories quand tous les leviers sont au minimum
const floorCache = {};
export function plateFloor(recipe, scale = 1) {
  const k = recipe.id + '@' + scale.toFixed(2);
  if (floorCache[k] == null) floorCache[k] = optimizeRecipe(recipe, { kcal: 0, protein: 0, carbs: 0, fat: 0 }, 'P', scale).macros.kcal;
  return floorCache[k];
}
function scaledMin(key, value, scale) {
  if (scale >= 1) return value;
  const nu = NATURAL_UNITS[key];
  // pains, wraps, pitas : on garde des unités entières (arrondi au-dessus)
  return nu ? Math.max(nu.g, Math.ceil(value * scale / nu.g - 1e-9) * nu.g) : Math.ceil(value * scale / (value >= 200 ? 25 : 10) - 1e-9) * (value >= 200 ? 25 : 10);
}

// Protéine principale d'une recette : l'ingrédient protéique qui apporte le plus de protéines
export function mainProteinIdx(recipe) {
  let best = -1, p = 0;
  recipe.ingredients.forEach((ing, idx) => {
    const db = INGREDIENTS[ing.key];
    if (!ing.extra && db && db.role === 'protein' && ing.protein > p) { p = ing.protein; best = idx; }
  });
  return best;
}

// fixed = { index: quantité } : ingrédients imposés (viande calée sur les barquettes achetées)
export function optimizeRecipe(recipe, target, mode = 'P', scale = 1, fixed = null) {
  const qty = recipe.ingredients.map(i => i.qty);
  if (fixed) Object.entries(fixed).forEach(([i, q]) => { qty[i] = q; });
  const pu = recipe.ingredients.map(perUnit);
  const levers = [];
  // Protéine principale = l'ingrédient protéique qui apporte le plus de protéines.
  // Dans un plat, seule elle varie (l'œuf d'une panure ou le bœuf d'un mapo tofu restent fixes).
  let mainProt = -1, mainP = 0;
  recipe.ingredients.forEach((ing, idx) => {
    const db = INGREDIENTS[ing.key];
    if (!ing.extra && db && db.role === 'protein' && ing.protein > mainP) { mainP = ing.protein; mainProt = idx; }
  });
  // Féculent principal : c'est lui qui reçoit le minimum « plat » (minP).
  // Riz en priorité, sinon le féculent qui pèse le plus en calories dans la recette.
  let mainStarch = recipe.ingredients.findIndex(i => !i.extra && (i.key === 'riz' || i.key === 'riz_blanc'));
  if (mainStarch < 0) {
    let bestK = 0;
    recipe.ingredients.forEach((ing, idx) => {
      if (!ing.extra && INGREDIENTS[ing.key]?.minP && ing.kcal > bestK) { bestK = ing.kcal; mainStarch = idx; }
    });
  }
  if (!isCantine(recipe)) {
    recipe.ingredients.forEach((ing, idx) => {
      const db = INGREDIENTS[ing.key];
      // mode 'B' (petit-déjeuner) : tous les leviers de l'ingrédient, plat comme collation
      if (ing.extra || !db || !(mode === 'B' ? !!db.lv : db.lv.includes(mode))) return; // tes ajouts gardent leur quantité
      if (fixed && fixed[idx] != null) return;
      if (mode === 'P' && db.role === 'protein' && idx !== mainProt) return;
      const countable = isCountableUnit(ing.unit);
      // minP : minimum imposé dans les plats (ex. jamais moins de 90 g de riz cru)
      const rawMin = mode === 'P' && db.minP && idx === mainStarch ? db.minP : Math.min(db.min ?? ing.qty, ing.qty);
      const min = !countable ? scaledMin(ing.key, rawMin, scale) : rawMin;
      // maxS : plafond propre aux collations (ex. riz au lait : 60 g de riz au plus)
      const max = mode === 'S' && db.maxS ? Math.max(db.maxS, Math.min(ing.qty, db.maxS)) : Math.max(db.max ?? ing.qty, ing.qty, min);
      const span = max - min;
      const step = countable ? 1 : Math.max(1, Math.round(span / 40));
      levers.push({ idx, key: ing.key, base: ing.qty, min, max, step, countable });
    });
  }
  // on part toujours d'une quantité dans les bornes (ex. riz remonté à 90 g s'il était en dessous)
  levers.forEach(l => { qty[l.idx] = Math.min(l.max, Math.max(l.min, qty[l.idx])); });
  const totals = () => {
    const t = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    qty.forEach((q, i) => MACROS.forEach(m => t[m] += pu[i][m] * q));
    return t;
  };
  // Pénalité d'écart à la recette d'origine : le plat garde son équilibre
  // (écart normalisé par la fourchette autorisée : une viande à 120-350 g a plus de marge qu'une huile à 4-12 g)
  const LAMBDA = 0.15;
  const drift = () => levers.reduce((a, l) => {
    const rel = (qty[l.idx] - l.base) / Math.max(l.max - l.min, l.countable ? 1 : 20);
    return a + rel * rel;
  }, 0);
  // Sensibilité au prix : à calories égales, l'optimiseur préfère l'ingrédient le moins cher
  // (ex. un peu plus de riz plutôt que 50 g de bœuf en plus). OPT.priceWeight = 0 pour désactiver.
  const euros = () => recipe.ingredients.reduce((a, ing, i) => a + ingCost(ing.key, qty[i]), 0);
  const cost = () => score(totals(), target) + LAMBDA * drift() + OPT.priceWeight * euros() / 3;

  let best = cost();
  for (let pass = 0; pass < 25 && levers.length; pass++) {
    let improved = false;
    for (const l of levers) {
      const start = qty[l.idx];
      let bestV = start;
      for (let v = l.min; v <= l.max + 1e-9; v += l.step) {
        qty[l.idx] = v;
        const c = cost();
        if (c < best - 1e-9) { best = c; bestV = v; improved = true; }
      }
      qty[l.idx] = bestV;
    }
    if (!improved) break;
  }
  const overrides = {};
  recipe.ingredients.forEach((ing, i) => {
    const isLever = levers.some(l => l.idx === i);
    overrides[i] = fixed && fixed[i] != null ? fixed[i] : isLever ? snapQty(qty[i], isCountableUnit(ing.unit), ing.key) : ing.qty;
  });
  // macros finales (après arrondi)
  const macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  recipe.ingredients.forEach((ing, i) => MACROS.forEach(m => macros[m] += pu[i][m] * overrides[i]));
  return { overrides, macros, score: score(macros, target) };
}

// ── Répartition d'une journée ──
// Une assiette vise ~34 % des kcal du jour, mais jamais plus que ce qu'on peut raisonnablement
// manger (800 kcal, 900 si objectif > 3000). Le reste part en collation(s).
// share : part des calories du jour portée par chaque plat (jeûne 40 %, classique 32 %)
export const PLATE_SHARE = { jeune: 0.40, classique: 0.32 };
export const BREAKFAST_SHARE = 0.20;
// boost : part de protéines en plus dans les plats, pour qui n'a plus de compléments protéinés (régime)
export function plateTarget(T, share = 0.40, boost = 1) {
  // Les plats portent l'essentiel de la journée : grosses portions de féculents,
  // donc moins de collations à côté.
  const cap = T.kcal > 3000 ? 1350 : 1250;
  const kcal = Math.max(400, Math.min(cap, T.kcal * share));
  const f = kcal / T.kcal;
  return {
    kcal: Math.round(kcal),
    protein: Math.round(T.protein * Math.min(f * OPT.plateProteinShare * boost, 0.45 * boost)),
    carbs: Math.round(T.carbs * f),
    // les à-côtés (tartines au carré frais 0 %, collations whey) sont maigres : les plats portent un peu plus de lipides
    fat: Math.round(T.fat * Math.min(f * 1.2, 0.5)),
  };
}

// Cible du petit-déjeuner (formule classique) : 20 % des calories, une part un peu plus grande des protéines
export function breakfastTarget(T) {
  const f = BREAKFAST_SHARE;
  return { kcal: Math.round(T.kcal * f), protein: Math.round(T.protein * 0.24), carbs: Math.round(T.carbs * f), fat: Math.round(T.fat * f) };
}

// Calibre une ASSIETTE : le plat seul, ou le plat + un de ses accompagnements air fryer.
// On garde l'option la plus proche de la cible ; l'accompagnement n'est ajouté que s'il aide.
// Renvoie { main: {overrides, macros}, side: {id, overrides, macros} | null, macros }
export function calibratePlate(recipe, target) {
  const scale = portionScale(target.kcal);
  const alone = optimizeRecipe(recipe, target, 'P', scale);
  let best = { main: alone, side: null, macros: alone.macros, score: alone.score };
  if (!OPT.autoSides) return best;
  // jamais d'accompagnement qui répète un féculent déjà dans le plat (burger + ses frites de patate douce, etc.)
  const mainCarbs = new Set(recipe.ingredients.filter(i => ['carb', 'legume'].includes(INGREDIENTS[i.key]?.role)).map(i => i.key));
  (recipe.pairs || []).filter(sid => OPT.autoSideIds.includes(sid)).forEach(sid => {
    const side = getById(sid);
    if (!side || side.unavailable) return; // accompagnement impossible avec l'équipement du foyer
    if (side.ingredients.some(i => mainCarbs.has(i.key))) return;
    const sm = side.macros;
    const rest = {};
    MACROS.forEach(m => rest[m] = Math.max(0, target[m] - sm[m]));
    const main = optimizeRecipe(recipe, rest, 'P', scale);
    const tot = {};
    MACROS.forEach(m => tot[m] = main.macros[m] + sm[m]);
    const sc = score(tot, target) + 0.02; // légère préférence pour l'assiette simple
    if (sc < best.score) {
      const overrides = {};
      side.ingredients.forEach((ing, i) => overrides[i] = ing.qty);
      best = { main, side: { id: sid, overrides, macros: sm }, macros: tot, score: sc };
    }
  });
  return best;
}

export function subtractMacros(T, used) {
  const out = {};
  MACROS.forEach(m => out[m] = Math.max(0, T[m] - used[m]));
  return out;
}

// Remplit le « reste » d'une journée, dans cet ordre (on s'arrête dès que c'est bouclé) :
//   1. la collation du jour : la mieux adaptée parmi les 2 proposées par la rotation (≤ ~650 kcal)
//   2-4. jusqu'à trois compléments sans préparation : d'abord les tartines carré frais
//        (miel-thym, blanc de poulet), puis banane-cacahuète, amandes, fromage blanc, fruit, skyr
//   4. une 2e collation seulement si l'écart reste vraiment important Renvoie [{ slot, item }]
// Produits laitiers « en bol » : un seul par jour (pas deux fromages blancs le même jour)
const DAIRY_BASES = ['fromage_blanc', 'yaourt_grec', 'yaourt_sl'];
// Variété (v187) : les tartines ont un vrai plafond par semaine ; pour le reste, chaque jour déjà servi
// rend la collation ou le complément moins attractif (sans l'interdire si la journée en a besoin)
export const WEEK_CAPS = { S12: 3, S11: 3 };
export const weekCap = id => WEEK_CAPS[id] ?? Infinity;
const VARIETY_PENALTY = 0.6; // score × (1 + 0,6 × jours déjà servis)
export function fillRemainder(remaining, rotation, fillers = ['S12', 'S11', 'S09', 'S07', 'S08', 'S05', 'S16'], scale = 1, dayKeys = new Set(), charcLeft = Infinity, weekUse = {}) {
  const out = [];
  let rem = { ...remaining };
  const used = new Set();
  const usedBases = new Set(DAIRY_BASES.filter(k => dayKeys.has(k)));
  const basesOf = r => r.ingredients.map(i => i.key).filter(k => DAIRY_BASES.includes(k));
  const plan = [
    // v187 : la collation passe en premier, choisie parmi 2 options qui changent chaque jour
    // (seulement s'il reste au moins 200 kcal : sinon un petit complément convient mieux aux petits gabarits)
    { pool: rotation.slice(0, 2), cap: 650, minRem: 200 },
    // puis le meilleur complément (tartines, fruit, amandes, fromage blanc-cacahuète…), chacun plafonné sur la semaine
    { pool: fillers,              cap: 350, minRem: 120 },
    // si la journée manque de lipides, les compléments gras (amandes, beurre de cacahuète) entrent en lice
    { pool: fillers.filter(id => ['S07', 'S08'].includes(id)), cap: 300, minRem: 120, fatty: true },
    // 2e collation seulement si l'écart reste vraiment important
    { pool: rotation.slice(2, 3), cap: 650, minRem: 120 },
    // petits besoins : un fruit pour combler un petit écart
    { pool: fillers.filter(id => ['S05', 'S16'].includes(id)), cap: 200, minRem: 70, small: true },
    // rattrapage : s'il manque encore beaucoup, n'importe quelle collation ou complément encore permis ce jour-là
    { pool: [...rotation, ...fillers], cap: 400, minRem: 100 },
    // 2e passe de rattrapage : les très gros profils (3 000 kcal et plus) ont besoin de plus de compléments
    { pool: [...rotation, ...fillers], cap: 400, minRem: 150 },
  ];
  for (const stepCfg of plan) {
    if (rem.kcal < stepCfg.minRem) continue;
    const share = Math.min(1, stepCfg.cap / rem.kcal);
    const tgt = {};
    MACROS.forEach(m => tgt[m] = rem[m] * share);
    let best = null;
    let pool = stepCfg.pool;
    if (stepCfg.fatty && rem.fat * 9 > rem.kcal * 0.3) pool = [...new Set([...pool, ...fillers.filter(id => ['S07', 'S09', 'S08'].includes(id))])];
    pool.filter(id => !used.has(id) && (weekUse[id] || 0) < weekCap(id)).forEach(id => { // plafond de la semaine
      const r = getById(id);
      if (!r) return;
      if (usedBases.size && basesOf(r).length) return; // déjà un fromage blanc ou un yaourt ce jour-là
      const res = optimizeRecipe(r, tgt, 'S', scale);
      // charcuterie : jamais au-delà de ce qu'il reste du plafond de la semaine
      const charc = charcGrams({ id, servings: 1, overrides: res.overrides });
      if (charc > charcLeft) return;
      // pas de pénalité de variété pour une collation préparée le dimanche : elle est faite pour plusieurs jours
      const score = res.score * qualityBonus(r) * (r.batch ? 1 : 1 + VARIETY_PENALTY * (weekUse[id] || 0));
      if (!best || score < best.score) best = { id, r, res, score, charc };
    });
    if (!best) continue;
    // au-delà de la tartine obligatoire, on n'ajoute rien qui creuserait l'écart au lieu de le réduire
    if (stepCfg !== plan[0] && best.res.macros.kcal > rem.kcal * 1.8) continue;
    if (stepCfg.small && scale >= 1) continue;
    used.add(best.id);
    charcLeft -= best.charc;
    basesOf(best.r).forEach(k => usedBases.add(k));
    const slot = best.r.category === 'side' ? 'sides' : 'sweet';
    out.push({ slot, item: { id: best.id, servings: 1, overrides: best.res.overrides } });
    rem = subtractMacros(rem, best.res.macros);
  }
  return out;
}

// ── Optimise une journée existante (bouton « Optimiser les portions » du planner) ──
// Assiettes du midi/soir ajustées individuellement, puis collations recalées sur le reste.
export function optimizeEntry(entry, T) {
  const pt = plateTarget(T);
  let used = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const add = m => MACROS.forEach(k => used[k] += m[k]);
  (entry.meals.starter || []).forEach(it => add(computeMealMacros(it)));
  (entry.meals.sides || []).forEach(it => add(computeMealMacros(it)));
  ['lunch', 'dinner'].forEach(slot => {
    (entry.meals[slot] || []).forEach(it => {
      const r = getById(it.id);
      if (!r) return;
      if (!isCantine(r)) {
        // on retire de la cible l'accompagnement déjà associé à ce repas
        const linked = (entry.meals.sides || []).filter(sd => sd.with === slot).map(computeMealMacros);
        const tgt = { ...pt };
        linked.forEach(m => MACROS.forEach(k => tgt[k] = Math.max(0, tgt[k] - m[k])));
        const res = optimizeRecipe(r, tgt, 'P');
        it.overrides = res.overrides; it.servings = 1;
      }
      add(computeMealMacros(it));
    });
  });
  // collations : réparties sur ce qu'il reste
  const sweets = entry.meals.sweet || [];
  let rem = subtractMacros(T, used);
  sweets.forEach((it, i) => {
    const r = getById(it.id);
    if (!r) return;
    const left = sweets.length - i;
    const tgt = {};
    MACROS.forEach(m => tgt[m] = rem[m] / left);
    const res = optimizeRecipe(r, tgt, 'S');
    it.overrides = res.overrides; it.servings = 1;
    rem = subtractMacros(rem, res.macros);
  });
  return entry;
}

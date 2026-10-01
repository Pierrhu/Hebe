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
  plateProteinShare: 0.9, // part des protéines portée par les assiettes (le reste : collation / whey)
  autoSides: true,        // ajouter un accompagnement à l'assiette si ça aide…
  autoSideIds: ['SA01', 'SA11'], // …mais seulement les frites (zéro effort à l'air fryer)
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
export function optimizeRecipe(recipe, target, mode = 'P') {
  const qty = recipe.ingredients.map(i => i.qty);
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
  let mainStarch = recipe.ingredients.findIndex(i => !i.extra && i.key === 'riz');
  if (mainStarch < 0) {
    let bestK = 0;
    recipe.ingredients.forEach((ing, idx) => {
      if (!ing.extra && INGREDIENTS[ing.key]?.minP && ing.kcal > bestK) { bestK = ing.kcal; mainStarch = idx; }
    });
  }
  if (!isCantine(recipe)) {
    recipe.ingredients.forEach((ing, idx) => {
      const db = INGREDIENTS[ing.key];
      if (ing.extra || !db || !db.lv.includes(mode)) return; // tes ajouts gardent leur quantité
      if (mode === 'P' && db.role === 'protein' && idx !== mainProt) return;
      const countable = isCountableUnit(ing.unit);
      // minP : minimum imposé dans les plats (ex. jamais moins de 90 g de riz cru)
      const min = mode === 'P' && db.minP && idx === mainStarch ? db.minP : Math.min(db.min ?? ing.qty, ing.qty);
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
    overrides[i] = isLever ? snapQty(qty[i], isCountableUnit(ing.unit), ing.key) : ing.qty;
  });
  // macros finales (après arrondi)
  const macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  recipe.ingredients.forEach((ing, i) => MACROS.forEach(m => macros[m] += pu[i][m] * overrides[i]));
  return { overrides, macros, score: score(macros, target) };
}

// ── Répartition d'une journée ──
// Une assiette vise ~34 % des kcal du jour, mais jamais plus que ce qu'on peut raisonnablement
// manger (800 kcal, 900 si objectif > 3000). Le reste part en collation(s).
export function plateTarget(T) {
  // Les plats portent l'essentiel de la journée (40 % chacun) : grosses portions de féculents,
  // donc moins de collations à côté.
  const cap = T.kcal > 3000 ? 1350 : 1250;
  const kcal = Math.max(450, Math.min(cap, T.kcal * 0.40));
  const f = kcal / T.kcal;
  return {
    kcal: Math.round(kcal),
    protein: Math.round(T.protein * Math.min(f * OPT.plateProteinShare, 0.45)),
    carbs: Math.round(T.carbs * f),
    // les à-côtés (tartines au carré frais 0 %, collations whey) sont maigres : les plats portent un peu plus de lipides
    fat: Math.round(T.fat * Math.min(f * 1.2, 0.5)),
  };
}

// Calibre une ASSIETTE : le plat seul, ou le plat + un de ses accompagnements air fryer.
// On garde l'option la plus proche de la cible ; l'accompagnement n'est ajouté que s'il aide.
// Renvoie { main: {overrides, macros}, side: {id, overrides, macros} | null, macros }
export function calibratePlate(recipe, target) {
  const alone = optimizeRecipe(recipe, target, 'P');
  let best = { main: alone, side: null, macros: alone.macros, score: alone.score };
  if (!OPT.autoSides) return best;
  // jamais d'accompagnement qui répète un féculent déjà dans le plat (burger + ses frites de patate douce, etc.)
  const mainCarbs = new Set(recipe.ingredients.filter(i => ['carb', 'legume'].includes(INGREDIENTS[i.key]?.role)).map(i => i.key));
  (recipe.pairs || []).filter(sid => OPT.autoSideIds.includes(sid)).forEach(sid => {
    const side = getById(sid);
    if (!side) return;
    if (side.ingredients.some(i => mainCarbs.has(i.key))) return;
    const sm = side.macros;
    const rest = {};
    MACROS.forEach(m => rest[m] = Math.max(0, target[m] - sm[m]));
    const main = optimizeRecipe(recipe, rest, 'P');
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
//        (miel-thym, dinde), puis banane-cacahuète, amandes, fromage blanc, fruit, skyr
//   4. une 2e collation seulement si l'écart reste vraiment important Renvoie [{ slot, item }]
export function fillRemainder(remaining, rotation, fillers = ['S12', 'S11', 'S09', 'S07', 'S08', 'S05', 'S16']) {
  const out = [];
  let rem = { ...remaining };
  const used = new Set();
  const plan = [
    // la 1re tartine passe en premier : elle est là tous les jours (tes compléments prioritaires)
    // (le moteur prend la tartine qui convient le mieux : dinde si la journée manque de protéines, miel sinon)
    { pool: fillers.slice(0, 2),  cap: 300, minRem: 100 },
    // collation : choisie parmi 2 options qui changent chaque jour
    { pool: rotation.slice(0, 2), cap: 650, minRem: 120 },
    // puis la 2e tartine, puis le meilleur de 2 autres compléments
    { pool: fillers.slice(0, 2),  cap: 350, minRem: 150 },
    // si la journée manque de lipides, les compléments gras (amandes, beurre de cacahuète) entrent en lice
    { pool: fillers.slice(2, 4),  cap: 300, minRem: 120, fatty: true },
    // 2e collation seulement si l'écart reste vraiment important
    { pool: rotation.slice(2, 3), cap: 500, minRem: 350 },
  ];
  for (const stepCfg of plan) {
    if (rem.kcal < stepCfg.minRem) continue;
    const share = Math.min(1, stepCfg.cap / rem.kcal);
    const tgt = {};
    MACROS.forEach(m => tgt[m] = rem[m] * share);
    let best = null;
    let pool = stepCfg.pool;
    if (stepCfg.fatty && rem.fat * 9 > rem.kcal * 0.3) pool = [...new Set([...pool, ...fillers.filter(id => ['S07', 'S09', 'S08'].includes(id))])];
    pool.filter(id => !used.has(id)).forEach(id => {
      const r = getById(id);
      if (!r) return;
      const res = optimizeRecipe(r, tgt, 'S');
      if (!best || res.score < best.res.score) best = { id, r, res };
    });
    if (!best) continue;
    used.add(best.id);
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

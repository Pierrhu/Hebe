// cook.js — Onglet « Cuisiner » : je fais quoi pendant ma session ?
// Une checklist unique par session : le plat le plus long (autocuiseur) est lancé d'abord,
// l'autre se prépare pendant la cuisson. Puis les quantités totales et la répartition en boîtes.

import { getEntry, getTodayDate } from '../data/log.js';
import { getById } from '../data/recipes.js';
import { INGREDIENTS, humanQty, NATURAL_UNITS, spicesOf } from '../data/ingredients.js';
const NATURAL_UNITS_KEYS = Object.keys(NATURAL_UNITS);
import { el } from './utils.js';
import { getActivePlan, planMembers, FRESH_ONLY, sessionDate, sessionWhen } from './weekgen.js';
import { isFreshFish } from '../data/recipes.js';
import { getMember } from '../data/household.js';
import { getEquipment } from './adapt.js';
import { toast } from './utils.js';
import { itemQuantities } from './optimizer.js';
import { renderRecipeDetail } from './recipeDetail.js';
import { dishThumb, dishThumbRated } from '../data/photos.js';

// « a, b et c »
const listFr = a => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} et ${a[a.length - 1]}`);

let sessionIdx = null;

// Estime le temps de conservation d'une recette (frigo + éventuellement congélo).
function conservation(r) {
  const tags = r.tags || [];
  const n = r.name.toLowerCase();
  const txt = (r.steps || []).join(' ').toLowerCase();
  // Poisson cru / cuit : courte conservation
  if (/saumon|thon frais|poisson cru|poke|tartare|sashimi/.test(n)) return { fridge: '1 jour', freezer: null };
  if (/poisson|colin|merlu|cabillaud|crevette|saumon/.test(n)) return { fridge: '2 jours', freezer: '1 mois' };
  // Salades crues / crudités : 1-2 jours
  if (tags.includes('salade') || /crudités|salade verte|carpaccio/.test(n)) return { fridge: '1-2 jours', freezer: null };
  // Soupes / veloutés : bien au frigo, congèlent très bien
  if (tags.includes('soupe') || /velouté|soupe|gaspacho/.test(n)) return { fridge: '4-5 jours', freezer: '2 mois' };
  // Desserts laitiers (fromage blanc, skyr…) : 2-3 jours, pas de congélo (sauf glacés)
  if (tags.includes('congelé') || /glac|nice cream|frozen/.test(n)) return { fridge: '—', freezer: '1 mois (congelé)' };
  if (r.category === 'sweet' && /fromage blanc|skyr|yaourt|mousse|tiramisu|cheesecake|pudding/.test(n)) return { fridge: '2-3 jours', freezer: null };
  // Mijotés / plats en sauce / currys : 3-4 jours, congèlent bien
  if (/curry|mijot|tajine|chili|dal|mafé|stroganoff|bolognaise|sauce/.test(n + txt)) return { fridge: '3-4 jours', freezer: '2 mois' };
  // Viandes cuites, bowls, gratins : 3 jours
  if (/poulet|boeuf|steak|porc|gratin|boulettes|bowl/.test(n)) return { fridge: '3 jours', freezer: '1-2 mois' };
  // Féculents / légumineuses cuits : 3-4 jours
  if (/riz|pâtes|quinoa|lentilles|pois chiches|boulghour/.test(n)) return { fridge: '3-4 jours', freezer: '2 mois' };
  // Gâteaux / crumbles / energy balls : plusieurs jours
  if (/crumble|gâteau|brownie|galettes|energy balls|cookie|muffin/.test(n)) return { fridge: '4-5 jours', freezer: '1 mois' };
  // défaut raisonnable
  return { fridge: '3 jours', freezer: null };
}

function fmtQty(q, unit) {
  if (unit === 'pièce') { const n = Math.round(q * 2) / 2; return `${String(n).replace('.', ',')}`; }
  if (q >= 1000 && unit === 'g') return `${String(Math.round(q / 10) / 100).replace('.', ',')} kg`;
  if (q >= 1000 && unit === 'ml') return `${String(Math.round(q / 10) / 100).replace('.', ',')} L`;
  return `${Math.round(q)} ${unit}`;
}
const dishShort = r => r.short || r.name;

// Poids d'une boîte une fois cuite (féculents secs gonflés à la cuisson, œuf ≈ 50 g)
function boxWeight(r, qs) {
  return r.ingredients.reduce((a, g, i) => {
    const db = INGREDIENTS[g.key];
    if (g.unit === 'pièce') return a + qs[i] * 50;
    return a + qs[i] * (db?.cook || 1);
  }, 0);
}

// Quantités totales d'une recette sur les jours d'une session, pour tout le foyer,
// avec le détail par personne (nombre de boîtes et poids moyen d'une boîte)
function totals(recipeId, dates, mids) {
  const r = getById(recipeId);
  const tot = r.ingredients.map(() => 0);
  let portions = 0;
  const per = {};
  mids.forEach(mid => {
    const p = per[mid] = { n: 0, w: 0 };
    dates.forEach(d => {
      const e = getEntry(d, mid);
      Object.values(e.meals).flat().forEach(it => {
        if (it.id !== recipeId) return;
        const qs = itemQuantities(it);
        qs.forEach((q, i) => tot[i] += q);
        portions++;
        p.n++;
        p.w += boxWeight(r, qs);
      });
    });
  });
  return { r, tot, portions, per };
}

// Étapes d'une recette, rangées par rôle grâce à leur début :
//   « Riz : … » → cuit une seule fois pour toute la session
//   « Mise en boîtes : … » → dernière phase · « Au moment de manger : … » → récapitulatif, pas pendant la session
const RICE_RX = /^Riz : /, BOX_RX = /^Mise en boîtes : /, MEAL_RX = /^Au moment de manger : /;
function splitSteps(r) {
  const core = [], box = [], meal = [];
  let rice = false;
  r.steps.forEach(st => {
    if (RICE_RX.test(st)) rice = true;
    else if (BOX_RX.test(st)) box.push(st.replace(BOX_RX, ''));
    else if (MEAL_RX.test(st)) meal.push(st.replace(MEAL_RX, ''));
    else core.push(st);
  });
  return { core, rice, box, meal };
}
const cap = t => t.charAt(0).toUpperCase() + t.slice(1);

// Phases de la session, dans l'ordre réel. Il n'y a qu'un autocuiseur :
//   1. le plat qui cuit sous pression est lancé d'abord ; les plats à la poêle et à l'air fryer se font pendant sa cuisson
//   2. les autres plats à l'autocuiseur suivent, une fois la cuve libre
//   3. le riz de toute la session cuit en une fois (au début s'il n'y a aucun plat à l'autocuiseur)
function buildPhases(list) {
  const recipes = list.map(x => x.r);
  const parts = new Map(recipes.map(r => [r, splitSteps(r)]));
  const P = (title, hint, r, steps) => ({ title, hint, r, idx: r ? recipes.indexOf(r) : -1, steps });
  const usesCooker = r => parts.get(r).core.some(st => /autocuiseur/i.test(st));
  const pressure = r => parts.get(r).core.findIndex(st => /sous pression/i.test(st));
  const cooker = recipes.filter(usesCooker);
  const others = recipes.filter(r => !usesCooker(r));
  // riz de la session
  const riceList = list.filter(x => parts.get(x.r).rice);
  const eq = getEquipment() || { autocuiseur: true };
  // riz complet et/ou riz blanc (réglage « Riz et pâtes ») : le complet d'abord, il est plus long
  const RICE = {
    riz: { name: 'riz complet', ratio: eq.autocuiseur ? 1.7 : 2.5, cook: eq.autocuiseur
      ? "Ferme, laisse cuire 20 minutes sous pression, puis laisse la pression retomber seule pendant 10 minutes avant d'ouvrir."
      : 'Porte à ébullition, couvre, baisse à feu très doux et laisse cuire 35 minutes, puis laisse reposer 10 minutes hors du feu sans ouvrir.' },
    riz_blanc: { name: 'riz blanc', ratio: eq.autocuiseur ? 1.5 : 1.7, cook: eq.autocuiseur
      ? "Ferme, laisse cuire 5 minutes sous pression, puis laisse la pression retomber seule pendant 10 minutes avant d'ouvrir."
      : 'Porte à ébullition, couvre, baisse à feu très doux et laisse cuire 12 minutes, puis laisse reposer 5 minutes hors du feu sans ouvrir.' },
  };
  const riceOf = (x, k) => x.r.ingredients.reduce((s, g, i) => s + (g.key === k ? x.tot[i] : 0), 0);
  const batches = Object.keys(RICE).map(k => {
    const g = Math.round(riceList.reduce((a, x) => a + riceOf(x, k), 0) / 5) * 5;
    return { k, g, water: Math.round(g * RICE[k].ratio / 10) * 10, dishes: riceList.filter(x => riceOf(x, k) > 0) };
  }).filter(b => b.g > 0);
  const where = eq.autocuiseur ? "l'autocuiseur" : 'une grande casserole';
  const ricePhase = batches.length === 1 ? [
    `Rince ${batches[0].g} g de ${RICE[batches[0].k].name} à l'eau froide, puis mets-le dans ${where} avec ${batches[0].water} ml d'eau.`,
    RICE[batches[0].k].cook,
    `Ce riz accompagne : ${listFr(batches[0].dishes.map(x => dishShort(x.r)))}. Égrène-le à la fourchette avant de le répartir.`]
  : batches.length === 2 ? [
    `Commence par le riz complet, plus long à cuire : rince ${batches[0].g} g de riz complet à l'eau froide, puis mets-le dans ${where} avec ${batches[0].water} ml d'eau.`,
    RICE.riz.cook,
    eq.autocuiseur ? `Verse le riz complet dans un grand plat, puis rince ${batches[1].g} g de riz blanc et mets-le dans l'autocuiseur avec ${batches[1].water} ml d'eau.`
      : `Pendant ce temps, rince ${batches[1].g} g de riz blanc et mets-le dans une deuxième casserole avec ${batches[1].water} ml d'eau.`,
    RICE.riz_blanc.cook,
    `Le riz complet accompagne : ${listFr(batches[0].dishes.map(x => dishShort(x.r)))}. Le riz blanc accompagne : ${listFr(batches[1].dishes.map(x => dishShort(x.r)))}. Égrène-les à la fourchette avant de les répartir.`]
  : null;

  const out = [];
  const first = cooker.filter(r => pressure(r) >= 0).sort((a, b) => b.cookTime - a.cookTime)[0];
  if (first) {
    const core = parts.get(first).core, cut = pressure(first);
    const solo = recipes.length === 1 && !ricePhase;
    out.push(P(solo ? `Cuisiner : ${dishShort(first)}` : `Lancer : ${dishShort(first)}`, solo ? '' : 'Il cuit tout seul pendant la suite', first, solo ? core : core.slice(0, cut + 1)));
    others.forEach(r => out.push(P(`Pendant la cuisson : ${dishShort(r)}`, '', r, parts.get(r).core)));
    if (!solo && cut + 1 < core.length) out.push(P(`Terminer : ${dishShort(first)}`, '', first, core.slice(cut + 1)));
    cooker.filter(r => r !== first).forEach(r => out.push(P(`Cuisiner : ${dishShort(r)}`, "L'autocuiseur est de nouveau libre", r, parts.get(r).core)));
    if (ricePhase) out.push(P('Cuire le riz', eq.autocuiseur ? 'Pendant les 10 minutes de repos, commence la mise en boîtes' : 'Il cuit tout seul pendant que tu commences la mise en boîtes', null, ricePhase));
  } else {
    cooker.forEach(r => out.push(P(`Préparer : ${dishShort(r)}`, '', r, parts.get(r).core)));
    if (ricePhase) out.push(P('Lancer le riz', 'Il cuit tout seul pendant la suite', null, ricePhase));
    others.forEach(r => out.push(P(`${ricePhase ? 'Pendant la cuisson' : 'Préparer'} : ${dishShort(r)}`, '', r, parts.get(r).core)));
  }
  return { phases: out, boxes: recipes.map(r => ({ r, steps: parts.get(r).box })), meals: recipes.map(r => ({ r, steps: parts.get(r).meal })).filter(x => x.steps.length) };
}

// ── v195 : quantités de l'étape et minuteurs ──
// Ingrédients cités dans une étape : on affiche leur quantité totale pour la session.
const STEP_RX = {
  poulet: /poulet/, haut_cuisse: /poulet|cuisse/, poulet_hache: /poulet/, boeuf: /b(œ|oe)uf|steak|kefta|köfte|boulettes|viande/, boeuf_emince: /b(œ|oe)uf/,
  tomates_conc: /tomates concassées|les tomates/, tomate: /tomates?(?! (concassées|cerise|séchées))/, tomates_cerise: /tomates cerise/,
  lait_coco: /lait de coco/, lait: /\blait(?! de coco)/, yaourt_grec: /yaourt/, fromage_blanc: /fromage blanc/, creme: /crème/,
  pdt: /pommes? de terre|grenailles|frites|purée/, patate_douce: /patates? douces?/, oignon: /oignon/, poivron: /poivron/, courgette: /courgette/,
  carotte: /carotte/, aubergine: /aubergine/, champignons: /champignon/, epinards: /épinard/, concombre: /concombre/,
  riz: /\briz\b/, riz_blanc: /\briz\b/, pates: /pâtes|penne/, pates_classiques: /pâtes|penne/, boulghour: /boulgour/, quinoa: /quinoa/, semoule: /semoule/,
  lentilles_corail: /lentilles/, lentilles_vertes: /lentilles/, pois_chiches: /pois chiches/, haricots_rouges: /haricots rouges/, haricots_blancs: /haricots blancs/,
  mais: /maïs/, crevettes: /crevettes/, saumon: /saumon/, poisson_blanc: /poisson|colin|merlu/, tofu: /tofu/, oeuf: /(?<!b)(œ|oe)ufs?\b/,
  feta: /feta/, cheddar: /cheddar|fromage/, emmental: /emmental|fromage/, mozzarella: /mozzarella/, parmesan: /parmesan/, cottage: /cottage/,
  tortilla: /tortilla|wrap|galette/, pita: /pita/, gnocchis: /gnocchi/, nouilles_oeufs: /nouilles/, nouilles_riz: /nouilles/, farine: /farine/,
  concentre: /concentré/, gingembre: /gingembre(?! en poudre)/, citron: /citron(?! vert)/, citron_vert: /citron vert/, herbes: /persil|coriandre|basilic|herbes(?! de provence)|aneth|ciboulette|menthe|thym/,
  chou_fleur: /chou-fleur/, petits_pois: /petits pois/, haricots_verts: /haricots verts/, olives: /olives/,
  salade: /salade|crudités/, avocat: /avocat/, pain_burger: /pains?\b|burger/, baguette: /baguette|pain/, pain: /pain|tartine/, brocoli: /brocoli/,
  thon: /thon/, feuille_riz: /feuilles? de riz|galette/, tomates_sechees: /tomates séchées/, cornflakes: /corn-?flakes/, houmous: /houmous/,
  cornichons: /cornichon/, chou_chinois: /chou/, radis: /radis/, pousses_soja: /pousses/, mangue: /mangue/, fruits_rouges: /fruits rouges/,
};
// v195 : ingrédients qui ne servent qu'au moment du repas (œuf au plat, galettes, fromage à faire fondre…) :
// pas cuisinés pendant la session, mais à garder pour le jour J
function mealOnlyKeys(r) {
  const MEAL = /^(Au moment de manger : |Le matin)/;
  const sess = r.steps.filter(st => !MEAL.test(st)).join(' ').toLowerCase();
  const meal = r.steps.filter(st => MEAL.test(st)).join(' ').toLowerCase();
  if (!meal) return new Set();
  return new Set(r.ingredients.filter(g => { const rx = STEP_RX[g.key]; return rx && !INGREDIENTS[g.key]?.pantry && !rx.test(sess) && rx.test(meal); }).map(g => g.key));
}
function stepQty(text, x) {
  if (!x || !x.tot) return '';
  const t = text.toLowerCase();
  const seen = new Set();
  const chips = [];
  x.r.ingredients.forEach((g, i) => {
    const rx = STEP_RX[g.key];
    const db = INGREDIENTS[g.key];
    if (!rx || !db || db.pantry || seen.has(g.key) || !(x.tot[i] > 0) || !rx.test(t)) return;
    seen.add(g.key);
    chips.push(`<span class="ck-qty-chip"><b>${humanQty(g.key, x.tot[i], g.unit)}</b> ${g.name.split(' (')[0].toLowerCase()}</span>`);
  });
  return chips.length ? `<div class="ck-qty">${chips.join('')}</div>` : '';
}
// Durée d'une étape (« 18 à 20 minutes » → 20). Pas de minuteur sous 3 minutes.
function stepMinutes(text) {
  let best = 0;
  text.replace(/(\d+)(?:\s*à\s*(\d+))?\s*(?:minutes|min)\b/g, (_, a, b) => { best = Math.max(best, +(b || a)); return _; });
  return best >= 3 ? best : 0;
}
const TIMERS_KEY = 'hebe_timers';
const getTimers = () => { try { return JSON.parse(localStorage.getItem(TIMERS_KEY) || '[]'); } catch { return []; } };
const saveTimers = a => { try { localStorage.setItem(TIMERS_KEY, JSON.stringify(a)); } catch {} };
const ICON_TM_CLOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9.5 2.5h5"/></svg>';
const ICON_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg>';
function startTimer(label, minutes, step) {
  const list = getTimers().filter(t => t.end > Date.now() && t.step !== step);
  list.push({ id: Date.now(), label, step, total: minutes * 60000, end: Date.now() + minutes * 60000 });
  saveTimers(list);
  try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch {}
}
function ringAlarm(label) {
  try { navigator.vibrate?.([300, 150, 300, 150, 600]); } catch {}
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.35, 0.7].forEach(t0 => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 880; o.connect(g); g.connect(ac.destination); g.gain.setValueAtTime(0.25, ac.currentTime + t0); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + t0 + 0.3); o.start(ac.currentTime + t0); o.stop(ac.currentTime + t0 + 0.32); });
  } catch {}
  try { if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') new Notification('Hébé', { body: `${label} : c'est prêt !`, icon: 'icon-192.png' }); } catch {}
  toast(`${label} : c'est prêt !`);
}
const fmtLeft = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
// anneau de progression (le temps qui reste)
const tmRing = (t, now, size) => {
  const r = size / 2 - 3, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, (t.end - now) / (t.total || 1)));
  return `<svg class="tm-ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="tm-ring-bg"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="tm-ring-fg" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - f)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
};
// Minuteur dans l'étape en cours (data-tm-step) ; ailleurs, une petite bulle au-dessus du menu
let timerTick = null;
function drawTimers() {
  const now = Date.now();
  let list = getTimers();
  list.filter(t => t.end <= now && !t.rang).forEach(t => { t.rang = true; ringAlarm(t.label); });
  list = list.filter(t => t.end > now - 10000); // un minuteur fini reste affiché 10 secondes
  saveTimers(list);
  // dans l'étape
  document.querySelectorAll('[data-tm-step]').forEach(box => {
    const t = list.find(x => String(x.step) === box.dataset.tmStep);
    box.classList.toggle('running', !!t);
    box.classList.toggle('over', !!t && t.end <= now);
    const live = box.querySelector('.tm-live');
    if (t && live) { live.querySelector('.tm-ring-wrap').innerHTML = tmRing(t, now, 44); live.querySelector('.tm-left').textContent = t.end <= now ? 'Prêt !' : fmtLeft(t.end - now); }
  });
  const inline = new Set([...document.querySelectorAll('[data-tm-step].running')].map(b => b.dataset.tmStep));
  const float = list.filter(t => !inline.has(String(t.step)));
  let bar = document.getElementById('ck-timers');
  if (!float.length) bar?.remove();
  else {
    if (!bar) { bar = document.createElement('div'); bar.id = 'ck-timers'; document.body.appendChild(bar); }
    bar.innerHTML = float.map(t => `<div class="tm-pill ${t.end <= now ? 'over' : ''}">${tmRing(t, now, 28)}<span class="tm-pill-l">${t.label}</span><b>${t.end <= now ? 'Prêt !' : fmtLeft(t.end - now)}</b><button class="tm-x" data-tstop="${t.id}" aria-label="Arrêter le minuteur ${t.label}">${ICON_X}</button></div>`).join('');
    bar.querySelectorAll('[data-tstop]').forEach(b => b.addEventListener('click', () => { saveTimers(getTimers().filter(t => t.id !== +b.dataset.tstop)); drawTimers(); }));
  }
  if (list.length && !timerTick) timerTick = setInterval(drawTimers, 1000);
  if (!list.length && timerTick) { clearInterval(timerTick); timerTick = null; }
}
setTimeout(drawTimers, 0);

export function renderCook() {
  const app = document.getElementById('app');
  app.querySelector('.view')?.remove();
  const view = el('div', 'view hb-cook');
  const plan = getActivePlan();

  if (!plan) {
    view.innerHTML = `
      <div class="hb-page-title">Cuisiner</div>
      <div class="hb-card hb-empty">
        <div class="hb-h3">Aucune session prévue</div>
        <p class="hb-p">Génère ta semaine : les étapes de ta session de cuisine apparaîtront ici.</p>
        <button class="hb-btn hb-btn-primary" data-go="week">Préparer ma semaine</button>
      </div>`;
    app.insertBefore(view, app.querySelector('#nav'));
    view.querySelector('[data-go]').addEventListener('click', () => window._nav?.('week'));
    return;
  }

  const today = getTodayDate();
  if (sessionIdx == null || sessionIdx >= plan.sessions.length) {
    // session à venir : la première dont les jours ne sont pas encore passés
    sessionIdx = Math.max(0, plan.sessions.findIndex(s => s.dates[s.dates.length - 1] >= today));
  }
  const S = plan.sessions[sessionIdx];
  const mids = planMembers(plan);
  const list = S.recipes.map(x => totals(x.id, S.dates, mids)).filter(x => x.portions);
  const recipes = list.map(x => x.r);
  const plan2 = recipes.length ? buildPhases(list) : { phases: [], boxes: [], meals: [] };
  const phases = plan2.phases;

  // Petits-déjeuners, collations et compléments des jours de la session
  const extraIds = [...new Set(mids.flatMap(mid => S.dates.flatMap(d => {
    const e = getEntry(d, mid);
    return [...(e.meals.breakfast || []), ...(e.meals.sweet || []), ...(e.meals.sides || []).filter(sd => !sd.with)].map(it => it.id);
  })))];
  const extras = extraIds.map(id => totals(id, S.dates, mids)).filter(x => x.r && x.portions);
  const isLater = st => /^(Le matin|Au moment de manger)/.test(st);
  // tout ce qui suit la première étape « Le matin » ou « Au moment de manger » se fait plus tard
  const cutAt = r => { const k = r.steps.findIndex(isLater); return k < 0 ? r.steps.length : k; };
  const kindOf = r => (r.category === 'breakfast' ? 'petit-déjeuner' : 'collation');
  const de = n => (/^[aeiouyhéèêâîôûœ]/i.test(n) ? `d'${n}` : `de ${n}`);
  const qtyLine = x => `Pour ${x.portions} ${x.portions > 1 ? 'portions' : 'portion'} : ${x.r.ingredients.map((g, i) => `${humanQty(g.key, x.tot[i], g.unit)} ${g.unit === 'pièce' ? g.name.toLowerCase() : de(g.name.toLowerCase())}`).join(', ')}.`;
  // à préparer pendant la session : de vraies phases, avec les quantités totales
  extras.filter(x => x.r.batch).forEach(x => {
    const steps = x.r.steps.slice(0, cutAt(x.r)).map(st => st.replace(/^Pendant la session de cuisine, /, '').replace(/^./, c => c.toUpperCase()));
    phases.push({ title: `Préparer : ${dishShort(x.r)}`, hint: `${cap(kindOf(x.r))} à préparer maintenant`, r: x.r, idx: -2, steps: [qtyLine(x), ...steps] });
  });
  // à faire au moment : ce qu'il reste à faire, sans cuisson d'avance
  const later = extras.map(x => {
    const steps = x.r.batch ? x.r.steps.slice(cutAt(x.r)) : x.r.steps;
    return steps.length ? { x, text: steps.join(' ').replace(/^Le matin, /, '').replace(/^Au moment de manger : /, '') } : null;
  }).filter(Boolean);
  const fries = [...new Set(S.recipes.map(x => x.side).filter(Boolean))].map(getById).filter(Boolean);
  const minutes = Math.round((recipes.reduce((a, r) => a + r.prepTime, 0) + extras.filter(x => x.r.batch).reduce((a, x) => a + x.r.prepTime, 0) + Math.max(0, ...recipes.map(r => r.cookTime)) + 10) / 5) * 5;
  const boxes = list.reduce((a, x) => a + x.portions, 0);
  // v195 : collations et petits-déjeuners préparés pendant la session, montrés en haut avec les plats
  const batchExtras = extras.filter(x => x.r.batch);
  const kindLbl = r => (r.category === 'breakfast' ? 'Petit-déj' : 'Collation');

  // collations à préparer à l'avance (cookies, overnight oats…) : rattachées à la 1re session
  const prepSnacks = sessionIdx === 0 ? [...new Set(mids.flatMap(mid => plan.dates.flatMap(d => (getEntry(d, mid).meals.sweet || []).map(it => it.id))))]
    .map(getById).filter(r => r && r.batch) : [];

  const doneKey = `hebe_cook_${plan.generatedAt}_${S.key}`;
  let done = JSON.parse(localStorage.getItem(doneKey) || '[]');

  // numérotation continue des étapes cochables
  let n = 0;
  const phaseSteps = phases.map(ph => ph.steps.map(text => ({ text, i: n++ })));
  const boxIdx = n++;
  // Rangement de chaque plat : frigo pour lundi à mercredi, congélateur au-delà (avec le jour prévu)
  const DAYN = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  const MEALN = { lunch: 'midi', dinner: 'soir' };
  const FRESH = { tomate: 'la tomate', concombre: 'le concombre', salade: 'la salade', avocat: "l'avocat", herbes: 'les herbes', yaourt_grec: 'le yaourt' };
  const andList = a => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} et ${a[a.length - 1]}`);
  const storage = r => {
    const uses = [];
    mids.forEach(mid => S.dates.forEach((d, k) => ['lunch', 'dinner'].forEach(meal => (getEntry(d, mid).meals[meal] || []).forEach(it => {
      if (it.id === r.id) uses.push({ k, meal, frozen: !!it.frozen });
    }))));
    const group = list => {
      const by = {};
      list.forEach(u => { const key = `${DAYN[u.k]} ${MEALN[u.meal]}`; by[key] = (by[key] || 0) + 1; });
      return andList(Object.entries(by).map(([key, c]) => (c > 1 ? `${key} (${c} boîtes)` : key)));
    };
    const fr = uses.filter(u => !u.frozen), fz = uses.filter(u => u.frozen);
    const parts = [];
    if (fr.length) parts.push(`au frigo, ${fr.length} ${fr.length > 1 ? 'boîtes' : 'boîte'} pour ${group(fr)}`);
    if (fz.length) parts.push(`au congélateur, ${fz.length} ${fz.length > 1 ? 'boîtes' : 'boîte'} pour ${group(fz)}`);
    let txt = `${parts.join(' ; ')}.`;
    const fresh = fz.length ? [...new Set(r.ingredients.filter(g => FRESH[g.key]).map(g => FRESH[g.key]))] : [];
    if (fresh.length) txt += ` Pour les boîtes congelées, garde à part ${andList(fresh)} : ${fresh.length > 1 ? 'ils ne se congèlent pas' : 'cela ne se congèle pas'}, prépare-les le jour même.`;
    return txt;
  };
  // ce qui ne se cuisine pas aujourd'hui (œufs au plat, galettes…) : on le dit clairement au moment de ranger
  const keptLine = r => {
    const later = mealOnlyKeys(r); if (!later.size) return '';
    const x = list.find(y => y.r === r); if (!x) return '';
    const items = r.ingredients.map((g, i) => later.has(g.key) && x.tot[i] > 0 ? `${humanQty(g.key, x.tot[i], g.unit)} ${g.unit === 'pièce' ? g.name.toLowerCase() : de(g.name.split(' (')[0].toLowerCase())}` : '').filter(Boolean);
    return items.length ? ` À garder pour le jour du repas, sans les cuisiner aujourd'hui : ${andList(items)} (la fiche de la recette dit quoi faire ce jour-là).` : '';
  };
  const boxSteps = plan2.boxes.map(b => ({ r: b.r, text: `${dishShort(b.r)} : ${storage(b.r)}${b.steps.length ? ` Dans les boîtes : ${b.steps.join(' ')}` : ''}${keptLine(b.r)}`, i: n++ }));
  const hasFrozen = list.some(x => mids.some(mid => S.dates.some(d => ['lunch', 'dinner'].some(meal => (getEntry(d, mid).meals[meal] || []).some(it => it.id === x.r.id && it.frozen)))));
  // à manger en premier : poisson et plats qui ne se congèlent pas
  const firstEat = list.filter(x => isFreshFish(x.r) || FRESH_ONLY.includes(x.r.id)).map(x => dishShort(x.r));
  const total = n;
  const doneCount = done.filter(i => i < total).length;
  const current = [...Array(total).keys()].find(i => !done.includes(i));
  const stepBtn = (text, i, dish = '') => {
    return `
    <div class="ck-step ${done.includes(i) ? 'done' : ''} ${i === current ? 'current' : ''}" data-i="${i}" role="button" tabindex="0">
      <span class="ck-box" aria-hidden="true">${done.includes(i) ? '✓' : ''}</span>
      <span class="ck-text">${i === current ? '<span class="ck-now">Maintenant</span>' : ''}${text}
      </span>
    </div>`;
  };

  // Une étape à la fois : la phase en cours en grand, les autres repliées
  const endText = `Prépare ${andList(list.map(x => `${x.portions} ${x.portions > 1 ? 'boîtes' : 'boîte'} de ${dishShort(x.r)}`))}, et écris sur chaque boîte le jour où elle sera mangée.${hasFrozen ? " Les boîtes à congeler vont au congélateur aujourd'hui même, une fois tièdes : la veille du jour prévu, l'onglet Semaine te rappelle de les sortir et de les mettre au frigo." : ''}`;
  const allPhases = [
    ...phases.map((ph, k) => ({ num: k + 2, title: ph.title, hint: ph.hint, r: ph.r, cls: ph.idx === -2 ? `ck-phase-extra dish-${list.length + batchExtras.findIndex(x => x.r === ph.r)}` : ph.r ? `dish-${ph.idx}` : 'ck-phase-rice', steps: phaseSteps[k] })),
    { num: phases.length + 2, title: 'Mettre en boîtes', hint: 'Laisse tiédir 20 minutes au plus, ferme les boîtes et range-les au frigo', r: null, cls: 'ck-phase-end', steps: [{ text: endText, i: boxIdx }, ...boxSteps] },
  ];
  const phaseHTML = P => {
    const ids = P.steps.map(st => st.i);
    if (ids.every(i => done.includes(i))) return `<button class="ck-row done" data-reopen="${ids[ids.length - 1]}"><span>${P.num} · ${P.title}</span><span class="ck-row-ok">✓ fait</span></button>`;
    const cur = P.steps.find(st => st.i === current);
    if (!cur) return `<div class="ck-row"><span>${P.num} · ${P.title}</span><span class="ck-row-n">${ids.length} étape${ids.length > 1 ? 's' : ''}</span></div>`;
    return `<div class="ck-cur ${P.cls}" id="ck-current">
      <div class="ck-phase-hd"><span class="ck-phase-num">${P.num}</span>${P.r ? dishThumb(P.r, 'phase') : ''}<div class="ck-phase-txt"><div class="ck-phase-title">${P.title}</div>${P.hint ? `<div class="ck-phase-hint">${P.hint}</div>` : ''}</div></div>
      <div class="ck-cur-step"><div class="ck-cur-k">Étape ${P.steps.indexOf(cur) + 1} sur ${ids.length}</div>${cur.text}
        ${P.r && !P.cls.includes('ck-phase-extra') ? stepQty(cur.text, list.find(x => x.r === P.r) || extras.find(x => x.r === P.r)) : ''}
        ${stepMinutes(cur.text) ? `<div class="tm-box" data-tm-step="${cur.i}">
          <button class="tm-start" data-timer="${stepMinutes(cur.text)}" data-tstep="${cur.i}" data-tlabel="${P.r ? dishShort(P.r) : 'Riz'}">${ICON_TM_CLOCK}<span>Lancer le minuteur</span><b>${stepMinutes(cur.text)} min</b></button>
          <div class="tm-live"><span class="tm-ring-wrap"></span><div class="tm-txt"><span class="tm-left"></span><small>Minuteur · ${P.r ? dishShort(P.r) : 'Riz'}</small></div><button class="tm-x" data-tstop-step="${cur.i}" aria-label="Arrêter le minuteur">${ICON_X}</button></div>
        </div>` : ''}
      </div>
      <div class="ck-cur-nav"><button class="ck-prev" ${doneCount ? '' : 'disabled'}>Retour</button><button class="ck-next">${current === total - 1 ? 'Terminer' : 'Étape suivante'}</button></div>
    </div>`;
  };

  view.innerHTML = `
    <div class="hb-page-title">Cuisiner</div>
    ${plan.sessions.length > 1 ? `<div class="hb-seg">${plan.sessions.map((s, i) =>
      `<button class="hb-seg-btn ${i === sessionIdx ? 'on' : ''}" data-s="${i}">${s.label}</button>`).join('')}</div>` : ''}

    <div class="ck-summary">
      ${sessionDate(plan) >= getTodayDate() ? `<div class="ck-when">Session ${sessionWhen(plan) === "aujourd'hui" || sessionWhen(plan) === 'demain' ? sessionWhen(plan) : 'du ' + sessionWhen(plan)}</div>` : ''}
      <div class="ck-sum-sub">≈ ${minutes} min · ${boxes} boîtes · pour toute la semaine</div>
      ${firstEat.length ? `<div class="ck-first">À manger en premier : ${firstEat.join(' et ')}, dans les premiers jours de la semaine.</div>` : ''}
      <div class="ck-progress"><div class="tm-bar"><i style="width:${total ? doneCount / total * 100 : 0}%"></i></div><span>${doneCount}/${total} étapes</span></div>
    </div>

    <div class="ck-phase ck-prep">
      <div class="ck-phase-hd"><span class="ck-phase-num">1</span><div><div class="ck-phase-title">Sortir les ingrédients</div><div class="ck-phase-hint">Touche une recette pour voir ses quantités</div></div></div>
      ${sessionIdx > 0 && list.some(x => x.r.ingredients.some(g => INGREDIENTS[g.key]?.snap)) ? `<div class="ck-note ck-note-safe">Viandes et poissons achetés en début de semaine : vérifie leur date limite. Si elle tombe avant aujourd'hui, ils auraient dû être congelés le jour des courses ; dans ce cas, fais-les décongeler la veille au frigo, jamais à température ambiante.</div>` : ''}
      <div class="ck-menu">
        ${[...list, ...batchExtras].map((x, k) => `<div class="ck-card dish-${k}">
          <button class="ck-card-hd" data-card aria-expanded="false">
            <span class="ck-menu-top">${dishThumbRated(x.r, 'menu')}<span class="ck-menu-n">${x.portions} ${x.portions > 1 ? 'portions' : 'portion'}</span></span>
            <span class="ck-menu-name">${dishShort(x.r)}</span>
          </button>
          ${(() => {
            const later = mealOnlyKeys(x.r);
            const row = (g, i) => `<div class="ck-ing"><span>${g.name}${g.key === 'epices' && spicesOf(x.r.id) ? `<small>${spicesOf(x.r.id)}</small>` : ''}</span><span>${humanQty(g.key, x.tot[i], g.unit)}</span></div>`;
            const now = x.r.ingredients.map((g, i) => x.tot[i] > 0 && !later.has(g.key) ? row(g, i) : '').join('');
            const kept = x.r.ingredients.map((g, i) => x.tot[i] > 0 && later.has(g.key) ? row(g, i) : '').join('');
            const mealTxt = x.r.steps.filter(st => /^Au moment de manger : /.test(st)).map(st => cap(st.replace(/^Au moment de manger : /, ''))).join(' ');
            return `<div class="ck-card-ings">${now}${kept ? `<div class="ck-later"><div class="ck-later-h">À garder pour le jour du repas</div>${kept}<p>${mealTxt}</p></div>` : ''}</div>`;
          })()}
          <button class="ck-menu-link" data-rid="${x.r.id}">Voir la recette</button>
        </div>`).join('')}
      </div>
    </div>

    ${allPhases.map(phaseHTML).join('')}
    ${current === undefined ? `<div class="ck-cur ck-finished"><div class="ck-phase-title">Session terminée</div><p>Tous les plats sont en boîtes. Bon appétit cette semaine !</p><button class="ck-restart">Recommencer la session</button></div>` : ''}

    <div class="ck-phase ck-store">
      <div class="ck-phase-hd"><div><div class="ck-phase-title">Rangement</div><div class="ck-phase-hint">Combien de temps se garde chaque plat</div></div></div>
      ${mids.length > 1 ? `<div class="ck-split">${list.map((x, k) => `<div class="ck-split-dish dish-${k}">
        <div class="ck-split-name">${dishThumb(x.r, 'mini')}${dishShort(x.r)}</div>
        ${mids.filter(mid => x.per[mid]?.n).map(mid => `<div class="ck-split-row"><span>${getMember(mid)?.name || 'Sans prénom'}</span><span>${x.per[mid].n} ${x.per[mid].n > 1 ? 'boîtes' : 'boîte'} d'environ ${Math.round(x.per[mid].w / x.per[mid].n / 10) * 10} g</span></div>`).join('')}
      </div>`).join('')}</div>` : ''}
      <div class="ck-cons-list">${list.map(x => { const c = conservation(x.r); return `<div class="ck-cons-row"><span>${dishShort(x.r)}</span><span>frigo ${c.fridge}${c.freezer ? ` · congélo ${c.freezer}` : ''}</span></div>`; }).join('')}</div>
    </div>

    <!-- v195 : la page ne montre que la session de cuisine ; ce qui se fait au moment du repas est dans la Semaine et sur les fiches -->
  `;
  app.insertBefore(view, app.querySelector('#nav'));

  view.querySelectorAll('.hb-seg-btn').forEach(b => b.addEventListener('click', () => { sessionIdx = +b.dataset.s; renderCook(); }));
  const save = () => { localStorage.setItem(doneKey, JSON.stringify(done)); renderCook(); document.getElementById('ck-current')?.scrollIntoView({ block: 'center' }); };
  view.querySelector('.ck-next')?.addEventListener('click', () => { if (current !== undefined) { done = [...done, current]; save(); } });
  view.querySelector('.ck-prev')?.addEventListener('click', () => {
    const prev = Math.max(...done.filter(i => current === undefined || i < current), -1);
    if (prev >= 0) { done = done.filter(i => i !== prev); save(); }
  });
  view.querySelectorAll('[data-reopen]').forEach(b => b.addEventListener('click', () => { done = done.filter(i => i !== +b.dataset.reopen); save(); }));
  view.querySelector('.ck-restart')?.addEventListener('click', () => { done = []; save(); });
  view.querySelectorAll('[data-timer]').forEach(b => b.addEventListener('click', () => { startTimer(b.dataset.tlabel, +b.dataset.timer, +b.dataset.tstep); drawTimers(); }));
  view.querySelectorAll('[data-tstop-step]').forEach(b => b.addEventListener('click', () => { saveTimers(getTimers().filter(t => t.step !== +b.dataset.tstopStep)); drawTimers(); }));
  drawTimers();
  // fiche d'une recette : ouvre ou ferme sa liste d'ingrédients (pleine largeur quand elle est ouverte)
  view.querySelectorAll('[data-card]').forEach(b => b.addEventListener('click', () => {
    const card = b.closest('.ck-card'), open = !card.classList.contains('open');
    card.classList.toggle('open', open); b.setAttribute('aria-expanded', open);
  }));
  view.querySelectorAll('[data-rid]').forEach(b => b.addEventListener('click', e => {
    e.preventDefault();
    renderRecipeDetail(getById(b.dataset.rid), 'cook');
  }));
}

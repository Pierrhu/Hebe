// cook.js — Onglet « Cuisiner » : je fais quoi pendant ma session ?
// Une checklist unique par session : le plat le plus long (autocuiseur) est lancé d'abord,
// l'autre se prépare pendant la cuisson. Puis les quantités totales et la répartition en boîtes.

import { getEntry, getTodayDate } from '../data/log.js';
import { getById } from '../data/recipes.js';
import { INGREDIENTS, humanQty } from '../data/ingredients.js';
import { el } from './utils.js';
import { getActivePlan } from './weekgen.js';
import { toast } from './utils.js';
import { itemQuantities } from './optimizer.js';
import { renderRecipeDetail } from './recipeDetail.js';
import { dishThumb, dishThumbRated } from '../data/photos.js';

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
  if (/poulet|boeuf|dinde|steak|porc|gratin|boulettes|bowl/.test(n)) return { fridge: '3 jours', freezer: '1-2 mois' };
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

// Quantités totales d'une recette sur les jours d'une session
function totals(recipeId, dates) {
  const r = getById(recipeId);
  const tot = r.ingredients.map(() => 0);
  let portions = 0;
  dates.forEach(d => {
    const e = getEntry(d);
    Object.values(e.meals).flat().forEach(it => {
      if (it.id !== recipeId) return;
      itemQuantities(it).forEach((q, i) => tot[i] += q);
      portions++;
    });
  });
  return { r, tot, portions };
}

// Phases de la session, dans l'ordre réel :
// le plat 100 % autocuiseur est lancé d'abord, l'autre se prépare pendant la cuisson, puis on termine.
function buildPhases(recipes) {
  const rank = r => {
    const t = r.tags || [];
    if (t.includes('autocuiseur') && !t.includes('air fryer') && !t.includes('poêle')) return 0;
    if (t.includes('autocuiseur')) return 1;
    return 2;
  };
  const sorted = [...recipes].sort((a, b) => (rank(a) - rank(b)) || (b.cookTime - a.cookTime));
  const P = (title, hint, r, steps) => ({ title, hint, r, idx: recipes.indexOf(r), steps });
  if (sorted.length < 2) return sorted.map(r => P(`Cuisiner : ${dishShort(r)}`, '', r, r.steps));
  const [first, ...others] = sorted;
  const cut = first.steps.findIndex(st => /pression|mijoter|AF \d|air fryer|four/i.test(st));
  if (cut === -1) return sorted.map(r => P(`Préparer : ${dishShort(r)}`, '', r, r.steps));
  const out = [P(`Lancer : ${dishShort(first)}`, 'Il cuit tout seul pendant la suite', first, first.steps.slice(0, cut + 1))];
  others.forEach(r => out.push(P(`Pendant la cuisson : ${dishShort(r)}`, '', r, r.steps)));
  if (cut + 1 < first.steps.length) out.push(P(`Terminer : ${dishShort(first)}`, '', first, first.steps.slice(cut + 1)));
  return out;
}

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
        <p class="hb-p">Génère ta semaine : les étapes de tes sessions de batch apparaîtront ici.</p>
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
  const list = S.recipes.map(x => totals(x.id, S.dates)).filter(x => x.portions);
  const recipes = list.map(x => x.r);
  const phases = recipes.length ? buildPhases(recipes) : [];
  const fries = [...new Set(S.recipes.map(x => x.side).filter(Boolean))].map(getById).filter(Boolean);
  const minutes = Math.round((recipes.reduce((a, r) => a + r.prepTime, 0) + Math.max(0, ...recipes.map(r => r.cookTime)) + 10) / 5) * 5;
  const boxes = list.reduce((a, x) => a + x.portions, 0);

  // collations à préparer à l'avance (cookies, overnight oats…) : rattachées à la 1re session
  const prepSnacks = sessionIdx === 0 ? [...new Set(plan.dates.flatMap(d => (getEntry(d).meals.sweet || []).map(it => it.id)))]
    .map(getById).filter(r => r && r.batch) : [];

  const doneKey = `hebe_cook_${plan.generatedAt}_${S.key}`;
  let done = JSON.parse(localStorage.getItem(doneKey) || '[]');

  // numérotation continue des étapes cochables
  let n = 0;
  const phaseSteps = phases.map(ph => ph.steps.map(text => ({ text, i: n++ })));
  const boxIdx = n++;
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

  view.innerHTML = `
    <div class="hb-page-title">Cuisiner</div>
    ${plan.sessions.length > 1 ? `<div class="hb-seg">${plan.sessions.map((s, i) =>
      `<button class="hb-seg-btn ${i === sessionIdx ? 'on' : ''}" data-s="${i}">${s.label}</button>`).join('')}</div>` : ''}

    <div class="ck-summary">
      <div class="ck-sum-main">${recipes.map(dishShort).join(' + ')}</div>
      <div class="ck-sum-sub">≈ ${minutes} min · ${boxes} boîtes · pour ${S.dates.map(d => ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'][(new Date(d + 'T12:00:00').getDay() + 6) % 7]).join(', ')}</div>
      <div class="ck-progress"><div class="tm-bar"><i style="width:${total ? doneCount / total * 100 : 0}%"></i></div><span>${doneCount}/${total} étapes</span></div>
    </div>

    <div class="ck-menu">
      ${list.map((x, k) => `<button class="ck-menu-item dish-${k}" data-rid="${x.r.id}">
        ${dishThumbRated(x.r, 'menu')}
        <span class="ck-menu-txt"><span class="ck-menu-name">${dishShort(x.r)}</span><span class="ck-menu-link">Voir la recette ›</span></span>
      </button>`).join('')}

    </div>

    <div class="ck-phase">
      <div class="ck-phase-hd"><span class="ck-phase-num">1</span><div><div class="ck-phase-title">Sortir les ingrédients</div><div class="ck-phase-hint">Quantités totales pour toute la session</div></div></div>
      ${list.map((x, k) => {
        const c = conservation(x.r);
        return `<details class="ck-ings dish-${k}">
          <summary><span class="ck-sum-name">${dishThumb(x.r, 'mini')}${x.r.name}</span><span class="ck-ings-n">${x.portions} portions</span></summary>
          ${x.r.ingredients.map((g, i) => `<div class="ck-ing"><span>${g.name}</span><span>${humanQty(g.key, x.tot[i], g.unit)}</span></div>`).join('')}
          <button class="ck-recipe" data-rid="${x.r.id}">Voir la fiche complète</button>
        </details>`;
      }).join('')}
    </div>

    ${phases.map((ph, k) => `
      <div class="ck-phase dish-${ph.idx}">
        <div class="ck-phase-hd">
          <span class="ck-phase-num">${k + 2}</span>
          ${dishThumb(ph.r, 'phase')}
          <div class="ck-phase-txt"><div class="ck-phase-title">${ph.title}</div>${ph.hint ? `<div class="ck-phase-hint">${ph.hint}</div>` : ''}</div>
        </div>
        <div class="ck-phase-steps">${phaseSteps[k].map(st => stepBtn(st.text, st.i, dishShort(ph.r))).join('')}</div>
      </div>`).join('')}

    <div class="ck-phase ck-phase-end">
      <div class="ck-phase-hd"><span class="ck-phase-num">${phases.length + 2}</span><div><div class="ck-phase-title">Mettre en boîtes</div><div class="ck-phase-hint">Laisser tiédir, fermer, mettre au frigo</div></div></div>
      <div class="ck-phase-steps">${stepBtn(list.map(x => `${x.portions} boîtes de ${dishShort(x.r)}`).join(' · '), boxIdx)}</div>
      <div class="ck-cons-list">${list.map(x => { const c = conservation(x.r); return `<div class="ck-cons-row"><span>${dishShort(x.r)}</span><span>frigo ${c.fridge}${c.freezer ? ` · congélo ${c.freezer}` : ''}</span></div>`; }).join('')}</div>
      ${fries.length ? `<div class="ck-note">🍟 ${fries.map(f => f.name).join(' / ')} : à faire au moment du repas, elles ne se gardent pas.</div>` : ''}
    </div>

    ${prepSnacks.length ? `
      <div class="hb-section-title">À préparer aussi</div>
      ${prepSnacks.map(r => `<button class="hb-card ck-snack" data-rid="${r.id}"><span>${r.emoji} ${r.name}</span><span class="hb-chev">›</span></button>`).join('')}` : ''}
  `;
  app.insertBefore(view, app.querySelector('#nav'));

  view.querySelectorAll('.hb-seg-btn').forEach(b => b.addEventListener('click', () => { sessionIdx = +b.dataset.s; renderCook(); }));
  view.querySelectorAll('.ck-step').forEach(b => b.addEventListener('click', () => {
    const i = +b.dataset.i;
    done = done.includes(i) ? done.filter(x => x !== i) : [...done, i];
    localStorage.setItem(doneKey, JSON.stringify(done));
    const y = window.scrollY;
    renderCook();
    window.scrollTo(0, y);
  }));
  view.querySelectorAll('[data-rid]').forEach(b => b.addEventListener('click', e => {
    e.preventDefault();
    renderRecipeDetail(getById(b.dataset.rid), 'cook');
  }));
}

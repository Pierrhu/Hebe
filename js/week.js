// week.js — Onglet « Semaine » : je mange quoi ?
// Le repas du jour en grand, la semaine en une ligne par jour, le détail (macros) en touchant un jour.

import { getEntry, saveEntry, getNextWeekDates, getWeekDates, getTodayDate } from '../data/log.js';
import { USER } from '../data/user.js';
import { getById, proteinFamily } from '../data/recipes.js';
import { INGREDIENTS, humanQty } from '../data/ingredients.js';
import { el, computeDayMacros, itemMacros, openSheet, closeSheet, toast } from './utils.js';
import { generateWeek, getActivePlan, replaceDish, logOutsideMeal, undoOutsideMeal, OUTSIDE_LEVELS } from './weekgen.js';
import { itemQuantities } from './optimizer.js';
import { dishThumb, dishThumbRated, rateClass, ICON_HEART } from '../data/photos.js';
import { getRating, setRating } from '../data/prefs.js';
import { renderRecipeDetail } from './recipeDetail.js';

const DAY_LONG = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const DAY_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const PROTEINS = [
  { id: 'poulet',    label: 'Poulet',    emoji: '🍗' },
  { id: 'boeuf',     label: 'Bœuf',      emoji: '🥩' },
  { id: 'dinde',     label: 'Dinde',     emoji: '🦃' },
  { id: 'crevettes', label: 'Crevettes', emoji: '🦐' },
  { id: 'saumon',    label: 'Poisson',   emoji: '🐟' },
  { id: 'tofu',      label: 'Végé',      emoji: '🌱' },
];
let cantineDays = JSON.parse(localStorage.getItem('hebe_cantine_days') || '[]');
let selProteins = JSON.parse(localStorage.getItem('hebe_proteins') || 'null') || PROTEINS.map(p => p.id);

const ICON_BOOK = '<svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>';
const ICON_SET = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/></svg>';

const dayIdx = d => (new Date(d + 'T12:00:00').getDay() + 6) % 7;
const shortName = id => getById(id)?.short || '';
const names = list => list.map(it => {
  const r = getById(it.id);
  if (!r) return null;
  if (r.category === 'side' && /frites/i.test(r.name)) return /patate/i.test(r.name) ? 'frites de patate douce' : 'frites';
  return r.name;
}).filter(Boolean);

// Plats d'un repas + accompagnement lié (frites)
function mealItems(e, meal) {
  return [...(e.meals[meal] || []), ...(e.meals.sides || []).filter(s => s.with === meal)];
}
function extraItems(e) {
  return [...(e.meals.sweet || []), ...(e.meals.sides || []).filter(s => !s.with), ...(e.meals.starter || [])];
}

export function renderWeek() {
  const app = document.getElementById('app');
  app.querySelector('.view')?.remove();
  const plan = getActivePlan();
  const T = USER.targets;
  const view = el('div', 'view hb-week');

  const top = `
    <div class="hb-top">
      <div><div class="brand-word">Héb<span class="brand-accent">é</span></div><div class="brand-tag">Bien manger sans y penser</div></div>
      <div class="hb-top-actions">
        <button class="hb-icon" data-go="recipes" aria-label="Toutes les recettes">${ICON_BOOK}</button>
        <button class="hb-icon" data-go="settings" aria-label="Mon programme">${ICON_SET}</button>
      </div>
    </div>`;

  if (!plan) {
    view.innerHTML = `${top}
      <div class="hb-card hb-empty">
        <div class="hb-h2">Prépare ta semaine</div>
        <p class="hb-p">Choisis tes protéines et tes midis à la cantine. Hébé choisit 4 plats à cuisiner en 2 sessions et fait ta liste de courses.</p>
        ${generatorHTML(null)}
      </div>`;
    app.insertBefore(view, app.querySelector('#nav'));
    bindTop(view);
    bindGenerator(view, () => renderWeek());
    return;
  }

  const today = getTodayDate();
  const isRunning = plan.dates.includes(today);
  const focus = isRunning ? today : plan.dates[0];
  // Une grande carte par jour, à partir d'aujourd'hui ; les jours passés sont repliés en bas
  const upcoming = plan.dates.filter(d => d >= focus), past = plan.dates.filter(d => d < focus);
  const tomorrow = new Date(new Date(today + 'T12:00:00').getTime() + 864e5).toISOString().slice(0, 10);
  const dayCard = d => {
    const e = getEntry(d), m = computeDayMacros(e);
    const ex = names(extraItems(e));
    const exLine = ex.length <= 2 ? ex.join(' et ') : `${ex[0]} et ${ex.length - 1} compléments`;
    const eyebrow = d === today ? "Aujourd'hui" : d === tomorrow ? 'Demain' : '';
    return `<section class="today day-card ${d === today ? 'is-today' : ''}">
      <div class="today-head">
        <div>
          ${eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : ''}
          <div class="today-date">${DAY_LONG[dayIdx(d)]} ${new Date(d + 'T12:00:00').getDate()}</div>
        </div>
        <button class="link-btn" data-date="${d}">Détail</button>
      </div>
      <div class="dv-meals">${bigTile('Midi', mealItems(e, 'lunch'))}${bigTile('Soir', mealItems(e, 'dinner'))}</div>
      ${ex.length ? `<div class="today-extra">En plus : ${exLine}</div>` : ''}
      <div class="today-macros">
        <div class="tm"><div class="tm-top"><span>Calories</span><span><b>${Math.round(m.kcal)}</b> / ${T.kcal}</span></div><div class="tm-bar"><i style="width:${Math.min(100, m.kcal / T.kcal * 100)}%"></i></div></div>
        <div class="tm"><div class="tm-top"><span>Protéines</span><span><b>${Math.round(m.protein)}</b> / ${T.protein} g</span></div><div class="tm-bar"><i style="width:${Math.min(100, m.protein / T.protein * 100)}%"></i></div></div>
      </div>
    </section>`;
  };

  view.innerHTML = `${top}
    ${upcoming.map(d => dayCard(d)).join('')}
    ${past.length ? `<details class="past-days">
      <summary>Jours passés <span>${past.length}</span></summary>
      ${past.map(d => dayCard(d)).join('')}
    </details>` : ''}

    <button class="hb-card hb-batch-link" data-go="cook">
      <div>
        <div class="hb-h3">Sessions de batch cooking</div>
        <div class="hb-batch-thumbs">${plan.sessions.flatMap(s => s.recipes).map(r => dishThumb(getById(r.id), 'batch')).join('')}</div>
        ${plan.sessions.map(s => `<div class="hb-batch-line"><b>${s.label} :</b> ${s.recipes.map(r => shortName(r.id)).join(', ')}</div>`).join('')}
      </div>
      <span class="hb-chev">›</span>
    </button>

    <button class="hb-btn hb-regen">Nouvelle semaine</button>
  `;
  app.insertBefore(view, app.querySelector('#nav'));
  bindTop(view);
  view.querySelectorAll('[data-date]').forEach(b => b.addEventListener('click', () => openDaySheet(b.dataset.date)));
  bindHearts(view);
  view.querySelectorAll('.today [data-rid]').forEach(b => b.addEventListener('click', () => renderRecipeDetail(getById(b.dataset.rid), 'week')));
  view.querySelector('.hb-regen').addEventListener('click', () => {
    openSheet(`<div class="sheet-handle"></div><div class="hb-sheet-pad"><div class="hb-h2">Nouvelle semaine</div>${generatorHTML(plan)}</div>`);
    bindGenerator(document.getElementById('sheet'), () => { closeSheet(); renderWeek(); });
  });
}

function bindTop(view) {
  view.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => window._nav?.(b.dataset.go)));
}

// Grande tuile d'un repas : photo du plat principal + nom (+ accompagnement éventuel)
// Toucher le cœur d'une photo : j'aime / je n'aime plus (sans ouvrir la fiche)
function bindHearts(root) {
  root.querySelectorAll('[data-like]').forEach(h => h.addEventListener('click', e => {
    e.stopPropagation();
    const id = h.dataset.like;
    const v = setRating(id, 1);
    document.querySelectorAll(`[data-like="${id}"]`).forEach(x => { x.classList.toggle('on', v > 0); x.classList.remove('pop'); void x.offsetWidth; x.classList.add('pop'); });
    document.querySelectorAll(`[data-photo="${id}"]`).forEach(x => { x.classList.toggle('is-liked', v > 0); x.classList.remove('is-nope'); });
    toast(v > 0 ? '❤️ Ajouté à tes plats préférés' : 'Retiré de tes plats préférés');
  }));
}

function bigTile(label, items) {
  const main = items[0] && getById(items[0].id);
  if (!main) return '';
  const side = items.slice(1).map(it => getById(it.id)).filter(Boolean);
  const kcal = items.reduce((a, it) => a + itemMacros(it).kcal, 0);
  const isOut = (main.tags || []).includes('imprevu');
  const fam = (main.tags || []).includes('cantine') ? 'cantine' : isOut ? 'outside' : proteinFamily(main);
  return `<button class="dv-meal fam-${fam}" data-rid="${main.id}">
    <div class="dv-photo ${rateClass(main.id)}" data-photo="${main.id}">${dishThumb(main, 'dv-img')}<span class="hb-tile-lbl">${label}</span>${(main.tags || []).includes('cantine') || isOut ? '' : `<span class="tile-heart ${getRating(main.id) > 0 ? 'on' : ''}" data-like="${main.id}" role="button" tabindex="0" aria-label="J'aime ce plat">${ICON_HEART}</span>`}</div>
    <div class="dv-name">${main.name}</div>
    ${side.length ? `<div class="dv-side">+ ${side.map(r => /frites/i.test(r.name) ? (/patate/i.test(r.name) ? 'frites de patate douce' : 'frites') : r.name.toLowerCase()).join(', ')}</div>` : ''}
    <div class="dv-k">${Math.round(kcal)} kcal</div>
  </button>`;
}

// ── Générateur (carte vide ou feuille « Nouvelle semaine ») ──
function defaultNextWeek(plan) {
  if (plan) return plan.dates[0] === getNextWeekDates()[0];
  return ((new Date().getDay() + 6) % 7) >= 3; // à partir de jeudi : semaine prochaine
}
function generatorHTML(plan) {
  const next = defaultNextWeek(plan);
  return `
    <div class="hb-field">
      <div class="hb-label">Pour quelle semaine ?</div>
      <div class="hb-seg">
        <button class="hb-seg-btn ${!next ? 'on' : ''}" data-week="0">Cette semaine</button>
        <button class="hb-seg-btn ${next ? 'on' : ''}" data-week="1">Prochaine</button>
      </div>
    </div>
    <div class="hb-field">
      <div class="hb-label">Midis à la cantine</div>
      <div class="cantine-days">
        ${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => `<button class="cant-day ${cantineDays.includes(i) ? 'on' : ''}" data-i="${i}" aria-label="${DAY_LONG[i]}">${d}</button>`).join('')}
      </div>
    </div>
    <div class="hb-field">
      <div class="hb-label">Protéines</div>
      <div class="protein-chips">
        ${PROTEINS.map(p => `<button class="prot-chip ${selProteins.includes(p.id) ? 'on' : ''}" data-p="${p.id}"><span class="prot-emoji">${p.emoji}</span>${p.label}</button>`).join('')}
      </div>
    </div>
    <button class="hb-btn hb-btn-primary hb-generate">Générer ma semaine</button>`;
}
function bindGenerator(root, onDone) {
  let next = !!root.querySelector('.hb-seg-btn[data-week="1"].on');
  root.querySelectorAll('.hb-seg-btn').forEach(b => b.addEventListener('click', () => {
    next = b.dataset.week === '1';
    root.querySelectorAll('.hb-seg-btn').forEach(x => x.classList.toggle('on', x === b));
  }));
  root.querySelectorAll('.cant-day').forEach(b => b.addEventListener('click', () => {
    const i = +b.dataset.i;
    cantineDays = cantineDays.includes(i) ? cantineDays.filter(x => x !== i) : [...cantineDays, i];
    localStorage.setItem('hebe_cantine_days', JSON.stringify(cantineDays));
    b.classList.toggle('on');
  }));
  root.querySelectorAll('.prot-chip').forEach(b => b.addEventListener('click', () => {
    const p = b.dataset.p;
    if (selProteins.includes(p)) { if (selProteins.length > 1) selProteins = selProteins.filter(x => x !== p); }
    else selProteins = [...selProteins, p];
    localStorage.setItem('hebe_proteins', JSON.stringify(selProteins));
    b.classList.toggle('on', selProteins.includes(p));
  }));
  root.querySelector('.hb-generate').addEventListener('click', e => {
    const btn = e.currentTarget;
    btn.textContent = 'Génération…'; btn.disabled = true;
    setTimeout(() => {
      const { entries } = generateWeek({ cantineDays, nextWeek: next, targets: USER.targets, proteins: selProteins });
      Object.values(entries).forEach(en => saveEntry(en));
      onDone();
    }, 50);
  });
}

// ── Détail d'un jour : les plats en grand, puis les macros, puis les quantités ──
function openDaySheet(date) {
  const e = getEntry(date);
  const m = computeDayMacros(e);
  const T = USER.targets;
  const lunch = mealItems(e, 'lunch'), dinner = mealItems(e, 'dinner'), extras = extraItems(e);

  const smallTile = it => {
    const r = getById(it.id); if (!r) return '';
    return `<button class="dv-extra cat-${r.category}" data-rid="${r.id}">${dishThumbRated(r, 'dv-ex-img')}<span class="dv-ex-name">${r.name}</span><span class="dv-k">${Math.round(itemMacros(it).kcal)} kcal</span></button>`;
  };
  const cell = (label, v, t, unit, cls) => `
    <div class="ds-cell">
      <div class="ds-v ${cls}">${Math.round(v)}</div>
      <div class="ds-l">${label}<br>sur ${t}${unit}</div>
      <div class="ds-bar"><span class="${cls}" style="width:${Math.min(100, v / t * 100)}%"></span></div>
    </div>`;
  const qtyBlock = (label, items) => items.length ? `
    <div class="dv-q-group"><div class="hb-label">${label}</div>
      ${items.map(it => {
        const r = getById(it.id); if (!r || (r.tags || []).includes('cantine') || (r.tags || []).includes('imprevu')) return '';
        const qs = itemQuantities(it);
        const ings = r.ingredients.map((g, i) => ({ g, q: qs[i] }))
          .filter(x => x.q > 0 && !INGREDIENTS[x.g.key]?.pantry)
          .map(x => `${x.g.name.split(' (')[0].toLowerCase()} ${humanQty(x.g.key, x.q, x.g.unit, { cooked: true })}`);
        return `<div class="ds-item"><div class="ds-item-hd"><span>${r.name}</span></div><div class="ds-ings">${ings.join(' · ')}</div></div>`;
      }).join('')}
    </div>` : '';

  openSheet(`
    <div class="sheet-handle"></div>
    <div class="hb-sheet-pad">
      <div class="hb-h2">${DAY_LONG[dayIdx(date)]} ${new Date(date + 'T12:00:00').getDate()}</div>
      <div class="dv-meals">${bigTile('Midi', lunch)}${bigTile('Soir', dinner)}</div>
      <div class="dv-swaps">${[['lunch', lunch], ['dinner', dinner]].map(([meal, items]) => {
        const r = items[0] && getById(items[0].id);
        if (!r) return '<span></span>';
        if ((r.tags || []).includes('imprevu')) {
          const lvl = OUTSIDE_LEVELS[e.outside?.[meal]?.level];
          return `<div class="dv-acts"><span class="out-tag">🍽️ ${lvl ? lvl.label : ''} · ~${lvl ? lvl.kcal : ''} kcal</span><button class="swap-btn" data-undo="${meal}">↩ Annuler l'imprévu</button></div>`;
        }
        if ((r.tags || []).includes('cantine')) return '<span></span>';
        return `<div class="dv-acts" data-acts="${meal}">
          <button class="swap-btn" data-swap="${r.id}">↻ Changer</button>
          <button class="swap-btn out" data-out="${meal}">🍽️ Imprévu</button>
        </div>`;
      }).join('')}</div>
      ${extras.length ? `<div class="hb-label dv-extras-lbl">En plus</div><div class="dv-extras">${extras.map(smallTile).join('')}</div>` : ''}
      <div class="ds-grid">
        ${cell('Calories', m.kcal, T.kcal, '', 'k')}
        ${cell('Protéines', m.protein, T.protein, ' g', 'p')}
        ${cell('Glucides', m.carbs, T.carbs, ' g', 'c')}
        ${cell('Lipides', m.fat, T.fat, ' g', 'f')}
      </div>
      <details class="dv-qty">
        <summary>Quantités du jour <span>poids crus, 1 portion</span></summary>
        ${qtyBlock('Midi', lunch)}${qtyBlock('Soir', dinner)}${qtyBlock('En plus', extras)}
      </details>
      <button class="hb-btn ds-close">Fermer</button>
    </div>`);
  const sheet = document.getElementById('sheet');
  sheet.querySelector('.ds-close')?.addEventListener('click', closeSheet);
  bindHearts(sheet);
  // Imprévu : choisir l'ampleur du repas pris dehors
  sheet.querySelectorAll('[data-out]').forEach(btn => btn.addEventListener('click', () => {
    const meal = btn.dataset.out;
    const box = sheet.querySelector(`[data-acts="${meal}"]`);
    box.innerHTML = `<div class="out-pick">
      <div class="out-q">Repas pris dehors ${meal === 'lunch' ? 'ce midi' : 'ce soir'} :</div>
      ${Object.entries(OUTSIDE_LEVELS).map(([k, l]) => `<button class="out-opt" data-lvl="${k}"><b>${l.label}</b><span>~${l.kcal} kcal</span></button>`).join('')}
      <button class="out-cancel">Annuler</button>
    </div>`;
    box.querySelector('.out-cancel').addEventListener('click', () => openDaySheet(date));
    box.querySelectorAll('[data-lvl]').forEach(o => o.addEventListener('click', () => {
      const res = logOutsideMeal(date, meal, o.dataset.lvl);
      closeSheet(); renderWeek(); openDaySheet(date);
      toast(res?.skipped
        ? `C'est noté. Il te reste 1 boîte de ${shortName(res.skipped.id)} : congèle-la.`
        : 'C\'est noté, tes collations s\'adaptent.');
    }));
  }));
  sheet.querySelectorAll('[data-undo]').forEach(btn => btn.addEventListener('click', () => {
    undoOutsideMeal(date, btn.dataset.undo);
    closeSheet(); renderWeek(); openDaySheet(date);
    toast('Imprévu annulé');
  }));
  sheet.querySelectorAll('[data-swap]').forEach(b => b.addEventListener('click', () => {
    const old = getById(b.dataset.swap);
    const next = replaceDish(b.dataset.swap);
    if (!next) { toast('Aucun autre plat disponible pour le moment'); return; }
    closeSheet(); renderWeek(); openDaySheet(date);
    toast(`${shortName(old.id)} remplacé par ${shortName(next.id)} pour toute la session`);
  }));
  sheet.querySelectorAll('[data-rid]').forEach(b => b.addEventListener('click', () => {
    closeSheet();
    renderRecipeDetail(getById(b.dataset.rid), 'week');
  }));
}

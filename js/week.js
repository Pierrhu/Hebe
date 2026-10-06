// week.js — Onglet « Semaine » : je mange quoi ?
// Le repas du jour en grand, la semaine en une ligne par jour, le détail (macros) en touchant un jour.

import { localYMD } from '../data/log.js';
import { getEntry, saveEntry, getNextWeekDates, getWeekDates, getTodayDate } from '../data/log.js';
import { USER, getTargetsFor } from '../data/user.js';
import { getMembers, getActiveMember, updateMember } from '../data/household.js';
import { whoSwitch, bindWho, avatar } from './profileUi.js';
import { getById, proteinFamily, isFreshFish } from '../data/recipes.js';
import { INGREDIENTS, humanQty } from '../data/ingredients.js';
import { el, computeDayMacros, itemMacros, openSheet, closeSheet, toast } from './utils.js';
import { sessionDate, sessionWhen, replaceOptions, generateWeek, getActivePlan, replaceDish, logOutsideMeal, undoOutsideMeal, OUTSIDE_LEVELS, planTargets, recalcPortions, refreshExtras } from './weekgen.js';
import { itemQuantities, plateTarget, PLATE_SHARE } from './optimizer.js';
import { proteinBoost } from './diet.js';
import { dishThumb, dishThumbRated, rateClass, ICON_HEART } from '../data/photos.js';
import { getRating, setRating } from '../data/prefs.js';
import { renderRecipeDetail } from './recipeDetail.js';
import { NAV_SVGS } from './nav.js';

const ICON_SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/></svg>';
const ICON_MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
let selectedDay = null, selectedFor = null; // jour affiché dans la Semaine
const DAY_LONG = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const DAY_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const PROTEINS = [
  { id: 'poulet',    label: 'Poulet',    emoji: '🍗' },
  { id: 'boeuf',     label: 'Bœuf',      emoji: '🥩' },
  { id: 'crevettes', label: 'Crevettes', emoji: '🦐' },
  { id: 'saumon',    label: 'Poisson',   emoji: '🐟' },
  { id: 'tofu',      label: 'Végé',      emoji: '🌱' },
];
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
        <button class="hb-avatar" data-go="settings" aria-label="Mon programme">${avatar(getActiveMember().sex)}</button>
      </div>
    </div>
    ${whoSwitch()}`;

  if (!plan) {
    view.innerHTML = `${top}
      <div class="hb-card hb-empty">
        <div class="hb-h2">Prépare ta semaine</div>
        <p class="hb-p">Choisis tes protéines et tes repas libres. Hébé choisit les plats, prépare ta session de cuisine et ta liste de courses.</p>
        ${generatorHTML(null)}
      </div>`;
    app.insertBefore(view, app.querySelector('#nav'));
    bindTop(view);
    bindWho(view, renderWeek);
    bindGenerator(view, () => renderWeek());
    return;
  }

  // personne ajoutée au foyer après la génération : il faut une nouvelle semaine
  if (plan.members && !plan.members.includes(getActiveMember().id)) {
    view.innerHTML = `${top}
      <div class="hb-card hb-empty">
        <div class="hb-h2">Une nouvelle semaine pour ${getActiveMember().name || 'cette personne'}</div>
        <p class="hb-p">La semaine en cours a été préparée avant son arrivée dans le foyer. Génère une nouvelle semaine pour calculer ses portions.</p>
        ${generatorHTML(plan)}
      </div>`;
    app.insertBefore(view, app.querySelector('#nav'));
    bindTop(view);
    bindWho(view, renderWeek);
    bindGenerator(view, () => renderWeek());
    return;
  }

  const today = getTodayDate();
  const isRunning = plan.dates.includes(today);
  const focus = isRunning ? today : plan.dates[0];
  // Un seul jour à l'écran, choisi dans le bandeau des 7 jours (aujourd'hui par défaut)
  if (!plan.dates.includes(selectedDay) || selectedFor !== plan.start) { selectedDay = focus; selectedFor = plan.start; }
  const dotsOf = d => {
    const e = getEntry(d), out = [];
    ['lunch', 'dinner'].forEach(meal => (e.meals[meal] || []).forEach(it => {
      const r = getById(it.id); if (!r) return;
      if ((r.tags || []).includes('libre')) out.push('free'); else if (isFreshFish(r)) out.push('fish');
    }));
    return [...new Set(out)].map(k => `<i class="dot-${k}"></i>`).join('');
  };
  const strip = `<div class="day-strip" role="tablist" aria-label="Jours de la semaine">${plan.dates.map((d, i) => `<button class="${d < today ? 'past' : ''} ${d === today ? 'today' : ''} ${d === selectedDay ? 'on' : ''}" data-day="${d}" role="tab" aria-selected="${d === selectedDay}" aria-label="${DAY_LONG[dayIdx(d)]} ${new Date(d + 'T12:00:00').getDate()}"><span>${'LMMJVSD'[dayIdx(d)]}</span><b>${new Date(d + 'T12:00:00').getDate()}</b><div class="ds-dots">${dotsOf(d)}</div></button>`).join('')}</div>`;
  const tomorrow = localYMD(new Date(new Date(today + 'T12:00:00').getTime() + 864e5));
  const dayCard = d => {
    const e = getEntry(d), m = computeDayMacros(e);
    const miniTile = (it, lbl, cls) => { const r = getById(it.id); if (!r) return ''; return `<button class="dv-mini" data-rid="${r.id}"><div class="dv-photo">${dishThumb(r, 'dv-img')}<span class="hb-tile-lbl ${cls}">${lbl}</span></div><span class="dv-mini-name">${shortName(r.id)}</span><span class="dv-k">${Math.round(itemMacros(it).kcal)} kcal</span></button>`; };
    const minis = [...(e.meals.breakfast || []).slice(0, 1).map(it => miniTile(it, 'Petit-déj', 'lbl-morning')), ...extraItems(e).map(it => miniTile(it, 'Collation', 'lbl-snack'))].filter(Boolean);
    const eyebrow = d === today ? "Aujourd'hui" : d === tomorrow ? 'Demain' : '';
    // boîtes congelées du lendemain : à sortir ce soir et à mettre au frigo
    const k = plan.dates.indexOf(d);
    const next = k >= 0 && k < plan.dates.length - 1 ? getEntry(plan.dates[k + 1]) : null;
    const thaw = next ? ['lunch', 'dinner'].flatMap(meal => (next.meals[meal] || []).filter(it => it.frozen).map(it => `${shortName(it.id)} (demain ${meal === 'lunch' ? 'midi' : 'soir'})`)) : [];
    return `<section class="today day-card ${d === today ? 'is-today' : ''}">
      <div class="today-head">
        <div>
          ${eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : ''}
          <div class="today-date">${DAY_LONG[dayIdx(d)]} ${new Date(d + 'T12:00:00').getDate()}</div>
        </div>
        <button class="link-btn" data-date="${d}">Détail</button>
      </div>
      <div class="dv-meals">${bigTile('Midi', mealItems(e, 'lunch'), false)}${bigTile('Soir', mealItems(e, 'dinner'), false)}</div>
      ${minis.length ? `<div class="dv-minis">${minis.join('')}</div>` : ''}
      ${thaw.length ? `<div class="thaw-note"><b>Ce soir</b>sors du congélateur ${thaw.join(' et ')}, et mets ${thaw.length > 1 ? 'les boîtes' : 'la boîte'} au frigo pour qu'${thaw.length > 1 ? 'elles décongèlent' : 'elle décongèle'} doucement.</div>` : ''}
      <div class="today-macros">
        <div class="tm"><div class="tm-top"><span>Calories</span><span><b>${Math.round(m.kcal)}</b> / ${T.kcal}</span></div><div class="tm-bar"><i style="width:${Math.min(100, m.kcal / T.kcal * 100)}%"></i></div></div>
        <div class="tm"><div class="tm-top"><span>Protéines</span><span><b>${Math.round(m.protein)}</b> / ${T.protein} g</span></div><div class="tm-bar"><i style="width:${Math.min(100, m.protein / T.protein * 100)}%"></i></div></div>
      </div>
    </section>`;
  };

  // Profil modifié depuis la génération (formule ou besoins) : on propose de mettre la semaine à jour
  const inPlan = getMembers().filter(m => (plan.members || [getActiveMember().id]).includes(m.id));
  const me = getActiveMember();
  const fChanged = inPlan.filter(m => (m.formula || 'jeune') !== (plan.formulaBy?.[m.id] || 'jeune'));
  // régime sans lactose modifié : les plats doivent changer, donc nouvelle semaine
  const lChanged = inPlan.filter(m => (m.lactose || 0) !== (plan.lactoseBy?.[m.id] || 0) || (m.gluten || 0) !== (plan.glutenBy?.[m.id] || 0));
  const tChanged = inPlan.filter(m => { const a = getTargetsFor(m), b = planTargets(plan, m.id); return ['kcal', 'protein', 'carbs', 'fat'].some(k => Math.abs(a[k] - b[k]) > 1); });
  // préférences (petit-déjeuner pour la formule classique, whey) ; les anciens plans ne les connaissent pas
  const pChanged = plan.prefsBy ? inPlan.filter(m => {
    const p0 = plan.prefsBy[m.id];
    if (!p0) return false;
    const bk = (m.formula || 'jeune') === 'classique' && (m.breakfast || 'mix') !== p0.breakfast;
    return bk || (m.whey !== false) !== p0.whey;
  }) : [];
  const nameOf = m => m.name || 'Sans prénom';
  let formulaNote = '';
  if (fChanged.length) {
    const toClassic = fChanged.some(m => m.formula === 'classique');
    const who = fChanged.length === 1 && inPlan.length > 1 ? fChanged[0].name : null;
    formulaNote = `<div class="formula-note">
      <b>${toClassic ? (who ? `Les petits-déjeuners de ${who} arrivent à la prochaine semaine` : 'Tes petits-déjeuners arrivent à la prochaine semaine') : 'Formule jeûne : plus de petit-déjeuner'}</b>
      <p>${toClassic
        ? "Cette semaine a été préparée avec la formule jeûne. Génère une nouvelle semaine pour ajouter un petit-déjeuner chaque matin, avec des portions recalculées."
        : 'Cette semaine a été préparée avec la formule classique. Génère une nouvelle semaine pour retirer les petits-déjeuners et recalculer les portions.'}</p>
      <button class="hb-btn hb-btn-primary formula-regen">Préparer une nouvelle semaine</button>
    </div>`;
  } else if (lChanged.length) {
    const solo = inPlan.length < 2;
    const LV = ['sans restriction', 'intolérance', 'strict'], GV = ['sans restriction', 'sensibilité', 'strict'];
    const who = lChanged.length === 1 && !solo ? nameOf(lChanged[0]) : null;
    formulaNote = `<div class="formula-note">
      <b>${who ? `Le régime de ${who} a changé` : solo ? 'Ton régime a changé' : 'Vos régimes ont changé'}</b>
      <div class="fn-rows">${lChanged.flatMap(m => [
        (m.lactose || 0) !== (plan.lactoseBy?.[m.id] || 0) ? `<div class="fn-row"><span>${solo ? 'Lactose' : `${nameOf(m)}, lactose`}</span><span><strong>${LV[m.lactose || 0]}</strong></span></div>` : '',
        (m.gluten || 0) !== (plan.glutenBy?.[m.id] || 0) ? `<div class="fn-row"><span>${solo ? 'Gluten' : `${nameOf(m)}, gluten`}</span><span><strong>${GV[m.gluten || 0]}</strong></span></div>` : '',
      ]).join('')}</div>
      <p>Cette semaine a été préparée avant ce changement. Génère une nouvelle semaine pour avoir des plats, des petits-déjeuners et des collations adaptés.</p>
      <button class="hb-btn hb-btn-primary formula-regen">Préparer une nouvelle semaine</button>
    </div>`;
  } else if (tChanged.length || pChanged.length) {
    const solo = inPlan.length < 2;
    const who = [...new Set([...tChanged, ...pChanged])];
    const subject = solo ? 'Ton profil a changé' : who.length > 1 ? 'Vos profils ont changé' : `Le profil de ${nameOf(who[0])} a changé`;
    const BK = { sucre: 'sucré', sale: 'salé', mix: 'sucré et salé' };
    const rows = [
      ...tChanged.map(m => `<div class="fn-row"><span>${solo ? 'Besoins par jour' : nameOf(m)}</span><span>${planTargets(plan, m.id).kcal} → <strong>${getTargetsFor(m).kcal} kcal</strong></span></div>`),
      ...pChanged.flatMap(m => {
        const p0 = plan.prefsBy[m.id], out = [];
        if ((m.formula || 'jeune') === 'classique' && (m.breakfast || 'mix') !== p0.breakfast) out.push(`<div class="fn-row"><span>${solo ? 'Petit-déjeuner' : `${nameOf(m)}, petit-déjeuner`}</span><span><strong>${BK[m.breakfast || 'mix']}</strong></span></div>`);
        if ((m.whey !== false) !== p0.whey) out.push(`<div class="fn-row"><span>${solo ? 'Whey' : `${nameOf(m)}, whey`}</span><span><strong>${m.whey !== false ? 'avec' : 'sans'}</strong></span></div>`);
        return out;
      }),
    ];
    const what = tChanged.length && pChanged.length ? 'Les portions, les petits-déjeuners et les collations seront recalculés'
      : tChanged.length ? 'Les portions seront recalculées' : 'Les petits-déjeuners et les collations seront remplacés';
    formulaNote = `<div class="formula-note">
      <b>${subject}</b>
      <div class="fn-rows">${rows.join('')}</div>
      <p>${what} à partir d'aujourd'hui, en gardant les mêmes plats du midi et du soir. Tu peux aussi préparer une nouvelle semaine.</p>
      <button class="hb-btn hb-btn-primary recalc-btn">Mettre à jour la semaine</button>
      <button class="hb-btn formula-regen fn-second">Nouvelle semaine</button>
    </div>`;
  }

  view.innerHTML = `${top}
    ${formulaNote}
    ${strip}
    ${dayCard(selectedDay)}

    <button class="hb-card hb-batch-link" data-go="cook">
      <div>
        <div class="hb-h3">Ta session de cuisine</div>
        ${sessionDate(plan) >= getTodayDate() ? `<div class="hb-batch-when"><span>${capFirst(sessionWhen(plan))}</span>${sessionDate(plan) === getTodayDate() ? 'courses puis cuisine' : 'courses la veille ou le matin même'}</div>` : ''}
        <div class="hb-batch-thumbs">${plan.sessions.flatMap(s => s.recipes).map(r => dishThumb(getById(r.id), 'batch')).join('')}</div>
        ${plan.sessions.map(s => `<div class="hb-batch-line">${s.recipes.map(r => shortName(r.id)).join(', ')}</div>`).join('')}
      </div>
      <span class="hb-chev">›</span>
    </button>

    <button class="hb-btn hb-regen">Nouvelle semaine</button>
  `;
  app.insertBefore(view, app.querySelector('#nav'));
  bindTop(view);
  bindWho(view, renderWeek);
  view.querySelectorAll('[data-day]').forEach(b => b.addEventListener('click', () => { selectedDay = b.dataset.day; renderWeek(); }));
  view.querySelectorAll('[data-date]').forEach(b => b.addEventListener('click', () => openDaySheet(b.dataset.date)));
  bindHearts(view);
  view.querySelectorAll('.today [data-rid]').forEach(b => b.addEventListener('click', () => renderRecipeDetail(getById(b.dataset.rid), 'week', plannedItem(selectedDay, b.dataset.rid))));
  view.querySelectorAll('.dv-mini[data-rid]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); renderRecipeDetail(getById(b.dataset.rid), 'week', plannedItem(selectedDay, b.dataset.rid)); }));
  view.querySelector('.formula-regen')?.addEventListener('click', () => view.querySelector('.hb-regen').click());
  view.querySelector('.recalc-btn')?.addEventListener('click', () => {
    if (tChanged.length) recalcPortions(Object.fromEntries(tChanged.map(m => [m.id, getTargetsFor(m)])));
    if (pChanged.length) refreshExtras(Object.fromEntries(pChanged.map(m => [m.id, { breakfast: m.breakfast || 'mix', whey: m.whey !== false }])));
    toast("Semaine mise à jour à partir d'aujourd'hui");
    renderWeek();
  });
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

// Petit-déjeuner (formule classique) : une ligne au-dessus des deux grandes cartes
function morningRow(items) {
  const r = items[0] && getById(items[0].id);
  if (!r) return '';
  const kcal = items.reduce((a, it) => a + itemMacros(it).kcal, 0);
  return `<button class="dv-morning" data-rid="${r.id}">
    ${dishThumb(r, 'dv-mo-img')}
    <span class="dv-mo-txt"><span class="dv-mo-lbl">Petit-déjeuner</span><span class="dv-mo-name">${r.name}</span></span>
    <span class="dv-k">${Math.round(kcal)} kcal</span>
  </button>`;
}

function bigTile(label, items, frozen = true) {
  const frozenNote = frozen && items[0]?.frozen ? '<span class="dv-frozen">Décongelé au frigo depuis la veille</span>' : '';
  const main = items[0] && getById(items[0].id);
  if (!main) return '';
  const side = items.slice(1).map(it => getById(it.id)).filter(Boolean);
  const kcal = items.reduce((a, it) => a + itemMacros(it).kcal, 0);
  const isOut = (main.tags || []).includes('imprevu');
  const fam = (main.tags || []).includes('cantine') ? 'cantine' : isOut ? 'outside' : proteinFamily(main);
  return `<button class="dv-meal fam-${fam}" data-rid="${main.id}">
    <div class="dv-photo ${rateClass(main.id)}" data-photo="${main.id}">${items[0].kind === 'cantine' ? cantineThumb('dv-img') : dishThumb(main, 'dv-img')}<span class="hb-tile-lbl">${label}</span>${(main.tags || []).includes('cantine') || isOut ? '' : `<span class="tile-heart ${getRating(main.id) > 0 ? 'on' : ''}" data-like="${main.id}" role="button" tabindex="0" aria-label="J'aime ce plat">${ICON_HEART}</span>`}</div>
    <div class="dv-name">${items[0].kind === 'cantine' ? 'Cantine' : main.name}</div>
    ${side.length ? `<div class="dv-side">+ ${side.map(r => /frites/i.test(r.name) ? (/patate/i.test(r.name) ? 'frites de patate douce' : 'frites') : r.name.toLowerCase()).join(', ')}</div>` : ''}
    <div class="dv-k">${(main.tags || []).includes('libre') ? `${Math.round(kcal)} kcal réservées` : `${Math.round(kcal)} kcal`}</div>
    ${frozenNote}
  </button>`;
}

// ── Générateur (carte vide ou feuille « Nouvelle semaine ») ──
const todayIdx = () => (new Date().getDay() + 6) % 7; // 0 = lundi
// v195 : « Cette semaine » commence demain (courses et cuisine aujourd'hui). Plus proposée à partir de vendredi.
const thisWeekOk = () => todayIdx() <= 3;
function defaultNextWeek(plan) {
  if (!thisWeekOk()) return true;
  if (plan) return true; // une semaine existe déjà : on prépare la suivante
  return todayIdx() >= 3; // à partir de jeudi : semaine prochaine
}
const capFirst = t => t ? t[0].toUpperCase() + t.slice(1) : t;
const SHORT_DAY = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
function weekNote(next) {
  if (next) {
    const sun = new Date(getNextWeekDates()[0] + 'T12:00:00'); sun.setDate(sun.getDate() - 1);
    const d = sun.getDate();
    return todayIdx() === 6
      ? `Courses et cuisine <b>aujourd'hui</b>. Tes repas commencent demain, lundi ${d + 1}.`
      : `Courses samedi, cuisine <b>dimanche ${d}</b>. Tes repas commencent lundi ${d + 1}.`;
  }
  const t = todayIdx();
  return `Courses et cuisine <b>aujourd'hui</b>. Tes repas commencent demain, ${SHORT_DAY[t + 1]}, jusqu'à dimanche.`;
}
// Repas libres : calories réservées (v186). Affiché seulement s'il y a au moins un repas libre.
// Léger, Normal, Copieux, ou « Ajuster » (par pas de 100 kcal, 300 à 2000), qui part de la taille d'un plat.
// freeKcal = 0 : part habituelle (la taille d'un plat) ; freeKcalAdj : le réglage « Ajuster » est choisi.
const FK_PRESETS = [[600, 'Léger'], [900, 'Normal'], [1200, 'Copieux']];
const usualFreeKcal = m => Math.round(plateTarget(getTargetsFor(m), PLATE_SHARE[m.formula || 'jeune'] || 0.40, proteinBoost(m.id)).kcal / 100) * 100;
function freeKcalHTML(m) {
  const fk = m.freeKcal ?? 0;
  const adj = !!m.freeKcalAdj || !FK_PRESETS.some(([v]) => v === fk);
  const val = fk || usualFreeKcal(m);
  return `<div class="free-kcal" data-fkbox="${m.id}" role="radiogroup" aria-label="Calories réservées par repas libre" ${(m.free || []).length ? '' : 'hidden'}>
        <span class="free-kcal-lbl">Calories réservées par repas libre</span>
        <div class="free-seg2">${FK_PRESETS.map(([v, l]) => { const on = !adj && fk === v; return `<button class="${on ? 'on' : ''}" data-mid="${m.id}" data-fk="${v}" role="radio" aria-checked="${on}">${l}<small>${v} kcal</small></button>`; }).join('')}<button class="${adj ? 'on' : ''}" data-mid="${m.id}" data-fk="adj" role="radio" aria-checked="${adj}">Ajuster<small>${val} kcal</small></button></div>
        ${adj ? `<div class="fk-adj"><button data-mid="${m.id}" data-fkstep="-1" aria-label="100 kcal de moins">−</button><b>${val}<small>kcal</small></b><button data-mid="${m.id}" data-fkstep="1" aria-label="100 kcal de plus">+</button></div><span class="fk-note">Par défaut : la taille de l'un de tes plats</span>` : ''}
      </div>`;
}
function generatorHTML(plan) {
  const next = defaultNextWeek(plan);
  return `
    <div class="hb-field">
      <div class="hb-label">Pour quelle semaine ?</div>
      ${thisWeekOk() ? `<div class="hb-seg">
        <button class="hb-seg-btn ${!next ? 'on' : ''}" data-week="0">Cette semaine</button>
        <button class="hb-seg-btn ${next ? 'on' : ''}" data-week="1">Prochaine</button>
      </div>` : `<div class="hb-seg hb-seg-one"><button class="hb-seg-btn on" data-week="1">Semaine prochaine</button></div>`}
      <div class="week-note">${weekNote(next)}</div>
    </div>
    ${getMembers().map(m => `<div class="hb-field">
      <div class="hb-label">${getMembers().length > 1 ? `Repas libres de ${m.name || 'cette personne'}` : 'Repas libres'}</div>
      <div class="free-hint">Un repas que tu ne cuisines pas : restaurant, invitation, cantine.</div>
      <div class="free-caps" role="group" aria-label="Repas libres">
        ${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => `<div class="free-cap ${!next && i <= todayIdx() ? 'off' : ''}" data-fday="${i}"><span>${d}</span><div class="free-pill">${[['lunch', 'midi', ICON_SUN], ['dinner', 'soir', ICON_MOON]].map(([meal, lbl, ic]) => { const on = (m.free || []).includes(`${i}-${meal}`); return `<button class="free-cell ${on ? 'on' : ''}" data-mid="${m.id}" data-free="${i}-${meal}" aria-pressed="${on}" aria-label="${DAY_LONG[i]} ${lbl}">${ic}</button>`; }).join('')}</div></div>`).join('')}
      </div>
      <div class="free-leg"><span>${ICON_SUN} midi</span><span>${ICON_MOON} soir</span></div>
      ${freeKcalHTML(m)}
    </div>`).join('')}
    <div class="hb-field">
      <div class="hb-label">Protéines</div>
      <div class="protein-chips">
        ${PROTEINS.map(p => `<button class="prot-chip ${selProteins.includes(p.id) ? 'on' : ''}" data-p="${p.id}"><span class="prot-emoji"><img src="img/art/prot-${p.id}.webp" alt=""></span>${p.label}</button>`).join('')}
      </div>
    </div>
    <button class="hb-btn hb-btn-primary hb-generate">Générer ma semaine</button>`;
}
function bindGenerator(root, onDone) {
  let next = !!root.querySelector('.hb-seg-btn[data-week="1"].on');
  root.querySelectorAll('.hb-seg-btn').forEach(b => b.addEventListener('click', () => {
    next = b.dataset.week === '1';
    root.querySelectorAll('.hb-seg-btn').forEach(x => x.classList.toggle('on', x === b));
    const wn = root.querySelector('.week-note'); if (wn) wn.innerHTML = weekNote(next);
    root.querySelectorAll('.free-cap[data-fday]').forEach(c => c.classList.toggle('off', !next && +c.dataset.fday <= todayIdx()));
  }));
  const redrawFk = mid => {
    const box = root.querySelector(`[data-fkbox="${mid}"]`);
    if (box) box.outerHTML = freeKcalHTML(getMembers().find(x => x.id === mid));
  };
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-fk], [data-fkstep]');
    if (!b || !root.contains(b)) return;
    const m = getMembers().find(x => x.id === b.dataset.mid);
    if (b.dataset.fk === 'adj') updateMember(m.id, { freeKcalAdj: true });
    else if (b.dataset.fk) updateMember(m.id, { freeKcal: +b.dataset.fk, freeKcalAdj: false });
    else {
      const v = Math.min(2000, Math.max(300, ((m.freeKcal || 0) || usualFreeKcal(m)) + 100 * +b.dataset.fkstep));
      updateMember(m.id, { freeKcal: v, freeKcalAdj: true });
    }
    redrawFk(m.id);
  });
  root.querySelectorAll('.free-cell').forEach(b => b.addEventListener('click', () => {
    const key = b.dataset.free;
    const m = getMembers().find(x => x.id === b.dataset.mid);
    const free = m.free || [];
    updateMember(m.id, { free: free.includes(key) ? free.filter(x => x !== key) : [...free, key] });
    // calories réservées : visibles seulement s'il y a au moins un repas libre
    const box = root.querySelector(`[data-fkbox="${m.id}"]`);
    if (box) box.hidden = !(getMembers().find(x => x.id === m.id).free || []).length;
    b.classList.toggle('on');
    b.setAttribute('aria-pressed', b.classList.contains('on'));
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
      // un seul planning pour le foyer, des portions pour chacun
      const hadPlan = !!getActivePlan() || !!localStorage.getItem('hebe_served_mains');
      const members = getMembers().map(m => ({ id: m.id, targets: getTargetsFor(m), free: m.free || [], freeKcal: m.freeKcal || 0, formula: m.formula || 'jeune', breakfast: m.breakfast || 'mix', whey: m.whey !== false }));
      const { entriesBy } = generateWeek({ members, nextWeek: next, proteins: selProteins, startFrom: next ? 0 : todayIdx() + 1 });
      Object.entries(entriesBy).forEach(([mid, entries]) => Object.values(entries).forEach(en => saveEntry(en, mid)));
      onDone();
      showTutoOnce(hadPlan);
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
      ${morningRow(e.meals.breakfast || [])}
      <div class="dv-meals">${bigTile('Midi', lunch)}${bigTile('Soir', dinner)}</div>
      <div class="dv-swaps">${[['lunch', lunch], ['dinner', dinner]].map(([meal, items]) => {
        const r = items[0] && getById(items[0].id);
        if (!r) return '<span></span>';
        if ((r.tags || []).includes('imprevu')) {
          const lvl = OUTSIDE_LEVELS[e.outside?.[meal]?.level];
          return `<div class="dv-acts is-out"><span class="out-tag">Repas dehors${lvl ? `, ${lvl.label.toLowerCase()}, environ ${lvl.kcal} kcal` : ''}</span><button class="act-btn" data-undo="${meal}">Annuler</button></div>`;
        }
        if ((r.tags || []).includes('libre')) {
          const cant = items[0].kind === 'cantine';
          return `<div class="dv-acts dv-kind" role="radiogroup" aria-label="Type de repas libre">
            <button class="act-btn ${cant ? '' : 'on'}" data-kind="libre" data-kmeal="${meal}" role="radio" aria-checked="${!cant}">Repas libre</button>
            <button class="act-btn ${cant ? 'on' : ''}" data-kind="cantine" data-kmeal="${meal}" role="radio" aria-checked="${cant}">Cantine</button>
          </div>`;
        }
        if ((r.tags || []).includes('cantine')) return '<span></span>';
        return `<div class="dv-acts" data-acts="${meal}">
          <button class="act-btn" data-swap="${r.id}">Changer</button>
          <button class="act-btn" data-out="${meal}">Imprévu</button>
        </div>`;
      }).join('')}</div>
      ${extras.length ? `<div class="hb-label dv-extras-lbl">Collations</div><div class="dv-extras">${extras.map(smallTile).join('')}</div>` : ''}
      <div class="ds-grid">
        ${cell('Calories', m.kcal, T.kcal, '', 'k')}
        ${cell('Protéines', m.protein, T.protein, ' g', 'p')}
        ${cell('Glucides', m.carbs, T.carbs, ' g', 'c')}
        ${cell('Lipides', m.fat, T.fat, ' g', 'f')}
      </div>
      <details class="dv-qty">
        <summary>Quantités du jour <span>poids crus, 1 portion</span></summary>
        ${qtyBlock('Petit-déjeuner', e.meals.breakfast || [])}${qtyBlock('Midi', lunch)}${qtyBlock('Soir', dinner)}${qtyBlock('Collations', extras)}
      </details>
      <button class="hb-btn ds-close">Fermer</button>
    </div>`);
  const sheet = document.getElementById('sheet');
  sheet.querySelector('.ds-close')?.addEventListener('click', closeSheet);
  bindHearts(sheet);
  // Repas libre : préciser si c'est la cantine (les calories réservées ne changent pas)
  sheet.querySelectorAll('[data-kind]').forEach(b => b.addEventListener('click', () => {
    const en = getEntry(date), it = (en.meals[b.dataset.kmeal] || [])[0];
    if (!it) return;
    if (b.dataset.kind === 'cantine') it.kind = 'cantine'; else delete it.kind;
    saveEntry(en);
    closeSheet(); openDaySheet(date); renderWeek();
  }));
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
  sheet.querySelectorAll('[data-swap]').forEach(b => b.addEventListener('click', () => { closeSheet(); openSwapSheet(b.dataset.swap, date); }));
  sheet.querySelectorAll('[data-rid]').forEach(b => b.addEventListener('click', () => {
    closeSheet();
    renderRecipeDetail(getById(b.dataset.rid), 'week', plannedItem(date, b.dataset.rid));
  }));
}

const PROT_LBL = { poulet: 'Poulet', boeuf: 'Bœuf', poisson: 'Poisson', crevettes: 'Crevettes', tofu: 'Végé', vege: 'Végé' };
const proteinLabel = r => PROT_LBL[proteinFamily(r)] || '';
// v195 : « Changer » propose 3 plats au choix, et prévient si la liste de courses est déjà commencée
function openSwapSheet(oldId, date) {
  const old = getById(oldId);
  const plan = getActivePlan();
  const opts = replaceOptions(oldId, 3);
  if (!opts.length) { toast('Aucun autre plat disponible pour le moment', 'warn'); return; }
  const ckKey = 'diet_shopping_checked_' + (plan?.generatedAt || 'x');
  let nChecked = 0; try { nChecked = JSON.parse(localStorage.getItem(ckKey) || '[]').length; } catch {}
  const portions = plan.sessions.flatMap(s => s.recipes).find(r => r.id === oldId)?.portions || 0;
  const card = r => `<button class="sw-opt" data-pick="${r.id}">
      ${dishThumb(r, 'sw-img')}
      <span class="sw-txt"><b>${r.name}</b><small>${[(r.tags || []).map(t => CUISINES[t]).find(Boolean), proteinLabel(r)].filter(Boolean).join(' · ')}</small></span>
      <span class="hb-chev">›</span>
    </button>`;
  openSheet(`
    <div class="sheet-handle"></div>
    <div class="hb-sheet-pad">
      <div class="hb-h2">Remplacer ${shortName(oldId)}</div>
      <p class="sw-sub">Le plat choisi remplace les ${portions} boîtes de la session. Portions et courses se recalculent.</p>
      ${nChecked ? `<div class="sw-warn">Tu as déjà coché ${nChecked} produit${nChecked > 1 ? 's' : ''} dans ta liste de courses : la liste va changer pour ce plat, tes coches sont gardées.</div>` : ''}
      <div class="sw-list">${opts.map(card).join('')}</div>
      <button class="hb-btn sw-more">Autres idées</button>
      <button class="out-cancel sw-cancel">Garder ${shortName(oldId)}</button>
    </div>`);
  const sh = document.querySelector('.sheet') || document;
  sh.querySelector('.sw-more')?.addEventListener('click', () => { closeSheet(); openSwapSheet(oldId, date); });
  sh.querySelector('.sw-cancel')?.addEventListener('click', () => { closeSheet(); openDaySheet(date); });
  sh.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => {
    const kept = localStorage.getItem(ckKey);
    const next = replaceDish(oldId, b.dataset.pick);
    if (!next) { toast('Aucun autre plat disponible pour le moment', 'warn'); return; }
    // la liste de courses garde ce qui était déjà coché
    if (kept) localStorage.setItem('diet_shopping_checked_' + getActivePlan().generatedAt, kept);
    closeSheet(); renderWeek(); openDaySheet(date);
    toast(`${shortName(old.id)} remplacé par ${shortName(next.id)} pour toute la session`);
  }));
}

// ── v195 : la première semaine, 3 étapes pour comprendre comment ça marche ──
const TUTO_KEY = 'hebe_tuto_done';
function showTutoOnce(hadPlan = false) {
  try { if (localStorage.getItem(TUTO_KEY)) return; localStorage.setItem(TUTO_KEY, '1'); } catch { return; }
  if (hadPlan) return; // déjà utilisateur : pas de tutoriel
  const plan = getActivePlan(); if (!plan) return;
  const when = sessionWhen(plan);
  const today = when === "aujourd'hui";
  // l'onglet est montré tel qu'il apparaît dans la barre du bas : son icône et son nom
  const tab = (id, label) => `<span class="tuto-tab"><svg viewBox="0 0 24 24" aria-hidden="true">${NAV_SVGS[id]}</svg>${label}</span>`;
  const S = [
    ['Fais tes courses', tab('shopping', 'Courses'), `${today ? "Aujourd'hui" : 'La veille de ta session'}. Tout est calculé en paquets du magasin : coche au fur et à mesure.`],
    ['Cuisine ta session', tab('cook', 'Cuisiner'), `${today ? "Aujourd'hui" : capFirst(when)}. Une étape à la fois, avec les quantités et des minuteurs : tu remplis toutes tes boîtes de la semaine.`],
    ['Mange ce qui est affiché', tab('week', 'Semaine'), "Chaque jour, tu vois quoi manger. Un repas pris dehors ? Ouvre le détail du jour et choisis « Imprévu » : la journée se recalcule."],
  ];
  openSheet(`<div class="sheet-handle"></div><div class="hb-sheet-pad tuto">
    <div class="hb-h2">Ta semaine est prête</div>
    <p class="tuto-sub">Voici comment ça marche, en 3 temps.</p>
    <ol class="tuto-steps">${S.map(([t, tb, d], i) => `<li><span class="tuto-n">${i + 1}</span><div><div class="tuto-h"><b>${t}</b>${tb}</div><p>${d}</p></div></li>`).join('')}</ol>
    <button class="hb-btn hb-btn-primary tuto-ok">C'est parti</button>
  </div>`);
  document.querySelector('.tuto-ok')?.addEventListener('click', () => closeSheet());
}

// v195 : la portion prévue ce jour-là (quantités exactes sur la fiche recette)
function plannedItem(date, rid) {
  const e = getEntry(date);
  return Object.values(e.meals || {}).flat().find(it => it && it.id === rid) || null;
}

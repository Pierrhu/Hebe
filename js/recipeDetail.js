import { artFor } from '../data/photos.js';
import { proteinFamily, getExtras, setExtras } from '../data/recipes.js';
import { rebalanceAfterRecipeChange } from './weekgen.js';
import { humanQty, INGREDIENTS, NATURAL_UNITS, ingMacros } from '../data/ingredients.js';
import { getRating, setRating } from '../data/prefs.js';
import { photoUrl, rateClass, ICON_HEART, ICON_NOPE } from '../data/photos.js';
// recipeDetail.js — Détail recette avec ajustement des portions
// Le sélecteur de portions recalcule ingrédients ET macros en direct.

import { el, scaledMacros, openSheet, closeSheet, toast } from './utils.js';
import { getStaples, setDishStaple } from '../data/household.js';
import { stapleKind, isWhole } from './staples.js';
import { applyDiet } from './diet.js';
import { applyEquipment, getEquipment } from './adapt.js';

// Choix complet / classique sur la fiche, en mode « plat par plat » (Mon programme → Riz et pâtes)
function stapleBlock(recipe) {
  const kind = stapleKind(recipe);
  if (getStaples() !== 'plat' || !kind) return '';
  const whole = isWhole(recipe.id);
  const cooker = getEquipment()?.autocuiseur !== false;
  const R = kind === 'riz'
    ? { title: 'Riz de ce plat', a: 'Complet', b: 'Blanc',
        note: (cooker ? 'Le riz complet cuit 20 minutes sous pression, le blanc 5 minutes.' : 'Le riz complet cuit 35 minutes, le blanc 12 minutes.') + ' Les quantités et la liste de courses suivent ton choix.' }
    : { title: 'Pâtes de ce plat', a: 'Complètes', b: 'Classiques', note: 'Les quantités et la liste de courses suivent ton choix.' };
  return `<div class="rd-staple">
    <div class="dt-top"><b>${R.title}</b><span>Plat par plat</span></div>
    <div class="dt-seg" role="radiogroup" aria-label="${R.title}">
      <button class="dt-btn ${whole ? 'on' : ''}" data-staple="complet" role="radio" aria-checked="${whole}">${R.a}</button>
      <button class="dt-btn ${whole ? '' : 'on'}" data-staple="classique" role="radio" aria-checked="${!whole}">${R.b}</button>
    </div>
    <p class="dt-note">${R.note}</p>
  </div>`;
}

function rateHint(v) {
  if (v > 0) return '<span class="rate-chip like"><span class="rate-emoji">❤️</span>Tu aimes ce plat, il reviendra plus souvent</span>';
  if (v < 0) return '<span class="rate-chip nope"><span class="rate-emoji">👎</span>Plat écarté, il ne sera plus proposé</span>';
  return '';
}

// Origine du plat, lue dans ses tags
const CUISINES = {
  'thaï': 'Thaï', 'vietnamien': 'Vietnamien', 'japonais': 'Japonais', 'coréen': 'Coréen', 'chinois': 'Chinois',
  'indien': 'Indien', 'grec': 'Grec', 'turc': 'Turc', 'libanais': 'Libanais', 'marocain': 'Marocain',
  'mexicain': 'Mexicain', 'américain': 'Américain', 'péruvien': 'Péruvien', 'brésilien': 'Brésilien',
  'éthiopien': 'Éthiopien', 'mozambicain': 'Mozambicain', 'italien': 'Italien', 'moyen-orient': 'Moyen-Orient',
  'méditerranéen': 'Méditerranéen', 'scandinave': 'Scandinave', 'hongrois': 'Hongrois', 'russe': 'Russe', 'cubain': 'Cubain', 'sénégalais': 'Sénégalais', 'cajun': 'Cajun', 'français': 'Français',
};
const ICON_BACK = '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>';
const ICON_CLOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>';

export function renderRecipeDetail(recipe, fromView = 'recipes') {
  const app = document.getElementById('app');
  app.querySelector('.view')?.remove();

    const fam = proteinFamily(recipe);
  const cuisine = (recipe.tags || []).map(t => CUISINES[t]).find(Boolean);
  const view = el('div', `view detail-view rd fam-${fam} cat-${recipe.category}`);
  app.insertBefore(view, app.querySelector('#nav'));
  window.scrollTo(0, 0);

  function render() {
    const m = scaledMacros(recipe, 1);
    const kcalM = m.protein * 4 + m.carbs * 4 + m.fat * 9 || 1;
    const bar = v => Math.round(v / kcalM * 100);
    const photo = photoUrl(recipe.photo || recipe.id);

    view.innerHTML = `
      <div class="rd-hero ${photo ? '' : 'no-photo'} ${rateClass(recipe.id)}">
        ${photo ? `<img class="rd-photo" src="${photo}" alt="">` : artFor(recipe.id) ? `<div class="rd-art">${artFor(recipe.id)}</div>` : `<div class="rd-emoji">${recipe.emoji}</div>`}
        <button class="rd-round rd-back round-back" aria-label="Retour">${ICON_BACK}</button>
        <div class="rd-rate">
          <button class="rd-round fab like" data-v="1" aria-label="J'aime">${ICON_HEART}</button>
          <button class="rd-round fab nope" data-v="-1" aria-label="Pas pour moi">${ICON_NOPE}</button>
        </div>
      </div>

      <div class="rd-sheet">
        <div class="rd-tags">
          ${cuisine ? `<span class="rd-tag main">${cuisine}</span>` : ''}
          <span class="rd-tag">${ICON_CLOCK}${recipe.prepTime + recipe.cookTime ? recipe.prepTime + recipe.cookTime + ' min' : 'Sans cuisson'}</span>
          ${recipe.batch ? '<span class="rd-tag">Batch</span>' : ''}
        </div>
        <h1 class="rd-title">${recipe.name}</h1>
        <div class="rate-hint">${rateHint(getRating(recipe.id))}</div>

        <div class="rd-nutri">
          <div class="rd-kcal"><b>${m.kcal}</b><span>kcal</span></div>
          <div class="rd-macros">
            <div class="rd-m p"><b>${m.protein} g</b><span>Protéines</span><i style="--w:${bar(m.protein * 4)}%"></i></div>
            <div class="rd-m c"><b>${m.carbs} g</b><span>Glucides</span><i style="--w:${bar(m.carbs * 4)}%"></i></div>
            <div class="rd-m f"><b>${m.fat} g</b><span>Lipides</span><i style="--w:${bar(m.fat * 9)}%"></i></div>
          </div>
        </div>
        ${stapleBlock(recipe)}

        <section class="rd-sec">
          <div class="rd-sec-hd"><h2>Ingrédients</h2><span class="rd-raw">poids crus · 1 portion</span></div>
          <div class="rd-ings">
            ${recipe.ingredients.map((ing, k) => `
              <div class="rd-ing ${ing.extra ? 'extra' : ''}">
                <span class="rd-ing-name">${ing.name}${ing.extra ? '<em>ajouté</em>' : ''}</span>
                <span class="rd-ing-qty">${humanQty(ing.key, ing.qty, ing.unit, { cooked: true })}</span>
                ${ing.extra ? `<button class="rd-rm" data-rm="${ing.key}" aria-label="Retirer ${ing.name}">×</button>` : ''}
              </div>`).join('')}
          </div>
          <button class="rd-add">+ Ajouter un ingrédient</button>
        </section>

        <section class="rd-sec">
          <div class="rd-sec-hd"><h2>Préparation</h2></div>
          <ol class="rd-steps">
            ${recipe.steps.map((st, i) => `<li><span class="rd-num">${i + 1}</span><p>${st}</p></li>`).join('')}
          </ol>
        </section>

        ${recipe.tip ? `<div class="rd-tip"><div class="rd-tip-h">L'astuce</div><p>${recipe.tip}</p></div>` : ''}
      </div>
    `;

    view.querySelector('.rd-back').addEventListener('click', () => window._nav?.(fromView));
    view.querySelectorAll('[data-staple]').forEach(b => b.addEventListener('click', () => {
      setDishStaple(recipe.id, b.dataset.staple); applyEquipment(); applyDiet();
      const y = window.scrollY; render(); window.scrollTo(0, y);
    }));
    view.querySelectorAll('.fab').forEach(btn => btn.addEventListener('click', () => {
      const v = setRating(recipe.id, +btn.dataset.v);
      const hero = view.querySelector('.rd-hero');
      hero.classList.toggle('is-liked', v > 0);
      hero.classList.toggle('is-nope', v < 0);
      btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop');
      view.querySelector('.rate-hint').innerHTML = rateHint(v);
    }));
    view.querySelector('.rd-add').addEventListener('click', () => openAddSheet(recipe, () => {
      const y = window.scrollY; render(); window.scrollTo(0, y);
    }));
    view.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => {
      setExtras(recipe.id, getExtras(recipe.id).filter(e => e.key !== b.dataset.rm));
      const days = rebalanceAfterRecipeChange(recipe.id);
      const y = window.scrollY; render(); window.scrollTo(0, y);
      toast(days ? 'Ingrédient retiré. Tes collations ont été réajustées.' : 'Ingrédient retiré de la recette.');
    }));
  }

  render();
}

// ── Ajouter un ingrédient à une recette ──
const QUICK = ['oeuf', 'emmental', 'feta', 'parmesan', 'avocat', 'carre_frais', 'yaourt_grec', 'poulet_tranches',
  'thon', 'pois_chiches', 'riz', 'pain', 'houmous', 'cacahuetes'];
const HIDDEN = new Set(['repas_ext', 'feculents_cuits', 'epices', 'herbes', 'bouillon', 'levure', 'fecule']);
function qtyRule(key) {
  const db = INGREDIENTS[key], nu = NATURAL_UNITS[key];
  if (nu) return { start: nu.g, step: nu.g };
  if (db.unit === 'pièce') return { start: 1, step: 1 };
  if (db.unit === 'ml') return { start: 15, step: 5 };
  if (['fat', 'dairy', 'flavor'].includes(db.role)) return { start: 20, step: 5 };
  return { start: 50, step: 10 };
}
function openAddSheet(recipe, onDone) {
  const all = Object.keys(INGREDIENTS).filter(k => !HIDDEN.has(k) && INGREDIENTS[k].role !== 'other')
    .sort((a, b) => INGREDIENTS[a].name.localeCompare(INGREDIENTS[b].name, 'fr'));
  openSheet(`
    <div class="sheet-handle"></div>
    <div class="hb-sheet-pad add-sheet">
      <div class="hb-h2">Ajouter à la recette</div>
      <p class="hb-p">L'ajout est gardé pour ce plat : il compte dans tes calories, tes courses et tes quantités à cuisiner.</p>
      <input class="search-bar add-search" placeholder="Chercher un ingrédient…">
      <div class="add-list"></div>
      <div class="add-pick" hidden></div>
    </div>`);
  const sheet = document.getElementById('sheet');
  const list = sheet.querySelector('.add-list'), pick = sheet.querySelector('.add-pick'), search = sheet.querySelector('.add-search');
  const showList = q => {
    const keys = q ? all.filter(k => INGREDIENTS[k].name.toLowerCase().includes(q.toLowerCase())) : QUICK.filter(k => INGREDIENTS[k]);
    list.innerHTML = (q ? '' : '<div class="add-h">Les plus utiles</div>') +
      keys.slice(0, 30).map(k => `<button class="add-item" data-k="${k}">${INGREDIENTS[k].name}</button>`).join('') +
      (keys.length ? '' : '<div class="add-none">Aucun ingrédient trouvé</div>');
    list.querySelectorAll('.add-item').forEach(b => b.addEventListener('click', () => choose(b.dataset.k)));
  };
  const choose = key => {
    const rule = qtyRule(key);
    let qty = (getExtras(recipe.id).find(e => e.key === key)?.qty) || rule.start;
    list.hidden = true; search.hidden = true; pick.hidden = false;
    const draw = () => {
      const m = ingMacros(key, qty);
      pick.innerHTML = `
        <div class="add-name">${INGREDIENTS[key].name}</div>
        <div class="add-qty">
          <button class="serv-sel-btn" data-d="-1" aria-label="Moins">−</button>
          <b>${humanQty(key, qty, INGREDIENTS[key].unit)}</b>
          <button class="serv-sel-btn" data-d="1" aria-label="Plus">+</button>
        </div>
        <div class="add-macro">+${Math.round(m.kcal)} kcal · ${Math.round(m.protein)} g prot. · ${Math.round(m.carbs)} g gluc. · ${Math.round(m.fat)} g lip.</div>
        <button class="hb-btn hb-btn-primary add-ok">Ajouter à la recette</button>
        <button class="add-back">Choisir un autre ingrédient</button>`;
      pick.querySelectorAll('[data-d]').forEach(b => b.addEventListener('click', () => { qty = Math.max(rule.step, qty + rule.step * +b.dataset.d); draw(); }));
      pick.querySelector('.add-back').addEventListener('click', () => { pick.hidden = true; list.hidden = false; search.hidden = false; });
      pick.querySelector('.add-ok').addEventListener('click', () => {
        setExtras(recipe.id, [...getExtras(recipe.id).filter(e => e.key !== key), { key, qty }]);
        const days = rebalanceAfterRecipeChange(recipe.id);
        closeSheet(); onDone();
        const what = `${humanQty(key, qty, INGREDIENTS[key].unit)} ${INGREDIENTS[key].name.toLowerCase()}`;
        toast(days
          ? `${what} ajouté${qty > 1 && INGREDIENTS[key].unit === 'pièce' ? 's' : ''}. Tes collations ont été ajustées pour rester dans ton objectif.`
          : `${what} ajouté${qty > 1 && INGREDIENTS[key].unit === 'pièce' ? 's' : ''} à la recette (+${Math.round(m.kcal)} kcal).`);
      });
    };
    draw();
  };
  search.addEventListener('input', () => showList(search.value.trim()));
  showList('');
}

import { dietOk } from './diet.js';
import { state, setState } from './state.js';
import { getActiveMember } from '../data/household.js';
import { RECIPES, proteinFamily, hasWhey } from '../data/recipes.js';
import { dishThumb, dishThumbRated } from '../data/photos.js';
import { getRating } from '../data/prefs.js';
import { el }              from './utils.js';
import { renderRecipeDetail } from './recipeDetail.js';
import { portionFor } from './weekgen.js';
import { itemMacros } from './utils.js';

const FILTERS = [
  { key: 'all',    label: 'Tout'        },
  { key: 'main',   label: 'Plats'       },
  { key: 'breakfast', label: 'Petits-déjeuners' },
  { key: 'sweet',  label: 'Collations'  },
  { key: 'side',   label: 'Compléments' },
];

const PROT_FILTERS = [
  { key: 'all',        label: 'Toutes', emoji: '' },
  { key: 'poulet',     label: 'Poulet', emoji: '🍗' },
  { key: 'boeuf',      label: 'Bœuf', emoji: '🥩' },
  { key: 'saumon',     label: 'Poisson', emoji: '🐟' },
  { key: 'crevettes',  label: 'Crevettes', emoji: '🦐' },
  { key: 'tofu',       label: 'Végé', emoji: '🌱' },
];

const TASTES = [
  { key: 'all',   label: 'Tout' },
  { key: 'sucre', label: 'Sucré' },
  { key: 'sale',  label: 'Salé' },
];
const recipeProtein = proteinFamily;

export function renderRecipes() {
  const app = document.getElementById('app');
  app.querySelector('.view')?.remove();

  const view = el('div', 'view recipes-view');

  // onglet à part entière : un titre, comme Cuisiner et Courses
  const head = el('div', 'hb-tab-head', `<div class="hb-page-title">Recettes</div>`);
  view.appendChild(head);
  const top = el('div', 'recipes-top');
  const search = el('input', 'search-bar');
  search.placeholder = 'Rechercher une recette…';
  search.value = state.searchQuery || '';

  // Deux menus déroulants : catégorie et protéine
  const activeProt = state.filterProtein || 'all';
  const activeCat = state.filterCategory || 'all';
  const activeTaste = state.filterTaste || 'all';
  const opt = (list, cur) => list.map(f => `<option value="${f.key}" ${cur === f.key ? 'selected' : ''}>${f.label}</option>`).join('');
  const filters = el('div', 'rc-filters', `
    <label class="rc-select ${activeCat !== 'all' ? 'on' : ''}"><span>Catégorie</span><select data-f="cat">${opt(FILTERS, activeCat)}</select></label>
    <label class="rc-select ${activeProt !== 'all' ? 'on' : ''}"><span>Protéine</span><select data-f="prot">${opt(PROT_FILTERS, activeProt)}</select></label>
    <label class="rc-select ${activeTaste !== 'all' ? 'on' : ''}"><span>Goût</span><select data-f="taste">${opt(TASTES, activeTaste)}</select></label>`);
  filters.querySelectorAll('select').forEach(sel => sel.addEventListener('change', () => {
    setState(sel.dataset.f === 'cat' ? { filterCategory: sel.value } : sel.dataset.f === 'taste' ? { filterTaste: sel.value } : { filterProtein: sel.value });
    sel.closest('.rc-select').classList.toggle('on', sel.value !== 'all');
    renderList(search.value);
  }));
  const count = el('div', 'rc-count');

  top.appendChild(search);
  top.appendChild(filters);
  top.appendChild(count);
  view.appendChild(top);

  const list = el('div', 'recipe-list');
  view.appendChild(list);

  function renderList(query) {
    const cat = state.filterCategory || 'all';
    const prot = state.filterProtein || 'all';
    const noWhey = getActiveMember().whey === false;
    const filtered = RECIPES.filter(r => {
      // ni accompagnements retirés, ni repas libres ou cantine, et une seule version de chaque recette (avec ou sans whey)
      if (r.retired || r.category === 'extra' || (r.tags || []).includes('cantine')) return false;
      if (noWhey ? hasWhey(r) : (r.tags || []).includes('sans-whey')) return false;
      if (!dietOk(r, getActiveMember().lactose || 0, getActiveMember().gluten || 0)) return false;
      const matchCat = !(r.tags || []).includes('imprevu') && (cat === 'all' || r.category === cat || (cat === 'main' && (r.category === 'dinner' || r.category === 'lunch') && !(r.tags || []).includes('cantine')));
      const matchProt = prot === 'all' || recipeProtein(r) === prot;
      const sweet = (r.tags || []).includes('sucré');
      const taste = state.filterTaste || 'all';
      const matchTaste = taste === 'all' || (taste === 'sucre' ? sweet : !sweet);
      const matchQ   = r.name.toLowerCase().includes(query.toLowerCase()) ||
                       r.tags?.some(t => t.includes(query.toLowerCase()));
      return matchCat && matchProt && matchTaste && matchQ;
    });

    count.textContent = `${filtered.length} recette${filtered.length > 1 ? 's' : ''}`;
    list.innerHTML = filtered.length ? filtered.map(r => `
      <div class="recipe-card fam-${recipeProtein(r)} cat-${r.category}" data-id="${r.id}">
        ${dishThumbRated(r, 'rc')}
        <div class="rc-info">
          <div class="rc-name">${r.name}</div>
          <div class="rc-meta">${(mm => `${Math.round(mm.kcal)} kcal · ${Math.round(mm.protein)} g prot.`)(myMacros(r))} · ${r.prepTime + r.cookTime} min</div>
        </div>
        <span class="rc-arrow">›</span>
      </div>`).join('') : '<div class="no-results">Aucune recette trouvée.</div>';

    list.querySelectorAll('.recipe-card').forEach(card => {
      card.addEventListener('click', () => {
        const recipe = RECIPES.find(r => r.id === card.dataset.id);
        if (recipe) renderRecipeDetail(recipe, 'recipes');
      });
    });
  }

  renderList(state.searchQuery || '');
  search.addEventListener('input', e => { setState({ searchQuery: e.target.value }); renderList(e.target.value); });

  app.insertBefore(view, app.querySelector('#nav'));
}

// v195 : calories de ta portion réelle (celle de ta semaine, sinon calculée pour toi), gardées en mémoire le temps d'une visite
const MY_MACROS = new Map();
function myMacros(r) {
  const key = r.id + '|' + (localStorage.getItem('hebe_week_plan') || '').length;
  if (!MY_MACROS.has(key)) { const pf = portionFor(r.id); MY_MACROS.set(key, pf ? itemMacros(pf.item) : r.macros); }
  return MY_MACROS.get(key);
}

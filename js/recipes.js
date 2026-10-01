import { state, setState } from './state.js';
import { RECIPES, proteinFamily } from '../data/recipes.js';
import { dishThumb, dishThumbRated } from '../data/photos.js';
import { getRating } from '../data/prefs.js';
import { el }              from './utils.js';
import { renderRecipeDetail } from './recipeDetail.js';

const FILTERS = [
  { key: 'all',    label: 'Tout'        },
  { key: 'main',   label: 'Plats'       },
  { key: 'sweet',  label: 'Collations'  },
  { key: 'side',   label: 'Compléments' },
  { key: 'starter',label: 'Entrées'     },
];

const PROT_FILTERS = [
  { key: 'all',        label: 'Toutes', emoji: '' },
  { key: 'poulet',     label: 'Poulet', emoji: '🍗' },
  { key: 'boeuf',      label: 'Bœuf', emoji: '🥩' },
  { key: 'dinde',      label: 'Dinde', emoji: '🦃' },
  { key: 'saumon',     label: 'Poisson', emoji: '🐟' },
  { key: 'crevettes',  label: 'Crevettes', emoji: '🦐' },
  { key: 'tofu',       label: 'Végé', emoji: '🌱' },
];

const recipeProtein = proteinFamily;

export function renderRecipes() {
  const app = document.getElementById('app');
  app.querySelector('.view')?.remove();

  const view = el('div', 'view recipes-view');

  const head = el('div', 'hb-subhead', `<button class="hb-back">‹ Semaine</button><div class="hb-page-title">Recettes</div>`);
  head.querySelector('.hb-back').addEventListener('click', () => window._nav?.('week'));
  view.appendChild(head);
  const top = el('div', 'recipes-top');
  const search = el('input', 'search-bar');
  search.placeholder = 'Rechercher une recette…';
  search.value = state.searchQuery || '';

  const tabs = el('div', 'filter-tabs');
  FILTERS.forEach(f => {
    const btn = el('button', `tab-btn ${state.filterCategory === f.key ? 'active' : ''}`, f.label);
    btn.addEventListener('click', () => { setState({ filterCategory: f.key }); renderRecipes(); });
    tabs.appendChild(btn);
  });

  // Filtre par protéine
  const protTabs = el('div', 'prot-filter-tabs');
  const activeProt = state.filterProtein || 'all';
  PROT_FILTERS.forEach(f => {
    const btn = el('button', `prot-filter-btn ${activeProt === f.key ? 'active' : ''}`);
    btn.innerHTML = `${f.emoji ? `<span class="pf-emoji">${f.emoji}</span>` : ''}${f.label}`;
    btn.addEventListener('click', () => { setState({ filterProtein: f.key }); renderRecipes(); });
    protTabs.appendChild(btn);
  });

  top.appendChild(search);
  top.appendChild(tabs);
  top.appendChild(protTabs);
  view.appendChild(top);

  const list = el('div', 'recipe-list');
  view.appendChild(list);

  function renderList(query) {
    const cat = state.filterCategory;
    const prot = state.filterProtein || 'all';
    const filtered = RECIPES.filter(r => {
      const matchCat = !(r.tags || []).includes('imprevu') && (cat === 'all' || r.category === cat || (cat === 'main' && (r.category === 'dinner' || r.category === 'lunch') && !(r.tags || []).includes('cantine')));
      const matchProt = prot === 'all' || recipeProtein(r) === prot;
      const matchQ   = r.name.toLowerCase().includes(query.toLowerCase()) ||
                       r.tags?.some(t => t.includes(query.toLowerCase()));
      return matchCat && matchProt && matchQ;
    });

    list.innerHTML = filtered.length ? filtered.map(r => `
      <div class="recipe-card fam-${recipeProtein(r)} cat-${r.category}" data-id="${r.id}">
        ${dishThumbRated(r, 'rc')}
        <div class="rc-info">
          <div class="rc-name">${r.name}</div>
          <div class="rc-meta">${r.macros.kcal} kcal · ${r.macros.protein} g prot. · ${r.prepTime + r.cookTime} min</div>
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

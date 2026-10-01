import { state, setState } from './state.js';
import { renderNav }       from './nav.js';
import { renderWeek }      from './week.js';
import { renderCook }      from './cook.js';
import { renderRecipes }   from './recipes.js';
import { renderShopping }  from './shopping.js';
import { renderSettings }  from './settings.js';

const VIEWS = {
  week:     renderWeek,
  cook:     renderCook,
  shopping: renderShopping,
  recipes:  renderRecipes,
  settings: renderSettings,
};

function navigate(view) { setState({ currentView: view }); render(); }

function render() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  (VIEWS[state.currentView] || renderWeek)();
  renderNav();
}

window._nav = navigate;
document.addEventListener('DOMContentLoaded', render);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});

import { applyDiet } from './diet.js';
import { state, setState } from './state.js';
import { renderNav }       from './nav.js';
import { renderWeek }      from './week.js';
import { renderCook }      from './cook.js';
import { renderRecipes }   from './recipes.js';
import { renderShopping }  from './shopping.js';
import { renderSettings }  from './settings.js';
import { renderWelcome }   from './welcome.js';
import { renderWeight }    from './weight.js';
import { isOnboarded }     from '../data/household.js';
import { applyEquipment }  from './adapt.js';

const VIEWS = {
  week:     renderWeek,
  cook:     renderCook,
  shopping: renderShopping,
  recipes:  renderRecipes,
  settings: renderSettings,
  weight:   renderWeight,
};

// changer d'onglet ou de page ramène toujours en haut
function navigate(view) { setState({ currentView: view }); render(); window.scrollTo(0, 0); }

function render() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  applyEquipment(); // recettes adaptées à l'équipement du foyer
  applyDiet();      // puis au régime (lactose)
  // premier lancement : on fait connaissance avant tout le reste
  if (!isOnboarded()) { renderWelcome(() => { setState({ currentView: 'week' }); render(); window.scrollTo(0, 0); }); return; }
  (VIEWS[state.currentView] || renderWeek)();
  renderNav();
  keepAwake(state.currentView === 'cook');
}

// v195 : l'écran reste allumé pendant la session de cuisine (si le téléphone le permet)
let wakeLock = null, wantAwake = false;
async function keepAwake(on) {
  wantAwake = on;
  try {
    if (on && !wakeLock && 'wakeLock' in navigator) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener?.('release', () => { wakeLock = null; }); }
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { wakeLock = null; }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && wantAwake) keepAwake(true); });

window._nav = navigate;
document.addEventListener('DOMContentLoaded', render);
// Mise à jour automatique : on vérifie s'il existe une nouvelle version à chaque ouverture,
// et la page se recharge toute seule (une fois) dès qu'elle est installée. Les données restent intactes.
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return; // première installation : rien à recharger
    reloaded = true;
    window.location.reload();
  });
  navigator.serviceWorker.register('./sw.js').then(reg => reg.update()).catch(() => {});
}

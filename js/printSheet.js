// printSheet.js — v311 : fiche recette à imprimer ou à enregistrer en PDF (Pierre : « une fiche à imprimer ultra
// sympa, design, dans le style de l'app, que l'on peut télécharger »). Une page A4 : photo, titre, repères
// (portions, temps, calories), ingrédients à cocher, étapes numérotées, mise en boîtes et réchauffage, astuce.
// La fiche suit les quantités affichées (1 portion ou toute la semaine). Impression du navigateur : « Enregistrer
// en PDF » sur ordinateur, « Imprimer » puis partager en PDF sur téléphone.
import { qtyShort, spicesOf, spiceList, fillSpices, weekText } from '../data/ingredients.js';
import { photoUrl } from '../data/photos.js';
import { proteinFamily } from '../data/recipes.js';

// espaces insécables des guillemets et de la ponctuation double, comme en typographie française
const psEsc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/« /g, '«\u00a0').replace(/ (»|:|;|\?|!)/g, '\u00a0$1');
const LATER = /^(Mise en boîtes|Au moment de manger) : /;

// opt : { W: nombre de portions, qty(k) : quantité de l'ingrédient k, m : macros par portion, cuisine, mine }
export function printRecipe(recipe, opt) {
  const { W = 1, qty, m, cuisine = '', mine = false } = opt;
  const fam = recipe.category === 'sweet' || recipe.category === 'breakfast' ? 'sweet' : proteinFamily(recipe);
  const photo = photoUrl(recipe.photo || recipe.id);
  const txt = st => psEsc(weekText(fillSpices(st, recipe.id, W), W));
  const steps = recipe.steps.filter(st => !LATER.test(st)).map(st => st.replace(/^Pendant la session de cuisine, (.)/, (_, c) => c.toUpperCase()));
  const box = recipe.steps.filter(st => /^Mise en boîtes : /.test(st)).map(st => st.replace(/^Mise en boîtes : /, ''));
  const eat = recipe.steps.filter(st => /^Au moment de manger : /.test(st)).map(st => st.replace(/^Au moment de manger : /, ''));
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const ings = recipe.ingredients.map((g, k) => {
    const q = qty(k);
    if (!(q > 0)) return '';
    if (g.key === 'epices' && spicesOf(recipe.id)) {
      return `<li class="ps-ing ps-sp"><span class="ps-box"></span><span class="ps-n">Épices</span>
        <ul>${spiceList(recipe.id, W).split(', ').map(s => `<li>${psEsc(s)}</li>`).join('')}</ul></li>`;
    }
    return `<li class="ps-ing"><span class="ps-box"></span><span class="ps-n">${psEsc(g.name)}</span><span class="ps-dots"></span><span class="ps-q">${psEsc(qtyShort(g.key, q, g.unit))}</span></li>`;
  }).join('');
  const time = recipe.prepTime + recipe.cookTime;
  const fridge = (recipe.tags || []).find(t => /^frigo-\d/.test(t));
  const len = recipe.steps.join(' ').length;
  const size = len > 1900 || recipe.ingredients.length > 13 ? ' ps-long' : len < 1100 && recipe.ingredients.length <= 10 ? ' ps-short' : '';

  const root = document.createElement('div');
  root.id = 'print-root';
  root.className = `ps ps-${fam}${size}`;
  root.innerHTML = `
    <article class="ps-page">
      <header class="ps-head">
        ${photo ? `<div class="ps-photo"><img src="${photo}" alt=""></div>` : `<div class="ps-photo ps-emoji">${recipe.emoji || ''}</div>`}
        <div class="ps-intro">
          <div class="ps-brand">Héb<span>é</span></div>
          ${cuisine ? `<div class="ps-kicker">${psEsc(cuisine)}</div>` : ''}
          <h1>${psEsc(recipe.name)}</h1>
          <dl class="ps-facts">
            <div><dt>${W > 1 ? 'Portions' : 'Pour'}</dt><dd>${W > 1 ? W : (mine ? 'ta portion' : '1 portion')}</dd></div>
            ${time ? `<div><dt>Temps</dt><dd>${time} min</dd></div>` : ''}
            <div><dt>Par portion</dt><dd>${m.kcal} kcal</dd></div>
            ${fridge ? `<div><dt>Frigo</dt><dd>${fridge.slice(6)} jours</dd></div>` : ''}
          </dl>
          <div class="ps-macros">
            <span><b>${m.protein} g</b> protéines</span><span><b>${m.carbs} g</b> glucides</span><span><b>${m.fat} g</b> lipides</span>
          </div>
        </div>
      </header>
      <div class="ps-body">
        <section class="ps-ings">
          <h2>Ingrédients</h2>
          <p class="ps-sub">${W > 1 ? `pour ${W} portions` : 'pour 1 portion'} · poids crus</p>
          <ul>${ings}</ul>
        </section>
        <section class="ps-steps">
          <h2>Préparation</h2>
          <ol>${steps.map(st => `<li><span class="ps-num"></span><p>${txt(st)}</p></li>`).join('')}</ol>
          ${box.length || eat.length ? `<div class="ps-after">
            ${box.length ? `<div class="ps-card"><h3>Mise en boîtes</h3><p>${box.map(s => txt(cap(s))).join(' ')}</p></div>` : ''}
            ${eat.length ? `<div class="ps-card"><h3>Au moment de manger</h3><p>${eat.map(s => txt(cap(s))).join(' ')}</p></div>` : ''}
          </div>` : ''}
          ${recipe.tip ? `<p class="ps-tip"><span>L'astuce</span>${psEsc(recipe.tip)}</p>` : ''}
        </section>
      </div>
      <footer class="ps-foot"><span>Bien manger sans y penser</span><span>hebe-app.fr</span></footer>
    </article>`;

  document.getElementById('print-root')?.remove();
  document.body.appendChild(root);
  document.body.classList.add('printing');
  const title = document.title;
  document.title = `Hébé · ${recipe.short || recipe.name}`; // nom proposé pour le PDF
  const done = () => { document.body.classList.remove('printing'); root.remove(); document.title = title; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  const img = root.querySelector('img');
  const go = () => setTimeout(() => window.print(), 60);
  if (img && !img.complete) { img.addEventListener('load', go, { once: true }); img.addEventListener('error', go, { once: true }); } else go();
}

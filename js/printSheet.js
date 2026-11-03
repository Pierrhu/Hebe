// printSheet.js — v311 : fiche recette à imprimer ou à enregistrer en PDF (Pierre : « une fiche à imprimer ultra
// sympa, design, dans le style de l'app, que l'on peut télécharger »). Une page A4 : photo, titre, repères
// (portions, temps, calories), ingrédients à cocher, étapes numérotées, mise en boîtes et réchauffage, astuce.
// La fiche suit les quantités affichées (1 portion ou toute la semaine).
// v312 : le bouton télécharge directement le PDF (Pierre : « faut juste que ça télécharge le pdf ») : la page est
// dessinée hors écran, photographiée (html2canvas) et mise dans un PDF A4 (jsPDF), deux bibliothèques chargées
// seulement au premier clic (js/vendor/). Dans l'appli installée sur iPhone, où un téléchargement ne s'enregistre
// pas, le PDF passe par le menu de partage (« Enregistrer dans Fichiers »).
import { qtyShort, spicesOf, spiceList, fillSpices, weekText } from '../data/ingredients.js';
import { photoUrl } from '../data/photos.js';
import { proteinFamily } from '../data/recipes.js';

// espaces insécables des guillemets et de la ponctuation double, comme en typographie française
const psEsc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/« /g, '«\u00a0').replace(/ (»|:|;|\?|!)/g, '\u00a0$1');
const LATER = /^(Mise en boîtes|Au moment de manger) : /;

// opt : { W: nombre de portions, qty(k) : quantité de l'ingrédient k, m : macros par portion, cuisine, mine }
export async function printRecipe(recipe, opt) {
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
          <ol>${steps.map((st, i) => `<li><svg class="ps-num" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="10"/><text x="10" y="10.5" text-anchor="middle" dominant-baseline="middle">${i + 1}</text></svg><p>${txt(st)}</p></li>`).join('')}</ol>
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
  try {
    await Promise.all([loadScript('js/vendor/html2canvas-1.4.1.min.js'), loadScript('js/vendor/jspdf-2.5.1.min.js')]);
    await document.fonts?.ready;
    const img = root.querySelector('img');
    if (img && !img.complete) await new Promise(res => { img.onload = res; img.onerror = res; });
    const page = root.querySelector('.ps-page');
    const canvas = await window.html2canvas(page, { scale: 2.5, backgroundColor: '#ffffff', useCORS: true, logging: false });
    const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', compress: true });
    // une page A4 : la fiche y tient en largeur ; une fiche plus haute est réduite pour tenir sur la page
    let w = 210, h = canvas.height * 210 / canvas.width;
    if (h > 297) { w = 297 * canvas.width / canvas.height; h = 297; }
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.93), 'JPEG', (210 - w) / 2, 0, w, h);
    const name = `Hébé - ${(recipe.short || recipe.name).replace(/[\\/:*?"<>|]/g, '')}${W > 1 ? ` - ${W} portions` : ''}.pdf`;
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const standalone = window.navigator.standalone || window.matchMedia?.('(display-mode: standalone)').matches;
    const file = new File([pdf.output('blob')], name, { type: 'application/pdf' });
    if (ios && standalone && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); } catch (e) { if (e?.name !== 'AbortError') throw e; }
    } else {
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
  } finally {
    root.remove();
  }
}

// Charge une bibliothèque une seule fois
const LOADED = {};
function loadScript(src) {
  return LOADED[src] ||= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => { delete LOADED[src]; rej(new Error('script ' + src)); };
    document.head.appendChild(s);
  });
}

import { getById } from '../data/recipes.js';

export function el(tag, cls = '', html = '') {
  const node = document.createElement(tag);
  if (cls)  node.className = cls;
  if (html) node.innerHTML = html;
  return node;
}

export function formatDate(isoDate) {
  return new Date(isoDate + 'T12:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

export function formatDateShort(isoDate) {
  return new Date(isoDate + 'T12:00:00').toLocaleDateString('fr-FR', {
    weekday: 'short', day: 'numeric',
  });
}

export function mbar(value, target, color, overThreshold = 1.08) {
  const pct = Math.min((value / target) * 100, 100).toFixed(1);
  const over = value > target * overThreshold;
  return `<div class="mbar-wrap"><div class="mbar ${over ? 'over' : ''}" style="width:${pct}%;background:${over ? 'var(--danger)' : color}"></div></div>`;
}

// Anneau de progression calorique (SVG donut). Pièce maîtresse visuelle des écrans Jour & Macros.
// value/target en kcal. Affiche le chiffre au centre + la cible dessous.
export function kcalRing(value, target, opts = {}) {
  const size = opts.size || 168;
  const sw = opts.stroke || 13;
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const ratio = Math.max(0, Math.min(value / target, 1));
  const over = value > target * 1.08;
  const dash = (ratio * c).toFixed(1);
  const pct = Math.round((value / target) * 100);
  const stroke = over ? 'var(--danger)' : 'url(#hbRingGrad)';
  const cx = size / 2;
  return `
    <div class="kcal-ring-wrap" style="width:${size}px;height:${size}px">
      <svg class="kcal-ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
        <defs>
          <linearGradient id="hbRingGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#A9C2B2"/>
            <stop offset="100%" stop-color="#6E8B76"/>
          </linearGradient>
        </defs>
        <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="var(--s3)" stroke-width="${sw}"/>
        <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${stroke}" stroke-width="${sw}"
          stroke-linecap="round" stroke-dasharray="${dash} ${c.toFixed(1)}"
          transform="rotate(-90 ${cx} ${cx})" class="kcal-ring-arc"/>
      </svg>
      <div class="kcal-ring-center">
        <div class="kcal-ring-val ${over ? 'over' : ''}">${Math.round(value)}</div>
        <div class="kcal-ring-sub">/ ${target} kcal</div>
        <div class="kcal-ring-pct ${over ? 'over' : ''}">${pct}%</div>
      </div>
    </div>`;
}

// Macros d'une recette × servings, arrondis
// Macros d'un plat : tient compte des overrides (quantités d'ingrédients ajustées en g).
// item = { id, servings, overrides? : { ingIndex: qtyGrams } }
export function itemMacros(item) {
  const r = getById(item.id);
  if (!r) return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const ov = item.overrides;
  const s = item.servings || 1;
  if (!ov) {
    // pas d'overrides : simple multiplication par les portions
    return {
      kcal:    r.macros.kcal    * s,
      protein: r.macros.protein * s,
      carbs:   r.macros.carbs   * s,
      fat:     r.macros.fat     * s,
    };
  }
  // overrides présents : on recalcule ingrédient par ingrédient
  return r.ingredients.reduce((acc, ing, idx) => {
    const q = ing.qty || 1;
    const qty = (ov[idx] != null ? ov[idx] : ing.qty * s);
    acc.kcal    += (ing.kcal    / q) * qty;
    acc.protein += (ing.protein / q) * qty;
    acc.carbs   += (ing.carbs   / q) * qty;
    acc.fat     += (ing.fat     / q) * qty;
    return acc;
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });
}

export function scaledMacros(recipe, servings = 1) {
  return {
    kcal:    Math.round(recipe.macros.kcal    * servings),
    protein: Math.round(recipe.macros.protein * servings),
    carbs:   Math.round(recipe.macros.carbs   * servings),
    fat:     Math.round(recipe.macros.fat     * servings),
  };
}

// Total d'un jour : meals = { slot: [{id, servings, overrides?}] }
export function computeDayMacros(entry) {
  const slots = ['starter', 'lunch', 'dinner', 'sides', 'sweet'];
  return slots.reduce((acc, slot) => {
    (entry.meals[slot] || []).forEach(item => {
      const m = itemMacros(item);
      acc.kcal += m.kcal; acc.protein += m.protein; acc.carbs += m.carbs; acc.fat += m.fat;
    });
    return acc;
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });
}

export function openSheet(html, onClose) {
  const overlay = el('div', 'overlay');
  overlay.innerHTML = `<div class="sheet" id="sheet">${html}</div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeSheet(); });
  if (onClose) overlay._onClose = onClose;
}

export function closeSheet() {
  const o = document.querySelector('.overlay');
  if (o) { o._onClose?.(); o.remove(); }
}

// Message bref en bas de l'écran (confirmation d'une action)
export function toast(msg) {
  document.querySelector('.toast')?.remove();
  const t = el('div', 'toast', msg);
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('out'), 2600);
  setTimeout(() => t.remove(), 3000);
}

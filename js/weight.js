// weight.js — v195 : fiche « Mon poids » (pesée de la semaine, courbe, passage à l'étape suivante).
// Historique par personne : hebe_weights = { id: [{ d: 'AAAA-MM-JJ', kg }] }. Le poids du profil n'est
// mis à jour qu'au changement d'étape (sinon les besoins bougeraient chaque semaine pour quelques grammes).

import { getTodayDate, localYMD } from '../data/log.js';
import { getActiveMember, updateMember, getMembers } from '../data/household.js';
import { getProtocol, computeAllPhases, computeBase } from '../data/calculator.js';
import { getTargetsFor } from '../data/user.js';
import { el, toast } from './utils.js';

const WEIGH_KEY = 'hebe_weights';
export const getWeights = mid => { try { return (JSON.parse(localStorage.getItem(WEIGH_KEY) || '{}')[mid] || []).sort((a, b) => a.d.localeCompare(b.d)); } catch { return []; } };
function saveWeights(mid, list) {
  let all = {}; try { all = JSON.parse(localStorage.getItem(WEIGH_KEY) || '{}'); } catch {}
  all[mid] = list;
  localStorage.setItem(WEIGH_KEY, JSON.stringify(all));
}
const wDays = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
const kgFr = v => v.toFixed(1).replace('.', ',');
const dFr = (d, o = { day: 'numeric', month: 'short' }) => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', o);
const WT_LOSS = ['P3', 'P4'];
// rythme sur environ deux semaines (au moins 10 jours entre deux pesées), en kg par semaine
function weeklyRate(ws) {
  if (ws.length < 2) return null;
  const last = ws[ws.length - 1];
  const ref = [...ws].reverse().find(w => wDays(w.d, last.d) >= 10);
  return ref ? (last.kg - ref.kg) / wDays(ref.d, last.d) * 7 : null;
}
// pesée attendue : rien depuis 6 jours
export const weighDue = m => { const ws = getWeights(m.id); return !ws.length || wDays(ws[ws.length - 1].d, getTodayDate()) >= 6; };

// ── v199 : ajustement automatique des calories ──
// À chaque pesée : pente du poids sur les 4 dernières semaines (au moins 3 pesées sur 14 jours, hors 1re semaine,
// où le corps perd surtout de l'eau) → dépense réelle = ce que tu manges − variation de poids × 7 700 kcal/kg.
// Le facteur de correction (dépense réelle / calcul) est lissé (moitié ancien, moitié mesuré) et borné à ±15 %.
const ADJ_MIN = 0.85, ADJ_MAX = 1.15;
export function computeAdjust(m) {
  const all = getWeights(m.id);
  if (all.length < 3) return null;
  const last = all[all.length - 1];
  const win = all.filter(w => wDays(w.d, last.d) <= 28 && wDays(all[0].d, w.d) >= 7);
  if (win.length < 3 || wDays(win[0].d, last.d) < 14) return null;
  const xs = win.map(w => wDays(win[0].d, w.d)), ys = win.map(w => w.kg);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
  const slope = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / (xs.reduce((a, x) => a + (x - mx) ** 2, 0) || 1); // kg par jour
  const now = getTargetsFor(m).kcal;
  const intake = win.slice(1).reduce((a, w) => a + (w.kcal || now), 0) / (win.length - 1);
  const real = intake - slope * 7700;
  const formula = computeBase({ ...m, tdeeAdj: 1 }).maintenance;
  const old = +m.tdeeAdj || 1;
  const next = Math.min(ADJ_MAX, Math.max(ADJ_MIN, old * 0.5 + (real / formula) * 0.5));
  return { old, next, real: Math.round(real), formula: Math.round(formula), rate: slope * 7, last: last.d };
}
// appliqué après une pesée, si l'ajustement est activé et que l'écart vaut la peine (≥ 1,5 %)
export function autoAdjust(m) {
  if (m.autoAdjust === false || m.targets) return null; // calories réglées à la main : on n'y touche pas
  const a = computeAdjust(m);
  if (!a || m.adjLastD === a.last || Math.abs(a.next - a.old) < 0.015) return null;
  const fromK = getTargetsFor(m).kcal;
  const nm = updateMember(m.id, { tdeeAdj: Math.round(a.next * 1000) / 1000, adjLastD: a.last, adjPrev: a.old });
  const toK = getTargetsFor(nm).kcal;
  updateMember(m.id, { adjNote: { d: a.last, fromK, toK, up: a.next > a.old } });
  return { fromK, toK };
}

// courbe des 12 dernières pesées
function chart(ws) {
  const pts = ws.slice(-12);
  if (pts.length < 2) return '<div class="wt-empty">Ta courbe apparaît dès la deuxième pesée.</div>';
  const W = 340, H = 150, pl = 8, pr = 34, pt = 16, pb = 24;
  const ks = pts.map(p => p.kg);
  let lo = Math.min(...ks), hi = Math.max(...ks);
  const pad = Math.max(0.4, (hi - lo) * 0.25); lo -= pad; hi += pad;
  const x = i => pl + i * (W - pl - pr) / (pts.length - 1), y = v => pt + (hi - v) * (H - pt - pb) / (hi - lo);
  const P = pts.map((p, i) => [x(i), y(p.kg)]);
  // courbe lissée (Catmull-Rom → Bézier)
  let d = `M${P[0][0].toFixed(1)},${P[0][1].toFixed(1)}`;
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  const area = `${d} L${P[P.length - 1][0].toFixed(1)},${H - pb} L${P[0][0].toFixed(1)},${H - pb} Z`;
  // 3 graduations régulières, sur des demi-kilos
  const step = Math.max(0.5, Math.ceil((hi - lo) / 3 * 2) / 2), t0 = Math.ceil(lo * 2) / 2;
  const ticks = [t0, t0 + step, t0 + 2 * step].filter(v => v <= hi);
  const grid = [...new Set(ticks)].map(v => `<line x1="${pl}" x2="${W - pr}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="wt-grid"/><text x="${W - pr + 6}" y="${(y(v) + 3.5).toFixed(1)}" class="wt-ax">${String(v).replace('.', ',')}</text>`).join('');
  const labels = [0, pts.length - 1].map(i => `<text x="${x(i).toFixed(1)}" y="${H - 6}" class="wt-ax" text-anchor="${i ? 'end' : 'start'}">${dFr(pts[i].d)}</text>`).join('');
  const L = P[P.length - 1];
  return `<svg class="wt-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution du poids">
    <defs><linearGradient id="wtFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".22"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
    ${grid}<path d="${area}" fill="url(#wtFill)"/><path d="${d}" class="wt-line"/>
    ${P.slice(0, -1).map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.6" class="wt-dot"/>`).join('')}
    <circle cx="${L[0].toFixed(1)}" cy="${L[1].toFixed(1)}" r="9" class="wt-halo"/><circle cx="${L[0].toFixed(1)}" cy="${L[1].toFixed(1)}" r="4.5" class="wt-dot last"/>
    ${labels}</svg>`;
}

export function renderWeight() {
  const app = document.getElementById('app');
  app.querySelector('.view')?.remove();
  const view = el('div', 'view wt-view');
  const m = getActiveMember();
  const ws = getWeights(m.id);
  const last = ws[ws.length - 1];
  const due = weighDue(m);
  const proto = getProtocol(m.protocol || 'P4');
  const phase = +(m.phase || 0);
  const rate = weeklyRate(ws.filter(w => !m.phaseSince || w.d >= m.phaseSince));
  // avec l'ajustement automatique, les calories se recalent déjà ; l'étape suivante n'est proposée que si la correction est au plus bas
  const autoOn = m.autoAdjust !== false && !m.targets;
  const slow = WT_LOSS.includes(proto.id) && rate != null && rate > -0.2 && phase < proto.phases.length - 1 && m.stepSnooze !== last?.d
    && (!autoOn || (+m.tdeeAdj || 1) <= ADJ_MIN + 0.005);
  const note = m.adjNote && last && m.adjNote.d === last.d ? m.adjNote : null;
  const adjNow = +m.tdeeAdj || 1;
  const baseNow = computeBase(m);
  const start = last?.kg || m.weight || 70;
  const first = ws[0];
  const stepName = slow ? `l'${proto.phases[phase + 1].label.toLowerCase()}` : '';

  const sign = v => (v <= 0 ? '−' : '+') + kgFr(Math.abs(v));
  const total = first && last && ws.length > 1 ? last.kg - first.kg : null;
  const goodDir = v => (WT_LOSS.includes(proto.id) ? v < 0 : proto.id === 'P1' ? v > 0 : true);
  const nextD = last ? (() => { const d = new Date(last.d + 'T12:00:00'); d.setDate(d.getDate() + 7); return localYMD(d); })() : null;
  const kcalNow = getTargetsFor(m).kcal;
  const prog = proto.phases[phase] ? `${proto.name} · ${proto.phases[phase].label.toLowerCase()}` : proto.name;

  view.innerHTML = `
    <div class="hb-page-title">Mon poids</div>

    <section class="wt-hero">
      <div class="wt-hero-top">
        <div>
          <div class="wt-hero-k">${last ? (due ? `Dernière pesée · ${dFr(last.d, { weekday: 'long', day: 'numeric' })}` : `Pesé ${dFr(last.d, { weekday: 'long', day: 'numeric' })}`) : 'Ta première pesée'}</div>
          <div class="wt-hero-kg">${last ? kgFr(last.kg) : kgFr(start)}<small>kg</small></div>
        </div>
        ${total != null ? `<div class="wt-pill ${goodDir(total) ? 'good' : ''}">${sign(total)} kg<small>depuis le ${dFr(first.d)}</small></div>` : ''}
      </div>
      ${ws.length >= 2 ? chart(ws) : ''}
      ${rate != null ? `<div class="wt-hero-rate"><span>Rythme sur 2 semaines</span><b>${Math.abs(rate) < 0.05 ? 'stable' : `${sign(rate)} kg / semaine`}</b></div>` : ''}

      ${due || !last ? `<div class="wt-weigh">
        <div class="wt-weigh-k">${last ? 'Pesée de la semaine' : 'Commence par te peser'}<small>le matin, à jeun</small></div>
        <div class="wt-weigh-row">
          <button class="wt-step-btn" data-wstep="-0.1" aria-label="100 g de moins">−</button>
          <b class="wt-val" data-kg="${start}">${kgFr(start)}<small>kg</small></b>
          <button class="wt-step-btn" data-wstep="0.1" aria-label="100 g de plus">+</button>
        </div>
        <button class="hb-btn hb-btn-primary wt-save">Enregistrer</button>
      </div>` : `<div class="wt-next"><span>Prochaine pesée ${dFr(nextD, { weekday: 'long', day: 'numeric' })}</span><button class="wt-redo">Corriger</button></div>`}
    </section>

    ${note ? `<div class="wt-card wt-adj">
      <div class="wt-card-h"><span class="wt-ic" aria-hidden="true">↻</span>Calories ajustées</div>
      <div class="wt-adj-k"><s>${note.fromK}</s><span aria-hidden="true">→</span><b>${note.toK} kcal</b></div>
      <p>Ta courbe montre que tu dépenses un peu ${note.up ? 'plus' : 'moins'} que prévu. Ça s'applique dès ta prochaine semaine.</p>
      <button class="wt-later" data-adj-undo>Annuler cet ajustement</button>
    </div>` : ''}

    ${slow ? `<div class="wt-card wt-step">
      <div class="wt-card-h">Ta perte ralentit</div>
      <p>${Math.abs(rate) < 0.05 ? "Ton poids n'a presque pas bougé ces deux dernières semaines." : rate > 0 ? `Ton poids a remonté ces deux dernières semaines (+${kgFr(rate)} kg par semaine).` : `Seulement ${kgFr(-rate)} kg de moins par semaine ces deux dernières semaines.`} C'est le moment de passer à <b>${stepName}</b> : ${computeAllPhases(m, proto.id)[phase + 1].targets.kcal} kcal par jour, dès ta prochaine semaine.</p>
      <button class="hb-btn hb-btn-primary" data-step-go>Passer à ${stepName}</button>
      <button class="wt-later" data-step-later>Plus tard</button>
    </div>` : ''}

    <div class="wt-card wt-kcal">
      <div class="wt-kcal-top">
        <div><div class="wt-card-h">Tes calories</div><div class="wt-kcal-sub">${prog}</div></div>
        <div class="wt-kcal-v">${kcalNow}<small>kcal / jour</small></div>
      </div>
      ${!m.targets ? `<div class="wt-bars">
        <div class="wt-bar"><span>Dépense estimée</span><i style="--w:100%"></i><b>${Math.round(baseNow.maintenance)}</b></div>
        ${Math.abs(adjNow - 1) >= 0.005 ? `<div class="wt-bar muted"><span>Calcul de départ</span><i style="--w:${Math.min(100, Math.round(baseNow.maintenanceFormula / baseNow.maintenance * 100))}%"></i><b>${Math.round(baseNow.maintenanceFormula)}</b></div>` : ''}
      </div>` : ''}
      <div class="wt-auto-top">
        <div><b>Ajustement automatique</b><small>${m.targets ? "Calories réglées à la main dans Mon programme : Hébé n'y touche pas." : 'Hébé compare ta courbe à ce que tu manges et recale ta dépense (±15 % au plus).'}</small></div>
        <button class="wt-switch ${autoOn ? 'on' : ''}" role="switch" aria-checked="${autoOn}" aria-label="Ajustement automatique des calories" data-auto ${m.targets ? 'disabled' : ''}><i></i></button>
      </div>
    </div>

    ${ws.length ? `<div class="wt-card wt-hist">
      <div class="wt-card-h">Historique</div>
      ${[...ws].reverse().slice(0, 12).map((w, i, arr) => { const prev = arr[i + 1]; const dv = prev ? w.kg - prev.kg : null; return `<div class="wt-hrow"><span>${dFr(w.d, { weekday: 'short', day: 'numeric', month: 'long' }).replace(/^./, c => c.toUpperCase())}</span><b>${kgFr(w.kg)} kg</b><em class="${dv == null ? '' : goodDir(dv) || Math.abs(dv) < 0.05 ? 'good' : 'bad'}">${dv == null ? '' : Math.abs(dv) < 0.05 ? '=' : sign(dv)}</em></div>`; }).join('')}
    </div>` : ''}
  `;
  app.insertBefore(view, app.querySelector('#nav'));

  const val = view.querySelector('.wt-val');
  let hold = null;
  view.querySelectorAll('[data-wstep]').forEach(b => {
    const step = () => { const v = Math.round((+val.dataset.kg + +b.dataset.wstep) * 10) / 10; val.dataset.kg = v; val.innerHTML = `${kgFr(v)}<small>kg</small>`; };
    b.addEventListener('click', step);
    b.addEventListener('pointerdown', () => { hold = setTimeout(() => { hold = setInterval(step, 80); }, 400); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, () => { clearTimeout(hold); clearInterval(hold); }));
  });
  view.querySelector('.wt-save')?.addEventListener('click', () => {
    const d = getTodayDate();
    saveWeights(m.id, [...getWeights(m.id).filter(w => w.d !== d), { d, kg: +val.dataset.kg, kcal: getTargetsFor(m).kcal }]);
    const adj = autoAdjust(getMembers().find(x => x.id === m.id));
    document.querySelector('.nav-btn[data-view="weight"] .nav-dot')?.remove();
    renderWeight();
    toast(adj ? `Pesée enregistrée · calories ajustées : ${adj.toK} kcal` : `Pesée enregistrée : ${kgFr(+val.dataset.kg)} kg`);
  });
  view.querySelector('.wt-redo')?.addEventListener('click', () => {
    saveWeights(m.id, getWeights(m.id).filter(w => w !== last && w.d !== last.d));
    renderWeight();
  });
  view.querySelector('[data-adj-undo]')?.addEventListener('click', () => {
    updateMember(m.id, { tdeeAdj: m.adjPrev ?? 1, adjNote: null });
    renderWeight();
    toast('Ajustement annulé');
  });
  view.querySelector('[data-auto]')?.addEventListener('click', () => {
    const on = !(m.autoAdjust !== false);
    updateMember(m.id, on ? { autoAdjust: true } : { autoAdjust: false, tdeeAdj: 1, adjNote: null });
    renderWeight();
    toast(on ? 'Ajustement automatique activé' : 'Ajustement automatique désactivé : retour au calcul de départ');
  });
  view.querySelector('[data-step-go]')?.addEventListener('click', () => {
    updateMember(m.id, { phase: phase + 1, phaseSince: getTodayDate(), weight: last?.kg || m.weight });
    renderWeight();
    toast('Nouvelle étape : elle s\'applique à ta prochaine semaine');
  });
  view.querySelector('[data-step-later]')?.addEventListener('click', () => {
    updateMember(m.id, { stepSnooze: last?.d || getTodayDate() });
    renderWeight();
  });
}

// pastille sur l'onglet Poids quand une pesée est attendue
window._weighDue = () => { try { return weighDue(getActiveMember()); } catch { return false; } };

// weight.js — v200 : balance vintage + courbe sur papier millimétré. v195 : fiche « Mon poids » (pesée de la semaine, courbe, passage à l'étape suivante).
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

// ── v200 : balance vintage (illustration + cadran dessiné par-dessus, 0 à 150 kg) ──
// Repères dans l'image (1254 × 1254) : centre du cadran (624, 299), rayon 200, cadran légèrement aplati (× 0,9).
const SC = { cx: 624, cy: 299, R: 200, max: 150, sweep: 250 };
const needleDeg = kg => -SC.sweep / 2 + SC.sweep * Math.min(SC.max, Math.max(0, kg)) / SC.max;
function scaleSvg(kg) {
  const { cx, cy, R, max } = SC;
  let ticks = '';
  for (let v = 0; v <= max; v++) {
    const a = needleDeg(v) * Math.PI / 180, big = v % 10 === 0, mid = v % 5 === 0;
    const r1 = R - 14, r2 = big ? R - 48 : mid ? R - 36 : R - 27, sn = Math.sin(a), cs = Math.cos(a);
    ticks += `<line x1="${(cx + r1 * sn).toFixed(1)}" y1="${(cy - r1 * cs).toFixed(1)}" x2="${(cx + r2 * sn).toFixed(1)}" y2="${(cy - r2 * cs).toFixed(1)}" class="${big ? 'b' : mid ? 'm' : ''}"/>`;
    if (v % 20 === 0) { const rt = R - 88; ticks += `<text x="${(cx + rt * sn).toFixed(1)}" y="${(cy - rt * cs + 10).toFixed(1)}">${v}</text>`; }
  }
  return `<svg class="wt-dial" viewBox="0 0 1254 1254" aria-hidden="true"><g transform="translate(${cx} ${cy}) scale(1 .9) translate(${-cx} ${-cy})">
    <g class="wt-ticks">${ticks}</g>
    <text class="wt-dial-kg" x="${cx}" y="${cy + 122}">${kgFr(kg)}</text><text class="wt-dial-u" x="${cx}" y="${cy + 152}">KG</text>
    <g class="wt-needle" style="transform:rotate(${needleDeg(0)}deg);transform-origin:${cx}px ${cy}px" data-deg="${needleDeg(kg)}">
      <path d="M${cx - 6} ${cy + 40} L${cx - 2.2} ${cy - R + 40} L${cx} ${cy - R + 15} L${cx + 2.2} ${cy - R + 40} L${cx + 6} ${cy + 40} Z"/></g>
    <circle cx="${cx}" cy="${cy}" r="24" class="wt-cap"/><circle cx="${cx - 7}" cy="${cy - 7}" r="8" class="wt-cap-hl"/>
  </g></svg>`;
}

// ── v200 : courbe sur papier millimétré, tracé à l'encre légèrement tremblé ──
function chart(ws) {
  const pts = ws.slice(-12);
  if (pts.length < 2) return '<div class="wt-empty">Ta courbe apparaît dès la deuxième pesée.</div>';
  const W = 320, H = 150, X0 = 26, X1 = 306, Y0 = 12, Y1 = 124, G = 5.6;
  const ks = pts.map(p => p.kg);
  let lo = Math.min(...ks), hi = Math.max(...ks);
  const pad = Math.max(0.4, (hi - lo) * 0.18); lo -= pad; hi += pad;
  const x = i => X0 + i * (X1 - X0) / (pts.length - 1), y = v => Y0 + (hi - v) * (Y1 - Y0) / (hi - lo);
  const P = pts.map((p, i) => [x(i), y(p.kg)]);
  let d = `M${P[0][0].toFixed(1)},${P[0][1].toFixed(1)}`;
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2;
    d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  // quadrillage : un trait fin tous les 5,6 px, un trait plus marqué tous les 5 carreaux
  let grid = '';
  for (let k = 0, gx = X0 - 16; gx <= X1 + 10; gx += G, k++) grid += `<line x1="${gx.toFixed(1)}" x2="${gx.toFixed(1)}" y1="0" y2="134" class="${k % 5 ? '' : 'b'}"/>`;
  for (let k = 0, gy = 0; gy <= 134; gy += G, k++) grid += `<line x1="${X0 - 16}" x2="${X1 + 14}" y1="${gy.toFixed(1)}" y2="${gy.toFixed(1)}" class="${k % 5 ? '' : 'b'}"/>`;
  // graduations : kilos entiers (ou tous les 2 kg si l'écart est grand)
  const st = hi - lo > 6 ? 2 : 1, ticks = [];
  for (let v = Math.ceil(lo / st) * st; v <= hi; v += st) ticks.push(v);
  const ax = ticks.map(v => `<text x="${X0 - 20}" y="${(y(v) + 4).toFixed(1)}" class="wt-ax">${v}</text>`).join('');
  const marks = P.map((q, i) => i === P.length - 1
    ? `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="5.5" class="wt-last"/>`
    : `<path d="M${(q[0] - 3.5).toFixed(1)} ${(q[1] - 3.5).toFixed(1)}l7 7M${(q[0] + 3.5).toFixed(1)} ${(q[1] - 3.5).toFixed(1)}l-7 7" class="wt-x"/>`).join('');
  const fmt = dd => dFr(dd, { day: 'numeric', month: 'long' });
  return `<svg class="wt-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution du poids">
    <defs><filter id="wtWob"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="3"/></filter></defs>
    <g class="wt-mm">${grid}</g>${ax}<path d="${d}" class="wt-line" filter="url(#wtWob)"/>${marks}
    <text x="${X0}" y="148" class="wt-ax">${fmt(pts[0].d)}</text><text x="${X1}" y="148" class="wt-ax" text-anchor="end">${fmt(pts[pts.length - 1].d)}</text></svg>`;
}

let weighOpen = false; // « Me peser » ouvre la pesée même si celle de la semaine est faite

export function renderWeight() {
  const app = document.getElementById('app');
  app.querySelector('.view')?.remove();
  const view = el('div', 'view wt-view');
  const m = getActiveMember();
  const ws = getWeights(m.id);
  const last = ws[ws.length - 1];
  const due = weighDue(m);
  const weighing = due || weighOpen;
  const proto = getProtocol(m.protocol || 'P4');
  const phase = +(m.phase || 0);
  const rate = weeklyRate(ws.filter(w => !m.phaseSince || w.d >= m.phaseSince));
  // avec l'ajustement automatique, les calories se recalent déjà ; l'étape suivante n'est proposée que si la correction est au plus bas
  const autoOn = m.autoAdjust !== false && !m.targets;
  const slow = WT_LOSS.includes(proto.id) && rate != null && rate > -0.2 && phase < proto.phases.length - 1 && m.stepSnooze !== last?.d
    && (!autoOn || (+m.tdeeAdj || 1) <= ADJ_MIN + 0.005);
  const note = m.adjNote && last && m.adjNote.d === last.d ? m.adjNote : null;
  const start = last?.kg || m.weight || 70;
  const first = ws[0];
  const stepName = slow ? `l'${proto.phases[phase + 1].label.toLowerCase()}` : '';

  const sign = v => (v <= 0 ? '−' : '+') + kgFr(Math.abs(v));
  const total = first && last && ws.length > 1 ? last.kg - first.kg : null;
  const goodDir = v => (WT_LOSS.includes(proto.id) ? v < 0 : proto.id === 'P1' ? v > 0 : true);
  const nextD = last ? (() => { const d = new Date(last.d + 'T12:00:00'); d.setDate(d.getDate() + 7); return localYMD(d); })() : null;
  const kcalNow = getTargetsFor(m).kcal;
  const prog = proto.phases[phase] ? `Ton programme : ${proto.name.toLowerCase()} (${proto.phases[phase].label.toLowerCase()}).` : `Ton programme : ${proto.name.toLowerCase()}.`;
  const dLong = dd => dFr(dd, { weekday: 'long', day: 'numeric', month: 'long' });
  const sub = weighing ? (last && !due ? "Cette pesée remplacera celle d'aujourd'hui." : 'Pèse-toi le matin, à jeun.')
    : `Dernière pesée le ${dLong(last.d)}, la prochaine ${dFr(nextD, { weekday: 'long', day: 'numeric' })}.`;
  const chips = [
    total != null ? `<div class="wt-chip ${goodDir(total) ? 'good' : ''}">Depuis le ${dFr(first.d, { day: '2-digit', month: '2-digit' })}<b>${sign(total)} kg</b></div>` : '',
    rate != null ? `<div class="wt-chip">Rythme<b>${Math.abs(rate) < 0.05 ? 'stable' : `${sign(rate)} kg/sem`}</b></div>` : '',
    `<div class="wt-chip">Objectif<b>${kcalNow} kcal</b></div>`,
  ].join('');

  view.innerHTML = `
    <div class="hb-page-title">Mon poids</div>
    <div class="wt-sub">${sub}</div>
    <div class="wt-scale"><img src="img/art/balance.webp" alt="" width="720" height="720">${scaleSvg(start)}</div>

    ${weighing ? `<div class="wt-weigh">
      <button class="wt-step-btn" data-wstep="-0.1" aria-label="100 g de moins">−</button>
      <label class="wt-val"><input class="wt-input" type="text" inputmode="decimal" enterkeyhint="done" value="${kgFr(start)}" data-kg="${start}" aria-label="Ton poids en kilos"><small>kg</small></label>
      <button class="wt-step-btn" data-wstep="0.1" aria-label="100 g de plus">+</button>
    </div>
    <button class="hb-btn hb-btn-primary wt-cta wt-save">Enregistrer</button>
    ${weighOpen && !due ? '<button class="wt-later" data-weigh-cancel>Annuler</button>' : ''}`
    : `<div class="wt-chips">${chips}</div><button class="hb-btn hb-btn-primary wt-cta" data-weigh-open>Me peser</button>`}

    ${slow ? `<div class="wt-card wt-step">
      <h2>Ta perte ralentit</h2>
      <p>${Math.abs(rate) < 0.05 ? "Ton poids n'a presque pas bougé ces deux dernières semaines." : rate > 0 ? `Ton poids a remonté ces deux dernières semaines (+${kgFr(rate)} kg par semaine).` : `Seulement ${kgFr(-rate)} kg de moins par semaine ces deux dernières semaines.`} C'est le moment de passer à <b>${stepName}</b> : ${computeAllPhases(m, proto.id)[phase + 1].targets.kcal} kcal par jour, dès ta prochaine semaine.</p>
      <button class="hb-btn hb-btn-primary" data-step-go>Passer à ${stepName}</button>
      <button class="wt-later" data-step-later>Plus tard</button>
    </div>` : ''}

    ${ws.length >= 2 ? `<div class="wt-card wt-paper">
      <h2>Ton évolution</h2><div class="wt-m">${ws.length} pesées depuis le ${dFr(first.d, { day: 'numeric', month: 'long' })}</div>
      ${chart(ws)}
    </div>` : ''}

    <div class="wt-card wt-kcal">
      <div class="wt-row">
        <div><h2>Calories ajustées</h2><div class="wt-m">${m.targets ? "Réglées à la main dans Mon programme : Hébé n'y touche pas." : 'Hébé recale ton objectif selon tes pesées.'}</div></div>
        <button class="wt-switch ${autoOn ? 'on' : ''}" role="switch" aria-checked="${autoOn}" aria-label="Ajustement automatique des calories" data-auto ${m.targets ? 'disabled' : ''}><i></i></button>
      </div>
      <div class="wt-kcal-v">${kcalNow}<small>kcal / jour</small></div>
      ${note ? `<div class="wt-note">Tu dépenses un peu ${note.up ? 'plus' : 'moins'} que prévu : objectif ${note.up ? 'monté' : 'baissé'} de ${Math.abs(note.toK - note.fromK)} kcal cette semaine. Ça s'applique dès ta prochaine semaine.
        <button class="wt-undo" data-adj-undo>Annuler cet ajustement</button></div>` : `<div class="wt-m">${prog}</div>`}
    </div>

    ${ws.length ? `<div class="wt-card wt-hist">
      <h2>Historique</h2>
      ${[...ws].reverse().slice(0, 8).map((w, i, arr) => { const prev = [...ws].reverse()[i + 1]; const dv = prev ? w.kg - prev.kg : null; return `<div class="wt-hrow"><span>${dFr(w.d, { day: '2-digit', month: '2-digit' })}</span><b>${kgFr(w.kg)} kg</b><em class="${dv == null ? '' : goodDir(dv) || Math.abs(dv) < 0.05 ? 'good' : 'bad'}">${dv == null ? '' : Math.abs(dv) < 0.05 ? '=' : sign(dv)}</em></div>`; }).join('')}
    </div>` : ''}
  `;
  app.insertBefore(view, app.querySelector('#nav'));

  // l'aiguille part de 0 et tourne jusqu'au poids
  const needle = view.querySelector('.wt-needle');
  const setNeedle = kg => { needle.style.transform = `rotate(${needleDeg(kg)}deg)`; view.querySelector('.wt-dial-kg').textContent = kgFr(kg); };
  requestAnimationFrame(() => requestAnimationFrame(() => setNeedle(start)));

  const val = view.querySelector('.wt-input');
  // le poids se tape directement (virgule ou point) ou s'ajuste avec − et +
  const setVal = (v, write = true) => { v = Math.round(Math.min(250, Math.max(20, v)) * 10) / 10; val.dataset.kg = v; if (write) val.value = kgFr(v); setNeedle(v); };
  val?.addEventListener('focus', () => val.select());
  val?.addEventListener('input', () => { const v = parseFloat(val.value.replace(',', '.')); if (v >= 20 && v <= 250) setVal(v, false); });
  val?.addEventListener('blur', () => setVal(+val.dataset.kg));
  val?.addEventListener('keydown', e => { if (e.key === 'Enter') val.blur(); });
  let hold = null;
  view.querySelectorAll('[data-wstep]').forEach(b => {
    const step = () => setVal(+val.dataset.kg + +b.dataset.wstep);
    b.addEventListener('click', step);
    b.addEventListener('pointerdown', () => { hold = setTimeout(() => { hold = setInterval(step, 80); }, 400); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, () => { clearTimeout(hold); clearInterval(hold); }));
  });
  view.querySelector('[data-weigh-open]')?.addEventListener('click', () => { weighOpen = true; renderWeight(); });
  view.querySelector('[data-weigh-cancel]')?.addEventListener('click', () => { weighOpen = false; renderWeight(); });
  view.querySelector('.wt-save')?.addEventListener('click', () => {
    const d = getTodayDate();
    saveWeights(m.id, [...getWeights(m.id).filter(w => w.d !== d), { d, kg: +val.dataset.kg, kcal: getTargetsFor(m).kcal }]);
    const adj = autoAdjust(getMembers().find(x => x.id === m.id));
    weighOpen = false;
    document.querySelector('.nav-btn[data-view="weight"] .nav-dot')?.remove();
    renderWeight();
    toast(adj ? `Pesée enregistrée, tes calories passent à ${adj.toK} kcal par jour.` : `Pesée enregistrée : ${kgFr(+val.dataset.kg)} kg.`);
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

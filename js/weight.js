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
  if (pts.length < 2) return '<div class="wt-empty">La courbe apparaît dès ta deuxième pesée.</div>';
  const W = 320, H = 150, pl = 34, pr = 12, pt = 14, pb = 26;
  const ks = pts.map(p => p.kg), lo = Math.floor(Math.min(...ks) - 0.5), hi = Math.ceil(Math.max(...ks) + 0.5);
  const x = i => pl + i * (W - pl - pr) / (pts.length - 1), y = v => pt + (hi - v) * (H - pt - pb) / (hi - lo || 1);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.kg).toFixed(1)}`).join(' ');
  const grid = [hi, (hi + lo) / 2, lo].map(v => `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" class="wt-grid"/><text x="${pl - 6}" y="${y(v) + 4}" class="wt-ax" text-anchor="end">${String(Math.round(v * 10) / 10).replace('.', ',')}</text>`).join('');
  const labels = [0, pts.length - 1].map(i => `<text x="${x(i)}" y="${H - 6}" class="wt-ax" text-anchor="${i ? 'end' : 'start'}">${dFr(pts[i].d)}</text>`).join('');
  return `<svg class="wt-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution du poids">${grid}<path d="${line}" class="wt-line"/>${pts.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.kg)}" r="${i === pts.length - 1 ? 4.5 : 3}" class="wt-dot ${i === pts.length - 1 ? 'last' : ''}"/>`).join('')}${labels}</svg>`;
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

  view.innerHTML = `
    <div class="page-head">
      <button class="hb-back round-back" aria-label="Retour à mon programme"><svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg></button>
      <div class="hb-page-title">Mon poids</div>
    </div>
    <p class="wt-intro">Une pesée par semaine suffit : le matin, à jeun, toujours dans les mêmes conditions. Hébé regarde la tendance sur deux semaines et te dit quand passer à l'étape suivante.</p>

    <div class="wt-card wt-weigh">
      <div class="wt-k">${due ? 'Pesée de la semaine' : `Pesée du ${dFr(last.d, { weekday: 'long', day: 'numeric', month: 'long' })}`}</div>
      ${due || !last ? `
      <div class="wt-row">
        <button class="pcell-btn" data-wstep="-0.1" aria-label="100 g de moins">−</button>
        <b class="wt-val" data-kg="${start}">${kgFr(start)}<small>kg</small></b>
        <button class="pcell-btn" data-wstep="0.1" aria-label="100 g de plus">+</button>
      </div>
      <button class="hb-btn hb-btn-primary wt-save">Enregistrer</button>` : `
      <div class="wt-done"><b>${kgFr(last.kg)}<small>kg</small></b><span>Prochaine pesée ${dFr((() => { const d = new Date(last.d + 'T12:00:00'); d.setDate(d.getDate() + 7); return localYMD(d); })(), { weekday: 'long', day: 'numeric' })}</span></div>
      <button class="wt-redo">Corriger cette pesée</button>`}
    </div>

    ${note ? `<div class="wt-card wt-adj">
      <div class="wt-k">Calories ajustées</div>
      <p>Ta courbe montre que tu dépenses un peu ${note.up ? 'plus' : 'moins'} que prévu. Tes calories passent de <b>${note.fromK}</b> à <b>${note.toK} kcal</b> par jour, dès ta prochaine semaine.</p>
      <button class="wt-later" data-adj-undo>Annuler cet ajustement</button>
    </div>` : ''}

    ${slow ? `<div class="wt-card wt-step">
      <div class="wt-k">Ta perte ralentit</div>
      <p>${Math.abs(rate) < 0.05 ? "Ton poids n'a presque pas bougé ces deux dernières semaines." : rate > 0 ? `Ton poids a remonté ces deux dernières semaines (+${kgFr(rate)} kg par semaine).` : `Seulement ${kgFr(-rate)} kg de moins par semaine ces deux dernières semaines.`} C'est le moment de passer à <b>${stepName}</b> : ${computeAllPhases(m, proto.id)[phase + 1].targets.kcal} kcal par jour, dès ta prochaine semaine.</p>
      <button class="hb-btn hb-btn-primary" data-step-go>Passer à ${stepName}</button>
      <button class="wt-later" data-step-later>Plus tard</button>
    </div>` : ''}

    <div class="wt-card">
      <div class="wt-stats">
        <div><span>Départ</span><b>${first ? kgFr(first.kg) : '–'}</b><small>${first ? dFr(first.d) : ''}</small></div>
        <div><span>Actuel</span><b>${last ? kgFr(last.kg) : '–'}</b><small>${last ? dFr(last.d) : ''}</small></div>
        <div><span>Écart</span><b>${first && last && ws.length > 1 ? `${last.kg - first.kg <= 0 ? '−' : '+'}${kgFr(Math.abs(last.kg - first.kg))}` : '–'}</b><small>${rate == null ? '' : Math.abs(rate) < 0.05 ? 'stable ces 2 sem.' : `${rate <= 0 ? '−' : '+'}${kgFr(Math.abs(rate))} kg / sem.`}</small></div>
      </div>
      ${chart(ws)}
    </div>

    <div class="wt-card wt-auto">
      <div class="wt-auto-top">
        <div><div class="wt-k">Ajustement automatique</div></div>
        <button class="wt-switch ${autoOn ? 'on' : ''}" role="switch" aria-checked="${autoOn}" aria-label="Ajustement automatique des calories" data-auto ${m.targets ? 'disabled' : ''}><i></i></button>
      </div>
      <p>${m.targets ? "Tu as réglé tes calories à la main dans Mon programme : Hébé n'y touche pas."
        : `Chaque semaine, Hébé compare ta courbe à ce que tu manges et recale ta dépense (±15 % au plus). Il lui faut 3 pesées sur au moins 2 semaines.`}</p>
      ${!m.targets ? `<div class="wt-auto-row"><span>Dépense estimée</span><b>${Math.round(baseNow.maintenance)} kcal</b></div>
      ${Math.abs(adjNow - 1) >= 0.005 ? `<div class="wt-auto-row"><span>Calcul de départ</span><b>${Math.round(baseNow.maintenanceFormula)} kcal</b></div>` : ''}` : ''}
    </div>

    ${ws.length ? `<div class="wt-card wt-hist">
      <div class="wt-k">Historique</div>
      ${[...ws].reverse().slice(0, 12).map(w => `<div class="wt-hrow"><span>${dFr(w.d, { weekday: 'short', day: 'numeric', month: 'long' }).replace(/^./, c => c.toUpperCase())}</span><b>${kgFr(w.kg)} kg</b></div>`).join('')}
    </div>` : ''}
  `;
  app.insertBefore(view, app.querySelector('#nav'));

  view.querySelector('.hb-back').addEventListener('click', () => window._nav?.('settings'));
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

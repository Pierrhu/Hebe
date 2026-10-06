// weight.js — v195 : fiche « Mon poids » (pesée de la semaine, courbe, passage à l'étape suivante).
// Historique par personne : hebe_weights = { id: [{ d: 'AAAA-MM-JJ', kg }] }. Le poids du profil n'est
// mis à jour qu'au changement d'étape (sinon les besoins bougeraient chaque semaine pour quelques grammes).

import { getTodayDate, localYMD } from '../data/log.js';
import { getActiveMember, updateMember } from '../data/household.js';
import { getProtocol, computeAllPhases } from '../data/calculator.js';
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
  const slow = WT_LOSS.includes(proto.id) && rate != null && rate > -0.2 && phase < proto.phases.length - 1 && m.stepSnooze !== last?.d;
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
    saveWeights(m.id, [...getWeights(m.id).filter(w => w.d !== d), { d, kg: +val.dataset.kg }]);
    renderWeight();
    toast(`Pesée enregistrée : ${kgFr(+val.dataset.kg)} kg`);
  });
  view.querySelector('.wt-redo')?.addEventListener('click', () => {
    saveWeights(m.id, getWeights(m.id).filter(w => w !== last && w.d !== last.d));
    renderWeight();
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

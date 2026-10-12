// body.js — v227 : « Mon poids » va au-delà de la balance.
// Tour de taille : hebe_waist = { id: [{ d: 'AAAA-MM-JJ', cm }] } (localStorage, donc dans la sauvegarde).
// Photos : une par mois et par personne, dans IndexedDB (base « hebe », magasin « photos », clé « id|AAAA-MM »),
// réduites à 900 px en JPEG. Elles ne quittent jamais le téléphone et ne sont pas dans la sauvegarde.

import { getTodayDate } from '../data/log.js';
import { openSheet, closeSheet, toast } from './utils.js';

// ── Tour de taille ──
const WAIST_KEY = 'hebe_waist';
export const getWaist = mid => { try { return (JSON.parse(localStorage.getItem(WAIST_KEY) || '{}')[mid] || []).sort((a, b) => a.d.localeCompare(b.d)); } catch { return []; } };
function saveWaist(mid, list) {
  let all = {}; try { all = JSON.parse(localStorage.getItem(WAIST_KEY) || '{}'); } catch {}
  all[mid] = list;
  localStorage.setItem(WAIST_KEY, JSON.stringify(all));
}
const cmFr = v => (Math.round(v * 10) / 10).toFixed(1).replace('.', ',').replace(',0', '');
const bdDate = (d, o = { day: 'numeric', month: 'long' }) => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', o);

// Mètre ruban : le ruban glisse sous un curseur fixe au centre, chiffres tous les centimètres
export function tapeSvg(v) {
  const W = 340, H = 92, span = 5, px = W / (2 * span), from = v - span;
  let ticks = '';
  for (let mm = Math.ceil(from * 10); mm <= Math.floor((v + span) * 10); mm++) {
    const x = (mm / 10 - from) * px, cm = mm % 10 === 0, half = mm % 5 === 0;
    ticks += `<line x1="${x.toFixed(1)}" y1="22" x2="${x.toFixed(1)}" y2="${cm ? 46 : half ? 38 : 31}" stroke="#5C4A2A" stroke-width="${cm ? 1.4 : 0.8}" opacity="${cm ? 0.9 : 0.6}"/>`;
    if (cm) ticks += `<text x="${x.toFixed(1)}" y="62" text-anchor="middle" font-family="Georgia, serif" font-size="15" fill="#5C4A2A">${mm / 10}</text>`;
  }
  const c = W / 2;
  return `<svg class="bd-tape" viewBox="0 0 ${W} ${H}" aria-hidden="true">
    <defs>
      <filter id="bdw"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 .35  0 0 0 0 .28  0 0 0 0 .15  0 0 0 .07 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
      <linearGradient id="bdg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F6E7B9"/><stop offset="1" stop-color="#EBD597"/></linearGradient>
    </defs>
    <path d="M0 20 Q ${c} 14 ${W} 20 L ${W} 74 Q ${c} 68 0 74 Z" fill="url(#bdg)" stroke="#C9A85C" stroke-width="1.2"/>
    <path d="M0 20 Q ${c} 14 ${W} 20 L ${W} 74 Q ${c} 68 0 74 Z" filter="url(#bdw)"/>
    ${ticks}
    <rect x="${c - 1.5}" y="8" width="3" height="76" rx="1.5" fill="#C8704F"/>
    <path d="M${c - 7} 4 L${c + 7} 4 L${c} 12 Z" fill="#C8704F"/>
  </svg>`;
}

let waistOpen = false;
function waistCard(m) {
  const ws = getWaist(m.id);
  const last = ws[ws.length - 1], first = ws[0];
  const start = last?.cm || (m.sex === 'female' ? 80 : 90);
  const total = ws.length > 1 ? last.cm - first.cm : null;
  const head = `<div class="bd-row"><div><h2>Tour de taille</h2>
      <div class="wt-m">${last ? `Mesuré le ${bdDate(last.d)}, au niveau du nombril.` : 'Mesure-le au niveau du nombril, sans serrer.'}</div></div>
      ${waistOpen ? '' : `<button class="bd-btn" data-waist-open>${last ? 'Mesurer' : 'Ajouter'}</button>`}</div>`;
  if (waistOpen) {
    return `<div class="wt-card wt-paper bd-waist">${head}
      <div class="wt-weigh bd-weigh">
        <button class="wt-step-btn" data-cstep="-0.5" aria-label="5 mm de moins">−</button>
        <label class="wt-val"><input class="wt-input bd-input" type="text" inputmode="decimal" enterkeyhint="done" value="${cmFr(start)}" data-cm="${start}" aria-label="Ton tour de taille en centimètres"><small>cm</small></label>
        <button class="wt-step-btn" data-cstep="0.5" aria-label="5 mm de plus">+</button>
      </div>
      <div class="bd-tapebox">${tapeSvg(start)}</div>
      <button class="hb-btn hb-btn-primary wt-cta bd-save">Enregistrer</button>
      <button class="wt-later" data-waist-cancel>Annuler</button>
    </div>`;
  }
  if (!last) {
    return `<div class="wt-card wt-paper bd-waist">${head}
      <div class="bd-tapebox bd-empty">${tapeSvg(start)}</div>
      <div class="bd-foot">Une mesure par mois suffit. Le tour de taille baisse même quand le poids stagne.</div>
    </div>`;
  }
  return `<div class="wt-card wt-paper bd-waist">${head}
    <div class="bd-val"><b>${cmFr(last.cm)}</b><small>cm</small>
      ${total != null ? `<span class="bd-delta ${total <= 0 ? 'good' : ''}">${total <= 0 ? '−' : '+'}${cmFr(Math.abs(total))} cm depuis le ${bdDate(first.d, { day: 'numeric', month: 'short' })}</span>` : ''}</div>
    <div class="bd-tapebox">${tapeSvg(last.cm)}</div>
    <div class="bd-foot">Une mesure par mois suffit. Le tour de taille baisse même quand le poids stagne.</div>
  </div>`;
}

// ── Photos (IndexedDB) ──
let dbP = null;
function db() {
  if (!dbP) dbP = new Promise((res, rej) => {
    const r = indexedDB.open('hebe', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('photos');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbP;
}
const store = async mode => (await db()).transaction('photos', mode).objectStore('photos');
const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
async function listPhotos(mid) {
  try {
    const s = await store('readonly');
    const [keys, vals] = await Promise.all([req(s.getAllKeys()), req(s.getAll())]);
    return keys.map((k, i) => ({ k, ...vals[i] })).filter(p => p.mid === mid).sort((a, b) => a.m.localeCompare(b.m));
  } catch { return []; }
}
async function putPhoto(mid, m, data) { const s = await store('readwrite'); await req(s.put({ mid, m, d: getTodayDate(), data }, `${mid}|${m}`)); }
async function delPhoto(mid, m) { const s = await store('readwrite'); await req(s.delete(`${mid}|${m}`)); }

// photo réduite à 900 px de haut ou de large, JPEG 0,8
function shrink(file) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 900 / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      res(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}
const monthOf = d => d.slice(0, 7);
const monthFr = (m, withYear = false) => new Date(m + '-15T12:00:00').toLocaleDateString('fr-FR', withYear ? { month: 'long', year: 'numeric' } : { month: 'long' });
const capOf = m => monthFr(m, m.slice(0, 4) !== getTodayDate().slice(0, 4));

function photosCard() {
  return `<div class="wt-card bd-photos">
    <h2>Mes photos</h2><div class="wt-m">Une par mois, de face, avec la même lumière. Elles restent sur ton téléphone.</div>
    <div class="bd-pol" data-pol></div>
    <button class="bd-cmp" data-cmp hidden>Comparer avant et après</button>
    <input type="file" accept="image/*" data-photo-file hidden>
  </div>`;
}
const polaroid = p => `<button class="bd-p" data-photo="${p.m}" aria-label="Photo de ${capOf(p.m)}"><span class="bd-img"><img src="${p.data}" alt=""></span><span class="bd-cap">${capOf(p.m)}</span></button>`;

async function fillPhotos(view, m) {
  const box = view.querySelector('[data-pol]');
  if (!box) return;
  const ps = await listPhotos(m.id);
  const cur = monthOf(getTodayDate());
  const hasCur = ps.some(p => p.m === cur);
  const shown = ps.slice(hasCur ? -3 : -2);
  box.innerHTML = shown.map(polaroid).join('')
    + (hasCur ? '' : `<button class="bd-p bd-add" data-photo-add aria-label="Ajouter la photo de ${capOf(cur)}"><span class="bd-img"><img src="img/art/photo-${m.sex === 'female' ? 'femme' : 'homme'}.webp" alt=""><i class="bd-plus" aria-hidden="true">+</i></span><span class="bd-cap">${capOf(cur).replace(/^./, c => c.toUpperCase())}</span></button>`);
  view.querySelector('[data-cmp]').hidden = ps.length < 2;
  box._photos = ps;
}

// poids de la pesée la plus proche d'un mois donné (pour la comparaison)
function kgNear(ws, m) { const inM = ws.filter(w => w.d.startsWith(m)); return inM.length ? inM[inM.length - 1].kg : null; }

export function bodyCards(m) { return waistCard(m) + photosCard(); }

export function bindBody(view, m, rerender, getWeights) {
  // tour de taille
  view.querySelector('[data-waist-open]')?.addEventListener('click', () => { waistOpen = true; rerender(); view.querySelector('.bd-waist')?.scrollIntoView({ block: 'center' }); });
  view.querySelector('[data-waist-cancel]')?.addEventListener('click', () => { waistOpen = false; rerender(); });
  const inp = view.querySelector('.bd-input');
  if (inp) {
    const box = view.querySelector('.bd-weigh + .bd-tapebox');
    const fit = () => { const c = fit.c || (fit.c = document.createElement('canvas').getContext('2d')); const cs = getComputedStyle(inp); c.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; inp.style.width = `${Math.ceil(c.measureText(inp.value || '0').width) + 2}px`; };
    fit(); document.fonts?.ready.then(fit);
    const setV = (v, write = true) => { v = Math.round(Math.min(200, Math.max(40, v)) * 10) / 10; inp.dataset.cm = v; if (write) inp.value = cmFr(v); fit(); box.innerHTML = tapeSvg(v); };
    inp.addEventListener('focus', () => inp.select());
    inp.addEventListener('input', () => { const v = parseFloat(inp.value.replace(',', '.')); fit(); if (v >= 40 && v <= 200) setV(v, false); });
    inp.addEventListener('blur', () => setV(+inp.dataset.cm));
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); });
    let hold = null;
    view.querySelectorAll('[data-cstep]').forEach(b => {
      const step = () => setV(+inp.dataset.cm + +b.dataset.cstep);
      b.addEventListener('click', step);
      b.addEventListener('pointerdown', () => { hold = setTimeout(() => { hold = setInterval(step, 90); }, 400); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, () => { clearTimeout(hold); clearInterval(hold); }));
    });
    view.querySelector('.bd-save')?.addEventListener('click', () => {
      const d = getTodayDate(), cm = +inp.dataset.cm;
      saveWaist(m.id, [...getWaist(m.id).filter(w => w.d !== d), { d, cm }]);
      waistOpen = false; rerender();
      toast(`Tour de taille enregistré : ${cmFr(cm)} cm.`);
    });
  }

  // photos
  const file = view.querySelector('[data-photo-file]');
  let target = null; // mois de la photo à ajouter ou remplacer
  file?.addEventListener('change', async () => {
    const f = file.files?.[0]; file.value = '';
    if (!f) return;
    try { await putPhoto(m.id, target || monthOf(getTodayDate()), await shrink(f)); toast('Photo enregistrée'); }
    catch { toast("La photo n'a pas pu être enregistrée.", 'warn'); }
    target = null; fillPhotos(view, m);
  });
  const box = view.querySelector('[data-pol]');
  box?.addEventListener('click', e => {
    if (e.target.closest('[data-photo-add]')) { target = null; file.click(); return; }
    const b = e.target.closest('[data-photo]'); if (!b) return;
    const p = (box._photos || []).find(x => x.m === b.dataset.photo); if (!p) return;
    openSheet(`<div class="sheet-handle"></div><div class="hb-sheet-pad bd-sheet">
      <h2 class="bd-sh-t">${capOf(p.m).replace(/^./, c => c.toUpperCase())}</h2>
      <div class="bd-big"><img src="${p.data}" alt="Photo de ${capOf(p.m)}"></div>
      <button class="hb-btn hb-btn-primary" data-ph-replace>Remplacer la photo</button>
      <button class="wt-later bd-del" data-ph-del>Supprimer</button></div>`);
    const sh = document.getElementById('sheet');
    sh.querySelector('[data-ph-replace]').addEventListener('click', () => { closeSheet(); target = p.m; file.click(); });
    sh.querySelector('[data-ph-del]').addEventListener('click', async () => { await delPhoto(m.id, p.m); closeSheet(); toast('Photo supprimée'); fillPhotos(view, m); });
  });
  view.querySelector('[data-cmp]')?.addEventListener('click', () => {
    const ps = box?._photos || []; if (ps.length < 2) return;
    const a = ps[0], b = ps[ps.length - 1], ws = getWeights(m.id), wa = getWaist(m.id);
    const cmNear = mm => { const x = wa.filter(w => w.d.startsWith(mm)); return x.length ? x[x.length - 1].cm : null; };
    const info = p => { const kg = kgNear(ws, p.m), cm = cmNear(p.m); return [kg != null ? `${kg.toFixed(1).replace('.', ',')} kg` : '', cm != null ? `${cmFr(cm)} cm` : ''].filter(Boolean).join(', '); };
    openSheet(`<div class="sheet-handle"></div><div class="hb-sheet-pad bd-sheet">
      <h2 class="bd-sh-t">Avant et après</h2>
      <div class="bd-duo">${[a, b].map(p => `<figure class="bd-p bd-p-big"><span class="bd-img"><img src="${p.data}" alt=""></span><figcaption class="bd-cap">${capOf(p.m)}</figcaption>${info(p) ? `<span class="bd-info">${info(p)}</span>` : ''}</figure>`).join('')}</div>
      <button class="hb-btn hb-btn-primary" data-cmp-close>Fermer</button></div>`);
    document.querySelector('[data-cmp-close]').addEventListener('click', closeSheet);
  });
  fillPhotos(view, m);
}

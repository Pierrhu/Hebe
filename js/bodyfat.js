// bodyfat.js — Aide visuelle pour estimer sa masse grasse, en version homme et en version femme.
// Les silhouettes sont dessinées en SVG : la taille s'épaissit et les abdos s'estompent avec le %.

import { openSheet, closeSheet } from './utils.js';
import { getActiveMember } from '../data/household.js';

const LEVELS_M = [
  { bf: 8,  desc: 'Abdos très marqués' },
  { bf: 10, desc: 'Abdos dessinés' },
  { bf: 15, desc: 'Abdos visibles' },
  { bf: 20, desc: 'Ventre plat' },
  { bf: 25, desc: 'Léger ventre' },
  { bf: 30, desc: 'Ventre arrondi' },
  { bf: 35, desc: 'Ventre marqué' },
  { bf: 40, desc: 'Ventre proéminent' },
];
// Chez une femme, la masse grasse essentielle est plus élevée : les repères sont décalés.
const LEVELS_F = [
  { bf: 12, desc: 'Abdos très marqués' },
  { bf: 16, desc: 'Silhouette athlétique' },
  { bf: 20, desc: 'Abdos légers' },
  { bf: 25, desc: 'Ventre plat' },
  { bf: 30, desc: 'Hanches pleines' },
  { bf: 35, desc: 'Léger ventre' },
  { bf: 40, desc: 'Ventre arrondi' },
  { bf: 45, desc: 'Ventre proéminent' },
];
export const bodyfatLevels = sex => (sex === 'female' ? LEVELS_F : LEVELS_M);
export const bodyfatRange = sex => {
  const l = bodyfatLevels(sex);
  return `de ${l[0].bf} à ${l[l.length - 1].bf} %`;
};

// Silhouette selon le sexe
export function torso(bf, sex) {
  return sex === 'female' ? torsoF(bf) : torsoM(bf);
}

// Silhouette paramétrée par le % de masse grasse
function torsoM(bf) {
  const t = (bf - 8) / 32;                  // 8 % → 0, 40 % → 1
  const cx = 60;
  const chest = 37 + t * 3;
  const waist = 23 + t * 24;               // la taille s'élargit nettement
  const hips = 30 + t * 14;
  const belly = Math.max(0, bf - 22) * 0.55; // ventre qui déborde sur les côtés
  const side = (sgn) => {
    const x = v => cx + sgn * v;
    return [
      `C ${x(14)} 20, ${x(40)} 18, ${x(45)} 28`,          // épaule
      `C ${x(44)} 34, ${x(chest + 1)} 40, ${x(chest)} 46`, // aisselle
      `C ${x(chest - 2)} 64, ${x(waist + 2)} 78, ${x(waist)} 92`,  // flanc → taille
      `C ${x(waist + belly)} 104, ${x(hips + belly * .6)} 114, ${x(hips)} 128`, // hanches
    ];
  };
  const L = side(-1), R = side(1);
  // contour : cou gauche → côté gauche → bas → côté droit (inversé) → cou droit
  const path = `M ${cx - 9} 6 L ${cx - 9} 14 ${L.join(' ')} L ${cx + hips} 128
    C ${cx + hips + belly * .6} 114, ${cx + waist + belly} 104, ${cx + waist} 92
    C ${cx + waist + 2} 78, ${cx + chest - 2} 64, ${cx + chest} 46
    C ${cx + chest + 1} 40, ${cx + 44} 34, ${cx + 45} 28
    C ${cx + 40} 18, ${cx + 14} 20, ${cx + 9} 14 L ${cx + 9} 6 Z`;
  const absOp = Math.max(0, 1 - t * 2.6);   // abdos : visibles jusqu'à ~20 %
  const pecOp = Math.max(.15, 1 - t * 1.4);
  const abs = [70, 81, 92].map(y => `
    <path d="M ${cx - 11} ${y} Q ${cx - 6} ${y + 2} ${cx - 1.5} ${y}" />
    <path d="M ${cx + 1.5} ${y} Q ${cx + 6} ${y + 2} ${cx + 11} ${y}" />`).join('');
  const overhang = bf >= 28 ? `<path d="M ${cx - waist - belly * .4} 112 Q ${cx} ${121 + (bf - 28) * .5} ${cx + waist + belly * .4} 112" opacity="${Math.min(.7, (bf - 26) / 10)}"/>` : '';
  return `<svg viewBox="0 0 120 150" class="bf-svg" aria-hidden="true">
    <path d="${path}" class="bf-skin"/>
    <g class="bf-lines" opacity="${pecOp}">
      <path d="M ${cx - 30} ${50 + t * 6} Q ${cx - 16} ${60 + t * 9} ${cx - 2} ${54 + t * 6}" /><path d="M ${cx + 30} ${50 + t * 6} Q ${cx + 16} ${60 + t * 9} ${cx + 2} ${54 + t * 6}" />
    </g>
    <g class="bf-lines" opacity="${absOp}">
      <path d="M ${cx} 60 L ${cx} 100" />${abs}
    </g>
    <g class="bf-lines">${overhang}<ellipse cx="${cx}" cy="${103 + t * 3}" rx="1.6" ry="${2 + t}" class="bf-navel"/></g>
    <path d="M ${cx - hips - 1} 126 L ${cx + hips + 1} 126 L ${cx + hips + 4} 150 L ${cx - hips - 4} 150 Z" class="bf-shorts"/>
  </svg>`;
}

// Silhouette féminine : épaules plus étroites, taille plus fine, hanches plus larges, brassière.
function torsoF(bf) {
  const t = Math.min(1, Math.max(0, (bf - 12) / 33)); // 12 % → 0, 45 % → 1
  const cx = 60;
  const chest = 31 + t * 5;
  const waist = 21 + t * 20;
  const hips = 34 + t * 16;
  const belly = Math.max(0, bf - 28) * 0.6;
  const L = v => cx - v, R = v => cx + v;
  const path = `M ${L(7.5)} 6 L ${L(7.5)} 15
    C ${L(12)} 20, ${L(32)} 19, ${L(37)} 28
    C ${L(37)} 34, ${L(chest + 1)} 40, ${L(chest)} 47
    C ${L(chest - 2)} 64, ${L(waist + 1)} 76, ${L(waist)} 88
    C ${L(waist + belly)} 100, ${L(hips + belly * .4)} 110, ${L(hips)} 128
    L ${R(hips)} 128
    C ${R(hips + belly * .4)} 110, ${R(waist + belly)} 100, ${R(waist)} 88
    C ${R(waist + 1)} 76, ${R(chest - 2)} 64, ${R(chest)} 47
    C ${R(chest + 1)} 40, ${R(37)} 34, ${R(37)} 28
    C ${R(32)} 19, ${R(12)} 20, ${R(7.5)} 15 L ${R(7.5)} 6 Z`;
  // brassière : bretelles, encolure arrondie, bande sous la poitrine
  const band = 63 + t * 2;
  const bra = `M ${L(chest - .5)} 47 C ${L(chest - 1)} 53, ${L(chest - 1.5)} 59, ${L(chest - 2)} ${band}
    L ${R(chest - 2)} ${band} C ${R(chest - 1.5)} 59, ${R(chest - 1)} 53, ${R(chest - .5)} 47
    L ${R(20)} 26 L ${R(15)} 25 C ${R(14)} 36, ${R(8)} 43, ${cx} 44
    C ${L(8)} 43, ${L(14)} 36, ${L(15)} 25 L ${L(20)} 26 Z`;
  const absOp = Math.max(0, 1 - t * 2.4);    // abdos : visibles jusqu'à ~25 %
  const abs = [74, 84].map(y => `
    <path d="M ${cx - 9} ${y} Q ${cx - 5} ${y + 1.6} ${cx - 1.5} ${y}" />
    <path d="M ${cx + 1.5} ${y} Q ${cx + 5} ${y + 1.6} ${cx + 9} ${y}" />`).join('');
  const overhang = bf >= 36 ? `<path d="M ${cx - waist - belly * .3} 112 Q ${cx} ${119 + (bf - 36) * .45} ${cx + waist + belly * .3} 112" opacity="${Math.min(.65, (bf - 34) / 10)}"/>` : '';
  return `<svg viewBox="0 0 120 150" class="bf-svg" aria-hidden="true">
    <path d="${path}" class="bf-skin"/>
    <path d="${bra}" class="bf-shorts"/>
    <path d="M ${cx - 10} ${band - 6} Q ${cx} ${band - 3} ${cx + 10} ${band - 6}" class="bf-fold"/>
    <g class="bf-lines" opacity="${absOp}">
      <path d="M ${cx} ${band + 5} L ${cx} 96" />${abs}
    </g>
    <g class="bf-lines">${overhang}<ellipse cx="${cx}" cy="${101 + t * 3}" rx="1.5" ry="${1.9 + t}" class="bf-navel"/></g>
    <path d="M ${cx - hips - 1} 126 L ${cx + hips + 1} 126 L ${cx + hips + 5} 150 L ${cx - hips - 5} 150 Z" class="bf-shorts"/>
  </svg>`;
}

// v249 : « Aller plus loin » : mesurer plutôt qu'estimer, avec la masse grasse relative (RFM) de Woolcott et Bergman,
// validée contre le scanner DXA : homme 64 − 20 × taille / tour de taille, femme 76 − 20 × taille / tour de taille.
// Le tour de taille se prend au niveau du haut de l'os de la hanche, comme dans l'étude de validation.
export const rfm = (sex, heightCm, waistCm) => (sex === 'female' ? 76 : 64) - 20 * heightCm / waistCm;

export function openBodyfatGuide(current, onPick, sex = 'male') {
  const LEVELS = bodyfatLevels(sex);
  const closest = LEVELS.reduce((a, l) => Math.abs(l.bf - current) < Math.abs(a.bf - current) ? l : a, LEVELS[0]).bf;
  const m = getActiveMember() || {};
  const near = v => LEVELS.reduce((a, l) => Math.abs(l.bf - v) < Math.abs(a.bf - v) ? l : a, LEVELS[0]);
  let step = 0, waist = m.sex === 'female' ? 80 : 92, height = m.height ? Math.round(m.height * 100) : null;
  const cm = v => String(Math.round(v * 2) / 2).replace('.', ',');
  const stepper = (key, v, lbl) => `<div class="bfm-field"><span>${lbl}</span><div class="bfm-ctl">
      <button class="bfm-b" data-k="${key}" data-d="-0.5" aria-label="moins">−</button>
      <input class="bfm-in" data-in="${key}" type="text" inputmode="decimal" value="${cm(v)}" aria-label="${lbl} en cm"><small>cm</small>
      <button class="bfm-b" data-k="${key}" data-d="0.5" aria-label="plus">+</button></div></div>`;
  const dots = () => `<div class="bfm-dots" aria-hidden="true">${[1, 2, 3].map(i => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div>`;
  const screens = {
    0: () => `<div class="hb-h2">Estimer ta masse grasse</div>
      <p class="hb-p">Touche la silhouette qui te ressemble le plus.</p>
      <div class="bf-grid">
        ${LEVELS.map(l => `
          <button class="bf-card ${l.bf === closest ? 'on' : ''}" data-bf="${l.bf}">
            ${torso(l.bf, sex)}
            <span class="bf-val">${l.bf} %</span>
            <span class="bf-desc">${l.desc}</span>
          </button>`).join('')}
      </div>
      <p class="bf-note">${sex === 'female' ? 'Entre 21 et 31 %, c\'est la moyenne chez une femme. ' : ''}Une estimation à ± 3 % suffit.</p>
      <button class="bf-more" data-go="1"><b>Aller plus loin</b><span>Mesure ta masse grasse avec un mètre ruban, en deux minutes.</span></button>
      <button class="hb-btn bf-close">Fermer</button>`,
    1: () => `${dots()}<div class="hb-h2">Prends un mètre ruban</div>
      <ol class="bfm-steps">
        <li>Un mètre ruban souple, comme en couture.</li>
        <li>Debout, détendu, le ventre ni rentré ni gonflé, sans vêtement épais.</li>
        <li>Ta masse grasse sera calculée avec une formule validée contre un scanner de référence, à partir de ta taille et de ton tour de taille.</li>
      </ol>
      <button class="hb-btn hb-btn-primary" data-go="2">J'ai mon mètre</button>
      <button class="bf-back" data-go="0">Revenir aux silhouettes</button>`,
    2: () => `${dots()}<div class="hb-h2">Mesure ton tour de taille</div>
      <div class="bfm-fig" aria-hidden="true">${hipFig()}</div>
      <p class="hb-p">Repère le haut de l'os de ta hanche, sur le côté. Passe le ruban bien horizontal à ce niveau et lis la mesure à la fin d'une expiration normale, sans serrer.</p>
      ${stepper('waist', waist, 'Tour de taille')}
      ${height ? '' : stepper('height', 175, 'Ta taille')}
      <button class="hb-btn hb-btn-primary" data-go="3">Calculer</button>
      <button class="bf-back" data-go="1">Retour</button>`,
    3: () => {
      const v = rfm(sex, height, waist), r = Math.round(v);
      return `${dots()}<div class="hb-h2">Environ ${r} % de masse grasse</div>
      <div class="bfm-res">
        <div><b>${r} %</b><span>mesuré</span></div>
        <div class="bfm-sil">${torso(near(r).bf, sex)}<span>proche de « ${near(r).desc.toLowerCase()} »</span></div>
      </div>
      <p class="hb-p">Calculé avec ta taille, ${height} cm, et ton tour de taille, ${cm(waist)} cm. Cette mesure donne un ordre de grandeur plus fiable que l'œil : chez la moitié des gens, l'écart avec le scanner reste de quelques points, mais il peut être plus grand si tu es très sec, très musclé ou plus âgé.</p>
      <button class="hb-btn hb-btn-primary" data-pick="${r}">Utiliser ${r} %</button>
      <button class="bf-back" data-go="2">Refaire la mesure</button>`;
    },
  };
  openSheet('<div class="sheet-handle"></div><div class="hb-sheet-pad bf-sheet"></div>');
  const pad = document.querySelector('#sheet .bf-sheet');
  const render = () => {
    if (step === 3 && (!height || height < 120 || height > 230 || waist < 50 || waist > 200)) step = 2;
    pad.innerHTML = screens[step]();
    pad.querySelector('.bf-close')?.addEventListener('click', closeSheet);
    pad.querySelectorAll('[data-bf]').forEach(b => b.addEventListener('click', () => { closeSheet(); onPick(+b.dataset.bf); }));
    pad.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => { closeSheet(); onPick(+b.dataset.pick); }));
    pad.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { step = +b.dataset.go; render(); document.getElementById('sheet')?.scrollTo(0, 0); }));
    const set = (k, v) => { v = Math.round(v * 2) / 2; if (k === 'waist') waist = v; else height = v; };
    pad.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.k; set(k, (k === 'waist' ? waist : (height || 175)) + +b.dataset.d);
      pad.querySelector(`[data-in="${k}"]`).value = cm(k === 'waist' ? waist : height);
    }));
    pad.querySelectorAll('[data-in]').forEach(i => i.addEventListener('change', () => { const v = parseFloat(i.value.replace(',', '.')); if (v > 0) set(i.dataset.in, v); i.value = cm(i.dataset.in === 'waist' ? waist : height); }));
  };
  render();
}

// petit dessin : un bassin vu de face, le ruban posé au niveau du haut de l'os de la hanche
function hipFig() {
  return `<svg viewBox="0 0 220 120" class="bfm-svg">
    <path d="M70 6 C66 40 60 58 56 74 C52 92 58 112 64 118 M150 6 C154 40 160 58 164 74 C168 92 162 112 156 118" fill="none" stroke="#3E5A48" stroke-width="2" stroke-linecap="round"/>
    <path d="M66 70 C78 60 92 58 98 66 M154 70 C142 60 128 58 122 66" fill="none" stroke="#B79B5E" stroke-width="2" stroke-linecap="round"/>
    <circle cx="64" cy="70" r="4" fill="#C8704F"/><circle cx="156" cy="70" r="4" fill="#C8704F"/>
    <path d="M52 70 Q110 80 168 70" fill="none" stroke="#E8C97E" stroke-width="7" stroke-linecap="round"/>
    <path d="M52 70 Q110 80 168 70" fill="none" stroke="#B79B5E" stroke-width="1" stroke-dasharray="2 4"/>
    <text x="172" y="60" font-family="Georgia, serif" font-style="italic" font-size="12" fill="#C8704F">haut de</text>
    <text x="172" y="74" font-family="Georgia, serif" font-style="italic" font-size="12" fill="#C8704F">la hanche</text>
    <circle cx="110" cy="52" r="3" fill="none" stroke="#3E5A48" stroke-width="1.5"/><text x="110" y="40" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="11" fill="#8A7655">nombril</text>
  </svg>`;
}

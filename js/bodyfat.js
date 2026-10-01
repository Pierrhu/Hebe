// bodyfat.js — Aide visuelle pour estimer sa masse grasse (morphologie masculine, de face).
// Les silhouettes sont dessinées en SVG : la taille s'épaissit et les abdos s'estompent avec le %.

import { openSheet, closeSheet } from './utils.js';

const LEVELS = [
  { bf: 8,  desc: 'Très sec, abdos très marqués' },
  { bf: 10, desc: 'Abdos bien dessinés' },
  { bf: 15, desc: 'Abdos visibles, taille marquée' },
  { bf: 20, desc: 'Ventre plat, abdos à peine devinés' },
  { bf: 25, desc: 'Léger ventre, poignées d\'amour' },
  { bf: 30, desc: 'Ventre arrondi, taille épaissie' },
  { bf: 35, desc: 'Ventre marqué, plus de définition' },
  { bf: 40, desc: 'Ventre proéminent, poitrine plus grasse' },
];

// Silhouette paramétrée par le % de masse grasse
export function torso(bf) {
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

export function openBodyfatGuide(current, onPick) {
  const closest = LEVELS.reduce((a, l) => Math.abs(l.bf - current) < Math.abs(a.bf - current) ? l : a, LEVELS[0]).bf;
  openSheet(`
    <div class="sheet-handle"></div>
    <div class="hb-sheet-pad">
      <div class="hb-h2">Estimer ta masse grasse</div>
      <p class="hb-p">Regarde-toi de face dans un miroir, debout et détendu, idéalement le matin. Touche la silhouette la plus proche ; entre deux, ajuste ensuite d'un point avec + et −.</p>
      <div class="bf-grid">
        ${LEVELS.map(l => `
          <button class="bf-card ${l.bf === closest ? 'on' : ''}" data-bf="${l.bf}">
            ${torso(l.bf)}
            <span class="bf-val">${l.bf} %</span>
            <span class="bf-desc">${l.desc}</span>
          </button>`).join('')}
      </div>
      <p class="bf-note">C'est une estimation à ± 3 %, suffisante pour calculer tes besoins. L'important est de rester cohérent d'une mesure à l'autre.</p>
      <button class="hb-btn bf-close">Fermer</button>
    </div>`);
  const sheet = document.getElementById('sheet');
  sheet.querySelector('.bf-close').addEventListener('click', closeSheet);
  sheet.querySelectorAll('[data-bf]').forEach(b => b.addEventListener('click', () => {
    closeSheet();
    onPick(+b.dataset.bf);
  }));
}

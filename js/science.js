// science.js — v236-v239 : fiche « Comment Hébé calcule », pour ceux que ça intéresse.
// v239 : ton calcul ligne par ligne, façon livre de comptes, puis une petite planche dessinée par règle,
// avec tes propres chiffres. Chaque règle renvoie à ses sources (pastilles numérotées).

import { openSheet, closeSheet } from './utils.js';
import { getActiveMember, ACTIVITY } from '../data/household.js';
import { computeBase, computeDetails, getProtocol } from '../data/calculator.js';
import { getTargetsFor } from '../data/user.js';
import { getWeights } from './weight.js';

const SOURCES = [
  'Roza AM, Shizgal HM. The Harris Benedict equation reevaluated: resting energy requirements and the body cell mass. Am J Clin Nutr. 1984;40(1):168-182.',
  'McArdle WD, Katch FI, Katch VL. Exercise Physiology: Nutrition, Energy, and Human Performance. Lippincott Williams & Wilkins.',
  'Mifflin MD, St Jeor ST, Hill LA, et al. A new predictive equation for resting energy expenditure in healthy individuals. Am J Clin Nutr. 1990;51(2):241-247.',
  'FAO, OMS, UNU. Human energy requirements. Report of a Joint FAO/WHO/UNU Expert Consultation. Rome, 2004.',
  'Morton RW, Murphy KT, McKellar SR, et al. A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength in healthy adults. Br J Sports Med. 2018;52(6):376-384.',
  'Jäger R, Kerksick CM, Campbell BI, et al. International Society of Sports Nutrition Position Stand: protein and exercise. J Int Soc Sports Nutr. 2017;14:20.',
  'Helms ER, Zinn C, Rowlands DS, Brown SR. A systematic review of dietary protein during caloric restriction in resistance trained lean athletes: a case for higher intakes. Int J Sport Nutr Exerc Metab. 2014;24(2):127-138.',
  'EFSA. Scientific Opinion on Dietary Reference Values for fats. EFSA Journal. 2010;8(3):1461.',
  'EFSA. Scientific Opinion on Dietary Reference Values for carbohydrates and dietary fibre. EFSA Journal. 2010;8(3):1462.',
  'Iraki J, Fitschen P, Espinar S, Helms E. Nutrition recommendations for bodybuilders in the off-season: a narrative review. Sports. 2019;7(7):154.',
  'Barakat C, Pearson J, Escalante G, Campbell B, De Souza EO. Body recomposition: can trained individuals build muscle and lose fat at the same time? Strength Cond J. 2020;42(5):7-21.',
  'Helms ER, Aragon AA, Fitschen PJ. Evidence-based recommendations for natural bodybuilding contest preparation: nutrition and supplementation. J Int Soc Sports Nutr. 2014;11:20.',
  'Wishnofsky M. Caloric equivalents of gained or lost weight. Am J Clin Nutr. 1958;6(5):542-546.',
  'Hall KD, Sacks G, Chandramohan D, et al. Quantification of the effect of energy imbalance on bodyweight. Lancet. 2011;378(9793):826-837.',
  'NHLBI. Clinical Guidelines on the Identification, Evaluation, and Treatment of Overweight and Obesity in Adults. National Institutes of Health, 1998.',
  'Anses. Table de composition nutritionnelle des aliments Ciqual.',
  'USDA. FoodData Central.',
  'USDA FSIS. Leftovers and Food Safety.',
];

const srcHtml = t => {
  const m = t.match(/^(.*?\. )(.*?\. )(.*)$/);
  return m ? `<span class="sci-au">${m[1]}</span>${m[2]}<em>${m[3]}</em>` : t;
};
const nf = v => Math.round(v).toLocaleString('fr-FR');
const dec = (v, d = 1) => v.toFixed(d).replace('.', ',');
const pills = (...n) => n.map(x => `<button class="sci-ref" data-ref="${x}" aria-label="Source ${x}">${x}</button>`).join('');

// ── petites planches dessinées (SVG), à l'encre vert sapin et terracotta sur papier ──
const INK = '#3E5A48', TERRA = '#C8704F', OCHRE = '#B79B5E', FAINT = '#DCCBAA';

// répartition de ton assiette : barre en trois couleurs + repères européens pour les lipides
function macroBar(t) {
  const P = t.protein * 4, G = t.carbs * 4, L = t.fat * 9, T = P + G + L, W = 300;
  const w = v => v / T * W;
  const pct = v => Math.round(v / T * 100);
  const x20 = 0.20 * W, x35 = 0.35 * W; // lipides en premier : 20 à 35 % des calories
  return `<svg viewBox="0 0 320 92" class="sci-svg" aria-hidden="true">
    <rect x="10" y="22" width="${w(L)}" height="22" rx="4" fill="${OCHRE}"/>
    <rect x="${10 + w(L)}" y="22" width="${w(P)}" height="22" fill="${INK}"/>
    <rect x="${10 + w(L) + w(P)}" y="22" width="${w(G)}" height="22" rx="4" fill="#9DB7A3"/>
    <text x="${10 + w(L) / 2}" y="37" text-anchor="middle" class="sv-in">${pct(L)} %</text>
    <text x="${10 + w(L) + w(P) / 2}" y="37" text-anchor="middle" class="sv-in">${pct(P)} %</text>
    <text x="${10 + w(L) + w(P) + w(G) / 2}" y="37" text-anchor="middle" class="sv-in dk">${pct(G)} %</text>
    <text x="10" y="14" class="sv-l">lipides</text><text x="${10 + w(L) + 4}" y="14" class="sv-l">protéines</text><text x="310" y="14" text-anchor="end" class="sv-l">glucides</text>
    <path d="M${10 + x20} 50 v10 M${10 + x35} 50 v10 M${10 + x20} 55 H${10 + x35}" stroke="${TERRA}" stroke-width="1.4" fill="none"/>
    <text x="${10 + (x20 + x35) / 2}" y="74" text-anchor="middle" class="sv-t">repère européen des lipides : 20 à 35 %</text>
  </svg>`;
}

// échelle des programmes de −20 % à +10 %, ton réglage marqué
function programScale(pct) {
  const X = v => 20 + (v + 0.20) / 0.30 * 280;
  const ticks = [-0.20, -0.15, -0.10, -0.05, 0, 0.05, 0.10];
  return `<svg viewBox="0 0 320 84" class="sci-svg" aria-hidden="true">
    <rect x="${X(-0.20)}" y="30" width="${X(-0.10) - X(-0.20)}" height="10" fill="#EAD9CF"/>
    <rect x="${X(-0.10)}" y="30" width="${X(0) - X(-0.10)}" height="10" fill="#F1E6D2"/>
    <rect x="${X(0)}" y="30" width="${X(0.10) - X(0)}" height="10" fill="#DCE8DF"/>
    <line x1="${X(-0.20)}" y1="40" x2="${X(0.10)}" y2="40" stroke="${INK}" stroke-width="1.2"/>
    ${ticks.map(v => `<line x1="${X(v)}" y1="40" x2="${X(v)}" y2="${v === 0 ? 48 : 45}" stroke="${INK}" stroke-width="${v === 0 ? 1.4 : 1}"/><text x="${X(v)}" y="60" text-anchor="middle" class="sv-t">${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(Math.round(v * 100))} %</text>`).join('')}
    <text x="${(X(-0.20) + X(-0.10)) / 2}" y="24" text-anchor="middle" class="sv-l">sèche</text>
    <text x="${(X(-0.10) + X(0)) / 2}" y="24" text-anchor="middle" class="sv-l">recompo</text>
    <text x="${(X(0) + X(0.10)) / 2}" y="24" text-anchor="middle" class="sv-l">muscle</text>
    <path d="M${X(pct)} 28 l-6 -9 h12 z" fill="${TERRA}"/>
    <text x="${X(pct)}" y="78" text-anchor="middle" class="sv-k">toi</text>
  </svg>`;
}

// courbe de poids et sa tendance (tes pesées, sinon un exemple)
function trendCurve(ws) {
  const real = ws.length >= 3;
  const pts = real ? ws.slice(-8).map(w => w.kg) : [80, 79.6, 79.9, 79.2, 79.0, 78.7, 78.9, 78.3];
  const lo = Math.min(...pts) - 0.3, hi = Math.max(...pts) + 0.3, n = pts.length;
  const X = i => 22 + i * (276 / (n - 1)), Y = v => 14 + (hi - v) / (hi - lo) * 52;
  const mx = (n - 1) / 2, my = pts.reduce((a, b) => a + b, 0) / n;
  const sl = pts.reduce((a, v, i) => a + (i - mx) * (v - my), 0) / pts.reduce((a, _, i) => a + (i - mx) ** 2, 0);
  const t0 = my - sl * mx, t1 = my + sl * (n - 1 - mx);
  return `<svg viewBox="0 0 320 92" class="sci-svg" aria-hidden="true">
    <polyline points="${pts.map((v, i) => `${X(i)},${Y(v)}`).join(' ')}" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>
    ${pts.map((v, i) => `<path d="M${X(i) - 3} ${Y(v) - 3} l6 6 M${X(i) + 3} ${Y(v) - 3} l-6 6" stroke="${INK}" stroke-width="1.3"/>`).join('')}
    <line x1="${X(0)}" y1="${Y(t0)}" x2="${X(n - 1)}" y2="${Y(t1)}" stroke="${TERRA}" stroke-width="1.6" stroke-dasharray="5 4"/>
    <text x="22" y="86" class="sv-t">${real ? 'tes dernières pesées' : 'exemple'}</text>
    <text x="298" y="86" text-anchor="end" class="sv-k">tendance</text>
  </svg>`;
}

// plancher : barre de ton objectif au-dessus du minimum
function floorBar(kcal, floor) {
  const max = Math.max(kcal, floor) * 1.15, X = v => 20 + v / max * 280;
  return `<svg viewBox="0 0 320 70" class="sci-svg" aria-hidden="true">
    <rect x="20" y="18" width="${X(kcal) - 20}" height="18" rx="4" fill="#9DB7A3"/>
    <text x="${X(kcal) - 6}" y="31" text-anchor="end" class="sv-in dk">${nf(kcal)} kcal</text>
    <line x1="${X(floor)}" y1="8" x2="${X(floor)}" y2="46" stroke="${TERRA}" stroke-width="2"/>
    <path d="M${X(floor) - 5} 46 h10" stroke="${TERRA}" stroke-width="2"/>
    <text x="${X(floor)}" y="62" text-anchor="middle" class="sv-k">plancher ${nf(floor)}</text>
  </svg>`;
}

// conservation : trois jours au frigo, puis le congélateur
function sciFridge() {
  const d = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  return `<svg viewBox="0 0 320 64" class="sci-svg" aria-hidden="true">
    ${d.map((x, i) => { const cold = i >= 3, X = 14 + i * 42; return `<rect x="${X}" y="10" width="36" height="30" rx="7" fill="${cold ? '#E3EEF8' : '#DCE8DF'}" stroke="${cold ? '#6F9FC9' : INK}" stroke-width="1"/>
      <text x="${X + 18}" y="30" text-anchor="middle" class="sv-l">${x}</text>`; }).join('')}
    <text x="${14 + 1.5 * 42 + 18}" y="56" text-anchor="middle" class="sv-k">au frigo</text>
    <text x="${14 + 4.5 * 42 + 18}" y="56" text-anchor="middle" class="sv-t">sorti du congélateur la veille</text>
  </svg>`;
}

export function openScienceSheet() {
  const m = getActiveMember();
  const ok = m && m.weight && m.height && m.age && m.bodyfat != null;
  const b = ok ? computeBase(m) : null;
  const proto = getProtocol(m?.protocol || 'P4');
  const phase = proto.phases[Math.min(+(m?.phase || 0), proto.phases.length - 1)];
  const det = ok ? computeDetails(m, proto.id, +(m.phase || 0)) : null;
  const t = ok ? getTargetsFor(m) : null;
  const act = ACTIVITY.find(a => a.level === (m?.activity ?? 2)) || ACTIVITY[1];
  const delta = ok ? det.targets.kcal - Math.round(b.maintenance) : 0;

  // ton calcul, ligne par ligne, avec des pointillés comme dans un livre de comptes
  const row = (label, val, refs = '', cls = '') => `<div class="sl-row ${cls}"><span class="sl-k">${label}${refs}</span><i></i><span class="sl-v">${val}</span></div>`;
  const ledger = ok ? `<div class="sci-ledger">
      <div class="sl-head"><span>Ton calcul</span><em>${m.name || ''}</em></div>
      ${row('Dépense au repos', `${nf(b.bmr)} kcal`, pills(1, 2, 3))}
      ${row(`Activité, ${act.label.toLowerCase()}`, `× ${dec(b.coef * b.adj, 2).replace(/0$/, '')}`, pills(4))}
      ${row('Dépense de la journée', `${nf(b.maintenance)} kcal`, '', 'sl-sum')}
      ${row(`${proto.name}, ${phase.label.toLowerCase()}`, `${delta >= 0 ? '+' : '−'} ${nf(Math.abs(delta))} kcal`, pills(10, 11, 12))}
      ${row('Ton objectif', `${nf(t.kcal)} kcal`, '', 'sl-total')}
      <div class="sl-macros">
        <div><b>${t.protein} g</b><span>protéines</span></div>
        <div><b>${t.carbs} g</b><span>glucides</span></div>
        <div><b>${t.fat} g</b><span>lipides</span></div>
      </div>
      ${m.targets ? '<p class="sl-note">Tes calories sont réglées à la main : Hébé affiche ici ton réglage.</p>' : ''}
    </div>` : '';

  const sec = (n, title, art, text) => `<section class="sci-card">
      <h3><span class="sci-n">${n}</span>${title}</h3>
      ${art ? `<div class="sci-art">${art}</div>` : ''}
      <p>${text}</p>
    </section>`;
  const prot = ok ? `${t.protein} g, soit ${dec(t.protein / b.leanMass)} g par kg de masse maigre et ${dec(t.protein / m.weight)} g par kg de poids. ` : '';

  openSheet(`<div class="sheet-handle"></div><div class="hb-sheet-pad sci">
    <div class="sci-label">
      <div class="sci-label-in">
        <span class="sci-kick">Hébé, notice</span>
        <div class="sci-title">Comment Hébé calcule</div>
        <p class="sci-sub">Tous les chiffres de l'app viennent de règles publiées et reconnues. Voici les tiens, ligne par ligne.</p>
        <span class="sci-stamp">${SOURCES.length} sources</span>
      </div>
    </div>
    ${ledger}
    ${sec(1, 'Deux formules plutôt qu\'une', '', `Ta dépense au repos est la moyenne de Harris-Benedict révisée, qui part du poids, de la taille et de l'âge${pills(1)}, et de Katch-McArdle, qui part de la masse maigre${pills(2)}. La moyenne limite l'erreur de chacune, en particulier sur la masse grasse estimée, et reste proche de Mifflin-St Jeor, la référence actuelle${pills(3)}. Le coefficient d'activité, de 1,35 à 1,8, suit les fourchettes de la FAO et de l'OMS${pills(4)}.`)}
    ${sec(2, 'Ton assiette', ok ? macroBar(t) : '', `${prot}C'est la zone où la prise de muscle est maximale${pills(5, 6)}. En perte de gras, les profils déjà secs montent à au moins 2,3 g par kg de masse maigre${pills(7)}. Les lipides ne descendent jamais sous 20 % des calories pour un homme et 25 % pour une femme${pills(8)}, les glucides complètent le reste${pills(9)}.`)}
    ${sec(3, 'Des écarts mesurés', programScale(phase.pct), `Un surplus de 5 à 10 % pour prendre du muscle en limitant le gras${pills(10)}, un déficit de 10 % pour la recomposition${pills(11)}, et de 10 à 20 % pour perdre du gras, autour de 0,5 % du poids par semaine pour préserver le muscle${pills(12)}.`)}
    ${sec(4, 'Le corps a toujours raison', trendCurve(ok ? getWeights(m.id) : []), `Un kilo de variation correspond à environ 7 700 kcal${pills(13)}. Hébé compare ce que prévoit ton plan à la tendance de tes pesées sur deux à quatre semaines, en ignorant la première, où l'on perd surtout de l'eau${pills(14)}. La correction est lissée et ne dépasse jamais 15 %.`)}
    ${sec(5, 'Un plancher, toujours', ok ? floorBar(t.kcal, det.floor) : '', `Jamais moins que ta dépense au repos, ni moins de 1 200 kcal pour une femme et 1 500 kcal pour un homme, les planchers habituels des régimes sans suivi médical${pills(15)}.`)}
    ${sec(6, 'Des aliments bien mesurés', sciFridge(), `Les valeurs nutritionnelles viennent des tables Ciqual de l'Anses${pills(16)} et de la base de l'USDA${pills(17)}. Les plats préparés se gardent 3 jours au frigo, le reste passe par le congélateur${pills(18)}.`)}
    <p class="sci-note">Ces calculs donnent un point de départ fiable pour un adulte en bonne santé. Ils ne remplacent pas l'avis d'un médecin ou d'un diététicien, notamment en cas de grossesse, de maladie ou de troubles alimentaires.</p>
    <details class="sci-src"><summary>Voir les ${SOURCES.length} sources</summary>
      <ol>${SOURCES.map((x, i) => `<li id="sci-s${i + 1}">${srcHtml(x)}</li>`).join('')}</ol>
    </details>
    <button class="hb-btn hb-btn-primary sci-close">Fermer</button>
  </div>`);
  const sh = document.getElementById('sheet');
  sh.querySelector('.sci-close')?.addEventListener('click', closeSheet);
  // toucher un numéro ouvre la liste et montre la source
  sh.querySelectorAll('[data-ref]').forEach(btn => btn.addEventListener('click', () => {
    sh.querySelector('.sci-src').open = true;
    const li = sh.querySelector(`#sci-s${btn.dataset.ref}`);
    sh.querySelectorAll('.sci-src li.hl').forEach(x => x.classList.remove('hl'));
    li?.classList.add('hl'); li?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }));
}

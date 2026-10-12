// science.js — v236-v239 : fiche « Comment Hébé calcule », pour ceux que ça intéresse.
// v239 : ton calcul ligne par ligne, façon livre de comptes, puis une petite planche dessinée par règle,
// avec tes propres chiffres. Chaque règle renvoie à ses sources (pastilles numérotées).

import { openSheet, closeSheet } from './utils.js';
import { getActiveMember, ACTIVITY } from '../data/household.js';
import { computeBase, computeDetails, getProtocol } from '../data/calculator.js';
import { getTargetsFor } from '../data/user.js';
import { getWeights } from './weight.js';
import { PLATE_SHARE, BREAKFAST_SHARE } from './optimizer.js';

// Références vérifiées une à une (Europe PMC, Crossref, sites officiels), octobre 2026.
// Elles sont numérotées dans l'ordre où la fiche les cite.
const SRC = {
  roza: ['Roza AM, Shizgal HM. The Harris Benedict equation reevaluated: resting energy requirements and the body cell mass. Am J Clin Nutr. 1984;40(1):168-182.', 'https://doi.org/10.1093/ajcn/40.1.168'],
  mcardle: ['McArdle WD, Katch FI, Katch VL. Exercise Physiology: Nutrition, Energy, and Human Performance. 9e éd. Wolters Kluwer. 2023.', ''],
  mifflin: ['Mifflin MD, St Jeor ST, Hill LA, et al. A new predictive equation for resting energy expenditure in healthy individuals. Am J Clin Nutr. 1990;51(2):241-247.', 'https://doi.org/10.1093/ajcn/51.2.241'],
  frankenfield: ['Frankenfield D, Roth-Yousey L, Compher C. Comparison of predictive equations for resting metabolic rate in healthy nonobese and obese adults: a systematic review. J Am Diet Assoc. 2005;105(5):775-789.', 'https://doi.org/10.1016/j.jada.2005.02.005'],
  oneill: ["O'Neill JER, Corish CA, Horner K. Accuracy of resting metabolic rate prediction equations in athletes: a systematic review with meta-analysis. Sports Med. 2023;53(12):2373-2398.", 'https://doi.org/10.1007/s40279-023-01896-z'],
  fao: ['FAO, OMS, UNU. Human energy requirements. Report of a Joint FAO/WHO/UNU Expert Consultation. FAO Food and Nutrition Technical Report Series 1. Rome. 2004.', 'https://www.fao.org/4/y5686e/y5686e00.htm'],
  morton: ['Morton RW, Murphy KT, McKellar SR, et al. A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength in healthy adults. Br J Sports Med. 2018;52(6):376-384.', 'https://doi.org/10.1136/bjsports-2017-097608'],
  nunes: ['Nunes EA, Colenso-Semple L, McKellar SR, et al. Systematic review and meta-analysis of protein intake to support muscle mass and function in healthy adults. J Cachexia Sarcopenia Muscle. 2022;13(2):795-810.', 'https://doi.org/10.1002/jcsm.12922'],
  jager: ['Jäger R, Kerksick CM, Campbell BI, et al. International Society of Sports Nutrition Position Stand: protein and exercise. J Int Soc Sports Nutr. 2017;14:20.', 'https://doi.org/10.1186/s12970-017-0177-8'],
  helms14a: ['Helms ER, Zinn C, Rowlands DS, Brown SR. A systematic review of dietary protein during caloric restriction in resistance trained lean athletes: a case for higher intakes. Int J Sport Nutr Exerc Metab. 2014;24(2):127-138.', 'https://doi.org/10.1123/ijsnem.2013-0054'],
  efsaF: ['EFSA NDA Panel. Scientific Opinion on Dietary Reference Values for fats, including saturated fatty acids, polyunsaturated fatty acids, monounsaturated fatty acids, trans fatty acids, and cholesterol. EFSA J. 2010;8(3):1461.', 'https://doi.org/10.2903/j.efsa.2010.1461'],
  efsaC: ['EFSA NDA Panel. Scientific Opinion on Dietary Reference Values for carbohydrates and dietary fibre. EFSA J. 2010;8(3):1462.', 'https://doi.org/10.2903/j.efsa.2010.1462'],
  iraki: ['Iraki J, Fitschen P, Espinar S, Helms E. Nutrition recommendations for bodybuilders in the off-season: a narrative review. Sports (Basel). 2019;7(7):154.', 'https://doi.org/10.3390/sports7070154'],
  helms23: ['Helms ER, Spence AJ, Sousa C, et al. Effect of small and large energy surpluses on strength, muscle, and skinfold thickness in resistance-trained individuals: a parallel groups design. Sports Med Open. 2023;9(1):102.', 'https://doi.org/10.1186/s40798-023-00651-y'],
  barakat: ['Barakat C, Pearson J, Escalante G, Campbell B, De Souza EO. Body recomposition: can trained individuals build muscle and lose fat at the same time? Strength Cond J. 2020;42(5):7-21.', 'https://doi.org/10.1519/SSC.0000000000000584'],
  helms14b: ['Helms ER, Aragon AA, Fitschen PJ. Evidence-based recommendations for natural bodybuilding contest preparation: nutrition and supplementation. J Int Soc Sports Nutr. 2014;11:20.', 'https://doi.org/10.1186/1550-2783-11-20'],
  garthe: ['Garthe I, Raastad T, Refsnes PE, Koivisto A, Sundgot-Borgen J. Effect of two different weight-loss rates on body composition and strength and power-related performance in elite athletes. Int J Sport Nutr Exerc Metab. 2011;21(2):97-104.', 'https://doi.org/10.1123/ijsnem.21.2.97'],
  murphy: ['Murphy C, Koehler K. Energy deficiency impairs resistance training gains in lean mass but not strength: a meta-analysis and meta-regression. Scand J Med Sci Sports. 2022;32(1):125-137.', 'https://doi.org/10.1111/sms.14075'],
  wish: ['Wishnofsky M. Caloric equivalents of gained or lost weight. Am J Clin Nutr. 1958;6(5):542-546.', 'https://doi.org/10.1093/ajcn/6.5.542'],
  thomas: ['Thomas DM, Martin CK, Lettieri S, et al. Can a weight loss of one pound a week be achieved with a 3500-kcal deficit? Commentary on a commonly accepted rule. Int J Obes (Lond). 2013;37(12):1611-1613.', 'https://doi.org/10.1038/ijo.2013.51'],
  hall: ['Hall KD, Sacks G, Chandramohan D, et al. Quantification of the effect of energy imbalance on bodyweight. Lancet. 2011;378(9793):826-837.', 'https://doi.org/10.1016/S0140-6736(11)60812-X'],
  jensen: ['Jensen MD, Ryan DH, Apovian CM, et al. 2013 AHA/ACC/TOS guideline for the management of overweight and obesity in adults. Circulation. 2014;129(25 Suppl 2):S102-S138.', 'https://doi.org/10.1161/01.cir.0000437739.71477.ee'],
  ciqual: ['Anses. Table de composition nutritionnelle des aliments Ciqual.', 'https://ciqual.anses.fr/'],
  fdc: ['USDA, Agricultural Research Service. FoodData Central.', 'https://fdc.nal.usda.gov/'],
  fsis: ['USDA FSIS. Leftovers and Food Safety.', 'https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/leftovers-and-food-safety'],
  cunningham: ['Cunningham JJ. Body composition as a determinant of energy expenditure: a synthetic review and a proposed general prediction equation. Am J Clin Nutr. 1991;54(6):963-969.', 'https://doi.org/10.1093/ajcn/54.6.963'],
  liu: ['Liu D, Huang Y, Huang C, et al. Calorie restriction with or without time-restricted eating in weight loss. N Engl J Med. 2022;386(16):1495-1504.', 'https://doi.org/10.1056/NEJMoa2114833'],
  semnani: ['Semnani-Azad Z, Khan TA, Chiavaroli L, et al. Intermittent fasting strategies and their effects on body weight and other cardiometabolic risk factors: systematic review and network meta-analysis of randomised clinical trials. BMJ. 2025;389:e082007.', 'https://doi.org/10.1136/bmj-2024-082007'],
  ashtary: ['Ashtary-Larky D, Bagheri R, Tinsley GM, et al. Effects of intermittent fasting combined with resistance training on body composition: a systematic review and meta-analysis. Physiol Behav. 2021;237:113453.', 'https://doi.org/10.1016/j.physbeh.2021.113453'],
  tinsley19: ['Tinsley GM, Moore ML, Graybeal AJ, et al. Time-restricted feeding plus resistance training in active females: a randomized trial. Am J Clin Nutr. 2019;110(3):628-640.', 'https://doi.org/10.1093/ajcn/nqz126'],
  lowe: ['Lowe DA, Wu N, Rohdin-Bibby L, et al. Effects of time-restricted eating on weight loss and other metabolic parameters in women and men with overweight and obesity: the TREAT randomized clinical trial. JAMA Intern Med. 2020;180(11):1491-1499.', 'https://doi.org/10.1001/jamainternmed.2020.4153'],
  schoenfeld: ['Schoenfeld BJ, Aragon AA. How much protein can the body use in a single meal for muscle-building? Implications for daily protein distribution. J Int Soc Sports Nutr. 2018;15:10.', 'https://doi.org/10.1186/s12970-018-0215-1'],
  foodsafety: ['U.S. Department of Health and Human Services. 4 Steps to Food Safety. FoodSafety.gov. 2023.', 'https://www.foodsafety.gov/keep-food-safe/4-steps-to-food-safety'],
  ansesBc: ["Anses. Qu'est-ce que Bacillus cereus et comment s'en prémunir ? 2026.", 'https://www.anses.fr/fr/content/qu-est-ce-que-bacillus-cereus-et-comment-s-en-premunir'],
  ansesFiche: ['Anses. Fiche de description de danger biologique transmissible par les aliments : Bacillus cereus. Mise à jour 2021.', 'https://www.anses.fr/system/files/BIORISK2016SA0075Fi.pdf'],
  siedler: ['Siedler MR, Rodriguez C, Stratton MT, et al. Assessing the reliability and cross-sectional and longitudinal validity of fifteen bioelectrical impedance analysis devices. Br J Nutr. 2023;130(5):827-840.', 'https://doi.org/10.1017/S0007114522003749'],
  tinsley21: ['Tinsley GM. Five-component model validation of reference, laboratory and field methods of body composition assessment. Br J Nutr. 2021;125(11):1246-1259.', 'https://doi.org/10.1017/S0007114520003578'],
  blue: ['Blue MNM, Hirsch KR, Brewer GJ, et al. The validation of contemporary body composition methods in various races and ethnicities. Br J Nutr. 2022;128(12):2387-2397.', 'https://doi.org/10.1017/S0007114522000368'],
  fernandes: ['Fernandes-Alves D, Teixeira GP, Guimarães KC, Crispim CA. Systematic review and meta-analysis of randomized clinical trials comparing time-restricted eating with and without caloric restriction for weight loss. Nutr Rev. 2026;84(3):463-486.', 'https://doi.org/10.1093/nutrit/nuaf053'],
  kim: ['Kim KK, Kang JH, Kim EM. Updated meta-analysis of studies from 2011 to 2021 comparing the effectiveness of intermittent energy restriction and continuous energy restriction. J Obes Metab Syndr. 2022;31(3):230-244.', 'https://doi.org/10.7570/jomes22050'],
  kyle: ['Kyle UG, Bosaeus I, De Lorenzo AD, et al. Bioelectrical impedance analysis, part I: review of principles and methods. Clin Nutr. 2004;23(5):1226-1243.', 'https://doi.org/10.1016/j.clnu.2004.06.004'],
};

const srcHtml = ([t, url]) => {
  const m = t.match(/^(.*?\. )(.*?\. )(.*)$/);
  const body = m ? `<span class="sci-au">${m[1]}</span>${m[2]}<em>${m[3]}</em>` : t;
  const link = url ? ` <a href="${url}" target="_blank" rel="noopener">${url.startsWith('https://doi.org/') ? 'doi' : 'lien'}</a>` : '';
  return body + link;
};
const nf = v => Math.round(v).toLocaleString('fr-FR');
const dec = (v, d = 1) => v.toFixed(d).replace('.', ',');
// numéros attribués à la première citation ; ORDER garde l'ordre pour la liste en bas
let ORDER = [];
const num = k => { if (!SRC[k]) throw new Error('source inconnue ' + k); let i = ORDER.indexOf(k); if (i < 0) { ORDER.push(k); i = ORDER.length - 1; } return i + 1; };
const pills = (...ks) => ks.map(k => { const n = num(k); return `<button class="sci-ref" data-ref="${n}" aria-label="Source ${n}">${n}</button>`; }).join('');

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
    <text x="${(X(-0.20) + X(-0.10)) / 2}" y="18" text-anchor="middle" class="sv-l">sèche</text>
    <text x="${(X(-0.10) + X(0)) / 2}" y="18" text-anchor="middle" class="sv-l">recompo</text>
    <text x="${(X(0) + X(0.10)) / 2}" y="18" text-anchor="middle" class="sv-l">muscle</text>
    <line x1="${X(pct)}" y1="26" x2="${X(pct)}" y2="47" stroke="${TERRA}" stroke-width="2.4"/>
    <circle cx="${X(pct)}" cy="26" r="4.5" fill="${TERRA}"/>
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
    ${X(kcal) - X(floor) > 70 ? `<text x="${X(kcal) - 6}" y="31" text-anchor="end" class="sv-in dk">${nf(kcal)} kcal</text>` : `<text x="26" y="31" class="sv-in dk">${nf(kcal)} kcal</text>`}
    <line x1="${X(floor)}" y1="8" x2="${X(floor)}" y2="46" stroke="${TERRA}" stroke-width="2"/>
    <path d="M${X(floor) - 5} 46 h10" stroke="${TERRA}" stroke-width="2"/>
    <text x="${X(floor)}" y="62" text-anchor="middle" class="sv-k">plancher ${nf(floor)}</text>
  </svg>`;
}

// v243 : les trois dernières planches reprennent le style des premières (axe à l'encre, bandes pâles,
// repères terracotta, légendes en italique)

// jeûne 16:8 : les assiettes de la journée, dessinées à la taille de leurs calories
function fastPlates(kcal) {
  const J = PLATE_SHARE.jeune, C = PLATE_SHARE.classique, B = BREAKFAST_SHARE;
  const rows = [
    ['classique', [['8 h', B], ['12 h', C], ['16 h', 1 - B - 2 * C], ['20 h', C]], 34],
    ['jeûne', [['12 h', J], ['16 h', 1 - 2 * J], ['20 h', J]], 118],
  ];
  const R = sh => 7 + Math.sqrt(sh) * 30; // surface proportionnelle aux calories
  const plate = (x, y, sh, big) => { const r = R(sh); return `<circle cx="${x}" cy="${y}" r="${r + 3}" fill="#fff" stroke="${INK}" stroke-width="1.2"/>
    <circle cx="${x}" cy="${y}" r="${r - 2}" fill="${big ? '#9DB7A3' : '#DCE8DF'}"/>
    <text x="${x}" y="${y + 4}" text-anchor="middle" class="sv-in dk">${nf(kcal * sh)}</text>`; };
  return `<svg viewBox="0 0 320 188" class="sci-svg" aria-hidden="true">
    ${rows.map(([lbl, meals, y]) => {
      const xs = meals.length === 4 ? [92, 154, 214, 276] : [118, 197, 276];
      return `<text x="12" y="${y + 4}" class="sv-l">${lbl}</text>` + meals.map(([h, sh], i) => plate(xs[i], y, sh, lbl === 'jeûne' && sh === J)
        + `<text x="${xs[i]}" y="${y + R(sh) + 17}" text-anchor="middle" class="sv-t">${h}</text>`).join('');
    }).join('')}
    <text x="308" y="182" text-anchor="end" class="sv-k">en kcal par repas</text>
  </svg>`;
}

// semaine de boîtes : sept boîtes repas, couvercle vert au frigo, bleu au congélateur
function batchWeek() {
  const d = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
  const box = (x, cold) => `<g transform="translate(${x} 22)">
    <rect x="0" y="6" width="34" height="22" rx="5" fill="#fff" stroke="${INK}" stroke-width="1.1"/>
    <rect x="-2" y="0" width="38" height="8" rx="3" fill="${cold ? '#9BBCD8' : '#9DB7A3'}" stroke="${INK}" stroke-width="1.1"/>
    <rect x="5" y="13" width="10" height="9" rx="2" fill="#E8C97E"/><rect x="18" y="12" width="11" height="10" rx="2" fill="${cold ? '#C9DCEC' : '#C8DCCB'}"/>
    ${cold ? `<path d="M17 -9 v10 M12 -6.5 l10 5 M12 -1.5 l10 -5" stroke="#6F9FC9" stroke-width="1.2"/>` : ''}
  </g>`;
  return `<svg viewBox="0 0 320 126" class="sci-svg" aria-hidden="true">
    ${d.map((x, i) => box(10 + i * 44, i >= 4) + `<text x="${27 + i * 44}" y="66" text-anchor="middle" class="sv-t">${x}</text>`).join('')}
    <path d="M10 76 h168" stroke="#9DB7A3" stroke-width="2"/><text x="94" y="92" text-anchor="middle" class="sv-k">frigo, 4 °C au plus</text>
    <path d="M186 76 h122" stroke="#9BBCD8" stroke-width="2"/><text x="247" y="92" text-anchor="middle" class="sv-l">congélateur, −18 °C</text>
    <text x="247" y="106" text-anchor="middle" class="sv-t">décongelé la veille au frigo</text>
    <g transform="translate(14 114)"><rect x="0" y="-12" width="6" height="14" rx="3" fill="none" stroke="${TERRA}" stroke-width="1.2"/><circle cx="3" cy="4" r="4" fill="${TERRA}"/><rect x="1.8" y="-6" width="2.4" height="8" fill="${TERRA}"/></g>
    <text x="28" y="122" class="sv-k">réchauffé à 74 °C</text>
  </svg>`;
}

// erreur sur la masse grasse : des cercles qui rétrécissent d'une étape à l'autre
function fatFunnel(kg) {
  const lm = 0.05 * kg, km = lm * 21.6, avg = km / 2;
  const steps = [['± 5 points', 'taux de gras', 30, OCHRE], [`± ${dec(lm)} kg`, 'masse maigre', 25, '#C9B07A'], [`± ${Math.round(km)} kcal`, 'une formule', 20, INK], [`± ${Math.round(avg)} kcal`, 'la moyenne', 14, '#9DB7A3']];
  const xs = [42, 120, 196, 266];
  return `<svg viewBox="0 0 320 112" class="sci-svg" aria-hidden="true">
    ${steps.map(([v, l, r, c], i) => `<circle cx="${xs[i]}" cy="46" r="${r}" fill="${c}" opacity="${i === 2 ? 0.9 : 1}"/>
      <text x="${xs[i]}" y="${46 - r - 8}" text-anchor="middle" class="sv-in dk" style="font-size:11px">${v}</text>
      <text x="${xs[i]}" y="${46 + 30 + 18}" text-anchor="middle" class="sv-l">${l}</text>`).join('')}
    ${[0, 1, 2].map(i => `<path d="M${xs[i] + steps[i][2] + 4} 46 L${xs[i + 1] - steps[i + 1][2] - 6} 46" stroke="${TERRA}" stroke-width="1.4"/><path d="M${xs[i + 1] - steps[i + 1][2] - 6} 46 l-5 -3.5 v7 z" fill="${TERRA}"/>`).join('')}
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
  const signed = v => `${v >= 0 ? '+' : '−'} ${nf(Math.abs(v))} kcal`;
  const coefTxt = v => dec(v, 2).replace(/0$/, '');

  // ton calcul, ligne par ligne, avec des pointillés comme dans un livre de comptes
  const row = (label, val, refs = '', cls = '') => `<div class="sl-row ${cls}"><span class="sl-k">${label}${refs}</span><i></i><span class="sl-v">${val}</span></div>`;
  const ledger = ok ? `<div class="sci-ledger">
      <div class="sl-head"><span>Ton calcul</span><em>${m.name || ''}</em></div>
      ${row('Dépense au repos', `${nf(b.bmr)} kcal`)}
      ${row(`Activité, ${act.label.toLowerCase()}`, `× ${coefTxt(b.coef)}`)}
      ${Math.abs(b.adj - 1) > 0.004 ? row('Recalé sur tes pesées', `× ${coefTxt(b.adj)}`) : ''}
      ${row('Dépense de la journée', `${nf(b.maintenance)} kcal`, '', 'sl-sum')}
      ${m.targets ? row('Ton réglage à la main', signed(t.kcal - Math.round(b.maintenance)))
        : row(`${proto.name}, ${phase.label.toLowerCase()}`, signed(det.wanted - Math.round(b.maintenance)))
          + (det.floored ? row('Remonté au plancher', signed(t.kcal - det.wanted)) : '')}
      ${row('Ton objectif', `${nf(t.kcal)} kcal`, '', 'sl-total')}
      <div class="sl-macros">
        <div><b>${t.protein} g</b><span>protéines</span></div>
        <div><b>${t.carbs} g</b><span>glucides</span></div>
        <div><b>${t.fat} g</b><span>lipides</span></div>
      </div>
      <p class="sl-note">${m.targets ? 'Tes calories sont réglées à la main : Hébé affiche ici ton réglage. ' : ''}Chaque ligne est expliquée et sourcée ci-dessous.</p>
    </div>` : '';

  // v241-v242 : chaque planche = une phrase à retenir, puis des points courts regroupés, chacun avec ses sources
  const nb = x => x.replace(/(\d) (\d{3})/g, '$1\u00a0$2').replace(/(\d) (kcal|g|kg|h|jours|%|°C|points)/g, '$1\u00a0$2').replace(/ ([%:;?!])/g, '\u00a0$1');
  const sec = (n, title, art, lede, points) => `<section class="sci-card">
      <h3><span class="sci-n">${n}</span>${title}</h3>
      <p class="sci-lede">${nb(lede)}</p>
      ${art ? `<div class="sci-art">${art}</div>` : ''}
      <ul class="sci-pts">${points.map(([x, refs]) => `<li>${nb(x)}${refs ? pills(...refs) : ''}</li>`).join('')}</ul>
    </section>`;
  const kg = ok ? m.weight : 95;
  const lossPct = f => (ok ? b.maintenance * f * 7 / 7700 / m.weight * 100 : 0);
  const lmErr = 0.05 * kg, kmErr = lmErr * 21.6;
  ORDER = [];
  const cards = [
    sec(1, 'Deux formules plutôt qu\'une', '', "Ta dépense au repos, c'est l'énergie que ton corps brûle sans bouger. Hébé l'estime avec deux formules et garde la moyenne.", [
      ["La première, Harris-Benedict révisée, part de ton poids, de ta taille et de ton âge ; la seconde, Katch-McArdle, part de ta masse maigre, c'est-à-dire ton poids sans le gras.", ['roza', 'mcardle', 'cunningham']],
      ["La moyenne limite l'erreur de chacune et reste proche de Mifflin-St Jeor, la formule la plus fiable dans les comparaisons. Aucune formule n'est exacte pour tout le monde : c'est pour ça que Hébé se recale ensuite sur tes pesées.", ['mifflin', 'frankenfield', 'oneill']],
      ["Pour passer à la dépense de la journée, on multiplie par un coefficient d'activité de 1,4 à 1,8, selon les niveaux de la FAO et de l'OMS.", ['fao']],
    ]),
    sec(2, 'Ton assiette', ok ? macroBar(t) : '', "Assez de protéines pour le muscle, assez de lipides pour les hormones, et des glucides pour l'énergie. Les trois premières lignes parlent des protéines : leurs grammes sont des grammes de protéines.", [
      ...(ok ? [[`Pour toi : ${t.protein} g par jour, soit ${dec(t.protein / b.leanMass)} g par kg de masse maigre et ${dec(t.protein / m.weight)} g par kg de poids.`, null]] : []),
      ["La prise de muscle plafonne autour de 1,6 g par kg de poids, et les recommandations vont de 1,4 à 2,0 g par kg de poids. Ces repères sont donnés sur le poids total : Hébé part de la masse maigre, un choix pratique pour ne pas gonfler les besoins quand la masse grasse est élevée.", ['morton', 'nunes', 'jager']],
      ["En perte de gras, les profils déjà secs montent à au moins 2,3 g par kg de masse maigre, pour protéger leurs muscles.", ['helms14a']],
      ["Les lipides ne descendent jamais sous 20 % des calories pour un homme et 25 % pour une femme, et les glucides complètent le reste.", ['efsaF', 'efsaC']],
    ]),
    sec(3, 'Des écarts mesurés', programScale(phase.pct), "Chaque programme s'écarte un peu de ta dépense, jamais beaucoup : c'est ce qui protège le muscle.", [
      ["Prise de muscle : un surplus de 5 à 10 %, le réglage prudent conseillé aux pratiquants avancés, quand les débutants peuvent monter jusqu'à 20 %. Une étude chez des pratiquants entraînés suggère que prendre du poids plus vite fait surtout gagner du gras.", ['iraki', 'helms23']],
      ["Recomposition : un léger déficit, réglé à 10 % par Hébé. Prendre du muscle et perdre du gras en même temps est possible, même entraîné, avec une musculation progressive et beaucoup de protéines.", ['barakat']],
      [`Perte de gras : un déficit de 10 à 20 %${ok ? `, soit pour toi environ ${dec(lossPct(0.10))} à ${dec(lossPct(0.20))} % de ton poids par semaine` : ''}, sous le plafond de 1 % par semaine conseillé pour garder le muscle. Chez des athlètes, une perte plus lente a même fait gagner de la masse maigre. Au-delà d'environ 500 kcal de déficit par jour, la masse maigre progresse moins : c'est pour ça que l'étape à 20 % reste courte.`, ['helms14b', 'garthe', 'murphy']],
    ]),
    sec(4, 'Le corps a toujours raison', trendCurve(ok ? getWeights(m.id) : []), "Hébé ne prédit pas ta perte, il la mesure sur tes pesées et ajuste tes calories.", [
      ["Un kilo de variation correspond à environ 7 700 kcal, mais cette règle fixe surestime la perte sur la durée, car le corps s'adapte.", ['wish', 'thomas', 'hall']],
      ["Hébé compare donc ton plan à la tendance de tes pesées sur deux à quatre semaines, en ignorant la première, où l'on perd surtout de l'eau. La correction est lissée et ne dépasse jamais 15 %.", null],
    ]),
    sec(5, 'Un plancher, toujours', ok ? floorBar(t.kcal, det.floor) : '', "Quel que soit le programme, tes calories ne descendent jamais sous un minimum.", [
      ["Jamais moins que ta dépense au repos, ni moins de 1 200 kcal pour une femme et 1 500 kcal pour un homme : c'est le bas des apports conseillés en perte de poids par les recommandations de référence.", ['jensen']],
    ]),
    sec(6, 'Ton taux de gras, sans stress', fatFunnel(kg), "Aucune méthode simple ne mesure ton taux de gras au point près : Hébé est conçue pour qu'une erreur de quelques points pèse peu.", [
      ["Les balances et appareils d'impédance se trompent typiquement de 3 à 7,5 points selon le modèle. Les méthodes de laboratoire à plusieurs compartiments servent de référence, et la DXA s'en approche.", ['siedler', 'tinsley21', 'blue']],
      ["Les silhouettes donnent une estimation à l'œil : un bon point de départ, pas une mesure. Ton taux sert à calculer ta masse maigre, donc ta dépense au repos et tes protéines.", ['cunningham']],
      [`Exemple${ok ? ' pour toi' : ''} : à ${nf(kg)} kg, 5 points d'erreur décalent ta masse maigre de ${dec(lmErr)} kg et Katch-McArdle d'environ ${Math.round(kmErr)} kcal. La moyenne avec Harris-Benedict divise ce décalage par deux, à environ ${Math.round(kmErr / 2)} kcal, puis tes pesées le corrigent en deux à quatre semaines.`, null],
    ]),
    sec(7, 'Le jeûne 16:8, à découvrir', fastPlates(ok ? t.kcal : 2400), "Tu manges entre 12 h et 20 h. Les mêmes calories sur trois repas au lieu de quatre : chaque assiette est plus copieuse, et tu sors de table rassasié.", [
      ...(ok ? [[`Pour toi : ton déjeuner et ton dîner passent de ${nf(t.kcal * PLATE_SHARE.classique)} à ${nf(t.kcal * PLATE_SHARE.jeune)} kcal chacun, soit un quart de plus dans l'assiette.`, null]] : []),
      ["À calories égales, c'est au moins aussi efficace qu'une journée classique, avec même un léger avantage en moyenne : environ 1,5 kg de plus perdus, surtout du gras.", ['fernandes', 'liu', 'semnani']],
      ["Avec la musculation et assez de protéines, ta prise de muscle et ta force suivent aussi bien. Hébé garde d'ailleurs tes protéines au même niveau dans les deux formules, pour protéger ton muscle.", ['ashtary', 'tinsley19', 'lowe']],
      ["Tes protéines restent réparties sur tes trois repas, autour de 0,4 g par kg de poids à chaque fois, ce qui aide le muscle à se construire.", ['schoenfeld']],
      ["Idéal si tu n'as pas faim le matin ou si tu préfères de vrais repas. Et si ça ne te convient pas, tu repasses à la formule classique en un geste.", null],
    ]),
    sec(8, 'Cuisiner une fois, manger sans risque', batchWeek(), "Bien refroidir, bien conserver et bien réchauffer tes boîtes suffit à garder ta cuisine du dimanche sûre toute la semaine.", [
      ["Les plats vont au frigo dans les 2 heures après la cuisson, dans l'heure s'il fait plus de 32 °C. Pour le riz, Hébé est plus stricte et demande 1 heure.", ['fsis', 'foodsafety', 'ansesBc']],
      ["Au frigo, à 4 °C ou moins, les plats se gardent 3 à 4 jours : Hébé s'arrête à 3. La suite de la semaine passe au congélateur, à −18 °C ou moins, et se décongèle la veille au frigo, la méthode la plus sûre.", ['fsis', 'foodsafety']],
      ["Réchauffe jusqu'à 74 °C : couvre, remue à mi-temps et vérifie que c'est chaud partout, car le micro-ondes laisse des zones froides.", ['fsis', 'foodsafety']],
      ["Le riz cuit peut contenir des spores de Bacillus cereus qui survivent à la cuisson. S'il reste tiède, elles produisent une toxine que le réchauffage ne détruit pas : d'où le refroidissement rapide.", ['ansesBc', 'ansesFiche']],
    ]),
    sec(9, 'Des aliments bien mesurés', '', "Toutes les valeurs nutritionnelles de tes recettes viennent de tables officielles.", [
      ["Les tables Ciqual de l'Anses, complétées par la base FoodData Central de l'USDA.", ['ciqual', 'fdc']],
    ]),
  ].join('');
  openSheet(`<div class="sheet-handle"></div><div class="hb-sheet-pad sci">
    <div class="sci-label">
      <div class="sci-label-in">
        <span class="sci-kick">Hébé, notice</span>
        <div class="sci-title">Comment Hébé calcule</div>
        <p class="sci-sub">Tous les chiffres de l'app viennent de règles publiées et reconnues. Voici les tiens, ligne par ligne.</p>
        <span class="sci-stamp">${ORDER.length} sources</span>
      </div>
    </div>
    ${ledger}
    ${cards}
    <p class="sci-note">Ces calculs donnent un point de départ fiable pour un adulte en bonne santé. Ils ne remplacent pas l'avis d'un médecin ou d'un diététicien, notamment en cas de grossesse, de maladie ou de troubles alimentaires.</p>
    <details class="sci-src"><summary>Voir les ${ORDER.length} sources</summary>
      <ol>${ORDER.map((k, i) => `<li id="sci-s${i + 1}">${srcHtml(SRC[k])}</li>`).join('')}</ol>
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

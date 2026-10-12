// science.js — v236-v239 : fiche « Comment Hébé calcule », pour ceux que ça intéresse.
// v239 : ton calcul ligne par ligne, façon livre de comptes, puis une petite planche dessinée par règle,
// avec tes propres chiffres. Chaque règle renvoie à ses sources (pastilles numérotées).

import { openSheet, closeSheet } from './utils.js';
import { getActiveMember, ACTIVITY } from '../data/household.js';
import { computeBase, computeDetails, getProtocol } from '../data/calculator.js';
import { getTargetsFor } from '../data/user.js';
import { getWeights } from './weight.js';

// [référence, lien DOI ou page officielle] — vérifiées une à une (Europe PMC, Crossref, sites officiels), octobre 2026
const SOURCES = [
  ['Roza AM, Shizgal HM. The Harris Benedict equation reevaluated: resting energy requirements and the body cell mass. Am J Clin Nutr. 1984;40(1):168-182.', 'https://doi.org/10.1093/ajcn/40.1.168'],
  ['McArdle WD, Katch FI, Katch VL. Exercise Physiology: Nutrition, Energy, and Human Performance. 9e éd. Wolters Kluwer. 2023.', ''],
  ['Mifflin MD, St Jeor ST, Hill LA, et al. A new predictive equation for resting energy expenditure in healthy individuals. Am J Clin Nutr. 1990;51(2):241-247.', 'https://doi.org/10.1093/ajcn/51.2.241'],
  ['Frankenfield D, Roth-Yousey L, Compher C. Comparison of predictive equations for resting metabolic rate in healthy nonobese and obese adults: a systematic review. J Am Diet Assoc. 2005;105(5):775-789.', 'https://doi.org/10.1016/j.jada.2005.02.005'],
  ["O'Neill JER, Corish CA, Horner K. Accuracy of resting metabolic rate prediction equations in athletes: a systematic review with meta-analysis. Sports Med. 2023;53(12):2373-2398.", 'https://doi.org/10.1007/s40279-023-01896-z'],
  ['FAO, OMS, UNU. Human energy requirements. Report of a Joint FAO/WHO/UNU Expert Consultation. FAO Food and Nutrition Technical Report Series 1. Rome. 2004.', 'https://www.fao.org/4/y5686e/y5686e00.htm'],
  ['Morton RW, Murphy KT, McKellar SR, et al. A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength in healthy adults. Br J Sports Med. 2018;52(6):376-384.', 'https://doi.org/10.1136/bjsports-2017-097608'],
  ['Nunes EA, Colenso-Semple L, McKellar SR, et al. Systematic review and meta-analysis of protein intake to support muscle mass and function in healthy adults. J Cachexia Sarcopenia Muscle. 2022;13(2):795-810.', 'https://doi.org/10.1002/jcsm.12922'],
  ['Jäger R, Kerksick CM, Campbell BI, et al. International Society of Sports Nutrition Position Stand: protein and exercise. J Int Soc Sports Nutr. 2017;14:20.', 'https://doi.org/10.1186/s12970-017-0177-8'],
  ['Helms ER, Zinn C, Rowlands DS, Brown SR. A systematic review of dietary protein during caloric restriction in resistance trained lean athletes: a case for higher intakes. Int J Sport Nutr Exerc Metab. 2014;24(2):127-138.', 'https://doi.org/10.1123/ijsnem.2013-0054'],
  ['EFSA NDA Panel. Scientific Opinion on Dietary Reference Values for fats, including saturated fatty acids, polyunsaturated fatty acids, monounsaturated fatty acids, trans fatty acids, and cholesterol. EFSA J. 2010;8(3):1461.', 'https://doi.org/10.2903/j.efsa.2010.1461'],
  ['EFSA NDA Panel. Scientific Opinion on Dietary Reference Values for carbohydrates and dietary fibre. EFSA J. 2010;8(3):1462.', 'https://doi.org/10.2903/j.efsa.2010.1462'],
  ['Iraki J, Fitschen P, Espinar S, Helms E. Nutrition recommendations for bodybuilders in the off-season: a narrative review. Sports (Basel). 2019;7(7):154.', 'https://doi.org/10.3390/sports7070154'],
  ['Helms ER, Spence AJ, Sousa C, et al. Effect of small and large energy surpluses on strength, muscle, and skinfold thickness in resistance-trained individuals: a parallel groups design. Sports Med Open. 2023;9(1):102.', 'https://doi.org/10.1186/s40798-023-00651-y'],
  ['Barakat C, Pearson J, Escalante G, Campbell B, De Souza EO. Body recomposition: can trained individuals build muscle and lose fat at the same time? Strength Cond J. 2020;42(5):7-21.', 'https://doi.org/10.1519/SSC.0000000000000584'],
  ['Helms ER, Aragon AA, Fitschen PJ. Evidence-based recommendations for natural bodybuilding contest preparation: nutrition and supplementation. J Int Soc Sports Nutr. 2014;11:20.', 'https://doi.org/10.1186/1550-2783-11-20'],
  ['Garthe I, Raastad T, Refsnes PE, Koivisto A, Sundgot-Borgen J. Effect of two different weight-loss rates on body composition and strength and power-related performance in elite athletes. Int J Sport Nutr Exerc Metab. 2011;21(2):97-104.', 'https://doi.org/10.1123/ijsnem.21.2.97'],
  ['Murphy C, Koehler K. Energy deficiency impairs resistance training gains in lean mass but not strength: a meta-analysis and meta-regression. Scand J Med Sci Sports. 2022;32(1):125-137.', 'https://doi.org/10.1111/sms.14075'],
  ['Wishnofsky M. Caloric equivalents of gained or lost weight. Am J Clin Nutr. 1958;6(5):542-546.', 'https://doi.org/10.1093/ajcn/6.5.542'],
  ['Thomas DM, Martin CK, Lettieri S, et al. Can a weight loss of one pound a week be achieved with a 3500-kcal deficit? Commentary on a commonly accepted rule. Int J Obes (Lond). 2013;37(12):1611-1613.', 'https://doi.org/10.1038/ijo.2013.51'],
  ['Hall KD, Sacks G, Chandramohan D, et al. Quantification of the effect of energy imbalance on bodyweight. Lancet. 2011;378(9793):826-837.', 'https://doi.org/10.1016/S0140-6736(11)60812-X'],
  ['Jensen MD, Ryan DH, Apovian CM, et al. 2013 AHA/ACC/TOS guideline for the management of overweight and obesity in adults. Circulation. 2014;129(25 Suppl 2):S102-S138.', 'https://doi.org/10.1161/01.cir.0000437739.71477.ee'],
  ['Anses. Table de composition nutritionnelle des aliments Ciqual.', 'https://ciqual.anses.fr/'],
  ['USDA, Agricultural Research Service. FoodData Central.', 'https://fdc.nal.usda.gov/'],
  ['USDA FSIS. Leftovers and Food Safety.', 'https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/leftovers-and-food-safety'],
];

const srcHtml = ([t, url]) => {
  const m = t.match(/^(.*?\. )(.*?\. )(.*)$/);
  const body = m ? `<span class="sci-au">${m[1]}</span>${m[2]}<em>${m[3]}</em>` : t;
  const link = url ? ` <a href="${url}" target="_blank" rel="noopener">${url.startsWith('https://doi.org/') ? 'doi' : 'lien'}</a>` : '';
  return body + link;
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

  const sec = (n, title, art, text) => `<section class="sci-card">
      <h3><span class="sci-n">${n}</span>${title}</h3>
      ${art ? `<div class="sci-art">${art}</div>` : ''}
      <p>${text.replace(/(\d) (\d{3})/g, '$1\u00a0$2').replace(/ ([%:;?!])/g, '\u00a0$1')}</p>
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
    ${sec(1, 'Deux formules plutôt qu\'une', '', `Ta dépense au repos est la moyenne de Harris-Benedict révisée, qui part du poids, de la taille et de l'âge${pills(1)}, et de Katch-McArdle, qui part de la masse maigre${pills(2)}. Elle reste proche de Mifflin-St Jeor, la formule la plus fiable dans les comparaisons${pills(3, 4)}. Aucune formule n'est exacte pour tout le monde${pills(5)} : c'est pour ça que Hébé se recale ensuite sur tes pesées. Le coefficient d'activité, de 1,4 à 1,8, suit les niveaux d'activité de la FAO et de l'OMS${pills(6)}.`)}
    ${sec(2, 'Ton assiette', ok ? macroBar(t) : '', `${prot}La prise de muscle plafonne autour de 1,6 g par kg de poids${pills(7, 8)}, et les recommandations vont de 1,4 à 2,0 g${pills(9)}. Hébé part de la masse maigre, pour ne pas gonfler les besoins quand la masse grasse est élevée. En perte de gras, les profils déjà secs montent à au moins 2,3 g par kg de masse maigre${pills(10)}. Les lipides ne descendent jamais sous 20 % des calories pour un homme et 25 % pour une femme${pills(11)}, et les glucides complètent le reste${pills(12)}.`)}
    ${sec(3, 'Des écarts mesurés', programScale(phase.pct), `Un surplus de 5 à 10 % pour prendre du muscle${pills(13)} : au-delà, on prend surtout du gras${pills(14)}. Un déficit de 10 % pour la recomposition${pills(15)}, et de 10 à 20 % pour perdre du gras. Le rythme visé, de 0,5 à 0,7 % du poids par semaine, préserve le muscle${pills(16, 17)}, alors que les gros déficits freinent la masse maigre${pills(18)}.`)}
    ${sec(4, 'Le corps a toujours raison', trendCurve(ok ? getWeights(m.id) : []), `Un kilo de variation correspond à environ 7 700 kcal${pills(19)}, mais cette règle fixe surestime la perte sur la durée${pills(20, 21)}. Hébé ne prédit donc pas, il mesure : il compare ton plan à la tendance de tes pesées sur deux à quatre semaines, en ignorant la première, où l'on perd surtout de l'eau. La correction est lissée et ne dépasse jamais 15 %.`)}
    ${sec(5, 'Un plancher, toujours', ok ? floorBar(t.kcal, det.floor) : '', `Jamais moins que ta dépense au repos, ni moins de 1 200 kcal pour une femme et 1 500 kcal pour un homme : c'est le bas des apports conseillés en perte de poids par les recommandations de référence${pills(22)}.`)}
    ${sec(6, 'Des aliments bien mesurés', sciFridge(), `Les valeurs nutritionnelles viennent des tables Ciqual de l'Anses${pills(23)} et de la base de l'USDA${pills(24)}. Les plats préparés se gardent 3 jours au frigo, sous les 3 à 4 jours conseillés, et le reste de la semaine passe par le congélateur${pills(25)}.`)}
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

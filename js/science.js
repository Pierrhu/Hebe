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
  compendium: ['Herrmann SD, et al. 2024 Adult Compendium of Physical Activities: a third update of the energy costs of human activities. J Sport Health Sci. 2024;13(1):6-12.', 'https://pacompendium.com/occupation/'],
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
  woolcott: ['Woolcott OO, Bergman RN. Relative fat mass (RFM) as a new estimator of whole-body fat percentage: a cross-sectional study in American adult individuals. Sci Rep. 2018;8(1):10980.', 'https://doi.org/10.1038/s41598-018-29362-1'],
  palumbo: ['Palumbo AM, et al. Validity of non-traditional measures of obesity compared to total body fat across the life course: a systematic review and meta-analysis. Obes Rev. 2025;26(6):e13894.', 'https://doi.org/10.1111/obr.13894'],
  spf: ["Santé publique France. Recommandations relatives à l'alimentation, à l'activité physique et à la sédentarité pour les adultes. 2019.", 'https://www.santepubliquefrance.fr/determinants-de-sante/nutrition-et-activite-physique/documents/rapport-synthese/recommandations-relatives-a-l-alimentation-a-l-activite-physique-et-a-la-sedentarite-pour-les-adultes'],
  wcrf: ['World Cancer Research Fund. Limit consumption of red and processed meat. Cancer Prevention Recommendations, Third Expert Report. 2018.', 'https://www.wcrf.org/research-policy/evidence-for-our-recommendations/limit-red-processed-meat/'],
  iarc: ['Bouvard V, Loomis D, Guyton KZ, et al. Carcinogenicity of consumption of red and processed meat. Lancet Oncol. 2015;16(16):1599-1600.', 'https://doi.org/10.1016/S1470-2045(15)00444-1'],
  ansesFish: ['Anses. Manger du poisson : pourquoi ? comment ?', 'https://www.anses.fr/fr/article/manger-du-poisson-pourquoi-comment'],
  ansesVitD: ['Anses. Vitamine D : pourquoi et comment assurer un apport suffisant ? 2022.', 'https://www.anses.fr/fr/content/vitamine-d-pourquoi-et-comment-assurer-un-apport-suffisant'],
  vital: ['Manson JE, Cook NR, Lee IM, et al. Vitamin D supplements and prevention of cancer and cardiovascular disease. N Engl J Med. 2019;380(1):33-44.', 'https://doi.org/10.1056/NEJMoa1809944'],
  avenell: ['Avenell A, Mak JC, O\'Connell D. Vitamin D and vitamin D analogues for preventing fractures in post-menopausal women and older men. Cochrane Database Syst Rev. 2014;(4):CD000227.', 'https://doi.org/10.1002/14651858.CD000227.pub4'],
  ansesLip: ['Anses. Les lipides.', 'https://www.anses.fr/fr/content/les-lipides'],
  abdelhamid: ['Abdelhamid AS, Brown TJ, Brainard JS, et al. Omega-3 fatty acids for the primary and secondary prevention of cardiovascular disease. Cochrane Database Syst Rev. 2020;3(3):CD003177.', 'https://doi.org/10.1002/14651858.CD003177.pub5'],
  rimm: ['Rimm EB, Appel LJ, Chiuve SE, et al. Seafood long-chain n-3 polyunsaturated fatty acids and cardiovascular disease: a science advisory from the American Heart Association. Circulation. 2018;138(1):e35-e47.', 'https://doi.org/10.1161/CIR.0000000000000574'],
  ansesRef: ['Anses. Les références nutritionnelles en vitamines et minéraux. 2025.', 'https://www.anses.fr/fr/content/les-r%C3%A9f%C3%A9rences-nutritionnelles-en-vitamines-et-min%C3%A9raux'],
  ansesPnns: ['Anses. Actualisation des repères du PNNS : révision des repères de consommations alimentaires. Avis et rapport d\'expertise collective. 2016.', 'https://www.anses.fr/fr/system/files/NUT2012SA0103Ra-1.pdf'],
  nihIron: ['NIH Office of Dietary Supplements. Iron: Fact Sheet for Consumers. 2023.', 'https://ods.od.nih.gov/factsheets/Iron-Consumer/'],
  reynolds: ['Reynolds A, Mann J, Cummings J, et al. Carbohydrate quality and human health: a series of systematic reviews and meta-analyses. Lancet. 2019;393(10170):434-445.', 'https://doi.org/10.1016/S0140-6736(18)31809-9'],
  kreider: ['Kreider RB, Kalman DS, Antonio J, et al. International Society of Sports Nutrition position stand: safety and efficacy of creatine supplementation in exercise, sport, and medicine. J Int Soc Sports Nutr. 2017;14:18.', 'https://doi.org/10.1186/s12970-017-0173-z'],
  delpino: ['Delpino FM, Figueiredo LM, Forbes SC, et al. Influence of age, sex, and type of exercise on the efficacy of creatine supplementation on lean body mass: a systematic review and meta-analysis of randomized clinical trials. Nutrition. 2022;103-104:111791.', 'https://doi.org/10.1016/j.nut.2022.111791'],
  wang: ['Wang Z, Qiu B, Li R, et al. Effects of creatine supplementation and resistance training on muscle strength gains in adults under 50 years of age: a systematic review and meta-analysis. Nutrients. 2024;16(21):3665.', 'https://doi.org/10.3390/nu16213665'],
  guest: ['Guest NS, VanDusseldorp TA, Nelson MT, et al. International Society of Sports Nutrition position stand: caffeine and exercise performance. J Int Soc Sports Nutr. 2021;18(1):1.', 'https://doi.org/10.1186/s12970-020-00383-4'],
  efsaCaf: ['EFSA NDA Panel. Scientific Opinion on the safety of caffeine. EFSA J. 2015;13(5):4102.', 'https://doi.org/10.2903/j.efsa.2015.4102'],
  hasFol: ['HAS, Commission de la transparence. Avis Acide folique 0,4 mg. 2018.', 'https://has-sante.fr/upload/docs/evamed/CT-16672_ACIDE_FOLIQUE_CCD_0,4mg_PIS_RI_Avis1_CT16672.pdf'],
  uspstf: ['US Preventive Services Task Force, Mangione CM, Barry MJ, et al. Vitamin, mineral, and multivitamin supplementation to prevent cardiovascular disease and cancer: US Preventive Services Task Force recommendation statement. JAMA. 2022;327(23):2326-2333.', 'https://doi.org/10.1001/jama.2022.8970'],
  kyle: ['Kyle UG, Bosaeus I, De Lorenzo AD, et al. Bioelectrical impedance analysis, part I: review of principles and methods. Clin Nutr. 2004;23(5):1226-1243.', 'https://doi.org/10.1016/j.clnu.2004.06.004'],
};

const srcHtml = ([t, url]) => {
  const m = t.match(/^(.*?\. )(.*?\. )(.*)$/);
  const body = m ? `<span class="sci-au">${m[1]}</span>${m[2]}<em>${m[3]}</em>` : t;
  const link = url ? ` <a href="${url}" target="_blank" rel="noopener">${url.startsWith('https://doi.org/') ? 'doi' : 'lien'}</a>` : '';
  return body + link;
};
// profil d'exemple pour les dessins quand la fiche n'est pas encore remplie (fiche ouverte depuis l'accueil)
const EX_T = { kcal: 2200, protein: 140, carbs: 250, fat: 72 };
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
function floorBar(kcal, floor, example = false) {
  const max = Math.max(kcal, floor) * 1.15, X = v => 20 + v / max * 280;
  return `<svg viewBox="0 0 320 70" class="sci-svg" aria-hidden="true">
    <rect x="20" y="18" width="${X(kcal) - 20}" height="18" rx="4" fill="#9DB7A3"/>
    ${X(kcal) - X(floor) > 70 ? `<text x="${X(kcal) - 6}" y="31" text-anchor="end" class="sv-in dk">${nf(kcal)} kcal</text>` : `<text x="26" y="31" class="sv-in dk">${nf(kcal)} kcal</text>`}
    <line x1="${X(floor)}" y1="8" x2="${X(floor)}" y2="46" stroke="${TERRA}" stroke-width="2"/>
    <path d="M${X(floor) - 5} 46 h10" stroke="${TERRA}" stroke-width="2"/>
    <text x="${X(floor)}" y="62" text-anchor="middle" class="sv-k">plancher ${nf(floor)}</text>
    ${example ? '<text x="300" y="62" text-anchor="end" class="sv-t">exemple</text>' : ''}
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
  // v248 : plus l'assiette est copieuse, plus son vert est soutenu (en plus de sa taille)
  const shares = [B, C, 1 - B - 2 * C, J, 1 - 2 * J], lo = Math.min(...shares), hi = Math.max(...shares);
  const mix = (a, b, f) => '#' + [0, 2, 4].map(i => Math.round(parseInt(a.slice(1 + i, 3 + i), 16) * (1 - f) + parseInt(b.slice(1 + i, 3 + i), 16) * f).toString(16).padStart(2, '0')).join('');
  const plate = (x, y, sh) => { const r = R(sh), f = (sh - lo) / (hi - lo || 1); return `<circle cx="${x}" cy="${y}" r="${r + 3}" fill="#fff" stroke="${INK}" stroke-width="1.2"/>
    <circle cx="${x}" cy="${y}" r="${r - 2}" fill="${mix('#E8F0EA', '#4F7E62', f)}"/>
    <text x="${x}" y="${y + 4}" text-anchor="middle" class="sv-in${f < 0.55 ? ' dk' : ''}">${nf(kcal * sh)}</text>`; };
  return `<svg viewBox="0 0 320 188" class="sci-svg" aria-hidden="true">
    ${rows.map(([lbl, meals, y]) => {
      const xs = meals.length === 4 ? [92, 154, 214, 276] : [118, 197, 276];
      return `<text x="12" y="${y + 4}" class="sv-l">${lbl}</text>` + meals.map(([h, sh], i) => plate(xs[i], y, sh)
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

// une semaine de 14 repas (midi et soir) : la place que prennent le bœuf et le poisson
function weekMeals() {
  const days = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
  const kind = (d, m) => (d <= 1 && m === 0 ? 'fish' : (d === 2 && m === 1) || (d === 4 && m === 0) || (d === 5 && m === 1) || (d === 6 && m === 0) ? 'beef' : 'other');
  const col = { beef: TERRA, fish: '#6F9FC9', other: '#DCE8DF' };
  return `<svg viewBox="0 0 320 114" class="sci-svg" aria-hidden="true">
    ${days.map((d, i) => [0, 1].map(m => { const k = kind(i, m); return `<rect x="${44 + i * 38}" y="${8 + m * 26}" width="30" height="20" rx="5" fill="${col[k]}" ${k === 'other' ? `stroke="${INK}" stroke-opacity=".25"` : ''}/>`; }).join('') + `<text x="${59 + i * 38}" y="66" text-anchor="middle" class="sv-t">${d}</text>`).join('')}
    <text x="38" y="22" text-anchor="end" class="sv-t">midi</text><text x="38" y="48" text-anchor="end" class="sv-t">soir</text>
    <rect x="44" y="80" width="12" height="10" rx="3" fill="${TERRA}"/><text x="62" y="89" class="sv-l">bœuf, un plat, 4 repas au plus</text>
    <rect x="44" y="98" width="12" height="10" rx="3" fill="#6F9FC9"/><text x="62" y="107" class="sv-l">poisson frais, dans les 2 premiers jours</text>
  </svg>`;
}

// petites icônes au trait pour les compléments
const ic = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const SP_ICONS = {
  sun: ic('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  fish: ic('<path d="M3 12c3-5 9-6 13-3l5-3v12l-5-3c-4 3-10 2-13-3z"/><circle cx="8" cy="11" r=".8" fill="currentColor"/>'),
  drop: ic('<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>'),
  bolt: ic('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'),
  cup: ic('<path d="M4 8h13v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6z"/><path d="M17 9h1.5a2.5 2.5 0 0 1 0 5H17M8 2v3M12 2v3"/>'),
  shake: ic('<path d="M7 7h10l-1.5 14h-7z"/><path d="M6 4h12v3H6zM10 11h4"/>'),
  baby: ic('<circle cx="12" cy="8" r="4"/><path d="M5 21c1-4 4-6 7-6s6 2 7 6"/>'),
  x: ic('<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>'),
  leaf: ic('<path d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15"/><path d="M5 19l8-8"/>'),
};

// ce que couvrent les menus d'Hébé, rapporté au repère (moyenne des menus testés)
function coverBars() {
  const rows = [['vitamine D', 3, 3, 15, 'µg'], ['fibres', 26, 38, 30, 'g'], ['fer, femmes', 12, 12, 11, 'mg']];
  const X = f => 96 + Math.min(1.35, f) / 1.35 * 210;
  return `<svg viewBox="0 0 320 128" class="sci-svg" aria-hidden="true">
    ${[0, 1, 2].map(i => `<line x1="${X(1)}" y1="${6 + i * 34}" x2="${X(1)}" y2="${26 + i * 34}" stroke="${TERRA}" stroke-width="2"/>`).join('')}
    <text x="${X(1)}" y="120" text-anchor="middle" class="sv-k">le repère</text>
    ${rows.map(([lbl, lo, hi, ref, u], i) => { const y = 10 + i * 34; return `<text x="88" y="${y + 9}" text-anchor="end" class="sv-l">${lbl}</text>
      <rect x="96" y="${y}" width="${X(hi / ref) - 96}" height="12" rx="6" fill="${hi / ref < 0.6 ? '#EAD9CF' : '#C9D9CD'}"/>
      <rect x="96" y="${y}" width="${X(lo / ref) - 96}" height="12" rx="6" fill="${lo / ref < 0.6 ? TERRA : '#9DB7A3'}"/>
      <text x="96" y="${y + 27}" class="sv-t">tes menus : ${lo === hi ? lo : `${lo} à ${hi}`} ${u}, repère ${ref} ${u}</text>`; }).join('')}
  </svg>`;
}

// erreur sur la masse grasse : ce qu'elle change sur ta dépense au repos, avec une formule seule puis avec la moyenne
function fatFunnel(kg, rmr) {
  const km = 0.05 * kg * 21.6, avg = km / 2, span = 250;
  const X = v => 160 + v / span * 130; // axe centré sur ta dépense, de −250 à +250 kcal
  const row = (y, lbl, e, col, strong) => `
    <text x="20" y="${y - 9}" class="sv-l">${lbl}</text>
    <rect x="${X(-e)}" y="${y - 5}" width="${X(e) - X(-e)}" height="10" rx="5" fill="${col}" opacity="${strong ? 1 : 0.55}"/>
    <line x1="${X(-e)}" y1="${y - 8}" x2="${X(-e)}" y2="${y + 8}" stroke="${col}" stroke-width="2"/><line x1="${X(e)}" y1="${y - 8}" x2="${X(e)}" y2="${y + 8}" stroke="${col}" stroke-width="2"/>
    <text x="${X(e) + 8}" y="${y + 4}" class="${strong ? 'sv-k' : 'sv-t'}">± ${Math.round(e)} kcal</text>`;
  return `<svg viewBox="0 0 320 128" class="sci-svg" aria-hidden="true">
    <text x="160" y="12" text-anchor="middle" class="sv-t">si ton taux de gras est faux de 5 points</text>
    <line x1="${X(0)}" y1="20" x2="${X(0)}" y2="96" stroke="${INK}" stroke-width="1" stroke-dasharray="3 3"/>
    ${row(44, 'une seule formule', km, OCHRE, false)}
    ${row(80, 'la moyenne des deux', avg, TERRA, true)}
    <line x1="${X(-span)}" y1="104" x2="${X(span)}" y2="104" stroke="${INK}" stroke-width="1.2"/>
    ${[-200, -100, 0, 100, 200].map(v => `<line x1="${X(v)}" y1="104" x2="${X(v)}" y2="108" stroke="${INK}" stroke-width="1"/><text x="${X(v)}" y="120" text-anchor="middle" class="sv-t">${v === 0 ? `${nf(rmr)} kcal` : (v > 0 ? '+' : '−') + Math.abs(v)}</text>`).join('')}
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
  const sec = (n, title, art, lede, points, intro = '') => `<section class="sci-card">
      <h3><span class="sci-n">${n}</span>${title}</h3>
      <p class="sci-lede">${nb(lede)}</p>
      ${art ? `<div class="sci-art">${art}</div>` : ''}
      ${intro ? `<p class="sci-intro">${nb(intro)}</p>` : ''}
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
      ["Ce coefficient vient de tes deux réponses : ton travail (assis, debout ou physique) et tes séances de sport. Un métier debout pèse déjà autant qu'un sport presque quotidien pour quelqu'un qui travaille assis.", ['fao', 'compendium']],
    ]),
    sec(2, 'Ton assiette', macroBar(ok ? t : EX_T), "Assez de protéines pour le muscle, assez de lipides pour les hormones, et des glucides pour l'énergie.", [
      ...(ok ? [[`Pour toi : ${t.protein} g par jour, soit ${dec(t.protein / b.leanMass)} g par kg de masse maigre et ${dec(t.protein / m.weight)} g par kg de poids.`, null]] : []),
      ["La prise de muscle plafonne autour de 1,6 g par kg de poids, et les recommandations vont de 1,4 à 2,0 g par kg de poids. Ces repères sont donnés sur le poids total : Hébé part de la masse maigre, un choix pratique pour ne pas gonfler les besoins quand la masse grasse est élevée.", ['morton', 'nunes', 'jager']],
      ["En perte de gras, les profils déjà secs montent à au moins 2,3 g par kg de masse maigre, pour protéger leurs muscles.", ['helms14a']],
      ["Les lipides ne descendent jamais sous 20 % des calories pour un homme et 25 % pour une femme, et les glucides complètent le reste.", ['efsaF', 'efsaC']],
    ], `Les ${ok ? 'trois' : 'deux'} premières lignes parlent des protéines : leurs grammes sont des grammes de protéines.`),
    sec(3, 'Des écarts mesurés', programScale(phase.pct), "Chaque programme s'écarte un peu de ta dépense, jamais beaucoup : c'est ce qui protège le muscle.", [
      ["Prise de muscle : un surplus de 5 à 10 %, le réglage prudent conseillé aux pratiquants avancés, quand les débutants peuvent monter jusqu'à 20 %. Une étude chez des pratiquants entraînés suggère que prendre du poids plus vite fait surtout gagner du gras.", ['iraki', 'helms23']],
      ["Recomposition : un léger déficit, réglé à 10 % par Hébé. Prendre du muscle et perdre du gras en même temps est possible, même entraîné, avec une musculation progressive et beaucoup de protéines.", ['barakat']],
      [`Perte de gras : un déficit de 10 à 20 %${ok ? `, soit pour toi environ ${dec(lossPct(0.10))} à ${dec(lossPct(0.20))} % de ton poids par semaine` : ''}, sous le plafond de 1 % par semaine conseillé pour garder le muscle. Chez des athlètes, une perte plus lente a même fait gagner de la masse maigre. Au-delà d'environ 500 kcal de déficit par jour, la masse maigre progresse moins : c'est pour ça que l'étape à 20 % reste courte.`, ['helms14b', 'garthe', 'murphy']],
    ]),
    sec(4, 'Le corps a toujours raison', trendCurve(ok ? getWeights(m.id) : []), "Hébé ne prédit pas ta perte, il la mesure sur tes pesées et ajuste tes calories.", [
      ["Un kilo de variation correspond à environ 7 700 kcal, mais cette règle fixe surestime la perte sur la durée, car le corps s'adapte.", ['wish', 'thomas', 'hall']],
      ["Hébé compare donc ton plan à la tendance de tes pesées sur deux à quatre semaines, en ignorant la première, où l'on perd surtout de l'eau. La correction est lissée et ne dépasse jamais 15 %.", null],
    ]),
    sec(5, 'Un plancher, toujours', ok ? floorBar(t.kcal, det.floor) : floorBar(EX_T.kcal, 1500, true), "Quel que soit le programme, tes calories ne descendent jamais sous un minimum.", [
      ["Jamais moins que ta dépense au repos, ni moins de 1 200 kcal pour une femme et 1 500 kcal pour un homme : c'est le bas des apports conseillés en perte de poids par les recommandations de référence.", ['jensen']],
    ]),
    sec(6, 'Ton taux de gras, sans stress', fatFunnel(kg, ok ? b.bmr : 1980), "Aucune méthode simple ne mesure ton taux de gras au point près : Hébé est conçue pour qu'une erreur de quelques points pèse peu sur ta dépense au repos.", [
      ["Les balances et appareils d'impédance se trompent typiquement de 3 à 7,5 points selon le modèle. Les méthodes de laboratoire à plusieurs compartiments servent de référence, et la DXA s'en approche.", ['siedler', 'tinsley21', 'blue']],
      ["Les silhouettes donnent une estimation à l'œil : un bon point de départ, pas une mesure. Ton taux sert à calculer ta masse maigre, donc ta dépense au repos et tes protéines.", ['cunningham']],
      ["Pour aller plus loin, Hébé calcule ta masse grasse avec ta taille et ton tour de taille, pris au haut de la hanche. Cette formule a été validée contre le scanner sur plus de 3 000 adultes, et une méta-analyse de 2025 confirme qu'elle tombe juste en moyenne, même si l'écart peut être plus grand chez les personnes très sèches ou âgées.", ['woolcott', 'palumbo']],
      [`Exemple${ok ? ' pour toi' : ''} : à ${nf(kg)} kg, 5 points d'erreur décalent ta masse maigre de ${dec(lmErr)} kg et Katch-McArdle d'environ ${Math.round(kmErr)} kcal. La moyenne avec Harris-Benedict divise ce décalage par deux, à environ ${Math.round(kmErr / 2)} kcal, puis tes pesées le corrigent en deux à quatre semaines.`, null],
    ]),
    sec(7, 'Le jeûne 16:8, à découvrir', fastPlates(ok ? t.kcal : 2400), "Tu manges entre 12 h et 20 h. Les mêmes calories sur trois repas au lieu de quatre : chaque assiette est plus copieuse, et tu sors de table rassasié.", [
      ...(ok ? [[`Pour toi : ton déjeuner et ton dîner passent de ${nf(t.kcal * PLATE_SHARE.classique)} à ${nf(t.kcal * PLATE_SHARE.jeune)} kcal chacun, soit un quart de plus dans l'assiette.`, null]] : []),
      ["À calories égales, c'est au moins aussi efficace. Dans le plus grand essai, 139 adultes en surpoids ont mangé les mêmes calories pendant un an : ceux qui mangeaient sur 8 heures ont perdu 8,0 kg, les autres 6,3 kg, un écart trop petit pour être certain.", ['liu']],
      ["Une méta-analyse de 2026, qui regroupe 30 essais, va dans le même sens : à calories égales, la fenêtre de repas fait perdre en moyenne 1,5 kg de plus, surtout du gras.", ['fernandes']],
      ["Avec la musculation, ta prise de muscle et ta force suivent aussi bien : tes protéines restent les mêmes dans les deux formules.", ['ashtary', 'tinsley19', 'lowe']],
      ["Idéal si tu n'as pas faim le matin ou si tu préfères de vrais repas. Et si ça ne te convient pas, tu repasses à la formule classique en un geste.", null],
    ]),
    sec(8, 'Cuisiner une fois, manger sans risque', batchWeek(), "Bien refroidir, bien conserver et bien réchauffer tes boîtes suffit à garder ta cuisine du dimanche sûre toute la semaine.", [
      ["Les plats vont au frigo dans les 2 heures après la cuisson, dans l'heure s'il fait plus de 32 °C. Pour le riz, Hébé est plus stricte et demande 1 heure.", ['fsis', 'foodsafety', 'ansesBc']],
      ["Au frigo, à 4 °C ou moins, les plats se gardent 3 à 4 jours : Hébé s'arrête à 3. La suite de la semaine passe au congélateur, à −18 °C ou moins, et se décongèle la veille au frigo, la méthode la plus sûre.", ['fsis', 'foodsafety']],
      ["Réchauffe jusqu'à 74 °C : couvre, remue à mi-temps et vérifie que c'est chaud partout, car le micro-ondes laisse des zones froides.", ['fsis', 'foodsafety']],
      ["Le riz cuit peut contenir des spores de Bacillus cereus qui survivent à la cuisson. S'il reste tiède, elles produisent une toxine que le réchauffage ne détruit pas : d'où le refroidissement rapide.", ['ansesBc', 'ansesFiche']],
    ]),
    sec(9, 'Des limites raisonnables', weekMeals(), "Hébé suit les repères officiels de santé comme des recommandations. Quand un réglage les dépasse un peu, on te le dit.", [
      ["Viande rouge : un seul plat de bœuf par semaine. Le repère est de 500 g de viande hors volaille par semaine, soit 3 ou 4 steaks, ou 350 à 500 g cuits. Pour les gros appétits, les 4 repas de ce plat peuvent le dépasser : remplace-en un si tu veux t'y tenir.", ['spf', 'wcrf', 'iarc']],
      ["Charcuterie (jambon, blanc de volaille en tranches) : 160 g par semaine au plus, une barquette de 4 tranches, juste au-dessus du repère de 150 g.", ['spf']],
      ["Poisson : le repère est de 2 fois par semaine, dont un poisson gras, en variant les espèces. Hébé fait manger le poisson frais dans les 2 jours qui suivent la cuisson, par prudence.", ['spf', 'ansesFish']],
      ["Féculents : une même famille, comme le riz ou les pâtes, revient au plus 2 ou 3 fois par semaine, pour varier. Les féculents restent conseillés chaque jour, dont au moins un complet.", ['spf']],
    ]),
    `<section class="sci-card sci-supp">
      <h3><span class="sci-n">10</span>Ce que l'assiette ne couvre pas</h3>
      <p class="sci-lede">${nb("Tes menus font le gros du travail. Pour le reste, voici ce qui marche vraiment, et ce qui ne sert à rien.")}</p>
      <div class="sci-art">${coverBars()}</div>
      <div class="sp-list">
        ${[
          ['sun', 'Vitamine D', 'Le soleil d\'abord', 'warn', "15 à 20 minutes dehors en fin de matinée ou l'après-midi. Tes menus en apportent 3 µg sur 15 : en complément, seulement sur prescription, car on peut en prendre trop.", ['ansesVitD', 'vital', 'avenell']],
          ['fish', 'Oméga-3', 'Mange du poisson gras', 'good', "Une boîte de sardines ou de maquereau en plus par semaine, et c'est réglé. En capsules, ils ne changent presque rien pour le cœur.", ['ansesLip', 'abdelhamid', 'rimm']],
          ['drop', 'Fer, pour les femmes', 'Prise de sang d\'abord', 'warn', "12 mg dans tes menus : assez si tes règles sont légères, un peu juste si elles sont abondantes. Ton médecin vérifie ton stock avant tout complément.", ['ansesRef', 'ansesPnns', 'nihIron']],
          ['leaf', 'Fibres', 'Rien à ajouter', 'good', "26 à 38 g dans tes menus, comme ceux de l'Anses : les bénéfices pour le cœur et l'intestin sont nets dès 25 g.", ['ansesPnns', 'reynolds']],
          ['bolt', 'Créatine', 'Le mieux prouvé', 'best', "3 à 5 g par jour avec la musculation : en moyenne 1,1 kg de muscle en plus et de la force. Elle fait garder un peu d'eau, alors pas de panique si la balance monte d'un kilo.", ['kreider', 'delpino', 'wang']],
          ['cup', 'Caféine', 'Un coup de pouce', 'good', "3 à 6 mg par kg une heure avant ta séance. 400 mg par jour au maximum, 200 mg si tu es enceinte, et pas trop tard pour bien dormir.", ['guest', 'efsaCaf']],
          ['shake', 'Whey', 'Pratique, pas magique', 'good', "Une façon simple d'atteindre tes protéines quand l'assiette ne suffit pas.", ['jager']],
          ['baby', 'Projet bébé', 'Acide folique', 'warn', "0,4 mg par jour, au moins 4 semaines avant la conception. Parles-en à ton médecin ou à ta sage-femme.", ['hasFol']],
          ['x', 'Multivitamines', 'Inutile', 'no', "Aucune preuve qu'elles protègent du cœur ou du cancer. Bêta-carotène et vitamine E en complément : à éviter.", ['uspstf']],
        ].map(([ic, name, verdict, tone, text, refs]) => `<div class="sp sp-${tone}">
          <span class="sp-ic" aria-hidden="true">${SP_ICONS[ic]}</span>
          <div class="sp-body"><div class="sp-top"><b>${name}</b><em>${verdict}</em></div><p>${nb(text)}${pills(...refs)}</p></div>
        </div>`).join('')}
      </div>
      <p class="sp-note">Demande toujours l'avis d'un professionnel de santé avant de prendre un complément.</p>
    </section>`,
    sec(11, 'Des aliments bien mesurés', '', "Toutes les valeurs nutritionnelles de tes recettes viennent de tables officielles.", [
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

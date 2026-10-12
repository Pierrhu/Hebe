// science.js — v236 : fiche « Comment Hébé calcule », pour ceux que ça intéresse.
// Chaque règle de calcul de l'app, en clair, avec ses sources (numéros entre crochets).

import { openSheet, closeSheet } from './utils.js';

const SECTIONS = [
  ['Ta dépense au repos',
    "Hébé fait la moyenne de deux formules reconnues : Harris-Benedict révisée, qui part du poids, de la taille et de l'âge [1], et Katch-McArdle, qui part de la masse maigre [2]. La moyenne limite l'erreur de chacune, en particulier sur la masse grasse estimée. Le résultat reste proche de Mifflin-St Jeor, la formule de référence actuelle [3]."],
  ['Ta dépense de la journée',
    "Ta dépense au repos est multipliée par un coefficient d'activité de 1,35 à 1,8, dans les fourchettes de niveau d'activité de la FAO et de l'OMS [4]."],
  ['Tes protéines',
    "Environ 2 g par kg de masse maigre, soit 1,4 à 1,6 g par kg de poids : c'est la zone où la prise de muscle est maximale [5][6]. En perte de gras, les profils déjà secs montent à au moins 2,3 g par kg de masse maigre, pour protéger leurs muscles [7]."],
  ['Lipides et glucides',
    "Les lipides ne descendent jamais sous 20 % des calories pour un homme et 25 % pour une femme, ce qui reste dans les repères européens de 20 à 35 % [8]. Les glucides complètent le reste et tombent le plus souvent entre 40 et 60 %, autour des repères de 45 à 60 % [9]."],
  ['Les programmes',
    "Un surplus de 5 à 10 % pour prendre du muscle en limitant le gras [10], un déficit de 10 % pour la recomposition [11], et de 10 à 20 % pour perdre du gras. Le rythme visé, environ 0,5 % du poids par semaine, reste dans la zone qui préserve le muscle [12]."],
  ['L\'ajustement automatique',
    "Un kilo de variation de poids correspond à environ 7 700 kcal [13]. Hébé compare ce que prévoit ton plan à l'évolution réelle de ton poids sur deux à quatre semaines, en ignorant la première, où l'on perd surtout de l'eau [14]. La correction est lissée et ne dépasse jamais 15 %."],
  ['Les garde-fous',
    "Jamais moins que ta dépense au repos, ni moins de 1 200 kcal pour une femme et 1 500 kcal pour un homme, les planchers habituels des régimes hypocaloriques sans suivi médical [15]."],
  ['Les aliments',
    "Les valeurs nutritionnelles viennent des tables Ciqual de l'Anses [16], complétées par la base FoodData Central de l'USDA [17]. Les plats préparés se gardent 3 jours au frigo, ou au congélateur pour la suite de la semaine [18]."],
];

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

export function openScienceSheet() {
  const ref = t => t.replace(/((?:\[\d+\])+)/g, m => `<sup>${m.slice(1, -1).split('][').join(',')}</sup>`);
  openSheet(`<div class="sheet-handle"></div><div class="hb-sheet-pad sci">
    <div class="hb-h2">Comment Hébé calcule</div>
    <p class="sci-lead">Tous les chiffres de l'app viennent de règles publiées et reconnues. Les voici en bref, avec leurs sources.</p>
    ${SECTIONS.map(([h, t]) => `<div class="sci-sec"><h3>${h}</h3><p>${ref(t)}</p></div>`).join('')}
    <p class="sci-note">Ces calculs donnent un point de départ fiable pour un adulte en bonne santé. Ils ne remplacent pas l'avis d'un médecin ou d'un diététicien, notamment en cas de grossesse, de maladie ou de troubles alimentaires.</p>
    <details class="sci-src"><summary>Les ${SOURCES.length} sources</summary>
      <ol>${SOURCES.map(s => `<li>${s}</li>`).join('')}</ol>
    </details>
    <button class="hb-btn hb-btn-primary sci-close">Fermer</button>
  </div>`);
  document.querySelector('.sci-close')?.addEventListener('click', closeSheet);
}

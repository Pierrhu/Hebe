// Régimes sans lactose (v155) et sans gluten (v156)
// Pour toute personne qui a coché « Intolérance » ou « Strict » :
// - les recettes au fromage blanc, au fromage frais, au carré frais ou à la whey sont écartées pour elle ;
// - dans les recettes restantes : yaourt grec → yaourt sans lactose, lait → boisson à l'avoine,
//   crème → crème de coco ; en « Strict », cheddar et feta → emmental (parmesan et emmental, affinés, sont gardés).
// Les plats étant communs au foyer, les remplacements suivent le niveau le plus strict du foyer.
import { RECIPES } from '../data/recipes.js';
import { INGREDIENTS, ingMacros } from '../data/ingredients.js';
import { getMembers } from '../data/household.js';
import { getEquipment } from './adapt.js';
import { applyStaples } from './staples.js';

export const LACTOSE_OUT = ['fromage_blanc', 'fromage_frais', 'carre_frais', 'whey', 'cottage'];
const SUB1 = { yaourt_grec: 'yaourt_sl', lait: 'boisson_avoine', creme: 'creme_coco' };
const SUB2 = { ...SUB1, cheddar: 'emmental', feta: 'emmental' };

// Gluten : « Sensibilité » (1) ou « Strict » (2)
export const GLUTEN_OUT1 = ['chapelure', 'gnocchis', 'boudoirs'];                // écartées dans les deux niveaux
export const GLUTEN_OUT2 = ['flocons', 'granola', 'cornflakes'];     // en plus, en strict (risque de traces)
const GSUB1 = { semoule: 'riz', boulghour: 'riz', pates: 'pates_sg', nouilles_oeufs: 'pates_sg', pain: 'pain_sg', baguette: 'pain_sg', pain_burger: 'pain_sg', pita: 'wrap_sg', tortilla: 'wrap_sg' };
const GSUB2 = { ...GSUB1, soja: 'tamari' };
const GDROP = ['oignons_frits'];

export const lactoseOf = id => (getMembers().find(m => m.id === id)?.lactose || 0);
export const glutenOf = id => (getMembers().find(m => m.id === id)?.gluten || 0);
export const householdLactose = () => Math.max(0, ...getMembers().map(m => m.lactose || 0));
export const householdGluten = () => Math.max(0, ...getMembers().map(m => m.gluten || 0));
// Sans lactose, les compléments protéinés (tartines au carré frais, fromage blanc) disparaissent :
// ses plats portent un peu plus de protéines pour compenser.
export const PROTEIN_BOOST = 1.25;
export const proteinBoost = id => (lactoseOf(id) >= 1 ? PROTEIN_BOOST : 1);
// recette permise pour une personne (niveaux de lactose et de gluten : 0, 1 ou 2)
export const dietOk = (r, lac = 0, glu = 0) => !!r && !(lac >= 1 && r.lacOut) && !(glu >= 1 && r.gluOut1) && !(glu >= 2 && r.gluOut2);

// Textes des étapes et des noms
function retext(t, sub) {
  if (sub.yaourt_grec) t = t.replace(/yaourt grec/g, 'yaourt sans lactose').replace(/Yaourt grec/g, 'Yaourt sans lactose');
  if (sub.lait) t = t
    .replace(/\blait demi-écrémé\b/g, "boisson à l'avoine")
    .replace(/\b([Ll])e lait\b(?! de coco)/g, (m, l) => `${l === 'L' ? 'La' : 'la'} boisson à l'avoine`)
    .replace(/\bdu lait\b(?! de coco)/g, "de la boisson à l'avoine")
    .replace(/\bet lait\b(?! de coco)/g, "et boisson à l'avoine")
    .replace(/, lait\b(?! de coco)/g, ", boisson à l'avoine");
  if (sub.creme) t = t.replace(/crème fraîche/g, 'crème de coco').replace(/\bla crème\b(?! de coco)/g, 'la crème de coco');
  if (sub.cheddar) t = t.replace(/la tranche de cheddar/g, "l'emmental").replace(/cheddar/g, 'emmental');
  if (sub.feta) t = t.replace(/la feta émiettée/g, "l'emmental râpé").replace(/\bfeta\b/g, 'emmental');
  return t;
}

// Étapes propres au passage au riz et aux pâtes sans gluten
function glutenSteps(r, steps, used) {
  const eq = getEquipment() || {};
  const cooker = eq.autocuiseur !== false;
  // étape du riz, selon l'équipement du foyer (mêmes textes que le reste de l'app)
  const rizBase = (RECIPES.find(x => x.id === 'W01')?.baseSteps || []).find(st => /^Riz :/.test(st));
  const riz = cooker && rizBase ? rizBase
    : "Riz : rince-le à l'eau froide, puis mets-le dans une casserole avec 2,5 fois son poids d'eau (par exemple 225 ml d'eau pour 90 g de riz). Porte à ébullition, couvre, baisse à feu très doux et laisse cuire 35 minutes, puis laisse reposer 10 minutes hors du feu sans ouvrir. Mets-le en boîtes dès qu'il a tiédi : le riz cuit ne doit pas rester plus d'une heure à température ambiante.";
  const pastaSG = "Fais cuire les pâtes sans gluten dans une grande casserole d'eau bouillante salée, le temps indiqué sur le paquet : sous pression, elles colleraient. Égoutte-les en gardant 3 cuillères à soupe d'eau de cuisson par portion.";
  let out = steps.slice();
  if (used.pates || used.nouilles_oeufs) out = out.map(st => st
    .replace(/Fais cuire les pâtes à l'autocuiseur.*$/s, pastaSG)
    .replace(/Fais cuire les pâtes dans une grande casserole d'eau bouillante salée.*$/s, pastaSG)
    .replace(/^Fais cuire les nouilles aux œufs.*$/s, pastaSG + ' Rince-les à l\'eau froide.'));
  if (used.semoule && r.id === 'W07') {
    const i = out.findIndex(st => /même volume d'eau que de semoule/.test(st));
    if (i >= 0) {
      const n = /eau bouillante sur la semoule/.test(out[i + 1] || '') ? 2 : 1;
      out.splice(i, n, cooker ? "Verse le tajine dans un plat et rince la cuve." : "Laisse le tajine dans la cocotte, à couvert.", riz);
    }
  }
  if (used.boulghour && r.id === 'W05') out = out.map(st => /boulgour/.test(st) && /tomates/.test(st) ? (cooker
    ? "Rince le riz, puis fais-le revenir 2 minutes dans l'huile à l'autocuiseur en mode dorer. Ajoute les tomates, le concentré et 1,7 fois le poids du riz en eau, ferme et laisse cuire 20 minutes sous pression, puis laisse la pression retomber seule pendant 10 minutes."
    : "Rince le riz, puis fais-le revenir 2 minutes dans l'huile dans une casserole. Ajoute les tomates, le concentré et 2,5 fois le poids du riz en eau, couvre et laisse cuire 35 minutes à feu doux, puis 10 minutes hors du feu.") : st);
  if (used.boulghour && r.id === 'W40') out = out.map(st => /^Fais cuire le boulgour/.test(st) ? riz.replace(/Mets-le en boîtes dès qu'il a tiédi : le riz cuit ne doit pas rester plus d'une heure à température ambiante\./, "Étale-le sur un plat pour qu'il refroidisse vite : le riz cuit ne doit pas rester plus d'une heure à température ambiante.") : st);
  return out;
}
function gretext(t, used) {
  if (used.boulghour) t = t.replace(/boulgour pilavı/g, 'riz pilaf').replace(/taboulé(?! de riz)/g, 'taboulé de riz').replace(/\bboulgour\b/g, 'riz');
  if (used.semoule) t = t.replace(/pour qu'elle ne détrempe pas/g, "pour qu'il ne détrempe pas").replace(/\bla semoule\b/g, 'le riz').replace(/\bsemoule\b/g, 'riz');
  if (used.pates) t = t.replace(/\bles pâtes\b(?! sans gluten)/g, 'les pâtes sans gluten');
  if (used.pain_burger) t = t.replace(/\ble pain\b(?! sans gluten)/g, 'le pain sans gluten');
  if (used.pain || used.baguette) t = t.replace(/\bla baguette\b/g, 'le pain sans gluten').replace(/\bbaguette\b/g, 'pain sans gluten').replace(/\b([Ll]e|du|de) pain\b(?! sans gluten)/g, '$1 pain sans gluten');
  if (used.tortilla || used.pita) t = t
    .replace(/\btortillas\b/g, 'wraps sans gluten').replace(/\btortilla\b/g, 'wrap sans gluten')
    .replace(/\bles pitas\b/g, 'les wraps sans gluten').replace(/\bla pita\b/g, 'le wrap sans gluten').replace(/& pita\b/g, '& wrap sans gluten')
    .replace(/\bles galettes\b/g, 'les wraps sans gluten').replace(/\bla galette\b/g, 'le wrap sans gluten');
  if (used.soja) t = t.replace(/\bsauce soja\b/g, 'sauce tamari');
  if ('oignons_frits' in used) t = t
    .replace(/, et termine par les oignons frits/g, '').replace(/, comme les oignons frits dans leur paquet/g, '')
    .replace(/la sauce et les oignons frits dans deux petits pots/g, 'la sauce dans un petit pot')
    .replace(/, la sauce blanche et les oignons frits/g, ' et la sauce blanche').replace(/ et ajoute les oignons frits/g, '');
  return t;
}

// À appeler après applyEquipment() (qui remet les étapes d'origine)
export function applyDiet() {
  const L = householdLactose(), G = householdGluten();
  const lsub = L >= 2 ? SUB2 : L >= 1 ? SUB1 : {};
  const gsub = G >= 2 ? GSUB2 : G >= 1 ? GSUB1 : {};
  RECIPES.forEach(r => {
    if (!r._dietBase) r._dietBase = { ings: r.ingredients.map(i => ({ ...i })), name: r.name, macros: { ...r.macros } };
    if (!r.baseSteps) r.baseSteps = r.steps.slice();
    r.steps = (r._eqSteps || r.baseSteps).slice();
    const b = r._dietBase, has = k => b.ings.some(i => i.key === k);
    r.lacOut = b.ings.some(i => LACTOSE_OUT.includes(i.key));
    r.gluOut1 = b.ings.some(i => GLUTEN_OUT1.includes(i.key));
    r.gluOut2 = r.gluOut1 || b.ings.some(i => GLUTEN_OUT2.includes(i.key));
    const lused = Object.fromEntries(Object.entries(lsub).filter(([k]) => has(k)));
    const gused = Object.fromEntries(Object.entries(gsub).filter(([k]) => has(k)));
    if (G >= 1) GDROP.forEach(k => { if (has(k)) gused[k] = null; });
    if (!Object.keys(lused).length && !Object.keys(gused).length) { r.ingredients = b.ings.map(i => ({ ...i })); r.name = b.name; r.macros = { ...b.macros }; return; }
    const sub = { ...lused, ...gused };
    r.ingredients = b.ings.filter(i => sub[i.key] !== null).map(i => {
      const k = sub[i.key];
      if (!k) return { ...i };
      const m = ingMacros(k, i.qty);
      return { ...i, key: k, name: INGREDIENTS[k]?.name || i.name, kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat };
    });
    const tot = r.ingredients.reduce((a, i) => ({ kcal: a.kcal + (i.kcal || 0), protein: a.protein + (i.protein || 0), carbs: a.carbs + (i.carbs || 0), fat: a.fat + (i.fat || 0) }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
    r.macros = { kcal: Math.round(tot.kcal), protein: Math.round(tot.protein), carbs: Math.round(tot.carbs), fat: Math.round(tot.fat) };
    let steps = Object.keys(gused).length ? glutenSteps(r, r.steps, gused) : r.steps;
    r.name = gretext(retext(b.name, lused), gused);
    r.steps = steps.map(st => gretext(retext(st, lused), gused));
  });
  applyStaples(); // puis riz et pâtes complets ou classiques
}

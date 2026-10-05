// adapt.js — Adapte les recettes à l'équipement du foyer.
//
// Les recettes sont rédigées pour : plaques de cuisson (poêle), air fryer, autocuiseur, et micro-ondes ou poêle
// pour réchauffer. Selon l'équipement déclaré :
//   - sans air fryer mais avec un four : « à l'air fryer à 200 °C » devient « au four à 220 °C », temps × 1,5 ;
//   - sans autocuiseur mais avec des plaques : cocotte ou casserole, avec une version rédigée et vérifiée
//     de chaque étape sous pression (table STOVE) ; le riz se cuit à la casserole ;
//   - sans micro-ondes : réchauffage à la poêle ;
//   - ce qui reste impossible (mixeur absent, aucun moyen de cuire) rend la recette indisponible.
// Les étapes d'origine sont gardées dans r.baseSteps ; r.steps contient la version adaptée.

import { RECIPES } from '../data/recipes.js';
import { getHousehold } from '../data/household.js';

export const TOOLS = [
  { key: 'plaque',      label: 'Plaques de cuisson', desc: 'Poêle et casserole' },
  { key: 'four',        label: 'Four',               desc: 'Traditionnel ou à chaleur tournante' },
  { key: 'airfryer',    label: 'Air fryer',          desc: 'Friteuse sans huile' },
  { key: 'autocuiseur', label: 'Autocuiseur',        desc: 'Cookeo, cocotte-minute électrique' },
  { key: 'microondes',  label: 'Micro-ondes',        desc: 'Pour réchauffer les boîtes' },
  { key: 'mixeur',      label: 'Mixeur',             desc: 'Pour les smoothies et les shakes' },
];
// Équipement d'origine de l'app (profils repris des anciennes versions)
export const DEFAULT_EQUIPMENT = { plaque: true, four: false, airfryer: true, autocuiseur: true, microondes: true, mixeur: true };

export const getEquipment = () => getHousehold().equipment || null;
const eqOr = () => getEquipment() || DEFAULT_EQUIPMENT;

// Ce dont une recette a besoin, d'après ses étapes (hors « Au moment de manger »)
export function needs(r) {
  const txt = (r.baseSteps || r.steps).filter(s => !/^Au moment de manger/.test(s)).join(' ');
  return {
    airfryer: /air fryer/i.test(txt),
    autocuiseur: /autocuiseur/i.test(txt),
    plaque: /poêle/i.test(txt),
    mixeur: /mixeur|\bmixe\b/i.test(txt),
  };
}
export function isPossible(r, eq = eqOr()) {
  const n = needs(r);
  if (n.mixeur && !eq.mixeur) return false;
  if (n.airfryer && !eq.airfryer && !eq.four) return false;
  if (n.autocuiseur && !eq.autocuiseur && (!eq.plaque || !stoveReady(r))) return false;
  if (n.plaque && !eq.plaque) return false;
  return true;
}

// Four à la place de l'air fryer : +20 °C et environ 30 % de temps en plus
const ovenTime = t => (t <= 4 ? t + 2 : Math.round(t * 1.3));

// Sans autocuiseur : version rédigée et vérifiée pour chaque étape sous pression (pas de formule).
// [recette, étape d'origine reconnue, étape pour la cocotte ou la casserole]
// Une étape sous pression sans version ici rend la recette indisponible sans autocuiseur
// (le youvetsi, par exemple : à la cocotte, la macreuse demande 1 h 30, trop long pour une session).
const STOVE = [
  ['W01', /laisse cuire 5 minutes sous pression/, "Couvre et laisse mijoter 15 minutes à feu doux, en remuant à mi-cuisson, jusqu'à ce que l'aubergine soit fondante et le poulet cuit à cœur."],
  ['W05', /^Fais revenir le boulgour/, "Fais revenir le boulgour 2 minutes dans l'huile, dans une casserole à feu moyen. Ajoute les tomates, le concentré et 2 fois le volume du boulgour en eau. Porte à ébullition, couvre et laisse cuire 12 minutes à feu doux, puis laisse reposer 5 minutes hors du feu."],
  ['W06', /^Rince le riz et les lentilles/, "Rince le riz et les lentilles séparément. Mets le riz dans une casserole avec 2,5 fois son poids d'eau, porte à ébullition, couvre et laisse cuire 15 minutes à feu doux. Ajoute les lentilles, le cumin, le reste de l'huile et 3 fois le poids des lentilles en eau, couvre et laisse cuire 20 minutes à feu doux, jusqu'à ce que l'eau soit absorbée, puis laisse reposer 5 minutes hors du feu."],
  ['W07', /laisse cuire 7 minutes sous pression/, "Ajoute les carottes, les courgettes, les olives et 150 ml d'eau par portion. Couvre et laisse mijoter 20 minutes à feu doux, jusqu'à ce que les carottes soient tendres."],
  ['W07', /^Verse le tajine dans un plat/, "Laisse le tajine dans la cocotte, à couvert. Fais bouillir le même volume d'eau que de semoule dans une casserole."],
  ['W08', /^Coupe le blanc de poulet en 2 ou 3 morceaux épais/, "Coupe le blanc de poulet en 2 ou 3 morceaux épais. Mets-les dans une cocotte avec les tomates, l'oignon, l'ail, le paprika fumé, une pincée de piment et 100 ml d'eau par portion. Porte à frémissement, couvre et laisse mijoter 20 minutes à feu doux, en retournant le poulet à mi-cuisson : il doit se défaire facilement à la fourchette."],
  ['W12', /^Mets-les dans l'autocuiseur avec le curry/, "Mets-les dans une casserole avec le curry en poudre, le miel, la sauce soja et 250 ml d'eau par portion. Porte à ébullition, couvre et laisse mijoter 15 minutes à feu doux, jusqu'à ce que la pomme de terre s'écrase facilement."],
  ['W14', /laisse cuire 6 minutes sous pression/, "Ajoute les tomates, le concentré et le poulet avec sa marinade. Couvre et laisse mijoter 15 minutes à feu doux, en remuant de temps en temps, jusqu'à ce que le poulet soit cuit à cœur."],
  ['W24', /laisse cuire 5 minutes sous pression/, "Ajoute les haricots, les tomates, l'aneth, les épinards et 100 ml d'eau par portion. Couvre et laisse mijoter 15 minutes à feu doux, en remuant de temps en temps."],
  ['W26', /laisse cuire 6 minutes sous pression/, "Ajoute les pois chiches, les tomates, les épinards et 100 ml d'eau par portion. Couvre et laisse mijoter 15 minutes à feu doux, en remuant de temps en temps."],
  ['W29', /Pose les œufs entiers/, "Ajoute les lentilles, les tomates, les épinards et 4 fois le poids des lentilles en eau. Pose les œufs entiers, dans leur coquille, sur le dessus. Couvre et laisse mijoter 15 minutes à feu doux : les lentilles se défont et les œufs cuisent à la vapeur jusqu'à être durs."],
  ['W30', /^Mets dans l'autocuiseur le riz, les tomates/, "Mets dans une casserole le riz, les tomates, l'oignon, le poivron, le reste de l'huile et 2,2 fois le poids du riz en eau. Porte à ébullition, couvre et laisse cuire 35 minutes à feu très doux, puis laisse reposer 10 minutes hors du feu sans ouvrir."],
  ['W18', /^Fais cuire les nouilles aux œufs à l'autocuiseur/, "Fais cuire les nouilles aux œufs dans une grande casserole d'eau bouillante salée, le temps indiqué sur le paquet, puis égoutte-les et rince-les à l'eau froide. Si tu n'as pas trouvé de nouilles aux œufs, des spaghettis conviennent très bien."],
  ['W33', /^Fais cuire les pâtes à l'autocuiseur/, "Fais cuire les pâtes dans une grande casserole d'eau bouillante salée, le temps indiqué sur le paquet. Égoutte-les en gardant 3 cuillères à soupe d'eau de cuisson par portion."],
  ['W39', /laisse cuire 10 minutes sous pression/, "Ajoute les tomates, le concentré, les herbes de Provence et 100 ml d'eau par portion. Couvre et laisse mijoter 20 minutes à feu doux, en remuant de temps en temps."],
  ['W39', /^Verse la sauce dans un plat et rince la cuve/, "Fais cuire les pâtes dans une grande casserole d'eau bouillante salée, le temps indiqué sur le paquet, puis égoutte-les."],
  ['W40', /^Fais cuire le boulgour à l'autocuiseur/, "Fais cuire le boulgour dans une casserole avec 2 fois son volume d'eau et une pincée de sel : porte à ébullition, couvre et laisse cuire 12 minutes à feu doux, puis 5 minutes hors du feu. Laisse-le refroidir."],
  ['W45', /^Fais cuire les pâtes à l'autocuiseur/, "Fais cuire les pâtes dans une grande casserole d'eau bouillante salée, le temps indiqué sur le paquet, puis égoutte-les et mélange-les à la sauce."],
  ['K11', /^Mets dans l'autocuiseur le riz, le lait/, 'Mets dans une casserole le riz, le lait et le lait de coco.'],
  ['K11', /laisse cuire 12 minutes sous pression/, "Porte à frémissement, puis laisse cuire 30 minutes à feu très doux, sans couvrir, en remuant souvent pour que le lait n'attache pas."],
  ['S01', /^Mets-le dans l'autocuiseur/, "Mets-le dans une casserole avec 1,7 fois son poids d'eau (par exemple 135 ml d'eau pour 80 g de riz)."],
  ['S01', /sous pression/, "Porte à ébullition, couvre, baisse à feu très doux et laisse cuire 12 minutes, puis laisse reposer 5 minutes hors du feu sans ouvrir."],
  ['S04', /^Mets-le dans l'autocuiseur/, "Mets-le dans une casserole avec 2 fois son volume d'eau."],
  ['S04', /sous pression/, 'Porte à ébullition, couvre et laisse cuire 12 minutes à feu doux, puis laisse reposer 5 minutes hors du feu.'],
];
const stoveFor = (r, st) => {
  const id = r.wheyOf || r.id;
  const hit = STOVE.find(([rid, rx]) => rid === id && rx.test(st));
  return hit ? hit[2] : null;
};
// Recette faisable sans autocuiseur : chaque étape sous pression a sa version vérifiée
const stoveReady = r => (r.baseSteps || r.steps).filter(st => /sous pression/.test(st) && !/^Riz : /.test(st)).every(st => stoveFor(r, st));

// Réécrit une étape pour l'équipement donné
export function adaptStep(st, eq = eqOr(), r = null) {
  let s = st;
  // version vérifiée pour la cocotte ou la casserole
  if (r && !eq.autocuiseur && eq.plaque) { const v = stoveFor(r, st); if (v) return v; }
  // ── Air fryer → four ──
  if (!eq.airfryer && eq.four) {
    s = s.replace(/(\d+)(?: à (\d+))? minutes? à l'air fryer à (\d+) °C/g, (_, a, b, t) =>
      `${ovenTime(+a)}${b ? ` à ${ovenTime(+b)}` : ''} minutes au four préchauffé à ${+t + 20} °C`);
    s = s.replace(/(\d+) minutes? à l'air fryer/g, (_, a) => `${ovenTime(+a)} minutes au four préchauffé à 200 °C`);
    s = s.replace(/en secouant le panier (?:toutes les \d+ minutes|deux fois|à mi-cuisson)?/g, 'en les retournant à mi-cuisson');
    s = s.replace(/secoue le panier/g, 'retourne-les');
    s = s.replace(/l'air fryer/g, 'le four').replace(/air fryer/g, 'four');
    s = s.replace(/sans les superposer/g, 'en une seule couche, sur une plaque couverte de papier cuisson');
  }
  // ── Ni air fryer ni four : les finitions du moment du repas se font à la poêle (galettes, réchauffage) ──
  if (!eq.airfryer && !eq.four && eq.plaque && /^Au moment de manger/.test(s)) {
    s = s.replace(/(?:, )?ou (\d+) minutes? à l'air fryer(?: à \d+ °C)?/g, '');
    s = s.replace(/(\d+)(?: à (\d+))? minutes? à l'air fryer(?: à \d+ °C)?/g, (_, a, b) => `${a}${b ? ` à ${b}` : ''} minutes à la poêle à feu moyen, à couvert`);
  }
  // ── Autocuiseur → cocotte ou casserole sur les plaques ──
  if (!eq.autocuiseur && eq.plaque) {
    if (/^Riz : /.test(s)) {
      return "Riz : rince-le à l'eau froide, puis mets-le dans une casserole avec 2,5 fois son poids d'eau (par exemple 225 ml d'eau pour 90 g de riz). Porte à ébullition, couvre, baisse à feu très doux et laisse cuire 35 minutes, puis laisse reposer 10 minutes hors du feu sans ouvrir. Mets-le en boîtes dès qu'il a tiédi : le riz cuit ne doit pas rester plus d'une heure à température ambiante.";
    }
    s = s.replace(/Fais chauffer ([^.]*?) dans l'autocuiseur en mode dorer, couvercle ouvert, jusqu'à ébullition/g, 'Fais bouillir $1 dans une casserole');
    s = s.replace(/fais-y chauffer ([^.]*?) en mode dorer, couvercle ouvert, jusqu'à ébullition/g, 'fais bouillir $1 dans une casserole');
    s = s.replace(/Mets l'autocuiseur en mode dorer et fais/g, 'Dans une cocotte à feu moyen, fais');
    s = s.replace(/à l'autocuiseur en mode dorer/g, 'dans une cocotte à feu moyen');
    s = s.replace(/en mode dorer, couvercle ouvert/g, 'à feu vif, sans couvercle');
    s = s.replace(/en mode dorer/g, 'à feu moyen');
    s = s.replace(/, puis laisse la pression retomber seule pendant 10 minutes(?: avant d'ouvrir)?/g, ', puis laisse reposer 10 minutes hors du feu, à couvert');
    s = s.replace(/, puis laisse la pression retomber seule/g, '');
    s = s.replace(/, puis fais tomber la pression(?: avant d'ouvrir)?/g, '');
    s = s.replace(/ À la fin de la cuisson, fais tomber la pression avant d'ouvrir\./g, '');
    s = s.replace(/Une fois la pression tombée, /g, 'En fin de cuisson, ');
    s = s.replace(/Ne remplis pas la cuve à plus de la moitié : le lait mousse en cuisant\./g, 'Remue de temps en temps : le lait attache facilement.');
    s = s.replace(/Rince la cuve/g, 'Rince la cocotte');
    s = s.replace(/(?:dans |à )l'autocuiseur/gi, m => (m[0] === 'à' || m[0] === 'À' ? 'dans la cocotte' : 'dans la cocotte'));
    s = s.replace(/l'autocuiseur/g, 'la cocotte');
  }
  // ── Pas de micro-ondes : réchauffage à la poêle ──
  if (!eq.microondes) {
    s = s.replace(/réchauffe (\d+ minutes?(?: \d+)?) au micro-ondes(?: à puissance moyenne)?(?: [^,]*)?, ou (\d+ minutes? à la poêle[^.]*)/g, 'réchauffe $2');
    s = s.replace(/réchauffe ([^.,]*?) (\d+ minutes?(?: \d+)?) au micro-ondes(?: à puissance moyenne(?: pour [^,.]*)?)? ou (\d+ minutes? à l'(?:air fryer|four)[^.,]*)/g, 'réchauffe $1 $3');
    s = s.replace(/(\d+) minutes?(?: (\d+))? au micro-ondes(?: à puissance moyenne)?/g, '5 minutes à la poêle à feu doux avec un fond d\'eau');
    s = s.replace(/, ou mange-le froid/g, ', ou mange-le froid');
  }
  return s;
}

// Applique l'équipement du foyer à toutes les recettes (au démarrage et après un changement)
export function applyEquipment() {
  const eq = eqOr();
  RECIPES.forEach(r => {
    if (!r.baseSteps) r.baseSteps = r.steps.slice();
    r.steps = r.baseSteps.map(st => adaptStep(st, eq, r));
    r._eqSteps = r.steps.slice(); // point de départ du régime (diet.js)
    r.unavailable = !isPossible(r, eq);
  });
}
export const isAvailable = r => !!r && !r.unavailable;

// Nombre de plats possibles avec un équipement donné (pour l'accueil)
export function countPossible(eq) {
  const mains = RECIPES.filter(r => !r.retired && (r.category === 'dinner' || r.category === 'lunch') && r.batch && !(r.tags || []).includes('cantine'));
  return { ok: mains.filter(r => isPossible(r, eq)).length, total: mains.length };
}

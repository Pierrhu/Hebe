// staples.js — Riz et pâtes complets ou classiques (v171)
// Les recettes sont écrites au riz complet et aux pâtes complètes. Selon le réglage du foyer (Mon programme → Riz et pâtes),
// ou le choix fait sur la fiche d'un plat en mode « plat par plat », on repasse au riz blanc et aux pâtes classiques :
// ingrédient, valeurs nutritionnelles, nom, étapes (eau et temps de cuisson) et temps affiché.
// Appliqué en dernier, après l'équipement (adapt.js) et le régime (diet.js), pour couvrir aussi le riz
// qui remplace la semoule ou le boulgour dans le régime sans gluten.
import { RECIPES } from '../data/recipes.js';
import { INGREDIENTS, ingMacros } from '../data/ingredients.js';
import { getStaples, getDishStaple } from '../data/household.js';

const CLASSIC = { riz: 'riz_blanc', pates: 'pates_classiques' };

// le plat est-il cuisiné en complet ?
export function isWhole(id) {
  const mode = getStaples();
  if (mode === 'classique') return false;
  if (mode === 'plat') return getDishStaple(id) !== 'classique';
  return true;
}
// 'riz', 'pates' ou null : ce que le réglage concerne dans ce plat (avant substitution)
export const stapleKind = r => r?._staple || null;

// Textes : version complète → version classique (textes d'origine de la v169)
const TEXTS = [
  // riz à l'autocuiseur (étape « Riz : » des fiches)
  ["avec 1,7 fois son poids d'eau (par exemple 150 ml d'eau pour 90 g de riz). Ferme, laisse cuire 20 minutes sous pression",
   "avec 1,5 fois son poids d'eau (par exemple 135 ml d'eau pour 90 g de riz). Ferme, laisse cuire 5 minutes sous pression"],
  // riz à la casserole (fiches sans autocuiseur, régime sans gluten)
  ["avec 2,5 fois son poids d'eau (par exemple 225 ml d'eau pour 90 g de riz). Porte à ébullition, couvre, baisse à feu très doux et laisse cuire 35 minutes, puis laisse reposer 10 minutes hors du feu sans ouvrir.",
   "avec 1,7 fois son poids d'eau (par exemple 150 ml d'eau pour 90 g de riz). Porte à ébullition, couvre, baisse à feu très doux et laisse cuire 12 minutes, puis laisse reposer 5 minutes hors du feu sans ouvrir."],
  // W06 mujaddara, autocuiseur
  ["Rince le riz et les lentilles séparément. Mets le riz dans l'autocuiseur avec 1,7 fois son poids d'eau, ferme et laisse cuire 14 minutes sous pression, puis fais tomber la pression : le riz complet a besoin d'une avance sur les lentilles. Ajoute les lentilles, 1 g de cumin, le reste de l'huile et 2 fois le poids des lentilles en eau. Referme, laisse cuire 6 minutes sous pression, puis laisse la pression retomber seule pendant 10 minutes : tout finit de cuire ensemble sans que les lentilles se défassent.",
   "Rince les lentilles et le riz. Mets-les dans l'autocuiseur avec 1 g de cumin, le reste de l'huile et 2 fois leur poids d'eau. Ferme et laisse cuire 6 minutes sous pression, puis laisse la pression retomber seule pendant 10 minutes : les lentilles finissent de cuire sans que le riz se défasse."],
  // W06 mujaddara, casserole
  ["Rince le riz et les lentilles séparément. Mets le riz dans une casserole avec 2,5 fois son poids d'eau, porte à ébullition, couvre et laisse cuire 15 minutes à feu doux. Ajoute les lentilles, le cumin, le reste de l'huile et 3 fois le poids des lentilles en eau, couvre et laisse cuire 20 minutes à feu doux, jusqu'à ce que l'eau soit absorbée, puis laisse reposer 5 minutes hors du feu.",
   "Rince les lentilles et le riz séparément. Mets les lentilles dans une casserole avec 3 fois leur poids d'eau et le cumin, porte à ébullition et laisse cuire 10 minutes à feu moyen. Ajoute le riz, le reste de l'huile et 1,7 fois le poids du riz en eau, couvre et laisse cuire 15 minutes à feu doux, jusqu'à ce que l'eau soit absorbée, puis laisse reposer 5 minutes hors du feu."],
  // W30 riz à la tomate
  ["et 1,4 fois le poids du riz en eau. Ferme et laisse cuire 20 minutes sous pression",
   "et 1,2 fois le poids du riz en eau. Ferme et laisse cuire 5 minutes sous pression"],
  ["et 2,2 fois le poids du riz en eau. Porte à ébullition, couvre et laisse cuire 35 minutes à feu très doux, puis laisse reposer 10 minutes hors du feu sans ouvrir.",
   "et 1,7 fois le poids du riz en eau. Porte à ébullition, couvre et laisse cuire 15 minutes à feu très doux, puis laisse reposer 5 minutes hors du feu sans ouvrir."],
  // régime sans gluten : riz à la tomate à la place du boulgour (W05)
  ["et 1,7 fois le poids du riz en eau, ferme et laisse cuire 20 minutes sous pression,",
   "et 1,5 fois le poids du riz en eau, ferme et laisse cuire 5 minutes sous pression,"],
  ["et 2,5 fois le poids du riz en eau, couvre et laisse cuire 35 minutes à feu doux, puis 10 minutes hors du feu.",
   "et 1,7 fois le poids du riz en eau, couvre et laisse cuire 15 minutes à feu doux, puis 5 minutes hors du feu."],
  // W33 pâtes à l'autocuiseur
  ["(5 minutes pour des pâtes complètes à 10 ou 11 minutes)", "(4 minutes pour des pâtes à 9 ou 10 minutes)"],
];
const classicText = t => TEXTS.reduce((s, [a, b]) => s.split(a).join(b), t);
const classicName = n => n.replace(/riz complet/g, 'riz basmati').replace(/pâtes complètes/g, 'pâtes');

export function applyStaples() {
  RECIPES.forEach(r => {
    if (r._cookBase === undefined) r._cookBase = r.cookTime;
    r.cookTime = r._cookBase;
    const keys = r.ingredients.filter(i => !i.extra).map(i => i.key);
    r._staple = keys.includes('riz') ? 'riz' : keys.includes('pates') ? 'pates' : null;
    if (!r._staple || isWhole(r.id)) return;
    r.ingredients = r.ingredients.map(i => {
      const k = !i.extra && CLASSIC[i.key];
      if (!k) return i;
      const m = ingMacros(k, i.qty);
      return { ...i, key: k, name: INGREDIENTS[k].name, kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat };
    });
    const t = r.ingredients.reduce((a, i) => ({ kcal: a.kcal + (i.kcal || 0), protein: a.protein + (i.protein || 0), carbs: a.carbs + (i.carbs || 0), fat: a.fat + (i.fat || 0) }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
    r.macros = { kcal: Math.round(t.kcal), protein: Math.round(t.protein), carbs: Math.round(t.carbs), fat: Math.round(t.fat) };
    r.name = classicName(r.name);
    r.steps = r.steps.map(classicText);
    // le riz blanc cuit 15 minutes de moins (voir generer.js)
    if (['lunch', 'dinner'].includes(r.category) && (r._dietBase?.ings || r.ingredients).some(i => i.key === 'riz')) r.cookTime = Math.max(0, r.cookTime - 15);
  });
}

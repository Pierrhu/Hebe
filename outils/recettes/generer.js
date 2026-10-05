const fs=require('fs');
const path=require('path');
const ICI=__dirname, RACINE=path.join(__dirname,'..','..');
const old=JSON.parse(fs.readFileSync(path.join(ICI,'recettes_anciennes.json'),'utf8'));
const byId=Object.fromEntries(old.map(o=>[o.id,o]));
// Portions de base revues (assiettes ~550-700 kcal, ≥150 g de légumes)
const FIX={
 D01:{ings:[['poulet',150],['riz',75],['brocoli',150],['soja',15],['miel',8],['sesame',5],['huile',5]]},
 D02:{ings:[['saumon',130],['patate_douce',220],['brocoli',150],['huile',5],['citron',10]]},
 D03:{ings:[['boeuf',140],['riz',75],['poivron',150],['oignon',50],['soja',10],['huile',5]]},
 D04:{ings:[['crevettes',150],['nouilles_riz',75],['courgette',150],['ail',2],['huile',8],['citron',15]]},
 D05:{ings:[['poulet',150],['tortilla',80],['poivron',150],['oignon',60],['epices',5],['huile',5]]},
 D06:{ings:[['boeuf',140],['oeuf',1],['chapelure',15],['pdt',250],['lait',40],['oignon',40],['haricots_verts',150]],add:'Servir avec les haricots verts (poêle ou vapeur, 6 min).'},
 D07:{ings:[['poulet',150],['chapelure',25],['oeuf',1],['pdt',250],['huile',8],['haricots_verts',150]],add:'Haricots verts à la poêle en accompagnement.'},
 D08:{ings:[['poulet',150],['riz',75],['yaourt_grec',60],['epices',5],['ail',1],['huile',6],['tomates_cerise',100],['concombre',80]],add:'Servir avec tomates et concombre en dés.'},
 D09:{ings:[['poulet',150],['riz',75],['lait_coco',80],['pate_curry',15],['epinards',120],['oignon',50]]},
 D10:{ings:[['poulet_hache',150],['boulghour',75],['courgette',150],['tomates_conc',120],['huile',5],['ail',1]]},
 D11:{ings:[['poulet',150],['riz',75],['haricots_verts',150],['miel',10],['soja',15],['ail',2]]},
 D12:{ings:[['boeuf',130],['haricots_rouges',100],['riz',60],['tomates_conc',150],['poivron',80],['oignon',50],['epices',5]]},
 D13:{ings:[['saumon',130],['riz',70],['brocoli',150],['soja',15],['miel',8],['sesame',5]]},
 D14:{ings:[['poisson_blanc',170],['chapelure',20],['oeuf',1],['pdt',200],['petits_pois',120],['huile',6]]},
 D15:{ings:[['lentilles_corail',80],['riz',50],['lait_coco',80],['tomates_conc',120],['epinards',100],['epices',5]],add:'Ajouter les épinards 3 min avant la fin.'},
 L01:{ings:[['poulet',130],['riz',65],['avocat',50],['tomates_cerise',100],['mais',50],['huile',5]]},
 L02:{ings:[['poulet',130],['tortilla',80],['yaourt_grec',40],['parmesan',10],['salade',50],['tomates_cerise',80],['ail',1]]},
 L03:{ings:[['farine',90],['fromage_blanc',110],['oeuf',1],['levure',5],['poulet',110],['emmental',25],['oignon',30]]},
 L04:{ings:[['farine',90],['fromage_blanc',110],['oeuf',1],['levure',5],['thon',110],['carre_frais',25],['herbes',3]]},
 L05:{ings:[['farine',90],['fromage_blanc',110],['oeuf',1],['levure',5],['boeuf',110],['oignon',40],['soja',8]]},
 L06:{ings:[['farine',90],['fromage_blanc',110],['oeuf',1],['levure',5],['poulet',110],['lait_coco',40],['pate_curry',10]]},
 L07:{ings:[['poulet_tranches',100],['tortilla',80],['avocat',40],['salade',40],['tomates_cerise',80]],batch:false},
 L08:{ings:[['thon',100],['tortilla',80],['carre_frais',25],['salade',40],['tomates_cerise',80],['mais',40]],batch:false},
 L09:{ings:[['poulet',130],['pita',80],['yaourt_grec',60],['concombre',80],['tomates_cerise',60],['ail',1],['huile',5]]},
 L10:{ings:[['patate_douce',220],['oeuf',2],['avocat',50],['fromage_blanc',60],['huile',6]]},
 L11:{ings:[['saumon',120],['riz',65],['avocat',40],['concombre',80],['soja',12],['sesame',4]],batch:false},
 L12:{ings:[['thon',100],['haricots_blancs',120],['oeuf',2],['tomates_cerise',100],['huile',8]]},
 L13:{ings:[['poulet',130],['riz',70],['oeuf',1],['carotte',80],['epinards',80],['soja',12],['huile_sesame',5]]},
 L14:{ings:[['pois_chiches',150],['tortilla',80],['yaourt_grec',50],['salade',40],['tomates_cerise',60],['huile',4]]},
 L15:{ings:[['pois_chiches',140],['quinoa',60],['avocat',40],['carotte',80],['feta',25],['huile',5]]},
 C01:{name:'Repas cantine (estimation)',ings:[['feculents_cuits',200],['boeuf',120],['legumes_mix',150],['pain',40],['fromage_blanc',100],['fruit_saison',150]],
   steps:['Prendre au self : 1 plat protéiné + féculents + légumes.','Ajouter un laitage et un fruit.','Pain : 1 morceau.'],tip:'Estimation moyenne d\'un plateau cantine équilibré. Non compté dans les courses.',tags:['cantine','fixe']},
 SW07:{name:'Bun banane-cacahuète',ings:[['farine',50],['fromage_blanc',60],['oeuf',1],['levure',3],['banane',60],['beurre_cacahuete',10],['miel',5]]},
 SW08:{ings:[['flocons',40],['banane',60],['beurre_cacahuete',10],['chocolat',8],['whey',8]],tip:'La recette donne 1 portion (≈ 3 cookies). Multiplie pour le batch : ils se gardent 4-5 jours.'},
 SW09:{ings:[['dattes',40],['flocons',20],['beurre_cacahuete',12],['cacao',4]],tip:'1 portion ≈ 3 boules. Fais-en une fournée pour la semaine.'},
 SW10:{ings:[['lait',300],['whey',30],['flocons',40],['banane',100],['beurre_cacahuete',10]]},
 SW06:{ings:[['flocons',50],['fromage_blanc',150],['whey',20],['beurre_cacahuete',12],['lait',80]]},
};
const out=[];
const head=`// recipes.js — Recettes : simples, pas chères, pensées pour le batch cooking.
// GÉNÉRÉ depuis une liste compacte : chaque recette liste des clés d'ingrédients (data/ingredients.js)
// et des quantités par portion. Les macros et le coût sont CALCULÉS automatiquement.
//
// Repères de portions (1 personne, poids crus) :
//   assiette ≈ 550-700 kcal · viande 110-200 g · féculent sec 50-110 g · pommes de terre 150-400 g
//   ≥ 150 g de légumes par assiette · 5-10 g d'huile
// Le moteur (js/optimizer.js) ajuste ensuite viande / féculent / huile DANS ces bornes.
//
// Catégories : dinner (plat chaud) · lunch (plat portable) — les deux sont des plats complets,
// interchangeables midi/soir · sweet (collations) · side (accompagnements) · starter (entrées).
// batch: true → se cuisine à l'avance et se garde au frigo.

import { INGREDIENTS, ingMacros, ingCost } from './ingredients.js';

function M(id, name, category, emoji, prepTime, cookTime, ings, steps, tip, tags, batch, extra = {}) {
  const ingredients = ings.map(([key, qty]) => {
    const db = INGREDIENTS[key];
    if (!db) throw new Error('Ingrédient inconnu : ' + key + ' (recette ' + id + ')');
    const m = ingMacros(key, qty);
    return { key, name: db.name, qty, unit: db.unit, kcal: +m.kcal.toFixed(1), protein: +m.protein.toFixed(1), carbs: +m.carbs.toFixed(1), fat: +m.fat.toFixed(1) };
  });
  const macros = ingredients.reduce((a, i) => ({ kcal: a.kcal + i.kcal, protein: a.protein + i.protein, carbs: a.carbs + i.carbs, fat: a.fat + i.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  Object.keys(macros).forEach(k => macros[k] = Math.round(macros[k]));
  const cost = +ings.reduce((a, [k, q]) => a + ingCost(k, q), 0).toFixed(2);
  return { id, name, category, emoji, prepTime, cookTime, batch, macros, cost, ingredients, steps, tip, tags, pairs: extra.pairs || [] };
}

export const RECIPES = [
`;
function line(o){return `  M(${[o.id,o.name,o.cat,o.emoji,o.prep,o.cook].map(v=>JSON.stringify(v)).join(', ')},\n    ${JSON.stringify(o.ings)},\n    ${JSON.stringify(o.steps)},\n    ${JSON.stringify(o.tip||'')}, ${JSON.stringify(o.tags||[])}, ${o.batch}${o.pairs?', '+JSON.stringify({pairs:o.pairs}):''}),`;}
const sections=[];
for(const o of old){const f=FIX[o.id]||{};const r={...o,...f};if(f.add)r.steps=[...o.steps,f.add];if(f.batch===undefined)r.batch=o.batch;if(f.name)r.name=f.name;out.push(r);}
const NEW=require(path.join(ICI,'complements.js'));
const W=require(path.join(ICI,'plats_du_monde.js'));
W.mains.push(...require(path.join(ICI,'nouveautes.js')).mains); // nouveaux plats (v174)
const K=require(path.join(ICI,'collations.js'));
const B=require(path.join(ICI,'petits_dejeuners.js'));
const kept=out.filter(o=>(!['dinner','lunch','sweet'].includes(o.cat))||o.id==='C01');
let body='  // ══ 30 plats du monde (plaques · autocuiseur · air fryer) ══\n'+W.mains.map(line).join('\n')
 +'\n\n  // ══ Accompagnements air fryer ══\n'+W.sides.map(line).join('\n')
 +'\n\n  // ══ Cantine, collations, compléments, entrées ══\n'+kept.map(line).join('\n')
 +'\n\n  // ══ Petits-déjeuners (formule classique) ══\n'+B.breakfasts.map(line).join('\n')
 +'\n\n  // ══ Collations (whey) ══\n'+K.snacks.map(line).join('\n')+'\n'+NEW.sides.map(line).join('\n')+'\n\n  // ══ Imprévu ══\n'+NEW.special.map(line).join('\n')+'\n';
const tail=`];

// Noms courts, pour les listes (semaine, sessions de cuisine)
const SHORT_NAMES = {
  W01: 'Curry vert', W02: 'Bún gà', W03: 'Gyudon', W04: 'Souvlaki', W05: 'Köfte',
  W06: 'Mujaddara', W07: 'Tajine de poulet', W08: 'Tinga de poulet', W09: 'Döner', W10: 'Smash burger',
  W11: 'Korean chicken', W12: 'Katsu curry', W13: 'Bánh mì', W14: 'Butter chicken', W15: 'Pollo a la brasa',
  W16: 'Lahmacun', W17: 'Quesadillas', W18: 'Pad thaï', W19: 'Larb de poulet', W20: 'Bibimbap',
  W21: 'Mapo tofu', W22: 'Saumon miso', W23: 'Youvetsi', W24: 'Gigantes', W25: 'Tajine de kefta',
  W26: 'Chana masala', W27: 'Lomo saltado', W28: 'Moqueca', W29: 'Misir wot', W30: 'Crevettes piri-piri',
  C01: 'Cantine', X01: 'Repas dehors', L01: 'Repas libre',
  W01: 'Curry de poulet', W02: 'Bol vietnamien', W03: 'Gyudon', W06: 'Mujaddara', W07: 'Tajine de poulet', W08: 'Tinga', W11: 'Poulet coréen', W13: 'Bánh mì', W17: 'Quesadillas', W18: 'Nouilles aux crevettes', W20: 'Bibimbap', W21: 'Mapo tofu', W22: 'Saumon laqué', W29: 'Misir wot',
  W44: 'Curry de colin', W45: 'Pâtes au thon',
  W46: 'Mac and cheese', W47: 'Pâtes feta-crevettes', W48: 'Pâtes lasagne', W49: 'Bouchées de saumon', W50: 'Poulet miel-moutarde',
  W51: 'Patates farcies', W52: 'Bowl elote', W53: 'Salade dense', W54: 'Aubergines laquées', W55: 'Wrap plié thon',
  W56: 'Pâtes épicées au poulet', W57: 'Pâtes cajun', W58: 'Pâtes fajitas', W59: 'Pâtes pesto-poulet', W60: 'Paprikás de poulet',
  W61: 'Stroganoff', W62: 'Penne aux boulettes', W63: 'Poulet aux champignons', W64: 'Poulet ail et herbes', W65: 'Bowl buffalo',
  W66: 'Poêlée de bœuf', W67: 'Picadillo', W68: 'Keema aloo', W69: 'Bowl marocain', W70: 'Poulet shawarma',
  W71: 'Bœuf-quinoa épicé', W72: 'Curry et naans', W73: 'Burritos de bœuf', W74: 'Philly cheesesteak', W75: 'Mafé', K13: 'Wrap thon', K14: 'Croque-monsieur', K15: 'Roses des sables', K16: 'Tiramisu', K17: 'Barres aux dattes', K18: 'Barres Snickers', K19: 'Bouchées coco', K20: 'Barres granola', K21: 'Cookies banane', B16: 'Porridge banane',
  W35: 'Tasty crousty', W36: 'Fajitas', W37: 'Riz sauté', W38: 'Bœuf aux poivrons', W39: 'Bolognaise', W40: 'Kefta et taboulé', W41: 'Gnocchis au poulet', W42: 'Nuggets maison', W43: 'Bowl kebab',
  W31: 'Raviolis croustillants', W32: 'Bol hot honey', W33: 'Pâtes crémeuses', W34: 'Boulettes laquées', K10: 'Fromage blanc cacahuète', B05: 'Fromage blanc et granola',
  B01: 'Overnight oats cacao', B02: 'Overnight oats pomme', B05: 'Fromage blanc granola', S11: 'Tartine poulet', S12: 'Tartine miel', B06: 'Muffins aux œufs', B07: 'Wrap poulet',
  B10: 'Tartines houmous', B11: 'Overnight oats cacao', B12: 'Tartines cacahuète', B13: 'Fromage blanc et flocons', B14: 'Tartines poulet', B15: 'Œufs brouillés',
};
RECIPES.forEach(r => { r.short = SHORT_NAMES[r.id] || r.name.split(/ : | – |, | & /)[0]; });

// Astuces : seulement celles qui servent en cuisine (conservation, réchauffage, organisation)
const TIPS = {
  W01: "Encore meilleur le lendemain : l'aubergine s'imprègne de la sauce.",
  W02: "Bowl froid : aucun réchauffage, parfait au bureau.",
  W03: "Le bœuf finit de cuire au réchauffage : ne le cuis pas trop au départ.",
  W04: "Garde tzatziki et crudités à part : tout reste croquant 3 jours.",
  W05: "Les köfte crues se congèlent à plat : sors-les la veille.",
  W07: "Garde la semoule à part dans la boîte.",
  W10: "En batch, prépare les oignons, la sauce et les frites à l'avance, puis réchauffe les frites 4 minutes à l'air fryer. Le steak se cuit en 4 minutes au moment du repas.",
  W11: "Réchauffe le poulet 4 minutes à l'air fryer plutôt qu'au micro-ondes pour qu'il reste croustillant.",
  W16: "La garniture se garde 4 jours, la cuisson ne prend que 6 minutes.",
  W17: "La garniture se garde 4 jours, l'assemblage prend 2 minutes.",
  W20: "Range les légumes par compartiments dans la boîte : ils restent beaux jusqu'au troisième jour.",
  W22: "À manger dans les 2 jours : il est placé en début de semaine.",
  W25: "Cuis les œufs au dernier moment pour garder le jaune coulant.",
  W27: "Garde les frites à part dans la boîte et réchauffe-les à l'air fryer.",
  W28: "À manger dans les 2 jours.",
  W30: "Crevettes cuites : 2 jours au frigo maximum.",
  SA01: "Sèche-les avec un torchon avant cuisson : elles seront plus croustillantes.",
  SA10: "Ils se congèlent crus.",
  SA12: "Sans cuisson, se garde 2 jours.",
  C01: "Estimation moyenne d'un plateau cantine équilibré. Non compté dans les courses.",
  EN01: "Se congèle très bien.",
  K01: "Avec de la mangue surgelée, pas besoin de glaçons.",
  K05: "Prépare 3 bocaux d'un coup : 4 jours au frigo.",
  K06: "Ils se congèlent : 1 minute à l'air fryer pour les réchauffer.",
  K08: "7 jours au frigo.",
  K11: "4 jours au frigo.",
  X01: "Estimation moyenne : les collations des jours suivants compensent si besoin.",
};
RECIPES.forEach(r => { r.tip = TIPS[r.id] || ''; });

// Étapes rédigées en français courant (matériel : poêle, air fryer, autocuiseur)
const STEPS = {
  "K14": [
    "Tartine une tranche de pain d'une pointe de moutarde, si tu aimes.",
    "Pose le jambon et la moitié de l'emmental, referme avec la deuxième tranche, puis parsème le reste de l'emmental sur le dessus.",
    "Fais cuire 6 à 7 minutes à l'air fryer à 180 °C, jusqu'à ce que le fromage soit fondu et doré. Sans air fryer : 3 minutes de chaque côté à la poêle, à feu moyen et à couvert."
  ],
  "K13": [
    "Égoutte le thon et émiette-le à la fourchette avec le jus de citron et un tour de poivre.",
    "Tartine le wrap de carré frais, ajoute le thon, le concombre en bâtonnets et la salade.",
    "Roule bien serré et coupe en deux. Si tu n'as utilisé qu'une partie d'une grande boîte, garde le reste dans une boîte fermée au frigo et finis-le dans les 2 jours."
  ],
  "W45": [
    "Hache l'oignon, écrase l'ail et coupe les olives en rondelles.",
    "Dans la poêle, fais revenir l'oignon 3 minutes dans l'huile d'olive, puis l'ail 1 minute. Ajoute les tomates et l'origan, et laisse mijoter 8 minutes.",
    "Ajoute le thon émietté et les olives, et laisse chauffer 2 minutes sans trop remuer, pour garder des morceaux.",
    "Fais cuire les pâtes à l'autocuiseur : couvre-les d'eau juste à hauteur avec une pincée de sel, et fais-les cuire sous pression la moitié du temps indiqué sur le paquet, arrondi en dessous. Fais tomber la pression, égoutte et mélange-les à la sauce.",
    "Mise en boîtes : les pâtes au thon, le parmesan dans un petit pot.",
    "Au moment de manger : réchauffe 3 minutes au micro-ondes avec 2 cuillères à soupe d'eau, en remuant à mi-temps, jusqu'à ce que ce soit bien chaud partout. Ajoute le parmesan."
  ],
  "W44": [
    "La veille, mets le colin à décongeler au frigo. Coupe-le en gros morceaux.",
    "Hache l'oignon, écrase l'ail et râpe le gingembre.",
    "Dans la poêle, fais revenir l'oignon 3 minutes dans l'huile, puis ajoute l'ail, le gingembre, le curry en poudre et une pincée de curcuma, 1 minute, en remuant.",
    "Ajoute les tomates et le lait de coco, et laisse mijoter 5 minutes. Ajoute les épinards et laisse-les fondre 2 minutes.",
    "Pose les morceaux de poisson dans la sauce, couvre et laisse cuire 6 à 8 minutes à feu doux, sans remuer, jusqu'à ce que la chair soit opaque et se détache en lamelles. Arrose de jus de citron vert.",
    "Riz : rince-le à l'eau froide, puis mets-le dans l'autocuiseur avec 1,7 fois son poids d'eau (par exemple 150 ml d'eau pour 90 g de riz). Ferme, laisse cuire 20 minutes sous pression, puis laisse la pression retomber seule pendant 10 minutes avant d'ouvrir. Mets-le en boîtes dès qu'il a tiédi : le riz cuit ne doit pas rester plus d'une heure à température ambiante.",
    "Mise en boîtes : le riz et le curry côte à côte. Le poisson se garde 2 jours au frigo : c'est pour ça qu'il est placé en début de semaine.",
    "Au moment de manger : réchauffe 2 minutes au micro-ondes à puissance moyenne, ou 5 minutes à la poêle à feu doux et à couvert, pour que le poisson ne se dessèche pas."
  ],
  "W43": [
    "Mélange le poulet entier avec 30 g de yaourt, le paprika, le cumin, l'ail en poudre, une pincée de cannelle, une pincée de piment, l'huile et une pincée de sel. Laisse mariner 15 minutes au frigo, ou toute la nuit.",
    "Fais-le cuire 18 à 20 minutes à l'air fryer à 200 °C, en le retournant à mi-cuisson, jusqu'à ce que le jus qui s'écoule soit clair. Émince-le finement, puis remets-le 2 minutes pour griller les bords, comme à la broche.",
    "Riz : rince-le à l'eau froide, puis mets-le dans l'autocuiseur avec 1,7 fois son poids d'eau (par exemple 150 ml d'eau pour 90 g de riz). Ferme, laisse cuire 20 minutes sous pression, puis laisse la pression retomber seule pendant 10 minutes avant d'ouvrir. Mets-le en boîtes dès qu'il a tiédi : le riz cuit ne doit pas rester plus d'une heure à température ambiante.",
    "Prépare la sauce blanche : le reste du yaourt, une demi-gousse d'ail écrasée, les herbes, du sel et du poivre. Lave la salade et coupe-la en lanières, coupe la tomate en dés et l'oignon en fines lamelles.",
    "Mise en boîtes : le riz et le poulet ensemble, les crudités à part, la sauce et les oignons frits dans deux petits pots. Pour les boîtes congelées, prépare les crudités et la sauce le jour même.",
    "Au moment de manger : réchauffe 3 minutes au micro-ondes en remuant à mi-temps, ou 5 minutes à la poêle à feu moyen avec 2 cuillères à soupe d'eau, jusqu'à ce que ce soit bien chaud partout. Ajoute les crudités, la sauce blanche et les oignons frits."
  ],
  "W42": [
    "Coupe les pommes de terre en quartiers de 2 cm avec la peau, sèche-les dans un torchon et mélange-les avec 5 ml d'huile, du paprika fumé et une pincée de sel. Fais-les cuire 20 minutes à l'air fryer à 200 °C, en secouant le panier toutes les 7 minutes.",
    "Coupe le poulet en morceaux de 3 cm et mélange-les avec le yaourt, le paprika, l'ail en poudre et une pincée de sel.",
    "Écrase les corn-flakes dans un sac congélation, puis roule chaque nugget dedans en appuyant bien.",
    "Pose-les sans qu'ils se touchent, arrose avec le reste de l'huile et fais-les cuire 12 à 14 minutes à l'air fryer à 200 °C, en les retournant à mi-cuisson, jusqu'à ce qu'ils soient dorés et plus roses au centre.",
    "Prépare la sauce barbecue : ketchup, miel, vinaigre de cidre, sauce soja et une pincée de paprika fumé, dans un petit pot. Râpe la carotte et coupe le concombre en bâtonnets.",
    "Mise en boîtes : les nuggets et les potatoes ensemble, les crudités à part, la sauce dans un petit pot.",
    "Au moment de manger : réchauffe les nuggets et les potatoes 5 minutes à l'air fryer à 200 °C pour qu'ils recroustillent. Les crudités et la sauce se mangent froides."
  ],
  "W41": [
    "Coupe le poulet en dés de 2 cm et les tomates cerises en deux. Écrase l'ail.",
    "Fais dorer les gnocchis 6 à 8 minutes dans la poêle avec la moitié de l'huile, à feu moyen, en les retournant, sans les faire bouillir avant : ils deviennent croustillants dehors et fondants dedans. Réserve-les.",
    "Dans la même poêle, fais cuire le poulet 6 à 7 minutes avec le reste de l'huile, jusqu'à ce qu'il ne soit plus rose au centre.",
    "Ajoute l'ail, les tomates cerises, les épinards et les herbes de Provence, et laisse cuire 4 minutes, jusqu'à ce que les tomates commencent à fondre. Remets les gnocchis et mélange.",
    "Mise en boîtes : les gnocchis au poulet, le parmesan dans un petit pot.",
    "Au moment de manger : réchauffe 5 minutes à la poêle à feu moyen pour que les gnocchis redeviennent croustillants (ou 3 minutes au micro-ondes, ils seront plus moelleux). Ajoute le parmesan."
  ],
  "W40": [
    "Râpe l'oignon et hache le persil. Mélange la moitié du persil et l'oignon avec le bœuf, le cumin, le paprika, une pincée de cannelle et une pincée de sel, puis forme des kefta allongées de la taille d'un doigt.",
    "Fais-les cuire 10 à 12 minutes à l'air fryer à 200 °C, en les retournant à mi-cuisson, jusqu'à ce qu'elles ne soient plus roses au centre.",
    "Fais cuire le boulgour à l'autocuiseur avec 1,5 fois son volume d'eau et une pincée de sel : 4 minutes sous pression, puis 5 minutes de décompression naturelle. Laisse-le refroidir.",
    "Prépare le taboulé : le boulgour refroidi, la tomate et le concombre en petits dés, le reste du persil, le jus de citron, l'huile d'olive, du sel et du poivre.",
    "Mise en boîtes : les kefta, le taboulé à côté, le houmous dans un petit pot.",
    "Au moment de manger : réchauffe seulement les kefta, 2 minutes au micro-ondes ou 3 minutes à l'air fryer. Le taboulé et le houmous se mangent froids."
  ],
  "W39": [
    "Râpe la carotte, coupe la courgette en petits dés et hache l'oignon. Écrase l'ail.",
    "Mets l'autocuiseur en mode dorer et fais revenir le bœuf 5 minutes dans l'huile en l'émiettant, jusqu'à ce qu'il ne soit plus rose. Ajoute l'oignon, l'ail, la carotte et la courgette, 3 minutes.",
    "Ajoute les tomates, le concentré, les herbes de Provence et 50 ml d'eau par portion. Ferme et laisse cuire 10 minutes sous pression, puis fais tomber la pression.",
    "Verse la sauce dans un plat et rince la cuve. Fais cuire les pâtes à l'autocuiseur : couvre-les d'eau juste à hauteur avec une pincée de sel, et fais-les cuire sous pression la moitié du temps indiqué sur le paquet, arrondi en dessous. Fais tomber la pression et égoutte.",
    "Mise en boîtes : les pâtes et la sauce côte à côte, le parmesan dans un petit pot.",
    "Au moment de manger : réchauffe 3 minutes au micro-ondes avec 2 cuillères à soupe d'eau, en remuant à mi-temps, jusqu'à ce que ce soit bien chaud partout. Ajoute le parmesan."
  ],
  "W38": [
    "Coupe le bœuf en fines lanières (20 minutes au congélateur avant aident à le trancher), les poivrons en lanières et l'oignon en quartiers. Écrase l'ail et râpe le gingembre.",
    "Mélange le bœuf avec la moitié de la sauce soja et la fécule, et laisse reposer 10 minutes au frigo : c'est ce qui le garde tendre.",
    "Dans la poêle très chaude avec l'huile, saisis le bœuf 2 minutes, puis retire-le.",
    "Fais sauter les poivrons, l'oignon, l'ail et le gingembre 4 minutes à feu vif : ils doivent rester croquants.",
    "Remets le bœuf, ajoute le reste de la sauce soja, le miel et 3 cuillères à soupe d'eau, et mélange 1 minute, jusqu'à ce que la sauce nappe.",
    "Riz : rince-le à l'eau froide, puis mets-le dans l'autocuiseur avec 1,7 fois son poids d'eau (par exemple 150 ml d'eau pour 90 g de riz). Ferme, laisse cuire 20 minutes sous pression, puis laisse la pression retomber seule pendant 10 minutes avant d'ouvrir. Mets-le en boîtes dès qu'il a tiédi : le riz cuit ne doit pas rester plus d'une heure à température ambiante.",
    "Mise en boîtes : riz et bœuf aux poivrons côte à côte.",
    "Au moment de manger : réchauffe 3 minutes au micro-ondes en remuant à mi-temps, ou 5 minutes à la poêle à feu moyen avec 2 cuillères à soupe d'eau, jusqu'à ce que ce soit bien chaud partout."
  ],
  "W37": [
    "Riz : rince-le à l'eau froide, puis mets-le dans l'autocuiseur avec 1,7 fois son poids d'eau (par exemple 150 ml d'eau pour 90 g de riz). Ferme, laisse cuire 20 minutes sous pression, puis laisse la pression retomber seule pendant 10 minutes avant d'ouvrir. Étale-le sur un plat pour qu'il refroidisse vite : le riz cuit ne doit pas rester plus d'une heure à température ambiante.",
    "Coupe le poulet et la carotte en petits dés, et hache l'oignon. Écrase l'ail.",
    "Fais cuire le poulet 5 à 6 minutes dans la poêle huilée, jusqu'à ce qu'il ne soit plus rose, puis ajoute l'oignon, la carotte, l'ail et les petits pois, 4 minutes.",
    "Pousse le tout sur le côté, casse l'œuf dans la poêle et brouille-le 1 minute.",
    "Ajoute le riz refroidi et la sauce soja, et fais sauter 3 minutes à feu vif en remuant.",
    "Mise en boîtes : dès qu'il a tiédi, au frigo ou au congélateur.",
    "Au moment de manger : réchauffe 3 minutes au micro-ondes en remuant à mi-temps, ou 5 minutes à la poêle à feu moyen avec 2 cuillères à soupe d'eau, jusqu'à ce que ce soit bien chaud partout. Parsème de graines de sésame."
  ],
  "W36": [
    "Coupe le poulet en fines lanières, les poivrons et l'oignon en lamelles.",
    "Fais revenir le poulet 5 minutes à feu vif dans la poêle huilée avec le cumin, le paprika, l'ail en poudre et une pincée de piment, jusqu'à ce qu'il ne soit plus rose. Ajoute les poivrons et l'oignon et fais sauter encore 4 minutes : ils doivent rester un peu croquants. Arrose de jus de citron vert.",
    "Prépare la salsa : la tomate en petits dés. Lave la salade.",
    "Mise en boîtes : la garniture d'un côté, la salsa, la salade et le yaourt à part. Les wraps restent dans leur sachet.",
    "Au moment de manger : réchauffe la garniture 2 minutes au micro-ondes, et les wraps 30 secondes de chaque côté à la poêle. Garnis avec la garniture, le fromage, la salsa, la salade et le yaourt, puis roule."
  ],
  "W35": [
    "Coupe le poulet en morceaux de 3 cm, façon nuggets, et mélange-les avec 30 g de yaourt grec, le paprika, l'ail en poudre et une pincée de piment.",
    "Écrase les corn-flakes dans un sac congélation avec un rouleau ou le fond d'une casserole, puis roule chaque morceau dedans en appuyant bien.",
    "Pose-les sans qu'ils se touchent dans le panier, arrose d'un filet d'huile et fais-les cuire 12 à 14 minutes à l'air fryer à 200 °C, en les retournant à mi-cuisson, jusqu'à ce qu'ils soient dorés et plus roses au centre.",
    "Riz : rince-le à l'eau froide, puis mets-le dans l'autocuiseur avec 1,7 fois son poids d'eau (par exemple 150 ml d'eau pour 90 g de riz). Ferme, laisse cuire 20 minutes sous pression, puis laisse la pression retomber seule pendant 10 minutes avant d'ouvrir. Mets-le en boîtes dès qu'il a tiédi : le riz cuit ne doit pas rester plus d'une heure à température ambiante.",
    "Prépare la sauce crémeuse : le reste du yaourt grec, la mayonnaise allégée, quelques gouttes de sauce soja et une pincée d'ail en poudre.",
    "Mise en boîtes : le riz d'un côté, le poulet dans un compartiment séparé, la sauce crémeuse dans un petit pot. Les sauces chili douce et sriracha restent dans leurs bouteilles, au frigo, comme les oignons frits dans leur paquet.",
    "Au moment de manger : réchauffe le riz 2 minutes au micro-ondes et le poulet 4 minutes à l'air fryer à 200 °C pour qu'il recroustille. Étale la sauce crémeuse sur le riz, pose le poulet par-dessus, puis ajoute un filet de sauce chili douce et un filet de sriracha sur le poulet, et termine par les oignons frits."
  ],
  "W34": [
    "Mélange le bœuf avec 1 gousse d'ail écrasée, le gingembre râpé, la moitié de la sauce soja et la fécule. Forme des boulettes de la taille d'une noix, d'environ 30 g.",
    "Fais-les cuire 10 à 12 minutes à l'air fryer à 200 °C, en secouant le panier à mi-cuisson. Coupe-en une pour vérifier : elle ne doit plus être rose au centre.",
    "Dans la poêle, chauffe 1 minute le miel, l'autre gousse d'ail écrasée, le reste de la sauce soja et le vinaigre de cidre, puis enrobe les boulettes 1 minute.",
    "Riz : rince-le à l'eau froide, puis mets-le dans l'autocuiseur avec 1,7 fois son poids d'eau (par exemple 150 ml d'eau pour 90 g de riz). Ferme, laisse cuire 20 minutes sous pression, puis laisse la pression retomber seule pendant 10 minutes avant d'ouvrir. Mets-le en boîtes dès qu'il a tiédi : le riz cuit ne doit pas rester plus d'une heure à température ambiante.",
    "Prépare le concombre : écrase-le avec le plat d'un couteau, coupe-le en morceaux et parsème-le de graines de sésame.",
    "Mise en boîtes : riz et boulettes ensemble, concombre dans un compartiment séparé.",
    "Au moment de manger : réchauffe 3 minutes au micro-ondes en remuant à mi-temps, ou 5 minutes à la poêle à feu moyen avec 2 cuillères à soupe d'eau, jusqu'à ce que ce soit bien chaud partout. Le concombre se mange froid."
  ],
  "W33": [
    "Fais cuire les pâtes à l'autocuiseur : couvre-les d'eau juste à hauteur avec une pincée de sel, et fais-les cuire sous pression la moitié du temps indiqué sur le paquet, arrondi en dessous (5 minutes pour des pâtes complètes à 10 ou 11 minutes). Fais tomber la pression et égoutte s'il reste de l'eau, en en gardant 3 cuillères à soupe par portion.",
    "Coupe le poulet en dés de 2 cm et fais-le cuire 6 à 7 minutes à la poêle avec l'huile, jusqu'à ce qu'il ne soit plus rose au centre.",
    "Ajoute l'ail écrasé, les tomates séchées coupées en morceaux, les épinards et les herbes de Provence, et laisse cuire 3 minutes.",
    "Hors du feu, mélange le fromage blanc, le parmesan, l'eau de cuisson gardée et du poivre, puis ajoute les pâtes et le poulet et mélange. Le fromage blanc ne doit pas bouillir, sinon il graine.",
    "Mise en boîtes : les pâtes crémeuses, au frigo dès qu'elles ont tiédi.",
    "Au moment de manger : réchauffe 3 minutes au micro-ondes à puissance moyenne avec 2 cuillères à soupe d'eau, en remuant à mi-temps, jusqu'à ce que ce soit bien chaud partout."
  ],
  "W32": [
    "Coupe la patate douce en cubes de 2 cm, sans l'éplucher si tu veux. Mélange-la avec l'huile et le paprika fumé.",
    "Fais-la cuire 18 à 20 minutes à l'air fryer à 200 °C, en secouant le panier à mi-cuisson.",
    "Fais cuire le bœuf 6 à 7 minutes à la poêle avec le cumin, l'ail en poudre et une pincée de sel, en l'émiettant, jusqu'à ce qu'il ne soit plus rose.",
    "Prépare le miel pimenté : mélange le miel avec une pincée de piment en poudre, dans un petit pot.",
    "Mise en boîtes : le bœuf et la patate douce ensemble. Le fromage blanc et le miel pimenté restent à part.",
    "Au moment de manger : réchauffe 3 minutes au micro-ondes en remuant à mi-temps, ou 5 minutes à la poêle à feu moyen avec 2 cuillères à soupe d'eau, jusqu'à ce que ce soit bien chaud partout. Ajoute le fromage blanc froid, le jus de citron vert, le miel pimenté, et de la coriandre si tu en as."
  ],
  "W31": [
    "Râpe la courgette, puis presse-la fort dans un torchon pour en retirer l'eau. Râpe la carotte et le gingembre, écrase l'ail.",
    "Mélange le poulet haché cru avec les légumes, le gingembre, l'ail et la moitié de la sauce soja.",
    "Trempe une feuille de riz 5 secondes dans un plat d'eau froide et pose-la à plat. Dépose 2 cuillères à soupe de farce, rabats les côtés et roule comme un petit burrito. Enveloppe-le dans une deuxième feuille trempée, pour qu'il soit bien solide. Compte 4 raviolis par portion.",
    "Badigeonne-les d'huile et fais-les cuire 14 à 16 minutes à l'air fryer à 200 °C, sans qu'ils se touchent, en les retournant à mi-cuisson. Coupe-en un pour vérifier : la farce ne doit plus être rose.",
    "Riz : rince-le à l'eau froide, puis mets-le dans l'autocuiseur avec 1,7 fois son poids d'eau (par exemple 150 ml d'eau pour 90 g de riz). Ferme, laisse cuire 20 minutes sous pression, puis laisse la pression retomber seule pendant 10 minutes avant d'ouvrir. Mets-le en boîtes dès qu'il a tiédi : le riz cuit ne doit pas rester plus d'une heure à température ambiante.",
    "Prépare la sauce : le reste de la sauce soja, le jus de citron vert et une cuillère à soupe d'eau.",
    "Mise en boîtes : les raviolis posés sur une feuille de papier absorbant, à côté du riz. La sauce va dans un petit pot à part.",
    "Au moment de manger : réchauffe les raviolis 5 minutes à l'air fryer à 180 °C pour qu'ils recroustillent, et le riz 2 minutes au micro-ondes. Trempe-les dans la sauce."
  ],
  "W01": [
    "Coupe le poulet en dés de 2 cm, l'aubergine en cubes de 2 cm, le poivron en lanières et l'oignon en lamelles. Écrase l'ail et râpe le gingembre.",
    "Mets l'autocuiseur en mode dorer et fais revenir l'oignon 3 minutes dans l'huile. Ajoute l'ail, le gingembre et le curry en poudre, et remue 1 minute pour que les épices dégagent leur parfum.",
    "Ajoute le poulet, l'aubergine, le poivron, le lait de coco et la sauce soja, puis mélange.",
    "Ferme et laisse cuire 5 minutes sous pression, puis fais tomber la pression : le poulet reste moelleux et l'aubergine devient fondante.",
    "Riz : rince-le à l'eau froide, puis mets-le dans l'autocuiseur avec 1,7 fois son poids d'eau (par exemple 150 ml d'eau pour 90 g de riz). Ferme, laisse cuire 20 minutes sous pression, puis laisse la pression retomber seule pendant 10 minutes avant d'ouvrir. Mets-le en boîtes dès qu'il a tiédi : le riz cuit ne doit pas rester plus d'une heure à température ambiante.",
    "Mise en boîtes : le riz et le curry côte à côte. La coriandre, si tu en as, reste à part.",
    "Au moment de manger : réchauffe 3 minutes au micro-ondes en remuant à mi-temps, ou 5 minutes à la poêle à feu moyen avec 2 cuillères à soupe d'eau, jusqu'à ce que ce soit bien chaud partout. Ajoute la coriandre si tu en as."
  ],
  "W02": [
    "Écrase l'ail. Mélange-le avec la moitié de la sauce soja, la moitié du jus de citron vert, le miel et l'huile. Coupe le poulet en lanières et laisse-le mariner 15 minutes au frigo.",
    "Fais cuire le poulet 14 à 16 minutes à l'air fryer à 200 °C, en le retournant à mi-cuisson, jusqu'à ce que le jus qui s'écoule soit clair.",
    "Riz : rince-le à l'eau froide, puis mets-le dans l'autocuiseur avec 1,7 fois son poids d'eau (par exemple 150 ml d'eau pour 90 g de riz). Ferme, laisse cuire 20 minutes sous pression, puis laisse la pression retomber seule pendant 10 minutes avant d'ouvrir. Mets-le en boîtes dès qu'il a tiédi : le riz cuit ne doit pas rester plus d'une heure à température ambiante.",
    "Coupe la carotte en fins bâtonnets et le concombre en demi-rondelles, puis lave la salade et coupe-la en lanières. Concasse les cacahuètes avec le plat d'un couteau.",
    "Prépare la sauce : le reste de la sauce soja et du jus de citron vert, avec 2 cuillères à soupe d'eau.",
    "Mise en boîtes : le riz au fond, les crudités et le poulet par-dessus. La sauce et les cacahuètes vont dans deux petits pots à part, pour garder le croquant.",
    "Au moment de manger : réchauffe seulement le poulet, 1 minute au micro-ondes, ou mange tout froid comme une salade. Verse la sauce, ajoute les cacahuètes, et des herbes fraîches (menthe ou coriandre) si tu en as."
  ],
  "W03": [
    "Émince le bœuf en tranches très fines (il se tranche mieux s'il a passé 20 minutes au congélateur) et l'oignon en fines lamelles. Râpe le gingembre.",
    "Dans la poêle, fais cuire l'oignon 6 minutes à feu moyen avec 100 ml d'eau par portion, la sauce soja, le miel, le vinaigre de cidre et le gingembre.",
    "Ajoute le bœuf et laisse cuire 2 à 3 minutes seulement, en remuant : il finira de cuire au réchauffage.",
    "Fais revenir les épinards 4 minutes dans la poêle avec l'huile.",
    "Riz : rince-le à l'eau froide, puis mets-le dans l'autocuiseur avec 1,7 fois son poids d'eau (par exemple 150 ml d'eau pour 90 g de riz). Ferme, laisse cuire 20 minutes sous pression, puis laisse la pression retomber seule pendant 10 minutes avant d'ouvrir. Mets-le en boîtes dès qu'il a tiédi : le riz cuit ne doit pas rester plus d'une heure à température ambiante.",
    "Mise en boîtes : riz, bœuf et oignons avec leur jus, épinards à côté. Les œufs restent crus au frigo.",
    "Au moment de manger : réchauffe 3 minutes au micro-ondes en remuant à mi-temps, ou 5 minutes à la poêle à feu moyen avec 2 cuillères à soupe d'eau, jusqu'à ce que ce soit bien chaud partout. Fais cuire l'œuf au plat 3 minutes à la poêle et pose-le sur le bol."
  ],
  "W04": [
    "Coupe le poulet en cubes de 3 cm. Mélange-le avec le jus de citron, l'origan, l'ail écrasé et l'huile, et laisse mariner 15 minutes, ou toute la nuit au frigo.",
    "Fais cuire le poulet 12 minutes à l'air fryer à 200 °C, en secouant le panier à mi-cuisson.",
    "Prépare le tzatziki : râpe le concombre, presse-le dans tes mains pour retirer l'eau, puis mélange-le avec le yaourt et une pointe d'ail.",
    "Coupe la tomate en dés et l'oignon en fines lamelles.",
    "Mise en boîtes : poulet d'un côté, tomate et oignon de l'autre, tzatziki dans un petit pot. Garde les pitas dans leur sachet.",
    "Au moment de manger : réchauffe le poulet 2 minutes au micro-ondes ou 3 minutes à l'air fryer, et la pita 2 minutes à l'air fryer à 180 °C. Garnis la pita."
  ],
  "W05": [
    "Râpe l'oignon et hache le persil. Mélange-les avec le bœuf, le cumin, le paprika et une pincée de sel, puis forme des köfte allongées de la taille d'un doigt.",
    "Fais revenir le boulgour 2 minutes dans l'huile à l'autocuiseur en mode dorer. Ajoute les tomates, le concentré et 1,5 fois le volume du boulgour en eau, ferme et laisse cuire 4 minutes sous pression, puis laisse la pression retomber seule pendant 5 minutes.",
    "Fais cuire les köfte 10 à 12 minutes à l'air fryer à 200 °C, en les retournant à mi-cuisson.",
    "Prépare le cacık : concombre en petits dés et yaourt, avec une pincée de menthe séchée si tu en as.",
    "Mise en boîtes : boulgour et köfte côte à côte, cacık dans un petit pot.",
    "Au moment de manger : réchauffe 3 minutes au micro-ondes en remuant à mi-temps, ou 5 minutes à la poêle à feu moyen avec 2 cuillères à soupe d'eau, jusqu'à ce que ce soit bien chaud partout. Le cacık se mange froid."
  ],
  "W06": [
    "Coupe les oignons en fines lamelles et mélange-les avec la moitié de l'huile.",
    "Fais-les dorer 15 à 18 minutes à l'air fryer à 180 °C, en remuant toutes les 5 minutes, jusqu'à ce qu'ils soient bien bruns et croustillants.",
    "Rince le riz et les lentilles séparément. Mets le riz dans l'autocuiseur avec 1,7 fois son poids d'eau, ferme et laisse cuire 14 minutes sous pression, puis fais tomber la pression : le riz complet a besoin d'une avance sur les lentilles. Ajoute les lentilles, 1 g de cumin, le reste de l'huile et 2 fois le poids des lentilles en eau. Referme, laisse cuire 6 minutes sous pression, puis laisse la pression retomber seule pendant 10 minutes : tout finit de cuire ensemble sans que les lentilles se défassent.",
    "Coupe le poulet en dés de 2 cm, assaisonne-le avec le reste du cumin, du paprika et une pincée de sel, puis fais-le cuire 10 minutes à l'air fryer à 200 °C, jusqu'à ce qu'il ne soit plus rose au centre.",
    "Prépare le yaourt à l'ail (yaourt et ail écrasé) et coupe la tomate et le concombre en dés.",
    "Mise en boîtes : lentilles et riz, poulet par-dessus, salade à côté, yaourt dans un petit pot. Garde les oignons croustillants dans une boîte fermée à part, hors du frigo, pour qu'ils restent croquants (3 jours au plus).",
    "Au moment de manger : réchauffe 3 minutes au micro-ondes en remuant à mi-temps, ou 5 minutes à la poêle à feu moyen avec 2 cuillères à soupe d'eau, jusqu'à ce que ce soit bien chaud partout, puis ajoute les oignons croustillants. La salade et le yaourt se mangent froids."
  ],
  "W07": [
    "Coupe le poulet en morceaux de 3 cm, l'oignon en lamelles, les carottes en rondelles et les courgettes en demi-rondelles épaisses. Râpe le zeste du citron, puis presse-le.",
    "Mets l'autocuiseur en mode dorer et fais revenir 5 minutes le poulet, l'oignon, l'huile et les épices (cumin, curcuma, gingembre en poudre et une pincée de cannelle).",
    "Ajoute les carottes, les courgettes, les olives et 100 ml d'eau par portion. Ferme et laisse cuire 7 minutes sous pression, puis fais tomber la pression : au-delà, le blanc de poulet devient sec.",
    "Hors du feu, ajoute le zeste et le jus de citron, et mélange.",
    "Verse le tajine dans un plat. Rince la cuve, puis fais-y chauffer le même volume d'eau que de semoule en mode dorer, couvercle ouvert, jusqu'à ébullition.",
    "Verse l'eau bouillante sur la semoule dans un saladier, couvre 5 minutes, puis égrène à la fourchette.",
    "Mise en boîtes : la semoule à part, dans une boîte ou un compartiment séparé, pour qu'elle ne détrempe pas.",
    "Au moment de manger : réchauffe 3 minutes au micro-ondes en remuant à mi-temps, ou 5 minutes à la poêle à feu moyen avec 2 cuillères à soupe d'eau, jusqu'à ce que ce soit bien chaud partout (le tajine et la semoule ensemble)."
  ],
  "W08": [
    "Coupe l'oignon en lamelles et écrase l'ail.",
    "Coupe le blanc de poulet en 2 ou 3 morceaux épais. Mets-les dans l'autocuiseur avec les tomates, l'oignon, l'ail, le paprika fumé et une pincée de piment. Ferme et laisse cuire 10 minutes sous pression, puis fais tomber la pression : le poulet doit se défaire facilement à la fourchette.",
    "Effiloche le poulet avec deux fourchettes directement dans la sauce, puis fais réduire 3 minutes en mode dorer, couvercle ouvert.",
    "Riz : rince-le à l'eau froide, puis mets-le dans l'autocuiseur avec 1,7 fois son poids d'eau (par exemple 150 ml d'eau pour 90 g de riz). Ferme, laisse cuire 20 minutes sous pression, puis laisse la pression retomber seule pendant 10 minutes avant d'ouvrir. Mets-le en boîtes dès qu'il a tiédi : le riz cuit ne doit pas rester plus d'une heure à température ambiante.",
    "Rince et égoutte les haricots rouges et le maïs. Coupe l'avocat au moment de manger seulement : il noircit une fois coupé.",
    "Mise en boîtes : riz, haricots rouges, maïs et poulet effiloché. Le yaourt et le citron vert restent à part.",
    "Au moment de manger : réchauffe 3 minutes au micro-ondes en remuant à mi-temps, ou 5 minutes à la poêle à feu moyen avec 2 cuillères à soupe d'eau, jusqu'à ce que ce soit bien chaud partout, puis ajoute le yaourt, l'avocat coupé, le citron vert et la coriandre si tu en as."
  ],
  "W09": [
    "Coupe le poulet en lanières. Mélange-le avec la moitié du yaourt, le paprika, le cumin, l'origan, l'ail écrasé et l'huile.",
    "Fais-le cuire 15 minutes à l'air fryer à 200 °C. Émince-le finement, puis remets-le 2 minutes pour griller les bords.",
    "Prépare la sauce blanche : le reste du yaourt, une pointe d'ail et les herbes hachées.",
    "Lave la salade et coupe-la en lanières. Coupe la tomate en dés et l'oignon en fines lamelles.",
    "Mise en boîtes : poulet d'un côté, crudités de l'autre, sauce dans un petit pot. Garde les galettes dans leur sachet.",
    "Au moment de manger : réchauffe le poulet 2 minutes au micro-ondes ou 3 minutes à l'air fryer, et la galette 30 secondes de chaque côté à la poêle. Garnis et roule."
  ],
  "W10": [
    "Coupe les patates douces en bâtonnets de 1 cm, mélange-les avec l'huile et le paprika fumé, puis fais-les cuire 18 minutes à l'air fryer à 200 °C en secouant le panier deux fois.",
    "Fais caraméliser les oignons émincés 10 minutes à la poêle à feu moyen avec 2 cuillères à soupe d'eau.",
    "Prépare la sauce : yaourt, moutarde et cornichons hachés. Coupe la tomate en rondelles.",
    "Divise la viande en boules (une par burger), emballe-les une par une dans du film alimentaire et mets-les au congélateur tout de suite : la viande hachée crue ne se garde pas plus d'un jour au frigo.",
    "Mise en boîtes : frites, oignons, sauce et crudités dans des boîtes séparées, au frigo.",
    "Au moment de manger : la veille au soir, mets une boule de viande à décongeler au frigo. Réchauffe les frites 4 minutes à l'air fryer à 200 °C. Dans la poêle très chaude, écrase la boule avec une spatule et fais-la cuire 2 à 3 minutes par face, jusqu'à ce qu'elle ne soit plus rose au centre ; pose la tranche de cheddar dessus à la fin. Toaste le pain 1 minute dans la poêle et monte le burger."
  ],
  "W11": [
    "Coupe le poulet en morceaux de 3 cm et enrobe-les de fécule.",
    "Fais-les cuire 18 à 20 minutes à l'air fryer à 200 °C, en secouant le panier deux fois, jusqu'à ce que le jus soit clair : ils deviennent croustillants sans friture.",
    "Dans la poêle, chauffe 1 minute le miel, la sauce soja, le ketchup, l'ail écrasé, une pincée de paprika fumé et une pincée de piment. Ajoute le poulet et mélange pour bien l'enrober.",
    "Riz : rince-le à l'eau froide, puis mets-le dans l'autocuiseur avec 1,7 fois son poids d'eau (par exemple 150 ml d'eau pour 90 g de riz). Ferme, laisse cuire 20 minutes sous pression, puis laisse la pression retomber seule pendant 10 minutes avant d'ouvrir. Mets-le en boîtes dès qu'il a tiédi : le riz cuit ne doit pas rester plus d'une heure à température ambiante.",
    "Prépare le concombre : écrase-le avec le plat d'un couteau, coupe-le en morceaux, puis assaisonne-le avec le vinaigre de cidre et les graines de sésame.",
    "Mise en boîtes : riz et poulet ensemble, concombre dans un compartiment séparé.",
    "Au moment de manger : réchauffe le riz 2 minutes au micro-ondes et le poulet 4 minutes à l'air fryer à 200 °C pour qu'il reste croustillant. Le concombre se mange froid."
  ],
  "W12": [
    "Coupe l'oignon, la carotte et la pomme de terre en petits morceaux.",
    "Mets-les dans l'autocuiseur avec le curry en poudre, le miel, la sauce soja et 200 ml d'eau par portion. Ferme et laisse cuire 5 minutes sous pression.",
    "Écrase la sauce à la fourchette ou au presse-purée. Délaye la fécule dans 2 cuillères à soupe d'eau froide, ajoute-la et fais épaissir 2 minutes en mode dorer en remuant.",
    "Aplatis le poulet à 1 cm d'épaisseur. Passe-le dans l'œuf battu puis dans la chapelure, badigeonne-le d'huile et fais-le cuire 12 à 14 minutes à l'air fryer à 200 °C en le retournant à mi-cuisson.",
    "Riz : rince-le à l'eau froide, puis mets-le dans l'autocuiseur avec 1,7 fois son poids d'eau (par exemple 150 ml d'eau pour 90 g de riz). Ferme, laisse cuire 20 minutes sous pression, puis laisse la pression retomber seule pendant 10 minutes avant d'ouvrir. Mets-le en boîtes dès qu'il a tiédi : le riz cuit ne doit pas rester plus d'une heure à température ambiante.",
    "Mise en boîtes : riz et sauce ensemble, poulet pané tranché dans un compartiment séparé pour qu'il ne ramollisse pas.",
    "Au moment de manger : réchauffe le riz et la sauce 2 minutes au micro-ondes, et le poulet 4 minutes à l'air fryer à 200 °C. Pose le poulet sur le riz et nappe de sauce."
  ],
  "W13": [
    "Prépare les pickles : coupe la carotte en fins bâtonnets, couvre-la de vinaigre de cidre avec une pincée de sel et laisse reposer au moins 30 minutes. Ils se gardent une semaine au frigo.",
    "Écrase l'ail et mélange-le avec le jus de citron vert, la sauce soja et le miel. Coupe le poulet en lanières et laisse-le mariner 15 minutes au frigo.",
    "Fais cuire le poulet 12 à 14 minutes à l'air fryer à 200 °C, en le retournant à mi-cuisson, jusqu'à ce qu'il ne soit plus rose au centre.",
    "Prépare la sauce : yaourt et une pincée de piment. Coupe le concombre en fines lamelles.",
    "Mise en boîtes : poulet, pickles égouttés et concombre dans une boîte, sauce dans un petit pot. Garde la baguette dans un sac en tissu, hors du frigo.",
    "Au moment de manger : réchauffe le poulet 2 minutes au micro-ondes et la baguette 2 minutes à l'air fryer à 180 °C. Ouvre la baguette, tartine la sauce, garnis, et ajoute de la coriandre si tu en as."
  ],
  "W14": [
    "Coupe le poulet en morceaux de 3 cm et mélange-le avec le yaourt et la moitié des épices. Laisse mariner 10 minutes, ou toute la nuit au frigo.",
    "Hache l'oignon, l'ail et le gingembre.",
    "Mets l'autocuiseur en mode dorer et fais revenir l'oignon, l'ail, le gingembre et le reste des épices 3 minutes, en remuant.",
    "Ajoute les tomates, le concentré et le poulet avec sa marinade. Ferme et laisse cuire 6 minutes sous pression.",
    "Une fois la pression tombée, ajoute la crème et mélange.",
    "Riz : rince-le à l'eau froide, puis mets-le dans l'autocuiseur avec 1,7 fois son poids d'eau (par exemple 150 ml d'eau pour 90 g de riz). Ferme, laisse cuire 20 minutes sous pression, puis laisse la pression retomber seule pendant 10 minutes avant d'ouvrir. Mets-le en boîtes dès qu'il a tiédi : le riz cuit ne doit pas rester plus d'une heure à température ambiante.",
    "Mise en boîtes : riz et butter chicken côte à côte.",
    "Au moment de manger : réchauffe 3 minutes au micro-ondes en remuant à mi-temps, ou 5 minutes à la poêle à feu moyen avec 2 cuillères à soupe d'eau, jusqu'à ce que ce soit bien chaud partout."
  ],
  "W15": [
    "Mélange le poulet avec le cumin, le paprika, l'origan, la sauce soja, le jus de citron vert et l'ail écrasé. Laisse mariner 15 minutes.",
    "Coupe les pommes de terre en frites de 1 cm, rince-les, sèche-les bien dans un torchon et mélange-les avec l'huile.",
    "Fais cuire le poulet 18 à 20 minutes à l'air fryer à 200 °C, en le retournant à mi-cuisson, jusqu'à ce que le jus qui s'écoule quand on le pique soit clair. Réserve-le, puis fais cuire les frites 18 minutes à 200 °C en secouant le panier deux fois.",
    "Prépare la salsa verde : herbes hachées très finement, yaourt, un filet de citron vert et une pincée de piment.",
    "Coupe la tomate en quartiers et lave la salade.",
    "Mise en boîtes : poulet et frites ensemble, salade et tomate à part, salsa dans un petit pot.",
    "Au moment de manger : réchauffe le poulet et les frites 5 minutes à l'air fryer à 200 °C. La salade et la salsa se mangent froides."
  ],
  "W16": [
    "Hache très finement la tomate, le poivron et l'oignon.",
    "Fais revenir le bœuf 5 minutes à la poêle en l'émiettant, jusqu'à ce qu'il ne soit plus rose. Ajoute la tomate, le poivron, l'oignon, le concentré de tomate, le paprika, le cumin et le piment, et laisse cuire encore 5 minutes : c'est la garniture.",
    "Laisse tiédir la garniture, puis range-la au frigo : cuite, elle se garde 3 jours.",
    "Hache le persil, lave la salade et coupe-la en lanières.",
    "Mise en boîtes : garniture cuite, persil et salade dans des boîtes séparées. Garde les tortillas dans leur sachet.",
    "Au moment de manger : étale une fine couche de garniture sur chaque tortilla, jusqu'aux bords. Fais cuire 6 à 7 minutes à l'air fryer à 200 °C, jusqu'à ce que les bords soient croustillants et la garniture bien chaude. Ajoute le persil, la salade et un filet de citron, puis roule."
  ],
  "W17": [
    "Coupe le poulet en petits dés, le poivron et l'oignon en lamelles.",
    "Fais-les revenir 7 minutes à la poêle avec les épices, en remuant : c'est la garniture de la semaine.",
    "Rince les haricots rouges et écrase-les grossièrement à la fourchette. Égoutte le maïs.",
    "Prépare la salsa : tomate en petits dés et jus de citron vert.",
    "Mise en boîtes : garniture, haricots écrasés, maïs, salsa et yaourt dans des boîtes séparées. Garde les tortillas et le fromage à part.",
    "Au moment de manger : étale les haricots sur une moitié de tortilla, ajoute le poulet, le maïs et le fromage, puis replie. Fais cuire 5 minutes à l'air fryer à 190 °C. Sers avec la salsa et le yaourt."
  ],
  "W18": [
    "La veille, mets les crevettes surgelées à décongeler au frigo.",
    "Fais cuire les nouilles aux œufs à l'autocuiseur : couvre-les d'eau juste à hauteur avec une pincée de sel, et fais-les cuire sous pression la moitié du temps indiqué sur le paquet, arrondi en dessous. Fais tomber la pression, égoutte et rince à l'eau froide. Si tu n'as pas trouvé de nouilles aux œufs, des spaghettis conviennent très bien.",
    "Prépare la sauce : sauce soja, miel et jus de citron vert. Coupe la carotte et le poivron en fins bâtonnets et concasse les cacahuètes.",
    "Dans la poêle bien chaude avec l'huile, fais cuire les crevettes 2 minutes. Ajoute l'œuf battu et la carotte, et remue 1 minute.",
    "Ajoute les nouilles, la sauce et le poivron, et mélange 2 minutes à feu vif : le poivron doit rester croquant.",
    "Mise en boîtes : les nouilles, avec les cacahuètes dans un petit pot à part.",
    "Au moment de manger : réchauffe 3 minutes au micro-ondes en remuant à mi-temps, ou 5 minutes à la poêle à feu moyen avec 2 cuillères à soupe d'eau, jusqu'à ce que ce soit bien chaud partout, puis ajoute les cacahuètes et un filet de citron vert."
  ],
  "W19": [
    "Hache finement l'oignon. Concasse les cacahuètes.",
    "Fais cuire le poulet haché 6 à 7 minutes à la poêle, sans matière grasse, en l'émiettant avec une spatule, jusqu'à ce qu'il ne soit plus rose.",
    "Hors du feu, ajoute la sauce soja, le jus de citron vert, l'oignon et une pincée de piment, puis mélange.",
    "Riz : rince-le à l'eau froide, puis mets-le dans l'autocuiseur avec 1,7 fois son poids d'eau (par exemple 150 ml d'eau pour 90 g de riz). Ferme, laisse cuire 20 minutes sous pression, puis laisse la pression retomber seule pendant 10 minutes avant d'ouvrir. Mets-le en boîtes dès qu'il a tiédi : le riz cuit ne doit pas rester plus d'une heure à température ambiante.",
    "Coupe le concombre en demi-rondelles. Lave et essore les feuilles de salade.",
    "Mise en boîtes : riz et larb ensemble, concombre et salade à part, cacahuètes dans un petit pot.",
    "Au moment de manger : réchauffe le riz et le larb 2 minutes au micro-ondes, ou mange-le froid comme une salade. Ajoute les cacahuètes, et de la menthe ou de la coriandre si tu en as, puis sers avec les feuilles de salade."
  ],
  "W20": [
    "Émince finement le bœuf et mélange-le avec 15 ml de sauce soja. Laisse mariner 10 minutes au frigo.",
    "Coupe la carotte en fins bâtonnets et la courgette en demi-rondelles.",
    "À la poêle, fais sauter ensemble la carotte, la courgette et les épinards 4 minutes avec l'huile, puis réserve-les.",
    "Fais sauter le bœuf 3 minutes à feu vif.",
    "Prépare la sauce : le miel, le ketchup, le reste de la sauce soja, une pincée de paprika fumé et une pincée de piment, dans un petit pot.",
    "Riz : rince-le à l'eau froide, puis mets-le dans l'autocuiseur avec 1,7 fois son poids d'eau (par exemple 150 ml d'eau pour 90 g de riz). Ferme, laisse cuire 20 minutes sous pression, puis laisse la pression retomber seule pendant 10 minutes avant d'ouvrir. Mets-le en boîtes dès qu'il a tiédi : le riz cuit ne doit pas rester plus d'une heure à température ambiante.",
    "Mise en boîtes : riz au fond, légumes et bœuf par-dessus, sauce à part. Garde les œufs crus au frigo.",
    "Au moment de manger : réchauffe 3 minutes au micro-ondes en remuant à mi-temps, ou 5 minutes à la poêle à feu moyen avec 2 cuillères à soupe d'eau, jusqu'à ce que ce soit bien chaud partout. Fais cuire l'œuf au plat 3 minutes à la poêle, pose-le sur le bol et ajoute la sauce et les graines de sésame."
  ],
  "W21": [
    "Coupe le tofu en cubes de 2 cm. Hache l'ail et râpe le gingembre.",
    "Fais revenir le bœuf 4 minutes à la poêle avec l'huile, l'ail et le gingembre, en l'émiettant.",
    "Ajoute la sauce soja, le ketchup, le miel, une pincée de paprika fumé, une pincée de piment et 150 ml d'eau par portion, puis le tofu. Laisse mijoter 5 minutes à feu doux, sans trop remuer pour ne pas casser le tofu.",
    "Délaye la fécule dans 2 cuillères à soupe d'eau froide, ajoute-la et laisse épaissir 1 minute.",
    "Fais cuire le brocoli 10 minutes à l'air fryer à 200 °C.",
    "Riz : rince-le à l'eau froide, puis mets-le dans l'autocuiseur avec 1,7 fois son poids d'eau (par exemple 150 ml d'eau pour 90 g de riz). Ferme, laisse cuire 20 minutes sous pression, puis laisse la pression retomber seule pendant 10 minutes avant d'ouvrir. Mets-le en boîtes dès qu'il a tiédi : le riz cuit ne doit pas rester plus d'une heure à température ambiante.",
    "Mise en boîtes : riz, mapo tofu et brocoli côte à côte.",
    "Au moment de manger : réchauffe 3 minutes au micro-ondes en remuant à mi-temps, ou 5 minutes à la poêle à feu moyen avec 2 cuillères à soupe d'eau, jusqu'à ce que ce soit bien chaud partout."
  ],
  "W22": [
    "Coupe le saumon en pavés ou en cubes de 3 cm. Mélange la sauce soja, le miel, l'ail écrasé et le gingembre râpé, et fais-y mariner le saumon 10 minutes au frigo.",
    "Égoutte le saumon (garde la marinade) et fais-le cuire 7 à 8 minutes à l'air fryer à 200 °C, avec le brocoli autour : la chair doit être opaque et se détacher en lamelles.",
    "Dans la poêle, porte la marinade à ébullition avec la fécule délayée dans une cuillère d'eau, 1 à 2 minutes, jusqu'à ce qu'elle nappe. Verse-la sur le saumon.",
    "Riz : rince-le à l'eau froide, puis mets-le dans l'autocuiseur avec 1,7 fois son poids d'eau (par exemple 150 ml d'eau pour 90 g de riz). Ferme, laisse cuire 20 minutes sous pression, puis laisse la pression retomber seule pendant 10 minutes avant d'ouvrir. Mets-le en boîtes dès qu'il a tiédi : le riz cuit ne doit pas rester plus d'une heure à température ambiante.",
    "Mise en boîtes : riz, saumon et brocoli ensemble. Le saumon se garde 2 jours au frigo : c'est pour ça qu'il est placé en début de semaine.",
    "Au moment de manger : réchauffe 1 minute 30 au micro-ondes à puissance moyenne pour ne pas dessécher le saumon, ou mange-le froid, avec les graines de sésame."
  ],
  "W23": [
    "Coupe le bœuf en cubes de 3 cm, l'oignon en lamelles et la courgette en petits dés.",
    "Mets l'autocuiseur en mode dorer et fais revenir le bœuf et l'oignon 5 minutes avec l'huile.",
    "Ajoute les tomates, la cannelle, le laurier et 200 ml d'eau par portion. Ferme et laisse cuire 30 minutes sous pression, puis laisse la pression retomber seule pendant 10 minutes : la macreuse doit être tendre à la fourchette.",
    "Ajoute l'orzo, la courgette et 150 ml d'eau par portion, mélange, referme et laisse cuire 4 minutes sous pression.",
    "Mise en boîtes : youvetsi, avec le parmesan râpé dans un petit pot.",
    "Au moment de manger : réchauffe 3 minutes au micro-ondes en remuant à mi-temps, ou 5 minutes à la poêle à feu moyen avec 2 cuillères à soupe d'eau, jusqu'à ce que ce soit bien chaud partout (l'orzo absorbe la sauce au frigo, l'eau lui redonne du moelleux), puis ajoute le parmesan."
  ],
  "W24": [
    "Coupe l'oignon et la carotte en petits dés. Rince et égoutte les haricots blancs.",
    "Mets l'autocuiseur en mode dorer et fais revenir l'oignon et la carotte 4 minutes avec l'huile.",
    "Ajoute les haricots, les tomates, l'aneth, les épinards et 80 ml d'eau par portion. Ferme et laisse cuire 5 minutes sous pression.",
    "Mise en boîtes : gigantes, avec la feta émiettée dans un petit pot. Garde le pain dans un sac, hors du frigo.",
    "Au moment de manger : réchauffe 3 minutes au micro-ondes en remuant à mi-temps, ou 5 minutes à la poêle à feu moyen avec 2 cuillères à soupe d'eau, jusqu'à ce que ce soit bien chaud partout, puis ajoute la feta et sers avec le pain."
  ],
  "W25": [
    "Hache le persil et l'oignon. Mélange le bœuf avec la moitié du persil, le cumin, le paprika et une pincée de sel, puis forme des boulettes de la taille d'une noix.",
    "Dans la poêle, fais revenir l'oignon 3 minutes dans l'huile, ajoute les tomates et le reste des épices, et laisse mijoter 8 minutes.",
    "Ajoute les boulettes et laisse cuire encore 8 minutes à feu doux, à couvert, en les retournant à mi-cuisson.",
    "Mise en boîtes : sauce et boulettes. Les œufs restent crus au frigo, le pain dans un sac.",
    "Au moment de manger : verse ta portion dans la poêle et réchauffe 3 minutes à feu moyen. Creuse deux puits, casse les œufs dedans, couvre et laisse cuire 5 minutes, jusqu'à ce que le blanc soit pris. Ajoute le reste du persil et sers avec le pain."
  ],
  "W26": [
    "Hache l'oignon, l'ail et le gingembre. Rince et égoutte les pois chiches.",
    "Mets l'autocuiseur en mode dorer et fais revenir l'oignon, l'ail, le gingembre, le garam masala et le cumin 3 minutes avec l'huile, en remuant.",
    "Ajoute les pois chiches, les tomates, les épinards et 100 ml d'eau par portion. Ferme et laisse cuire 6 minutes sous pression.",
    "Écrase environ un quart des pois chiches à la fourchette pour épaissir la sauce.",
    "Riz : rince-le à l'eau froide, puis mets-le dans l'autocuiseur avec 1,7 fois son poids d'eau (par exemple 150 ml d'eau pour 90 g de riz). Ferme, laisse cuire 20 minutes sous pression, puis laisse la pression retomber seule pendant 10 minutes avant d'ouvrir. Mets-le en boîtes dès qu'il a tiédi : le riz cuit ne doit pas rester plus d'une heure à température ambiante.",
    "Mise en boîtes : riz et chana masala côte à côte, yaourt dans un petit pot.",
    "Au moment de manger : réchauffe 3 minutes au micro-ondes en remuant à mi-temps, ou 5 minutes à la poêle à feu moyen avec 2 cuillères à soupe d'eau, jusqu'à ce que ce soit bien chaud partout, puis ajoute le yaourt."
  ],
  "W27": [
    "Coupe le bœuf en lanières, l'oignon en grosses lamelles et la tomate en quartiers.",
    "Dans la poêle très chaude avec l'huile, saisis le bœuf 2 minutes, puis retire-le.",
    "Fais sauter l'oignon et la tomate 2 minutes, ajoute la sauce soja et le vinaigre de cidre, puis remets le bœuf et mélange.",
    "Riz : rince-le à l'eau froide, puis mets-le dans l'autocuiseur avec 1,7 fois son poids d'eau (par exemple 150 ml d'eau pour 90 g de riz). Ferme, laisse cuire 20 minutes sous pression, puis laisse la pression retomber seule pendant 10 minutes avant d'ouvrir. Mets-le en boîtes dès qu'il a tiédi : le riz cuit ne doit pas rester plus d'une heure à température ambiante.",
    "Mise en boîtes : riz et bœuf sauté côte à côte.",
    "Au moment de manger : réchauffe 3 minutes au micro-ondes en remuant à mi-temps, ou 5 minutes à la poêle à feu moyen avec 2 cuillères à soupe d'eau, jusqu'à ce que ce soit bien chaud partout. Ajoute de la coriandre si tu en as."
  ],
  "W28": [
    "Fais décongeler le poisson la veille au frigo. Coupe-le en gros morceaux et fais-le mariner 10 minutes dans le jus de citron vert.",
    "Coupe l'oignon en lamelles, les poivrons en lanières et la tomate en dés.",
    "Dans la poêle, fais cuire l'oignon, les poivrons et la tomate 6 minutes à feu moyen avec le paprika.",
    "Ajoute le lait de coco, pose le poisson dessus, couvre et laisse cuire 8 minutes à feu doux, sans remuer.",
    "Riz : rince-le à l'eau froide, puis mets-le dans l'autocuiseur avec 1,7 fois son poids d'eau (par exemple 150 ml d'eau pour 90 g de riz). Ferme, laisse cuire 20 minutes sous pression, puis laisse la pression retomber seule pendant 10 minutes avant d'ouvrir. Mets-le en boîtes dès qu'il a tiédi : le riz cuit ne doit pas rester plus d'une heure à température ambiante.",
    "Mise en boîtes : riz et moqueca côte à côte. Le poisson se garde 2 jours au frigo : c'est pour ça qu'il est placé en début de semaine.",
    "Au moment de manger : réchauffe 2 minutes au micro-ondes à puissance moyenne, ou 5 minutes à la poêle à feu doux et à couvert. Ajoute de la coriandre si tu en as."
  ],
  "W29": [
    "Hache l'oignon, l'ail et le gingembre. Rince les lentilles corail.",
    "Mets l'autocuiseur en mode dorer et fais revenir l'oignon 5 minutes avec l'huile, l'ail, le gingembre et les épices (paprika, une pincée de piment et une pincée de cannelle).",
    "Ajoute les lentilles, les tomates, les épinards et 3 fois le poids des lentilles en eau. Pose les œufs entiers, dans leur coquille, sur le dessus. Ferme et laisse cuire 6 minutes sous pression, puis fais tomber la pression.",
    "Plonge les œufs dans de l'eau froide 5 minutes, puis écale-les : ils sont durs.",
    "Riz : rince-le à l'eau froide, puis mets-le dans l'autocuiseur avec 1,7 fois son poids d'eau (par exemple 150 ml d'eau pour 90 g de riz). Ferme, laisse cuire 20 minutes sous pression, puis laisse la pression retomber seule pendant 10 minutes avant d'ouvrir. Mets-le en boîtes dès qu'il a tiédi : le riz cuit ne doit pas rester plus d'une heure à température ambiante.",
    "Mise en boîtes : riz et lentilles côte à côte, œufs écalés entiers posés dessus. Les œufs durs se congèlent mal : pour les boîtes du congélateur, garde-les au frigo (3 jours au plus) ou cuis-en des frais le jour même.",
    "Au moment de manger : réchauffe 3 minutes au micro-ondes en remuant à mi-temps, ou 5 minutes à la poêle à feu moyen avec 2 cuillères à soupe d'eau, jusqu'à ce que ce soit bien chaud partout. Coupe les œufs en deux."
  ],
  "W30": [
    "Mélange les crevettes avec le piment, le paprika, l'ail écrasé, le jus de citron et la moitié de l'huile. Laisse mariner 10 minutes.",
    "Coupe l'oignon et le poivron en petits dés. Rince le riz.",
    "Mets dans l'autocuiseur le riz, les tomates, l'oignon, le poivron, le reste de l'huile et 1,4 fois le poids du riz en eau. Ferme et laisse cuire 20 minutes sous pression, puis laisse la pression retomber seule pendant 10 minutes.",
    "Fais cuire les crevettes 6 minutes à l'air fryer à 200 °C.",
    "Mise en boîtes : riz à la tomate et crevettes. Les crevettes cuites se gardent 2 jours au frigo.",
    "Au moment de manger : réchauffe 1 minute 30 au micro-ondes à puissance moyenne, pour que les crevettes ne deviennent pas caoutchouteuses."
  ],
  "SA01": [
    "Coupe les patates douces en bâtonnets de 1 cm d'épaisseur, sans les éplucher si tu veux.",
    "Sèche-les dans un torchon, puis mélange-les avec l'huile et le paprika fumé.",
    "Fais-les cuire 16 à 18 minutes à l'air fryer à 200 °C, en secouant le panier toutes les 6 minutes. Elles se font au moment du repas : elles ramollissent au frigo."
  ],
  "SA02": [
    "Coupe les pommes de terre en cubes de 2 cm, rince-les et sèche-les bien.",
    "Mélange-les avec l'huile et fais-les cuire 18 minutes à l'air fryer à 200 °C, en secouant le panier deux fois.",
    "Prépare la sauce : yaourt, paprika fumé et une pointe d'ail écrasé."
  ],
  "SA03": [
    "Rince et égoutte les pois chiches, puis sèche-les bien dans un torchon : c'est ce qui les rend croustillants.",
    "Mélange-les avec l'huile et le za'atar.",
    "Fais-les cuire 14 à 15 minutes à l'air fryer à 190 °C, en secouant le panier à mi-cuisson. Ils se gardent 2 jours dans une boîte hermétique, hors du frigo, et ramollissent un peu."
  ],
  "SA04": [
    "Coupe l'aubergine en demi-lunes de 2 cm, quadrille la chair avec la pointe d'un couteau et badigeonne-la d'huile.",
    "Fais-la cuire 10 minutes à l'air fryer à 190 °C.",
    "Mélange la pâte miso et le miel, étale-les sur l'aubergine et prolonge la cuisson de 4 minutes. Parsème de graines de sésame."
  ],
  "SA05": [
    "Mélange les fleurettes de brocoli encore surgelées avec l'huile.",
    "Fais-les cuire 10 minutes à l'air fryer à 200 °C, en secouant le panier à mi-cuisson.",
    "Ajoute le parmesan râpé, prolonge de 2 minutes, puis arrose de jus de citron au moment de servir."
  ],
  "SA06": [
    "Mélange les fleurettes de chou-fleur encore surgelées avec l'huile, le curcuma, le cumin et une pincée de sel.",
    "Fais-les cuire 14 à 15 minutes à l'air fryer à 200 °C, en secouant le panier à mi-cuisson."
  ],
  "SA07": [
    "Coupe les carottes en bâtonnets de 1 cm et mélange-les avec l'huile et le cumin.",
    "Fais-les cuire 14 minutes à l'air fryer à 190 °C, puis ajoute le miel, mélange et prolonge de 2 minutes.",
    "Prépare le yaourt à la menthe : yaourt et menthe hachée."
  ],
  "SA08": [
    "Égoutte le maïs et sèche-le dans un torchon.",
    "Fais-le griller 10 minutes à l'air fryer à 200 °C, en secouant le panier à mi-cuisson.",
    "Mélange-le avec le yaourt, la feta émiettée, une pincée de piment et le jus de citron vert."
  ],
  "SA09": [
    "Coupe les courgettes en bâtonnets de 1 cm.",
    "Enrobe-les de yaourt, puis roule-les dans le panko mélangé au parmesan râpé.",
    "Fais-les cuire 10 à 12 minutes à l'air fryer à 200 °C, sans les superposer. Elles se font au moment du repas."
  ],
  "SA10": [
    "Rince et égoutte les pois chiches. Hache finement l'oignon et le persil.",
    "Écrase finement le tout à la fourchette avec le cumin, la farine et une pincée de sel, jusqu'à obtenir une pâte qui se tient.",
    "Forme 6 boulettes un peu aplaties, badigeonne-les d'huile et fais-les cuire 14 minutes à l'air fryer à 190 °C, en les retournant à mi-cuisson."
  ],
  "SA11": [
    "Coupe les pommes de terre en frites de 1 cm, rince-les à l'eau froide et sèche-les bien dans un torchon.",
    "Mélange-les avec l'huile et une pincée de sel.",
    "Fais-les cuire 18 minutes à l'air fryer à 200 °C, en secouant le panier toutes les 6 minutes. Elles se font au moment du repas."
  ],
  "SA12": [
    "Écrase le concombre avec le plat d'un couteau, puis coupe-le en morceaux de 2 cm.",
    "Assaisonne-le avec le vinaigre de riz, la sauce soja, l'huile de sésame, l'ail écrasé et les graines de sésame.",
    "Laisse reposer 10 minutes au frigo avant de servir. Il se garde 2 jours."
  ],
  "C01": [
    "Au self, prends un plat avec une protéine, des féculents et des légumes.",
    "Ajoute un laitage et un fruit.",
    "Prends un morceau de pain."
  ],
  "S01": [
    "Rince le riz à l'eau froide.",
    "Mets-le dans l'autocuiseur avec 1,5 fois son poids d'eau (par exemple 120 ml d'eau pour 80 g de riz).",
    "Ferme, laisse cuire 5 minutes sous pression, puis laisse la pression retomber seule pendant 10 minutes avant d'ouvrir. Mets-le en boîtes dès qu'il a tiédi : le riz cuit ne doit pas rester plus d'une heure à température ambiante."
  ],
  "S02": [
    "Coupe la patate douce en cubes de 2 cm et mélange-la avec l'huile.",
    "Fais-la cuire 18 minutes à l'air fryer à 180 °C, en secouant le panier à mi-cuisson."
  ],
  "S03": [
    "Coupe la courgette, le poivron et l'oignon en morceaux de 2 cm.",
    "Mélange-les avec l'huile et une pincée de sel.",
    "Fais-les cuire 15 minutes à l'air fryer à 180 °C, en secouant le panier à mi-cuisson."
  ],
  "S04": [
    "Rince le quinoa dans une passoire fine.",
    "Mets-le dans l'autocuiseur avec 1,5 fois son volume d'eau.",
    "Ferme, laisse cuire 1 minute sous pression, puis laisse la pression retomber seule pendant 10 minutes avant d'ouvrir. Mets-le en boîtes dès qu'il a tiédi : le riz cuit ne doit pas rester plus d'une heure à température ambiante."
  ],
  "EN01": [
    "À l'autocuiseur, mets l'oignon et les courgettes, couvre d'eau et laisse cuire 5 minutes sous pression.",
    "Écrase au presse-purée, ou mixe si tu as un mixeur, avec le carré frais."
  ],
  "EN02": [
    "Râpe ou coupe les légumes.",
    "Assaisonne avec l'huile, le vinaigre et le sel."
  ],
  "K01": [
    "Mets dans le mixeur le yaourt, la mangue encore surgelée, la whey, le lait et une pincée de cardamome.",
    "Mixe 1 minute, jusqu'à obtenir une texture lisse.",
    "Bois-le tout de suite : il ne se garde pas."
  ],
  "K02": [
    "Mélange la whey dans le yaourt jusqu'à ce qu'il n'y ait plus de grumeaux.",
    "Concasse les pistaches avec le plat d'un couteau.",
    "Ajoute le miel et les pistaches par-dessus."
  ],
  "K03": [
    "Étale le yaourt grec dans une assiette creuse, arrose-le d'huile d'olive et saupoudre-le de za'atar.",
    "Coupe le concombre et la tomate en bâtonnets.",
    "Réchauffe la pita 2 minutes à l'air fryer à 180 °C, coupe-la en triangles et trempe-la dans le labneh."
  ],
  "K05": [
    "La veille au soir, dans un bocal, mélange les flocons, le lait, la whey et 1 cuillère à café de café soluble.",
    "Mélange le fromage blanc avec le miel et étale-le en couche par-dessus, puis saupoudre de cacao.",
    "Ferme et laisse au frigo jusqu'au lendemain."
  ],
  "K06": [
    "Pendant la session de cuisine, écrase la banane à la fourchette, puis mélange-la avec les flocons, l'œuf, la whey et le lait.",
    "Fais chauffer la poêle à feu moyen avec quelques gouttes d'huile essuyées au papier absorbant.",
    "Verse 2 cuillères à soupe de pâte par pancake et fais cuire 1 minute 30 de chaque côté.",
    "Laisse-les refroidir. Garde au frigo ceux des 3 premiers jours, et congèle les autres en les séparant avec du papier cuisson.",
    "Au moment de manger : réchauffe-les 1 minute à la poêle ou 2 minutes au grille-pain (directement surgelés s'ils sortent du congélateur), puis ajoute le miel."
  ],
  "K07": [
    "Fais chauffer les fruits rouges surgelés 2 minutes à la poêle, jusqu'à ce qu'ils frémissent, puis laisse-les refroidir : c'est la recommandation sanitaire pour les petits fruits surgelés mangés sans cuisson.",
    "Mets dans le mixeur les fruits rouges refroidis, la banane, la whey, le lait et 4 glaçons.",
    "Mixe en raclant les parois jusqu'à obtenir une texture épaisse, puis verse dans un bol et ajoute les flocons et le beurre de cacahuète par-dessus."
  ],
  "K08": [
    "Fais tremper les dattes 30 minutes dans un bol d'eau froide pour les ramollir, puis égoutte-les.",
    "Écrase-les à la fourchette avec les flocons, la whey, le beurre de cacahuète et le cacao, jusqu'à obtenir une pâte qui se tient.",
    "Forme 3 boules par portion. Elles se gardent une semaine au frigo dans une boîte fermée."
  ],
  "K09": [
    "Mets dans le mixeur le lait, la whey, la banane, le beurre de cacahuète, les flocons, 1 cuillère à café de café soluble et 3 glaçons.",
    "Mixe 1 minute et bois tout de suite."
  ],
  "K10": [
    "Verse le fromage blanc dans un bol et mélange-y la whey jusqu'à ce qu'il n'y ait plus de grumeaux.",
    "Ajoute la banane en rondelles, puis le beurre de cacahuète et le miel en filet."
  ],
  "K11": [
    "Mets dans l'autocuiseur le riz, le lait et le lait de coco. Ne remplis pas la cuve à plus de la moitié : le lait mousse en cuisant.",
    "Ferme et laisse cuire 12 minutes sous pression, puis laisse la pression retomber seule.",
    "Laisse tiédir 10 minutes, puis incorpore la whey en remuant.",
    "Répartis en pots. Ajoute la mangue en dés au moment de manger. Il se garde 4 jours au frigo."
  ],
  "K12": [
    "Fais griller le pain 3 minutes à l'air fryer à 180 °C.",
    "Écrase l'avocat avec le jus de citron vert et une pincée de piment, puis étale-le sur le pain.",
    "Fais cuire l'œuf au plat 3 minutes à la poêle huilée, pose-le sur le pain et ajoute la tomate en dés."
  ],
  "S05": [
    "Prends le fruit de saison le moins cher : pomme, poire, clémentines, raisin ou pêche selon la période."
  ],
  "S06": [
    "Une tranche de pain complet."
  ],
  "S08": [
    "Verse le fromage blanc dans un bol.",
    "Ajoute le miel et la cuillère de beurre de cacahuète."
  ],
  "S09": [
    "Coupe la banane en rondelles.",
    "Ajoute la cuillère de beurre de cacahuète par-dessus."
  ],
  "S11": [
    "Tartine le pain de carré frais.",
    "Ajoute les tranches de blanc de poulet."
  ],
  "S12": [
    "Tartine le pain de carré frais.",
    "Ajoute le miel, une pincée de thym (frais ou séché) et un tour de poivre."
  ],
  "S16": [
    "Fais chauffer les fruits rouges surgelés 2 minutes à la poêle, jusqu'à ce qu'ils frémissent, puis laisse-les refroidir et range-les au frigo : c'est la recommandation sanitaire pour les petits fruits surgelés mangés sans cuisson. Ils se gardent ensuite 3 jours.",
    "Verse le skyr dans un bol et ajoute les fruits rouges."
  ],
  "S07": [
    "Une petite poignée d'amandes, soit une vingtaine."
  ],
  "X01": [
    "Repas pris au restaurant, chez des amis ou au travail."
  ]
};
RECIPES.forEach(r => { if (STEPS[r.id]) r.steps = STEPS[r.id]; });
// Riz complet : 20 minutes sous pression au lieu de 5
RECIPES.forEach(r => { if (['lunch', 'dinner'].includes(r.category) && r.ingredients.some(i => i.key === 'riz')) r.cookTime += 15; });

// ── Variantes sans whey (collations et petits-déjeuners) ──
// Même recette, seule la whey change : on augmente le produit laitier déjà présent (skyr, fromage blanc,
// yaourt grec), sinon on ajoute du skyr ; pour les energy balls et le riz au lait, on la retire simplement.
// Identifiant : celui de la recette + « S » (ex. K01S). La photo reste celle de la recette d'origine.
const NO_WHEY_DROP = ['K08', 'K11', 'K15', 'K17', 'K18', 'K19', 'K20', 'K21'];
const DAIRY = ['fromage_blanc', 'yaourt_grec'];
RECIPES.filter(r => ['sweet', 'breakfast'].includes(r.category) && r.ingredients.some(i => i.key === 'whey')).forEach(r => {
  const drop = NO_WHEY_DROP.includes(r.id);
  const w = r.ingredients.find(i => i.key === 'whey').qty;
  const base = DAIRY.find(k => r.ingredients.some(i => i.key === k));
  // environ autant de protéines que la whey retirée (skyr et yaourt grec ≈ 10 g pour 100 g, fromage blanc ≈ 7,5 g)
  const add = Math.min(base === 'yaourt_grec' ? 175 : 200, Math.round(w * (base === 'yaourt_grec' ? 6 : 8) / 25) * 25);
  let ings = r.ingredients.filter(i => i.key !== 'whey').map(i => [i.key, i.qty]);
  if (!drop) {
    const key = base || 'fromage_blanc';
    const k = ings.findIndex(([x]) => x === key);
    if (k >= 0) ings[k] = [key, ings[k][1] + add]; else ings.push([key, add]);
  }
  // l'étape qui ne servait qu'à incorporer la whey devient une simple action (verser le laitage, laisser tiédir) ;
  // ailleurs, la whey est remplacée par le skyr ou retirée de la liste
  const DAIRY_NAME = { skyr: 'le skyr', fromage_blanc: 'le fromage blanc', yaourt_grec: 'le yaourt grec' };
  const steps = r.steps
    .map(st => {
      const m = st.match(/^(Le matin, )?mélange la whey dans /i);
      if (m) return (m[1] ? 'Le matin, verse ' : 'Verse ') + (DAIRY_NAME[base] || 'le fromage blanc') + ' dans un bol.';
      if (/^Laisse tiédir [0-9]+ minutes, puis incorpore la whey en remuant[.]$/.test(st)) return st.replace(/, puis incorpore la whey en remuant/, '');
      return st;
    })
    .map(st => st
      .replace(/, la whey et /g, drop || base ? ' et ' : ', le fromage blanc et ')
      .replace(/, la whey, /g, drop || base ? ', ' : ', le fromage blanc, ')
      .replace(/ la whey et /g, drop || base ? ' ' : ' le fromage blanc et ')
      .replace(/la whey/g, 'le fromage blanc').replace(/de whey/g, 'de fromage blanc').replace(/whey/g, 'fromage blanc'));
  const name = r.name.replace(/ à la whey/g, base ? '' : ' au fromage blanc').replace(/ protéinées?s?/g, '').replace(/ protéinés?/g, '');
  const v = M(r.id + 'S', name, r.category, r.emoji, r.prepTime, r.cookTime, ings, steps, r.tip, [...(r.tags || []).filter(t => t !== 'whey'), 'sans-whey'], r.batch);
  v.short = r.short;
  v.photo = r.id;
  v.wheyOf = r.id; // version avec whey
  RECIPES.push(v);
});
// ── Repas libre : un midi ou un soir que Hébé ne calcule pas ; sa part de calories reste réservée ──
RECIPES.push(M('L01', 'Repas libre', 'extra', '🍴', 0, 0, [['repas_libre', 9]],
  ["Ce repas n'est pas calculé par Hébé : mange ce que tu veux.", "Sa part de calories est réservée pour que le reste de la journée reste équilibré."],
  "Non compté dans la cuisine ni dans les courses.", ['cantine', 'libre'], false));

// ── Accompagnements retirés : les plats sont complets ──
const RETIRED = ['W42', 'B14', 'EN01', 'EN02', 'W23', 'W24', 'W26', 'B10', 'B12', 'B13', 'K01', 'K03', 'K07', 'K09', 'K11', 'S06', 'S09', 'S16', 'SA01', 'SA02', 'SA03', 'SA04', 'SA05', 'SA06', 'SA07', 'SA08', 'SA09', 'SA10', 'SA11', 'SA12', 'S01', 'S02', 'S03', 'S04'];
RECIPES.forEach(r => { if (RETIRED.includes(r.id) || (r.wheyOf && RETIRED.includes(r.wheyOf))) r.retired = true; });

// Une recette contient-elle de la whey ?
export const hasWhey = r => !!r && r.ingredients.some(i => i.key === 'whey');

// ── Portion de féculent des plats : jamais sous le minimum (même règle que le moteur) ──
const MAIN_CATS = ['lunch', 'dinner'];
RECIPES.filter(r => MAIN_CATS.includes(r.category) && !(r.tags || []).includes('cantine')).forEach(r => {
  let idx = r.ingredients.findIndex(i => i.key === 'riz');
  if (idx < 0) {
    let best = 0;
    r.ingredients.forEach((i, k) => { if (INGREDIENTS[i.key]?.minP && i.kcal > best) { best = i.kcal; idx = k; } });
  }
  if (idx < 0) return;
  const ing = r.ingredients[idx], minP = INGREDIENTS[ing.key].minP;
  if (ing.qty >= minP) return;
  const m = ingMacros(ing.key, minP);
  r.ingredients[idx] = { ...ing, qty: minP, kcal: +m.kcal.toFixed(1), protein: +m.protein.toFixed(1), carbs: +m.carbs.toFixed(1), fat: +m.fat.toFixed(1) };
});

// ── Ingrédients ajoutés par toi à une recette (ex. +1 œuf) ──
// Mémorisés par recette, comptés dans les macros, les courses et Cuisiner.
// Le moteur ne les ajuste jamais (js/optimizer.js ignore les ingrédients « extra »).
const EXTRAS_KEY = 'hebe_recipe_extras';
const loadExtras = () => { try { return JSON.parse(localStorage.getItem(EXTRAS_KEY) || '{}'); } catch { return {}; } };
export function getExtras(id) { return loadExtras()[id] || []; }
export function setExtras(id, list) {
  const all = loadExtras();
  if (list.length) all[id] = list; else delete all[id];
  localStorage.setItem(EXTRAS_KEY, JSON.stringify(all));
  applyExtras();
}
export function applyExtras() {
  const all = loadExtras();
  RECIPES.forEach(r => {
    if (!r.baseIngredients) r.baseIngredients = r.ingredients;
    const extras = (all[r.id] || []).filter(e => INGREDIENTS[e.key] && e.qty > 0).map(e => {
      const db = INGREDIENTS[e.key], m = ingMacros(e.key, e.qty);
      return { key: e.key, name: db.name, qty: e.qty, unit: db.unit, extra: true,
        kcal: +m.kcal.toFixed(1), protein: +m.protein.toFixed(1), carbs: +m.carbs.toFixed(1), fat: +m.fat.toFixed(1) };
    });
    r.ingredients = [...r.baseIngredients, ...extras];
    const t = r.ingredients.reduce((a, i) => ({ kcal: a.kcal + i.kcal, protein: a.protein + i.protein, carbs: a.carbs + i.carbs, fat: a.fat + i.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
    Object.keys(t).forEach(k => t[k] = Math.round(t[k]));
    r.macros = t;
  });
}
applyExtras();

export const getDinners  = () => RECIPES.filter(r => r.category === 'dinner');
export const getLunches  = () => RECIPES.filter(r => r.category === 'lunch');
export const getMains    = () => RECIPES.filter(r => !r.retired && (r.category === 'dinner' || r.category === 'lunch') && !(r.tags || []).includes('cantine'));
export const getSides    = () => RECIPES.filter(r => r.category === 'side' && !r.retired);
export const getSweets   = () => RECIPES.filter(r => !r.retired && r.category === 'sweet');
export const getBreakfasts = () => RECIPES.filter(r => !r.retired && r.category === 'breakfast');
export const getStarters = () => RECIPES.filter(r => r.category === 'starter');
export const getById     = (id) => RECIPES.find(r => r.id === id);
export const getBatch    = () => RECIPES.filter(r => r.batch);
export const isCantine   = (r) => !!r && (r.tags || []).includes('cantine');
export const isOutside   = (r) => !!r && (r.tags || []).includes('imprevu');

// Famille de protéine principale d'une recette (pour la variété et les filtres).
// Ids alignés sur les chips de la vue Semaine : poulet · boeuf · crevettes · saumon (= poisson) · tofu (= végé)
const FAMILY = {
  poulet: 'poulet', haut_cuisse: 'poulet', boeuf_emince: 'boeuf', poulet_hache: 'poulet', poulet_tranches: 'poulet', boeuf: 'boeuf',
  saumon: 'saumon', poisson_blanc: 'saumon', thon: 'saumon', crevettes: 'crevettes',
  tofu: 'tofu', oeuf: 'tofu',
};
export function proteinFamily(r) {
  let best = null, bestP = 0;
  r.ingredients.forEach(i => {
    if (FAMILY[i.key] && i.protein > bestP) { best = FAMILY[i.key]; bestP = i.protein; }
  });
  if (best) return best;
  return 'tofu'; // légumineuses → végé
}
// Poisson / fruits de mer frais : à manger dans les 2 jours
export function isFreshFish(r) {
  return r.ingredients.some(i => ['saumon', 'poisson_blanc', 'crevettes'].includes(i.key));
}
// Féculent principal (pour éviter « riz » à tous les repas)
export function mainStarch(r) {
  let best = null, bestQ = 0;
  r.ingredients.forEach(i => {
    const db = INGREDIENTS[i.key];
    if (db && (db.role === 'carb' || db.role === 'legume') && i.carbs > bestQ) { best = i.key; bestQ = i.carbs; }
  });
  return best;
}
`;
fs.writeFileSync(path.join(RACINE,'data','recipes.js'),head+body+tail);
console.log('ok', W.mains.length,'plats', W.sides.length,'accompagnements', K.snacks.length,'collations', kept.length+NEW.sides.length,'autres');

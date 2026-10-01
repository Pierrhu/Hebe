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
 D10:{ings:[['dinde_hachee',150],['boulghour',75],['courgette',150],['tomates_conc',120],['huile',5],['ail',1]]},
 D11:{ings:[['poulet',150],['riz',75],['haricots_verts',150],['miel',10],['soja',15],['ail',2]]},
 D12:{ings:[['boeuf',130],['haricots_rouges',100],['riz',60],['tomates_conc',150],['poivron',80],['oignon',50],['epices',5]]},
 D13:{ings:[['saumon',130],['riz',70],['brocoli',150],['soja',15],['miel',8],['sesame',5]]},
 D14:{ings:[['poisson_blanc',170],['chapelure',20],['oeuf',1],['pdt',200],['petits_pois',120],['huile',6]]},
 D15:{ings:[['lentilles_corail',80],['riz',50],['lait_coco',80],['tomates_conc',120],['epinards',100],['epices',5]],add:'Ajouter les épinards 3 min avant la fin.'},
 L01:{ings:[['poulet',130],['riz',65],['avocat',50],['tomates_cerise',100],['mais',50],['huile',5]]},
 L02:{ings:[['poulet',130],['tortilla',80],['yaourt_grec',40],['parmesan',10],['salade',50],['tomates_cerise',80],['ail',1]]},
 L03:{ings:[['farine',90],['fromage_blanc',110],['oeuf',1],['levure',5],['poulet',110],['emmental',25],['oignon',30]]},
 L04:{ings:[['farine',90],['fromage_blanc',110],['oeuf',1],['levure',5],['thon',110],['fromage_frais',30],['herbes',3]]},
 L05:{ings:[['farine',90],['fromage_blanc',110],['oeuf',1],['levure',5],['boeuf',110],['oignon',40],['soja',8]]},
 L06:{ings:[['farine',90],['fromage_blanc',110],['oeuf',1],['levure',5],['poulet',110],['lait_coco',40],['pate_curry',10]]},
 L07:{ings:[['jambon_dinde',100],['tortilla',80],['avocat',40],['salade',40],['tomates_cerise',80]],batch:false},
 L08:{ings:[['thon',100],['tortilla',80],['fromage_frais',25],['salade',40],['tomates_cerise',80],['mais',40]],batch:false},
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
const K=require(path.join(ICI,'collations.js'));
const kept=out.filter(o=>(!['dinner','lunch','sweet'].includes(o.cat))||o.id==='C01');
let body='  // ══ 30 plats du monde (plaques · autocuiseur · air fryer) ══\n'+W.mains.map(line).join('\n')
 +'\n\n  // ══ Accompagnements air fryer ══\n'+W.sides.map(line).join('\n')
 +'\n\n  // ══ Cantine, collations, compléments, entrées ══\n'+kept.map(line).join('\n')
 +'\n\n  // ══ Collations (whey) ══\n'+K.snacks.map(line).join('\n')+'\n'+NEW.sides.map(line).join('\n')+'\n\n  // ══ Imprévu ══\n'+NEW.special.map(line).join('\n')+'\n';
const tail=`];

// Noms courts, pour les listes (semaine, sessions de cuisine)
const SHORT_NAMES = {
  W01: 'Curry vert', W02: 'Bún gà', W03: 'Gyudon', W04: 'Souvlaki', W05: 'Köfte',
  W06: 'Mujaddara', W07: 'Tajine de poulet', W08: 'Tinga de poulet', W09: 'Döner', W10: 'Smash burger',
  W11: 'Korean chicken', W12: 'Katsu curry', W13: 'Bánh mì', W14: 'Butter chicken', W15: 'Pollo a la brasa',
  W16: 'Lahmacun', W17: 'Quesadillas', W18: 'Pad thaï', W19: 'Larb de dinde', W20: 'Bibimbap',
  W21: 'Mapo tofu', W22: 'Saumon miso', W23: 'Youvetsi', W24: 'Gigantes', W25: 'Tajine de kefta',
  W26: 'Chana masala', W27: 'Lomo saltado', W28: 'Moqueca', W29: 'Misir wot', W30: 'Crevettes piri-piri',
  C01: 'Cantine', X01: 'Repas dehors',
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
  "W01": [
    "Mets l'autocuiseur en mode dorer et fais revenir la pâte de curry 2 minutes avec un fond de lait de coco.",
    "Ajoute le poulet en dés, l'aubergine en cubes, le poivron, le reste du lait de coco et le nuoc-mâm.",
    "Ferme l'autocuiseur et laisse cuire 8 minutes sous pression, puis fais tomber la pression rapidement.",
    "Ajoute le basilic au moment de servir. Le riz se cuit à part, à l'autocuiseur, avant ou après le curry."
  ],
  "W02": [
    "Fais mariner le poulet avec la citronnelle hachée, l'ail, le nuoc-mâm et le miel, 15 minutes ou la veille.",
    "Fais-le cuire 12 à 14 minutes à l'air fryer à 200 °C en le retournant à mi-cuisson, puis tranche-le.",
    "Plonge les vermicelles 4 minutes dans de l'eau bouillante, puis rince-les à l'eau froide.",
    "Prépare la sauce : nuoc-mâm, citron vert, 1 cuillère à café de miel et 3 cuillères à soupe d'eau.",
    "Garnis les boîtes avec les vermicelles, les crudités, le poulet et les cacahuètes. Garde la sauce dans un petit pot à part."
  ],
  "W03": [
    "Émince finement le bœuf et l'oignon. Le bœuf se tranche plus facilement s'il est un peu congelé.",
    "Dans la poêle, fais cuire l'oignon 6 minutes avec 100 ml d'eau, la sauce soja, le mirin et le gingembre.",
    "Ajoute le bœuf et laisse cuire 2 à 3 minutes seulement.",
    "Sers sur le riz avec un œuf mollet (6 minutes 30 dans l'eau bouillante) et des épinards passés à la poêle."
  ],
  "W04": [
    "Fais mariner le poulet en cubes avec le citron, l'origan, l'ail et l'huile, idéalement la veille.",
    "Fais-le cuire 12 minutes à l'air fryer à 200 °C en secouant le panier à mi-cuisson.",
    "Prépare le tzatziki : yaourt, concombre râpé et bien essoré, ail.",
    "Au moment de manger, réchauffe la pita 2 minutes à l'air fryer."
  ],
  "W05": [
    "Mélange le bœuf, l'oignon râpé, le persil, le cumin et le paprika, puis forme des köfte allongées.",
    "Fais-les cuire 10 à 12 minutes à l'air fryer à 200 °C.",
    "Pendant ce temps, fais revenir le boulgour dans l'huile à l'autocuiseur, ajoute les tomates, le concentré et 1,5 fois son volume d'eau, puis laisse cuire 4 minutes sous pression.",
    "Prépare le cacık : yaourt, concombre en dés et menthe séchée."
  ],
  "W06": [
    "Mélange les oignons en fines lamelles avec la moitié de l'huile et fais-les dorer 15 à 18 minutes à l'air fryer à 180 °C en remuant de temps en temps.",
    "À l'autocuiseur, mets les lentilles, le riz, le cumin, le reste de l'huile et 2,5 fois leur volume d'eau, puis laisse cuire 12 minutes sous pression.",
    "Prépare un yaourt à l'ail et une salade de tomate et concombre.",
    "Ajoute les oignons croustillants par-dessus au moment de servir."
  ],
  "W07": [
    "Mets l'autocuiseur en mode dorer et fais revenir 5 minutes le poulet, l'oignon et les épices (ras-el-hanout, curcuma, gingembre).",
    "Ajoute les carottes, les courgettes, le citron confit, les olives et 100 ml d'eau par portion.",
    "Laisse cuire 12 minutes sous pression, puis laisse la pression retomber toute seule.",
    "Pour la semoule, verse dessus le même volume d'eau bouillante et couvre 5 minutes."
  ],
  "W08": [
    "À l'autocuiseur, mets le poulet entier, les tomates, l'oignon, le chipotle et l'ail, puis laisse cuire 10 minutes sous pression.",
    "Effiloche le poulet à la fourchette directement dans la sauce et fais réduire 3 minutes en mode dorer.",
    "Compose le bol : riz, haricots noirs, maïs, poulet, yaourt, citron vert et coriandre."
  ],
  "W09": [
    "Fais mariner le poulet avec la moitié du yaourt, le paprika, le cumin, l'origan et l'ail.",
    "Fais-le cuire 15 minutes à l'air fryer à 200 °C, émince-le finement, puis remets-le 2 minutes pour griller les bords.",
    "Prépare la sauce blanche avec le reste du yaourt, l'ail et les herbes.",
    "Au moment de manger, chauffe la galette et garnis-la de poulet, de crudités et de sauce."
  ],
  "W10": [
    "Coupe les patates douces en bâtonnets, mélange-les avec l'huile et le paprika fumé, puis fais-les cuire 18 minutes à l'air fryer à 200 °C.",
    "Fais caraméliser les oignons émincés 10 minutes à la poêle. Ils se préparent pour toute la semaine.",
    "Forme une boule de viande, écrase-la fort dans la poêle très chaude et fais-la cuire 2 minutes par face, avec le cheddar dessus.",
    "Prépare la sauce : yaourt, moutarde et cornichons hachés."
  ],
  "W11": [
    "Coupe le poulet en morceaux et enrobe-les de fécule.",
    "Fais-les cuire 16 minutes à l'air fryer à 200 °C en secouant le panier deux fois : ils deviennent croustillants sans friture.",
    "Chauffe 1 minute à la poêle le gochujang, le miel, la sauce soja et l'ail, puis enrobe le poulet de cette sauce.",
    "Sers avec le riz et le concombre écrasé, assaisonné de vinaigre de riz, d'huile de sésame et de graines de sésame."
  ],
  "W12": [
    "À l'autocuiseur, mets l'oignon, la carotte, la pomme de terre, le curry en poudre, le miel, la sauce soja et 200 ml d'eau, puis laisse cuire 5 minutes sous pression.",
    "Écrase la sauce au presse-purée ou à la fourchette et épaissis-la avec la fécule délayée dans un peu d'eau.",
    "Aplatis le poulet, passe-le dans l'œuf battu puis dans le panko, et fais-le cuire 12 à 14 minutes à l'air fryer à 200 °C.",
    "Tranche le poulet pané et sers-le sur le riz, nappé de sauce."
  ],
  "W13": [
    "Prépare les pickles : carotte en julienne, vinaigre de riz et une pincée de sucre. Laisse reposer 30 minutes. Ils se gardent une semaine.",
    "Fais mariner le poulet avec la citronnelle, le nuoc-mâm et le miel, puis fais-le cuire 12 à 14 minutes à l'air fryer à 200 °C et émince-le.",
    "Prépare une mayonnaise légère avec le yaourt et la sriracha.",
    "Au moment de manger, réchauffe la baguette 2 minutes à l'air fryer et garnis-la."
  ],
  "W14": [
    "Fais mariner le poulet dans le yaourt et le garam masala, 10 minutes ou la veille.",
    "Mets l'autocuiseur en mode dorer et fais revenir l'oignon, l'ail, le gingembre et les épices 3 minutes.",
    "Ajoute les tomates, le concentré et le poulet, puis laisse cuire 6 minutes sous pression.",
    "Ajoute la crème une fois la cuisson terminée. Le riz se cuit à part, à l'autocuiseur."
  ],
  "W15": [
    "Fais mariner le poulet avec le cumin, le paprika, l'origan, la sauce soja, le citron vert et l'ail.",
    "Fais cuire les frites 12 minutes à l'air fryer à 200 °C, puis ajoute le poulet et prolonge la cuisson de 10 à 12 minutes.",
    "Prépare la salsa verde : coriandre ou persil haché très finement, yaourt, citron vert et piment.",
    "Sers avec une salade de tomates."
  ],
  "W16": [
    "Prépare la garniture : bœuf cru, tomate, poivron et oignon hachés très finement, concentré de tomate, paprika, cumin et piment.",
    "Étale une fine couche de garniture sur chaque tortilla.",
    "Fais cuire 6 à 7 minutes à l'air fryer à 200 °C, jusqu'à ce que les bords soient croustillants.",
    "Ajoute le persil, l'oignon et un filet de citron, puis roule et déguste."
  ],
  "W17": [
    "Fais revenir 7 minutes à la poêle le poulet en dés, le poivron, l'oignon et les épices. Cette garniture se prépare pour la semaine.",
    "Écrase grossièrement les haricots noirs à la fourchette.",
    "Garnis la tortilla de haricots, de poulet, de maïs et de fromage, puis replie-la.",
    "Fais-la cuire 5 minutes à l'air fryer à 190 °C. Sers avec une salsa tomate et citron vert, et du yaourt."
  ],
  "W18": [
    "Fais tremper les nouilles 8 minutes dans de l'eau chaude.",
    "Prépare la sauce : nuoc-mâm, miel, citron vert et sauce soja.",
    "Dans la poêle bien chaude, fais cuire les crevettes 2 minutes, puis ajoute l'œuf battu et la carotte.",
    "Ajoute les nouilles et la sauce, mélange 2 minutes, puis termine avec les pousses de soja et les cacahuètes."
  ],
  "W19": [
    "Fais cuire la dinde hachée 6 à 7 minutes à la poêle, sans matière grasse, en l'émiettant.",
    "Hors du feu, ajoute le nuoc-mâm, le citron vert, l'échalote, le piment, la menthe et la coriandre.",
    "Sers avec le riz, le concombre et des feuilles de salade."
  ],
  "W20": [
    "Fais mariner le bœuf avec la sauce soja, l'ail et l'huile de sésame.",
    "À la poêle, fais sauter chaque légume séparément 2 à 3 minutes, puis le bœuf 3 minutes.",
    "Prépare un œuf au plat ou mollet au moment de manger.",
    "Dans le bol, dispose le riz, les légumes, le bœuf, l'œuf et un peu de gochujang."
  ],
  "W21": [
    "Fais revenir le bœuf émietté 4 minutes à la poêle avec l'ail et le gingembre.",
    "Ajoute le gochujang, la sauce soja et 150 ml d'eau.",
    "Ajoute le tofu en cubes, laisse mijoter 5 minutes à feu doux, puis épaissis avec la fécule délayée dans un peu d'eau.",
    "Fais cuire le brocoli à l'air fryer et sers avec le riz."
  ],
  "W22": [
    "Prépare la laque : miso, miel et 1 cuillère à café d'eau.",
    "Badigeonne le saumon et fais-le cuire 8 à 10 minutes à l'air fryer à 200 °C, avec le brocoli.",
    "Fais mariner le concombre dans le vinaigre de riz avec des graines de sésame.",
    "Sers sur le riz."
  ],
  "W23": [
    "Mets l'autocuiseur en mode dorer et fais revenir le bœuf en cubes et l'oignon 5 minutes.",
    "Ajoute les tomates, la cannelle, le laurier et 200 ml d'eau, puis laisse cuire 15 minutes sous pression.",
    "Ajoute l'orzo, la courgette et 150 ml d'eau, puis laisse cuire 4 minutes sous pression.",
    "Sers avec du parmesan râpé."
  ],
  "W24": [
    "Mets l'autocuiseur en mode dorer et fais revenir l'oignon et la carotte 4 minutes.",
    "Ajoute les haricots égouttés, les tomates, l'aneth, les épinards et 80 ml d'eau, puis laisse cuire 5 minutes sous pression.",
    "Sers avec la feta émiettée et du pain pour saucer."
  ],
  "W25": [
    "Forme de petites boulettes avec le bœuf, le persil, le cumin et le paprika.",
    "À la poêle, fais cuire l'oignon, les tomates et les épices 8 minutes, puis ajoute les boulettes et laisse cuire encore 8 minutes.",
    "Garde la sauce et les boulettes dans les boîtes. Au réchauffage, casse les œufs dedans et couvre 5 minutes.",
    "Sers avec du pain pour saucer."
  ],
  "W26": [
    "Mets l'autocuiseur en mode dorer et fais revenir l'oignon, l'ail, le gingembre, le garam masala et le cumin 3 minutes.",
    "Ajoute les pois chiches, les tomates, les épinards et 100 ml d'eau, puis laisse cuire 6 minutes sous pression.",
    "Écrase une partie des pois chiches pour épaissir la sauce.",
    "Sers avec du yaourt. Le riz se cuit à part, à l'autocuiseur."
  ],
  "W27": [
    "Fais cuire les frites 18 minutes à l'air fryer à 200 °C.",
    "Dans la poêle très chaude, saisis le bœuf en lanières 2 minutes, puis réserve-le.",
    "Fais sauter l'oignon rouge et la tomate en quartiers 2 minutes, ajoute la sauce soja et le vinaigre, puis remets le bœuf.",
    "Mélange avec les frites juste avant de manger et sers avec le riz."
  ],
  "W28": [
    "Fais mariner le poisson 10 minutes dans le jus de citron vert.",
    "À la poêle, fais cuire l'oignon, les poivrons et les tomates 6 minutes avec le paprika.",
    "Ajoute le lait de coco, pose le poisson dessus, couvre et laisse cuire 8 minutes.",
    "Ajoute la coriandre et sers avec le riz."
  ],
  "W29": [
    "Mets l'autocuiseur en mode dorer et fais revenir beaucoup d'oignon 5 minutes avec l'ail, le gingembre et le berbéré (ou du paprika, du piment et de la cannelle).",
    "Ajoute les lentilles, les tomates, les épinards et 3 fois leur volume d'eau, puis laisse cuire 6 minutes sous pression.",
    "Fais cuire les œufs 10 minutes dans l'eau bouillante, écale-les et pose-les sur les lentilles."
  ],
  "W30": [
    "Fais mariner les crevettes avec le piment, le paprika, l'ail, le citron et l'huile.",
    "À l'autocuiseur, mets le riz, les tomates, l'oignon, le poivron et 1,2 fois le volume du riz en eau, puis laisse cuire 4 minutes sous pression.",
    "Fais cuire les crevettes 6 minutes à l'air fryer à 200 °C.",
    "Sers les crevettes sur le riz."
  ],
  "SA01": [
    "Coupe les patates douces en bâtonnets et mélange-les avec l'huile et le paprika fumé.",
    "Fais-les cuire 16 à 18 minutes à l'air fryer à 200 °C en secouant le panier."
  ],
  "SA02": [
    "Coupe les pommes de terre en cubes, mélange-les avec l'huile et fais-les cuire 18 minutes à l'air fryer à 200 °C.",
    "Prépare la sauce : yaourt, paprika fumé et ail."
  ],
  "SA03": [
    "Sèche bien les pois chiches, puis mélange-les avec l'huile et le za'atar.",
    "Fais-les cuire 14 à 15 minutes à l'air fryer à 190 °C."
  ],
  "SA04": [
    "Coupe l'aubergine en demi-lunes, quadrille la chair et badigeonne d'huile.",
    "Fais cuire 10 minutes à l'air fryer à 190 °C, laque avec le miso et le miel, puis prolonge de 4 minutes."
  ],
  "SA05": [
    "Mélange les fleurettes de brocoli avec l'huile et fais-les cuire 8 minutes à l'air fryer à 200 °C.",
    "Ajoute le parmesan, prolonge de 2 minutes et arrose de citron au moment de servir."
  ],
  "SA06": [
    "Mélange les fleurettes de chou-fleur avec l'huile, le curcuma et le cumin.",
    "Fais-les cuire 14 à 15 minutes à l'air fryer à 200 °C."
  ],
  "SA07": [
    "Coupe les carottes en bâtonnets, mélange-les avec l'huile et le cumin, puis fais-les cuire 14 minutes à l'air fryer à 190 °C.",
    "Ajoute le miel et prolonge de 2 minutes. Sers avec un yaourt à la menthe."
  ],
  "SA08": [
    "Égoutte et sèche le maïs, puis fais-le griller 10 minutes à l'air fryer à 200 °C.",
    "Mélange avec le yaourt, la feta, le piment et le citron vert."
  ],
  "SA09": [
    "Coupe les courgettes en bâtonnets, enrobe-les de yaourt, puis roule-les dans le panko mélangé au parmesan.",
    "Fais-les cuire 10 à 12 minutes à l'air fryer à 200 °C."
  ],
  "SA10": [
    "Écrase finement à la fourchette les pois chiches avec l'oignon et le persil hachés, le cumin et la farine.",
    "Forme 6 boulettes, badigeonne-les d'huile et fais-les cuire 14 minutes à l'air fryer à 190 °C."
  ],
  "SA11": [
    "Rince les frites, sèche-les bien et mélange-les avec l'huile.",
    "Fais-les cuire 18 minutes à l'air fryer à 200 °C en secouant le panier."
  ],
  "SA12": [
    "Écrase le concombre avec le plat d'un couteau, puis coupe-le en morceaux.",
    "Assaisonne et laisse reposer 10 minutes au frais."
  ],
  "C01": [
    "Au self, prends un plat avec une protéine, des féculents et des légumes.",
    "Ajoute un laitage et un fruit.",
    "Prends un morceau de pain."
  ],
  "S01": [
    "Rince le riz.",
    "À l'autocuiseur, mets 1 volume de riz pour 1,2 volume d'eau, laisse cuire 4 minutes sous pression, puis 10 minutes de repos."
  ],
  "S02": [
    "Coupe la patate douce en cubes et mélange-la avec l'huile.",
    "Fais cuire 18 minutes à l'air fryer à 180 °C en secouant le panier à mi-cuisson."
  ],
  "S03": [
    "Coupe les légumes en morceaux et mélange-les avec l'huile et le sel.",
    "Fais cuire 15 minutes à l'air fryer à 180 °C."
  ],
  "S04": [
    "Rince le quinoa.",
    "À l'autocuiseur, mets 1 volume de quinoa pour 1,5 volume d'eau et laisse cuire 1 minute sous pression, puis 10 minutes de repos."
  ],
  "EN01": [
    "À l'autocuiseur, mets l'oignon et les courgettes, couvre d'eau et laisse cuire 5 minutes sous pression.",
    "Écrase au presse-purée, ou mixe si tu as un mixeur, avec le fromage frais."
  ],
  "EN02": [
    "Râpe ou coupe les légumes.",
    "Assaisonne avec l'huile, le vinaigre et le sel."
  ],
  "K01": [
    "Mixe tous les ingrédients avec une pincée de cardamome.",
    "Sers bien frais."
  ],
  "K02": [
    "Mélange la whey dans le yaourt.",
    "Ajoute le miel et les pistaches concassées par-dessus."
  ],
  "K03": [
    "Étale le yaourt grec bien épais, arrose d'huile d'olive et saupoudre de za'atar.",
    "Réchauffe la pita 2 minutes à l'air fryer et coupe les crudités en bâtonnets."
  ],
  "K05": [
    "Dans un bocal, mélange les flocons, le lait, la whey et 1 cuillère à café de café soluble.",
    "Ajoute une couche de fromage blanc au miel, puis saupoudre de cacao.",
    "Laisse une nuit au frigo."
  ],
  "K06": [
    "Écrase la banane à la fourchette, puis mélange-la avec les flocons, l'œuf, la whey et le lait.",
    "Fais cuire de petits pancakes à la poêle, 1 minute 30 par face.",
    "Sers avec un filet de miel."
  ],
  "K07": [
    "Mixe les fruits rouges surgelés, la banane, la whey et un peu de lait pour obtenir une texture épaisse.",
    "Ajoute les flocons et le beurre de cacahuète par-dessus."
  ],
  "K08": [
    "Fais tremper les dattes 10 minutes dans de l'eau chaude, puis écrase-les à la fourchette avec le reste des ingrédients.",
    "Forme des boules, environ trois par portion."
  ],
  "K09": [
    "Mixe tous les ingrédients avec 1 cuillère à café de café soluble et quelques glaçons."
  ],
  "K10": [
    "Mélange la whey dans le skyr.",
    "Ajoute la banane en rondelles et un filet de tahini et de miel."
  ],
  "K11": [
    "À l'autocuiseur, mets le riz, le lait et le lait de coco, laisse cuire 12 minutes sous pression, puis laisse la pression retomber toute seule.",
    "Laisse tiédir, puis incorpore la whey.",
    "Ajoute la mangue en dés au moment de servir."
  ],
  "K12": [
    "Fais griller le pain 3 minutes à l'air fryer.",
    "Écrase l'avocat avec le citron vert et le piment, puis étale-le sur le pain.",
    "Ajoute les œufs brouillés ou au plat, et la tomate en dés."
  ],
  "S05": [
    "Choisis le fruit de saison le moins cher : pomme, poire, clémentines…"
  ],
  "S06": [
    "Une tranche de pain complet."
  ],
  "S08": [
    "Mets le fromage blanc dans un bol, ajoute un filet de miel et une cuillère de beurre de cacahuète."
  ],
  "S09": [
    "Coupe la banane en rondelles et ajoute une cuillère de beurre de cacahuète."
  ],
  "S11": [
    "Tartine le pain de carré frais, puis ajoute les tranches de dinde."
  ],
  "S12": [
    "Tartine le pain de carré frais, ajoute un filet de miel, du thym frais ou séché et un tour de poivre."
  ],
  "S16": [
    "Mets le skyr dans un bol et ajoute les fruits rouges, frais ou décongelés."
  ],
  "S07": [
    "Une petite poignée, soit une vingtaine d'amandes."
  ],
  "X01": [
    "Repas pris au restaurant, chez des amis ou au travail."
  ]
};
RECIPES.forEach(r => { if (STEPS[r.id]) r.steps = STEPS[r.id]; });

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
export const getMains    = () => RECIPES.filter(r => (r.category === 'dinner' || r.category === 'lunch') && !(r.tags || []).includes('cantine'));
export const getSides    = () => RECIPES.filter(r => r.category === 'side');
export const getSweets   = () => RECIPES.filter(r => r.category === 'sweet');
export const getStarters = () => RECIPES.filter(r => r.category === 'starter');
export const getById     = (id) => RECIPES.find(r => r.id === id);
export const getBatch    = () => RECIPES.filter(r => r.batch);
export const isCantine   = (r) => !!r && (r.tags || []).includes('cantine');
export const isOutside   = (r) => !!r && (r.tags || []).includes('imprevu');

// Famille de protéine principale d'une recette (pour la variété et les filtres).
// Ids alignés sur les chips de la vue Semaine : poulet · boeuf · dinde · crevettes · saumon (= poisson) · tofu (= végé)
const FAMILY = {
  poulet: 'poulet', haut_cuisse: 'poulet', boeuf_emince: 'boeuf', dinde: 'dinde', dinde_hachee: 'dinde', jambon_dinde: 'dinde', boeuf: 'boeuf',
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

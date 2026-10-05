// recipes.js — Recettes : simples, pas chères, pensées pour le batch cooking.
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
  // ══ 30 plats du monde (plaques · autocuiseur · air fryer) ══
  M("W01", "Curry de poulet à l'aubergine et au lait de coco", "dinner", "🍛", 10, 15,
    [["poulet",170],["aubergine",120],["poivron",60],["oignon",40],["ail",1],["gingembre",5],["epices",6],["lait_coco",100],["soja",10],["huile",5],["herbes",3],["riz",90]],
    ["AC mode dorer : 2 min la pâte de curry avec un fond de lait de coco.","Ajouter le poulet en dés, l'aubergine en cubes, le poivron, le reste du lait de coco et le nuoc mam.","Fermer, 8 min sous pression, dépressuriser rapidement.","Basilic thaï au moment de servir. Riz jasmin à part (casserole ou AC)."],
    "L'aubergine boit la sauce et devient fondante : encore meilleur à J+1.", ["thaï","autocuiseur","batch"], true, {"pairs":["SA12"]}),
  M("W02", "Bol de poulet à la vietnamienne", "lunch", "🥢", 15, 14,
    [["haut_cuisse",170],["riz",90],["carotte",60],["concombre",80],["salade",40],["cacahuetes",15],["ail",1],["citron_vert",20],["soja",15],["miel",8],["huile",5],["herbes",3]],
    ["Mariner le poulet : citronnelle hachée, ail, nuoc mam, miel (15 min ou la veille).","AF 200°C 12-14 min en retournant à mi-cuisson, puis trancher.","Vermicelles : 4 min dans l'eau bouillante, rincer à froid.","Sauce : nuoc mam + citron vert + 1 c.à.c miel + 3 c.à.s d'eau.","Boîtes : vermicelles, crudités, poulet, cacahuètes ; sauce dans un petit pot."],
    "Bowl froid : aucun réchauffage, parfait au bureau.", ["vietnamien","air fryer","batch","froid"], true, {"pairs":["SA03"]}),
  M("W03", "Gyudon : bœuf et oignons au soja", "dinner", "🍚", 10, 15,
    [["boeuf_emince",170],["oignon",120],["soja",20],["miel",10],["vinaigre_cidre",5],["gingembre",5],["epinards",80],["huile",3],["oeuf",1],["riz",90]],
    ["Émincer finement le bœuf (plus facile s'il est un peu congelé) et l'oignon.","Poêle : oignon + 100 ml d'eau + soja + mirin + gingembre, 6 min.","Ajouter le bœuf, 2-3 min seulement.","Œuf mollet (6 min 30) et épinards poêlés à côté. Sur le riz."],
    "Le bœuf finit de cuire au réchauffage : ne le cuis pas trop au départ.", ["japonais","poêle","batch"], true, {"pairs":["SA04"]}),
  M("W04", "Souvlaki de poulet, tzatziki & pita", "lunch", "🇬🇷", 15, 12,
    [["poulet",170],["citron",15],["epices",3],["ail",1],["huile",8],["yaourt_grec",60],["concombre",100],["tomate",100],["oignon",30],["pita",140]],
    ["Mariner le poulet en cubes : citron, origan, ail, huile (idéalement la veille).","AF 200°C 12 min, secouer à mi-cuisson.","Tzatziki : yaourt + concombre râpé essoré + ail.","Pita réchauffée 2 min à l'AF au moment de manger."],
    "Garde tzatziki et crudités à part : tout reste croquant 3 jours.", ["grec","air fryer","batch","assemblage"], true, {"pairs":["SA02","SA03","SA11"]}),
  M("W05", "Köfte, boulgour pilavı & cacık", "dinner", "🧆", 15, 15,
    [["boeuf",160],["oignon",40],["herbes",10],["epices",4],["boulghour",70],["tomates_conc",80],["concentre",10],["yaourt_grec",80],["concombre",80],["huile",5]],
    ["Mélanger bœuf, oignon râpé, persil, cumin, paprika ; former des köfte allongées.","AF 200°C 10-12 min.","Pendant ce temps, AC : boulgour revenu dans l'huile + tomates + concentré + 1,5 volume d'eau, 4 min sous pression.","Cacık : yaourt, concombre en dés, menthe séchée."],
    "Les köfte crues se congèlent à plat : sors-les la veille. Tu peux mettre 1/3 d'agneau haché pour le goût.", ["turc","air fryer","autocuiseur","batch"], true, {"pairs":["SA03","SA07","SA11"]}),
  M("W06", "Mujaddara au poulet grillé", "dinner", "🧅", 10, 25,
    [["lentilles_vertes",70],["riz",60],["oignon",120],["epices",3],["huile",10],["poulet",130],["yaourt_grec",80],["ail",1],["tomate",80],["concombre",80]],
    ["Oignons en fines lamelles + la moitié de l'huile : AF 180°C 15-18 min en remuant, jusqu'à doré.","AC : lentilles + riz + cumin + reste d'huile + 2,5 volumes d'eau, 12 min sous pression.","Yaourt à l'ail, salade tomate-concombre.","Oignons croustillants par-dessus au moment de servir."],
    "L'un des plats les moins chers de la liste (~1 €), et pourtant très gourmand.", ["libanais","végé","autocuiseur","air fryer","batch","économique"], true, {"pairs":["SA03"]}),
  M("W07", "Tajine de poulet au citron et aux olives", "dinner", "🍋", 15, 12,
    [["poulet",170],["oignon",60],["carotte",100],["courgette",100],["olives",20],["citron",20],["epices",3],["huile",5],["semoule",105]],
    ["AC mode dorer : poulet + oignon + épices (ras el hanout, curcuma, gingembre) 5 min.","Ajouter carottes, courgettes, citron confit, olives et 100 ml d'eau par portion.","12 min sous pression, dépressurisation naturelle.","Semoule à part : même volume d'eau bouillante, couvrir 5 min."],
    "Se bonifie au frigo. Semoule à part dans la boîte.", ["marocain","autocuiseur","batch"], true, {"pairs":["SA07","SA06"]}),
  M("W08", "Tinga de poulet, riz et haricots rouges", "dinner", "🌮", 10, 12,
    [["poulet",170],["tomates_conc",150],["oignon",50],["ail",1],["epices",3],["haricots_rouges",80],["mais",50],["riz",90],["yaourt_grec",60],["avocat",50],["citron_vert",10],["herbes",3]],
    ["AC : poulet entier + tomates + oignon + chipotle + ail, 10 min sous pression.","Effilocher le poulet à la fourchette directement dans la sauce, réduire 3 min en mode dorer.","Bowl : riz, haricots noirs, maïs, tinga, yaourt, citron vert, coriandre."],
    "Même base en tacos un jour, en bowl le lendemain : zéro lassitude.", ["mexicain","autocuiseur","batch"], true, {"pairs":["SA08"]}),
  M("W09", "Döner maison, sauce blanche & crudités", "lunch", "🥙", 15, 15,
    [["haut_cuisse",170],["yaourt_grec",70],["epices",4],["ail",1],["tortilla",120],["salade",40],["tomate",80],["oignon",30],["huile",8]],
    ["Mariner le poulet : moitié du yaourt + paprika, cumin, origan, ail.","AF 200°C 15 min, puis émincer finement et repasser 2 min pour griller les bords.","Sauce blanche : reste du yaourt + ail + herbes.","Au moment de manger : galette chauffée, poulet, crudités, sauce."],
    "Le haut de cuisse reste juteux au réchauffage, c'est le secret du döner.", ["turc","air fryer","batch","gourmand","assemblage"], true, {"pairs":["SA11"]}),
  M("W10", "Smash burger & frites de patate douce", "dinner", "🍔", 10, 20,
    [["boeuf",150],["pain_burger",70],["cheddar",20],["oignon",60],["cornichons",15],["yaourt_grec",30],["moutarde",5],["salade",20],["tomate",50],["patate_douce",200],["huile",5]],
    ["Frites de patate douce : bâtonnets + huile + paprika fumé, AF 200°C 18 min.","Oignons émincés caramélisés à la poêle 10 min (se préparent pour la semaine).","Steak en boule, écrasé fort dans la poêle très chaude, 2 min par face, cheddar dessus.","Sauce : yaourt + moutarde + cornichons hachés."],
    "En batch : oignons, sauce et frites précuites (réchauffées 4 min à l'AF). Le steak se cuit en 4 min au moment.", ["américain","air fryer","poêle","gourmand","assemblage"], true, {"pairs":["SA12"]}),
  M("W11", "Poulet croustillant à la coréenne", "dinner", "🍗", 15, 16,
    [["haut_cuisse",180],["fecule",12],["miel",12],["soja",15],["ketchup",15],["epices",1],["ail",1],["riz",90],["concombre",120],["vinaigre_cidre",5],["sesame",4]],
    ["Poulet en morceaux enrobé de fécule.","AF 200°C 16 min, secouer 2 fois : ça croustille sans friture.","Sauce : gochujang + miel + soja + ail, 1 min à la poêle, enrober le poulet.","Riz + concombre smashé (vinaigre de riz, huile de sésame, sésame)."],
    "Réchauffe le poulet à l'AF (4 min) plutôt qu'au micro-ondes pour retrouver le croustillant.", ["coréen","air fryer","gourmand","batch"], true, {"pairs":["SA12","SA01"]}),
  M("W12", "Katsu curry japonais", "dinner", "🍛", 15, 15,
    [["poulet",160],["chapelure",25],["oeuf",1],["riz",65],["carotte",80],["oignon",60],["pdt",50],["epices",6],["fecule",8],["miel",5],["soja",5],["huile",8]],
    ["Sauce à l'AC : oignon, carotte, pomme de terre, curry en poudre, miel, soja + 200 ml d'eau, 5 min sous pression.","Mixer ou écraser la sauce, épaissir avec la fécule délayée.","Poulet aplati, œuf battu puis panko, AF 200°C 12-14 min.","Trancher le katsu, servir sur le riz nappé de sauce."],
    "Les légumes mixés font une sauce onctueuse sans roux au beurre.", ["japonais","air fryer","autocuiseur","gourmand","batch"], true, {"pairs":["SA04"]}),
  M("W13", "Bánh mì au poulet", "lunch", "🥖", 15, 14,
    [["poulet",170],["ail",1],["citron_vert",10],["soja",10],["miel",6],["carotte",60],["vinaigre_cidre",20],["concombre",60],["yaourt_grec",40],["epices",1],["baguette",125],["herbes",3]],
    ["Pickles express : carotte en julienne + vinaigre de riz + 1 pincée de sucre, 30 min (se gardent 1 semaine).","Poulet mariné citronnelle-nuoc mam-miel, AF 200°C 12-14 min, émincé.","Mayo légère : yaourt + sriracha.","Au moment : baguette passée 2 min à l'AF, garnir."],
    "Les pickles maison font tout le goût, pour presque zéro calorie.", ["vietnamien","air fryer","gourmand","assemblage"], true, {"pairs":["SA12"]}),
  M("W14", "Butter chicken & riz complet", "dinner", "🧈", 10, 12,
    [["poulet",170],["yaourt_grec",50],["tomates_conc",150],["concentre",15],["creme",30],["oignon",50],["gingembre",5],["ail",1],["epices",6],["riz",75]],
    ["Mariner le poulet dans yaourt + garam masala (10 min ou la veille).","AC dorer : oignon, ail, gingembre, épices 3 min.","Ajouter tomates, concentré, poulet, 6 min sous pression.","Hors du feu, ajouter la crème. Riz basmati à part."],
    "30 ml de crème légère suffisent : le yaourt fait le crémeux.", ["indien","autocuiseur","gourmand","batch"], true, {"pairs":["SA06"]}),
  M("W15", "Pollo a la brasa, frites & salsa verde", "dinner", "🍗", 10, 38,
    [["haut_cuisse",200],["epices",5],["soja",5],["citron_vert",20],["ail",1],["pdt",250],["huile",6],["salade",60],["tomate",80],["herbes",15],["yaourt_grec",30]],
    ["Mariner le poulet : cumin, paprika, origan, soja, citron vert, ail.","Frites : AF 200°C 12 min, puis ajouter le poulet et cuire encore 10-12 min ensemble.","Salsa verde : coriandre ou persil mixés + yaourt + citron vert + piment.","Salade tomate à côté."],
    "Tout cuit en même temps dans l'air fryer.", ["péruvien","air fryer","gourmand","batch"], true, {"pairs":["SA05"]}),
  M("W16", "Lahmacun express sur tortilla", "lunch", "🫓", 10, 8,
    [["boeuf",140],["tortilla",120],["tomate",100],["poivron",60],["oignon",40],["concentre",15],["epices",4],["herbes",15],["citron",15],["salade",50],["huile",6]],
    ["Garniture : bœuf cru + tomate, poivron, oignon mixés finement + concentré + paprika, cumin, piment.","Étaler finement sur les tortillas.","AF 200°C 6-7 min, jusqu'à ce que les bords croustillent.","Persil, oignon, citron, rouler et manger."],
    "La garniture se prépare pour 4 jours. Cuisson minute de 6 minutes.", ["turc","air fryer","gourmand","assemblage"], true, {"pairs":["SA03","SA11"]}),
  M("W17", "Quesadillas poulet, haricots rouges et maïs", "lunch", "🧀", 10, 10,
    [["poulet",140],["tortilla",120],["haricots_rouges",80],["mais",50],["emmental",30],["poivron",60],["oignon",30],["epices",3],["tomate",80],["citron_vert",10],["yaourt_grec",40]],
    ["Poulet en dés + poivron + oignon + épices tex-mex, poêle 7 min (garniture batch).","Écraser grossièrement les haricots noirs.","Tortilla : haricots, garniture, maïs, fromage, refermer.","AF 190°C 5 min. Salsa tomate-citron vert et crème au yaourt."],
    "La garniture se garde 4 jours ; l'assemblage prend 2 min.", ["mexicain","air fryer","gourmand","assemblage"], true, {"pairs":["SA08","SA01"]}),
  M("W18", "Nouilles sautées aux crevettes, façon pad thaï", "dinner", "🍤", 15, 10,
    [["crevettes",160],["nouilles_oeufs",90],["oeuf",1],["carotte",60],["poivron",80],["soja",15],["miel",10],["citron_vert",15],["cacahuetes",15],["huile",5]],
    ["Nouilles trempées dans l'eau chaude 8 min.","Sauce : nuoc mam + miel + citron vert + soja.","Poêle très chaude : crevettes 2 min, œuf brouillé, carotte.","Nouilles + sauce 2 min, pousses de soja et cacahuètes à la fin."],
    "Version allégée : plus de légumes, moins de nouilles. Marche aussi avec du poulet.", ["thaï","poêle","gourmand","batch"], true, {"pairs":["SA12"]}),
  M("W19", "Larb de poulet, citron vert & herbes", "dinner", "🌿", 10, 8,
    [["poulet_hache",170],["riz",90],["citron_vert",20],["soja",15],["oignon",40],["epices",1],["cacahuetes",15],["concombre",100],["salade",30],["herbes",5]],
    ["Poêle sans matière grasse : poulet haché 6-7 min en émiettant.","Hors du feu : nuoc mam, citron vert, échalote, piment, menthe et coriandre.","Servir avec riz, concombre et feuilles de salade."],
    "Ultra frais, ultra rapide, et léger en gras.", ["thaï","poêle","batch","rapide"], true, {"pairs":["SA12"]}),
  M("W20", "Bibimbap au bœuf", "dinner", "🥗", 15, 12,
    [["boeuf_emince",160],["soja",20],["carotte",60],["courgette",80],["epinards",60],["huile",5],["oeuf",1],["riz",90],["miel",8],["ketchup",10],["epices",1],["sesame",3]],
    ["Mariner le bœuf : soja, ail, huile de sésame.","Poêle : chaque légume 2-3 min séparément, puis le bœuf 3 min.","Œuf au plat ou mollet au moment.","Bol : riz, légumes en secteurs, bœuf, œuf, gochujang."],
    "Légumes rangés en compartiments dans la boîte : c'est aussi beau à J+3.", ["coréen","poêle","batch"], true, {"pairs":["SA12"]}),
  M("W21", "Mapo tofu au bœuf", "dinner", "🌶️", 10, 12,
    [["tofu",120],["boeuf",100],["ail",1],["gingembre",5],["huile",5],["soja",15],["ketchup",10],["miel",6],["epices",1],["fecule",6],["brocoli",150],["riz",90]],
    ["Poêle : bœuf émietté 4 min avec ail et gingembre.","Ajouter gochujang, soja et 150 ml d'eau.","Tofu en cubes, mijoter 5 min doucement, lier avec la fécule.","Brocoli à l'AF ou vapeur, riz à part."],
    "Peu de viande, beaucoup de protéines grâce au tofu : économique et réconfortant.", ["chinois","poêle","batch"], true, {"pairs":["SA05"]}),
  M("W22", "Saumon laqué miel-soja", "dinner", "🐟", 5, 10,
    [["saumon",150],["soja",15],["miel",10],["ail",1],["gingembre",3],["fecule",3],["brocoli",150],["riz",90],["sesame",3]],
    ["Laque : miso + miel + 1 c.à.c d'eau.","Badigeonner le saumon, AF 200°C 8-10 min avec le brocoli.","Concombre mariné au vinaigre de riz et sésame.","Servir sur le riz."],
    "Poisson : à manger dans les 2 jours, placé en début de semaine.", ["japonais","air fryer","poisson","batch"], true, {"pairs":["SA04"]}),
  M("W23", "Youvetsi : bœuf & orzo à la grecque", "dinner", "🍝", 10, 45,
    [["boeuf_emince",160],["orzo",80],["tomates_conc",150],["oignon",50],["epices",3],["huile",5],["parmesan",10],["courgette",100]],
    ["AC dorer : bœuf en cubes + oignon 5 min.","Tomates, cannelle, laurier + 200 ml d'eau : 15 min sous pression.","Ajouter l'orzo, la courgette et 150 ml d'eau, 4 min sous pression.","Parmesan râpé au service."],
    "Un seul récipient pour tout. La cannelle fait toute la différence.", ["grec","autocuiseur","batch"], true, {"pairs":["SA05"]}),
  M("W24", "Gigantes : haricots blancs, tomate & feta", "dinner", "🫘", 10, 10,
    [["haricots_blancs",200],["tomates_conc",150],["oignon",50],["carotte",60],["herbes",8],["huile",8],["feta",30],["pain",80],["epinards",80]],
    ["AC dorer : oignon et carotte 4 min.","Haricots égouttés, tomates, aneth, épinards + 80 ml d'eau : 5 min sous pression.","Feta émiettée au service, pain pour saucer."],
    "Végé gourmand, économique, encore meilleur froid comme en Grèce.", ["grec","végé","autocuiseur","batch","économique"], true, {"pairs":["SA03"]}),
  M("W25", "Tajine de kefta aux œufs", "dinner", "🍳", 10, 20,
    [["boeuf",150],["oeuf",2],["tomates_conc",200],["oignon",50],["herbes",10],["epices",4],["pain",80],["huile",8]],
    ["Petites boulettes : bœuf, persil, cumin, paprika.","Poêle : oignon + tomates + épices 8 min, ajouter les boulettes, 8 min.","En batch, garder la sauce et les boulettes ; casser les œufs dedans au réchauffage (5 min, couvert).","Pain pour saucer."],
    "Les œufs se cuisent au dernier moment : tu gardes le jaune coulant.", ["marocain","poêle","batch"], true, {"pairs":["SA02","SA11"]}),
  M("W26", "Chana masala & riz basmati", "dinner", "🍛", 10, 10,
    [["pois_chiches",200],["tomates_conc",150],["oignon",60],["gingembre",5],["ail",1],["epices",6],["epinards",80],["yaourt_grec",50],["riz",60],["huile",8]],
    ["AC dorer : oignon, ail, gingembre, garam masala, cumin 3 min.","Pois chiches, tomates, épinards + 100 ml d'eau : 6 min sous pression.","Écraser une partie des pois chiches pour épaissir.","Yaourt au service, riz à part."],
    "Tout en placard et congélateur : la recette de secours en fin de semaine.", ["indien","végé","autocuiseur","batch","économique"], true, {"pairs":["SA06"]}),
  M("W27", "Lomo saltado", "dinner", "🥩", 15, 12,
    [["boeuf_emince",160],["oignon",80],["tomate",100],["soja",15],["vinaigre_cidre",10],["huile",5],["riz",90],["herbes",3]],
    ["Frites : AF 200°C 18 min.","Wok très chaud : bœuf en lanières 2 min, réserver.","Oignon rouge et tomate en quartiers 2 min, soja + vinaigre, remettre le bœuf.","Mélanger avec les frites juste avant de manger, riz à côté."],
    "Garde les frites à part dans la boîte et réchauffe-les à l'AF.", ["péruvien","poêle","air fryer","gourmand","batch"], true, {"pairs":["SA05"]}),
  M("W28", "Moqueca de colin au lait de coco", "dinner", "🥥", 10, 15,
    [["poisson_blanc",200],["citron_vert",15],["oignon",50],["poivron",100],["tomate",80],["epices",2],["lait_coco",80],["riz",90],["herbes",3]],
    ["Mariner le poisson dans le citron vert 10 min.","Poêle : oignon, poivrons, tomates 6 min, paprika.","Lait de coco, poser le poisson, couvrir 8 min.","Coriandre, riz à part."],
    "Colin surgelé = poisson abordable. À manger dans les 2 jours.", ["brésilien","poêle","poisson","batch"], true, {"pairs":["SA01"]}),
  M("W29", "Misir wot : lentilles corail épicées et œufs", "dinner", "🥚", 10, 10,
    [["lentilles_corail",90],["tomates_conc",150],["oignon",50],["ail",1],["gingembre",5],["epices",3],["epinards",60],["huile",5],["oeuf",2],["riz",70]],
    ["AC dorer : beaucoup d'oignon 5 min, ail, gingembre, berbéré (ou paprika + piment + cannelle).","Lentilles, tomates, épinards + 3 volumes d'eau : 6 min sous pression.","Œufs durs (10 min) écalés, posés dessus."],
    "Les lentilles corail fondent en purée épicée : très rassasiant pour ~1,30 €.", ["éthiopien","végé","autocuiseur","batch","économique"], true, {"pairs":["SA06"]}),
  M("W30", "Crevettes piri-piri & riz à la tomate", "dinner", "🦐", 10, 12,
    [["crevettes",170],["epices",3],["citron",15],["ail",2],["huile",8],["riz",75],["tomates_conc",100],["oignon",40],["poivron",100]],
    ["Mariner les crevettes : piment, paprika, ail, citron, huile.","AC : riz + tomates + oignon + poivron + 1,2 volume d'eau, 4 min sous pression.","Crevettes AF 200°C 6 min.","Servir les crevettes sur le riz."],
    "Crevettes cuites : 2 jours au frigo maximum.", ["mozambicain","air fryer","autocuiseur","batch"], true, {"pairs":["SA08"]}),
  M("W46", "Mac and cheese au poulet barbecue-miel", "dinner", "🧀", 10, 20,
    [["poulet",150],["pates",90],["brocoli",100],["lait",150],["fecule",6],["emmental",30],["concentre",15],["miel",8],["vinaigre_cidre",5],["soja",5],["epices",2],["huile",5]],
    ["Coupe le poulet en dés de 2 cm. Mélange le concentré de tomate, le miel, le vinaigre de cidre, la sauce soja, le paprika fumé, l'ail en poudre et 2 cuillères à soupe d'eau : c'est la sauce barbecue.","Fais cuire le poulet 6 à 7 minutes à la poêle avec l'huile, jusqu'à ce qu'il ne soit plus rose au centre. Verse la sauce barbecue et laisse réduire 2 minutes en remuant, pour bien enrober chaque morceau. Réserve-le dans une assiette.","Fais cuire les pâtes à l'autocuiseur : couvre-les d'eau juste à hauteur avec une pincée de sel, pose le brocoli par-dessus, et fais-les cuire sous pression la moitié du temps indiqué sur le paquet, arrondi en dessous (5 minutes pour des pâtes complètes à 10 ou 11 minutes). Fais tomber la pression et égoutte.","Dans la poêle rincée, délaye la fécule dans le lait froid, puis fais chauffer à feu moyen en remuant sans arrêt, 3 à 4 minutes, jusqu'à ce que la sauce nappe la cuillère. Hors du feu, ajoute l'emmental et remue jusqu'à ce qu'il fonde.","Mélange les pâtes et le brocoli à la sauce au fromage, puis dispose le poulet barbecue par-dessus.","Mise en boîtes : le mac and cheese avec le poulet par-dessus, au frigo dès qu'il a tiédi.","Au moment de manger : réchauffe 3 minutes au micro-ondes avec 2 cuillères à soupe de lait, en remuant à mi-temps, jusqu'à ce que ce soit bien chaud partout."],
    "Une cuillère de lait au réchauffage rend la sauce aussi crémeuse que le premier jour.", ["américain","gourmand","autocuiseur","poêle","batch"], true),
  M("W47", "Pâtes crémeuses à la feta et aux tomates cerises, crevettes", "dinner", "🍝", 10, 15,
    [["crevettes",150],["pates",90],["tomates_cerise",200],["feta",40],["epinards",60],["ail",1],["huile",8],["citron",10],["epices",1]],
    ["La veille, mets les crevettes à décongeler au frigo. Égoutte-les et sèche-les bien dans un torchon.","Dans la poêle, fais chauffer l'huile d'olive à feu moyen. Ajoute les tomates cerises entières et l'ail écrasé, couvre et laisse cuire 8 minutes, jusqu'à ce que les tomates éclatent.","Ajoute la feta émiettée, écrase les tomates et la feta à la fourchette et mélange 1 minute : la sauce devient crémeuse.","Ajoute les crevettes, les épinards et l'origan, et laisse cuire 3 minutes, jusqu'à ce que les crevettes soient bien roses. Arrose de jus de citron.","Fais cuire les pâtes à l'autocuiseur : couvre-les d'eau juste à hauteur avec une pincée de sel, et fais-les cuire sous pression la moitié du temps indiqué sur le paquet, arrondi en dessous (5 minutes pour des pâtes complètes à 10 ou 11 minutes). Fais tomber la pression et égoutte, en gardant 3 cuillères à soupe d'eau de cuisson par portion. Mélange-les à la sauce avec l'eau de cuisson gardée.","Mise en boîtes : les pâtes aux crevettes, au frigo dès qu'elles ont tiédi. Avec des crevettes, elles se gardent 2 jours.","Au moment de manger : réchauffe 2 minutes 30 au micro-ondes à puissance moyenne avec 2 cuillères à soupe d'eau, en remuant à mi-temps, sans trop chauffer pour que les crevettes restent tendres."],
    "La feta fond dans le jus des tomates : pas besoin de crème pour une sauce onctueuse.", ["méditerranéen","gourmand","poêle","autocuiseur","batch"], true),
  M("W48", "Pâtes façon lasagne au cottage cheese", "dinner", "🍅", 10, 15,
    [["boeuf",150],["pates",90],["tomates_conc",200],["concentre",15],["oignon",50],["carotte",50],["ail",1],["epices",2],["cottage",100],["emmental",20],["huile",3]],
    ["Hache l'oignon, râpe finement la carotte et écrase l'ail.","Dans l'autocuiseur en mode dorer, fais revenir l'oignon et la carotte 3 minutes dans l'huile, puis ajoute le bœuf et fais-le dorer 4 minutes en l'émiettant avec une spatule.","Ajoute l'ail, l'origan, le concentré, les tomates, les pâtes et juste assez d'eau pour les couvrir à hauteur, avec une pincée de sel. Mélange bien et gratte le fond, pour qu'aucune pâte n'y colle.","Ferme et fais cuire sous pression la moitié du temps indiqué sur le paquet, arrondi en dessous (5 minutes pour des pâtes complètes à 10 ou 11 minutes), puis fais tomber la pression.","Hors du feu, ajoute le cottage cheese et l'emmental, et mélange doucement : ils remplacent la béchamel et donnent le goût des lasagnes.","Mise en boîtes : les pâtes, au frigo dès qu'elles ont tiédi.","Au moment de manger : réchauffe 3 minutes au micro-ondes avec 2 cuillères à soupe d'eau, en remuant à mi-temps, jusqu'à ce que ce soit bien chaud partout."],
    "Tout cuit dans la même cuve : les pâtes absorbent la sauce et le goût de la viande.", ["italien","gourmand","autocuiseur","batch"], true),
  M("W49", "Bouchées de saumon croustillantes, grenailles et sauce yaourt", "dinner", "🐟", 15, 28,
    [["saumon",140],["pdt",250],["haricots_verts",100],["fecule",5],["huile",8],["epices",2],["yaourt_grec",80],["herbes",5],["citron",10],["ail",1]],
    ["Coupe les pommes de terre en deux avec la peau, sèche-les dans un torchon et mélange-les avec 5 ml d'huile et une pincée de sel. Fais-les cuire 18 à 20 minutes à l'air fryer à 200 °C, en secouant le panier à mi-cuisson.","Retire la peau du saumon et coupe-le en cubes de 3 cm. Mélange-les avec le reste de l'huile, la fécule, le paprika, l'ail en poudre et une pincée de sel.","Fais cuire les bouchées 7 à 8 minutes à l'air fryer à 200 °C, en secouant à mi-cuisson : elles doivent être dorées dehors et juste nacrées au centre.","Pendant ce temps, fais cuire les haricots verts 6 minutes à la poêle avec un fond d'eau, à couvert, puis laisse l'eau s'évaporer.","Prépare la sauce : le yaourt, l'aneth et la ciboulette ciselés, le jus de citron, une demi-gousse d'ail écrasée, du sel et du poivre.","Mise en boîtes : le saumon, les pommes de terre et les haricots ensemble, la sauce dans un petit pot. Le saumon se garde 2 jours au frigo.","Au moment de manger : réchauffe 4 minutes à l'air fryer à 180 °C pour que tout redevienne croustillant, ou 2 minutes au micro-ondes. Ajoute la sauce froide."],
    "La fécule donne une croûte fine qui reste croustillante au réchauffage à l'air fryer.", ["scandinave","air fryer","batch","poisson"], true),
  M("W50", "Poulet miel-moutarde à la crème, pommes de terre et carottes rôties", "dinner", "🍯", 10, 22,
    [["poulet",160],["pdt",250],["carotte",120],["moutarde",15],["miel",10],["creme",20],["ail",1],["huile",8],["epices",1],["citron",5]],
    ["Coupe les pommes de terre en cubes de 2 cm avec la peau et les carottes en bâtonnets. Mélange-les avec 5 ml d'huile, le thym et une pincée de sel, et fais-les cuire 20 minutes à l'air fryer à 200 °C, en secouant le panier toutes les 7 minutes.","Mélange la moutarde, le miel, l'ail écrasé, le jus de citron et 2 cuillères à soupe d'eau.","Coupe le poulet en morceaux de 3 cm et fais-le cuire 6 à 7 minutes à la poêle avec le reste de l'huile, jusqu'à ce qu'il soit doré et plus rose au centre.","Verse la sauce miel-moutarde dans la poêle et laisse-la réduire 2 minutes en remuant. Hors du feu, ajoute la crème fraîche et mélange : la sauce devient onctueuse et nappe le poulet.","Mise en boîtes : le poulet avec sa sauce sur les pommes de terre et les carottes.","Au moment de manger : réchauffe 3 minutes au micro-ondes en remuant à mi-temps, ou 5 minutes à l'air fryer à 180 °C, jusqu'à ce que ce soit bien chaud partout."],
    "Une moutarde à l'ancienne donne une sauce encore plus gourmande.", ["américain","air fryer","poêle","batch"], true),
  M("W51", "Pommes de terre farcies façon lasagne", "dinner", "🥔", 15, 50,
    [["pdt",350],["boeuf",140],["tomates_conc",150],["concentre",10],["oignon",40],["ail",1],["epices",2],["cottage",80],["emmental",20],["salade",40],["huile",3]],
    ["Lave les pommes de terre, pique-les plusieurs fois à la fourchette et frotte-les avec un peu d'huile et de sel. Fais-les cuire 40 à 45 minutes à l'air fryer à 200 °C, en les retournant à mi-cuisson, jusqu'à ce qu'une lame s'enfonce sans résistance.","Pendant ce temps, hache l'oignon et fais-le revenir 3 minutes à la poêle avec le reste de l'huile. Ajoute le bœuf et fais-le dorer 4 minutes en l'émiettant, puis l'ail écrasé, l'origan, le concentré et les tomates. Laisse mijoter 8 minutes.","Coupe les pommes de terre en deux dans la longueur et écrase un peu la chair à la fourchette. Garnis-les de bolognaise, puis de cottage cheese et d'emmental.","Remets-les 4 minutes à l'air fryer à 200 °C pour faire fondre et dorer le fromage.","Mise en boîtes : les pommes de terre farcies, la salade à part.","Au moment de manger : réchauffe 3 minutes au micro-ondes, ou 6 minutes à l'air fryer à 180 °C pour retrouver le gratiné. Sers avec la salade."],
    "Choisis de grosses pommes de terre de même taille : elles cuisent en même temps.", ["américain","gourmand","air fryer","poêle","batch"], true),
  M("W52", "Bowl elote : crevettes, maïs grillé, quinoa et feta", "lunch", "🌽", 15, 15,
    [["crevettes",150],["quinoa",70],["mais",100],["tomates_cerise",80],["feta",30],["avocat",40],["oignon",20],["herbes",3],["yaourt_grec",40],["citron_vert",15],["epices",2],["huile",5]],
    ["La veille, mets les crevettes à décongeler au frigo. Égoutte-les et sèche-les bien dans un torchon.","Rince le quinoa dans une passoire fine, puis mets-le dans l'autocuiseur avec 1,7 fois son poids d'eau et une pincée de sel. Ferme, laisse cuire 1 minute sous pression, puis laisse la pression retomber seule pendant 10 minutes. Égrène-le à la fourchette.","Égoutte le maïs, sèche-le et fais-le griller 5 à 6 minutes à la poêle bien chaude, sans matière grasse, jusqu'à ce qu'il noircisse par endroits. Réserve-le.","Dans la même poêle, fais cuire les crevettes 3 minutes avec l'huile, le paprika fumé et une pincée de piment, jusqu'à ce qu'elles soient bien roses.","Prépare la sauce : le yaourt, la moitié du jus de citron vert, une pincée de paprika et de sel. Coupe les tomates cerises en deux et l'oignon rouge en fines lamelles.","Mise en boîtes : le quinoa, le maïs, les tomates et les crevettes ensemble ; la feta émiettée, la coriandre et la sauce à part. Avec des crevettes, il se garde 2 jours.","Au moment de manger : froid, ou réchauffé 1 minute 30 au micro-ondes. Ajoute l'avocat coupé en dés, la feta, la coriandre, la sauce et le reste du citron vert."],
    "Le maïs doit vraiment noircir à la poêle : c'est ce goût grillé qui fait l'elote.", ["mexicain","poêle","autocuiseur","batch","froid"], true),
  M("W53", "Salade dense aux haricots, boulgour, feta et concombre", "lunch", "🥗", 15, 9,
    [["haricots_blancs",150],["pois_chiches",100],["boulghour",50],["feta",40],["concombre",100],["tomates_cerise",100],["oignon",20],["herbes",5],["citron",15],["huile",10],["epices",1]],
    ["Fais cuire le boulgour à l'autocuiseur avec 1,5 fois son volume d'eau et une pincée de sel : 4 minutes sous pression, puis 5 minutes de décompression naturelle. Égrène-le à la fourchette. Laisse-le refroidir.","Rince et égoutte les haricots blancs et les pois chiches. Coupe le concombre et les tomates cerises en petits dés, et hache finement l'oignon rouge, le persil et la menthe.","Prépare la sauce : l'huile d'olive, le jus de citron, l'origan, du sel et du poivre.","Mélange le boulgour froid, les haricots, les pois chiches, les légumes, les herbes et la sauce, puis ajoute la feta émiettée.","Mise en boîtes : la salade toute prête, au frigo. Elle se garde 4 jours et devient même meilleure le lendemain.","Au moment de manger : sors-la du frigo 10 minutes avant, et mélange-la bien."],
    "« Dense » parce que chaque bouchée est pleine : beaucoup de légumineuses, peu de feuilles.", ["méditerranéen","végé","autocuiseur","batch","froid"], true),
  M("W54", "Aubergines laquées soja-miel, tofu croustillant et quinoa", "dinner", "🍆", 15, 20,
    [["tofu",180],["aubergine",200],["quinoa",70],["fecule",8],["soja",20],["miel",10],["ail",1],["gingembre",5],["sesame",5],["huile",10]],
    ["Égoutte le tofu, presse-le 10 minutes entre deux torchons sous une casserole, puis coupe-le en cubes de 2 cm. Mélange-les avec la fécule et la moitié de l'huile, et fais-les cuire 14 à 15 minutes à l'air fryer à 200 °C, en secouant à mi-cuisson, jusqu'à ce qu'ils soient bien dorés.","Coupe l'aubergine en cubes de 2 cm, mélange-les avec le reste de l'huile et fais-les cuire 15 minutes à l'air fryer à 200 °C, en secouant à mi-cuisson, jusqu'à ce qu'elles soient fondantes.","Rince le quinoa dans une passoire fine, puis mets-le dans l'autocuiseur avec 1,7 fois son poids d'eau et une pincée de sel. Ferme, laisse cuire 1 minute sous pression, puis laisse la pression retomber seule pendant 10 minutes. Égrène-le à la fourchette.","Dans la poêle, mélange la sauce soja, le miel, l'ail écrasé, le gingembre râpé et 3 cuillères à soupe d'eau. Fais réduire 2 minutes à feu moyen, jusqu'à ce que la sauce soit sirupeuse.","Ajoute l'aubergine et le tofu, et remue 1 minute pour bien les laquer. Parsème de graines de sésame.","Mise en boîtes : le quinoa et les aubergines laquées au tofu ensemble.","Au moment de manger : réchauffe 3 minutes au micro-ondes, ou 5 minutes à l'air fryer à 180 °C pour que le tofu redevienne croustillant."],
    "Bien presser le tofu, c'est le secret d'une croûte croustillante.", ["asiatique","végé","air fryer","autocuiseur","batch"], true),
  M("W55", "Wrap plié croustillant au thon, cheddar et avocat", "lunch", "🌯", 15, 6,
    [["thon",120],["tortilla",120],["cheddar",30],["yaourt_grec",40],["moutarde",5],["mais",50],["oignon",15],["tomate",60],["salade",30],["avocat",50],["epices",1]],
    ["Mélange le thon égoutté avec le yaourt, la moutarde, du sel et du poivre. Égoutte le maïs, coupe la tomate en fines rondelles et l'oignon rouge en lamelles.","Mise en boîtes : la garniture au thon, le maïs avec l'oignon, la tomate et la salade dans des boîtes séparées, les wraps et le cheddar à part. Le thon se garde 3 jours au frigo.","Au moment de manger, pose un wrap à plat et fais une entaille du centre jusqu'au bord, vers le bas. Garnis chaque quart : le thon en haut à gauche, le cheddar et l'avocat en tranches en haut à droite, le maïs et l'oignon en bas à droite, la tomate et la salade en bas à gauche.","Replie le quart du bas à gauche sur celui du haut, puis continue dans le sens des aiguilles d'une montre, jusqu'à obtenir un triangle.","Fais-le dorer 2 à 3 minutes par face à la poêle sans matière grasse, en appuyant avec une spatule, jusqu'à ce que le cheddar fonde."],
    "Le pliage en triangle garde chaque garniture à sa place : chaque bouchée a un goût différent.", ["américain","poêle","batch","assemblage"], true),
  M("W56", "Pâtes crémeuses épicées au poulet, sauce tomate-sriracha", "dinner", "🌶️", 10, 18,
    [["poulet",150],["pates",90],["oignon",40],["ail",1],["concentre",20],["sriracha",15],["miel",5],["soja",10],["creme",25],["parmesan",10],["huile",5]],
    ["Coupe le poulet en dés de 2 cm et fais-le cuire 6 à 7 minutes à la poêle avec l'huile, jusqu'à ce qu'il ne soit plus rose au centre. Réserve-le.","Dans la même poêle, fais revenir l'oignon haché 3 minutes, puis l'ail écrasé 1 minute.","Ajoute le concentré de tomate, la sriracha, le miel, la sauce soja et 100 ml d'eau par portion. Laisse mijoter 3 minutes, jusqu'à ce que la sauce épaississe.","Fais cuire les pâtes à l'autocuiseur : couvre-les d'eau juste à hauteur avec une pincée de sel, et fais-les cuire sous pression la moitié du temps indiqué sur le paquet, arrondi en dessous (5 minutes pour des pâtes complètes à 10 ou 11 minutes). Fais tomber la pression et égoutte, en gardant 3 cuillères à soupe d'eau de cuisson par portion.","Hors du feu, ajoute la crème fraîche, le parmesan et l'eau de cuisson gardée à la sauce, puis les pâtes et le poulet. Mélange bien : la sauce devient orange et onctueuse.","Mise en boîtes : les pâtes, au frigo dès qu'elles ont tiédi.","Au moment de manger : réchauffe 3 minutes au micro-ondes avec 2 cuillères à soupe d'eau, en remuant à mi-temps, jusqu'à ce que ce soit bien chaud partout."],
    "Ajuste la sriracha à ton goût : la crème adoucit beaucoup le piquant.", ["coréen","gourmand","poêle","autocuiseur","batch"], true),
  M("W57", "Pâtes cajun au poulet et aux poivrons", "dinner", "🔥", 10, 18,
    [["poulet",150],["pates",90],["poivron",80],["oignon",40],["ail",1],["epices",4],["tomates_conc",100],["lait",100],["fecule",4],["emmental",25],["huile",5]],
    ["Coupe le poulet en dés de 2 cm et mélange-les avec les épices cajun : paprika fumé, ail en poudre, origan, thym, une pincée de piment et de sel.","Fais cuire le poulet 6 à 7 minutes à la poêle avec l'huile. Ajoute le poivron en lanières et l'oignon émincé, et laisse cuire 4 minutes de plus.","Ajoute l'ail écrasé et les tomates, et laisse mijoter 3 minutes. Délaye la fécule dans le lait froid, verse-le dans la poêle et remue 2 minutes, jusqu'à ce que la sauce épaississe. Hors du feu, ajoute l'emmental.","Fais cuire les pâtes à l'autocuiseur : couvre-les d'eau juste à hauteur avec une pincée de sel, et fais-les cuire sous pression la moitié du temps indiqué sur le paquet, arrondi en dessous (5 minutes pour des pâtes complètes à 10 ou 11 minutes). Fais tomber la pression et égoutte, en gardant 3 cuillères à soupe d'eau de cuisson par portion. Mélange-les à la sauce avec l'eau de cuisson gardée.","Mise en boîtes : les pâtes cajun, au frigo dès qu'elles ont tiédi.","Au moment de manger : réchauffe 3 minutes au micro-ondes avec 2 cuillères à soupe d'eau, en remuant à mi-temps, jusqu'à ce que ce soit bien chaud partout."],
    "Le paprika fumé fait tout le goût cajun : n'hésite pas sur la dose.", ["cajun","gourmand","poêle","autocuiseur","batch"], true),
  M("W58", "Pâtes fajitas au poulet, sauce cheddar", "dinner", "🫑", 10, 18,
    [["poulet",150],["pates",90],["poivron",120],["oignon",60],["epices",4],["concentre",15],["lait",80],["cheddar",30],["citron_vert",10],["huile",5]],
    ["Coupe le poulet en lanières et mélange-les avec les épices : paprika, cumin, origan, ail en poudre et une pincée de sel.","Fais cuire le poulet 5 minutes à la poêle bien chaude avec l'huile, puis ajoute les poivrons et l'oignon en lanières et laisse cuire 5 minutes à feu vif, jusqu'à ce qu'ils soient dorés par endroits mais encore croquants.","Ajoute le concentré de tomate et le lait, et remue 2 minutes. Hors du feu, ajoute le cheddar en morceaux et remue jusqu'à ce qu'il fonde, puis le jus de citron vert.","Fais cuire les pâtes à l'autocuiseur : couvre-les d'eau juste à hauteur avec une pincée de sel, et fais-les cuire sous pression la moitié du temps indiqué sur le paquet, arrondi en dessous (5 minutes pour des pâtes complètes à 10 ou 11 minutes). Fais tomber la pression et égoutte, en gardant 3 cuillères à soupe d'eau de cuisson par portion. Mélange-les à la sauce avec l'eau de cuisson gardée.","Mise en boîtes : les pâtes fajitas, au frigo dès qu'elles ont tiédi.","Au moment de manger : réchauffe 3 minutes au micro-ondes avec 2 cuillères à soupe d'eau, en remuant à mi-temps, jusqu'à ce que ce soit bien chaud partout."],
    "Les poivrons doivent griller à feu vif : c'est ce goût un peu brûlé qui rappelle les fajitas.", ["mexicain","gourmand","poêle","autocuiseur","batch"], true),
  M("W59", "Pâtes au poulet, pesto et tomates cerises", "dinner", "🌿", 10, 15,
    [["poulet",150],["pates",90],["pesto",20],["yaourt_grec",40],["tomates_cerise",150],["epinards",50],["ail",1],["parmesan",10],["huile",3]],
    ["Coupe le poulet en dés de 2 cm et fais-le cuire 6 à 7 minutes à la poêle avec l'huile, jusqu'à ce qu'il soit doré.","Ajoute les tomates cerises coupées en deux, l'ail écrasé et les épinards, et laisse cuire 3 minutes, jusqu'à ce que les tomates commencent à fondre.","Fais cuire les pâtes à l'autocuiseur : couvre-les d'eau juste à hauteur avec une pincée de sel, et fais-les cuire sous pression la moitié du temps indiqué sur le paquet, arrondi en dessous (5 minutes pour des pâtes complètes à 10 ou 11 minutes). Fais tomber la pression et égoutte, en gardant 3 cuillères à soupe d'eau de cuisson par portion.","Hors du feu, mélange le pesto, le yaourt et l'eau de cuisson gardée, puis ajoute les pâtes, le poulet et les tomates. Le yaourt rend le pesto crémeux, sans crème.","Mise en boîtes : les pâtes, avec le parmesan dans un petit pot.","Au moment de manger : réchauffe 3 minutes au micro-ondes à puissance moyenne avec 2 cuillères à soupe d'eau, en remuant à mi-temps. Ajoute le parmesan."],
    "Ajoute le pesto hors du feu : chauffé, le basilic perd sa couleur et son parfum.", ["italien","poêle","autocuiseur","batch"], true),
  M("W60", "Paprikás de poulet sur nouilles aux œufs", "dinner", "🇭🇺", 10, 20,
    [["haut_cuisse",170],["nouilles_oeufs",90],["poivron",150],["oignon",80],["ail",1],["epices",6],["tomates_conc",100],["yaourt_grec",60],["huile",5]],
    ["Coupe le poulet en morceaux de 3 cm, l'oignon et les poivrons en lanières.","Dans l'autocuiseur en mode dorer, fais revenir l'oignon 4 minutes dans l'huile, jusqu'à ce qu'il soit fondant. Ajoute le poulet et fais-le colorer 3 minutes.","Arrête le mode dorer, ajoute l'ail et le paprika doux, et mélange 30 secondes : hors du feu, le paprika ne brûle pas. Ajoute les poivrons, les tomates, 100 ml d'eau par portion et une pincée de sel.","Ferme et laisse cuire 8 minutes sous pression, puis fais tomber la pression. Laisse réduire 3 minutes en mode dorer si la sauce est trop liquide.","Fais cuire les nouilles aux œufs à l'autocuiseur : couvre-les d'eau juste à hauteur avec une pincée de sel, et fais-les cuire sous pression la moitié du temps indiqué sur le paquet, arrondi en dessous. Fais tomber la pression et égoutte.","Hors du feu, quand le paprikás a un peu tiédi, ajoute le yaourt et mélange : il remplace la crème aigre hongroise.","Mise en boîtes : les nouilles, avec le paprikás par-dessus.","Au moment de manger : réchauffe 3 minutes au micro-ondes avec 2 cuillères à soupe d'eau, en remuant à mi-temps, jusqu'à ce que ce soit bien chaud partout."],
    "Le paprika doit être doux et généreux : c'est lui qui donne la couleur et le goût.", ["hongrois","autocuiseur","batch"], true),
  M("W61", "Stroganoff de bœuf haché aux champignons, nouilles aux œufs", "dinner", "🍄", 10, 18,
    [["boeuf",150],["champignons",150],["oignon",60],["ail",1],["moutarde",10],["epices",2],["soja",5],["creme",25],["yaourt_grec",40],["nouilles_oeufs",90],["huile",5]],
    ["Émince l'oignon et les champignons.","Fais revenir l'oignon 3 minutes à la poêle avec l'huile, puis ajoute le bœuf et fais-le dorer 4 minutes en l'émiettant.","Ajoute les champignons et laisse cuire 5 minutes, jusqu'à ce qu'ils aient rendu leur eau et qu'elle se soit évaporée. Ajoute l'ail écrasé, le paprika, la moutarde, la sauce soja et 80 ml d'eau par portion, et laisse mijoter 3 minutes.","Hors du feu, ajoute la crème et le yaourt, et mélange : la sauce devient crémeuse.","Fais cuire les nouilles aux œufs à l'autocuiseur : couvre-les d'eau juste à hauteur avec une pincée de sel, et fais-les cuire sous pression la moitié du temps indiqué sur le paquet, arrondi en dessous. Fais tomber la pression et égoutte.","Mise en boîtes : les nouilles, avec le stroganoff par-dessus.","Au moment de manger : réchauffe 3 minutes au micro-ondes avec 2 cuillères à soupe d'eau, en remuant à mi-temps, jusqu'à ce que ce soit bien chaud partout."],
    "Laisse bien dorer les champignons avant d'ajouter la sauce : c'est là que se fait le goût.", ["russe","poêle","autocuiseur","batch"], true),
  M("W62", "Penne sauce tomate crémeuse et boulettes de bœuf", "dinner", "🍝", 15, 18,
    [["boeuf",150],["parmesan",15],["oignon",40],["ail",1],["epices",2],["tomates_conc",200],["concentre",15],["creme",20],["pates",90],["huile",5]],
    ["Mélange le bœuf avec la moitié du parmesan, un quart de l'oignon râpé, l'origan et une pincée de sel. Forme des boulettes de la taille d'une noix.","Fais-les cuire 9 à 10 minutes à l'air fryer à 200 °C, en secouant le panier à mi-cuisson.","Pendant ce temps, fais revenir le reste de l'oignon haché 3 minutes à la poêle avec l'huile, puis l'ail 1 minute. Ajoute le concentré, les tomates et une pincée de piment, et laisse mijoter 8 minutes.","Hors du feu, ajoute la crème : la sauce devient rose et onctueuse, comme une sauce « alla vodka », sans vodka. Ajoute les boulettes.","Fais cuire les pâtes à l'autocuiseur : couvre-les d'eau juste à hauteur avec une pincée de sel, et fais-les cuire sous pression la moitié du temps indiqué sur le paquet, arrondi en dessous (5 minutes pour des pâtes complètes à 10 ou 11 minutes). Fais tomber la pression et égoutte, en gardant 3 cuillères à soupe d'eau de cuisson par portion. Mélange-les à la sauce avec l'eau de cuisson gardée.","Mise en boîtes : les penne et les boulettes, le reste du parmesan dans un petit pot.","Au moment de manger : réchauffe 3 minutes au micro-ondes avec 2 cuillères à soupe d'eau, en remuant à mi-temps. Ajoute le parmesan."],
    "Les boulettes cuites à l'air fryer restent bien rondes et ne rendent pas de gras dans la sauce.", ["italien","gourmand","air fryer","poêle","autocuiseur","batch"], true),
  M("W63", "Poulet crémeux aux champignons, purée et haricots verts", "dinner", "🥘", 15, 20,
    [["poulet",160],["champignons",150],["oignon",40],["ail",1],["moutarde",5],["creme",25],["herbes",2],["pdt",300],["lait",60],["haricots_verts",120],["huile",5]],
    ["Épluche les pommes de terre, coupe-les en gros morceaux et mets-les dans l'autocuiseur avec 250 ml d'eau et une pincée de sel. Ferme et laisse cuire 8 minutes sous pression, puis fais tomber la pression.","Égoutte-les et écrase-les à la fourchette ou au presse-purée avec le lait chaud, du sel et du poivre.","Coupe le poulet en morceaux et fais-le cuire 6 minutes à la poêle avec l'huile. Ajoute l'oignon haché et les champignons émincés, et laisse cuire 5 minutes, jusqu'à ce qu'ils soient dorés.","Ajoute l'ail, le thym, la moutarde et 60 ml d'eau par portion, laisse mijoter 2 minutes, puis ajoute la crème hors du feu.","Fais cuire les haricots verts 6 minutes dans la poêle rincée avec un fond d'eau, à couvert.","Mise en boîtes : la purée, le poulet aux champignons et les haricots verts.","Au moment de manger : réchauffe 3 minutes au micro-ondes avec 2 cuillères à soupe d'eau, en remuant à mi-temps, jusqu'à ce que ce soit bien chaud partout."],
    "Un peu d'eau ou de lait au réchauffage, et la purée redevient aussi souple que le premier jour.", ["français","autocuiseur","poêle","batch"], true),
  M("W64", "Poulet à l'ail et aux herbes, grenailles et courgettes rôties", "dinner", "🧄", 10, 25,
    [["haut_cuisse",170],["pdt",250],["courgette",150],["ail",2],["herbes",5],["citron",10],["epices",1],["huile",10]],
    ["Coupe les pommes de terre en deux avec la peau et la courgette en demi-rondelles épaisses. Mélange-les avec la moitié de l'huile, les herbes de Provence et une pincée de sel.","Fais cuire les pommes de terre 12 minutes à l'air fryer à 200 °C, puis ajoute la courgette et prolonge de 10 minutes, en secouant le panier à mi-cuisson.","Pendant ce temps, fais cuire le poulet en morceaux 8 minutes à la poêle avec le reste de l'huile, jusqu'à ce qu'il soit bien doré.","Baisse le feu, ajoute l'ail écrasé, le persil haché et le jus de citron, et remue 1 minute sans laisser brûler l'ail.","Mise en boîtes : le poulet sur les pommes de terre et les courgettes.","Au moment de manger : réchauffe 5 minutes à l'air fryer à 180 °C pour retrouver le croustillant, ou 3 minutes au micro-ondes."],
    "Ajoute l'ail en fin de cuisson seulement : il parfume sans brûler.", ["français","air fryer","poêle","batch"], true),
  M("W65", "Bowl de poulet buffalo, pommes de terre et sauce yaourt", "dinner", "🍗", 15, 22,
    [["poulet",160],["pdt",250],["sriracha",15],["vinaigre_cidre",5],["miel",3],["huile",8],["epices",2],["yaourt_grec",80],["herbes",3],["ail",1],["carotte",60],["concombre",60]],
    ["Coupe les pommes de terre en cubes de 2 cm avec la peau, mélange-les avec 5 ml d'huile, le paprika et une pincée de sel, et fais-les cuire 20 minutes à l'air fryer à 200 °C, en secouant toutes les 7 minutes.","Coupe le poulet en morceaux de 3 cm et fais-le cuire 6 à 7 minutes à la poêle avec le reste de l'huile.","Mélange la sriracha, le vinaigre de cidre et le miel, verse sur le poulet et remue 1 minute : c'est la sauce buffalo, piquante et acidulée.","Prépare la sauce : le yaourt, la ciboulette ciselée, une demi-gousse d'ail écrasée, du sel et du poivre. Coupe la carotte et le concombre en bâtonnets.","Mise en boîtes : les pommes de terre et le poulet buffalo ensemble, les bâtonnets et la sauce à part.","Au moment de manger : réchauffe le poulet et les pommes de terre 4 minutes à l'air fryer à 180 °C, ou 3 minutes au micro-ondes. Ajoute la sauce froide et les bâtonnets."],
    "La sauce au yaourt bien froide calme le piquant du buffalo.", ["américain","air fryer","poêle","batch"], true),
  M("W66", "Poêlée de bœuf, pommes de terre et poivrons, œuf au plat", "dinner", "🍳", 10, 22,
    [["boeuf",150],["pdt",250],["poivron",120],["oignon",60],["ail",1],["epices",3],["oeuf",1],["herbes",2],["huile",8]],
    ["Coupe les pommes de terre en dés de 1,5 cm avec la peau, mélange-les avec 5 ml d'huile et une pincée de sel, et fais-les cuire 18 minutes à l'air fryer à 200 °C, en secouant toutes les 6 minutes.","Pendant ce temps, fais revenir l'oignon et les poivrons en dés 5 minutes à la poêle avec le reste de l'huile. Ajoute le bœuf et fais-le dorer 5 minutes en l'émiettant, avec l'ail, le paprika fumé, le cumin et une pincée de sel.","Ajoute les pommes de terre croustillantes et mélange 1 minute, puis le persil haché.","Mise en boîtes : la poêlée, au frigo dès qu'elle a tiédi.","Au moment de manger : réchauffe la poêlée 5 minutes à la poêle à feu moyen, ou 3 minutes au micro-ondes. Pendant ce temps, fais cuire l'œuf au plat 3 minutes à la poêle et pose-le dessus : le jaune coulant fait la sauce."],
    "L'œuf se cuit au dernier moment : 3 minutes, et le plat devient un vrai brunch.", ["américain","air fryer","poêle","batch"], true),
  M("W67", "Picadillo de bœuf aux pommes de terre", "dinner", "🇨🇺", 10, 20,
    [["boeuf",150],["pdt",200],["tomates_conc",150],["concentre",10],["oignon",50],["poivron",60],["ail",1],["olives",20],["epices",2],["vinaigre_cidre",5],["huile",5]],
    ["Épluche les pommes de terre et coupe-les en dés de 1,5 cm. Hache l'oignon et le poivron, coupe les olives en rondelles.","Dans l'autocuiseur en mode dorer, fais revenir l'oignon et le poivron 3 minutes dans l'huile, puis ajoute le bœuf et fais-le dorer 4 minutes en l'émiettant.","Ajoute l'ail, le cumin, l'origan, le concentré, les tomates, les pommes de terre, les olives, le vinaigre et 60 ml d'eau par portion. Mélange.","Ferme et laisse cuire 5 minutes sous pression, puis fais tomber la pression. Les pommes de terre doivent être tendres mais garder leur forme.","Mise en boîtes : le picadillo, au frigo dès qu'il a tiédi.","Au moment de manger : réchauffe 3 minutes au micro-ondes avec 2 cuillères à soupe d'eau, en remuant à mi-temps, jusqu'à ce que ce soit bien chaud partout."],
    "Les olives et le vinaigre donnent ce petit goût aigre-doux typique de Cuba.", ["cubain","autocuiseur","batch"], true),
  M("W68", "Keema aloo : bœuf haché, pommes de terre et petits pois", "dinner", "🍛", 10, 20,
    [["boeuf",150],["pdt",200],["petits_pois",80],["oignon",60],["ail",1],["gingembre",5],["tomates_conc",120],["epices",5],["yaourt_grec",40],["herbes",3],["huile",5]],
    ["Épluche les pommes de terre et coupe-les en dés de 1,5 cm. Hache l'oignon, écrase l'ail et râpe le gingembre.","Dans l'autocuiseur en mode dorer, fais revenir l'oignon 4 minutes dans l'huile, puis l'ail, le gingembre, le garam masala, le cumin, le curcuma et une pincée de piment 1 minute.","Ajoute le bœuf et fais-le dorer 4 minutes en l'émiettant, puis les tomates, les pommes de terre et 80 ml d'eau par portion.","Ferme et laisse cuire 5 minutes sous pression, puis fais tomber la pression. Ajoute les petits pois et laisse-les cuire 3 minutes en mode dorer.","Mise en boîtes : le keema, le yaourt et la coriandre dans un petit pot.","Au moment de manger : réchauffe 3 minutes au micro-ondes avec 2 cuillères à soupe d'eau, en remuant à mi-temps. Ajoute le yaourt froid et la coriandre."],
    "Encore meilleur le lendemain : les épices ont le temps de se marier.", ["indien","autocuiseur","batch"], true),
  M("W69", "Bowl de poulet à la marocaine, semoule et chou-fleur rôti", "dinner", "🥙", 15, 20,
    [["poulet",160],["semoule",80],["chou_fleur",150],["pois_chiches",60],["oignon",30],["epices",4],["miel",3],["citron",10],["yaourt_grec",50],["herbes",3],["huile",8]],
    ["Coupe le poulet en morceaux de 3 cm et mélange-les avec la moitié des épices (cumin, paprika, cannelle, gingembre en poudre), le miel, la moitié de l'huile et une pincée de sel.","Mélange le chou-fleur et les pois chiches égouttés avec le reste des épices et de l'huile. Fais-les cuire 15 minutes à l'air fryer à 200 °C, en secouant à mi-cuisson, puis réserve.","Fais cuire le poulet 12 à 14 minutes à l'air fryer à 200 °C, en secouant à mi-cuisson, jusqu'à ce qu'il soit doré.","Verse la semoule dans un saladier avec le même volume d'eau bouillante, une pincée de sel et un filet de jus de citron. Couvre 5 minutes, puis égrène-la à la fourchette.","Prépare la sauce : le yaourt, la menthe ciselée, le reste du citron et une pincée de sel. Émince l'oignon rouge très finement.","Mise en boîtes : la semoule, le poulet, le chou-fleur et les pois chiches ensemble ; la sauce et l'oignon à part.","Au moment de manger : réchauffe 3 minutes au micro-ondes avec 1 cuillère à soupe d'eau. Ajoute la sauce et l'oignon."],
    "Le chou-fleur rôti aux épices devient presque sucré : c'est lui la vedette du bowl.", ["marocain","air fryer","batch"], true),
  M("W70", "Poulet shawarma, boulgour et sauce tahini", "dinner", "🌯", 15, 20,
    [["poulet",160],["boulghour",75],["epices",4],["citron",15],["ail",1],["huile",8],["tahini",15],["yaourt_grec",40],["tomate",80],["concombre",80],["oignon",20],["herbes",3]],
    ["Coupe le poulet en lanières et mélange-les avec le cumin, le paprika, une pincée de cannelle et de curcuma, la moitié du citron, l'ail écrasé, l'huile et une pincée de sel. Laisse mariner 15 minutes, ou toute la nuit au frigo.","Fais-le cuire 12 à 14 minutes à l'air fryer à 200 °C, en secouant à mi-cuisson, jusqu'à ce que les bords soient bien grillés.","Fais cuire le boulgour à l'autocuiseur avec 1,5 fois son volume d'eau et une pincée de sel : 4 minutes sous pression, puis 5 minutes de décompression naturelle. Égrène-le à la fourchette.","Prépare la sauce : le tahini, le yaourt, le reste du citron, 2 cuillères à soupe d'eau et une pincée de sel, bien mélangés jusqu'à ce que ce soit lisse.","Coupe la tomate et le concombre en dés, l'oignon rouge en fines lamelles, et hache le persil.","Mise en boîtes : le boulgour et le poulet ensemble, les crudités et la sauce à part.","Au moment de manger : réchauffe le boulgour et le poulet 3 minutes au micro-ondes. Ajoute les crudités et la sauce tahini."],
    "La sauce tahini épaissit au frigo : détends-la avec une cuillère d'eau.", ["libanais","air fryer","autocuiseur","batch"], true),
  M("W71", "Poêlée épicée de bœuf et quinoa, haricots rouges et maïs", "dinner", "🌶️", 10, 18,
    [["boeuf",150],["quinoa",70],["haricots_rouges",80],["mais",60],["poivron",80],["oignon",40],["ail",1],["tomates_conc",100],["epices",4],["citron_vert",10],["herbes",3],["huile",5]],
    ["Rince le quinoa dans une passoire fine, puis mets-le dans l'autocuiseur avec 1,7 fois son poids d'eau et une pincée de sel. Ferme, laisse cuire 1 minute sous pression, puis laisse la pression retomber seule pendant 10 minutes. Égrène-le à la fourchette.","Fais revenir l'oignon et le poivron en dés 4 minutes à la poêle avec l'huile. Ajoute le bœuf et fais-le dorer 5 minutes en l'émiettant.","Ajoute l'ail, le cumin, le paprika fumé, une pincée de piment, les tomates, les haricots rouges rincés et le maïs égoutté. Laisse mijoter 5 minutes.","Ajoute le quinoa et mélange, puis le jus de citron vert et la coriandre hachée.","Mise en boîtes : la poêlée, au frigo dès qu'elle a tiédi.","Au moment de manger : réchauffe 3 minutes au micro-ondes avec 2 cuillères à soupe d'eau, en remuant à mi-temps, jusqu'à ce que ce soit bien chaud partout."],
    "Tout le chili dans une seule poêle, avec le quinoa qui boit la sauce.", ["mexicain","poêle","autocuiseur","batch"], true),
  M("W72", "Curry de poulet aux pois chiches et naans au fromage", "dinner", "🫓", 20, 25,
    [["poulet",150],["pois_chiches",80],["oignon",50],["ail",1],["gingembre",5],["epices",5],["tomates_conc",150],["epinards",50],["yaourt_grec",100],["farine",70],["levure",2],["emmental",20],["huile",5]],
    ["Pâte à naans : mélange la farine, la levure, une pincée de sel et la moitié du yaourt, puis pétris 2 minutes jusqu'à obtenir une boule souple. Laisse reposer 15 minutes sous un torchon.","Pendant ce temps, fais revenir l'oignon haché 4 minutes à la poêle avec l'huile, puis l'ail, le gingembre, le garam masala, le curry et le curcuma 1 minute.","Ajoute le poulet en dés et fais-le colorer 3 minutes, puis les tomates, les pois chiches égouttés et 60 ml d'eau par portion. Laisse mijoter 10 minutes, ajoute les épinards 2 minutes, puis, hors du feu, le reste du yaourt.","Partage la pâte en deux par portion, aplatis chaque morceau, pose l'emmental au centre, referme et aplatis de nouveau en galette de 5 mm.","Fais cuire les naans 2 minutes par face dans la poêle rincée, sans matière grasse, à feu moyen, jusqu'à ce qu'ils gonflent et dorent par endroits.","Mise en boîtes : le curry, les naans emballés à part.","Au moment de manger : réchauffe le curry 3 minutes au micro-ondes en remuant à mi-temps, et les naans 2 minutes à l'air fryer à 180 °C."],
    "La pâte farine-yaourt ne demande ni levure de boulanger ni four : les naans gonflent à la poêle.", ["indien","gourmand","poêle","batch"], true),
  M("W73", "Burritos de bœuf miel et paprika fumé", "dinner", "🌯", 20, 20,
    [["boeuf",150],["haricots_rouges",100],["oignon",40],["poivron",60],["concentre",15],["miel",6],["epices",4],["cheddar",25],["tortilla",120],["yaourt_grec",30],["huile",3]],
    ["Fais revenir l'oignon et le poivron en dés 4 minutes à la poêle avec l'huile, puis ajoute le bœuf et fais-le dorer 5 minutes en l'émiettant.","Ajoute le paprika fumé, le cumin, l'ail en poudre, le concentré, le miel, les haricots rouges rincés et 50 ml d'eau par portion. Laisse réduire 3 minutes, jusqu'à ce que ce soit bien enrobé.","Sur chaque wrap, dépose la garniture au bœuf et aux haricots, puis le cheddar. Replie les côtés, puis roule bien serré.","Fais dorer les burritos 2 minutes par face à la poêle sans matière grasse, côté soudure en premier pour qu'ils restent fermés.","Mise en boîtes : les burritos emballés un par un dans du film ou du papier aluminium, le yaourt dans un petit pot. Ils se congèlent très bien.","Au moment de manger : réchauffe 2 minutes au micro-ondes, puis 3 minutes à l'air fryer à 200 °C pour qu'ils redeviennent croustillants. Si le burrito sort du congélateur, laisse-le décongeler une nuit au frigo. Trempe dans le yaourt."],
    "Bien serrés et dorés côté soudure, les burritos ne s'ouvrent pas au réchauffage.", ["mexicain","gourmand","poêle","batch"], true),
  M("W74", "Philly cheesesteak : bœuf, poivrons et cheddar fondu", "dinner", "🥖", 15, 12,
    [["boeuf_emince",150],["baguette",130],["poivron",100],["oignon",80],["champignons",60],["cheddar",30],["soja",5],["epices",1],["huile",5]],
    ["Mets le bœuf 30 minutes au congélateur, puis taille-le en tranches très fines : il se coupe beaucoup plus facilement à moitié congelé.","Fais revenir l'oignon, le poivron et les champignons émincés 8 minutes à la poêle avec l'huile, jusqu'à ce qu'ils soient fondants et dorés.","Monte le feu, ajoute le bœuf, la sauce soja et du poivre, et fais-le sauter 2 minutes seulement, pour qu'il reste tendre.","Mise en boîtes : la garniture au bœuf, le cheddar et la baguette à part.","Au moment de manger : réchauffe la garniture 2 minutes à la poêle, pose le cheddar dessus et couvre 1 minute pour qu'il fonde. Pendant ce temps, ouvre la baguette et fais-la griller 3 minutes à l'air fryer à 200 °C. Garnis-la."],
    "Le bœuf ne doit sauter que 2 minutes : trop cuit, il devient sec.", ["américain","gourmand","poêle","batch","assemblage"], true),
  M("W75", "Mafé de bœuf, sauce cacahuète et tomate", "dinner", "🥜", 15, 30,
    [["boeuf_emince",160],["beurre_cacahuete",25],["oignon",60],["ail",1],["gingembre",5],["concentre",15],["tomates_conc",120],["carotte",80],["patate_douce",100],["epices",2],["riz",90],["huile",5]],
    ["Coupe le bœuf en cubes de 3 cm, la carotte en rondelles épaisses et la patate douce en gros cubes. Hache l'oignon, écrase l'ail et râpe le gingembre.","Dans l'autocuiseur en mode dorer, fais dorer le bœuf 4 minutes dans l'huile, puis ajoute l'oignon 3 minutes, l'ail et le gingembre 1 minute.","Délaye le beurre de cacahuète et le concentré dans 150 ml d'eau chaude par portion. Verse-les dans la cuve avec les tomates, la carotte, la patate douce, une pincée de piment et de sel.","Ferme et laisse cuire 25 minutes sous pression, puis laisse la pression retomber seule. La viande doit être fondante et la sauce épaisse ; laisse réduire quelques minutes en mode dorer si besoin.","Riz : rince-le à l'eau froide, puis mets-le dans l'autocuiseur avec 1,7 fois son poids d'eau (par exemple 150 ml d'eau pour 90 g de riz). Ferme, laisse cuire 20 minutes sous pression, puis laisse la pression retomber seule pendant 10 minutes avant d'ouvrir. Mets-le en boîtes dès qu'il a tiédi : le riz cuit ne doit pas rester plus d'une heure à température ambiante.","Mise en boîtes : le riz et le mafé à part ou ensemble. Il se congèle très bien.","Au moment de manger : réchauffe 3 minutes au micro-ondes avec 2 cuillères à soupe d'eau, en remuant à mi-temps, jusqu'à ce que ce soit bien chaud partout."],
    "Un beurre de cacahuète sans sucre ajouté donne le vrai goût du mafé.", ["sénégalais","autocuiseur","batch"], true),

  // ══ Accompagnements air fryer ══
  M("SA01", "Frites de patate douce au paprika fumé", "side", "🍠", 5, 18,
    [["patate_douce",200],["huile",5],["epices",2]],
    ["Bâtonnets, huile, paprika fumé.","AF 200°C 16-18 min en secouant."],
    "Les sécher avec un torchon avant : plus croustillant.", ["air fryer","accompagnement"], true),
  M("SA02", "Patatas bravas au yaourt-paprika", "side", "🥔", 5, 18,
    [["pdt",200],["huile",5],["yaourt_grec",40],["epices",2],["ail",1]],
    ["Cubes de pomme de terre + huile, AF 200°C 18 min.","Sauce : yaourt, paprika fumé, ail."],
    "", ["air fryer","accompagnement"], true),
  M("SA03", "Pois chiches croustillants au za'atar", "side", "🫘", 2, 15,
    [["pois_chiches",120],["huile",4],["epices",3]],
    ["Pois chiches bien séchés + huile + za'atar.","AF 190°C 14-15 min."],
    "Se grignotent aussi en collation salée.", ["air fryer","accompagnement"], true),
  M("SA04", "Aubergine rôtie au miso", "side", "🍆", 5, 14,
    [["aubergine",200],["miso",10],["miel",5],["sesame",3],["huile",4]],
    ["Aubergine en demi-lunes quadrillées, huile.","AF 190°C 10 min, laquer miso-miel, encore 4 min."],
    "", ["air fryer","accompagnement","japonais"], true),
  M("SA05", "Brocoli rôti parmesan-citron", "side", "🥦", 3, 10,
    [["brocoli",200],["parmesan",10],["citron",10],["huile",4]],
    ["Fleurettes + huile, AF 200°C 8 min.","Parmesan, 2 min de plus, citron au service."],
    "", ["air fryer","accompagnement"], true),
  M("SA06", "Chou-fleur rôti curcuma-cumin", "side", "🥬", 3, 15,
    [["chou_fleur",200],["huile",5],["epices",3]],
    ["Fleurettes + huile + curcuma + cumin.","AF 200°C 14-15 min."],
    "", ["air fryer","accompagnement","indien"], true),
  M("SA07", "Carottes rôties miel-cumin, yaourt menthe", "side", "🥕", 5, 16,
    [["carotte",200],["miel",6],["epices",2],["huile",4],["yaourt_grec",50],["herbes",3]],
    ["Carottes en bâtonnets + huile + cumin, AF 190°C 14 min.","Miel, 2 min. Yaourt à la menthe à côté."],
    "", ["air fryer","accompagnement","marocain"], true),
  M("SA08", "Elote : maïs grillé, feta & citron vert", "side", "🌽", 3, 10,
    [["mais",150],["feta",15],["citron_vert",10],["epices",1],["yaourt_grec",20]],
    ["Maïs égoutté et séché, AF 200°C 10 min.","Yaourt, feta, piment, citron vert."],
    "", ["air fryer","accompagnement","mexicain"], true),
  M("SA09", "Frites de courgette panko-parmesan", "side", "🥒", 8, 12,
    [["courgette",200],["panko",20],["parmesan",10],["yaourt_grec",20]],
    ["Bâtonnets enrobés de yaourt, puis panko + parmesan.","AF 200°C 10-12 min."],
    "", ["air fryer","accompagnement"], true),
  M("SA10", "Falafels à l'air fryer", "side", "🧆", 10, 14,
    [["pois_chiches",150],["oignon",30],["herbes",10],["epices",4],["farine",10],["huile",4]],
    ["Mixer pois chiches, oignon, persil, cumin, farine.","Former 6 boulettes, huiler, AF 190°C 14 min."],
    "Se congèlent crus.", ["air fryer","accompagnement","végé"], true),
  M("SA11", "Frites maison à l'air fryer", "side", "🍟", 5, 18,
    [["pdt",250],["huile",5],["epices",1]],
    ["Frites rincées et bien séchées + huile.","AF 200°C 18 min en secouant."],
    "", ["air fryer","accompagnement"], true),
  M("SA12", "Concombre smashé à la coréenne", "side", "🥒", 5, 0,
    [["concombre",200],["vinaigre_riz",10],["soja",5],["sesame",3],["huile_sesame",3],["ail",1]],
    ["Écraser le concombre au plat du couteau, couper.","Assaisonner, 10 min au frais."],
    "Sans cuisson, se garde 2 jours.", ["accompagnement","0-cuisson","coréen"], true),
  M("W31", "Raviolis croustillants au poulet", "dinner", "🥟", 25, 16,
    [["poulet_hache",180],["feuille_riz",64],["courgette",100],["carotte",50],["gingembre",5],["ail",1],["soja",15],["huile",5],["citron_vert",10],["riz",90]],
    ["Voir les étapes détaillées."],
    "Croustillants sans friture : la double feuille de riz dore à l'air fryer.", ["asiatique","air fryer","batch"], true),
  M("W32", "Bol « hot honey », bœuf épicé et patate douce", "dinner", "🍯", 10, 20,
    [["boeuf",150],["patate_douce",300],["fromage_blanc",100],["miel",10],["epices",3],["citron_vert",10],["huile",5],["herbes",3]],
    ["Voir les étapes détaillées."],
    "Sucré, piquant et frais : le fromage blanc froid sur le bœuf chaud fait tout.", ["américain","air fryer","batch"], true),
  M("W33", "Pâtes crémeuses au poulet, épinards et tomates séchées", "dinner", "🍝", 10, 12,
    [["pates",100],["poulet",150],["fromage_blanc",120],["parmesan",15],["epinards",80],["tomates_sechees",25],["ail",1],["huile",5],["epices",1]],
    ["Voir les étapes détaillées."],
    "Une sauce crémeuse sans crème : le fromage blanc ne doit jamais bouillir.", ["italien","autocuiseur","batch"], true),
  M("W34", "Boulettes de bœuf laquées miel-ail-soja", "dinner", "🧆", 15, 12,
    [["boeuf",170],["fecule",8],["ail",2],["gingembre",4],["soja",20],["miel",12],["vinaigre_cidre",5],["sesame",4],["riz",90],["concombre",120]],
    ["Voir les étapes détaillées."],
    "La laque se fait en 1 minute à la poêle, juste avant d'enrober les boulettes.", ["asiatique","air fryer","batch"], true),
  M("W35", "Tasty crousty healthy", "dinner", "🍗", 15, 14,
    [["poulet",180],["cornflakes",30],["yaourt_grec",70],["epices",3],["huile",5],["riz",90],["mayo_allegee",15],["soja",3],["sauce_chili",12],["sriracha",6],["oignons_frits",10]],
    ["Voir les étapes détaillées."],
    "Le croustillant vient des corn-flakes écrasés, sans friture.", ["fast-food","air fryer","batch"], true),
  M("W36", "Fajitas de poulet", "dinner", "🌯", 15, 9,
    [["poulet",160],["poivron",100],["oignon",60],["epices",3],["huile",5],["citron_vert",10],["tortilla",120],["yaourt_grec",60],["tomate",80],["salade",30],["emmental",20]],
    ["Voir les étapes détaillées."],
    "Les poivrons doivent rester un peu croquants.", ["mexicain","poêle","batch"], true),
  M("W37", "Riz sauté au poulet et à l'œuf", "dinner", "🍳", 15, 12,
    [["poulet",150],["riz",90],["oeuf",1],["petits_pois",60],["carotte",50],["oignon",30],["ail",1],["soja",20],["huile",5],["sesame",2]],
    ["Voir les étapes détaillées."],
    "Le riz doit être froid et un peu sec pour sauter sans coller.", ["asiatique","poêle","batch"], true),
  M("W38", "Bœuf sauté aux poivrons", "dinner", "🫑", 15, 8,
    [["boeuf_emince",160],["poivron",120],["oignon",60],["ail",1],["gingembre",5],["soja",20],["miel",8],["fecule",5],["huile",5],["riz",90]],
    ["Voir les étapes détaillées."],
    "La fécule dans la marinade garde le bœuf tendre.", ["asiatique","poêle","batch"], true),
  M("W39", "Pâtes bolognaise aux légumes", "dinner", "🍝", 10, 20,
    [["boeuf",150],["pates",100],["carotte",60],["courgette",80],["oignon",50],["ail",1],["tomates_conc",200],["concentre",15],["epices",2],["huile",5],["parmesan",15]],
    ["Voir les étapes détaillées."],
    "Les légumes râpés fondent dans la sauce.", ["italien","autocuiseur","batch"], true),
  M("W40", "Kefta libanaises, houmous et taboulé", "dinner", "🥙", 20, 12,
    [["boeuf",160],["oignon",30],["herbes",10],["epices",3],["boulghour",70],["tomate",80],["concombre",80],["citron",15],["huile",5],["houmous",50]],
    ["Voir les étapes détaillées."],
    "Le taboulé se fait avec le boulgour bien refroidi.", ["libanais","air fryer","batch"], true),
  M("W41", "Gnocchis poêlés au poulet, tomates cerises et épinards", "dinner", "🥔", 10, 18,
    [["poulet",150],["gnocchis",200],["tomates_cerise",120],["epinards",80],["ail",1],["huile",10],["parmesan",15],["epices",1]],
    ["Voir les étapes détaillées."],
    "Les gnocchis dorent directement à la poêle, sans les faire bouillir.", ["italien","poêle","batch"], true),
  M("W42", "Nuggets maison et potatoes, sauce barbecue", "dinner", "🍟", 20, 34,
    [["poulet",180],["cornflakes",30],["yaourt_grec",30],["epices",3],["pdt",250],["huile",8],["ketchup",20],["miel",6],["vinaigre_cidre",5],["soja",5],["carotte",30],["concombre",30]],
    ["Voir les étapes détaillées."],
    "Nuggets et potatoes dorent l'un après l'autre à l'air fryer.", ["fast-food","air fryer","batch"], true),
  M("W43", "Bowl kebab", "dinner", "🥙", 15, 22,
    [["haut_cuisse",170],["epices",4],["yaourt_grec",90],["huile",5],["riz",90],["ail",1],["herbes",2],["salade",40],["tomate",80],["oignon",20],["oignons_frits",10]],
    ["Voir les étapes détaillées."],
    "Émincé puis regrillé 2 minutes, le poulet a le goût de la broche.", ["turc","air fryer","batch"], true),
  M("W44", "Curry de colin au lait de coco et aux épinards", "dinner", "🐟", 10, 16,
    [["poisson_blanc",200],["lait_coco",80],["epinards",80],["tomates_conc",100],["oignon",50],["ail",1],["gingembre",5],["epices",5],["huile",5],["citron_vert",10],["riz",90]],
    ["Voir les étapes détaillées."],
    "Le poisson cuit posé dans la sauce, sans remuer, pour rester en beaux morceaux.", ["indien","poêle","batch"], true),
  M("W45", "Pâtes au thon, tomates et olives", "dinner", "🍝", 10, 15,
    [["thon",140],["pates",100],["tomates_conc",200],["olives",20],["oignon",40],["ail",1],["huile",5],["epices",1],["parmesan",10]],
    ["Voir les étapes détaillées."],
    "Le thon s'ajoute à la fin, pour garder de beaux morceaux.", ["italien","poêle","batch"], true),

  // ══ Cantine, collations, compléments, entrées ══
  M("C01", "Repas cantine (estimation)", "lunch", "🍱", 0, 0,
    [["feculents_cuits",200],["boeuf",120],["legumes_mix",150],["pain",40],["fromage_blanc",100],["fruit_saison",150]],
    ["Prendre au self : 1 plat protéiné + féculents + légumes.","Ajouter un laitage et un fruit.","Pain : 1 morceau."],
    "Estimation moyenne d'un plateau cantine équilibré. Non compté dans les courses.", ["cantine","fixe"], false),
  M("S01", "Riz nature", "side", "🍚", 2, 12,
    [["riz",80]],
    ["Rincer le riz.","2× volume d'eau, 12 min à couvert."],
    "La base. Cuis-en beaucoup d'un coup pour la semaine.", ["féculents","batch"], true),
  M("S02", "Patates douces rôties", "side", "🍠", 3, 18,
    [["patate_douce",200],["huile",5]],
    ["Cubes de patate douce + huile.","Air fryer 180°C 18 min, secouer à mi-cuisson."],
    "Croustillant dehors, fondant dedans. Top à l'air fryer.", ["air fryer","féculents","batch"], true),
  M("S03", "Légumes rôtis", "side", "🥦", 5, 15,
    [["courgette",100],["poivron",100],["oignon",50],["huile",8]],
    ["Légumes en morceaux + huile + sel.","Air fryer 180°C 15 min."],
    "Une fournée pour la semaine, à ajouter dans tous tes bowls.", ["air fryer","légumes","batch","léger"], true),
  M("S04", "Quinoa", "side", "🌾", 2, 12,
    [["quinoa",80]],
    ["Rincer.","2× volume d'eau, 12 min."],
    "Plus de protéines que le riz. Parfait froid en salade.", ["féculents","batch"], true),
  M("EN01", "Velouté de courgettes", "starter", "🥣", 8, 15,
    [["courgette",300],["fromage_frais",40],["oignon",50]],
    ["Oignon + courgettes à la casserole, couvrir d'eau, 15 min.","Mixer avec le fromage frais."],
    "Se congèle très bien. Fais-en une grande casserole.", ["entrée","soupe","batch","léger"], true),
  M("EN02", "Salade de crudités", "starter", "🥗", 8, 0,
    [["carotte",80],["concombre",100],["tomates_cerise",80],["huile",4]],
    ["Râper/couper les légumes.","Huile + vinaigre + sel."],
    "L'entrée fraîcheur zéro effort.", ["entrée","0-cuisson","léger","salade"], false),

  // ══ Petits-déjeuners (formule classique) ══
  M("B01", "Overnight oats cacao-banane à la whey", "breakfast", "🥣", 3, 0,
    [["flocons",60],["lait",200],["whey",25],["banane",100],["cacao",6],["beurre_cacahuete",10]],
    ["Pendant la session de cuisine, prépare un bocal par matin : mélange les flocons, le cacao, la whey et le lait jusqu'à ce qu'il n'y ait plus de grumeaux.","Ferme les bocaux et range-les au frigo. Ils se gardent 3 jours.","Le matin, ajoute la banane coupée en rondelles et le beurre de cacahuète."],
    "", ["sucré","sans cuisson","whey","frigo-3"], true),
  M("B02", "Overnight oats pomme-cannelle au fromage blanc", "breakfast", "🍎", 4, 0,
    [["flocons",60],["fromage_blanc",210],["lait",100],["pomme",120],["miel",10],["epices",1],["amandes",15]],
    ["Pendant la session de cuisine, prépare un bocal par matin : mélange les flocons, le fromage blanc, le lait, le miel et la cannelle.","Ajoute la pomme coupée en petits dés, sans l'éplucher, puis ferme.","Range les bocaux au frigo. Ils se gardent 3 jours.","Le matin, ajoute les amandes concassées : ajoutées au dernier moment, elles restent croquantes."],
    "", ["sucré","sans cuisson","frigo-3"], true),
  M("B05", "Fromage blanc, granola et fruits rouges", "breakfast", "🫐", 2, 0,
    [["fromage_blanc",250],["granola",45],["fruits_rouges",100],["miel",8]],
    ["Pendant la session de cuisine, fais chauffer les fruits rouges surgelés 2 minutes à la poêle, jusqu'à ce qu'ils frémissent, puis laisse-les refroidir et range-les au frigo : c'est la recommandation sanitaire pour les petits fruits surgelés mangés sans cuisson. Ils se gardent 3 jours.","Le matin, verse le fromage blanc dans un bol et ajoute les fruits rouges, le granola et le miel."],
    "", ["sucré","sans cuisson","frigo-3"], true),
  M("B12", "Tartines beurre de cacahuète et banane", "breakfast", "🍌", 3, 0,
    [["pain",80],["beurre_cacahuete",20],["banane",100],["lait",250]],
    ["Fais griller le pain 2 minutes à l'air fryer à 180 °C, ou mange-le tel quel.","Tartine le beurre de cacahuète et ajoute la banane coupée en rondelles.","Accompagne d'un grand verre de lait (250 ml)."],
    "", ["sucré","sans cuisson"], false),
  M("B13", "Fromage blanc à la whey, flocons et fruits", "breakfast", "🥄", 2, 0,
    [["fromage_blanc",200],["whey",20],["flocons",40],["fruits_rouges",100],["miel",8]],
    ["Pendant la session de cuisine, fais chauffer les fruits rouges surgelés 2 minutes à la poêle, jusqu'à ce qu'ils frémissent, puis laisse-les refroidir et range-les au frigo : c'est la recommandation sanitaire pour les petits fruits surgelés mangés sans cuisson. Ils se gardent 3 jours.","Le matin, mélange la whey dans le fromage blanc jusqu'à ce qu'il n'y ait plus de grumeaux.","Ajoute les flocons, les fruits rouges et le miel."],
    "", ["sucré","sans cuisson","whey","frigo-3"], true),
  M("B06", "Muffins aux œufs, épinards et feta", "breakfast", "🧁", 10, 14,
    [["oeuf",3],["epinards",60],["poivron",50],["feta",30],["fruit_saison",150]],
    ["Pendant la session de cuisine, fais décongeler les épinards 2 minutes à la poêle, puis presse-les pour retirer l'eau. Coupe le poivron en petits dés.","Bats les œufs avec une pincée de sel, puis ajoute les épinards, le poivron et la feta émiettée.","Verse dans des moules à muffins en silicone (3 muffins par portion) et fais cuire 12 à 14 minutes à l'air fryer à 160 °C, jusqu'à ce qu'ils soient pris au centre.","Laisse refroidir et range-les en boîte au frigo : ils se gardent 4 jours. Le matin, réchauffe-les 2 minutes à l'air fryer à 160 °C.","Accompagne-les d'un fruit de saison."],
    "", ["salé","air fryer","frigo-4"], true),
  M("B07", "Wrap poulet et carré frais", "breakfast", "🌯", 2, 0,
    [["tortilla",60],["carre_frais",50],["poulet_tranches",80],["concombre",60]],
    ["Tartine le wrap de carré frais.","Ajoute les tranches de blanc de poulet et le concombre en bâtonnets, puis roule."],
    "", ["salé","sans cuisson"], false),
  M("B10", "Tartines houmous et œufs au plat", "breakfast", "🥚", 2, 5,
    [["pain",80],["houmous",40],["oeuf",2],["huile",3],["tomate",80]],
    ["Fais cuire les œufs au plat dans la poêle huilée, 4 minutes à feu moyen.","Pendant ce temps, tartine le pain de houmous.","Pose les œufs dessus et ajoute la tomate en rondelles."],
    "", ["salé","poêle"], false),
  M("B14", "Tartines carré frais, poulet et concombre", "breakfast", "🥪", 3, 0,
    [["pain",80],["carre_frais",50],["poulet_tranches",80],["concombre",80]],
    ["Tartine le pain de carré frais.","Ajoute les tranches de blanc de poulet et le concombre en fines rondelles, avec un tour de poivre."],
    "", ["salé","sans cuisson"], false),
  M("B15", "Œufs brouillés et tartines", "breakfast", "🍳", 2, 4,
    [["oeuf",3],["huile",3],["emmental",20],["pain",80],["tomate",80],["fruit_saison",150]],
    ["Bats les œufs avec une pincée de sel et de poivre.","Fais-les cuire 3 minutes à feu doux dans la poêle huilée, en remuant sans arrêt avec une spatule. Ajoute l'emmental râpé hors du feu et mélange : il fond dans les œufs, qui restent crémeux.","Sers avec le pain, la tomate coupée en rondelles et un fruit de saison."],
    "", ["salé","poêle"], false),
  M("B16", "Porridge banane-cannelle à la whey", "breakfast", "🥣", 1, 4,
    [["flocons",60],["lait",250],["whey",20],["banane",100],["epices",1],["miel",8],["amandes",15]],
    ["Dans une petite casserole, porte le lait à frémissement avec les flocons et la cannelle, puis laisse cuire 3 à 4 minutes à feu doux en remuant, jusqu'à ce que ce soit crémeux. Au micro-ondes : 2 minutes dans un grand bol, en remuant à mi-temps.","Hors du feu, mélange la whey en remuant bien.","Ajoute la banane en rondelles, le miel et les amandes concassées."],
    "", ["sucré","chaud","whey"], false),

  // ══ Collations (whey) ══
  M("K01", "Lassi mangue protéiné", "sweet", "🥭", 3, 0,
    [["yaourt_grec",200],["mangue",150],["whey",25],["lait",100],["epices",1]],
    ["Tout mixer avec une pincée de cardamome.","Servir bien frais."],
    "Mangue surgelée = texture de milkshake, sans glaçons.", ["indien","sucré","rapide","whey"], false),
  M("K02", "Yaourt grec miel-pistache", "sweet", "🍯", 2, 0,
    [["yaourt_grec",200],["whey",15],["miel",10],["pistaches",15]],
    ["Mélanger la whey dans le yaourt.","Miel et pistaches concassées dessus."],
    "Le dessert grec de base, version protéinée.", ["grec","sucré","rapide","whey"], false),
  M("K03", "Labneh za'atar, pita & crudités", "sweet", "🫓", 4, 2,
    [["yaourt_grec",150],["huile",5],["epices",2],["pita",70],["concombre",80],["tomate",80]],
    ["Yaourt grec bien épais étalé, huile d'olive, za'atar.","Pita réchauffée 2 min à l'air fryer, crudités en bâtonnets."],
    "La collation salée du Levant, à tremper.", ["libanais","salé","rapide"], false),
  M("K05", "Overnight oats tiramisu", "sweet", "☕", 4, 0,
    [["flocons",40],["lait",120],["whey",20],["fromage_blanc",100],["cacao",3],["miel",8]],
    ["Flocons + lait + whey + 1 c.à.c de café soluble, en bocal.","Couche de fromage blanc au miel, cacao en poudre.","Une nuit au frigo."],
    "À préparer la veille au soir : 4 minutes, et il est prêt le lendemain.", ["italien","sucré","whey"], false),
  M("K06", "Pancakes protéinés à la banane", "sweet", "🥞", 5, 8,
    [["flocons",40],["banane",100],["oeuf",1],["whey",20],["lait",50],["miel",8]],
    ["Mixer flocons, banane, œuf, whey, lait.","Petits pancakes à la poêle, 1 min 30 par face.","Miel ou sirop d'érable au service."],
    "Se congèlent : 1 min au grille-pain ou à l'air fryer.", ["américain","sucré","whey"], true),
  M("K07", "Bowl açaí-style fruits rouges", "sweet", "🫐", 4, 0,
    [["fruits_rouges",150],["banane",80],["whey",25],["lait",80],["flocons",30],["beurre_cacahuete",10]],
    ["Mixer fruits rouges surgelés, banane, whey et un peu de lait : texture épaisse.","Flocons et beurre de cacahuète dessus."],
    "Comme au Brésil, mais sans le prix de l'açaí.", ["brésilien","sucré","rapide","whey"], false),
  M("K08", "Energy balls dattes-cacao protéinées", "sweet", "🟤", 10, 0,
    [["dattes",40],["flocons",25],["whey",15],["beurre_cacahuete",10],["cacao",4]],
    ["Mixer tous les ingrédients, ajouter 1 c.à.s d'eau si besoin.","Rouler en boules (≈ 3 par portion)."],
    "Une fournée pour la semaine : 7 jours au frigo.", ["moyen-orient","sucré","whey"], true),
  M("K09", "Shake café-banane-cacahuète", "sweet", "🥤", 3, 0,
    [["lait",250],["whey",30],["banane",100],["beurre_cacahuete",15],["flocons",20]],
    ["Tout mixer avec 1 c.à.c de café soluble et des glaçons."],
    "Inspiré du cà phê vietnamien. Se boit en 2 minutes après le sport.", ["vietnamien","sucré","rapide","whey"], false),
  M("K10", "Fromage blanc, beurre de cacahuète, miel et banane", "sweet", "🍌", 2, 0,
    [["fromage_blanc",250],["whey",15],["beurre_cacahuete",10],["miel",8],["banane",80]],
    ["Skyr + whey.","Banane en rondelles, filet de tahini et de miel."],
    "Le tahini apporte un goût de halva et de bons gras.", ["moyen-orient","sucré","rapide","whey"], false),
  M("K11", "Riz au lait coco-mangue protéiné", "sweet", "🍚", 5, 15,
    [["riz",40],["lait",150],["lait_coco",50],["whey",20],["mangue",100]],
    ["Autocuiseur : riz + lait + lait de coco, 12 min sous pression, dépressurisation naturelle.","Laisser tiédir, incorporer la whey.","Mangue en dés au service."],
    "Clin d'œil au mango sticky rice thaï. 4 jours au frigo.", ["thaï","sucré","autocuiseur","whey"], true),
  M("K12", "Tostada avocat et œuf", "sweet", "🥑", 4, 5,
    [["pain",40],["avocat",50],["oeuf",1],["tomate",40],["citron_vert",10],["huile",3],["epices",1]],
    ["Pain grillé à l'air fryer 3 min.","Avocat écrasé, citron vert, piment.","Œufs brouillés ou au plat, tomate en dés."],
    "La collation salée qui cale vraiment.", ["mexicain","salé","rapide"], false),
  M("K13", "Mini-wrap thon et carré frais", "sweet", "🌯", 2, 0,
    [["tortilla",60],["thon",70],["carre_frais",25],["concombre",40],["salade",10],["citron",5]],
    ["Voir les étapes détaillées."],
    "Une petite boîte de thon suffit pour un wrap.", ["salé","rapide"], false),
  M("K14", "Croque-monsieur jambon-fromage", "sweet", "🥪", 2, 7,
    [["pain",80],["jambon_blanc",80],["emmental",20],["moutarde",3]],
    ["Voir les étapes détaillées."],
    "Pas de beurre : le fromage gratiné suffit.", ["salé","rapide"], false),
  M("K15", "Roses des sables au beurre de cacahuète", "sweet", "🌹", 10, 0,
    [["cornflakes",25],["chocolat",15],["beurre_cacahuete",10],["whey",10]],
    ["Fais fondre le chocolat noir au micro-ondes par tranches de 30 secondes, en remuant entre chaque, jusqu'à ce qu'il soit lisse.","Ajoute le beurre de cacahuète et la whey, et mélange jusqu'à obtenir une pâte brillante.","Ajoute les corn flakes et enrobe-les délicatement à la spatule, sans trop les écraser.","Forme de petits tas sur une feuille de papier cuisson, environ 3 par portion, et laisse-les durcir 30 minutes au frigo.","Mise en boîtes : les roses des sables dans une boîte hermétique, au frigo. Elles se gardent une semaine."],
    "Le chocolat noir et le beurre de cacahuète remplacent le chocolat au lait et la graisse végétale de la recette classique.", ["français","sucré","sans cuisson","semaine","whey"], true),
  M("K16", "Tiramisu minute en verrine", "sweet", "☕", 5, 0,
    [["boudoirs",24],["yaourt_grec",150],["whey",15],["miel",5],["cacao",3]],
    ["Trempe rapidement les boudoirs dans un fond de café froid, une seconde de chaque côté, et pose-les au fond d'un verre.","Mélange le yaourt grec, la whey et le miel jusqu'à ce que ce soit lisse, puis verse sur les boudoirs.","Saupoudre de cacao. Mange tout de suite, ou garde le verre une heure au frigo pour que les boudoirs s'imbibent."],
    "Le yaourt grec et la whey remplacent le mascarpone et les œufs : même goût, trois fois plus de protéines.", ["italien","sucré","sans cuisson","rapide","whey"], false),
  M("K17", "Barres de céréales aux dattes et aux cacahuètes", "sweet", "🌾", 10, 0,
    [["dattes",30],["flocons",25],["cacahuetes",12],["whey",10],["cacao",3]],
    ["Mixe les dattes avec une cuillère à soupe d'eau chaude, jusqu'à obtenir une pâte collante.","Ajoute les flocons d'avoine, la whey et le cacao, et mixe quelques secondes seulement, pour garder des morceaux de flocons.","Incorpore les cacahuètes entières à la main : ce sont elles qui donnent le croquant.","Tasse le tout dans une petite boîte tapissée de papier cuisson, sur 1,5 cm d'épaisseur, et laisse prendre une heure au frigo.","Mise en boîtes : coupe en barres, une par portion, et garde-les au frigo. Elles se gardent une semaine."],
    "Les dattes font tout le travail du sucre et de la liaison : aucun sucre ajouté.", ["français","sucré","sans cuisson","semaine","whey"], true),
  M("K18", "Barres façon Snickers aux dattes", "sweet", "🍫", 15, 0,
    [["dattes",30],["whey",10],["beurre_cacahuete",12],["cacahuetes",10],["chocolat",12]],
    ["Mixe les dattes avec la whey et une cuillère à soupe d'eau chaude : c'est le « caramel ». Étale-le sur 1 cm dans une petite boîte tapissée de papier cuisson.","Étale le beurre de cacahuète par-dessus, puis parsème de cacahuètes concassées en appuyant légèrement.","Fais fondre le chocolat noir au micro-ondes par tranches de 30 secondes et verse-le sur le dessus en une fine couche.","Laisse prendre une heure au congélateur, puis coupe en barres, une par portion.","Mise en boîtes : les barres dans une boîte au congélateur. Sors-en une 10 minutes avant de la manger."],
    "Le caramel de dattes remplace le caramel au sucre : même texture fondante, avec des fibres en plus.", ["américain","sucré","sans cuisson","semaine","whey"], true),
  M("K19", "Bouchées façon Bounty", "sweet", "🥥", 15, 0,
    [["coco_rapee",20],["lait_coco",20],["whey",12],["miel",8],["chocolat",10]],
    ["Mélange la noix de coco râpée, le lait de coco, la whey et le miel jusqu'à obtenir une pâte qui se tient. Si elle colle trop, ajoute une pincée de coco.","Forme de petites bouchées allongées, environ 3 par portion, pose-les sur du papier cuisson et laisse-les durcir 20 minutes au congélateur.","Fais fondre le chocolat noir au micro-ondes par tranches de 30 secondes, trempe chaque bouchée dedans et repose-la sur le papier.","Mise en boîtes : les bouchées dans une boîte au congélateur. Sors-les 5 minutes avant de les manger."],
    "Le lait de coco et un peu de miel remplacent le lait concentré sucré : tout le goût du Bounty, avec bien moins de sucre.", ["sucré","sans cuisson","semaine","whey"], true),
  M("K20", "Barres granola croustillantes à l'air fryer", "sweet", "🥜", 10, 12,
    [["flocons",30],["amandes",12],["whey",10],["beurre_cacahuete",8],["miel",10]],
    ["Concasse grossièrement les amandes et mélange-les avec les flocons d'avoine et la whey.","Fais tiédir le miel et le beurre de cacahuète 20 secondes au micro-ondes, puis verse-les sur les flocons et mélange bien, jusqu'à ce que tout soit enrobé.","Tasse la préparation sur 1,5 cm d'épaisseur sur une feuille de papier cuisson posée dans le panier de l'air fryer.","Fais cuire 12 minutes à 160 °C, jusqu'à ce que ce soit doré. Laisse refroidir complètement avant de couper : les barres durcissent en refroidissant.","Mise en boîtes : une barre par portion, dans une boîte hermétique. Elles se gardent une semaine."],
    "Bien les laisser refroidir avant de les couper, sinon elles s'émiettent.", ["américain","sucré","air fryer","semaine","whey"], true),
  M("K21", "Cookies banane et pépites de chocolat à l'air fryer", "sweet", "🍪", 10, 8,
    [["banane",50],["flocons",30],["whey",15],["chocolat",10]],
    ["Écrase la banane à la fourchette, puis mélange-la avec les flocons d'avoine et la whey.","Ajoute le chocolat noir haché en petits morceaux.","Forme 3 cookies par portion, aplatis-les à 1 cm et pose-les sur du papier cuisson dans le panier de l'air fryer.","Fais-les cuire 8 minutes à 170 °C : ils doivent être dorés sur les bords et encore moelleux au centre. Laisse-les refroidir 10 minutes, ils se raffermissent.","Mise en boîtes : les cookies dans une boîte, 3 jours au frigo, ou au congélateur pour la semaine. Réchauffe-les 2 minutes à l'air fryer à 160 °C."],
    "La banane bien mûre remplace le beurre et le sucre.", ["américain","sucré","air fryer","semaine","whey"], true),
  M("S05", "Fruit de saison", "side", "🍐", 1, 0,
    [["fruit_saison",150]],
    ["À croquer."],
    "Pomme, poire, clémentines… le moins cher selon la saison.", ["fruit","0-cuisson"], false),
  M("S06", "Pain complet", "side", "🍞", 0, 0,
    [["pain",40]],
    ["Une tranche."],
    "", ["0-cuisson"], false),
  M("S08", "Fromage blanc, miel & cacahuète", "side", "🍯", 1, 0,
    [["fromage_blanc",150],["miel",8],["beurre_cacahuete",5]],
    ["Un bol de fromage blanc, un filet de miel, une cuillère de beurre de cacahuète."],
    "", ["0-cuisson","complément"], false),
  M("S09", "Banane & beurre de cacahuète", "side", "🍌", 1, 0,
    [["banane",100],["beurre_cacahuete",15]],
    ["Banane en rondelles, une cuillère de beurre de cacahuète."],
    "", ["0-cuisson","complément"], false),
  M("S11", "Tartine carré frais & blanc de poulet", "side", "🥪", 2, 0,
    [["pain",40],["carre_frais",25],["poulet_tranches",80]],
    ["Tartiner, ajouter les tranches de blanc de poulet."],
    "", ["0-cuisson","complément","salé"], false),
  M("S12", "Tartine carré frais, miel & thym", "side", "🍯", 1, 0,
    [["pain",40],["carre_frais",25],["miel",8],["herbes",1]],
    ["Tartiner le carré frais, filet de miel, thym (frais ou séché), un tour de poivre."],
    "Le sucré-salé qui marche toujours.", ["0-cuisson","complément","sucré"], false),
  M("S16", "Skyr & fruits rouges", "side", "🫐", 1, 0,
    [["skyr",150],["fruits_rouges",80]],
    ["Skyr nature, fruits rouges décongelés ou frais."],
    "", ["0-cuisson","complément","sucré"], false),
  M("S07", "Poignée d'amandes", "side", "🌰", 0, 0,
    [["amandes",25]],
    ["Une petite poignée (≈ 20 amandes)."],
    "Les bons gras qui manquent souvent quand les plats sont maigres.", ["0-cuisson","oléagineux"], false),

  // ══ Imprévu ══
  M("X01", "Repas à l'extérieur", "extra", "🍽️", 0, 0,
    [["repas_ext",3]],
    ["Repas pris au restaurant, chez des amis ou au travail."],
    "Estimation moyenne : les collations des jours suivants compensent si besoin.", ["imprevu","fixe"], false),
];

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

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
  M("W01", "Curry vert thaï poulet-aubergine", "dinner", "🍛", 10, 15,
    [["poulet",170],["aubergine",120],["poivron",60],["lait_coco",100],["pate_curry",20],["nuoc_mam",8],["herbes",5],["riz",75]],
    ["AC mode dorer : 2 min la pâte de curry avec un fond de lait de coco.","Ajouter le poulet en dés, l'aubergine en cubes, le poivron, le reste du lait de coco et le nuoc mam.","Fermer, 8 min sous pression, dépressuriser rapidement.","Basilic thaï au moment de servir. Riz jasmin à part (casserole ou AC)."],
    "L'aubergine boit la sauce et devient fondante : encore meilleur à J+1.", ["thaï","autocuiseur","batch"], true, {"pairs":["SA12"]}),
  M("W02", "Bún gà : poulet citronnelle & vermicelles", "lunch", "🥢", 15, 14,
    [["haut_cuisse",170],["citronnelle",10],["nuoc_mam",10],["miel",8],["ail",1],["nouilles_riz",70],["carotte",60],["concombre",80],["salade",40],["herbes",8],["citron_vert",15],["cacahuetes",8]],
    ["Mariner le poulet : citronnelle hachée, ail, nuoc mam, miel (15 min ou la veille).","AF 200°C 12-14 min en retournant à mi-cuisson, puis trancher.","Vermicelles : 4 min dans l'eau bouillante, rincer à froid.","Sauce : nuoc mam + citron vert + 1 c.à.c miel + 3 c.à.s d'eau.","Boîtes : vermicelles, crudités, poulet, cacahuètes ; sauce dans un petit pot."],
    "Bowl froid : aucun réchauffage, parfait au bureau.", ["vietnamien","air fryer","batch","froid"], true, {"pairs":["SA03"]}),
  M("W03", "Gyudon : bœuf & oignons soja-mirin", "dinner", "🍚", 10, 15,
    [["boeuf_emince",160],["oignon",100],["soja",20],["mirin",15],["gingembre",5],["riz",80],["oeuf",1],["epinards",80],["huile",8]],
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
  M("W06", "Mujaddara : lentilles, riz & oignons croustillants", "dinner", "🧅", 10, 25,
    [["lentilles_vertes",70],["riz",50],["oignon",120],["huile",8],["epices",3],["yaourt_grec",100],["ail",1],["concombre",80],["tomate",80]],
    ["Oignons en fines lamelles + la moitié de l'huile : AF 180°C 15-18 min en remuant, jusqu'à doré.","AC : lentilles + riz + cumin + reste d'huile + 2,5 volumes d'eau, 12 min sous pression.","Yaourt à l'ail, salade tomate-concombre.","Oignons croustillants par-dessus au moment de servir."],
    "L'un des plats les moins chers de la liste (~1 €), et pourtant très gourmand.", ["libanais","végé","autocuiseur","air fryer","batch","économique"], true, {"pairs":["SA03"]}),
  M("W07", "Tajine de poulet, citron confit & olives", "dinner", "🍋", 15, 12,
    [["poulet",150],["oignon",80],["carotte",100],["courgette",100],["olives",20],["citron_confit",15],["epices",5],["huile",5],["semoule",70]],
    ["AC mode dorer : poulet + oignon + épices (ras el hanout, curcuma, gingembre) 5 min.","Ajouter carottes, courgettes, citron confit, olives et 100 ml d'eau par portion.","12 min sous pression, dépressurisation naturelle.","Semoule à part : même volume d'eau bouillante, couvrir 5 min."],
    "Se bonifie au frigo. Semoule à part dans la boîte.", ["marocain","autocuiseur","batch"], true, {"pairs":["SA07","SA06"]}),
  M("W08", "Tinga de poulet, riz & haricots noirs", "dinner", "🌮", 10, 12,
    [["poulet",170],["tomates_conc",150],["oignon",60],["chipotle",10],["ail",1],["riz",60],["haricots_noirs",100],["mais",40],["yaourt_grec",30],["citron_vert",10],["herbes",5],["huile",8],["avocat",50]],
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
  M("W11", "Korean fried chicken gochujang-miel", "dinner", "🍗", 15, 16,
    [["poulet",170],["fecule",15],["gochujang",15],["miel",10],["soja",10],["ail",1],["riz",70],["concombre",120],["vinaigre_riz",10],["sesame",3],["huile_sesame",3]],
    ["Poulet en morceaux enrobé de fécule.","AF 200°C 16 min, secouer 2 fois : ça croustille sans friture.","Sauce : gochujang + miel + soja + ail, 1 min à la poêle, enrober le poulet.","Riz + concombre smashé (vinaigre de riz, huile de sésame, sésame)."],
    "Réchauffe le poulet à l'AF (4 min) plutôt qu'au micro-ondes pour retrouver le croustillant.", ["coréen","air fryer","gourmand","batch"], true, {"pairs":["SA12","SA01"]}),
  M("W12", "Katsu curry japonais", "dinner", "🍛", 15, 15,
    [["poulet",160],["panko",25],["oeuf",1],["riz",65],["carotte",80],["oignon",60],["pdt",50],["epices",6],["fecule",8],["miel",5],["soja",5],["huile",8]],
    ["Sauce à l'AC : oignon, carotte, pomme de terre, curry en poudre, miel, soja + 200 ml d'eau, 5 min sous pression.","Mixer ou écraser la sauce, épaissir avec la fécule délayée.","Poulet aplati, œuf battu puis panko, AF 200°C 12-14 min.","Trancher le katsu, servir sur le riz nappé de sauce."],
    "Les légumes mixés font une sauce onctueuse sans roux au beurre.", ["japonais","air fryer","autocuiseur","gourmand","batch"], true, {"pairs":["SA04"]}),
  M("W13", "Bánh mì au poulet citronnelle", "lunch", "🥖", 15, 14,
    [["haut_cuisse",150],["citronnelle",8],["nuoc_mam",8],["miel",6],["baguette",100],["carotte",60],["vinaigre_riz",15],["concombre",60],["herbes",6],["yaourt_grec",25],["epices",2],["huile",8]],
    ["Pickles express : carotte en julienne + vinaigre de riz + 1 pincée de sucre, 30 min (se gardent 1 semaine).","Poulet mariné citronnelle-nuoc mam-miel, AF 200°C 12-14 min, émincé.","Mayo légère : yaourt + sriracha.","Au moment : baguette passée 2 min à l'AF, garnir."],
    "Les pickles maison font tout le goût, pour presque zéro calorie.", ["vietnamien","air fryer","gourmand","assemblage"], true, {"pairs":["SA12"]}),
  M("W14", "Butter chicken & riz basmati", "dinner", "🧈", 10, 12,
    [["poulet",170],["yaourt_grec",50],["tomates_conc",150],["concentre",15],["creme",30],["oignon",50],["gingembre",5],["ail",1],["epices",6],["riz",75]],
    ["Mariner le poulet dans yaourt + garam masala (10 min ou la veille).","AC dorer : oignon, ail, gingembre, épices 3 min.","Ajouter tomates, concentré, poulet, 6 min sous pression.","Hors du feu, ajouter la crème. Riz basmati à part."],
    "30 ml de crème légère suffisent : le yaourt fait le crémeux.", ["indien","autocuiseur","gourmand","batch"], true, {"pairs":["SA06"]}),
  M("W15", "Pollo a la brasa, frites & salsa verde", "dinner", "🍗", 10, 22,
    [["haut_cuisse",200],["epices",5],["soja",5],["citron_vert",20],["ail",1],["pdt",250],["huile",6],["salade",60],["tomate",80],["herbes",15],["yaourt_grec",30]],
    ["Mariner le poulet : cumin, paprika, origan, soja, citron vert, ail.","Frites : AF 200°C 12 min, puis ajouter le poulet et cuire encore 10-12 min ensemble.","Salsa verde : coriandre ou persil mixés + yaourt + citron vert + piment.","Salade tomate à côté."],
    "Tout cuit en même temps dans l'air fryer.", ["péruvien","air fryer","gourmand","batch"], true, {"pairs":["SA05"]}),
  M("W16", "Lahmacun express sur tortilla", "lunch", "🫓", 10, 8,
    [["boeuf",140],["tortilla",120],["tomate",100],["poivron",60],["oignon",40],["concentre",15],["epices",4],["herbes",15],["citron",15],["salade",50],["huile",6]],
    ["Garniture : bœuf cru + tomate, poivron, oignon mixés finement + concentré + paprika, cumin, piment.","Étaler finement sur les tortillas.","AF 200°C 6-7 min, jusqu'à ce que les bords croustillent.","Persil, oignon, citron, rouler et manger."],
    "La garniture se prépare pour 4 jours. Cuisson minute de 6 minutes.", ["turc","air fryer","gourmand","assemblage"], true, {"pairs":["SA03","SA11"]}),
  M("W17", "Quesadillas poulet, haricots noirs & maïs", "lunch", "🧀", 10, 10,
    [["poulet",140],["tortilla",120],["haricots_noirs",80],["mais",50],["emmental",30],["poivron",60],["oignon",30],["epices",3],["tomate",80],["citron_vert",10],["yaourt_grec",40]],
    ["Poulet en dés + poivron + oignon + épices tex-mex, poêle 7 min (garniture batch).","Écraser grossièrement les haricots noirs.","Tortilla : haricots, garniture, maïs, fromage, refermer.","AF 190°C 5 min. Salsa tomate-citron vert et crème au yaourt."],
    "La garniture se garde 4 jours ; l'assemblage prend 2 min.", ["mexicain","air fryer","gourmand","assemblage"], true, {"pairs":["SA08","SA01"]}),
  M("W18", "Pad thaï aux crevettes", "dinner", "🍤", 15, 10,
    [["crevettes",150],["nouilles_riz",75],["oeuf",1],["pousses_soja",80],["carotte",60],["cacahuetes",10],["citron_vert",15],["nuoc_mam",12],["miel",8],["soja",5],["huile",6],["herbes",5]],
    ["Nouilles trempées dans l'eau chaude 8 min.","Sauce : nuoc mam + miel + citron vert + soja.","Poêle très chaude : crevettes 2 min, œuf brouillé, carotte.","Nouilles + sauce 2 min, pousses de soja et cacahuètes à la fin."],
    "Version allégée : plus de légumes, moins de nouilles. Marche aussi avec du poulet.", ["thaï","poêle","gourmand","batch"], true, {"pairs":["SA12"]}),
  M("W19", "Larb de dinde, citron vert & herbes", "dinner", "🌿", 10, 8,
    [["dinde_hachee",170],["riz",75],["citron_vert",20],["nuoc_mam",10],["oignon",40],["herbes",10],["epices",1],["concombre",100],["salade",50],["cacahuetes",15]],
    ["Poêle sans matière grasse : dinde hachée 6-7 min en émiettant.","Hors du feu : nuoc mam, citron vert, échalote, piment, menthe et coriandre.","Servir avec riz, concombre et feuilles de salade."],
    "Ultra frais, ultra rapide, et léger en gras.", ["thaï","poêle","batch","rapide"], true, {"pairs":["SA12"]}),
  M("W20", "Bibimbap au bœuf gochujang", "dinner", "🥗", 15, 12,
    [["boeuf_emince",150],["riz",75],["oeuf",1],["epinards",80],["carotte",70],["courgette",80],["pousses_soja",50],["gochujang",15],["soja",10],["huile_sesame",5],["sesame",3]],
    ["Mariner le bœuf : soja, ail, huile de sésame.","Poêle : chaque légume 2-3 min séparément, puis le bœuf 3 min.","Œuf au plat ou mollet au moment.","Bol : riz, légumes en secteurs, bœuf, œuf, gochujang."],
    "Légumes rangés en compartiments dans la boîte : c'est aussi beau à J+3.", ["coréen","poêle","batch"], true, {"pairs":["SA12"]}),
  M("W21", "Mapo tofu léger au bœuf", "dinner", "🌶️", 10, 12,
    [["tofu",200],["boeuf",70],["gochujang",10],["soja",10],["ail",1],["gingembre",5],["fecule",5],["brocoli",120],["riz",70],["huile",8]],
    ["Poêle : bœuf émietté 4 min avec ail et gingembre.","Ajouter gochujang, soja et 150 ml d'eau.","Tofu en cubes, mijoter 5 min doucement, lier avec la fécule.","Brocoli à l'AF ou vapeur, riz à part."],
    "Peu de viande, beaucoup de protéines grâce au tofu : économique et réconfortant.", ["chinois","poêle","batch"], true, {"pairs":["SA05"]}),
  M("W22", "Saumon laqué miso-sésame", "dinner", "🐟", 5, 10,
    [["saumon",140],["miso",12],["miel",6],["riz",75],["concombre",120],["vinaigre_riz",10],["sesame",4],["brocoli",100],["huile_sesame",5]],
    ["Laque : miso + miel + 1 c.à.c d'eau.","Badigeonner le saumon, AF 200°C 8-10 min avec le brocoli.","Concombre mariné au vinaigre de riz et sésame.","Servir sur le riz."],
    "Poisson : à manger dans les 2 jours, placé en début de semaine.", ["japonais","air fryer","poisson","batch"], true, {"pairs":["SA04"]}),
  M("W23", "Youvetsi : bœuf & orzo à la grecque", "dinner", "🍝", 10, 20,
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
  M("W27", "Lomo saltado", "dinner", "🥩", 15, 15,
    [["boeuf_emince",170],["pdt",200],["riz",50],["tomate",120],["oignon",80],["soja",15],["vinaigre_riz",10],["huile",6],["herbes",5]],
    ["Frites : AF 200°C 18 min.","Wok très chaud : bœuf en lanières 2 min, réserver.","Oignon rouge et tomate en quartiers 2 min, soja + vinaigre, remettre le bœuf.","Mélanger avec les frites juste avant de manger, riz à côté."],
    "Garde les frites à part dans la boîte et réchauffe-les à l'AF.", ["péruvien","poêle","air fryer","gourmand","batch"], true, {"pairs":["SA05"]}),
  M("W28", "Moqueca de colin au lait de coco", "dinner", "🥥", 10, 15,
    [["poisson_blanc",180],["lait_coco",80],["poivron",120],["tomate",100],["oignon",50],["citron_vert",15],["epices",2],["herbes",5],["riz",75]],
    ["Mariner le poisson dans le citron vert 10 min.","Poêle : oignon, poivrons, tomates 6 min, paprika.","Lait de coco, poser le poisson, couvrir 8 min.","Coriandre, riz à part."],
    "Colin surgelé = poisson abordable. À manger dans les 2 jours.", ["brésilien","poêle","poisson","batch"], true, {"pairs":["SA01"]}),
  M("W29", "Misir wot : lentilles corail au berbéré & œufs", "dinner", "🥚", 10, 10,
    [["lentilles_corail",70],["oignon",80],["tomates_conc",100],["gingembre",5],["ail",1],["epices",5],["huile",5],["oeuf",2],["riz",40],["epinards",80]],
    ["AC dorer : beaucoup d'oignon 5 min, ail, gingembre, berbéré (ou paprika + piment + cannelle).","Lentilles, tomates, épinards + 3 volumes d'eau : 6 min sous pression.","Œufs durs (10 min) écalés, posés dessus."],
    "Les lentilles corail fondent en purée épicée : très rassasiant pour ~1,30 €.", ["éthiopien","végé","autocuiseur","batch","économique"], true, {"pairs":["SA06"]}),
  M("W30", "Crevettes piri-piri & riz à la tomate", "dinner", "🦐", 10, 12,
    [["crevettes",170],["epices",3],["citron",15],["ail",2],["huile",8],["riz",75],["tomates_conc",100],["oignon",40],["poivron",100]],
    ["Mariner les crevettes : piment, paprika, ail, citron, huile.","AC : riz + tomates + oignon + poivron + 1,2 volume d'eau, 4 min sous pression.","Crevettes AF 200°C 6 min.","Servir les crevettes sur le riz."],
    "Crevettes cuites : 2 jours au frigo maximum.", ["mozambicain","air fryer","autocuiseur","batch"], true, {"pairs":["SA08"]}),

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

  // ══ Collations (whey) ══
  M("K01", "Lassi mangue protéiné", "sweet", "🥭", 3, 0,
    [["yaourt_grec",200],["mangue",150],["whey",25],["lait",100],["epices",1]],
    ["Tout mixer avec une pincée de cardamome.","Servir bien frais."],
    "Mangue surgelée = texture de milkshake, sans glaçons.", ["indien","sucré","rapide","whey"], false),
  M("K02", "Yaourt grec miel-pistache", "sweet", "🍯", 2, 0,
    [["yaourt_grec",200],["whey",15],["miel",12],["pistaches",20]],
    ["Mélanger la whey dans le yaourt.","Miel et pistaches concassées dessus."],
    "Le dessert grec de base, version protéinée.", ["grec","sucré","rapide","whey"], false),
  M("K03", "Labneh za'atar, pita & crudités", "sweet", "🫓", 4, 2,
    [["yaourt_grec",150],["huile",5],["epices",2],["pita",70],["concombre",80],["tomate",80]],
    ["Yaourt grec bien épais étalé, huile d'olive, za'atar.","Pita réchauffée 2 min à l'air fryer, crudités en bâtonnets."],
    "La collation salée du Levant, à tremper.", ["libanais","salé","rapide"], false),
  M("K05", "Overnight oats tiramisu", "sweet", "☕", 4, 0,
    [["flocons",50],["lait",120],["whey",25],["fromage_blanc",100],["cacao",5],["miel",8]],
    ["Flocons + lait + whey + 1 c.à.c de café soluble, en bocal.","Couche de fromage blanc au miel, cacao en poudre.","Une nuit au frigo."],
    "Prépare 3 bocaux d'un coup : 4 jours au frigo.", ["italien","sucré","whey"], true),
  M("K06", "Pancakes protéinés à la banane", "sweet", "🥞", 5, 8,
    [["flocons",50],["banane",80],["oeuf",1],["whey",20],["lait",50],["miel",10]],
    ["Mixer flocons, banane, œuf, whey, lait.","Petits pancakes à la poêle, 1 min 30 par face.","Miel ou sirop d'érable au service."],
    "Se congèlent : 1 min au grille-pain ou à l'air fryer.", ["américain","sucré","whey"], true),
  M("K07", "Bowl açaí-style fruits rouges", "sweet", "🫐", 4, 0,
    [["fruits_rouges",150],["banane",80],["whey",25],["lait",80],["flocons",30],["beurre_cacahuete",10]],
    ["Mixer fruits rouges surgelés, banane, whey et un peu de lait : texture épaisse.","Flocons et beurre de cacahuète dessus."],
    "Comme au Brésil, mais sans le prix de l'açaí.", ["brésilien","sucré","rapide","whey"], false),
  M("K08", "Energy balls dattes-cacao protéinées", "sweet", "🟤", 10, 0,
    [["dattes",30],["flocons",25],["whey",15],["beurre_cacahuete",12],["cacao",4]],
    ["Mixer tous les ingrédients, ajouter 1 c.à.s d'eau si besoin.","Rouler en boules (≈ 3 par portion)."],
    "Une fournée pour la semaine : 7 jours au frigo.", ["moyen-orient","sucré","whey"], true),
  M("K09", "Shake café-banane-cacahuète", "sweet", "🥤", 3, 0,
    [["lait",250],["whey",30],["banane",100],["beurre_cacahuete",15],["flocons",20]],
    ["Tout mixer avec 1 c.à.c de café soluble et des glaçons."],
    "Inspiré du cà phê vietnamien. Se boit en 2 minutes après le sport.", ["vietnamien","sucré","rapide","whey"], false),
  M("K10", "Skyr tahini, miel & banane", "sweet", "🍌", 2, 0,
    [["skyr",200],["whey",10],["tahini",15],["miel",10],["banane",80]],
    ["Skyr + whey.","Banane en rondelles, filet de tahini et de miel."],
    "Le tahini apporte un goût de halva et de bons gras.", ["moyen-orient","sucré","rapide","whey"], false),
  M("K11", "Riz au lait coco-mangue protéiné", "sweet", "🍚", 5, 15,
    [["riz",40],["lait",150],["lait_coco",50],["whey",20],["mangue",100]],
    ["Autocuiseur : riz + lait + lait de coco, 12 min sous pression, dépressurisation naturelle.","Laisser tiédir, incorporer la whey.","Mangue en dés au service."],
    "Clin d'œil au mango sticky rice thaï. 4 jours au frigo.", ["thaï","sucré","autocuiseur","whey"], true),
  M("K12", "Tostada avocat & œufs", "sweet", "🥑", 4, 5,
    [["pain",40],["avocat",50],["oeuf",2],["tomate",60],["citron_vert",5],["epices",1]],
    ["Pain grillé à l'air fryer 3 min.","Avocat écrasé, citron vert, piment.","Œufs brouillés ou au plat, tomate en dés."],
    "La collation salée qui cale vraiment.", ["mexicain","salé","rapide"], false),
  M("S05", "Fruit de saison", "side", "🍐", 1, 0,
    [["fruit_saison",150]],
    ["À croquer."],
    "Pomme, poire, clémentines… le moins cher selon la saison.", ["fruit","0-cuisson"], false),
  M("S06", "Pain complet", "side", "🍞", 0, 0,
    [["pain",40]],
    ["Une tranche."],
    "", ["0-cuisson"], false),
  M("S08", "Fromage blanc, miel & cacahuète", "side", "🍯", 1, 0,
    [["fromage_blanc",150],["miel",10],["beurre_cacahuete",10]],
    ["Un bol de fromage blanc, un filet de miel, une cuillère de beurre de cacahuète."],
    "", ["0-cuisson","complément"], false),
  M("S09", "Banane & beurre de cacahuète", "side", "🍌", 1, 0,
    [["banane",100],["beurre_cacahuete",15]],
    ["Banane en rondelles, une cuillère de beurre de cacahuète."],
    "", ["0-cuisson","complément"], false),
  M("S11", "Tartine carré frais & blanc de dinde", "side", "🥪", 2, 0,
    [["pain",40],["carre_frais",25],["jambon_dinde",80]],
    ["Tartiner, ajouter les tranches de dinde."],
    "", ["0-cuisson","complément","salé"], false),
  M("S12", "Tartine carré frais, miel & thym", "side", "🍯", 1, 0,
    [["pain",40],["carre_frais",50],["miel",10],["herbes",1]],
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

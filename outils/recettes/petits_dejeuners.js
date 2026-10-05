// Petits-déjeuners (formule classique). Simples : 5 minutes au plus le matin, sans mixeur.
// batch: true → se prépare pendant la session de cuisine et se garde au frigo (tag frigo-N : jours).
// Tags : 'sucré' ou 'salé' (préférence de la personne), 'whey' si la recette en contient.
const R = (id, name, emoji, prep, cook, ings, steps, tags, batch, fridge) =>
  ({ id, name, cat: 'breakfast', emoji, prep, cook, ings, steps, tip: '', tags: [...tags, ...(batch ? [`frigo-${fridge}`] : [])], batch });

exports.breakfasts = [
  // ── Sucré ──
  R('B01', 'Overnight oats cacao-banane à la whey', '🥣', 3, 0,
    [['flocons', 60], ['lait', 200], ['whey', 25], ['banane', 100], ['cacao', 6], ['beurre_cacahuete', 10]],
    ["Pendant la session de cuisine, prépare un bocal par matin : mélange les flocons, le cacao, la whey et le lait jusqu'à ce qu'il n'y ait plus de grumeaux.", "Ferme les bocaux et range-les au frigo. Ils se gardent 3 jours.", "Le matin, ajoute la banane coupée en rondelles et le beurre de cacahuète."],
    ['sucré', 'sans cuisson', 'whey'], true, 3),
  R('B02', 'Overnight oats pomme-cannelle au fromage blanc', '🍎', 4, 0,
    [['flocons', 60], ['fromage_blanc', 210], ['lait', 100], ['pomme', 120], ['miel', 10], ['epices', 1], ['amandes', 15]],
    ["Pendant la session de cuisine, prépare un bocal par matin : mélange les flocons, le fromage blanc, le lait, le miel et la cannelle.", "Ajoute la pomme coupée en petits dés, sans l'éplucher, puis ferme.", "Range les bocaux au frigo. Ils se gardent 3 jours.", "Le matin, ajoute les amandes concassées : ajoutées au dernier moment, elles restent croquantes."],
    ['sucré', 'sans cuisson'], true, 3),
  R('B05', 'Fromage blanc, granola et fruits rouges', '🫐', 2, 0,
    [['fromage_blanc', 250], ['granola', 45], ['fruits_rouges', 100], ['miel', 8]],
    ["Pendant la session de cuisine, fais chauffer les fruits rouges surgelés 2 minutes à la poêle, jusqu'à ce qu'ils frémissent, puis laisse-les refroidir et range-les au frigo : c'est la recommandation sanitaire pour les petits fruits surgelés mangés sans cuisson. Ils se gardent 3 jours.", "Le matin, verse le fromage blanc dans un bol et ajoute les fruits rouges, le granola et le miel."],
    ['sucré', 'sans cuisson'], true, 3),
  R('B12', 'Tartines beurre de cacahuète et banane', '🍌', 3, 0,
    [['pain', 80], ['beurre_cacahuete', 20], ['banane', 100], ['lait', 250]],
    ["Fais griller le pain 2 minutes à l'air fryer à 180 °C, ou mange-le tel quel.", "Tartine le beurre de cacahuète et ajoute la banane coupée en rondelles.", "Accompagne d'un grand verre de lait (250 ml)."],
    ['sucré', 'sans cuisson'], false, 0),
  R('B13', 'Fromage blanc à la whey, flocons et fruits', '🥄', 2, 0,
    [['fromage_blanc', 200], ['whey', 20], ['flocons', 40], ['fruits_rouges', 100], ['miel', 8]],
    ["Pendant la session de cuisine, fais chauffer les fruits rouges surgelés 2 minutes à la poêle, jusqu'à ce qu'ils frémissent, puis laisse-les refroidir et range-les au frigo : c'est la recommandation sanitaire pour les petits fruits surgelés mangés sans cuisson. Ils se gardent 3 jours.", "Le matin, mélange la whey dans le fromage blanc jusqu'à ce qu'il n'y ait plus de grumeaux.", "Ajoute les flocons, les fruits rouges et le miel."],
    ['sucré', 'sans cuisson', 'whey'], true, 3),
  // ── Salé ──
  R('B06', 'Muffins aux œufs, épinards et feta', '🧁', 10, 14,
    [['oeuf', 3], ['epinards', 60], ['poivron', 50], ['feta', 30], ['fruit_saison', 150]],
    ["Pendant la session de cuisine, fais décongeler les épinards 2 minutes à la poêle, puis presse-les pour retirer l'eau. Coupe le poivron en petits dés.", "Bats les œufs avec une pincée de sel, puis ajoute les épinards, le poivron et la feta émiettée.", "Verse dans des moules à muffins en silicone (3 muffins par portion) et fais cuire 12 à 14 minutes à l'air fryer à 160 °C, jusqu'à ce qu'ils soient pris au centre.", "Laisse refroidir et range-les en boîte au frigo : ils se gardent 4 jours. Le matin, réchauffe-les 2 minutes à l'air fryer à 160 °C.", "Accompagne-les d'un fruit de saison."],
    ['salé', 'air fryer'], true, 4),
  R('B07', 'Wrap poulet et carré frais', '🌯', 2, 0,
    [['tortilla', 60], ['carre_frais', 50], ['poulet_tranches', 80], ['concombre', 60]],
    ["Tartine le wrap de carré frais.", "Ajoute les tranches de blanc de poulet et le concombre en bâtonnets, puis roule."],
    ['salé', 'sans cuisson'], false, 0),
  R('B10', 'Tartines houmous et œufs au plat', '🥚', 2, 5,
    [['pain', 80], ['houmous', 40], ['oeuf', 2], ['huile', 3], ['tomate', 80]],
    ["Fais cuire les œufs au plat dans la poêle huilée, 4 minutes à feu moyen.", "Pendant ce temps, tartine le pain de houmous.", "Pose les œufs dessus et ajoute la tomate en rondelles."],
    ['salé', 'poêle'], false, 0),
  R('B14', 'Tartines carré frais, poulet et concombre', '🥪', 3, 0,
    [['pain', 80], ['carre_frais', 50], ['poulet_tranches', 80], ['concombre', 80]],
    ["Tartine le pain de carré frais.", "Ajoute les tranches de blanc de poulet et le concombre en fines rondelles, avec un tour de poivre."],
    ['salé', 'sans cuisson'], false, 0),
  R('B15', 'Œufs brouillés et tartines', '🍳', 2, 4,
    [['oeuf', 3], ['huile', 3], ['emmental', 20], ['pain', 80], ['tomate', 80], ['fruit_saison', 150]],
    ["Bats les œufs avec une pincée de sel et de poivre.", "Fais-les cuire 3 minutes à feu doux dans la poêle huilée, en remuant sans arrêt avec une spatule. Ajoute l'emmental râpé hors du feu et mélange : il fond dans les œufs, qui restent crémeux.", "Sers avec le pain, la tomate coupée en rondelles et un fruit de saison."],
    ['salé', 'poêle'], false, 0),
  R('B16', 'Porridge banane-cannelle à la whey', '🥣', 1, 4,
    [['flocons', 60], ['lait', 250], ['whey', 20], ['banane', 100], ['epices', 1], ['miel', 8], ['amandes', 15]],
    ["Dans une petite casserole, porte le lait à frémissement avec les flocons et la cannelle, puis laisse cuire 3 à 4 minutes à feu doux en remuant, jusqu'à ce que ce soit crémeux. Au micro-ondes : 2 minutes dans un grand bol, en remuant à mi-temps.", "Hors du feu, mélange la whey en remuant bien.", "Ajoute la banane en rondelles, le miel et les amandes concassées."],
    ['sucré', 'chaud', 'whey'], false, 0),
];

// ingredients.js — Base d'ingrédients unique.
//
// Toutes les macros des recettes sont CALCULÉES depuis cette table (plus de valeurs recopiées
// à la main dans chaque recette → plus d'incohérences).
//
// Format : clé: [nom, unité, kcal, prot, gluc, lip, rôle, prix, rayon, options]
//   - macros pour 100 g / 100 ml, ou pour 1 pièce si unité = 'pièce'
//   - poids CRU pour les viandes et les féculents secs (riz, pâtes…)
//   - prix : €/kg, €/L, ou €/pièce (ordre de grandeur supermarché France, 2026)
//   - rôle : protein | carb | legume | veg | fruit | dairy | fat | flavor
//   - options :
//       lv  : levier d'ajustement — 'P' dans un plat, 'S' dans une collation, 'PS' les deux
//       min/max : portion RÉALISTE pour 1 repas quand l'ingrédient sert de levier
//       pack : format d'achat (arrondi de la liste de courses)
//       snap : les portions de la semaine sont ajustées pour que le TOTAL tombe sur des barquettes entières
//       packs : formats vendus pour les viandes (ex. [500, 250] : barquette de 4 ou de 2 steaks)
//       pantry : produit de placard (pas de quantité dans la liste, juste « à vérifier »)
//       fridge : jours de conservation au frigo une fois cuit (pour le planning batch)

const RAYON = {
  V: 'Viandes & poisson',
  L: 'Œufs & laitages',
  F: 'Légumes & fruits',
  S: 'Féculents & légumineuses',
  E: 'Épicerie & placard',
};

const RAW = {
  // ── Protéines animales & végétales ─────────────────────────────
  poulet:        ['Blanc de poulet',            'g',     110, 23.5, 0,   1.5, 'protein', 11,   'V', { lv: 'P', min: 110, max: 350, fridge: 3, pack: 500, snap: true, packs: [500, 250] }],
  poulet_hache:  ['Poulet haché',               'g',     115, 20,   0,   4,   'protein', 10,   'V', { lv: 'P', min: 110, max: 350, fridge: 3, pack: 350, snap: true }],
  poulet_tranches: ['Blanc de poulet (tranches)', 'g',   110, 22,   1,   2,   'protein', 14,   'V', { lv: 'PS', min: 40, max: 160, pack: 160 }],
  boeuf:         ['Steak haché 5%',             'g',     125, 21,   0,   5,   'protein', 12,   'V', { lv: 'P', min: 100, max: 350, fridge: 3, pack: 500, snap: true, packs: [500, 250] }],
  saumon:        ['Saumon',                     'g',     205, 20.5, 0,   13.5,'protein', 22,   'V', { lv: 'P', min: 100, max: 160, fridge: 2, pack: 250, snap: true, packs: [250, 125] }],
  poisson_blanc: ['Colin / merlu (surgelé)',    'g',     80,  17.5, 0,   1,   'protein', 10,   'V', { lv: 'P', min: 120, max: 220, fridge: 2, pack: 400, snap: true }],
  crevettes:     ['Crevettes décortiquées',     'g',     95,  21,   0.5, 1.2, 'protein', 18,   'V', { lv: 'P', min: 100, max: 180, fridge: 2, pack: 200, snap: true }],
  thon:          ['Thon au naturel (égoutté)',  'g',     112, 26,   0,   1,   'protein', 13,   'E', { lv: 'PS', min: 70, max: 160, pack: 140 }],
  oeuf:          ['Œufs',                      'pièce', 75,  6.5,  0.4, 5.2, 'protein', 0.30, 'L', { lv: 'PS', min: 1, max: 4, pack: 6 }],
  tofu:          ['Tofu ferme',                 'g',     125, 13,   2,   7.5, 'protein', 9,    'L', { lv: 'P', min: 100, max: 220, fridge: 4, pack: 200, snap: true }],

  // ── Féculents (poids cru / sec) ─────────────────────────────────
  riz:           ['Riz complet',                'g',     350, 7,    71.4, 2.8, 'carb', 3,   'S', { cook: 2.5, lv: 'PS', min: 50, max: 170, minP: 90, maxS: 60, pack: 1000 }],
  pates:         ['Pâtes complètes',            'g',     353, 11.8, 67.6, 2.2, 'carb', 2.2,  'S', { cook: 2.3, lv: 'P', min: 60, max: 180, minP: 100, pack: 500 }],
  // versions classiques (réglage « Riz et pâtes » : Classiques ou plat par plat), substituées par js/staples.js
  riz_blanc:     ['Riz blanc',                  'g',     355, 7,    78,  0.8, 'carb', 2.5,  'S', { cook: 2.6, lv: 'PS', min: 50, max: 170, minP: 90, maxS: 60, pack: 1000 }],
  pates_classiques: ['Pâtes',                   'g',     355, 12.5, 70,  1.8, 'carb', 2.0,  'S', { cook: 2.3, lv: 'P', min: 60, max: 180, minP: 100, pack: 500 }],
  nouilles_riz:  ['Nouilles de riz',            'g',     360, 6,    80,  0.7, 'carb', 6,    'S', { cook: 2.4, lv: 'P', min: 50, max: 180, minP: 100, pack: 400 }],
  boulghour:     ['Boulghour',                  'g',     350, 11,   70,  1.5, 'carb', 3.5,  'S', { cook: 2.5, lv: 'P', min: 50, max: 175, minP: 95, pack: 500 }],
  quinoa:        ['Quinoa',                     'g',     370, 14,   64,  6,   'carb', 9,    'S', { cook: 2.7, lv: 'P', min: 50, max: 165, minP: 85, pack: 500 }],
  semoule:       ['Semoule',                    'g',     360, 12,   73,  1.5, 'carb', 2,    'S', { cook: 2.2, lv: 'P', min: 50, max: 180, minP: 105, pack: 500 }],
  pdt:           ['Pommes de terre',            'g',     77,  2,    16,  0.1, 'carb', 1.5,  'F', { lv: 'P', min: 150, max: 600, minP: 300 }],
  patate_douce:  ['Patate douce',               'g',     86,  1.6,  20,  0.1, 'carb', 3,    'F', { lv: 'P', min: 150, max: 600, minP: 300 }],
  pain:          ['Pain complet',               'g',     245, 9,    44,  3,   'carb', 4.5,  'S', { buy: 500, lv: 'PS', min: 40, max: 120 }],
  pita:          ['Pain pita',                  'g',     270, 9,    53,  1.5, 'carb', 6,    'S', { lv: 'PS', min: 70, max: 140, minP: 140, pack: 420 }],
  tortilla:      ['Wraps de blé',               'g',     300, 8.5,  50,  7,   'carb', 6,    'S', { lv: 'P', min: 60, max: 180, minP: 120, pack: 360 }],
  farine:        ['Farine',                     'g',     340, 10,   72,  1.2, 'carb', 1,    'S', { lv: 'P', min: 70, max: 110, pantry: true }],
  flocons:       ["Flocons d'avoine",           'g',     370, 13,   60,  7,   'carb', 2.5,  'S', { lv: 'S', min: 25, max: 90, pack: 500 }],
  chapelure:     ['Chapelure',                  'g',     370, 12,   72,  3,   'flavor', 4,  'E', { pantry: true }],

  // ── Légumineuses (sèches = crues ; conserves = égouttées) ──────
  lentilles_corail: ['Lentilles corail (sèches)', 'g',   345, 24,   50,  1.5, 'legume', 4,  'S', { cook: 2.4, lv: 'P', min: 60, max: 180, minP: 100, pack: 500 }],
  lentilles_vertes: ['Lentilles vertes (sèches)', 'g',   330, 24,   48,  1.5, 'legume', 4,  'S', { cook: 2.4, lv: 'P', min: 60, max: 180, minP: 100, pack: 500 }],
  pois_chiches:  ['Pois chiches (conserve)',    'g',     140, 7.5,  18,  2.5, 'legume', 3,  'S', { lv: 'P', min: 120, max: 260, pack: 265 }],
  haricots_rouges:['Haricots rouges (conserve)','g',     115, 8,    15,  0.6, 'legume', 2.5,'S', { lv: 'P', min: 100, max: 250, pack: 250 }],
  haricots_blancs:['Haricots blancs (conserve)','g',     105, 7,    14,  0.5, 'legume', 2.5,'S', { lv: 'P', min: 100, max: 250, pack: 250 }],

  // ── Légumes ─────────────────────────────────────────────────────
  brocoli:       ['Brocoli (surgelé)',          'g',     34,  2.8,  4.5, 0.4, 'veg', 3.5, 'F', {}],
  courgette:     ['Courgettes',                 'g',     17,  1.2,  2.5, 0.3, 'veg', 2.5, 'F', { buy: 250 }],
  poivron:       ['Poivrons',                   'g',     28,  1,    5,   0.3, 'veg', 4,   'F', { buy: 180 }],
  oignon:        ['Oignons',                    'g',     40,  1.2,  8,   0.1, 'veg', 2,   'F', {}],
  ail:           ['Ail',                        'pièce', 4,   0.2,  0.9, 0,   'flavor', 0.10, 'F', { pantry: true }],
  haricots_verts:['Haricots verts (surgelés)',  'g',     30,  2,    4.5, 0.2, 'veg', 3,   'F', {}],
  epinards:      ['Épinards (surgelés)',        'g',     25,  3,    1.5, 0.4, 'veg', 3,   'F', {}],
  carotte:       ['Carottes',                   'g',     36,  0.8,  7,   0.3, 'veg', 1.5, 'F', {}],
  concombre:     ['Concombre',                  'g',     14,  0.6,  2.5, 0.1, 'veg', 2.5, 'F', { buy: 350 }],
  tomates_cerise:['Tomates cerise',             'g',     22,  0.9,  3.5, 0.2, 'veg', 6,   'F', { buy: 250 }],
  tomates_conc:  ['Tomates concassées',         'g',     25,  1.2,  4,   0.2, 'veg', 2.5, 'E', { pack: 400 }],
  salade:        ['Salade verte',               'g',     15,  1.3,  1.7, 0.2, 'veg', 6,   'F', { buy: 250 }],
  champignons:   ['Champignons de Paris',       'g',     22,  3,    1,   0.3, 'veg', 5,   'F', { buy: 250 }],
  chou_fleur:    ['Chou-fleur (surgelé)',       'g',     25,  2,    3,   0.3, 'veg', 3,   'F', {}],
  petits_pois:   ['Petits pois (surgelés)',     'g',     80,  5.5,  10,  0.5, 'veg', 3.5, 'F', {}],
  mais:          ['Maïs (conserve)',            'g',     90,  3,    16,  1.5, 'veg', 4,   'E', { pack: 140 }],
  legumes_mix:   ['Poêlée de légumes (surgelée)','g',    40,  2,    6,   0.5, 'veg', 3,   'F', {}],
  avocat:        ['Avocat',                     'g',     160, 2,    2,   15,  'fat', 10,  'F', { buy: 170, lv: 'PS', min: 30, max: 100 }],
  herbes:        ['Herbes fraîches',            'g',     30,  2,    4,   0.5, 'flavor', 15, 'F', { buy: 30 }],
  citron:        ['Citron (jus)',               'ml',    22,  0.4,  6,   0.2, 'flavor', 5,  'F', {}],

  // ── Fruits ──────────────────────────────────────────────────────
  banane:        ['Banane',                     'g',     90,  1.1,  20,  0.3, 'fruit', 2,   'F', { lv: 'S', min: 80, max: 150 }],
  pomme:         ['Pomme',                      'g',     54,  0.3,  12,  0.2, 'fruit', 2.5, 'F', { lv: 'S', min: 100, max: 200 }],
  fruits_rouges: ['Fruits rouges (surgelés)',   'g',     45,  1,    8,   0.3, 'fruit', 6,   'F', { lv: 'S', min: 60, max: 200 }],
  fruit_saison:  ['Fruit de saison',            'g',     55,  0.6,  12,  0.2, 'fruit', 3,   'F', { lv: 'S', min: 100, max: 250 }],
  dattes:        ['Dattes dénoyautées',         'g',     280, 2.5,  65,  0.4, 'fruit', 8,   'E', {}],

  // ── Laitages ────────────────────────────────────────────────────
  fromage_blanc: ['Fromage blanc 0%',           'g',     46,  7.5,  4,   0.2, 'dairy', 2.6, 'L', { lv: 'S', min: 100, max: 300, pack: 1000 }],
  skyr:          ['Skyr',                       'g',     60,  10.5, 4,   0.2, 'dairy', 4.5, 'L', { lv: 'S', min: 100, max: 250, pack: 450 }],
  yaourt_grec:   ['Yaourt grec 0%',             'g',     57,  10,   3.6, 0.4, 'dairy', 5.5, 'L', { lv: 'S', min: 100, max: 250, pack: 500 }],
  cottage:       ['Cottage cheese',             'g',     98,  11,   3.4, 4.3, 'dairy', 7,   'L', { lv: 'S', min: 80, max: 200, pack: 200 }],
  fromage_frais: ['Fromage frais',              'g',     230, 7,    3,   21,   'dairy', 9,   'L', { pack: 150 }],
  parmesan:      ['Parmesan',                   'g',     390, 33,   0,   28,  'dairy', 20,  'L', { lv: 'P', min: 10, max: 30, pantry: true }],
  emmental:      ['Emmental râpé',              'g',     380, 28,   0,   29,  'dairy', 10,  'L', { lv: 'P', min: 20, max: 50, pack: 150 }],
  feta:          ['Feta',                       'g',     265, 14,   1,   22,  'dairy', 12,  'L', { lv: 'P', min: 20, max: 60, pack: 200 }],
  lait:          ['Lait demi-écrémé',           'ml',    46,  3.3,  4.8, 1.6, 'dairy', 1.0, 'L', { pack: 1000 }],
  lait_coco:     ['Lait de coco',               'ml',    180, 1.6,  3,   18,   'fat', 4,    'E', { lv: 'P', min: 80, max: 250, pack: 400 }],
  creme:         ['Crème fraîche',              'ml',    290, 2.2,  3,   30,  'fat', 4,    'L', { lv: 'P', min: 15, max: 50, pack: 200 }],
  whey:          ['Whey (protéine en poudre)',  'g',     380, 78,   6,   5,   'dairy', 25,  'E', { lv: 'S', min: 0, max: 40, pantry: true }],

  // ── Matières grasses, oléagineux, condiments ───────────────────
  huile:         ["Huile d'olive",              'g',     900, 0,    0,   100, 'fat', 9,    'E', { lv: 'P', min: 4, max: 20, pantry: true }],
  huile_sesame:  ['Huile de sésame',            'g',     900, 0,    0,   100, 'fat', 15,   'E', { lv: 'P', min: 3, max: 10, pantry: true }],
  beurre_cacahuete:['Beurre de cacahuète',      'g',     600, 25,   15,  50,  'fat', 9,    'E', { lv: 'S', min: 10, max: 30, pantry: true }],
  amandes:       ['Amandes',                    'g',     600, 21,   8,   52,  'fat', 15,   'E', { lv: 'S', min: 15, max: 35, pantry: true }],
  houmous:       ['Houmous',                    'g',     290, 7,    12,  24,  'fat', 10,   'L', { lv: 'PS', min: 20, max: 60, pack: 200 }],
  pesto:         ['Pesto',                      'g',     450, 5,    6,   45,  'fat', 12,   'E', { pantry: true }],
  sesame:        ['Graines de sésame',          'g',     580, 18,   12,  50,  'flavor', 10, 'E', { pantry: true }],
  chocolat:      ['Chocolat noir 85%',          'g',     590, 11,   20,  50,  'flavor', 15, 'E', { pantry: true }],
  granola:       ['Granola nature',             'g',     450, 9,    63,  17,  'carb', 6,   'E', { lv: 'S', min: 30, max: 80, pack: 500 }],
  chia:          ['Graines de chia',            'g',     490, 17,   8,   31,  'fat', 12,  'E', { lv: 'S', min: 15, max: 40, pack: 250 }],
  cacao:         ['Cacao non sucré',            'g',     380, 20,   15,  22,  'flavor', 12, 'E', { pantry: true }],
  soja:          ['Sauce soja',                 'ml',    55,  7,    5,   0,   'flavor', 6,  'E', { pantry: true }],
  miel:          ['Miel',                       'g',     305, 0.3,  82,  0,   'flavor', 10, 'E', { pantry: true }],
  agave:         ["Sirop d'agave",              'g',     300, 0,    75,  0,   'flavor', 10, 'E', { pantry: true }],
  pate_curry:    ['Pâte de curry',              'g',     150, 2,    12,  9,   'flavor', 15, 'E', { pantry: true }],
  moutarde:      ['Moutarde',                   'g',     150, 7,    5,   11,  'flavor', 4,  'E', { pantry: true }],
  concentre:     ['Concentré de tomate',        'g',     90,  4.5,  15,  0.5, 'flavor', 6,  'E', { pantry: true }],
  bouillon:      ['Bouillon cube',              'pièce', 10,  0.5,  1,   0.5, 'flavor', 0.15, 'E', { pantry: true }],
  epices:        ['Épices',                     'g',     300, 12,   40,  10,  'flavor', 0,  'E', { pantry: true }],
  levure:        ['Levure chimique',            'g',     100, 0,    25,  0,   'flavor', 5,  'E', { pantry: true }],

  // ── Ajouts « cuisines du monde » ───────────────────────────────
  haut_cuisse:   ['Haut de cuisse de poulet (sans peau)', 'g', 120, 19.5, 0, 4.5, 'protein', 9,  'V', { lv: 'P', min: 110, max: 350, fridge: 3, pack: 500, snap: true, packs: [500, 250] }],
  boeuf_emince:  ['Bœuf à émincer (macreuse)', 'g',     135, 21,   0,   5.5, 'protein', 14,  'V', { lv: 'P', min: 110, max: 350, fridge: 3, pack: 500, snap: true, packs: [500, 250] }],
  aubergine:     ['Aubergine',                  'g',     25,  1,    4,   0.2, 'veg', 3,   'F', { buy: 300 }],
  tomate:        ['Tomates',                    'g',     18,  0.9,  3,   0.2, 'veg', 3,   'F', {}],
  pousses_soja:  ['Pousses de soja',            'g',     30,  3,    4,   0.2, 'veg', 6,   'F', {}],
  citron_vert:   ['Citron vert (jus)',          'ml',    25,  0.4,  7,   0.1, 'flavor', 8, 'F', {}],
  gingembre:     ['Gingembre frais',            'g',     80,  1.8,  18,  0.8, 'flavor', 10, 'F', {}],
  citronnelle:   ['Citronnelle',                'g',     99,  1.8,  25,  0.5, 'flavor', 12, 'F', {}],
  haricots_noirs:['Haricots noirs (conserve)',  'g',     110, 7.5,  14,  0.5, 'legume', 3.5, 'S', { lv: 'P', min: 80, max: 200, pack: 250 }],
  orzo:          ['Orzo',                       'g',     355, 12.5, 70,  1.8, 'carb', 3,  'S', { cook: 2.3, lv: 'P', min: 50, max: 180, minP: 100, pack: 500 }],
  baguette:      ['Baguette',                   'g',     270, 9,    55,  1.5, 'carb', 3,  'S', { buy: 250, lv: 'P', min: 70, max: 200, minP: 100 }],
  pain_burger:   ['Pain burger complet',        'g',     260, 9,    46,  4.5, 'carb', 6,  'S', { pack: 280 }],
  cheddar:       ['Cheddar (tranches)',         'g',     300, 17,   4,   24,  'dairy', 14, 'L', { lv: 'P', min: 20, max: 40, pack: 200 }],
  olives:        ['Olives vertes',              'g',     145, 1,    4,   15,  'fat', 10,  'E', { lv: 'P', min: 15, max: 50, pantry: true }],
  cacahuetes:    ['Cacahuètes grillées',        'g',     590, 26,   10,  49,  'fat', 9,   'E', { lv: 'P', min: 10, max: 30, pantry: true }],
  nuoc_mam:      ['Sauce nuoc mam',             'ml',    35,  5,    4,   0,   'flavor', 8,  'E', { pantry: true }],
  mirin:         ['Mirin',                      'ml',    230, 0.3,  43,  0,   'flavor', 8,  'E', { pantry: true }],
  gochujang:     ['Gochujang',                  'g',     220, 4,    45,  1.5, 'flavor', 15, 'E', { pantry: true }],
  miso:          ['Pâte miso',                  'g',     200, 12,   26,  6,   'flavor', 15, 'E', { pantry: true }],
  fecule:        ['Fécule de maïs',             'g',     380, 0.3,  91,  0.1, 'flavor', 4,  'E', { pantry: true }],
  panko:         ['Panko',                      'g',     375, 12,   73,  3.5, 'flavor', 7,  'E', { pantry: true }],
  citron_confit: ['Citron confit',              'g',     30,  0.5,  5,   1,   'flavor', 15, 'E', { pantry: true }],
  chipotle:      ['Piment chipotle (adobo)',    'g',     60,  1.5,  10,  1.5, 'flavor', 15, 'E', { pantry: true }],
  cornichons:    ['Cornichons',                 'g',     20,  0.8,  3,   0.2, 'flavor', 6,  'E', { pantry: true }],
  vinaigre_riz:  ['Vinaigre de riz',            'ml',    20,  0,    4,   0,   'flavor', 5,  'E', { pantry: true }],

  mangue:        ['Mangue (surgelée)',          'g',     65,  0.8,  15,  0.4, 'fruit', 5,   'F', { lv: 'S', min: 80, max: 200 }],
  pistaches:     ['Pistaches décortiquées',     'g',     590, 20,   18,  46,  'fat', 25,   'E', { lv: 'S', min: 10, max: 35, pantry: true }],
  tahini:        ['Tahini (purée de sésame)',   'g',     600, 17,   20,  53,  'fat', 12,   'E', { lv: 'S', min: 10, max: 25, pantry: true }],
  nori:          ['Feuilles de nori',           'g',     280, 40,   40,  3,   'flavor', 80, 'E', { pantry: true }],

  carre_frais:   ['Carré frais',                'g',     240, 6.5,  3,   23,  'dairy', 11,  'L', { lv: 'S', min: 20, max: 50, pack: 200 }],
  saumon_fume:   ['Saumon fumé',                'g',     180, 22,   0,   10,  'protein', 30, 'V', { lv: 'S', min: 20, max: 60, pack: 100 }],
  radis:         ['Radis',                      'g',     16,  0.7,  3,   0.1, 'veg', 4,   'F', {}],

  // ── Imprévu : repas pris dehors, par « tiers de repas » de 300 kcal (estimation) ──
  repas_ext:     ['Repas à l\'extérieur (estimation)', 'pièce', 300, 13, 32, 13, 'other', 0, 'E', {}],
  // ── Ajouts de la reprise des recettes (faciles à trouver en supermarché) ──
  feuille_riz:   ['Feuilles de riz',            'g',     340, 6,    80,  0.5, 'carb', 9,   'E', { pack: 200 }],
  chou_chinois:  ['Chou chinois',               'g',     16,  1.2,  2.2, 0.2, 'veg', 2.5,  'F', { buy: 800 }],
  tomates_sechees: ['Tomates séchées (bocal, égouttées)', 'g', 210, 5, 13, 14, 'flavor', 14, 'E', { pack: 280 }],
  ketchup:       ['Ketchup',                    'g',     110, 1.2,  25,  0.2, 'flavor', 3,  'E', { pantry: true }],
  vinaigre_cidre: ['Vinaigre de cidre',         'ml',    20,  0,    1,   0,   'flavor', 2,  'E', { pantry: true }],
  nouilles_oeufs: ['Nouilles aux œufs',         'g',     375, 13,   70,  4,   'carb', 4,    'S', { cook: 2.3, lv: 'P', min: 60, max: 170, minP: 90, pack: 250 }],
  boudoirs:      ['Boudoirs',                   'g',     385, 8,    80,  3.8, 'carb', 6,    'E', { pack: 200 }],
  coco_rapee:    ['Noix de coco râpée',         'g',     665, 6.6,  8.6, 66,  'fat', 10,   'E', { min: 10, max: 30, pantry: true }],
  cornflakes:    ['Corn-flakes nature',         'g',     375, 7.5,  84,  1,   'carb', 4,    'E', { pack: 500 }],
  oignons_frits: ['Oignons frits',              'g',     590, 6,    45,  42,  'flavor', 12, 'E', { pantry: true }],
  mayo_allegee:  ['Mayonnaise allégée',         'g',     280, 1,    8,   27,  'fat', 5,    'E', { pantry: true }],
  gnocchis:      ['Gnocchis (frais)',           'g',     150, 4,    32,  0.5, 'carb', 4,    'S', { lv: 'P', min: 150, max: 380, minP: 200, pack: 500 }],
  jambon_blanc:  ['Jambon blanc (tranches)',    'g',     110, 20,   1,   3,   'protein', 12,  'V', { lv: 'S', min: 40, max: 120, pack: 160 }],
  sauce_chili:   ['Sauce chili douce (thaï)',   'g',     220, 0.5,  53,  0.3, 'flavor', 6,  'E', { pantry: true }],
  sriracha:      ['Sauce sriracha',             'g',     95,  2,    19,  1,   'flavor', 10, 'E', { pantry: true }],
  // ── Sans lactose (v155)
  yaourt_sl:     ['Yaourt nature sans lactose', 'g',     62,  3.8,  4.5, 3,   'dairy', 4.5, 'L', { lv: 'S', min: 100, max: 250, pack: 500 }],
  boisson_avoine:['Boisson à l\'avoine',         'ml',    45,  1,    7,   1.5, 'dairy', 1.6, 'L', { pack: 1000 }],
  creme_coco:    ['Crème de coco',              'ml',    195, 2,    3,   19,  'fat', 5,    'L', { lv: 'P', min: 15, max: 50, pack: 200 }],
  // ── Sans gluten (v156)
  pates_sg:      ['Pâtes sans gluten',          'g',     355, 7,    78,  1.5, 'carb', 4.0,  'S', { cook: 2.3, lv: 'P', min: 60, max: 180, minP: 100, pack: 500 }],
  pain_sg:       ['Pain sans gluten',           'g',     250, 4,    45,  5,   'carb', 8.0,  'S', { lv: 'PS', min: 40, max: 120, pack: 250 }],
  wrap_sg:       ['Wraps sans gluten',          'g',     300, 4,    55,  6,   'carb', 10,   'S', { lv: 'P', min: 60, max: 180, minP: 120, pack: 240 }],
  tamari:        ['Tamari (sauce soja sans gluten)', 'ml', 60, 10,  5,   0,   'flavor', 15, 'E', { pantry: true }],
  // ── Repas libre : part de la journée réservée, par tranches de 100 kcal (non cuisiné, non acheté) ──
  repas_libre:   ['Repas libre (part réservée)', 'pièce', 100, 5, 11, 4, 'other', 0, 'E', {}],

  // ── Cantine (estimation, pas acheté) ───────────────────────────
  feculents_cuits:['Féculents cuits (cantine)', 'g',     140, 5,    28,  1,   'carb', 0,   'E', {}],
};

export const INGREDIENTS = {};
for (const [key, [name, unit, kcal, protein, carbs, fat, role, price, rayon, opts]] of Object.entries(RAW)) {
  INGREDIENTS[key] = {
    key, name, unit, role, price,
    rayon: RAYON[rayon],
    per: { kcal, protein, carbs, fat },         // pour 100 g/ml ou pour 1 pièce
    lv: opts.lv || '', min: opts.min, max: opts.max, minP: opts.minP, maxS: opts.maxS, cook: opts.cook || null,
    pack: opts.pack || null, snap: !!opts.snap,
    buy: opts.buy || null, // produit frais vendu à la pièce : poids d'une pièce (calage « tout consommer », pas la liste de courses)
    packs: opts.packs || (opts.pack ? [opts.pack] : null), // formats vendus, du plus grand au plus petit
    pantry: !!opts.pantry, fridge: opts.fridge || null, // (v194 : étaient restés dans le commentaire ci-dessus, donc ignorés)
  };
}

export const getIngredient = (key) => INGREDIENTS[key];
export const RAYONS = Object.values(RAYON);

export function isCountableUnit(unit) { return /pi[èe]ce|unit|tranche|gousse/i.test(unit || ''); }

// Macros d'une quantité d'ingrédient
export function ingMacros(key, qty) {
  const ing = INGREDIENTS[key];
  if (!ing) return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const f = ing.unit === 'pièce' ? qty : qty / 100;
  return {
    kcal: ing.per.kcal * f, protein: ing.per.protein * f,
    carbs: ing.per.carbs * f, fat: ing.per.fat * f,
  };
}

// Coût d'une quantité d'ingrédient (€)
export function ingCost(key, qty) {
  const ing = INGREDIENTS[key];
  if (!ing) return 0;
  return ing.unit === 'pièce' ? ing.price * qty : ing.price * qty / 1000;
}

// ── Unités naturelles : ce qui se compte en tranches ou à la pièce ──
// Le moteur arrondit ces ingrédients à l'unité entière (js/optimizer.js → snapQty).
export const NATURAL_UNITS = {
  boudoirs:     { g: 8, one: 'boudoir', many: 'boudoirs' },
  pain:         { g: 40, one: 'tranche', many: 'tranches' },
  poulet_tranches: { g: 40, one: 'tranche', many: 'tranches' },
  jambon_blanc: { g: 40, one: 'tranche', many: 'tranches' },
  cheddar:      { g: 20, one: 'tranche', many: 'tranches' },
  pain_burger:  { g: 70, one: 'pain',    many: 'pains' },
  tortilla:     { g: 60, one: 'wrap',    many: 'wraps' },
  pita:         { g: 70, one: 'pita',    many: 'pitas' },
  pain_sg:      { g: 40, one: 'tranche', many: 'tranches' },
  wrap_sg:      { g: 60, one: 'wrap',    many: 'wraps' },
  carre_frais:  { g: 25, one: 'carré',   many: 'carrés', box: 'boîte' },
};

// Quantité lisible : « 2 tranches », « 3 œufs », « 150 g »
export function humanQty(key, qty, unit, opts = {}) {
  const db = INGREDIENTS[key];
  if (opts.cooked && db && db.cook && qty > 0) {
    return `${Math.round(qty)} g (≈ ${Math.round(qty * db.cook / 10) * 10} g cuit)`;
  }
  const nu = NATURAL_UNITS[key];
  if (nu && qty > 0) {
    const n = Math.max(0.5, Math.round(qty / nu.g * 2) / 2);
    return `${String(n).replace('.', ',')} ${n > 1 ? nu.many : nu.one}`;
  }
  if (unit === 'pièce') { const n = Math.round(qty * 2) / 2; return String(n).replace('.', ','); }
  if (qty >= 1000 && unit === 'g') return `${String(Math.round(qty / 10) / 100).replace('.', ',')} kg`;
  if (qty >= 1000 && unit === 'ml') return `${String(Math.round(qty / 10) / 100).replace('.', ',')} L`;
  return `${Math.round(qty)} ${unit}`;
}

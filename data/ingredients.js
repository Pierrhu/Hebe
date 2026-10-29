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
//       edible : part gardée à la préparation (v275 : haut de cuisse acheté avec la peau, 15 % de peau retirée).
//                Les recettes comptent le poids sans peau ; barquettes et courses comptent le poids acheté.

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
  poulet_hache:  ['Poulet haché',               'g',     109, 20.9,   0,   2.9,   'protein', 10,   'V', { lv: 'P', min: 110, max: 350, fridge: 3, pack: 350, snap: true }],
  poulet_tranches: ['Blanc de poulet (tranches)', 'g',   105, 20.7,   1.4,   1.8,   'protein', 14,   'V', { lv: 'PS', min: 40, max: 160, pack: 160 }],
  boeuf:         ['Steak haché 5%',             'g',     130, 21.9,   0.3,   4.6,   'protein', 12,   'V', { lv: 'P', min: 100, max: 350, fridge: 3, pack: 500, snap: true, packs: [500, 250] }],
  saumon:        ['Saumon',                     'g',     193, 20.5, 0,   12.4,'protein', 22,   'V', { lv: 'P', min: 100, max: 160, fridge: 2, pack: 250, snap: true, packs: [250, 125] }],
  poisson_blanc: ['Colin / merlu (surgelé)',    'g',     83.4,  15.6, 0.9,   2,   'protein', 10,   'V', { lv: 'P', min: 120, max: 220, fridge: 2, pack: 400, snap: true }],
  crevettes:     ['Crevettes décortiquées',     'g',     105,  23.4,   0.5, 1.2, 'protein', 18,   'V', { lv: 'P', min: 100, max: 180, fridge: 2, pack: 200, snap: true }],
  thon:          ['Thon au naturel (égoutté)',  'g',     127, 24.8,   3.7,   1.5,   'protein', 13,   'E', { lv: 'PS', min: 70, max: 160, pack: 140 }],
  oeuf:          ['Œufs',                      'pièce', 75,  6.5,  0.4, 5.2, 'protein', 0.30, 'L', { lv: 'PS', min: 1, max: 4, pack: 6 }],
  tofu:          ['Tofu ferme',                 'g',     147, 13.4,   2.9,   8.5, 'protein', 9,    'L', { lv: 'P', min: 100, max: 220, fridge: 4, pack: 200, snap: true }],

  // ── Féculents (poids cru / sec) ─────────────────────────────────
  riz:           ['Riz complet',                'g',     350, 7,    71.4, 2.8, 'carb', 3,   'S', { cook: 2.5, lv: 'PS', min: 50, max: 170, minP: 90, maxS: 60, pack: 1000 }],
  pates:         ['Pâtes complètes',            'g',     353, 11.8, 67.6, 2.2, 'carb', 2.2,  'S', { cook: 2.3, lv: 'P', min: 60, max: 180, minP: 100, pack: 500 }],
  // versions classiques (réglage « Riz et pâtes » : Classiques ou plat par plat), substituées par js/staples.js
  riz_blanc:     ['Riz blanc',                  'g',     355, 7,    78,  0.8, 'carb', 2.5,  'S', { cook: 2.6, lv: 'PS', min: 50, max: 170, minP: 90, maxS: 60, pack: 1000 }],
  pates_classiques: ['Pâtes',                   'g',     355, 12.5, 70,  1.8, 'carb', 2.0,  'S', { cook: 2.3, lv: 'P', min: 60, max: 180, minP: 100, pack: 500 }],
  nouilles_riz:  ['Nouilles de riz',            'g',     365, 7.4,    80.5,  1, 'carb', 6,    'S', { cook: 2.4, lv: 'P', min: 50, max: 180, minP: 100, pack: 400 }],
  boulghour:     ['Boulghour',                  'g',     347, 11.7,   65.8,  1.4, 'carb', 3.5,  'S', { cook: 2.5, lv: 'P', min: 50, max: 175, minP: 95, pack: 500 }],
  quinoa:        ['Quinoa',                     'g',     358, 13.2,   58.1,  6.1,   'carb', 9,    'S', { cook: 2.7, lv: 'P', min: 50, max: 165, minP: 85, pack: 500 }],
  semoule:       ['Semoule',                    'g',     360, 12,   73,  1.5, 'carb', 2,    'S', { cook: 2.2, lv: 'P', min: 50, max: 180, minP: 105, pack: 500 }],
  pdt:           ['Pommes de terre',            'g',     77,  2,    16,  0.1, 'carb', 1.5,  'F', { lv: 'P', min: 150, max: 600, minP: 300 }],
  patate_douce:  ['Patate douce',               'g',     81.2,  1.6,  17.1,  0.1, 'carb', 3,    'F', { lv: 'P', min: 150, max: 600, minP: 300 }],
  pain:          ['Pain complet',               'g',     234, 8.7,    41.2,  1.7,   'carb', 4.5,  'S', { buy: 500, lv: 'PS', min: 40, max: 120 }],
  pita:          ['Pain pita',                  'g',     249, 7.5,    48.8,  1.5, 'carb', 6,    'S', { lv: 'PS', min: 70, max: 140, minP: 140, pack: 420 }],
  tortilla:      ['Wraps de blé',               'g',     320, 8,  53,  7.5,   'carb', 6,    'S', { lv: 'P', min: 60, max: 180, minP: 120, pack: 360 }],
  farine:        ['Farine',                     'g',     340, 10,   72,  1.2, 'carb', 1,    'S', { lv: 'P', min: 70, max: 110, pantry: true }],
  flocons:       ["Flocons d'avoine",           'g',     369, 10.6,   57.7,  7.8,   'carb', 2.5,  'S', { lv: 'S', min: 25, max: 90, pack: 500 }],
  chapelure:     ['Chapelure',                  'g',     365, 9.4,   74.3,  1.6,   'flavor', 4,  'E', { pantry: true }],

  // ── Légumineuses (sèches = crues ; conserves = égouttées) ──────
  lentilles_corail: ['Lentilles corail (sèches)', 'g',   328, 27.7,   44.9,  0.8, 'legume', 4,  'S', { cook: 2.4, lv: 'P', min: 60, max: 180, minP: 100, pack: 500 }],
  lentilles_vertes: ['Lentilles vertes (sèches)', 'g',   327, 25.1,   44.5,  1.8, 'legume', 4,  'S', { cook: 2.4, lv: 'P', min: 60, max: 180, minP: 100, pack: 500 }],
  pois_chiches:  ['Pois chiches (conserve)',    'g',     122, 6.7,  15,  2.7, 'legume', 3,  'S', { lv: 'P', min: 120, max: 260, pack: 265 }],
  haricots_rouges:['Haricots rouges (conserve)','g',     108, 8.3,    13,  1, 'legume', 2.5,'S', { lv: 'P', min: 100, max: 250, pack: 250 }],
  haricots_blancs:['Haricots blancs (conserve)','g',     85.5, 5.9,    10.9,  0.5, 'legume', 2.5,'S', { lv: 'P', min: 100, max: 250, pack: 250 }],

  // ── Légumes ─────────────────────────────────────────────────────
  brocoli:       ['Brocoli (surgelé)',          'g',     26.4,  2.8,  1.5, 0.4, 'veg', 3.5, 'F', {}],
  courgette:     ['Courgettes',                 'g',     16.7,  1.2,  1.8, 0.3, 'veg', 2.5, 'F', { buy: 250 }],
  poivron:       ['Poivrons',                   'g',     22.6,  0.8,    3.5,   0.3, 'veg', 4,   'F', { buy: 180 }],
  oignon:        ['Oignons',                    'g',     39,  1.1,  6.3,   0.6, 'veg', 2,   'F', {}],
  ail:           ['Ail',                        'pièce', 4,   0.2,  0.9, 0,   'flavor', 0.10, 'F', { pantry: true }],
  haricots_verts:['Haricots verts (surgelés)',  'g',     33.1,  1.8,    4.8, 0.2, 'veg', 3,   'F', {}],
  epinards:      ['Épinards (surgelés)',        'g',     25,  3,    1.5, 0.4, 'veg', 3,   'F', {}],
  carotte:       ['Carottes',                   'g',     30.2,  0.8,  5.2,   0.3, 'veg', 1.5, 'F', {}],
  concombre:     ['Concombre',                  'g',     14,  0.6,  2.5, 0.1, 'veg', 2.5, 'F', { buy: 350 }],
  tomates_cerise:['Tomates cerise',             'g',     31.8,  1.3,  5.6, 0.3, 'veg', 6,   'F', { buy: 250 }],
  tomates_conc:  ['Tomates concassées',         'g',     25,  1.2,  4,   0.2, 'veg', 2.5, 'E', { pack: 400 }],
  salade:        ['Salade verte',               'g',     15,  1.3,  1.7, 0.2, 'veg', 6,   'F', { buy: 250 }],
  champignons:   ['Champignons de Paris',       'g',     21,  2.1,    1.8,   0.4, 'veg', 5,   'F', { buy: 250 }],
  chou_fleur:    ['Chou-fleur (surgelé)',       'g',     25,  2,    3,   0.3, 'veg', 3,   'F', {}],
  petits_pois:   ['Petits pois (surgelés)',     'g',     80,  5.5,  10,  0.5, 'veg', 3.5, 'F', {}],
  mais:          ['Maïs (conserve)',            'g',     105,  2.7,    18.3,  1.7, 'veg', 4,   'E', { pack: 140 }],
  legumes_mix:   ['Poêlée de légumes (surgelée)','g',    43.3,  1.9,    4.4,   1.3, 'veg', 3,   'F', {}],
  avocat:        ['Avocat',                     'g',     203, 1.6,    0,   20.6,  'fat', 10,  'F', { buy: 170, lv: 'PS', min: 30, max: 100 }],
  herbes:        ['Herbes fraîches',            'g',     33.3,  2.8,    2.8,   0.6, 'flavor', 15, 'F', { buy: 30, max: 10 }],
  citron:        ['Citron (jus)',               'ml',    28.6,  0.4,  2.5,   0.2, 'flavor', 5,  'F', {}],

  // ── Fruits ──────────────────────────────────────────────────────
  banane:        ['Banane',                     'g',     90,  1.1,  20,  0.3, 'fruit', 2,   'F', { lv: 'S', min: 80, max: 150 }],
  pomme:         ['Pomme',                      'g',     54,  0.3,  12,  0.2, 'fruit', 2.5, 'F', { lv: 'S', min: 100, max: 200 }],
  fruits_rouges: ['Fruits rouges (surgelés)',   'g',     45.5,  1,    7,   0.5, 'fruit', 6,   'F', { lv: 'S', min: 60, max: 200 }],
  fruit_saison:  ['Fruit de saison',            'g',     55,  0.6,  12,  0.2, 'fruit', 3,   'F', { lv: 'S', min: 100, max: 250 }],
  // v306 : fruits de la semaine (Ciqual 2025, partie comestible, crue)
  clementine:    ['Clémentines',                'g',     45.5, 0.8,  9.2,  0.25, 'fruit', 3,   'F', { lv: 'S', min: 60, max: 240 }],
  kiwi:          ['Kiwis',                      'g',     60.9, 0.9,  11,   0.6,  'fruit', 4,   'F', { lv: 'S', min: 75, max: 225 }],
  orange:        ['Oranges',                    'g',     42,   0.8,  8,    0.25, 'fruit', 2.5, 'F', { lv: 'S', min: 150, max: 300 }],
  kaki:          ['Kaki',                       'g',     66,   0.9,  14.3, 0.15, 'fruit', 4,   'F', { lv: 'S', min: 90, max: 360 }],
  raisin:        ['Raisin',                     'g',     71,   0.7,  16.3, 0.25, 'fruit', 4,   'F', { lv: 'S', min: 75, max: 300 }],
  fraises:       ['Fraises',                    'g',     35.1, 0.6,  6,    0.25, 'fruit', 8,   'F', { lv: 'S', min: 125, max: 500 }],
  abricot:       ['Abricots',                   'g',     44.1, 0.8,  9,    0.25, 'fruit', 4,   'F', { lv: 'S', min: 45, max: 180 }],
  peche:         ['Pêches',                     'g',     37.9, 0.9,  7.6,  0.25, 'fruit', 3.5, 'F', { lv: 'S', min: 75, max: 300 }],
  prune:         ['Prunes',                     'g',     51.6, 0.7,  9.9,  0.28, 'fruit', 3.5, 'F', { lv: 'S', min: 40, max: 160 }],
  pamplemousse:  ['Pamplemousse',               'g',     33.5, 0.8,  5.9,  0.25, 'fruit', 2.5, 'F', { lv: 'S', min: 125, max: 500 }],
  dattes:        ['Dattes dénoyautées',         'g',     287, 1.8,  64.7,  0.3, 'fruit', 8,   'E', {}],

  // ── Laitages ────────────────────────────────────────────────────
  fromage_blanc: ['Fromage blanc 0%',           'g',     46,  7.5,  4,   0.2, 'dairy', 2.6, 'L', { lv: 'S', min: 100, max: 300, pack: 1000 }],
  skyr:          ['Skyr',                       'g',     60,  10.5, 4,   0.2, 'dairy', 4.5, 'L', { lv: 'S', min: 100, max: 250, pack: 450 }],
  yaourt_grec:   ['Yaourt grec 0%',             'g',     57,  10,   3.6, 0.4, 'dairy', 5.5, 'L', { lv: 'S', min: 100, max: 250, pack: 500 }],
  cottage:       ['Cottage cheese',             'g',     98,  11,   3.4, 4.3, 'dairy', 7,   'L', { lv: 'S', min: 80, max: 200, pack: 200 }],
  fromage_frais: ['Fromage frais',              'g',     225, 6.3,    3.3,   20.7,   'dairy', 9,   'L', { pack: 150 }],
  parmesan:      ['Parmesan',                   'g',     411, 31.1,   1.1,   31,  'dairy', 20,  'L', { lv: 'P', min: 10, max: 30, pantry: true }],
  emmental:      ['Emmental râpé',              'g',     368, 27.6,   0.6,   28.2,  'dairy', 10,  'L', { lv: 'P', min: 20, max: 50, pack: 150 }],
  feta:          ['Feta',                       'g',     284, 15.1,   0.5,   24.3,  'dairy', 12,  'L', { lv: 'P', min: 20, max: 60, pack: 200 }],
  lait:          ['Lait demi-écrémé',           'ml',    46,  3.3,  4.8, 1.6, 'dairy', 1.0, 'L', { pack: 1000 }],
  lait_coco:     ['Lait de coco',               'ml',    199, 1.9,  4.3,   19.2,   'fat', 4,    'E', { lv: 'P', min: 80, max: 250, pack: 400 }],
  creme:         ['Crème fraîche',              'ml',    285, 2.3,  1.4,   29.9,  'fat', 4,    'L', { lv: 'P', min: 15, max: 50, pack: 200 }],
  whey:          ['Whey (protéine en poudre)',  'g',     380, 78,   6,   5,   'dairy', 25,  'E', { lv: 'S', min: 0, max: 40, pantry: true }],

  // ── Matières grasses, oléagineux, condiments ───────────────────
  huile:         ["Huile d'olive",              'g',     900, 0,    0,   100, 'fat', 9,    'E', { lv: 'P', min: 4, max: 20, pantry: true }],
  huile_sesame:  ['Huile de sésame',            'g',     900, 0,    0,   100, 'fat', 15,   'E', { lv: 'P', min: 3, max: 10, pantry: true }],
  beurre_cacahuete:['Beurre de cacahuète',      'g',     643, 22.2,   17.3,  51.4,  'fat', 9,    'E', { lv: 'S', min: 10, max: 30, pantry: true }],
  amandes:       ['Amandes',                    'g',     615, 18.8,   9.5,   51.3,  'fat', 15,   'E', { lv: 'S', min: 15, max: 35, pantry: true }],
  houmous:       ['Houmous',                    'g',     258, 8.1,    9,  19.9,  'fat', 10,   'L', { lv: 'PS', min: 20, max: 60, pack: 200 }],
  pesto:         ['Pesto',                      'g',     370, 3.9,    6.6,   35.4,  'fat', 12,   'E', { pantry: true }],
  sesame:        ['Graines de sésame',          'g',     606, 17.7,   12.8,  49.7,  'flavor', 10, 'E', { pantry: true }],
  chocolat:      ['Chocolat noir 85%',          'g',     590, 11,   20,  50,  'flavor', 15, 'E', { pantry: true }],
  granola:       ['Granola nature',             'g',     450, 10,    61.2,  16.5,  'carb', 6,   'E', { lv: 'S', min: 30, max: 80, pack: 500 }],
  chia:          ['Graines de chia',            'g',     454, 16.5,   7.7,   30.7,  'fat', 12,  'E', { lv: 'S', min: 15, max: 40, pack: 250 }],
  cacao:         ['Cacao non sucré',            'g',     387, 22.4,   11.6,  20.6,  'flavor', 12, 'E', { pantry: true }],
  soja:          ['Sauce soja allégée en sel',                 'ml',    107,  9.7,    6.9,   0,   'flavor', 6,  'E', { pantry: true }],
  miel:          ['Miel',                       'g',     331, 0.7,  82.1,  0,   'flavor', 10, 'E', { pantry: true }],
  agave:         ["Sirop d'agave",              'g',     317.5, 0.3,    78,  0.5,   'flavor', 10, 'E', { pantry: true }],
  pate_curry:    ['Pâte de curry',              'g',     150, 2,    12,  9,   'flavor', 15, 'E', { pantry: true }],
  moutarde:      ['Moutarde',                   'g',     151, 6.9,    4.3,   11.2,  'flavor', 4,  'E', { pantry: true }],
  concentre:     ['Concentré de tomate',        'g',     99.2,  4.4,  17.1,  0.5, 'flavor', 6,  'E', { pantry: true }],
  bouillon:      ['Bouillon cube',              'pièce', 23.7,  1.1,  2,   1.2, 'flavor', 0.15, 'E', { pantry: true }],
  epices:        ['Épices',                     'g',     327, 12.6,   37.8,  7.8,  'flavor', 0,  'E', { pantry: true }],
  levure:        ['Levure chimique',            'g',     108, 0.1,    26.9,  0,   'flavor', 5,  'E', { pantry: true }],

  // ── Ajouts « cuisines du monde » ───────────────────────────────
  haut_cuisse:   ['Haut de cuisse de poulet', 'g', 116, 19.7, 0, 4.1, 'protein', 9,  'V', { lv: 'P', min: 110, max: 350, fridge: 3, pack: 500, snap: true, packs: [500, 250], edible: 0.85 }],
  boeuf_emince:  ['Bœuf à émincer (macreuse)', 'g',     118, 21.8,   0,   3.4, 'protein', 14,  'V', { lv: 'P', min: 110, max: 350, fridge: 3, pack: 500, snap: true, packs: [500, 250] }],
  aubergine:     ['Aubergine',                  'g',     22.9,  1,    2.7,   0.2, 'veg', 3,   'F', { buy: 300 }],
  tomate:        ['Tomates',                    'g',     19.2,  0.6,  3.7,   0.2, 'veg', 3,   'F', {}],
  pousses_soja:  ['Pousses de soja',            'g',     28.3,  2.6,    3.4,   0.2, 'veg', 6,   'F', {}],
  citron_vert:   ['Citron vert (jus)',          'ml',    25.7,  0.2,  1.7,   0.2, 'flavor', 8, 'F', {}],
  gingembre:     ['Gingembre frais',            'g',     33.3,  1.1,  3.4,  1.1, 'flavor', 10, 'F', {}],
  citronnelle:   ['Citronnelle',                'g',     99,  1.8,  25,  0.5, 'flavor', 12, 'F', {}],
  haricots_noirs:['Haricots noirs (conserve)',  'g',     110, 7.5,  14,  0.5, 'legume', 3.5, 'S', { lv: 'P', min: 80, max: 200, pack: 250 }],
  orzo:          ['Orzo',                       'g',     355, 12.5, 70,  1.8, 'carb', 3,  'S', { cook: 2.3, lv: 'P', min: 50, max: 180, minP: 100, pack: 500 }],
  baguette:      ['Baguette',                   'g',     287, 8.3,    58.3,  1.4, 'carb', 3,  'S', { buy: 250, lv: 'P', min: 70, max: 200, minP: 100 }],
  pain_burger:   ['Pain burger complet',        'g',     296, 8.6,    48.2,  6.2, 'carb', 6,  'S', { pack: 280 }],
  cheddar:       ['Cheddar (tranches)',         'g',     300, 17,   4,   24,  'dairy', 14, 'L', { lv: 'P', min: 20, max: 40, pack: 200 }],
  olives:        ['Olives vertes',              'g',     164, 1.1,    0.6,   16.6,  'fat', 10,  'E', { lv: 'P', min: 15, max: 50, pantry: true }],
  cacahuetes:    ['Cacahuètes grillées',        'g',     644, 23.5,   14.4,  51.9,  'fat', 9,   'E', { lv: 'P', min: 10, max: 30, pantry: true }],
  nuoc_mam:      ['Sauce nuoc mam',             'ml',    81.2,  9.3,    10.9,   0,   'flavor', 8,  'E', { pantry: true }],
  mirin:         ['Mirin',                      'ml',    230, 0.3,  43,  0,   'flavor', 8,  'E', { pantry: true }],
  gochujang:     ['Gochujang',                  'g',     220, 4,    45,  1.5, 'flavor', 15, 'E', { pantry: true }],
  miso:          ['Pâte miso',                  'g',     188, 11.7,   18.1,  6,   'flavor', 15, 'E', { pantry: true }],
  fecule:        ['Fécule de maïs',             'g',     365, 0.3,  90.4,  0.1, 'flavor', 4,  'E', { pantry: true }],
  panko:         ['Panko',                      'g',     375, 12,   73,  3.5, 'flavor', 7,  'E', { pantry: true }],
  citron_confit: ['Citron confit',              'g',     30,  0.5,  5,   1,   'flavor', 15, 'E', { pantry: true }],
  chipotle:      ['Piment chipotle (adobo)',    'g',     60,  1.5,  10,  1.5, 'flavor', 15, 'E', { pantry: true }],
  cornichons:    ['Cornichons',                 'g',     16,  1.1,  0.8,   0.3, 'flavor', 6,  'E', { pantry: true }],
  vinaigre_riz:  ['Vinaigre de riz',            'ml',    20,  0,    4,   0,   'flavor', 5,  'E', { pantry: true }],

  mangue:        ['Mangue (surgelée)',          'g',     71.1,  0.6,  14.3,  0.2, 'fruit', 5,   'F', { lv: 'S', min: 80, max: 200 }],
  pistaches:     ['Pistaches décortiquées',     'g',     631, 18.4,   14.9,  51.6,  'fat', 25,   'E', { lv: 'S', min: 10, max: 35, pantry: true }],
  tahini:        ['Tahini (purée de sésame)',   'g',     631, 17.7,   13.8,  53.4,  'fat', 12,   'E', { lv: 'S', min: 10, max: 25, pantry: true }],
  nori:          ['Feuilles de nori',           'g',     257, 30.2,   11.7,  1.8,   'flavor', 80, 'E', { pantry: true }],

  carre_frais:   ['Carré frais',                'g',     240, 6.5,  3,   23,  'dairy', 11,  'L', { lv: 'S', min: 20, max: 50, pack: 200 }],
  saumon_fume:   ['Saumon fumé',                'g',     180, 22,   0,   10,  'protein', 30, 'V', { lv: 'S', min: 20, max: 60, pack: 100 }],
  radis:         ['Radis',                      'g',     11,  0.9,  1.5,   0.2, 'veg', 4,   'F', {}],

  // ── Imprévu : repas pris dehors, par « tiers de repas » de 300 kcal (estimation) ──
  repas_ext:     ['Repas à l\'extérieur (estimation)', 'pièce', 300, 13, 32, 13, 'other', 0, 'E', {}],
  // ── Ajouts de la reprise des recettes (faciles à trouver en supermarché) ──
  feuille_riz:   ['Feuilles de riz',            'g',     340, 6,    80,  0.5, 'carb', 9,   'E', { pack: 200 }],
  chou_chinois:  ['Chou chinois',               'g',     16,  1.2,  2.2, 0.2, 'veg', 2.5,  'F', { buy: 800 }],
  tomates_sechees: ['Tomates séchées (bocal, égouttées)', 'g', 182.6, 5.1, 8, 13.2, 'flavor', 14, 'E', { pack: 280 }],
  ketchup:       ['Ketchup',                    'g',     108, 1.2,  23.7,  0.2, 'flavor', 3,  'E', { pantry: true }],
  vinaigre_cidre: ['Vinaigre de cidre',         'ml',    20,  0,    1,   0,   'flavor', 2,  'E', { pantry: true }],
  nouilles_oeufs: ['Nouilles aux œufs',         'g',     371, 11.9,   71,  3,   'carb', 4,    'S', { cook: 2.3, lv: 'P', min: 60, max: 170, minP: 90, pack: 250 }],
  boudoirs:      ['Boudoirs',                   'g',     366, 7.8,    74.5,  3.4, 'carb', 6,    'E', { pack: 200 }],
  coco_rapee:    ['Noix de coco râpée',         'g',     692, 6.8,  7.8, 66.8,  'fat', 10,   'E', { min: 10, max: 30, pantry: true }],
  cornflakes:    ['Corn-flakes nature',         'g',     372, 6.9,  82.4,  0.7,   'carb', 4,    'E', { pack: 500 }],
  oignons_frits: ['Oignons frits',              'g',     590, 6,    45,  42,  'flavor', 12, 'E', { pantry: true }],
  mayo_allegee:  ['Mayonnaise allégée',         'g',     297, 1.1,    8.8,   28.5,  'fat', 5,    'E', { pantry: true }],
  gnocchis:      ['Gnocchis (frais)',           'g',     176, 4.7,    35,  1.4, 'carb', 4,    'S', { lv: 'P', min: 150, max: 380, minP: 200, pack: 500 }],
  jambon_blanc:  ['Jambon blanc (tranches)',    'g',     110, 20,   1,   3,   'protein', 12,  'V', { lv: 'S', min: 40, max: 120, pack: 160 }],
  sauce_chili:   ['Sauce chili douce (thaï)',   'g',     220, 0.5,  53,  0.3, 'flavor', 6,  'E', { pantry: true }],
  sriracha:      ['Sauce sriracha',             'g',     95,  2,    19,  1,   'flavor', 10, 'E', { pantry: true }],
  // ── Sans lactose (v155)
  yaourt_sl:     ['Yaourt nature sans lactose', 'g',     62,  3.8,  4.5, 3,   'dairy', 4.5, 'L', { lv: 'S', min: 100, max: 250, pack: 500 }],
  boisson_avoine:['Boisson à l\'avoine',         'ml',    41,  0.2,    7.8,   1.1, 'dairy', 1.6, 'L', { pack: 1000 }],
  creme_coco:    ['Crème de coco',              'ml',    199, 1.9,    4.3,   19.2,  'fat', 5,    'L', { lv: 'P', min: 15, max: 50, pack: 200 }],
  // ── Sans gluten (v156)
  pates_sg:      ['Pâtes sans gluten',          'g',     358, 6.1,    79,  1.5, 'carb', 4.0,  'S', { cook: 2.3, lv: 'P', min: 60, max: 180, minP: 100, pack: 500 }],
  pain_sg:       ['Pain sans gluten',           'g',     249, 4.6,    37.1,  6.6,   'carb', 8.0,  'S', { lv: 'PS', min: 40, max: 120, pack: 250 }],
  wrap_sg:       ['Wraps sans gluten',          'g',     300, 4,    55,  6,   'carb', 10,   'S', { lv: 'P', min: 60, max: 180, minP: 120, pack: 240 }],
  tamari:        ['Tamari (sauce soja sans gluten)', 'ml', 60, 10,  5,   0,   'flavor', 15, 'E', { pantry: true }],
  // ── Repas libre : part de la journée réservée, par tranches de 100 kcal (non cuisiné, non acheté) ──
  repas_libre:   ['Repas libre (part réservée)', 'pièce', 100, 5, 11, 4, 'other', 0, 'E', {}],

  // ── Cantine (estimation, pas acheté) ───────────────────────────
  feculents_cuits:['Féculents cuits (cantine)', 'g',     140, 5,    28,  1,   'carb', 0,   'E', {}],

  // ── v205 : soupes (option « Soupe », pas encore proposée par le moteur) — valeurs Ciqual ──
  poireau:       ['Poireaux',                   'g',     30,  1.5,  4.5, 0.3, 'veg', 2.5, 'F', { buy: 200 }],
  butternut:     ['Courge butternut',           'g',     30.5,  1,    5.4, 0.1, 'veg', 2,   'F', { buy: 1000 }],
  pois_casses:   ['Pois cassés (secs)',         'g',     347, 23.8,   47.5,  1.2, 'legume', 3, 'S', { cook: 2.4, pack: 500 }],
  lin:           ['Graines de lin moulues',     'g',     528, 19,   6.5,   40.3,  'fat', 8,   'E', { pantry: true }],
  // ── v207 : plats du PDF de Pierre — valeurs Ciqual ──
  sardines:      ['Sardines à l\'huile (égouttées)', 'g', 217, 23.3, 0.3,   13.7,  'protein', 14, 'E', { lv: 'P', min: 80, max: 200, pack: 100 }],
  maquereau:     ['Maquereau au naturel (égoutté)', 'g',  221, 18.8,  0,   16.2, 'protein', 12, 'E', { lv: 'P', min: 80, max: 200, pack: 125 }],
  betterave:     ['Betterave cuite',            'g',     41.5,  1.4,  7.1, 0.4, 'veg', 3,   'F', { pack: 500 }],
  mache:         ['Mâche',                      'g',     15,  2,    0.5, 0.2, 'veg', 12,  'F', { buy: 125 }],
  // ── v213 : recettes d'automne — valeurs Ciqual ──
  riz_risotto:   ['Riz à risotto (arborio)',    'g',     350, 7,    78,  0.6, 'carb', 3,    'S', { cook: 2.5, lv: 'P', min: 60, max: 180, minP: 85, pack: 1000 }],
  polenta:       ['Polenta (précuite)',         'g',     350, 7.9,    74,  1.8, 'carb', 2.5,  'S', { cook: 4, lv: 'P', min: 50, max: 150, minP: 70, pack: 500 }],
  sirop_erable:  ['Sirop d\'érable',            'g',     269, 0,    67.2,  0.1, 'flavor', 15, 'E', { pantry: true }],
  chou:          ['Chou blanc',                 'g',     35.2,  1.4,  4.6,   0.6, 'veg', 1.5,  'F', { buy: 1000 }],
  chataignes:    ['Châtaignes cuites (sous vide)', 'g',  145, 2,  28.8,  1.4, 'carb', 10,  'E', { pack: 200 }],
  beurre:        ['Beurre',                     'g',     740, 0.7,  0.6, 82,  'fat', 9,    'L', { pantry: true }],
  noix:          ['Noix (cerneaux)',            'g',     709, 13.3,   6.9,   67.3,  'fat', 14,  'E', { pack: 200 }],
  // v281 : plats d'automne gourmands
  maroilles:     ['Maroilles',                  'g',     325, 21.9, 0, 26.4,  'dairy', 16, 'L', { lv: 'P', min: 20, max: 50, pack: 200 }],
  boursin:       ['Boursin ail et fines herbes','g',     385, 8.5, 3, 37,  'dairy', 20, 'L', { lv: 'P', min: 20, max: 45, pack: 150 }],
  gorgonzola:    ['Gorgonzola',                 'g',     318, 19.5, 0, 26.9,  'dairy', 18, 'L', { lv: 'P', min: 20, max: 50, pack: 200 }],
  mozzarella:    ['Mozzarella',                 'g',     227, 16.5, 0.7, 17.7,  'dairy', 10, 'L', { lv: 'P', min: 30, max: 80, pack: 125 }],
  biere:         ['Bière brune',                'ml',    40.5, 0.4, 4.1, 0,   'flavor', 3, 'E', { pack: 330 }],
  pain_epices:   ["Pain d'épices",              'g',     318, 3.1, 71.8, 1.2, 'flavor', 8, 'E', { pack: 300 }],
  potimarron:    ['Potimarron',                 'g',     22, 1, 3.1, 0.3, 'veg', 2.5,  'F', { buy: 1200 }],
  poire:         ['Poire',                      'g',     57, 0.4, 12.3, 0.3, 'fruit', 3,  'F', { buy: 180 }],
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
    edible: opts.edible || 1,
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

// v297 : fruits et légumes comptés comme on les achète (« 2 oignons », pas « 140 g d'oignon »).
//   g : poids utilisé d'une pièce (ou ml de jus pour les citrons)
//   self : l'unité est le produit lui-même (« 2 oignons ») ; sinon « ½ barquette de champignons »
//   snap : chaque plat cuisiné en session utilise des pièces entières (weekgen.snapPieces) ;
//   half : les très gros légumes peuvent aller à la demi-pièce ; step : arrondi d'affichage (0,25 par défaut)
export const PIECES = {
  oignon:       { g: 120,  one: 'oignon', many: 'oignons', self: true, snap: true },
  carotte:      { g: 100,  one: 'carotte', many: 'carottes', self: true, snap: true },
  poivron:      { g: 180,  one: 'poivron', many: 'poivrons', self: true, snap: true },
  courgette:    { g: 250,  one: 'courgette', many: 'courgettes', self: true, snap: true },
  aubergine:    { g: 300,  one: 'aubergine', many: 'aubergines', self: true, snap: true },
  tomate:       { g: 120,  one: 'tomate', many: 'tomates', self: true, snap: true },
  concombre:    { g: 350,  one: 'concombre', many: 'concombres', self: true, snap: true, half: true },
  patate_douce: { g: 300,  one: 'patate douce', many: 'patates douces', self: true, snap: true },
  poireau:      { g: 200,  one: 'poireau', many: 'poireaux', self: true, snap: true },
  butternut:    { g: 1000, one: 'courge butternut', many: 'courges butternut', self: true, snap: true, half: true },
  potimarron:   { g: 1200, one: 'potimarron', many: 'potimarrons', self: true, snap: true, half: true },
  chou:         { g: 1000, one: 'chou blanc', many: 'choux blancs', self: true, snap: true, half: true },
  pomme:        { g: 150,  one: 'pomme', many: 'pommes', self: true, snap: true },
  poire:        { g: 180,  one: 'poire', many: 'poires', self: true, snap: true },
  banane:       { g: 120,  one: 'banane', many: 'bananes', self: true, snap: true },
  citron:       { g: 35,   one: 'citron', many: 'citrons', self: true, snap: true, juice: true },
  citron_vert:  { g: 25,   one: 'citron vert', many: 'citrons verts', self: true, snap: true, juice: true },
  champignons:  { g: 250,  one: 'barquette', many: 'barquettes', snap: true, half: true },
  fruit_saison: { g: 150,  one: 'fruit de saison', many: 'fruits de saison', self: true },
  // v306 : fruits de la semaine (poids comestible d'une pièce)
  clementine:   { g: 60,   one: 'clémentine', many: 'clémentines', self: true, snap: true, step: 1 },
  kiwi:         { g: 75,   one: 'kiwi', many: 'kiwis', self: true, snap: true, step: 1 },
  orange:       { g: 150,  one: 'orange', many: 'oranges', self: true, snap: true },
  kaki:         { g: 180,  one: 'kaki', many: 'kakis', self: true, snap: true },
  raisin:       { g: 150,  one: 'grappe de raisin', many: 'grappes de raisin', self: true, snap: true },
  fraises:      { g: 250,  one: 'barquette de fraises', many: 'barquettes de fraises', self: true, snap: true },
  abricot:      { g: 45,   one: 'abricot', many: 'abricots', self: true, snap: true, step: 1 },
  peche:        { g: 150,  one: 'pêche', many: 'pêches', self: true, snap: true },
  prune:        { g: 40,   one: 'prune', many: 'prunes', self: true, snap: true, step: 1 },
  pamplemousse: { g: 250,  one: 'pamplemousse', many: 'pamplemousses', self: true, snap: true },
  salade:       { g: 250,  one: 'salade', many: 'salades', self: true },
  tomates_cerise: { g: 250, one: 'barquette', many: 'barquettes', step: 0.5 },
  herbes:       { g: 30,   one: 'bouquet', many: 'bouquets' },
  gingembre:    { g: 5,    one: 'cm', many: 'cm', step: 1 },
  ail:          { g: 1,    one: "gousse d'ail", many: "gousses d'ail", self: true, step: 1 },
};
const FRAC = { 0.25: '¼', 0.5: '½', 0.75: '¾' };
// « ¼ », « 1 », « 2 ½ »
function fracText(n) {
  const w = Math.floor(n + 1e-9), f = Math.round((n - w) * 4) / 4;
  if (!f) return String(w);
  return w ? `${w} ${FRAC[f]}` : FRAC[f];
}
// Nombre de pièces arrondi (au quart, à la demi-pièce ou à l'unité), jamais zéro
export function pieceCount(key, qty) {
  const P = PIECES[key]; if (!P) return null;
  const step = P.step || 0.25;
  return Math.max(step, Math.round(qty / P.g / step) * step);
}
// Texte d'une quantité en pièces : « 2 oignons », « ½ barquette », « 3 cm »
function pieceText(key, qty) {
  const P = PIECES[key], n = pieceCount(key, qty);
  return `${fracText(n)} ${n >= 2 ? P.many : P.one}`;
}
// Quantité seule, à côté du nom du produit dans une liste (« Oignons · 2 », « Champignons · ½ barquette »)
export function qtyShort(key, qty, unit, opts = {}) {
  const P = PIECES[key];
  if (P && qty > 0) return P.self ? fracText(pieceCount(key, qty)) : pieceText(key, qty);
  return humanQty(key, qty, unit, opts);
}
// Quantité suivie du produit, pour une phrase : « 2 oignons », « ½ barquette de champignons de Paris »,
// « 150 g de riz complet »
export function qtyWithName(key, qty, unit, name) {
  const P = PIECES[key];
  const nm0 = (name || INGREDIENTS[key]?.name || '').split(' (')[0];
  const nm = nm0.charAt(0).toLowerCase() + nm0.slice(1); // « champignons de Paris »
  if (P && qty > 0) {
    if (P.self) return pieceText(key, qty);
    return `${pieceText(key, qty)} ${/^[aeiouhéèêâîôûœ]/i.test(nm) ? "d'" : 'de '}${nm}`;
  }
  const q = humanQty(key, qty, unit);
  if (NATURAL_UNITS[key]) return new RegExp(NATURAL_UNITS[key].one, 'i').test(nm) ? q : `${q} ${/^[aeiouhéèêâîôûœ]/i.test(nm) ? "d'" : 'de '}${nm}`;
  if (unit === 'pièce') return `${q} ${nm}`;
  return `${q} ${/^[aeiouhéèêâîôûœ]/i.test(nm) ? "d'" : 'de '}${nm}`;
}

// Quantité lisible : « 2 tranches », « 3 œufs », « 150 g », « 2 oignons »
export function humanQty(key, qty, unit, opts = {}) {
  const db = INGREDIENTS[key];
  if (PIECES[key] && qty > 0) return pieceText(key, qty);
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

// v195 : les « Épices » de chaque recette, nommées (rayon épices Lidl). Affichées sur la fiche,
// dans la session de cuisine et dans le placard de la liste de courses.
export const SPICES = {
  W01: 'curry en poudre', W04: 'origan', W05: 'cumin, paprika', W06: 'cumin, paprika',
  W07: 'cumin, curcuma, gingembre en poudre, cannelle', W08: 'paprika fumé, piment', W09: 'cumin, paprika, origan',
  W11: 'paprika fumé, piment', W12: 'curry en poudre', W13: 'piment', W14: 'curry en poudre, paprika, cumin, curcuma',
  W15: 'cumin, paprika, origan, piment', W16: 'cumin, paprika, piment', W17: 'cumin, paprika fumé', W19: 'piment',
  W20: 'paprika fumé, piment', W21: 'paprika fumé, piment', W25: 'cumin, paprika', W28: 'paprika',
  W29: 'paprika, piment, cannelle', W30: 'paprika, piment', W32: 'cumin, paprika fumé, ail en poudre, piment',
  W33: 'herbes de Provence', W35: 'paprika, ail en poudre, piment', W36: 'cumin, paprika, ail en poudre, piment',
  W39: 'herbes de Provence', W40: 'cumin, paprika, cannelle', W41: 'herbes de Provence',
  W43: 'paprika, cumin, ail en poudre, cannelle, piment', W44: 'curry en poudre, curcuma', W45: 'origan',
  W46: 'paprika fumé, ail en poudre', W47: 'origan', W48: 'origan', W49: 'paprika, ail en poudre', W50: 'thym',
  W51: 'origan', W52: 'paprika fumé, piment', W53: 'origan', W55: 'paprika', W57: 'paprika fumé, ail en poudre, origan, thym, piment',
  W58: 'paprika, cumin, origan, ail en poudre', W60: 'paprika', W61: 'paprika', W62: 'origan, piment', W64: 'herbes de Provence',
  W65: 'paprika', W66: 'cumin, paprika fumé', W67: 'cumin, origan', W68: 'garam masala, cumin, curcuma, piment',
  W69: 'cumin, paprika, cannelle, gingembre en poudre', W70: 'cumin, paprika, cannelle, curcuma', W71: 'cumin, paprika fumé, piment',
  W72: 'garam masala, curcuma', W73: 'paprika fumé, cumin, ail en poudre', W74: 'ail en poudre', W75: 'piment',
  B02: 'cannelle', B16: 'cannelle', K12: 'piment',
  W76: 'curcuma, paprika', W77: 'curcuma', W78: 'cumin, paprika, coriandre moulue', W79: 'cumin, gingembre en poudre, paprika fumé',
  W95: 'thym', W97: 'muscade', W98: 'paprika, poivre concassé', W101: 'thym',
  W81: 'origan, paprika', W82: 'thym', W83: 'cumin, paprika, piment', W84: 'thym, laurier', W85: 'thym', 
  W89: 'cumin, paprika fumé, piment', 
  SO07: 'origan, piment', SO10: 'laurier', SO11: 'paprika doux, cumin', SO15: 'cumin, paprika, menthe séchée', K22: 'cannelle', K23: 'cannelle', K24: 'cannelle, muscade', SO08: 'thym', SO09: 'thym, laurier',
  SO01: 'curry en poudre', SO02: 'laurier, poivre', SO03: 'curcuma', SO04: 'cumin, curcuma, coriandre moulue, poivre, laurier',
};
export const spicesOf = id => (id && (SPICES[id] || SPICES[String(id).replace(/S$/, '')])) || '';

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
  // v308 : café soluble (tiramisus) ; absent de Ciqual en poudre : valeurs USDA du café instantané en poudre
  cafe:          ['Café soluble',               'g',     353, 12.2, 75.4, 0.5,  'flavor', 30, 'E', { pantry: true }],
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
  // v308 : épices citées dans les étapes mais absentes de la liste
  W10: 'paprika fumé', W102: 'thym, laurier', W105: 'paprika', W107: 'thym, laurier', W109: 'origan, laurier', W110: 'paprika',
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
  W72: 'garam masala, curry en poudre, curcuma', W73: 'paprika fumé, cumin, ail en poudre', W74: 'ail en poudre', W75: 'piment',
  B02: 'cannelle', B16: 'cannelle', K12: 'piment',
  W76: 'curcuma, paprika', W77: 'curcuma', W78: 'cumin, paprika, coriandre moulue', W79: 'cumin, gingembre en poudre, paprika fumé',
  W95: 'thym', W97: 'muscade', W98: 'paprika, poivre concassé', W101: 'thym',
  W81: 'origan, paprika', W82: 'thym', W83: 'cumin, paprika, piment', W84: 'thym, laurier', W85: 'thym', 
  W89: 'cumin, paprika fumé, piment', 
  SO07: 'origan, piment', SO10: 'laurier', SO11: 'paprika doux, cumin', SO15: 'cumin, paprika, menthe séchée', K22: 'cannelle', K23: 'cannelle', K24: 'cannelle, muscade', SO08: 'thym', SO09: 'thym, laurier',
  SO01: 'curry en poudre', SO02: 'laurier, poivre', SO03: 'curcuma', SO04: 'cumin, curcuma, coriandre moulue, poivre, laurier',
};
// v309 : assaisonnement en cuillères à café par portion (Pierre : « la quantité d'épice en cuillère à café, à
// chaque fois », « certains plats manquent d'assaisonnement »). Bloc généré par outils/recettes/epices/fusion.js
// depuis outils/recettes/epices/epices.json : quantités par portion (laurier en feuilles), étapes réécrites avec
// des repères [[épice]] que l'appli remplace par la quantité (fiche : 1 portion ; session : toutes les portions).
// <<épices générées
export const SPICE_QTY = {
  W01: {"sel":0.125,"poivre":0.125,"curry en poudre":1,"cumin":0.25,"piment":0.0625},
  W02: {"sel":0.125,"poivre":0.125,"piment":0.0625},
  W03: {"sel":0.0625,"poivre":0.125},
  W04: {"sel":0.25,"poivre":0.125,"origan":0.5,"aneth séché":0.125},
  W05: {"sel":0.25,"poivre":0.125,"cumin":0.5,"paprika":0.5,"piment":0.0625,"menthe séchée":0.125},
  W06: {"sel":0.25,"poivre":0.125,"cumin":0.5,"paprika":0.5,"quatre-épices":0.125},
  W07: {"sel":0.125,"poivre":0.125,"cumin":0.5,"paprika":0.5,"curcuma":0.25,"gingembre en poudre":0.25,"cannelle":0.125},
  W08: {"sel":0.25,"poivre":0.125,"paprika fumé":0.75,"cumin":0.5,"origan":0.25,"piment":0.0625},
  W09: {"sel":0.25,"poivre":0.125,"paprika":0.75,"cumin":0.5,"coriandre moulue":0.25,"origan":0.25,"piment":0.0625},
  W10: {"sel":0.125,"poivre":0.125,"paprika fumé":0.5,"ail en poudre":0.25},
  W11: {"sel":0.125,"poivre":0.125,"paprika fumé":0.25,"gingembre en poudre":0.125,"piment":0.125},
  W12: {"sel":0.1875,"poivre":0.125,"curry en poudre":1,"gingembre en poudre":0.125,"cannelle":0.0625},
  W13: {"sel":0.125,"poivre":0.125,"cinq-épices":0.125,"piment":0.0625},
  W14: {"sel":0.25,"poivre":0.125,"paprika":0.5,"curcuma":0.25,"curry en poudre":0.5,"cumin":0.5,"garam masala":0.5,"piment":0.0625},
  W15: {"sel":0.1875,"poivre":0.125,"cumin":0.5,"paprika":0.75,"origan":0.25,"piment":0.0625},
  W16: {"sel":0.25,"poivre":0.125,"paprika":0.5,"cumin":0.5,"piment":0.0625},
  W17: {"sel":0.125,"poivre":0.125,"cumin":0.5,"paprika fumé":0.5,"origan":0.25,"ail en poudre":0.25},
  W18: {"sel":0.0625,"poivre":0.125,"ail en poudre":0.25,"piment":0.0625},
  W19: {"sel":0.125,"poivre":0.125,"piment":0.125,"menthe séchée":0.125},
  W20: {"sel":0.0625,"poivre":0.125,"ail en poudre":0.25,"paprika fumé":0.25,"piment":0.125},
  W21: {"sel":0.0625,"poivre":0.125,"paprika fumé":0.25,"piment":0.125,"cinq-épices":0.125},
  W22: {"sel":0.0625,"poivre":0.125},
  W25: {"sel":0.25,"poivre":0.125,"cumin":0.5,"paprika":0.75,"cannelle":0.0625,"piment":0.0625},
  W27: {"sel":0.125,"poivre":0.125,"cumin":0.25,"ail en poudre":0.25,"piment":0.0625},
  W28: {"sel":0.25,"poivre":0.125,"paprika":0.5,"ail en poudre":0.25,"coriandre moulue":0.125,"piment":0.0625},
  W29: {"sel":0.25,"poivre":0.125,"paprika":1,"cumin":0.25,"coriandre moulue":0.25,"cardamome":0.0625,"cannelle":0.0625,"piment":0.125},
  W30: {"sel":0.25,"poivre":0.125,"paprika":0.75,"piment":0.125,"origan":0.25,"laurier":0.25},
  W46: {"sel":0.125,"poivre":0.125,"paprika fumé":0.5,"ail en poudre":0.25,"oignon en poudre":0.125,"muscade":0.0625},
  W47: {"sel":0.125,"poivre":0.125,"origan":0.5,"piment":0.0625},
  W48: {"sel":0.1875,"poivre":0.125,"origan":0.5,"thym":0.25,"muscade":0.0625},
  W49: {"sel":0.25,"poivre":0.125,"paprika":0.5,"ail en poudre":0.25,"romarin":0.25},
  W50: {"sel":0.1875,"poivre":0.125,"thym":0.5,"paprika":0.5},
  W51: {"sel":0.1875,"poivre":0.125,"origan":0.5,"thym":0.25,"muscade":0.0625},
  W52: {"sel":0.125,"poivre":0.125,"paprika fumé":0.5,"cumin":0.25,"piment":0.0625,"paprika":0.125,"ail en poudre":0.125},
  W53: {"sel":0.125,"poivre":0.125,"origan":0.5,"ail en poudre":0.125},
  W54: {"sel":0.0625,"poivre":0.125,"cinq-épices":0.125,"piment":0.0625},
  W55: {"poivre":0.125,"paprika":0.25,"aneth séché":0.125},
  W56: {"sel":0.0625,"poivre":0.125,"paprika":0.5},
  W57: {"sel":0.1875,"poivre":0.125,"paprika fumé":0.75,"ail en poudre":0.25,"origan":0.25,"thym":0.25,"piment":0.0625},
  W58: {"sel":0.1875,"poivre":0.125,"paprika":0.5,"cumin":0.5,"origan":0.25,"ail en poudre":0.25,"coriandre moulue":0.125,"piment":0.0625},
  W59: {"sel":0.0625,"poivre":0.125,"origan":0.25},
  W60: {"sel":0.25,"poivre":0.125,"paprika":1,"laurier":0.25},
  W61: {"sel":0.1875,"poivre":0.125,"paprika":0.5,"thym":0.25},
  W62: {"sel":0.1875,"poivre":0.125,"origan":0.5,"piment":0.0625},
  W63: {"sel":0.25,"poivre":0.125,"thym":0.25,"muscade":0.0625},
  W64: {"sel":0.25,"poivre":0.125,"herbes de Provence":0.5,"paprika":0.25},
  W65: {"sel":0.1875,"poivre":0.125,"paprika":0.5,"paprika fumé":0.25,"aneth séché":0.125},
  W66: {"sel":0.25,"poivre":0.125,"paprika fumé":0.5,"cumin":0.375},
  W67: {"sel":0.125,"poivre":0.125,"cumin":0.5,"origan":0.375,"laurier":0.25},
  W68: {"sel":0.25,"poivre":0.125,"garam masala":0.75,"cumin":0.5,"coriandre moulue":0.25,"curcuma":0.25,"piment":0.0625},
  W69: {"sel":0.25,"poivre":0.125,"cumin":0.5,"paprika":0.5,"gingembre en poudre":0.25,"cannelle":0.125,"curcuma":0.125},
  W70: {"sel":0.25,"poivre":0.125,"cumin":0.5,"paprika":0.5,"coriandre moulue":0.25,"curcuma":0.25,"cannelle":0.125,"cardamome":0.0625},
  W71: {"sel":0.25,"poivre":0.125,"cumin":0.5,"paprika fumé":0.5,"origan":0.25,"piment":0.0625},
  W72: {"sel":0.1875,"poivre":0.125,"garam masala":0.5,"curry en poudre":0.5,"cumin":0.5,"curcuma":0.25,"piment":0.0625},
  W73: {"sel":0.125,"poivre":0.125,"paprika fumé":0.75,"cumin":0.5,"ail en poudre":0.25,"origan":0.25,"piment":0.0625},
  W74: {"poivre":0.1875,"ail en poudre":0.25},
  W75: {"sel":0.1875,"poivre":0.125,"piment":0.0625,"laurier":0.25},
  W76: {"poivre":0.125,"curcuma":0.25,"paprika":0.5,"paprika fumé":0.25},
  W77: {"poivre":0.125,"curcuma":0.125,"piment":0.0625},
  W78: {"sel":0.25,"poivre":0.125,"cumin":0.5,"paprika":0.75,"coriandre moulue":0.25,"piment":0.0625},
  W79: {"sel":0.125,"poivre":0.125,"cumin":0.375,"gingembre en poudre":0.125,"paprika fumé":0.25},
  W80: {"sel":0.1875,"poivre":0.125,"aneth séché":0.125},
  W81: {"poivre":0.125,"origan":0.25,"paprika":0.5,"thym":0.125,"piment":0.0625},
  W82: {"sel":0.125,"poivre":0.125,"thym":0.25,"muscade":0.0625},
  W83: {"sel":0.25,"poivre":0.125,"cumin":0.5,"paprika":0.5,"menthe séchée":0.125,"piment":0.0625},
  W84: {"sel":0.125,"poivre":0.125,"thym":0.25,"laurier":0.25,"ail en poudre":0.25,"muscade":0.0625},
  W85: {"sel":0.125,"poivre":0.125,"thym":0.25,"muscade":0.0625},
  W89: {"sel":0.25,"poivre":0.125,"cumin":0.5,"paprika fumé":0.75,"origan":0.25,"cannelle":0.125,"piment":0.0625},
  W90: {"sel":0.125,"coriandre moulue":0.25},
  W93: {"poivre":0.125,"thym":0.125,"muscade":0.0625},
  W94: {"sel":0.0625,"poivre":0.125},
  W95: {"sel":0.125,"poivre":0.125,"thym":0.25,"laurier":0.25},
  W97: {"sel":0.1875,"poivre":0.125,"muscade":0.0625},
  W98: {"sel":0.125,"poivre":0.25,"paprika":0.5,"ail en poudre":0.25},
  W101: {"sel":0.1875,"poivre":0.125,"thym":0.25,"muscade":0.0625},
  SO07: {"poivre":0.125,"origan":0.5,"paprika":0.5,"piment":0.0625},
  SO08: {"sel":0.0625,"poivre":0.125,"thym":0.25,"muscade":0.0625},
  SO09: {"poivre":0.125,"thym":0.25,"laurier":0.25},
  SO10: {"sel":0.125,"poivre":0.125,"laurier":0.25,"paprika":0.25},
  SO11: {"sel":0.125,"poivre":0.125,"paprika":1,"cumin":0.25,"origan":0.25,"laurier":0.25,"piment":0.0625},
  SO15: {"sel":0.125,"poivre":0.125,"cumin":0.5,"paprika":0.5,"menthe séchée":0.25,"piment d'Espelette":0.125},
  W102: {"sel":0.125,"poivre":0.125,"thym":0.25,"laurier":0.25,"muscade":0.0625},
  W104: {"sel":0.125,"poivre":0.125,"thym":0.25,"muscade":0.0625},
  W105: {"sel":0.125,"poivre":0.125,"paprika":0.5,"muscade":0.0625},
  W106: {"sel":0.125,"poivre":0.125,"thym":0.25,"ail en poudre":0.25,"muscade":0.0625},
  W107: {"sel":0.1875,"poivre":0.125,"thym":0.25,"laurier":0.25,"muscade":0.0625},
  W109: {"sel":0.1875,"poivre":0.125,"origan":0.5,"laurier":0.25,"muscade":0.0625},
  W110: {"poivre":0.125,"paprika":0.5,"piment":0.0625,"thym":0.125},
  W114: {"sel":0.125,"poivre":0.125,"muscade":0.0625},
  W31: {"sel":0.125,"poivre":0.125,"cinq-épices":0.125},
  W32: {"sel":0.25,"poivre":0.125,"paprika fumé":0.5,"cumin":0.5,"ail en poudre":0.25,"piment":0.0625},
  W33: {"sel":0.125,"poivre":0.125,"herbes de Provence":0.5,"muscade":0.0625},
  W34: {"sel":0.0625,"poivre":0.125,"cinq-épices":0.125},
  W35: {"sel":0.125,"poivre":0.125,"paprika":0.75,"oignon en poudre":0.25,"piment":0.0625,"ail en poudre":0.125},
  W36: {"sel":0.125,"poivre":0.125,"cumin":0.5,"paprika":0.75,"origan":0.25,"ail en poudre":0.25,"piment":0.0625},
  W37: {"poivre":0.125,"gingembre en poudre":0.125},
  W38: {"poivre":0.125,"cinq-épices":0.125},
  W39: {"sel":0.1875,"poivre":0.125,"herbes de Provence":0.5,"laurier":0.25},
  W40: {"sel":0.1875,"poivre":0.125,"cumin":0.5,"paprika":0.5,"cannelle":0.125,"quatre-épices":0.125,"menthe séchée":0.125},
  W41: {"sel":0.125,"poivre":0.125,"herbes de Provence":0.5},
  W43: {"sel":0.1875,"poivre":0.125,"paprika":0.75,"cumin":0.5,"coriandre moulue":0.25,"ail en poudre":0.25,"cannelle":0.125,"piment":0.0625},
  W44: {"sel":0.25,"poivre":0.125,"curry en poudre":0.75,"curcuma":0.25,"garam masala":0.25},
  W45: {"poivre":0.125,"origan":0.5,"piment":0.0625},
  SO01: {"poivre":0.125,"curry en poudre":0.75,"piment":0.0625},
  SO02: {"poivre":0.125,"laurier":0.25},
  SO03: {"poivre":0.125,"curcuma":0.25},
  SO04: {"sel":0.125,"poivre":0.125,"cumin":0.5,"curcuma":0.25,"coriandre moulue":0.25,"paprika fumé":0.25,"laurier":0.25},
  SO06: {"sel":0.125,"poivre":0.125,"cumin":0.25,"muscade":0.0625},
  B01: {"vanille":0.25,"sel":0.0625},
  B02: {"cannelle":0.5,"vanille":0.25},
  B06: {"sel":0.125,"poivre":0.125,"muscade":0.0625,"origan":0.25},
  B07: {"ail en poudre":0.125,"herbes de Provence":0.25,"poivre":0.125},
  B15: {"sel":0.125,"poivre":0.125},
  B16: {"cannelle":0.5,"sel":0.0625,"vanille":0.25},
  K05: {"vanille":0.25},
  K06: {"cannelle":0.25,"vanille":0.25,"sel":0.0625},
  K08: {"cannelle":0.125,"sel":0.0625},
  K10: {"cannelle":0.25},
  K12: {"sel":0.125,"cumin":0.125,"piment":0.0625,"poivre":0.0625},
  K13: {"aneth séché":0.125,"poivre":0.125},
  K15: {"sel":0.0625},
  K16: {"vanille":0.25},
  K17: {"cannelle":0.125,"sel":0.0625},
  K18: {"vanille":0.25,"sel":0.0625},
  K19: {"vanille":0.25,"sel":0.0625},
  K20: {"cannelle":0.25,"sel":0.0625},
  K21: {"cannelle":0.25,"vanille":0.25,"sel":0.0625},
  K22: {"cannelle":0.375,"sel":0.0625},
  K23: {"cannelle":0.5,"vanille":0.25},
  K24: {"cannelle":0.375,"gingembre en poudre":0.125,"muscade":0.0625,"quatre-épices":0.0625},
  S11: {"herbes de Provence":0.125,"poivre":0.125},
  S12: {"poivre":0.0625},
};
export const SPICE_STEPS = {
  W01: {"1":"Mets l'autocuiseur en mode dorer et fais revenir l'oignon 3 minutes dans l'huile. Ajoute l'ail, le gingembre et [[curry en poudre]], avec [[cumin]] et [[piment]], et remue 1 minute pour qu'ils dégagent leur parfum.","2":"Ajoute le poulet, l'aubergine, le poivron, le lait de coco, la sauce soja, [[sel]] et [[poivre]], puis mélange.","5":"Mise en boîtes : le riz et le poulet au curry côte à côte. La coriandre, si tu en as, reste à part."},
  W02: {"1":"Écrase l'ail. Mélange-le avec la moitié de la sauce soja, la moitié du jus de citron vert, le miel, l'huile, [[sel]] et [[poivre]]. Coupe le poulet en lanières et laisse-le mariner 15 minutes au frigo.","5":"Prépare la sauce : le reste de la sauce soja et du jus de citron vert, avec 2 cuillères à soupe d'eau et [[piment]]."},
  W03: {"1":"Dans la poêle, fais cuire l'oignon 6 minutes à feu moyen avec 100 ml d'eau par portion, la sauce soja, le miel, le vinaigre de cidre, le gingembre et [[poivre]].","3":"Fais revenir les épinards 4 minutes dans la poêle avec l'huile et [[sel]]."},
  W04: {"0":"Coupe le poulet en cubes de 3 cm. Mélange-le avec le jus de citron, [[origan]], [[sel]], [[poivre]], l'ail écrasé et l'huile, et laisse mariner 15 minutes, ou toute la nuit au frigo.","2":"Prépare le tzatziki : râpe le concombre, presse-le dans tes mains pour retirer l'eau, puis mélange-le avec le yaourt, une pointe d'ail et [[aneth séché]]."},
  W05: {"0":"Râpe l'oignon et hache le persil. Mélange-les avec le bœuf, [[cumin]], [[paprika]], [[piment]], [[sel]] et [[poivre]], puis forme des köfte allongées de la taille d'un doigt.","3":"Prépare le cacık : concombre en petits dés et yaourt, avec [[menthe séchée]]."},
  W06: {"2":"Rince le riz et les lentilles séparément. Mets le riz dans l'autocuiseur avec 1,7 fois son poids d'eau, ferme et laisse cuire 14 minutes sous pression, puis fais tomber la pression : le riz complet a besoin d'une avance sur les lentilles. Ajoute les lentilles, [[cumin]], [[sel]], [[poivre]], le reste de l'huile et 2 fois le poids des lentilles en eau. Referme, laisse cuire 6 minutes sous pression, puis laisse la pression retomber seule pendant 10 minutes : tout finit de cuire ensemble sans que les lentilles se défassent.","3":"Coupe le poulet en dés de 2 cm, assaisonne-le avec [[paprika]] et [[quatre-épices]], puis fais-le cuire 10 minutes à l'air fryer à 200 °C, jusqu'à ce qu'il ne soit plus rose au centre."},
  W07: {"1":"Mets l'autocuiseur en mode dorer et fais revenir 5 minutes le poulet, l'oignon, l'huile, [[cumin]], [[paprika]], [[curcuma]], [[gingembre en poudre]], [[cannelle]], [[sel]] et [[poivre]]."},
  W08: {"1":"Coupe le blanc de poulet en 2 ou 3 morceaux épais. Mets-les dans l'autocuiseur avec les tomates, l'oignon, l'ail, [[paprika fumé]], [[cumin]], [[origan]], [[piment]], [[sel]] et [[poivre]]. Ferme et laisse cuire 10 minutes sous pression, puis fais tomber la pression : le poulet doit se défaire facilement à la fourchette."},
  W09: {"1":"Coupe le poulet en lanières. Mélange-le avec la moitié du yaourt, [[paprika]], [[cumin]], [[coriandre moulue]], [[origan]], [[piment]], [[sel]], [[poivre]], l'ail écrasé et l'huile."},
  W10: {"0":"Coupe les patates douces en bâtonnets de 1 cm, mélange-les avec l'huile, [[paprika fumé]], [[ail en poudre]] et [[sel]], puis fais-les cuire 18 minutes à l'air fryer à 200 °C en secouant le panier deux fois.","3":"Divise la viande en boules (une par burger), saupoudre-les de [[poivre]], emballe-les une par une dans du film alimentaire et mets-les au congélateur tout de suite : la viande hachée crue ne se garde pas plus d'un jour au frigo."},
  W11: {"1":"Coupe le poulet en morceaux de 3 cm et enrobe-les de fécule mélangée avec [[sel]] et [[poivre]].","3":"Dans la poêle, chauffe 1 minute le miel, la sauce soja, le ketchup, l'ail écrasé, [[paprika fumé]], [[gingembre en poudre]] et [[piment]]. Ajoute le poulet et mélange pour bien l'enrober."},
  W12: {"1":"Mets-les dans l'autocuiseur avec [[curry en poudre]], [[gingembre en poudre]], [[cannelle]], [[sel]], le miel, la sauce soja et 200 ml d'eau par portion. Ferme et laisse cuire 5 minutes sous pression.","3":"Aplatis le poulet à 1 cm d'épaisseur et saupoudre-le de [[poivre]]. Passe-le dans l'œuf battu puis dans la chapelure, badigeonne-le d'huile et fais-le cuire 12 à 14 minutes à l'air fryer à 200 °C en le retournant à mi-cuisson."},
  W13: {"0":"Prépare les pickles : coupe la carotte en fins bâtonnets, couvre-la de vinaigre de cidre avec [[sel]] et laisse reposer au moins 30 minutes. Ils se gardent une semaine au frigo.","1":"Écrase l'ail et mélange-le avec le jus de citron vert, la sauce soja, le miel, [[cinq-épices]] et [[poivre]]. Coupe le poulet en lanières et laisse-le mariner 15 minutes au frigo.","3":"Prépare la sauce : yaourt et [[piment]]. Coupe le concombre en fines lamelles."},
  W14: {"0":"Coupe le poulet en morceaux de 3 cm et mélange-le avec le yaourt, [[paprika]], [[curcuma]] et [[sel]]. Laisse mariner 10 minutes, ou toute la nuit au frigo.","2":"Mets l'autocuiseur en mode dorer et fais revenir l'oignon, l'ail, le gingembre, [[curry en poudre]], [[cumin]] et [[piment]] 3 minutes, en remuant.","4":"Une fois la pression tombée, ajoute la crème, [[garam masala]] et [[poivre]], et mélange."},
  W15: {"1":"Mélange le poulet avec [[cumin]], [[paprika]], [[origan]], [[poivre]], la sauce soja, le jus de citron vert et l'ail écrasé. Laisse mariner 15 minutes.","2":"Coupe les pommes de terre en frites de 1 cm, rince-les, sèche-les bien dans un torchon et mélange-les avec l'huile et [[sel]].","4":"Prépare la salsa verde : herbes hachées très finement, yaourt, un filet de citron vert et [[piment]]."},
  W16: {"1":"Fais revenir le bœuf 5 minutes à la poêle en l'émiettant, jusqu'à ce qu'il ne soit plus rose. Ajoute la tomate, le poivron, l'oignon, le concentré de tomate, [[paprika]], [[cumin]], [[piment]], [[sel]] et [[poivre]], et laisse cuire encore 5 minutes : c'est la garniture."},
  W17: {"1":"Fais-les revenir 7 minutes à la poêle avec [[cumin]], [[paprika fumé]], [[origan]], [[ail en poudre]], [[sel]] et [[poivre]], en remuant : c'est la garniture de la semaine."},
  W18: {"1":"Fais cuire les nouilles aux œufs à l'autocuiseur : couvre-les d'eau juste à hauteur avec [[sel]], et fais-les cuire sous pression la moitié du temps indiqué sur le paquet, arrondi en dessous. Fais tomber la pression, égoutte et rince à l'eau froide. Si tu n'as pas trouvé de nouilles aux œufs, des spaghettis conviennent très bien.","2":"Prépare la sauce : sauce soja, miel, jus de citron vert, [[ail en poudre]], [[piment]] et [[poivre]]. Coupe la carotte et le poivron en fins bâtonnets et concasse les cacahuètes."},
  W19: {"2":"Hors du feu, ajoute la sauce soja, le jus de citron vert, l'oignon, [[piment]], [[menthe séchée]], [[sel]] et [[poivre]], puis mélange."},
  W20: {"0":"Émince finement le bœuf et mélange-le avec 15 ml de sauce soja, [[ail en poudre]] et [[poivre]]. Laisse mariner 10 minutes au frigo.","2":"À la poêle, fais sauter ensemble la carotte, la courgette et les épinards 4 minutes avec l'huile et [[sel]], puis réserve-les.","4":"Prépare la sauce : le miel, le ketchup, le reste de la sauce soja, [[paprika fumé]] et [[piment]], dans un petit pot."},
  W21: {"2":"Ajoute la sauce soja, le ketchup, le miel, [[paprika fumé]], [[piment]], [[cinq-épices]], [[poivre]] et 150 ml d'eau par portion, puis le tofu. Laisse mijoter 5 minutes à feu doux, sans trop remuer pour ne pas casser le tofu.","4":"Fais cuire le brocoli 10 minutes à l'air fryer à 200 °C, saupoudré de [[sel]]."},
  W22: {"0":"Coupe le saumon en pavés ou en cubes de 3 cm. Mélange la sauce soja, le miel, l'ail écrasé, le gingembre râpé et [[poivre]], et fais-y mariner le saumon 10 minutes au frigo.","1":"Égoutte le saumon (garde la marinade) et fais-le cuire 7 à 8 minutes à l'air fryer à 200 °C, avec le brocoli autour saupoudré de [[sel]] : la chair doit être opaque et se détacher en lamelles."},
  W25: {"0":"Hache le persil et l'oignon. Mélange le bœuf avec la moitié du persil, [[cumin]], [[cannelle]], [[sel]] et [[poivre]], puis forme des boulettes de la taille d'une noix.","1":"Dans la poêle, fais revenir l'oignon 3 minutes dans l'huile, ajoute les tomates, [[paprika]] et [[piment]], et laisse mijoter 8 minutes."},
  W27: {"2":"Fais sauter l'oignon et la tomate 2 minutes, ajoute la sauce soja, le vinaigre de cidre, [[cumin]], [[ail en poudre]], [[piment]], [[sel]] et [[poivre]], puis remets le bœuf et mélange."},
  W28: {"0":"Fais décongeler le poisson la veille au frigo. Coupe-le en gros morceaux et fais-le mariner 10 minutes dans le jus de citron vert avec [[sel]] et [[poivre]].","2":"Dans la poêle, fais cuire l'oignon, les poivrons et la tomate 6 minutes à feu moyen avec [[paprika]], [[ail en poudre]], [[coriandre moulue]] et [[piment]]."},
  W29: {"1":"Mets l'autocuiseur en mode dorer et fais revenir l'oignon 5 minutes avec l'huile, l'ail, le gingembre, [[paprika]], [[cumin]], [[coriandre moulue]], [[cardamome]], [[cannelle]] et [[piment]].","2":"Ajoute les lentilles, les tomates, les épinards, [[sel]], [[poivre]] et 3 fois le poids des lentilles en eau. Pose les œufs entiers, dans leur coquille, sur le dessus. Ferme et laisse cuire 6 minutes sous pression, puis fais tomber la pression."},
  W30: {"0":"Mélange les crevettes avec [[piment]], [[paprika]], [[origan]], [[poivre]], l'ail écrasé, le jus de citron et la moitié de l'huile. Laisse mariner 10 minutes.","2":"Mets dans l'autocuiseur le riz, les tomates, l'oignon, le poivron, le reste de l'huile, [[sel]], [[laurier]] et 1,4 fois le poids du riz en eau. Ferme et laisse cuire 20 minutes sous pression, puis laisse la pression retomber seule pendant 10 minutes et retire le laurier."},
  W46: {"0":"Coupe le poulet en dés de 2 cm. Mélange le concentré de tomate, le miel, le vinaigre de cidre, la sauce soja, [[paprika fumé]], [[ail en poudre]], [[oignon en poudre]] et 2 cuillères à soupe d'eau : c'est la sauce barbecue.","2":"Fais cuire les pâtes à l'autocuiseur : couvre-les d'eau juste à hauteur avec [[sel]], pose le brocoli par-dessus, et fais-les cuire sous pression la moitié du temps indiqué sur le paquet, arrondi en dessous (5 minutes pour des pâtes complètes à 10 ou 11 minutes). Fais tomber la pression et égoutte.","3":"Dans la poêle rincée, délaye la fécule dans le lait froid, puis fais chauffer à feu moyen en remuant sans arrêt, 3 à 4 minutes, jusqu'à ce que la sauce nappe la cuillère. Hors du feu, ajoute l'emmental, [[muscade]] et [[poivre]], et remue jusqu'à ce qu'il fonde."},
  W47: {"1":"Dans la poêle, fais chauffer l'huile d'olive à feu moyen. Ajoute les tomates cerises entières, l'ail écrasé et [[piment]], couvre et laisse cuire 8 minutes, jusqu'à ce que les tomates éclatent.","3":"Ajoute les crevettes, les épinards, [[origan]] et [[poivre]], et laisse cuire 3 minutes, jusqu'à ce que les crevettes soient bien roses. Arrose de jus de citron.","4":"Fais cuire les pâtes à l'autocuiseur : couvre-les d'eau juste à hauteur avec [[sel]], et fais-les cuire sous pression la moitié du temps indiqué sur le paquet, arrondi en dessous (5 minutes pour des pâtes complètes à 10 ou 11 minutes). Fais tomber la pression et égoutte, en gardant 3 cuillères à soupe d'eau de cuisson par portion. Mélange-les à la sauce avec l'eau de cuisson gardée."},
  W48: {"2":"Ajoute l'ail, [[origan]], [[thym]], le concentré, les tomates, les pâtes et juste assez d'eau pour les couvrir à hauteur, avec [[sel]] et [[poivre]]. Mélange bien et gratte le fond, pour qu'aucune pâte n'y colle.","4":"Hors du feu, ajoute le cottage cheese, l'emmental et [[muscade]], et mélange doucement : ils remplacent la béchamel et donnent le goût des lasagnes."},
  W49: {"0":"Coupe les pommes de terre en deux avec la peau, sèche-les dans un torchon et mélange-les avec 5 ml d'huile, [[romarin]] et [[sel]], en en réservant un tiers pour le saumon et la sauce. Fais-les cuire 18 à 20 minutes à l'air fryer à 200 °C, en secouant le panier à mi-cuisson.","1":"Retire la peau du saumon et coupe-le en cubes de 3 cm. Mélange-les avec le reste de l'huile, la fécule, [[paprika]], [[ail en poudre]] et la moitié de ta réserve.","4":"Prépare la sauce : le yaourt, l'aneth et la ciboulette ciselés, le jus de citron, une demi-gousse d'ail écrasée, le reste de ta réserve et [[poivre]]."},
  W50: {"0":"Coupe les pommes de terre en cubes de 2 cm avec la peau et les carottes en bâtonnets. Mélange-les avec 5 ml d'huile, [[thym]] et [[sel]], et fais-les cuire 20 minutes à l'air fryer à 200 °C, en secouant le panier toutes les 7 minutes.","1":"Mélange la moutarde, le miel, l'ail écrasé, le jus de citron, [[poivre]] et 2 cuillères à soupe d'eau.","2":"Coupe le poulet en morceaux de 3 cm, saupoudre-le de [[paprika]] et fais-le cuire 6 à 7 minutes à la poêle avec le reste de l'huile, jusqu'à ce qu'il soit doré et plus rose au centre."},
  W51: {"0":"Lave les pommes de terre, pique-les plusieurs fois à la fourchette et frotte-les avec un peu d'huile. Fais-les cuire 40 à 45 minutes à l'air fryer à 200 °C, en les retournant à mi-cuisson, jusqu'à ce qu'une lame s'enfonce sans résistance.","1":"Pendant ce temps, hache l'oignon et fais-le revenir 3 minutes à la poêle avec le reste de l'huile. Ajoute le bœuf et fais-le dorer 4 minutes en l'émiettant, puis l'ail écrasé, [[origan]], [[thym]], [[sel]], [[poivre]], le concentré et les tomates. Laisse mijoter 8 minutes.","2":"Coupe les pommes de terre en deux dans la longueur et écrase un peu la chair à la fourchette. Garnis-les de bolognaise, puis de cottage cheese mélangé à [[muscade]], et d'emmental."},
  W52: {"1":"Rince le quinoa dans une passoire fine, puis mets-le dans l'autocuiseur avec 1,7 fois son poids d'eau et [[sel]]. Ferme, laisse cuire 1 minute sous pression, puis laisse la pression retomber seule pendant 10 minutes. Égrène-le à la fourchette.","3":"Dans la même poêle, fais cuire les crevettes 3 minutes avec l'huile, [[paprika fumé]], [[cumin]], [[piment]] et [[poivre]], jusqu'à ce qu'elles soient bien roses.","4":"Prépare la sauce : le yaourt, la moitié du jus de citron vert, [[paprika]] et [[ail en poudre]]. Coupe les tomates cerises en deux et l'oignon rouge en fines lamelles."},
  W53: {"0":"Fais cuire le boulgour à l'autocuiseur avec 1,5 fois son volume d'eau et [[sel]] : 4 minutes sous pression, puis 5 minutes de décompression naturelle. Égrène-le à la fourchette. Laisse-le refroidir.","2":"Prépare la sauce : l'huile d'olive, le jus de citron, [[origan]], [[ail en poudre]] et [[poivre]]."},
  W54: {"2":"Rince le quinoa dans une passoire fine, puis mets-le dans l'autocuiseur avec 1,7 fois son poids d'eau et [[sel]]. Ferme, laisse cuire 1 minute sous pression, puis laisse la pression retomber seule pendant 10 minutes. Égrène-le à la fourchette.","3":"Dans la poêle, mélange la sauce soja, le miel, l'ail écrasé, le gingembre râpé, [[cinq-épices]], [[piment]], [[poivre]] et 3 cuillères à soupe d'eau. Fais réduire 2 minutes à feu moyen, jusqu'à ce que la sauce soit sirupeuse."},
  W55: {"0":"Mélange le thon égoutté avec le yaourt, la moutarde, [[paprika]], [[aneth séché]] et [[poivre]]. Égoutte le maïs, coupe la tomate en fines rondelles et l'oignon rouge en lamelles."},
  W56: {"2":"Ajoute le concentré de tomate, la sriracha, le miel, la sauce soja, [[paprika]], [[poivre]] et 100 ml d'eau par portion. Laisse mijoter 3 minutes, jusqu'à ce que la sauce épaississe.","3":"Fais cuire les pâtes à l'autocuiseur : couvre-les d'eau juste à hauteur avec [[sel]], et fais-les cuire sous pression la moitié du temps indiqué sur le paquet, arrondi en dessous (5 minutes pour des pâtes complètes à 10 ou 11 minutes). Fais tomber la pression et égoutte, en gardant 3 cuillères à soupe d'eau de cuisson par portion."},
  W57: {"0":"Coupe le poulet en dés de 2 cm et mélange-les avec [[paprika fumé]], [[ail en poudre]], [[origan]], [[thym]], [[piment]], [[sel]] et [[poivre]] : c'est l'assaisonnement cajun.","3":"Fais cuire les pâtes à l'autocuiseur : couvre-les d'eau juste à hauteur, et fais-les cuire sous pression la moitié du temps indiqué sur le paquet, arrondi en dessous (5 minutes pour des pâtes complètes à 10 ou 11 minutes). Fais tomber la pression et égoutte, en gardant 3 cuillères à soupe d'eau de cuisson par portion. Mélange-les à la sauce avec l'eau de cuisson gardée."},
  W58: {"0":"Coupe le poulet en lanières et mélange-les avec [[paprika]], [[cumin]], [[origan]], [[ail en poudre]], [[coriandre moulue]], [[piment]], [[sel]] et [[poivre]].","3":"Fais cuire les pâtes à l'autocuiseur : couvre-les d'eau juste à hauteur, et fais-les cuire sous pression la moitié du temps indiqué sur le paquet, arrondi en dessous (5 minutes pour des pâtes complètes à 10 ou 11 minutes). Fais tomber la pression et égoutte, en gardant 3 cuillères à soupe d'eau de cuisson par portion. Mélange-les à la sauce avec l'eau de cuisson gardée."},
  W59: {"1":"Ajoute les tomates cerises coupées en deux, l'ail écrasé, les épinards et [[origan]], et laisse cuire 3 minutes, jusqu'à ce que les tomates commencent à fondre.","2":"Fais cuire les pâtes à l'autocuiseur : couvre-les d'eau juste à hauteur avec [[sel]], et fais-les cuire sous pression la moitié du temps indiqué sur le paquet, arrondi en dessous (5 minutes pour des pâtes complètes à 10 ou 11 minutes). Fais tomber la pression et égoutte, en gardant 3 cuillères à soupe d'eau de cuisson par portion.","3":"Hors du feu, mélange le pesto, le yaourt, [[poivre]] et l'eau de cuisson gardée, puis ajoute les pâtes, le poulet et les tomates. Le yaourt rend le pesto crémeux, sans crème."},
  W60: {"3":"Arrête le mode dorer, ajoute l'ail et [[paprika]] (doux), et mélange 30 secondes : hors du feu, il ne brûle pas. Ajoute les poivrons, les tomates, [[laurier]], 100 ml d'eau par portion, [[sel]] et [[poivre]].","4":"Ferme et laisse cuire 8 minutes sous pression, puis fais tomber la pression et retire le laurier. Laisse réduire 3 minutes en mode dorer si la sauce est trop liquide.","5":"Fais cuire les nouilles aux œufs à l'autocuiseur : couvre-les d'eau juste à hauteur, et fais-les cuire sous pression la moitié du temps indiqué sur le paquet, arrondi en dessous. Fais tomber la pression et égoutte."},
  W61: {"2":"Ajoute les champignons et laisse cuire 5 minutes, jusqu'à ce qu'ils aient rendu leur eau et qu'elle se soit évaporée. Ajoute l'ail écrasé, [[paprika]], [[thym]], [[sel]], [[poivre]], la moutarde, la sauce soja et 80 ml d'eau par portion, et laisse mijoter 3 minutes.","4":"Fais cuire les nouilles aux œufs à l'autocuiseur : couvre-les d'eau juste à hauteur, et fais-les cuire sous pression la moitié du temps indiqué sur le paquet, arrondi en dessous. Fais tomber la pression et égoutte."},
  W62: {"0":"Mélange le bœuf avec la moitié du parmesan, un quart de l'oignon râpé, [[origan]], [[sel]] et [[poivre]]. Forme des boulettes de la taille d'une noix.","2":"Pendant ce temps, fais revenir le reste de l'oignon haché 3 minutes à la poêle avec l'huile, puis l'ail 1 minute. Ajoute le concentré, les tomates et [[piment]], et laisse mijoter 8 minutes.","4":"Fais cuire les pâtes à l'autocuiseur : couvre-les d'eau juste à hauteur, et fais-les cuire sous pression la moitié du temps indiqué sur le paquet, arrondi en dessous (5 minutes pour des pâtes complètes à 10 ou 11 minutes). Fais tomber la pression et égoutte, en gardant 3 cuillères à soupe d'eau de cuisson par portion. Mélange-les à la sauce avec l'eau de cuisson gardée."},
  W63: {"0":"Épluche les pommes de terre, coupe-les en gros morceaux et mets-les dans l'autocuiseur avec 250 ml d'eau. Ferme et laisse cuire 8 minutes sous pression, puis fais tomber la pression.","1":"Égoutte-les et écrase-les à la fourchette ou au presse-purée avec le lait chaud, [[sel]] (garde-en une pincée pour la sauce), [[poivre]] et [[muscade]].","3":"Ajoute l'ail, [[thym]], la moutarde, la pincée gardée et 60 ml d'eau par portion, laisse mijoter 2 minutes, puis ajoute la crème hors du feu."},
  W64: {"1":"Coupe les pommes de terre en deux avec la peau et la courgette en demi-rondelles épaisses. Mélange-les avec la moitié de l'huile, [[herbes de Provence]], [[paprika]] et [[sel]] (garde-en une pincée pour le poulet).","3":"Pendant ce temps, fais cuire le poulet en morceaux 8 minutes à la poêle avec le reste de l'huile et la pincée gardée, jusqu'à ce qu'il soit bien doré.","4":"Baisse le feu, ajoute l'ail écrasé, le persil haché, le jus de citron et [[poivre]], et remue 1 minute sans laisser brûler l'ail."},
  W65: {"0":"Coupe les pommes de terre en cubes de 2 cm avec la peau, mélange-les avec 5 ml d'huile, [[paprika]] et [[sel]] (garde-en une pincée pour la sauce yaourt), et fais-les cuire 20 minutes à l'air fryer à 200 °C, en secouant toutes les 7 minutes.","1":"Coupe le poulet en morceaux de 3 cm et fais-le cuire 6 à 7 minutes à la poêle avec le reste de l'huile et [[paprika fumé]].","3":"Prépare la sauce : le yaourt, la ciboulette ciselée, une demi-gousse d'ail écrasée, la pincée gardée, [[aneth séché]] et [[poivre]]. Coupe la carotte et le concombre en bâtonnets."},
  W66: {"0":"Coupe les pommes de terre en dés de 1,5 cm avec la peau, mélange-les avec 5 ml d'huile et [[sel]] (garde-en une pincée pour le bœuf), et fais-les cuire 18 minutes à l'air fryer à 200 °C, en secouant toutes les 6 minutes.","1":"Pendant ce temps, fais revenir l'oignon et les poivrons en dés 5 minutes à la poêle avec le reste de l'huile. Ajoute le bœuf et fais-le dorer 5 minutes en l'émiettant, avec l'ail, [[paprika fumé]], [[cumin]], [[poivre]] et la pincée gardée."},
  W67: {"2":"Ajoute l'ail, [[cumin]], [[origan]], [[laurier]], [[sel]], [[poivre]], le concentré, les tomates, les pommes de terre, les olives, le vinaigre et 60 ml d'eau par portion. Mélange.","3":"Ferme et laisse cuire 5 minutes sous pression, puis fais tomber la pression. Les pommes de terre doivent être tendres mais garder leur forme. Retire la feuille de laurier."},
  W68: {"1":"Dans l'autocuiseur en mode dorer, fais revenir l'oignon 4 minutes dans l'huile, puis l'ail, le gingembre, [[garam masala]], [[cumin]], [[coriandre moulue]], [[curcuma]] et [[piment]] 1 minute.","2":"Ajoute le bœuf et fais-le dorer 4 minutes en l'émiettant, puis les tomates, les pommes de terre, [[sel]], [[poivre]] et 80 ml d'eau par portion."},
  W69: {"0":"Coupe le poulet en morceaux de 3 cm et mélange-les avec la moitié d'un mélange de [[cumin]], [[paprika]], [[gingembre en poudre]], [[cannelle]], [[curcuma]], [[sel]] et [[poivre]] (garde une pincée de ce mélange pour la semoule), le miel et la moitié de l'huile.","1":"Mélange le chou-fleur et les pois chiches égouttés avec le reste du mélange d'épices et de l'huile. Fais-les cuire 15 minutes à l'air fryer à 200 °C, en secouant à mi-cuisson, puis réserve.","3":"Verse la semoule dans un saladier avec le même volume d'eau bouillante, la pincée de mélange gardée et un filet de jus de citron. Couvre 5 minutes, puis égrène-la à la fourchette.","4":"Prépare la sauce : le yaourt, la menthe ciselée et le reste du citron. Émince l'oignon rouge très finement."},
  W70: {"0":"Coupe le poulet en lanières et mélange-les avec [[cumin]], [[paprika]], [[coriandre moulue]], [[curcuma]], [[cannelle]], [[cardamome]], [[poivre]], la moitié du citron, l'ail écrasé, l'huile et [[sel]] (garde-en une pincée pour le boulgour). Laisse mariner 15 minutes, ou toute la nuit au frigo.","2":"Fais cuire le boulgour à l'autocuiseur avec 1,5 fois son volume d'eau et la pincée gardée : 4 minutes sous pression, puis 5 minutes de décompression naturelle. Égrène-le à la fourchette.","3":"Prépare la sauce : le tahini, le yaourt, le reste du citron et 2 cuillères à soupe d'eau, bien mélangés jusqu'à ce que ce soit lisse."},
  W71: {"0":"Rince le quinoa dans une passoire fine, puis mets-le dans l'autocuiseur avec 1,7 fois son poids d'eau. Ferme, laisse cuire 1 minute sous pression, puis laisse la pression retomber seule pendant 10 minutes. Égrène-le à la fourchette.","2":"Ajoute l'ail, [[cumin]], [[paprika fumé]], [[origan]], [[piment]], [[sel]], [[poivre]], les tomates, les haricots rouges rincés et le maïs égoutté. Laisse mijoter 5 minutes."},
  W72: {"0":"Pâte à naans : mélange la farine, la levure, [[sel]] (une pincée dans la pâte, mets le reste de côté pour la sauce) et la moitié du yaourt, puis pétris 2 minutes jusqu'à obtenir une boule souple. Laisse reposer 15 minutes sous un torchon.","1":"Pendant ce temps, fais revenir l'oignon haché 4 minutes à la poêle avec l'huile, puis l'ail, le gingembre, [[garam masala]], [[curry en poudre]], [[cumin]], [[curcuma]] et [[piment]] 1 minute.","2":"Ajoute le poulet en dés et fais-le colorer 3 minutes, puis les tomates, les pois chiches égouttés, l'assaisonnement mis de côté, [[poivre]] et 60 ml d'eau par portion. Laisse mijoter 10 minutes, ajoute les épinards 2 minutes, puis, hors du feu, le reste du yaourt."},
  W73: {"1":"Ajoute [[paprika fumé]], [[cumin]], [[ail en poudre]], [[origan]], [[piment]], [[sel]], [[poivre]], le concentré, le miel, les haricots rouges rincés et 50 ml d'eau par portion. Laisse réduire 3 minutes, jusqu'à ce que ce soit bien enrobé."},
  W74: {"2":"Monte le feu, ajoute le bœuf, la sauce soja, [[ail en poudre]] et [[poivre]], et fais-le sauter 2 minutes seulement, pour qu'il reste tendre."},
  W75: {"2":"Délaye le beurre de cacahuète et le concentré dans 150 ml d'eau chaude par portion. Verse-les dans la cuve avec les tomates, la carotte, la patate douce, [[piment]], [[sel]], [[poivre]] et [[laurier]].","3":"Ferme et laisse cuire 25 minutes sous pression, puis laisse la pression retomber seule. La viande doit être fondante et la sauce épaisse ; laisse réduire quelques minutes en mode dorer si besoin. Retire la feuille de laurier."},
  W76: {"3":"Ajoute le riz et remue 1 minute pour bien l'enrober, puis saupoudre de [[curcuma]], [[paprika]] et [[paprika fumé]].","5":"Ouvre, ajoute les crevettes et les petits pois surgelés et mélange 3 à 4 minutes en mode dorer, couvercle posé sans le fermer, jusqu'à ce que les crevettes soient bien roses. Ajoute [[poivre]] et parsème de persil."},
  W77: {"4":"Dans la même poêle, fais revenir l'ail, le gingembre et [[curcuma]] 30 secondes, puis les carottes et le poivron 3 minutes, et enfin les champignons et la courgette 2 minutes : les légumes doivent rester croquants.","5":"Remets le poulet, verse le miso délayé, ajoute [[poivre]] et [[piment]] (facultatif) et laisse réduire 2 minutes à feu moyen. Arrête le feu, ajoute les nouilles et mélange 1 minute pour bien les enrober de sauce."},
  W78: {"2":"Ajoute l'ail, [[cumin]], [[paprika]], [[coriandre moulue]] et [[piment]], et fais griller 1 minute. Ajoute les tomates et laisse compoter 5 minutes à feu moyen, puis les pois chiches, 3 minutes. Ajoute [[sel]] (garde-en une pincée pour les œufs).","3":"Creuse un petit puits par œuf dans la sauce, casse un œuf dans chacun, ajoute la pincée gardée et [[poivre]]. Couvre et laisse cuire 8 à 10 minutes à feu doux, jusqu'à ce que le blanc soit pris et le jaune cuit : il tiendra mieux au réchauffage."},
  W79: {"0":"Rince les lentilles, puis mets-les dans l'autocuiseur avec 3 fois leur poids d'eau froide, sans saler. Ferme, laisse cuire 8 minutes sous pression, puis laisse la pression retomber seule pendant 10 minutes. Égoutte-les et laisse-les refroidir.","1":"Prépare la vinaigrette : l'huile d'olive, le vinaigre de cidre, [[cumin]], [[gingembre en poudre]], [[paprika fumé]], l'ail écrasé, [[sel]] et [[poivre]]."},
  W80: {"0":"Coupe les pommes de terre en cubes de 2 cm avec la peau. Mets-les dans l'autocuiseur avec 100 ml d'eau froide, ferme et laisse cuire 4 minutes sous pression, puis fais tomber la pression : une lame doit s'enfoncer sans résistance. Égoutte-les.","1":"Prépare la vinaigrette : la moutarde, le jus de citron, l'huile d'olive, [[sel]], [[poivre]] et [[aneth séché]]. Mélange-la aux pommes de terre encore chaudes : elles s'en imprègnent."},
  W81: {"2":"Dans la même poêle, fais cuire le poulet 6 à 7 minutes avec le reste de l'huile, [[origan]], [[thym]], [[paprika]], [[piment]] et [[poivre]], jusqu'à ce qu'il soit doré et plus rose au centre."},
  W82: {"1":"Dans la poêle à feu moyen-doux, fais confire les oignons 20 minutes avec les deux tiers de l'huile et [[sel]] (garde-en une pincée pour la purée), en remuant de temps en temps : ils doivent être bien dorés et fondants. Ajoute une cuillère d'eau s'ils accrochent.","2":"Pousse les oignons sur le côté et fais dorer le poulet 6 à 7 minutes avec le reste de l'huile et [[thym]], jusqu'à ce qu'il ne soit plus rose au centre.","3":"Délaye la fécule dans 80 ml d'eau froide par portion avec le bouillon cube émietté et [[poivre]], verse dans la poêle et laisse épaissir 2 minutes en remuant : c'est le jus de la soupe à l'oignon.","4":"Épluche les pommes de terre et coupe-les en cubes de 3 cm. Mets-les dans l'autocuiseur avec 100 ml d'eau froide par portion, ferme et laisse cuire 8 minutes sous pression, puis fais tomber la pression : une lame doit s'enfoncer sans résistance. Égoutte, écrase-les à la fourchette avec le lait chaud, la pincée gardée et [[muscade]]."},
  W83: {"0":"Hache l'oignon. Écrase une gousse d'ail dans le yaourt avec une pincée prise sur [[sel]] mesuré dans une coupelle : c'est la sauce yaourt. Garde le reste de la coupelle pour le bœuf.","1":"Dans la poêle, fais revenir l'oignon 3 minutes dans l'huile, puis ajoute le bœuf et fais-le dorer 5 minutes en l'émiettant, jusqu'à ce qu'il ne soit plus rose. Ajoute l'autre gousse d'ail, le concentré, [[cumin]], [[poivre]], le reste de la coupelle et 2 cuillères à soupe d'eau, et laisse cuire 2 minutes.","2":"Fais cuire les pâtes à l'autocuiseur : couvre-les d'eau juste à hauteur, et fais-les cuire sous pression la moitié du temps indiqué sur le paquet, arrondi en dessous (5 minutes pour des pâtes complètes à 10 ou 11 minutes). Fais tomber la pression et égoutte, en gardant 3 cuillères à soupe d'eau de cuisson par portion. Mélange-les au bœuf avec l'eau de cuisson gardée.","3":"Fais fondre le beurre 1 minute dans une petite poêle avec [[paprika]], [[menthe séchée]] et [[piment]], sans le laisser brunir : c'est le beurre au paprika. Verse-le dans un petit pot."},
  W84: {"3":"Remets le bœuf, ajoute les carottes, [[thym]], [[laurier]], [[ail en poudre]], [[poivre]], le bouillon cube émietté et 150 ml d'eau froide par portion. Ferme et laisse cuire 30 minutes sous pression, puis laisse la pression retomber seule pendant 10 minutes : le bœuf doit se couper à la fourchette.","4":"Délaye la fécule dans un peu d'eau froide, verse-la et laisse épaissir 2 minutes en mode dorer, en remuant. Retire la feuille de laurier. Verse le bourguignon dans un plat et rince la cuve.","5":"Épluche les pommes de terre et coupe-les en cubes de 3 cm. Mets-les dans l'autocuiseur avec 100 ml d'eau froide par portion, ferme et laisse cuire 8 minutes sous pression, puis fais tomber la pression : une lame doit s'enfoncer sans résistance. Égoutte, écrase-les à la fourchette avec le lait chaud, [[sel]] et [[muscade]]."},
  W85: {"2":"Dans la même poêle, fais revenir l'oignon et les champignons 6 minutes à feu vif, jusqu'à ce qu'ils soient dorés, puis l'ail, [[thym]] et les châtaignes, 2 minutes.","3":"Ajoute 60 ml d'eau par portion avec le bouillon cube émietté, remets le poulet et laisse réduire 2 minutes. Hors du feu, ajoute la crème, [[muscade]] et [[poivre]], et mélange.","4":"Fais cuire les pâtes à l'autocuiseur : couvre-les d'eau juste à hauteur avec [[sel]], et fais-les cuire sous pression la moitié du temps indiqué sur le paquet, arrondi en dessous (5 minutes pour des pâtes complètes à 10 ou 11 minutes). Fais tomber la pression et égoutte, en gardant 3 cuillères à soupe d'eau de cuisson par portion. Mélange-les à la sauce avec l'eau de cuisson gardée."},
  W89: {"1":"Mets l'autocuiseur en mode dorer et fais revenir l'oignon 3 minutes dans l'huile, puis le bœuf 5 minutes en l'émiettant, jusqu'à ce qu'il ne soit plus rose. Ajoute l'ail, [[cumin]], [[paprika fumé]], [[origan]], [[cannelle]] et [[piment]], 1 minute.","3":"Ajoute le chocolat noir en morceaux et remue jusqu'à ce qu'il fonde : il ne se sent pas, mais il donne une sauce profonde et ronde. Ajoute [[sel]] et [[poivre]], et mélange."},
  W90: {"2":"Dans la poêle, fais revenir l'oignon 3 minutes dans l'huile, puis l'ail, le gingembre, la pâte de curry et [[coriandre moulue]], 1 minute.","3":"Ajoute la courge, le lait de coco, [[sel]] et 80 ml d'eau par portion. Couvre et laisse mijoter 12 à 15 minutes, jusqu'à ce que la courge soit tendre ; écrase-en quelques morceaux pour épaissir la sauce."},
  W93: {"2":"Fais revenir l'oignon et les champignons 4 minutes avec le reste de l'huile, puis la courge, l'ail et [[thym]], 2 minutes.","5":"Remue énergiquement 1 minute : la courge fond et rend le risotto crémeux. Ajoute le parmesan râpé et le poulet avec [[muscade]] et [[poivre]], puis mélange."},
  W94: {"0":"Coupe les poireaux en fines rondelles et rince-les, émince l'oignon. Retire la peau du saumon et sale-le avec [[sel]].","4":"Remue énergiquement 1 minute, puis ajoute la crème, le parmesan, le jus de citron et [[poivre]]. Pose le saumon par-dessus."},
  W95: {"4":"Verse 100 ml d'eau par portion avec le bouillon cube émietté, le vinaigre de cidre, [[thym]], [[laurier]], [[sel]] et [[poivre]]. Couvre et laisse mijoter 20 minutes à feu doux : le poulet doit être tendre."},
  W97: {"0":"Coupe la courge épluchée en cubes de 1,5 cm, mélange-les avec l'huile et fais-les rôtir 18 minutes à l'air fryer à 200 °C, en secouant le panier à mi-cuisson, jusqu'à ce qu'ils soient dorés.","3":"Fais cuire les pâtes à l'autocuiseur : couvre-les d'eau juste à hauteur, et fais-les cuire sous pression la moitié du temps indiqué sur le paquet, arrondi en dessous (5 minutes pour des pâtes complètes à 10 ou 11 minutes). Fais tomber la pression et égoutte, en gardant 3 cuillères à soupe d'eau de cuisson par portion.","4":"Mélange les pâtes au beurre noisette avec l'eau de cuisson gardée, la courge, le poulet, [[muscade]], [[sel]] et [[poivre]]."},
  W98: {"0":"Coupe la patate douce en quartiers avec la peau, mélange-les avec les deux tiers de l'huile, [[paprika]] et [[ail en poudre]]. Fais-les rôtir 20 minutes à l'air fryer à 200 °C, en secouant le panier à mi-cuisson.","2":"Coupe le bœuf en tranches de 1 cm et roule-le dans [[sel]] et [[poivre]] concassé. Dans la poêle très chaude avec le reste de l'huile, saisis-le 1 minute de chaque côté : il doit rester rosé. Réserve-le."},
  W101: {"1":"Émince les champignons et écrase l'ail. Fais-les dorer 8 minutes à la poêle très chaude avec l'huile, sans remuer au début, puis ajoute l'ail, [[thym]], [[poivre]] et le beurre, 1 minute.","2":"Dans l'autocuiseur rincé, en mode dorer, porte à frémissement le lait avec 2 fois le poids de la polenta en eau, [[sel]] et [[muscade]]. Verse la polenta en pluie en fouettant et laisse cuire le temps indiqué sur le paquet (souvent 5 minutes), en remuant sans arrêt. Hors du feu, ajoute le parmesan."},
  SO07: {"1":"Mets l'autocuiseur en mode dorer et fais revenir l'oignon 3 minutes dans l'huile, puis le poulet 4 minutes, jusqu'à ce qu'il soit doré. Ajoute l'ail, les tomates séchées, [[origan]], [[paprika]], [[piment]] et [[poivre]], 1 minute.","4":"Fais cuire les pâtes à l'autocuiseur : couvre-les d'eau juste à hauteur, et fais-les cuire sous pression la moitié du temps indiqué sur le paquet, arrondi en dessous (5 minutes pour des pâtes complètes à 10 ou 11 minutes). Fais tomber la pression et égoutte, en gardant 3 cuillères à soupe d'eau de cuisson par portion."},
  SO08: {"2":"Ajoute les châtaignes, le bouillon cube émietté, [[thym]], [[sel]], 300 ml d'eau froide par portion et le poulet entier. Ferme et laisse cuire 8 minutes sous pression, puis fais tomber la pression : le poulet ne doit plus être rose au centre.","3":"Sors le poulet et effiloche-le à la fourchette. Mixe la soupe au mixeur plongeant jusqu'à ce qu'elle soit veloutée, puis ajoute la crème, [[muscade]] et [[poivre]], et remets le poulet."},
  SO09: {"1":"Mets l'autocuiseur en mode dorer et fais confire les oignons 20 minutes dans l'huile, en remuant souvent, jusqu'à ce qu'ils soient bien bruns. Ajoute une cuillère d'eau s'ils accrochent.","2":"Ajoute le bœuf, le liquide et les aromates : les bouillons cubes émiettés, 350 ml d'eau froide par portion, [[thym]], [[laurier]] et [[poivre]]. Ferme et laisse cuire 30 minutes sous pression, puis laisse la pression retomber seule pendant 10 minutes."},
  SO10: {"1":"Mets l'autocuiseur en mode dorer et fais dorer le bœuf 4 minutes dans l'huile, puis l'oignon et les carottes, 3 minutes. Ajoute le concentré, l'ail et [[paprika]], 1 minute.","2":"Ajoute le bouillon cube émietté, [[laurier]] et 350 ml d'eau froide par portion. Ferme et laisse cuire 25 minutes sous pression, puis fais tomber la pression.","3":"Ajoute le chou, les pommes de terre, la betterave et le vinaigre de cidre. Referme et laisse cuire 5 minutes sous pression, puis fais tomber la pression : le chou et les pommes de terre doivent être tendres. Ajoute [[sel]] et [[poivre]], et mélange."},
  SO11: {"2":"Arrête le feu, ajoute [[paprika]], [[cumin]], [[origan]], [[piment]] et l'ail, et remue 30 secondes : il ne doit pas brûler, il deviendrait amer. Ajoute le concentré.","3":"Ajoute la carotte, le bouillon cube émietté, [[laurier]], [[sel]], [[poivre]] et 300 ml d'eau froide par portion. Ferme et laisse cuire 25 minutes sous pression, puis fais tomber la pression."},
  SO15: {"1":"Mets l'autocuiseur en mode dorer et fais fondre l'oignon et la carotte 4 minutes avec la moitié du beurre, puis ajoute le concentré et [[cumin]], 1 minute.","3":"Mixe au mixeur plongeant jusqu'à ce que ce soit bien lisse. Ajoute [[sel]] et [[poivre]], et goûte.","4":"Fais fondre le reste du beurre 1 minute avec [[paprika]], [[piment d'Espelette]] et [[menthe séchée]], sans le laisser brunir : c'est le beurre au paprika. Verse-le dans un petit pot."},
  W102: {"1":"Mets l'autocuiseur en mode dorer et fais revenir l'oignon et les champignons 4 minutes dans le beurre, sans les colorer. Ajoute le poulet, les carottes, [[thym]], [[laurier]], [[sel]], le bouillon cube émietté et 120 ml d'eau froide par portion. Ferme et laisse cuire 8 minutes sous pression, puis fais tomber la pression.","2":"Délaye la fécule dans un peu d'eau froide, verse-la et laisse épaissir 2 minutes en mode dorer, en remuant. Hors du feu, ajoute la crème, le jus de citron, [[muscade]] et [[poivre]] : la sauce doit napper la cuillère. Verse la blanquette dans un plat et rince la cuve."},
  W104: {"1":"Dans la poêle, fais dorer le poulet 6 à 7 minutes dans l'huile, jusqu'à ce qu'il ne soit plus rose au centre. Réserve-le, puis fais dorer les champignons 5 minutes à feu vif avec l'ail et [[thym]].","2":"Fais cuire les pâtes à l'autocuiseur : couvre-les d'eau juste à hauteur avec [[sel]], et fais-les cuire sous pression la moitié du temps indiqué sur le paquet, arrondi en dessous (5 minutes pour des pâtes complètes à 10 ou 11 minutes). Fais tomber la pression et égoutte, en gardant 3 cuillères à soupe d'eau de cuisson par portion.","3":"Remets le poulet dans la poêle avec les pâtes, les épinards surgelés et l'eau de cuisson gardée. Laisse chauffer 3 minutes, puis ajoute le Boursin hors du feu avec [[muscade]] et [[poivre]], et mélange jusqu'à ce qu'il fonde en sauce crémeuse."},
  W105: {"0":"Coupe la patate douce en frites de 1 cm avec la peau. Mélange-les avec la moitié de l'huile, [[paprika]] et [[sel]].","3":"Ajoute le lait, la crème et le maroilles coupé en dés, sans la croûte, [[muscade]] et [[poivre]]. Laisse fondre 3 minutes à feu doux en remuant, jusqu'à ce que la sauce soit lisse et nappante."},
  W106: {"1":"Mets l'autocuiseur en mode dorer et fais revenir l'oignon 3 minutes dans la moitié de l'huile. Ajoute le potimarron, le bouillon cube émietté, [[thym]], [[ail en poudre]] et 100 ml d'eau froide par portion. Ferme et laisse cuire 6 minutes sous pression, puis fais tomber la pression. Écrase le potimarron à la fourchette avec la crème et [[muscade]] : c'est la sauce.","2":"Dans la poêle, fais dorer le poulet 6 à 7 minutes dans le reste de l'huile avec [[sel]] et [[poivre]], jusqu'à ce qu'il ne soit plus rose au centre. Ajoute les gnocchis et 2 cuillères à soupe d'eau par portion, couvre et laisse 4 minutes : ils doivent être tendres."},
  W107: {"2":"Remets le bœuf, verse la bière, ajoute [[thym]], [[laurier]], le bouillon cube émietté et 60 ml d'eau froide par portion. Tartine le pain d'épices de moutarde et pose-le dessus, côté moutarde vers le bas. Ferme et laisse cuire 30 minutes sous pression, puis laisse la pression retomber seule pendant 10 minutes : le bœuf doit se couper à la fourchette.","4":"Épluche les pommes de terre et coupe-les en cubes de 3 cm. Mets-les dans l'autocuiseur avec 100 ml d'eau froide par portion et [[sel]], ferme et laisse cuire 8 minutes sous pression, puis fais tomber la pression : une lame doit s'enfoncer sans résistance. Égoutte, écrase-les à la fourchette avec le lait chaud, [[muscade]] et [[poivre]]."},
  W109: {"2":"Ajoute les tomates, [[origan]], [[laurier]], [[muscade]], [[sel]], [[poivre]], le bouillon cube émietté et 80 ml d'eau froide par portion. Ferme et laisse cuire 40 minutes sous pression, puis laisse la pression retomber seule pendant 10 minutes : le bœuf doit s'effilocher à la fourchette.","4":"Fais cuire les pâtes à l'autocuiseur : couvre-les d'eau juste à hauteur, et fais-les cuire sous pression la moitié du temps indiqué sur le paquet, arrondi en dessous (5 minutes pour des pâtes complètes à 10 ou 11 minutes). Fais tomber la pression et égoutte, en gardant 3 cuillères à soupe d'eau de cuisson par portion. Mélange-les au ragù avec l'eau de cuisson gardée."},
  W110: {"2":"Dans une grande poêle, fais dorer les champignons 5 minutes à feu vif dans la moitié de l'huile avec [[thym]]. Ajoute l'orzo et l'ail, et remue 1 minute.","4":"Pendant ce temps, fais saisir les crevettes 2 minutes dans une autre poêle avec le reste de l'huile, [[paprika]] et [[piment]] : elles doivent juste devenir roses.","5":"Hors du feu, ajoute à l'orzo la crème, le parmesan râpé, le jus de citron et [[poivre]], puis les crevettes. Mélange."},
  W114: {"2":"Dans la même poêle, fais fondre les épinards surgelés 4 minutes, puis ajoute le lait, la crème et le gorgonzola en morceaux, avec [[muscade]], [[poivre]] et [[sel]]. Laisse fondre 2 minutes à feu doux en remuant, jusqu'à ce que la sauce soit lisse."},
  W31: {"1":"Mélange le poulet haché cru avec les légumes, le gingembre, l'ail, la moitié de la sauce soja, [[cinq-épices]], [[poivre]] et [[sel]]."},
  W32: {"0":"Coupe la patate douce en cubes de 2 cm, sans l'éplucher si tu veux. Mélange-la avec l'huile et [[paprika fumé]].","2":"Fais cuire le bœuf 6 à 7 minutes à la poêle avec [[cumin]], [[ail en poudre]], [[sel]] et [[poivre]], en l'émiettant, jusqu'à ce qu'il ne soit plus rose.","3":"Prépare le miel pimenté : mélange le miel avec [[piment]], dans un petit pot."},
  W33: {"0":"Fais cuire les pâtes à l'autocuiseur : couvre-les d'eau juste à hauteur avec [[sel]], et fais-les cuire sous pression la moitié du temps indiqué sur le paquet, arrondi en dessous (5 minutes pour des pâtes complètes à 10 ou 11 minutes). Fais tomber la pression et égoutte s'il reste de l'eau, en en gardant 3 cuillères à soupe par portion.","2":"Ajoute l'ail écrasé, les tomates séchées coupées en morceaux, les épinards et [[herbes de Provence]], et laisse cuire 3 minutes.","3":"Hors du feu, mélange le fromage blanc, le parmesan, l'eau de cuisson gardée, [[poivre]] et [[muscade]], puis ajoute les pâtes et le poulet et mélange. Le fromage blanc ne doit pas bouillir, sinon il graine."},
  W34: {"0":"Mélange le bœuf avec 1 gousse d'ail écrasée, le gingembre râpé, la moitié de la sauce soja, la fécule, [[cinq-épices]] et [[poivre]]. Forme des boulettes de la taille d'une noix, d'environ 30 g.","4":"Prépare le concombre : écrase-le avec le plat d'un couteau, coupe-le en morceaux, mélange-le avec [[sel]] et parsème-le de graines de sésame."},
  W35: {"0":"Coupe le poulet en morceaux de 3 cm, façon nuggets, et mélange-les avec 30 g de yaourt grec, [[paprika]], [[oignon en poudre]], [[piment]], [[sel]] et [[poivre]].","4":"Prépare la sauce crémeuse : le reste du yaourt grec, la mayonnaise allégée, quelques gouttes de sauce soja et [[ail en poudre]]."},
  W36: {"1":"Fais revenir le poulet 5 minutes à feu vif dans la poêle huilée avec [[cumin]], [[paprika]], [[origan]], [[ail en poudre]], [[piment]], [[sel]] et [[poivre]], jusqu'à ce qu'il ne soit plus rose. Ajoute les poivrons et l'oignon et fais sauter encore 4 minutes : ils doivent rester un peu croquants. Arrose de jus de citron vert."},
  W37: {"2":"Fais cuire le poulet 5 à 6 minutes dans la poêle huilée, jusqu'à ce qu'il ne soit plus rose, puis ajoute l'oignon, la carotte, l'ail, [[gingembre en poudre]] et les petits pois, 4 minutes.","4":"Ajoute le riz refroidi et la sauce soja avec [[poivre]], et fais sauter 3 minutes à feu vif en remuant."},
  W38: {"1":"Mélange le bœuf avec la moitié de la sauce soja, la fécule, [[cinq-épices]] et [[poivre]], et laisse reposer 10 minutes au frigo : c'est ce qui le garde tendre."},
  W39: {"2":"Ajoute les tomates, le concentré, [[herbes de Provence]], [[laurier]], [[sel]], [[poivre]] et 50 ml d'eau par portion. Ferme et laisse cuire 10 minutes sous pression, puis fais tomber la pression et retire le laurier.","3":"Verse la sauce dans un plat et rince la cuve. Fais cuire les pâtes à l'autocuiseur : couvre-les d'eau juste à hauteur, et fais-les cuire sous pression la moitié du temps indiqué sur le paquet, arrondi en dessous. Fais tomber la pression et égoutte."},
  W40: {"0":"Râpe l'oignon et hache le persil. Mélange la moitié du persil et l'oignon avec le bœuf, [[cumin]], [[paprika]], [[cannelle]], [[quatre-épices]] et [[sel]], puis forme des kefta allongées de la taille d'un doigt.","2":"Fais cuire le boulgour à l'autocuiseur avec 1,5 fois son volume d'eau : 4 minutes sous pression, puis 5 minutes de décompression naturelle. Laisse-le refroidir.","3":"Prépare le taboulé : le boulgour refroidi, la tomate et le concombre en petits dés, le reste du persil, le jus de citron, l'huile d'olive, [[menthe séchée]] et [[poivre]]."},
  W41: {"3":"Ajoute l'ail, les tomates cerises, les épinards, [[herbes de Provence]], [[sel]] et [[poivre]], et laisse cuire 4 minutes, jusqu'à ce que les tomates commencent à fondre. Remets les gnocchis et mélange."},
  W43: {"1":"Mélange le poulet entier avec 30 g de yaourt, [[paprika]], [[cumin]], [[coriandre moulue]], [[ail en poudre]], [[cannelle]], [[piment]], l'huile et [[sel]]. Laisse mariner 15 minutes au frigo, ou toute la nuit.","4":"Prépare la sauce blanche : le reste du yaourt, une demi-gousse d'ail écrasée, les herbes et [[poivre]]. Lave la salade et coupe-la en lanières, coupe la tomate en dés et l'oignon en fines lamelles."},
  W44: {"2":"Dans la poêle, fais revenir l'oignon 3 minutes dans l'huile, puis ajoute l'ail, le gingembre, [[curry en poudre]] et [[curcuma]], 1 minute, en remuant.","3":"Ajoute les tomates et le lait de coco avec [[sel]] et [[poivre]], et laisse mijoter 5 minutes. Ajoute les épinards et laisse-les fondre 2 minutes.","4":"Pose les morceaux de poisson dans la sauce, couvre et laisse cuire 6 à 8 minutes à feu doux, sans remuer, jusqu'à ce que la chair soit opaque et se détache en lamelles. Arrose de jus de citron vert et saupoudre de [[garam masala]]."},
  W45: {"1":"Dans la poêle, fais revenir l'oignon 3 minutes dans l'huile d'olive, puis l'ail et [[piment]] 1 minute. Ajoute les tomates et [[origan]], avec [[poivre]], et laisse mijoter 8 minutes.","3":"Fais cuire les pâtes à l'autocuiseur : couvre-les d'eau juste à hauteur, et fais-les cuire sous pression la moitié du temps indiqué sur le paquet, arrondi en dessous. Fais tomber la pression, égoutte et mélange-les à la sauce."},
  SO01: {"1":"Mets l'autocuiseur en mode dorer et fais revenir l'oignon 3 minutes dans l'huile, jusqu'à ce qu'il colore légèrement, puis ajoute l'ail, le gingembre, [[curry en poudre]] et [[piment]], et remue 1 minute.","4":"Ajoute la sauce soja et le jus de citron avec [[poivre]], goûte et ajuste."},
  SO02: {"2":"Mets les hauts de cuisse dans l'autocuiseur avec l'oignon, l'ail, le gingembre, [[laurier]], la sauce soja et 350 ml d'eau froide par portion. Porte à ébullition en mode dorer et retire à la cuillère la mousse qui se forme en surface.","6":"Prélève une louche de bouillon dans un bol, délaye-y la pâte miso, puis reverse-la dans la cuve, hors du feu : le miso ne doit jamais bouillir. Remets le poulet effiloché et ajoute [[poivre]] : le miso et la sauce soja salent déjà bien."},
  SO03: {"1":"Mets l'autocuiseur en mode dorer et fais revenir l'ail 1 minute dans l'huile, puis ajoute [[curcuma]] et le gingembre, 30 secondes.","5":"Prélève une louche de bouillon dans un bol, délaye-y la pâte miso avec [[poivre]], puis reverse-la dans la cuve, hors du feu : le miso ne doit jamais bouillir."},
  SO04: {"2":"Ajoute [[cumin]], [[curcuma]], [[coriandre moulue]], [[paprika fumé]] et [[poivre]], et fais-les griller 30 secondes en remuant.","3":"Ajoute les pois cassés, les carottes, [[laurier]], le bouillon cube émietté et 250 ml d'eau froide par portion. Mélange et gratte bien le fond.","4":"Ferme et laisse cuire 15 minutes sous pression, puis laisse la pression retomber seule 10 minutes : les pois cassés doivent être fondants et crémeux. Retire le laurier et ajoute [[sel]], après avoir goûté."},
  SO06: {"1":"Mets l'autocuiseur en mode dorer et fais revenir l'oignon et l'ail 3 à 4 minutes dans l'huile, en gardant un filet pour le service, sans coloration. Ajoute [[cumin]] les 30 dernières secondes.","3":"Mixe au mixeur plongeant jusqu'à ce que ce soit lisse, puis ajoute le lait de coco. Ajoute un peu d'eau si le velouté est trop épais. Assaisonne avec [[sel]], [[poivre]] et [[muscade]], et mélange. Verse-le dans un plat et rince la cuve."},
  B01: {"0":"Pendant la session de cuisine, prépare un bocal par matin : mélange les flocons, le cacao, [[vanille]], [[sel]], la whey et le lait jusqu'à ce qu'il n'y ait plus de grumeaux."},
  B02: {"0":"Pendant la session de cuisine, prépare un bocal par matin : mélange les flocons, le fromage blanc, le lait, le miel, [[cannelle]] et [[vanille]]."},
  B06: {"1":"Bats les œufs avec [[sel]], [[poivre]], [[muscade]] et [[origan]], puis ajoute les épinards, le poivron et la feta émiettée."},
  B07: {"0":"Tartine le wrap de carré frais mélangé avec [[ail en poudre]], [[herbes de Provence]] et [[poivre]]."},
  B15: {"0":"Bats les œufs avec [[sel]] et [[poivre]]."},
  B16: {"0":"Dans une petite casserole, porte le lait à frémissement avec les flocons, [[cannelle]] et [[sel]], puis laisse cuire 3 à 4 minutes à feu doux en remuant, jusqu'à ce que ce soit crémeux. Au micro-ondes : 2 minutes dans un grand bol, en remuant à mi-temps.","1":"Hors du feu, mélange la whey et [[vanille]] en remuant bien."},
  K05: {"1":"Mélange le fromage blanc avec le miel et [[vanille]], et étale-le en couche par-dessus, puis saupoudre de cacao."},
  K06: {"0":"Pendant la session de cuisine, écrase la banane à la fourchette, puis mélange-la avec les flocons, l'œuf, la whey, le lait, [[cannelle]], [[vanille]] et [[sel]]."},
  K08: {"1":"Écrase-les à la fourchette avec les flocons, la whey, le beurre de cacahuète, le cacao, [[cannelle]] et [[sel]], jusqu'à obtenir une pâte qui se tient."},
  K10: {"1":"Ajoute la banane en rondelles, puis le beurre de cacahuète et le miel en filet, et termine par [[cannelle]] saupoudrée sur le dessus."},
  K12: {"1":"Écrase l'avocat avec le jus de citron vert, [[sel]], [[cumin]] et [[piment]], puis étale-le sur le pain.","2":"Fais cuire l'œuf au plat 3 minutes à la poêle huilée, pose-le sur le pain, ajoute la tomate en dés et [[poivre]]."},
  K13: {"0":"Égoutte le thon et émiette-le à la fourchette avec le jus de citron, [[aneth séché]] et [[poivre]]."},
  K15: {"1":"Ajoute le beurre de cacahuète, la whey et [[sel]], et mélange jusqu'à obtenir une pâte brillante."},
  K16: {"1":"Mélange le yaourt grec, la whey, le miel et [[vanille]] jusqu'à ce que ce soit lisse, puis verse sur les boudoirs."},
  K17: {"1":"Ajoute les flocons d'avoine, la whey, le cacao, [[cannelle]] et [[sel]], et mixe quelques secondes seulement, pour garder des morceaux de flocons."},
  K18: {"0":"Mixe les dattes avec la whey, [[vanille]], [[sel]] et une cuillère à soupe d'eau chaude : c'est le « caramel ». Étale-le sur 1 cm dans une petite boîte tapissée de papier cuisson."},
  K19: {"0":"Mélange la noix de coco râpée, le lait de coco, la whey, le miel, [[vanille]] et [[sel]] jusqu'à obtenir une pâte qui se tient. Si elle colle trop, ajoute un peu de coco."},
  K20: {"0":"Concasse grossièrement les amandes et mélange-les avec les flocons d'avoine, la whey, [[cannelle]] et [[sel]]."},
  K21: {"0":"Écrase la banane à la fourchette, puis mélange-la avec les flocons d'avoine, la whey, [[cannelle]], [[vanille]] et [[sel]]."},
  K22: {"0":"Pendant la session de cuisine, concasse grossièrement les noix et mélange-les avec les flocons d'avoine, [[cannelle]], [[sel]], le sirop d'érable et l'huile, jusqu'à ce que tout soit enrobé."},
  K23: {"1":"Fais-les dorer 4 à 5 minutes à la poêle avec le sirop d'érable, [[cannelle]] et [[vanille]], jusqu'à ce qu'elles soient tendres et caramélisées."},
  K24: {"1":"Prépare un bocal par portion : mélange la purée de courge avec les flocons, le lait, la whey, le fromage blanc, le sirop d'érable, [[cannelle]], [[gingembre en poudre]], [[muscade]] et [[quatre-épices]]."},
  S11: {"0":"Tartine le pain de carré frais, puis ajoute [[herbes de Provence]] et [[poivre]]."},
  S12: {"1":"Ajoute le miel, une branche de thym frais effeuillée et [[poivre]]."},
};
// >>épices générées
const spiceRow = id => id && (SPICE_QTY[id] || SPICE_QTY[String(id).replace(/S$/, '')]) || null;
// Noms des épices à avoir au placard (sel et poivre exceptés)
export const spicesOf = id => {
  const q = spiceRow(id);
  if (q) return Object.keys(q).filter(k => k !== 'sel' && k !== 'poivre').join(', ');
  return (id && (SPICES[id] || SPICES[String(id).replace(/S$/, '')])) || '';
};
// Grammes d'épices sèches d'une portion (macros de l'ingrédient « Épices ») : ≈ 2 g la cuillère à café de poudre,
// 1 g pour les herbes séchées ; sel, poivre et laurier ne comptent pas
const HERB_TSP = ['origan', 'thym', 'romarin', 'herbes de Provence', 'menthe séchée', 'aneth séché'];
export function spiceGrams(id) {
  const q = spiceRow(id); if (!q) return 0;
  return Object.entries(q).reduce((a, [k, v]) => a + (['sel', 'poivre', 'laurier', 'vanille'].includes(k) ? 0 : v * (HERB_TSP.includes(k) ? 1 : 2)), 0);
}
// « ½ c. à café de cumin », « 1 pincée de piment », « 2 feuilles de laurier »
const TSP_FRAC = { 0.25: '¼', 0.5: '½', 0.75: '¾' };
function tspText(v) {
  if (v < 0.19) return '1 pincée';
  const q = Math.round(v * 4) / 4, n = Math.floor(q), f = TSP_FRAC[+(q - n).toFixed(2)] || '';
  return `${n ? n : ''}${n && f ? ' ' : ''}${f} c. à café`;
}
const deOf = n => (/^[aeiouyhéèêâîôûœ]/i.test(n) ? `d'${n}` : `de ${n}`);
export function spiceQtyText(name, perPortion, factor = 1) {
  const v = perPortion * factor;
  if (name === 'laurier') { const f = Math.max(1, Math.round(v)); return `${f} ${f > 1 ? 'feuilles' : 'feuille'} de laurier`; }
  return `${tspText(v)} ${deOf(name)}`;
}
// Liste lisible des épices d'une recette, pour `factor` portions : « ½ c. à café de cumin, … »
export function spiceList(id, factor = 1, { withSalt = false } = {}) {
  const q = spiceRow(id); if (!q) return spicesOf(id);
  return Object.entries(q).filter(([k]) => withSalt || (k !== 'sel' && k !== 'poivre')).map(([k, v]) => spiceQtyText(k, v, factor)).join(', ');
}
// Remplace les repères [[épice]] d'une étape par la quantité pour `factor` portions
export function fillSpices(text, id, factor = 1) {
  if (!text || text.indexOf('[[') < 0) return text;
  const q = spiceRow(id) || {};
  return text.replace(/\[\[([^\]]+)\]\]/g, (_, k) => (q[k] ? spiceQtyText(k, q[k], factor) : k));
}

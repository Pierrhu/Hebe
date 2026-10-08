// DIET — bundled app (généré par build.js)
// 2026-10-08T08:47:59.350Z


// ──────────────────────────────────────────────
// data/migrate.js
// ──────────────────────────────────────────────
// migrate.js — Exécuté en tout premier (avant que les vues lisent le localStorage).

// ── Migration v3 (plats du monde, assiettes + accompagnement) ──
// Les quantités ajustées des anciens plans pointaient vers l'ancien ordre d'ingrédients :
// on les retire (les plats restent, en portion standard). Il suffit de régénérer la semaine.
localStorage.removeItem('hebe_timers'); // minuteurs retirés

(function migrate() {
  const V = '3';
  if (localStorage.getItem('hebe_data_version') === V) return;
  try {
    const log = JSON.parse(localStorage.getItem('diet_log') || '[]');
    log.forEach(e => Object.values(e.meals || {}).forEach(list =>
      (list || []).forEach(it => { if (it && typeof it === 'object') delete it.overrides; })));
    localStorage.setItem('diet_log', JSON.stringify(log));
  } catch {}
  localStorage.removeItem('hebe_locked_days');
  localStorage.removeItem('hebe_week_plan');
  localStorage.setItem('hebe_data_version', V);
})();


// ──────────────────────────────────────────────
// data/ingredients.js
// ──────────────────────────────────────────────
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
  herbes:        ['Herbes fraîches',            'g',     30,  2,    4,   0.5, 'flavor', 15, 'F', { buy: 30, max: 10 }],
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

const INGREDIENTS = {};
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

const getIngredient = (key) => INGREDIENTS[key];
const RAYONS = Object.values(RAYON);

function isCountableUnit(unit) { return /pi[èe]ce|unit|tranche|gousse/i.test(unit || ''); }

// Macros d'une quantité d'ingrédient
function ingMacros(key, qty) {
  const ing = INGREDIENTS[key];
  if (!ing) return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const f = ing.unit === 'pièce' ? qty : qty / 100;
  return {
    kcal: ing.per.kcal * f, protein: ing.per.protein * f,
    carbs: ing.per.carbs * f, fat: ing.per.fat * f,
  };
}

// Coût d'une quantité d'ingrédient (€)
function ingCost(key, qty) {
  const ing = INGREDIENTS[key];
  if (!ing) return 0;
  return ing.unit === 'pièce' ? ing.price * qty : ing.price * qty / 1000;
}

// ── Unités naturelles : ce qui se compte en tranches ou à la pièce ──
// Le moteur arrondit ces ingrédients à l'unité entière (js/optimizer.js → snapQty).
const NATURAL_UNITS = {
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
function humanQty(key, qty, unit, opts = {}) {
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

// v195 : les « Épices » de chaque recette, nommées (rayon épices Lidl). Affichées sur la fiche,
// dans la session de cuisine et dans le placard de la liste de courses.
const SPICES = {
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
};
const spicesOf = id => (id && (SPICES[id] || SPICES[String(id).replace(/S$/, '')])) || '';


// ──────────────────────────────────────────────
// data/recipes.js
// ──────────────────────────────────────────────
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

const RECIPES = [
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
      // v195 : whey simplement retirée (cookies, barres…) : on l'enlève aussi du texte
      .replace(/ et la whey/g, drop ? '' : ' et la whey').replace(/ avec la whey/g, drop ? '' : ' avec la whey')
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
const RETIRED = ['W42', 'B14', 'EN01', 'EN02', 'W23', 'W24', 'W26', 'B10', 'B12', 'B13', 'K01', 'K03', 'K07', 'K09', 'K11', 'S06', 'S09', 'S16', 'SA01', 'SA02', 'SA03', 'SA04', 'SA05', 'SA06', 'SA07', 'SA08', 'SA09', 'SA10', 'SA11', 'SA12', 'S01', 'S02', 'S03', 'S04', 'K14'];
RECIPES.forEach(r => { if (RETIRED.includes(r.id) || (r.wheyOf && RETIRED.includes(r.wheyOf))) r.retired = true; });

// Une recette contient-elle de la whey ?
const hasWhey = r => !!r && r.ingredients.some(i => i.key === 'whey');

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
function getExtras(id) { return loadExtras()[id] || []; }
function setExtras(id, list) {
  const all = loadExtras();
  if (list.length) all[id] = list; else delete all[id];
  localStorage.setItem(EXTRAS_KEY, JSON.stringify(all));
  applyExtras();
}
function applyExtras() {
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

const getDinners  = () => RECIPES.filter(r => r.category === 'dinner');
const getLunches  = () => RECIPES.filter(r => r.category === 'lunch');
const getMains    = () => RECIPES.filter(r => !r.retired && (r.category === 'dinner' || r.category === 'lunch') && !(r.tags || []).includes('cantine'));
const getSides    = () => RECIPES.filter(r => r.category === 'side' && !r.retired);
const getSweets   = () => RECIPES.filter(r => !r.retired && r.category === 'sweet');
const getBreakfasts = () => RECIPES.filter(r => !r.retired && r.category === 'breakfast');
const getStarters = () => RECIPES.filter(r => r.category === 'starter');
const getById     = (id) => RECIPES.find(r => r.id === id);
const getBatch    = () => RECIPES.filter(r => r.batch);
const isCantine   = (r) => !!r && (r.tags || []).includes('cantine');
const isOutside   = (r) => !!r && (r.tags || []).includes('imprevu');

// Famille de protéine principale d'une recette (pour la variété et les filtres).
// Ids alignés sur les chips de la vue Semaine : poulet · boeuf · crevettes · saumon (= poisson) · tofu (= végé)
const FAMILY = {
  poulet: 'poulet', haut_cuisse: 'poulet', boeuf_emince: 'boeuf', poulet_hache: 'poulet', poulet_tranches: 'poulet', boeuf: 'boeuf',
  saumon: 'saumon', poisson_blanc: 'saumon', thon: 'saumon', crevettes: 'crevettes',
  tofu: 'tofu', oeuf: 'tofu',
};
function proteinFamily(r) {
  let best = null, bestP = 0;
  r.ingredients.forEach(i => {
    if (FAMILY[i.key] && i.protein > bestP) { best = FAMILY[i.key]; bestP = i.protein; }
  });
  if (best) return best;
  return 'tofu'; // légumineuses → végé
}
// Poisson / fruits de mer frais : à manger dans les 2 jours
function isFreshFish(r) {
  return r.ingredients.some(i => ['saumon', 'poisson_blanc', 'crevettes'].includes(i.key));
}
// Féculent principal (pour éviter « riz » à tous les repas)
function mainStarch(r) {
  let best = null, bestQ = 0;
  r.ingredients.forEach(i => {
    const db = INGREDIENTS[i.key];
    if (db && (db.role === 'carb' || db.role === 'legume') && i.carbs > bestQ) { best = i.key; bestQ = i.carbs; }
  });
  return best;
}


// ──────────────────────────────────────────────
// data/household.js
// ──────────────────────────────────────────────
// household.js — Le foyer : une fiche par personne (1 pour l'instant, 2 au lot suivant).
//
// Stocké dans localStorage['hebe_household'] :
//   { version, onboarded, migrated, activeId, budget, equipment: { plaque, four, airfryer, autocuiseur, microondes, mixeur } | null, members: [Membre] }
// Membre :
//   { id, name, sex: 'male' | 'female' | null, age, height (m), weight (kg), bodyfat (%),
//     activity (1 à 4), protocol, phase, targets (objectifs réglés à la main ou null),
//     formula ('jeune' | 'classique'), lactose (0 aucun, 1 léger, 2 strict), gluten (idem),
//     free (repas libres, non calculés : ['0-lunch', '3-dinner', …], 0 = lundi), freeKcal (calories réservées par repas libre, 0 = part habituelle),
//     breakfast ('sucre' | 'sale' | 'mix' : petit-déjeuner de la formule classique), whey (true : en a, false : n'en a pas) }
// Le journal de chaque personne est séparé : 'diet_log' pour la première, 'diet_log_<id>' pour les autres.

const KEY = 'hebe_household';

// Niveaux d'activité : le niveau 2 vaut exactement l'ancien coefficient fixe (1,5).
const ACTIVITY = [
  { level: 1, coef: 1.35, label: 'Plutôt calme', desc: 'Travail assis, peu ou pas de sport.' },
  { level: 2, coef: 1.5,  label: 'Actif',        desc: 'Travail assis, sport trois à quatre fois par semaine.' },
  { level: 3, coef: 1.65, label: 'Très actif',   desc: 'Travail debout, ou sport presque tous les jours.' },
  { level: 4, coef: 1.8,  label: 'Intense',      desc: 'Travail physique et sport régulier.' },
];
const activityCoef = level => (ACTIVITY.find(a => a.level === level) || ACTIVITY[1]).coef;

// Aucune valeur par défaut : chaque personne renseigne les siennes à l'accueil.
const NEW_MEMBER = {
  name: '', sex: null, age: null, height: null, weight: null, bodyfat: null,
  activity: null, protocol: null, phase: 0, targets: null,
  formula: null, lactose: 0, gluten: 0, free: [], breakfast: 'mix', whey: null,
};
const MAX_MEMBERS = 2;

const read = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };

// Ancienne formule (avant le foyer) : sert seulement à savoir si les objectifs enregistrés
// étaient ceux du programme (on les recalcule alors) ou réglés à la main (on les garde).
function legacyTargets(p, protocolId, phase) {
  const OFFSETS = { P1: [0, 200, 400], P2: [-300], P3: [-300, -500], P4: [-300, -500, -700] };
  const offs = OFFSETS[protocolId] || OFFSETS.P4;
  const bmr = ((13.707 * p.weight + 492.3 * p.height - 6.673 * p.age + 77.607) + (21.6 * p.weight * (100 - p.bodyfat) / 100 + 370)) / 2;
  const kcal = bmr * 1.5 + offs[Math.min(phase, offs.length - 1)];
  const lean = p.weight * (100 - p.bodyfat) / 100;
  const protein = (p.weight * 1.5 + lean * 2) / 2, fat = 1.2 * lean;
  return { kcal: Math.round(kcal), protein: Math.round(protein), carbs: Math.round((kcal - protein * 4 - fat * 9) / 4), fat: Math.round(fat) };
}

// Première ouverture de cette version : on reprend l'ancien profil s'il a vraiment été rempli.
// Sans profil enregistré, on ne suppose rien : la personne passe par l'accueil complet.
function migrate() {
  const oldProfile = read('diet_profile');
  const hadData = !!(oldProfile && oldProfile.weight && oldProfile.height && oldProfile.age);
  const m = { ...NEW_MEMBER, id: 'm1' };
  if (hadData) {
    Object.assign(m, { activity: 2, bodyfat: 20 }, oldProfile); // le sexe est demandé à l'accueil
    m.protocol = localStorage.getItem('diet_protocol') || 'P4';
    m.formula = 'jeune'; // la formule de l'ancienne version
    m.whey = true;
    m.phase = parseInt(localStorage.getItem('diet_phase') || '0') || 0;
    const saved = read('diet_targets');
    if (saved && JSON.stringify(saved) !== JSON.stringify(legacyTargets(m, m.protocol, m.phase))) m.targets = saved;
  }
  const cant = read('hebe_cantine_days');
  if (Array.isArray(cant)) m.free = cant.map(d => `${d}-lunch`);
  return {
    version: 1, onboarded: false, migrated: hadData, activeId: 'm1',
    budget: null, appliances: { airfryer: 5, cooker: 6 },
    // équipement : demandé à l'accueil ; un profil repris garde l'équipement d'origine de l'app
    equipment: hadData ? { plaque: true, four: false, airfryer: true, autocuiseur: true, microondes: true, mixeur: true } : null,
    members: [m],
  };
}

let cache = null;
function getHousehold() {
  if (cache) return cache;
  const saved = read(KEY);
  cache = saved && Array.isArray(saved.members) && saved.members.length ? saved : migrate();
  // foyers créés avant la question sur l'équipement : équipement d'origine de l'app
  if (cache.equipment === undefined) cache.equipment = cache.onboardedOnce || cache.migrated ? { plaque: true, four: false, airfryer: true, autocuiseur: true, microondes: true, mixeur: true } : null;
  cache.members.forEach(m => {
    // anciens midis « cantine » : deviennent des repas libres
    if (!Array.isArray(m.free)) m.free = (Array.isArray(m.cantine) ? m.cantine : []).map(d => `${d}-lunch`);
    delete m.cantine;
    if (!m.breakfast) m.breakfast = 'mix';
    if (m.whey === undefined) m.whey = true; // fiches d'avant cette option : l'app reposait sur la whey
  });
  if (!saved) saveHousehold(cache);
  return cache;
}
function saveHousehold(h) {
  cache = h;
  localStorage.setItem(KEY, JSON.stringify(h));
}

const getMembers = () => getHousehold().members;
function getActiveMember() {
  const h = getHousehold();
  return h.members.find(m => m.id === h.activeId) || h.members[0];
}
function updateMember(id, patch) {
  const h = getHousehold();
  const m = h.members.find(x => x.id === id);
  if (m) Object.assign(m, patch);
  saveHousehold(h);
  return m;
}
const updateActiveMember = patch => updateMember(getActiveMember().id, patch);

const getMember = id => getHousehold().members.find(m => m.id === id);
function setActiveMember(id) {
  const h = getHousehold();
  if (h.members.some(m => m.id === id)) { h.activeId = id; saveHousehold(h); }
}
// Nombre de personnes du foyer : ajoute une fiche vierge ou retire la dernière
function setMemberCount(n) {
  const h = getHousehold();
  n = Math.max(1, Math.min(MAX_MEMBERS, n));
  while (h.members.length < n) h.members.push({ ...NEW_MEMBER, id: 'm' + (h.members.length + 1) });
  if (h.members.length > n) {
    h.members.slice(n).forEach(m => localStorage.removeItem('diet_log_' + m.id));
    h.members = h.members.slice(0, n);
  }
  if (!h.members.some(m => m.id === h.activeId)) h.activeId = h.members[0].id;
  saveHousehold(h);
}
const logKey = id => (!id || id === 'm1' ? 'diet_log' : 'diet_log_' + id);
// Budget de la semaine : réglé à la main, sinon environ 60 € par adulte (les semaines au-delà de +15 % sont écartées)
const weekBudget = () => getHousehold().budget || 60 * getHousehold().members.length;

function setEquipment(eq) {
  const h = getHousehold();
  h.equipment = { ...eq };
  saveHousehold(h);
}

const isOnboarded = () => !!getHousehold().onboarded;

// Riz et pâtes (v171) : 'complet' (par défaut), 'classique' ou 'plat' (choix sur la fiche de chaque plat).
// Commun au foyer : les plats sont cuisinés une seule fois pour tout le monde.
const STAPLE_MODES = ['complet', 'classique', 'plat'];
const getStaples = () => (STAPLE_MODES.includes(getHousehold().staples) ? getHousehold().staples : 'complet');
function setStaples(mode) { const h = getHousehold(); h.staples = mode; saveHousehold(h); }
// choix plat par plat : { W14: 'classique', … } ; absent = complet
const getDishStaple = id => (getHousehold().staplesByDish || {})[id] || 'complet';
function setDishStaple(id, v) {
  const h = getHousehold();
  h.staplesByDish = { ...(h.staplesByDish || {}) };
  if (v === 'classique') h.staplesByDish[id] = 'classique'; else delete h.staplesByDish[id];
  saveHousehold(h);
}
function setOnboarded(v = true) {
  const h = getHousehold();
  h.onboarded = v;
  if (v) h.onboardedOnce = true;
  saveHousehold(h);
}
// Fiche complète : tout ce qu'il faut pour calculer les besoins
const isComplete = m => !!(m && m.name && m.sex && m.age && m.height && m.weight && m.bodyfat && m.activity && m.protocol && m.formula && m.whey != null);

// Accord des textes selon le profil : « Tu es [prêt|prête] » → « Tu es prête » pour une femme.
function gx(text, sex) {
  return String(text).replace(/\[([^|\]]*)\|([^\]]*)\]/g, (_, m, f) => (sex === 'female' ? f : m));
}


// ──────────────────────────────────────────────
// data/calculator.js
// ──────────────────────────────────────────────
// calculator.js — Moteur Zero to Hero, adapté aux hommes et aux femmes.
//
// Métabolisme de base = moyenne de deux formules :
//   BMR1 (Harris-Benedict) homme = 13,707 × poids + 492,3 × taille (m) − 6,673 × âge + 77,607   (formule du tableur d'origine)
//   BMR1 (Harris-Benedict révisée) femme = 9,247 × poids + 309,8 × taille (m) − 4,330 × âge + 447,593
//   BMR2 (Katch-McArdle, commune) = 21,6 × masse maigre + 370
// Maintenance = BMR × coefficient d'activité (niveau 2 = 1,5, l'ancien coefficient fixe).
// Protéines = moyenne(poids × 1,5 ; masse maigre × 2)
// Lipides   = 1,2 × masse maigre, jamais moins de 25 % des calories (femme) ou 20 % (homme)
// Glucides  = le reste
// Programmes : écart en POURCENTAGE de la maintenance (un écart fixe pèse trop lourd sur de petits besoins).
// Garde-fou : jamais sous le métabolisme de base, ni sous 1 200 kcal (femme) ou 1 500 kcal (homme).


// Textes : [masculin|féminin] est accordé selon le profil ; {kg} = rythme estimé de l'étape.
const PROTOCOLS = [
  {
    id: 'P1', name: 'Prise de muscle propre',
    purpose: "Ce programme sert à prendre du muscle en limitant au maximum la prise de gras. Tu commences à ta maintenance, puis tu ajoutes un léger surplus de calories uniquement quand ta progression ralentit. Le gain est lent mais propre : la balance monte doucement et ton tour de taille reste stable.",
    forWho: ["Tu es déjà plutôt [sec|sèche] et tu veux gagner du volume", "Tu t'entraînes régulièrement et tes charges progressent", "Tu acceptes de prendre un peu de poids pour construire du muscle"],
    duration: 'Sur plusieurs mois',
    tagline: 'Construire du muscle en limitant le gras',
    phases: [
      { label: 'Semaine initiale', short: "Maintenance : le corps s'adapte, la force grimpe", when: 'Ta force stagne deux semaines', pct: 0,
        advice: "Démarre à ta maintenance. Mange à ta dépense réelle, le temps que ton corps s'adapte et que ta force grimpe.",
        advance: "Passe à l'étape suivante quand ta progression en charge stagne deux semaines de suite." },
      { label: 'Étape 1', short: '+5 % : prise de muscle propre', when: 'La prise de poids ralentit, le miroir reste net', pct: 0.05,
        advice: "Surplus de 5 %. C'est le bon réglage pour gagner du muscle proprement, environ {kg} kg par semaine au maximum.",
        advance: 'Augmente encore si la prise de poids ralentit et que le miroir reste net.' },
      { label: 'Étape 2', short: '+10 % quand tu pousses fort', when: 'Dernier palier : redescends si le gras monte', pct: 0.10,
        advice: 'Surplus de 10 % pour les phases où tu pousses fort. Surveille ton tour de taille : si le gras monte trop vite, redescends.',
        advance: 'Dernier palier. Reviens en arrière dès que la prise de gras devient visible.' },
    ],
  },
  {
    id: 'P2', name: 'Recomposition corporelle',
    purpose: "Ce programme sert à perdre du gras et à gagner du muscle en même temps. Un léger déficit de 10 %, des protéines élevées et un entraînement sérieux suffisent : ton corps puise dans ses réserves de gras tout en construisant du muscle. Le poids bouge peu, ce sont le miroir et le tour de taille qui changent.",
    forWho: ['Tu débutes la musculation ou tu reprends après une pause', "Tu as un peu de gras à perdre, mais pas beaucoup", 'Tu veux un seul réglage, sans changer de palier'],
    duration: '8 à 12 semaines, puis bilan',
    tagline: 'Perdre du gras et gagner du muscle',
    phases: [
      { label: 'Phase unique', short: '−10 % sur la durée : la balance bouge peu, le miroir oui', when: 'Refais ton profil toutes les quatre semaines', pct: -0.10,
        advice: "Reste sur ce déficit léger sur la durée. La balance bougera peu, mais le miroir et les mensurations, oui. C'est normal et c'est le but.",
        advance: 'Pas de palier à changer. Mets à jour ton poids et ta masse grasse toutes les quatre semaines pour recalculer.' },
    ],
  },
  {
    id: 'P3', name: 'Créer le déficit parfait',
    purpose: "Ce programme sert à sécher sur quelques semaines, de façon maîtrisée. Tu commences par un déficit doux, puis tu le creuses une seule fois quand la perte de poids ralentit. C'est un bon compromis entre rapidité et confort au quotidien.",
    forWho: ["Tu as un objectif proche, comme l'été ou un événement", 'Tu as quelques kilos de gras à perdre', 'Tu veux un cadre simple, en deux étapes'],
    duration: '4 à 8 semaines',
    tagline: 'Sécher de façon maîtrisée',
    phases: [
      { label: 'Semaine initiale', short: '−10 % : déficit doux, énergie intacte', when: 'Le poids stagne une dizaine de jours', pct: -0.10,
        advice: "Déficit doux de 10 %. Tu perds environ {kg} kg par semaine sans souffrir, et l'énergie reste bonne.",
        advance: "Passe à l'étape 1 quand ton poids stagne une dizaine de jours." },
      { label: 'Étape 1', short: '−15 % : appuie-toi sur les protéines et les légumes', when: 'Dernier palier : pour aller plus loin, passe à la perte progressive', pct: -0.15,
        advice: 'Déficit de 15 %, environ {kg} kg par semaine. La faim se fait sentir : appuie-toi sur les protéines et les légumes pour le volume.',
        advance: "C'est le palier final de ce programme. Si tu dois aller plus loin, passe à la perte de gras progressive." },
    ],
  },
  {
    id: 'P4', name: 'Perte de gras progressive',
    purpose: "Ce programme sert à perdre du gras sur plusieurs mois, sans brusquer ton corps. Le déficit augmente par paliers, et seulement quand la perte ralentit : ton métabolisme ne freine pas et tu tiens dans la durée. C'est le programme conseillé pour une vraie transformation.",
    forWho: ['Tu as une quantité importante de gras à perdre', 'Tu vises un changement durable, pas un effet express', 'Tu es [prêt|prête] à suivre le plan sur plusieurs mois'],
    duration: '3 à 6 mois',
    tagline: 'Sécher sur la durée sans choc',
    phases: [
      { label: 'Semaine initiale', short: '−10 % : démarrage en douceur', when: 'La perte ralentit, après environ deux semaines', pct: -0.10,
        advice: "Démarrage en douceur avec un déficit de 10 %. Laisse ton corps s'habituer et garde toute ton énergie pour les séances.",
        advance: "Passe à l'étape 1 dès que la perte de poids ralentit, après environ deux semaines." },
      { label: 'Étape 1', short: '−15 % : perte régulière', when: 'Le poids stagne malgré le plan', pct: -0.15,
        advice: 'On creuse à 15 % sous ta maintenance : une perte régulière d\'environ {kg} kg par semaine. Priorité aux protéines et au sommeil.',
        advance: "Passe à l'étape 2 quand le poids stagne à nouveau malgré le respect du plan." },
      { label: 'Étape 2', short: '−20 % : dernière ligne droite, sur une courte période', when: 'Dernier palier : prévois ensuite une phase de maintenance', pct: -0.20,
        advice: "Déficit de 20 % pour la dernière ligne droite, à tenir sur une courte période. L'hydratation et les fibres sont essentielles.",
        advance: 'Palier final. Après ça, prévois une phase de maintenance avant de repartir.' },
    ],
  },
];

function getProtocol(id) {
  return PROTOCOLS.find(p => p.id === id) || PROTOCOLS[3];
}

// profile = { sex, age, height (m), weight (kg), bodyfat (%), activity (1 à 4) }
function computeBase(profile) {
  const { age, height, weight, bodyfat } = profile;
  const female = profile.sex === 'female';
  const bmr1 = female
    ? 9.247 * weight + 309.8 * height - 4.330 * age + 447.593
    : 13.707 * weight + 492.3 * height - 6.673 * age + 77.607;
  const leanMass = weight * (100 - bodyfat) / 100;
  const bmr2 = 21.6 * leanMass + 370;
  const bmr  = (bmr1 + bmr2) / 2;
  const coef = activityCoef(profile.activity ?? 2);
  // v199 : correction de la dépense mesurée sur tes pesées (ajustement automatique, 0,85 à 1,15)
  const adj = Math.min(1.15, Math.max(0.85, +profile.tdeeAdj || 1));
  const maintenance = bmr * coef * adj;
  const protein = (weight * 1.5 + leanMass * 2) / 2;
  const fat     = 1.2 * leanMass;
  const floorKcal = Math.max(bmr, female ? 1200 : 1500);
  const fatShare  = female ? 0.25 : 0.20;
  return { bmr1, bmr2, bmr, coef, adj, maintenance, maintenanceFormula: bmr * coef, leanMass, protein, fat, floorKcal, fatShare };
}

// Cibles d'une étape, avec le détail des garde-fous appliqués
function computeDetails(profile, protocolId, phaseIndex = 0) {
  const base = computeBase(profile);
  const protocol = getProtocol(protocolId);
  const phase = protocol.phases[Math.min(phaseIndex, protocol.phases.length - 1)];
  const wanted = base.maintenance * (1 + phase.pct);
  const kcal = Math.max(wanted, base.floorKcal);
  const protein = base.protein;
  const fat = Math.max(base.fat, kcal * base.fatShare / 9);
  const carbs = Math.max(0, (kcal - protein * 4 - fat * 9) / 4);
  return {
    targets: { kcal: Math.round(kcal), protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat) },
    floored: kcal > wanted + 0.5,
    fatRaised: fat > base.fat + 0.5,
    wanted: Math.round(wanted),
    floor: Math.round(base.floorKcal),
  };
}

// Renvoie les cibles { kcal, protein, carbs, fat } pour une phase donnée
function computeTargets(profile, protocolId, phaseIndex = 0) {
  return computeDetails(profile, protocolId, phaseIndex).targets;
}

// Toutes les phases d'un programme (pour affichage du plan complet)
function computeAllPhases(profile, protocolId) {
  const protocol = getProtocol(protocolId);
  return protocol.phases.map((ph, i) => ({
    label: ph.label,
    pct: ph.pct,
    targets: computeTargets(profile, protocolId, i),
  }));
}

// Rythme estimé (kg par semaine) d'un écart de calories : environ 7 700 kcal par kilo
const kgPerWeek = deltaKcal => Math.abs(deltaKcal) * 7 / 7700;
const kgText = v => v.toFixed(1).replace('.', ',');

// Programme avec ses textes accordés au profil et ses rythmes calculés
function protocolFor(profile, protocolId) {
  const p = getProtocol(protocolId);
  const maint = computeBase(profile).maintenance;
  const ph = computeAllPhases(profile, protocolId);
  const t = s => gx(s, profile.sex);
  return {
    ...p,
    purpose: t(p.purpose), forWho: p.forWho.map(t), tagline: t(p.tagline),
    phases: p.phases.map((x, i) => ({
      ...x,
      short: t(x.short), when: t(x.when), advance: t(x.advance),
      advice: t(x.advice).replace('{kg}', kgText(kgPerWeek(ph[i].targets.kcal - maint))),
    })),
  };
}
const protocolsFor = profile => PROTOCOLS.map(p => protocolFor(profile, p.id));

// ── Profil de la personne active (stocké dans le foyer) ──
const PROFILE_KEYS = ['sex', 'age', 'height', 'weight', 'bodyfat', 'activity', 'tdeeAdj'];
function getProfile() {
  const m = getActiveMember();
  const p = {};
  PROFILE_KEYS.forEach(k => p[k] = m[k]);
  return p;
}
function saveProfile(p) {
  const patch = {};
  PROFILE_KEYS.forEach(k => { if (p[k] !== undefined) patch[k] = p[k]; });
  updateActiveMember(patch);
}

const getSelectedProtocol = () => getActiveMember().protocol || 'P4';
const saveSelectedProtocol = id => updateActiveMember({ protocol: id });
const getSelectedPhase = () => parseInt(getActiveMember().phase || 0);
const saveSelectedPhase = i => updateActiveMember({ phase: i });


// ──────────────────────────────────────────────
// data/user.js
// ──────────────────────────────────────────────
// user.js — Objectifs actifs de la personne sélectionnée.
// Priorité : objectifs réglés à la main > calcul automatique (profil + programme) > défaut.


const DEFAULT_TARGETS = { kcal: 2200, protein: 140, carbs: 250, fat: 70 };

// Objectifs d'une personne précise du foyer (sans changer la personne active)
function getTargetsFor(member) {
  if (member.targets) return { ...DEFAULT_TARGETS, ...member.targets };
  try { return computeTargets(member, member.protocol, member.phase || 0); } catch { return { ...DEFAULT_TARGETS }; }
}

function getTargets() {
  const saved = getActiveMember().targets;
  if (saved) return { ...DEFAULT_TARGETS, ...saved };
  try {
    return computeTargets(getProfile(), getSelectedProtocol(), getSelectedPhase());
  } catch {
    return { ...DEFAULT_TARGETS };
  }
}

// Enregistre des objectifs : s'ils sont identiques au calcul du programme, on ne garde rien
// (ils suivront automatiquement les changements de profil).
function saveTargets(targets) {
  const computed = computeTargets(getProfile(), getSelectedProtocol(), getSelectedPhase());
  const same = ['kcal', 'protein', 'carbs', 'fat'].every(k => targets[k] === computed[k]);
  updateActiveMember({ targets: same ? null : { kcal: targets.kcal, protein: targets.protein, carbs: targets.carbs, fat: targets.fat } });
}
const hasManualTargets = () => !!getActiveMember().targets;

function resetTargets() {
  updateActiveMember({ targets: null });
  return getTargets();
}

function getWeeklyKcalTarget() {
  return getTargets().kcal * 7;
}

const USER = {
  get name() { return getActiveMember().name; },
  get sex() { return getActiveMember().sex; },
  get targets() { return getTargets(); },
};



// ──────────────────────────────────────────────
// data/log.js
// ──────────────────────────────────────────────
// log.js — Journal & planning hebdomadaire
//
// Modèle de données (localStorage 'diet_log') :
//   { date: 'YYYY-MM-DD', meals: { lunch:[item], dinner:[item], sides:[item], sweet:[item] } }
// où item = { id: 'D01', servings: 1 }   ← servings = multiplicateur de portions
//
// Migration : les anciennes entrées stockaient des strings ('D01') → converties à la volée.


const EMPTY_MEALS = () => ({ breakfast: [], starter: [], lunch: [], dinner: [], sides: [], sweet: [] });

function normalizeItem(item) {
  // Ancien format : string → { id, servings:1 }
  if (typeof item === 'string') return { id: item, servings: 1 };
  const out = { id: item.id, servings: item.servings || 1 };
  if (item.overrides) out.overrides = item.overrides; // quantités d'ingrédients ajustées
  if (item.with) out.with = item.with;                // accompagnement lié au midi / au soir
  if (item.frozen) out.frozen = true;                 // boîte passée par le congélateur (décongelée la veille)
  if (item.kind) out.kind = item.kind;                // repas libre précisé : 'cantine'
  return out;
}

function normalizeEntry(entry) {
  const meals = EMPTY_MEALS();
  ['breakfast', 'starter', 'lunch', 'dinner', 'sides', 'sweet'].forEach(slot => {
    meals[slot] = (entry.meals?.[slot] || []).map(normalizeItem);
  });
  const out = { date: entry.date, meals };
  // imprévu : plat d'origine conservé pour pouvoir annuler
  if (entry.outside && Object.keys(entry.outside).length) out.outside = entry.outside;
  return out;
}

// Chaque personne du foyer a son propre journal (memberId absent = personne active)
const keyOf = memberId => logKey(memberId || getActiveMember().id);

function getLog(memberId) {
  let raw = [];
  try { raw = JSON.parse(localStorage.getItem(keyOf(memberId)) || '[]'); } catch {}
  return raw.map(normalizeEntry);
}

function saveLog(log, memberId) {
  localStorage.setItem(keyOf(memberId), JSON.stringify(log));
}

function getEntry(date, memberId) {
  const log = getLog(memberId);
  const existing = log.find(e => e.date === date);
  return existing || { date, meals: EMPTY_MEALS() };
}

function saveEntry(entry, memberId) {
  const log = getLog(memberId).filter(e => e.date !== entry.date);
  log.push(entry);
  saveLog(log, memberId);
}

// Date au format AAAA-MM-JJ, en heure locale (toISOString passe en UTC et recule d'un jour
// en France entre minuit et 2 h du matin)
function localYMD(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getTodayDate() {
  return localYMD(new Date());
}

function getTodayEntry() {
  return getEntry(getTodayDate());
}

function saveTodayEntry(entry) {
  saveEntry(entry);
}

// ── Helpers semaine ─────────────────────────────────
// Lundi comme premier jour de semaine.

function getWeekDates(refDate = new Date()) {
  const d = new Date(refDate);
  const day = (d.getDay() + 6) % 7; // 0 = lundi
  const monday = new Date(d);
  monday.setDate(d.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    return localYMD(dd);
  });
}

function getNextWeekDates() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return getWeekDates(d);
}


// ──────────────────────────────────────────────
// data/prefs.js
// ──────────────────────────────────────────────
// prefs.js — Tes goûts : 👍 / 👎 sur les recettes.
//   👍 : la recette sort plus souvent au tirage
//   👎 : la recette ne sort plus (sauf s'il ne reste rien d'autre)

const RATINGS_KEY = 'hebe_ratings';

function getRatings() {
  try { return JSON.parse(localStorage.getItem(RATINGS_KEY) || '{}'); } catch { return {}; }
}
function getRating(id) { return getRatings()[id] || 0; }
function setRating(id, value) {
  const r = getRatings();
  if (!value || r[id] === value) delete r[id]; else r[id] = value;
  localStorage.setItem(RATINGS_KEY, JSON.stringify(r));
  return r[id] || 0;
}


// ──────────────────────────────────────────────
// data/photos.js
// ──────────────────────────────────────────────
// photos.js — Photos des plats (img/dishes/<code>.webp, 720 px, WebP).
// Pour ajouter une photo : déposer le fichier dans img/dishes/ et ajouter son code ici.
// Les plats sans photo affichent leur emoji.


const PHOTOS = new Set(['B01', 'B02', 'B05', 'B06', 'B07', 'B15', 'B16', 'C01', 'K01', 'K02', 'K03', 'K05', 'K06', 'K07', 'K08', 'K09', 'K10', 'K11', 'K12', 'K13', 'K14', 'K15', 'K16', 'K17', 'K18', 'K19', 'K20', 'K21', 'S02', 'S05', 'S07', 'S08', 'S09', 'S11', 'S12', 'S16', 'SA01', 'SA11', 'W01', 'W02', 'W03', 'W04', 'W05', 'W06', 'W07', 'W08', 'W09', 'W10', 'W11', 'W12', 'W13', 'W14', 'W15', 'W16', 'W17', 'W18', 'W19', 'W20', 'W21', 'W22', 'W23', 'W24', 'W25', 'W26', 'W27', 'W28', 'W29', 'W30', 'W31', 'W32', 'W33', 'W34', 'W35', 'W36', 'W37', 'W38', 'W39', 'W40', 'W41', 'W43', 'W44', 'W45', 'W46', 'W47', 'W48', 'W49', 'W50', 'W51', 'W52', 'W53', 'W54', 'W55', 'W56', 'W57', 'W58', 'W59', 'W60', 'W61', 'W62', 'W63', 'W64', 'W65', 'W66', 'W67', 'W68', 'W69', 'W70', 'W71', 'W72', 'W73', 'W74', 'W75']);

const photoUrl = id => (PHOTOS.has(id) ? `img/dishes/${id}.webp` : null);
// Les variantes (ex. sans whey) reprennent la photo de leur recette d'origine (champ photo)
const photoOf = r => photoUrl(r.photo || r.id);

// Vignette : photo si disponible, sinon pastille emoji de même taille
// Illustrations dessinées (sans photo) : repas libre et repas dehors
const AINK = '#2A3A30';
const AK = `stroke="${AINK}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"`;
const AHI = 'stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round" fill="none" opacity=".7"';
// Repas libre : le tablier accroché (ce soir, on ne cuisine pas)
// Repas libre : le tablier au repos, accroché à un crochet (bride passée par-dessus), légèrement penché
const ART_TABLIER = `<svg viewBox="0 0 160 160"><rect width="160" height="160" fill="#E4EEE6"/><ellipse cx="80" cy="144" rx="38" ry="5" fill="#2A3A30" opacity=".08"/><rect x="70" y="14" width="20" height="12" rx="4" fill="#C9A77C" stroke="#2A3A30" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
  <path d="M80 26 v6 c0 5 -6 5 -6 1" fill="none" stroke="#2A3A30" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/><g transform="rotate(-7 80 32)"><path d="M66 61 C64 42 71 32 80 32 C89 32 96 42 94 61" fill="none" stroke="#2A3A30" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/><path d="M64 60 h32 l4 18 c9 2 14 5 17 8 l-6 44 c-1 4 -4 6 -8 6 h-46 c-4 0 -7 -2 -8 -6 l-6 -44 c3 -3 8 -6 17 -8 Z" fill="#F6F1E6" stroke="#2A3A30" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
  <path d="M68 66 h24 l3 14 c7 2 11 4 13 6 l-5 38 c0 2 -2 4 -4 4 h-38 c-2 0 -4 -2 -4 -4 l-5 -38 c2 -2 6 -4 13 -6 Z" fill="none" stroke="#E2D6C0" stroke-width="2" stroke-dasharray="4 3"/>
  <rect x="65" y="94" width="30" height="20" rx="5" fill="#7C9885" stroke="#2A3A30" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
  <path d="M69 99 h22" stroke="#A9C2B2" stroke-width="2" stroke-linecap="round" stroke-dasharray="3 3"/></g><path d="M124 50 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 Z" fill="#E0A95E"/>
  <path d="M34 104 l2 4 l4 2 l-4 2 l-2 4 l-2 -4 l-4 -2 l4 -2 Z" fill="#E0A95E"/><circle cx="128" cy="112" r="2.2" fill="#E0A95E"/></svg>`;
// Repas dehors : le joker (un repas joué ailleurs)
const ART_JOKER = `<svg viewBox="0 0 160 160"><rect width="160" height="160" fill="#E7F0F5"/>
  <circle cx="80" cy="80" r="58" fill="#F3F8FB"/>
  <ellipse cx="84" cy="132" rx="40" ry="6" fill="${AINK}" opacity=".08"/>
  <!-- carte du dessous -->
  <g transform="rotate(10 86 82)"><rect x="56" y="34" width="62" height="88" rx="10" fill="#E9E0CF" ${AK}/></g>
  <!-- carte joker -->
  <g transform="rotate(-8 78 80)">
    <rect x="46" y="34" width="62" height="88" rx="10" fill="#F6F1E6" ${AK}/>
    <rect x="53" y="41" width="48" height="74" rx="6" fill="none" stroke="#E2D6C0" stroke-width="2"/>
    <circle cx="77" cy="78" r="21" fill="#6FA3C0" ${AK}/>
    <path d="M60 72 c1 -6 4 -10 8 -13" ${AHI}/>
    <path d="M70 66 v10 M74 66 v10 M70 76 c0 4 4 4 4 0 M72 78 v14" stroke="#F6F1E6" stroke-width="2.6" stroke-linecap="round" fill="none"/>
    <path d="M85 66 c-5 2 -5 10 0 12 v14" stroke="#F6F1E6" stroke-width="2.6" stroke-linecap="round" fill="none"/>
    <path d="M60 41 l1.8 4.2 l4.2 1.8 l-4.2 1.8 l-1.8 4.2 l-1.8 -4.2 l-4.2 -1.8 l4.2 -1.8 Z" fill="#E0A95E"/>
    <path d="M94 104 l1.8 4.2 l4.2 1.8 l-4.2 1.8 l-1.8 4.2 l-1.8 -4.2 l-4.2 -1.8 l4.2 -1.8 Z" fill="#E0A95E"/>
  </g>
  <path d="M122 38 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 Z" fill="#E0A95E"/>
  <path d="M32 98 l2 4 l4 2 l-4 2 l-2 4 l-2 -4 l-4 -2 l4 -2 Z" fill="#E0A95E"/>
  <circle cx="128" cy="104" r="2.2" fill="#E0A95E"/>
</svg>`;
// Illustrations (v151) : images détourées sur un fond de couleur
const artPic = (src, bg) => `<span class="art-pic" style="background:${bg}"><img src="${src}" alt=""></span>`;
const ART = { L01: artPic('img/art/tablier.webp', '#E4EEE6'), X01: artPic('img/art/joker.webp', '#E7F0F5') };
const artFor = id => ART[id] || null;
// Repas libre précisé « cantine » : le plateau, un peu plus bas dans la vignette
const cantineThumb = (cls = '') => `<span class="dish-ph dish-ph-art ${cls}" aria-hidden="true"><span class="art-pic art-low" style="background:#E4EEE6"><img src="img/art/cantine.webp" alt=""></span></span>`;

function dishThumb(r, cls = '') {
  if (!r) return '';
  if (ART[r.id]) return `<span class="dish-ph dish-ph-art ${cls}" aria-hidden="true">${ART[r.id]}</span>`;
  const u = photoOf(r);
  return u
    ? `<img class="dish-ph ${cls}" src="${u}" alt="" loading="lazy" decoding="async">`
    : `<span class="dish-ph dish-ph-emoji ${cls}" aria-hidden="true">${r.emoji}</span>`;
}

// ── Notes visibles sur les photos ──
const ICON_HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.3-4.4-9.3-8.8C1.2 8.4 3.2 4.6 6.9 4.6c2 0 3.5 1.1 5.1 3 1.6-1.9 3.1-3 5.1-3 3.7 0 5.7 3.8 4.2 7.1-2 4.4-9.3 8.8-9.3 8.8z"/></svg>';
const ICON_NOPE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.7a2 2 0 0 0-2 1.7l-1.4 9A2 2 0 0 0 4.3 15H10z"/><path d="M17 2h2.7A2.3 2.3 0 0 1 22 4v7a2.3 2.3 0 0 1-2.3 2H17"/></svg>';
const rateClass = id => (getRating(id) > 0 ? 'is-liked' : getRating(id) < 0 ? 'is-nope' : '');
// Vignette + badge (cœur si aimé, pouce baissé + noir et blanc si écarté)
function dishThumbRated(r, cls = '') {
  if (!r) return '';
  const v = getRating(r.id);
  return `<span class="ph-wrap ${rateClass(r.id)}">${dishThumb(r, cls)}${v ? `<span class="ph-badge">${v > 0 ? ICON_HEART : ICON_NOPE}</span>` : ''}</span>`;
}


// ──────────────────────────────────────────────
// js/adapt.js
// ──────────────────────────────────────────────
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


const TOOLS = [
  { key: 'plaque',      label: 'Plaques de cuisson', desc: 'Poêle et casserole' },
  { key: 'four',        label: 'Four',               desc: 'Traditionnel ou à chaleur tournante' },
  { key: 'airfryer',    label: 'Air fryer',          desc: 'Friteuse sans huile' },
  { key: 'autocuiseur', label: 'Autocuiseur',        desc: 'Cookeo, cocotte-minute électrique' },
  { key: 'microondes',  label: 'Micro-ondes',        desc: 'Pour réchauffer les boîtes' },
  { key: 'mixeur',      label: 'Mixeur',             desc: 'Pour les smoothies et les shakes' },
];
// Équipement d'origine de l'app (profils repris des anciennes versions)
const DEFAULT_EQUIPMENT = { plaque: true, four: false, airfryer: true, autocuiseur: true, microondes: true, mixeur: true };

const getEquipment = () => getHousehold().equipment || null;
const eqOr = () => getEquipment() || DEFAULT_EQUIPMENT;

// Ce dont une recette a besoin, d'après ses étapes (hors « Au moment de manger »)
function needs(r) {
  const txt = (r.baseSteps || r.steps).filter(s => !/^Au moment de manger/.test(s)).join(' ');
  return {
    airfryer: /air fryer/i.test(txt),
    autocuiseur: /autocuiseur/i.test(txt),
    plaque: /poêle/i.test(txt),
    mixeur: /mixeur|\bmixe\b/i.test(txt),
  };
}
function isPossible(r, eq = eqOr()) {
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
function adaptStep(st, eq = eqOr(), r = null) {
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
function applyEquipment() {
  const eq = eqOr();
  RECIPES.forEach(r => {
    if (!r.baseSteps) r.baseSteps = r.steps.slice();
    r.steps = r.baseSteps.map(st => adaptStep(st, eq, r));
    r._eqSteps = r.steps.slice(); // point de départ du régime (diet.js)
    r.unavailable = !isPossible(r, eq);
  });
}
const isAvailable = r => !!r && !r.unavailable;

// Nombre de plats possibles avec un équipement donné (pour l'accueil)
function countPossible(eq) {
  const mains = RECIPES.filter(r => !r.retired && (r.category === 'dinner' || r.category === 'lunch') && r.batch && !(r.tags || []).includes('cantine'));
  return { ok: mains.filter(r => isPossible(r, eq)).length, total: mains.length };
}


// ──────────────────────────────────────────────
// js/staples.js
// ──────────────────────────────────────────────
// staples.js — Riz et pâtes complets ou classiques (v171)
// Les recettes sont écrites au riz complet et aux pâtes complètes. Selon le réglage du foyer (Mon programme → Riz et pâtes),
// ou le choix fait sur la fiche d'un plat en mode « plat par plat », on repasse au riz blanc et aux pâtes classiques :
// ingrédient, valeurs nutritionnelles, nom, étapes (eau et temps de cuisson) et temps affiché.
// Appliqué en dernier, après l'équipement (adapt.js) et le régime (diet.js), pour couvrir aussi le riz
// qui remplace la semoule ou le boulgour dans le régime sans gluten.

const CLASSIC = { riz: 'riz_blanc', pates: 'pates_classiques' };

// le plat est-il cuisiné en complet ?
function isWhole(id) {
  const mode = getStaples();
  if (mode === 'classique') return false;
  if (mode === 'plat') return getDishStaple(id) !== 'classique';
  return true;
}
// 'riz', 'pates' ou null : ce que le réglage concerne dans ce plat (avant substitution)
const stapleKind = r => r?._staple || null;

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

function applyStaples() {
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


// ──────────────────────────────────────────────
// js/diet.js
// ──────────────────────────────────────────────
// Régimes sans lactose (v155) et sans gluten (v156)
// Pour toute personne qui a coché « Intolérance » ou « Strict » :
// - les recettes au fromage blanc, au fromage frais, au carré frais ou à la whey sont écartées pour elle ;
// - dans les recettes restantes : yaourt grec → yaourt sans lactose, lait → boisson à l'avoine,
//   crème → crème de coco ; en « Strict », cheddar et feta → emmental (parmesan et emmental, affinés, sont gardés).
// Les plats étant communs au foyer, les remplacements suivent le niveau le plus strict du foyer.

const LACTOSE_OUT = ['fromage_blanc', 'fromage_frais', 'carre_frais', 'whey', 'cottage'];
const SUB1 = { yaourt_grec: 'yaourt_sl', lait: 'boisson_avoine', creme: 'creme_coco' };
const SUB2 = { ...SUB1, cheddar: 'emmental', feta: 'emmental' };

// Gluten : « Sensibilité » (1) ou « Strict » (2)
const GLUTEN_OUT1 = ['chapelure', 'gnocchis', 'boudoirs'];                // écartées dans les deux niveaux
const GLUTEN_OUT2 = ['flocons', 'granola', 'cornflakes'];     // en plus, en strict (risque de traces)
const GSUB1 = { semoule: 'riz', boulghour: 'riz', pates: 'pates_sg', nouilles_oeufs: 'pates_sg', pain: 'pain_sg', baguette: 'pain_sg', pain_burger: 'pain_sg', pita: 'wrap_sg', tortilla: 'wrap_sg' };
const GSUB2 = { ...GSUB1, soja: 'tamari' };
const GDROP = ['oignons_frits'];

const lactoseOf = id => (getMembers().find(m => m.id === id)?.lactose || 0);
const glutenOf = id => (getMembers().find(m => m.id === id)?.gluten || 0);
const householdLactose = () => Math.max(0, ...getMembers().map(m => m.lactose || 0));
const householdGluten = () => Math.max(0, ...getMembers().map(m => m.gluten || 0));
// Sans lactose, les compléments protéinés (tartines au carré frais, fromage blanc) disparaissent :
// ses plats portent un peu plus de protéines pour compenser.
const PROTEIN_BOOST = 1.25;
const proteinBoost = id => (lactoseOf(id) >= 1 ? PROTEIN_BOOST : 1);
// recette permise pour une personne (niveaux de lactose et de gluten : 0, 1 ou 2)
const dietOk = (r, lac = 0, glu = 0) => !!r && !(lac >= 1 && r.lacOut) && !(glu >= 1 && r.gluOut1) && !(glu >= 2 && r.gluOut2);

// Textes des étapes et des noms
function retext(t, sub) {
  if (sub.yaourt_grec) t = t.replace(/yaourt grec/g, 'yaourt sans lactose').replace(/Yaourt grec/g, 'Yaourt sans lactose');
  if (sub.lait) t = t
    .replace(/\blait demi-écrémé\b/g, "boisson à l'avoine")
    .replace(/\b([Ll])e lait\b(?! de coco)/g, (m, l) => `${l === 'L' ? 'La' : 'la'} boisson à l'avoine`)
    .replace(/\bdu lait\b(?! de coco)/g, "de la boisson à l'avoine")
    .replace(/\bet lait\b(?! de coco)/g, "et boisson à l'avoine")
    .replace(/, lait\b(?! de coco)/g, ", boisson à l'avoine");
  if (sub.creme) t = t.replace(/crème fraîche/g, 'crème de coco').replace(/\bla crème\b(?! de coco)/g, 'la crème de coco');
  if (sub.cheddar) t = t.replace(/la tranche de cheddar/g, "l'emmental").replace(/cheddar/g, 'emmental');
  if (sub.feta) t = t.replace(/la feta émiettée/g, "l'emmental râpé").replace(/\bfeta\b/g, 'emmental');
  return t;
}

// Étapes propres au passage au riz et aux pâtes sans gluten
function glutenSteps(r, steps, used) {
  const eq = getEquipment() || {};
  const cooker = eq.autocuiseur !== false;
  // étape du riz, selon l'équipement du foyer (mêmes textes que le reste de l'app)
  const rizBase = (RECIPES.find(x => x.id === 'W01')?.baseSteps || []).find(st => /^Riz :/.test(st));
  const riz = cooker && rizBase ? rizBase
    : "Riz : rince-le à l'eau froide, puis mets-le dans une casserole avec 2,5 fois son poids d'eau (par exemple 225 ml d'eau pour 90 g de riz). Porte à ébullition, couvre, baisse à feu très doux et laisse cuire 35 minutes, puis laisse reposer 10 minutes hors du feu sans ouvrir. Mets-le en boîtes dès qu'il a tiédi : le riz cuit ne doit pas rester plus d'une heure à température ambiante.";
  const pastaSG = "Fais cuire les pâtes sans gluten dans une grande casserole d'eau bouillante salée, le temps indiqué sur le paquet : sous pression, elles colleraient. Égoutte-les en gardant 3 cuillères à soupe d'eau de cuisson par portion.";
  let out = steps.slice();
  if (used.pates || used.nouilles_oeufs) out = out.map(st => st
    .replace(/Fais cuire les pâtes à l'autocuiseur.*$/s, pastaSG)
    .replace(/Fais cuire les pâtes dans une grande casserole d'eau bouillante salée.*$/s, pastaSG)
    .replace(/^Fais cuire les nouilles aux œufs.*$/s, pastaSG + ' Rince-les à l\'eau froide.'));
  if (used.semoule && r.id === 'W07') {
    const i = out.findIndex(st => /même volume d'eau que de semoule/.test(st));
    if (i >= 0) {
      const n = /eau bouillante sur la semoule/.test(out[i + 1] || '') ? 2 : 1;
      out.splice(i, n, cooker ? "Verse le tajine dans un plat et rince la cuve." : "Laisse le tajine dans la cocotte, à couvert.", riz);
    }
  }
  if (used.boulghour && r.id === 'W05') out = out.map(st => /boulgour/.test(st) && /tomates/.test(st) ? (cooker
    ? "Rince le riz, puis fais-le revenir 2 minutes dans l'huile à l'autocuiseur en mode dorer. Ajoute les tomates, le concentré et 1,7 fois le poids du riz en eau, ferme et laisse cuire 20 minutes sous pression, puis laisse la pression retomber seule pendant 10 minutes."
    : "Rince le riz, puis fais-le revenir 2 minutes dans l'huile dans une casserole. Ajoute les tomates, le concentré et 2,5 fois le poids du riz en eau, couvre et laisse cuire 35 minutes à feu doux, puis 10 minutes hors du feu.") : st);
  if (used.boulghour && r.id === 'W40') out = out.map(st => /^Fais cuire le boulgour/.test(st) ? riz.replace(/Mets-le en boîtes dès qu'il a tiédi : le riz cuit ne doit pas rester plus d'une heure à température ambiante\./, "Étale-le sur un plat pour qu'il refroidisse vite : le riz cuit ne doit pas rester plus d'une heure à température ambiante.") : st);
  return out;
}
function gretext(t, used) {
  if (used.boulghour) t = t.replace(/boulgour pilavı/g, 'riz pilaf').replace(/taboulé(?! de riz)/g, 'taboulé de riz').replace(/\bboulgour\b/g, 'riz');
  if (used.semoule) t = t.replace(/pour qu'elle ne détrempe pas/g, "pour qu'il ne détrempe pas").replace(/\bla semoule\b/g, 'le riz').replace(/\bsemoule\b/g, 'riz');
  if (used.pates) t = t.replace(/\bles pâtes\b(?! sans gluten)/g, 'les pâtes sans gluten');
  if (used.pain_burger) t = t.replace(/\ble pain\b(?! sans gluten)/g, 'le pain sans gluten');
  if (used.pain || used.baguette) t = t.replace(/\bla baguette\b/g, 'le pain sans gluten').replace(/\bbaguette\b/g, 'pain sans gluten').replace(/\b([Ll]e|du|de) pain\b(?! sans gluten)/g, '$1 pain sans gluten');
  if (used.tortilla || used.pita) t = t
    .replace(/\btortillas\b/g, 'wraps sans gluten').replace(/\btortilla\b/g, 'wrap sans gluten')
    .replace(/\bles pitas\b/g, 'les wraps sans gluten').replace(/\bla pita\b/g, 'le wrap sans gluten').replace(/& pita\b/g, '& wrap sans gluten')
    .replace(/\bles galettes\b/g, 'les wraps sans gluten').replace(/\bla galette\b/g, 'le wrap sans gluten');
  if (used.soja) t = t.replace(/\bsauce soja\b/g, 'sauce tamari');
  if ('oignons_frits' in used) t = t
    .replace(/, et termine par les oignons frits/g, '').replace(/, comme les oignons frits dans leur paquet/g, '')
    .replace(/la sauce et les oignons frits dans deux petits pots/g, 'la sauce dans un petit pot')
    .replace(/, la sauce blanche et les oignons frits/g, ' et la sauce blanche').replace(/ et ajoute les oignons frits/g, '');
  return t;
}

// À appeler après applyEquipment() (qui remet les étapes d'origine)
function applyDiet() {
  const L = householdLactose(), G = householdGluten();
  const lsub = L >= 2 ? SUB2 : L >= 1 ? SUB1 : {};
  const gsub = G >= 2 ? GSUB2 : G >= 1 ? GSUB1 : {};
  RECIPES.forEach(r => {
    if (!r._dietBase) r._dietBase = { ings: r.ingredients.map(i => ({ ...i })), name: r.name, macros: { ...r.macros } };
    if (!r.baseSteps) r.baseSteps = r.steps.slice();
    r.steps = (r._eqSteps || r.baseSteps).slice();
    const b = r._dietBase, has = k => b.ings.some(i => i.key === k);
    r.lacOut = b.ings.some(i => LACTOSE_OUT.includes(i.key));
    r.gluOut1 = b.ings.some(i => GLUTEN_OUT1.includes(i.key));
    r.gluOut2 = r.gluOut1 || b.ings.some(i => GLUTEN_OUT2.includes(i.key));
    const lused = Object.fromEntries(Object.entries(lsub).filter(([k]) => has(k)));
    const gused = Object.fromEntries(Object.entries(gsub).filter(([k]) => has(k)));
    if (G >= 1) GDROP.forEach(k => { if (has(k)) gused[k] = null; });
    if (!Object.keys(lused).length && !Object.keys(gused).length) { r.ingredients = b.ings.map(i => ({ ...i })); r.name = b.name; r.macros = { ...b.macros }; return; }
    const sub = { ...lused, ...gused };
    r.ingredients = b.ings.filter(i => sub[i.key] !== null).map(i => {
      const k = sub[i.key];
      if (!k) return { ...i };
      const m = ingMacros(k, i.qty);
      return { ...i, key: k, name: INGREDIENTS[k]?.name || i.name, kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat };
    });
    const tot = r.ingredients.reduce((a, i) => ({ kcal: a.kcal + (i.kcal || 0), protein: a.protein + (i.protein || 0), carbs: a.carbs + (i.carbs || 0), fat: a.fat + (i.fat || 0) }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
    r.macros = { kcal: Math.round(tot.kcal), protein: Math.round(tot.protein), carbs: Math.round(tot.carbs), fat: Math.round(tot.fat) };
    let steps = Object.keys(gused).length ? glutenSteps(r, r.steps, gused) : r.steps;
    r.name = gretext(retext(b.name, lused), gused);
    r.steps = steps.map(st => gretext(retext(st, lused), gused));
  });
  applyStaples(); // puis riz et pâtes complets ou classiques
}


// ──────────────────────────────────────────────
// js/utils.js
// ──────────────────────────────────────────────

function el(tag, cls = '', html = '') {
  const node = document.createElement(tag);
  if (cls)  node.className = cls;
  if (html) node.innerHTML = html;
  return node;
}

function formatDate(isoDate) {
  return new Date(isoDate + 'T12:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

function formatDateShort(isoDate) {
  return new Date(isoDate + 'T12:00:00').toLocaleDateString('fr-FR', {
    weekday: 'short', day: 'numeric',
  });
}

function mbar(value, target, color, overThreshold = 1.08) {
  const pct = Math.min((value / target) * 100, 100).toFixed(1);
  const over = value > target * overThreshold;
  return `<div class="mbar-wrap"><div class="mbar ${over ? 'over' : ''}" style="width:${pct}%;background:${over ? 'var(--danger)' : color}"></div></div>`;
}

// Anneau de progression calorique (SVG donut). Pièce maîtresse visuelle des écrans Jour & Macros.
// value/target en kcal. Affiche le chiffre au centre + la cible dessous.
function kcalRing(value, target, opts = {}) {
  const size = opts.size || 168;
  const sw = opts.stroke || 13;
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const ratio = Math.max(0, Math.min(value / target, 1));
  const over = value > target * 1.08;
  const dash = (ratio * c).toFixed(1);
  const pct = Math.round((value / target) * 100);
  const stroke = over ? 'var(--danger)' : 'url(#hbRingGrad)';
  const cx = size / 2;
  return `
    <div class="kcal-ring-wrap" style="width:${size}px;height:${size}px">
      <svg class="kcal-ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
        <defs>
          <linearGradient id="hbRingGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#A9C2B2"/>
            <stop offset="100%" stop-color="#6E8B76"/>
          </linearGradient>
        </defs>
        <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="var(--s3)" stroke-width="${sw}"/>
        <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${stroke}" stroke-width="${sw}"
          stroke-linecap="round" stroke-dasharray="${dash} ${c.toFixed(1)}"
          transform="rotate(-90 ${cx} ${cx})" class="kcal-ring-arc"/>
      </svg>
      <div class="kcal-ring-center">
        <div class="kcal-ring-val ${over ? 'over' : ''}">${Math.round(value)}</div>
        <div class="kcal-ring-sub">/ ${target} kcal</div>
        <div class="kcal-ring-pct ${over ? 'over' : ''}">${pct}%</div>
      </div>
    </div>`;
}

// Macros d'une recette × servings, arrondis
// Macros d'un plat : tient compte des overrides (quantités d'ingrédients ajustées en g).
// item = { id, servings, overrides? : { ingIndex: qtyGrams } }
function itemMacros(item) {
  const r = getById(item.id);
  if (!r) return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const ov = item.overrides;
  const s = item.servings || 1;
  if (!ov) {
    // pas d'overrides : simple multiplication par les portions
    return {
      kcal:    r.macros.kcal    * s,
      protein: r.macros.protein * s,
      carbs:   r.macros.carbs   * s,
      fat:     r.macros.fat     * s,
    };
  }
  // overrides présents : on recalcule ingrédient par ingrédient
  return r.ingredients.reduce((acc, ing, idx) => {
    const q = ing.qty || 1;
    const qty = (ov[idx] != null ? ov[idx] : ing.qty * s);
    acc.kcal    += (ing.kcal    / q) * qty;
    acc.protein += (ing.protein / q) * qty;
    acc.carbs   += (ing.carbs   / q) * qty;
    acc.fat     += (ing.fat     / q) * qty;
    return acc;
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });
}

function scaledMacros(recipe, servings = 1) {
  return {
    kcal:    Math.round(recipe.macros.kcal    * servings),
    protein: Math.round(recipe.macros.protein * servings),
    carbs:   Math.round(recipe.macros.carbs   * servings),
    fat:     Math.round(recipe.macros.fat     * servings),
  };
}

// Total d'un jour : meals = { slot: [{id, servings, overrides?}] }
function computeDayMacros(entry) {
  const slots = ['breakfast', 'starter', 'lunch', 'dinner', 'sides', 'sweet'];
  return slots.reduce((acc, slot) => {
    (entry.meals[slot] || []).forEach(item => {
      const m = itemMacros(item);
      acc.kcal += m.kcal; acc.protein += m.protein; acc.carbs += m.carbs; acc.fat += m.fat;
    });
    return acc;
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });
}

function openSheet(html, onClose) {
  const overlay = el('div', 'overlay');
  overlay.innerHTML = `<div class="sheet" id="sheet">${html}</div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeSheet(); });
  if (onClose) overlay._onClose = onClose;
}

function closeSheet() {
  const o = document.querySelector('.overlay');
  if (o) { o._onClose?.(); o.remove(); }
}

// Message bref en bas de l'écran (confirmation d'une action)
// Notification en haut de l'écran : coche sauge pour une confirmation, « ! » terracotta pour une alerte (kind = 'warn')
const TOAST_CHECK = '<span class="toast-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><polyline points="5 12.5 10 17 19 7.5"/></svg></span>';
function toast(msg, kind = 'ok') {
  document.querySelector('.toast')?.remove();
  const t = el('div', `toast ${kind === 'warn' ? 'warn' : ''}`);
  t.setAttribute('role', kind === 'warn' ? 'alert' : 'status');
  t.innerHTML = (kind === 'warn' ? '<span class="toast-ic" aria-hidden="true">!</span>' : TOAST_CHECK) + '<span></span>';
  t.lastChild.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('out'), 2600);
  setTimeout(() => t.remove(), 3000);
}


// ──────────────────────────────────────────────
// js/optimizer.js
// ──────────────────────────────────────────────
// optimizer.js — Ajuste les quantités d'une recette pour viser des macros,
// SANS sortir de portions humaines.
//
// Principes :
//  1. On optimise un REPAS à la fois (pas une journée entière dans un seul plat).
//  2. Seuls certains ingrédients bougent (« leviers ») et chacun reste dans sa fourchette
//     réaliste définie dans data/ingredients.js (ex. riz cru 50-110 g, poulet 110-200 g).
//  3. On reste proche de la recette d'origine (pénalité d'écart) : le plat garde son identité.
//  4. Ce qu'une assiette ne peut pas absorber est donné aux collations — pas au riz.


const MACROS = ['kcal', 'protein', 'carbs', 'fat'];

// Réglages du moteur (modifiables pour tester)
const OPT = {
  priceWeight: 0.15,      // poids du prix dans le calibrage des portions
  plateProteinShare: 1.1, // part des protéines portée par les assiettes (le reste : collation / whey)
  autoSides: true,        // ajouter un accompagnement à l'assiette si ça aide…
  autoSideIds: [], // plus d'accompagnement : les plats sont complets
};

// Compat : classification par nom (utilisée par d'anciens modules)
function classifyIngredient(name) {
  const db = Object.values(INGREDIENTS).find(i => i.name === name);
  if (!db) return 'fixed';
  if (db.role === 'protein') return 'protein';
  if (db.role === 'carb') return 'carb';
  if (db.role === 'legume') return 'both';
  return 'fixed';
}

// Arrondi « cuisine » selon l'ingrédient
function snapQty(q, countable, key) {
  if (countable) return Math.max(0, Math.round(q));
  const db = key ? INGREDIENTS[key] : null;
  if (key && NATURAL_UNITS[key]) { const g = NATURAL_UNITS[key].g; return Math.max(g, Math.round(q / g) * g); } // tranche entière
  if (db) {
    if (key === 'huile' || key === 'huile_sesame') return Math.round(q);
    if (['whey', 'beurre_cacahuete', 'amandes'].includes(key)) return Math.round(q / 5) * 5;
    if (['pdt', 'patate_douce', 'fromage_blanc', 'skyr', 'yaourt_grec'].includes(key)) return Math.round(q / 25) * 25;
    if (db.role === 'protein' || (db.max && db.max > 130)) return Math.round(q / 10) * 10;
    return Math.round(q / 5) * 5;
  }
  if (q >= 200) return Math.round(q / 25) * 25;
  if (q >= 60) return Math.round(q / 10) * 10;
  return Math.round(q / 5) * 5;
}

function perUnit(ing) {
  const q = ing.qty || 1;
  return { kcal: ing.kcal / q, protein: ing.protein / q, carbs: ing.carbs / q, fat: ing.fat / q };
}

// Quantités effectives d'un item planifié
function itemQuantities(item) {
  const r = getById(item.id);
  if (!r) return [];
  const s = item.servings || 1;
  const ov = item.overrides || {};
  return r.ingredients.map((ing, i) => (ov[i] != null ? ov[i] : ing.qty * s));
}

// ── Repères de qualité (Santé publique France) ──
// Charcuterie : 150 g par semaine au plus. Viande rouge : 500 g cuits par semaine au plus (voir weekgen.js).
const CHARC_KEYS = ['jambon_blanc', 'poulet_tranches'];
const CHARC_MAX = 160; // v191 : 4 tranches de 40 g par semaine, soit une barquette entière
const RED_MEAT_KEYS = ['boeuf', 'boeuf_emince'];
// Fruits et oléagineux : les compléments qui en contiennent sont préférés à macros équivalentes
const FRUIT_KEYS = ['banane', 'pomme', 'fruits_rouges', 'fruit_saison', 'mangue', 'dattes'];
const NUT_KEYS = ['amandes', 'beurre_cacahuete', 'cacahuetes', 'pistaches', 'chia', 'sesame', 'tahini'];
const FRUIT_NUT_KEYS = [...FRUIT_KEYS, ...NUT_KEYS];
// score multiplié (plus bas = meilleur) : les oléagineux, plus caloriques, ont besoin d'un coup de pouce plus fort
const FRUIT_BONUS = 0.85, NUT_BONUS = 0.6;
const hasFruitOrNut = r => !!r && r.ingredients.some(i => FRUIT_NUT_KEYS.includes(i.key));
// Calcium d'une recette, en mg pour 100 kcal (table micros.js)
function calciumPer100kcal(r) {
  if (typeof MICROS === 'undefined' || !r?.macros?.kcal) return 0;
  const ca = r.ingredients.reduce((a, i) => { const row = MICROS[i.key]; return row ? a + row[3] * (INGREDIENTS[i.key]?.unit === 'pièce' ? i.qty : i.qty / 100) : a; }, 0);
  return ca / r.macros.kcal * 100;
}
const qualityBonus = r => (r.ingredients.some(i => NUT_KEYS.includes(i.key)) ? NUT_BONUS : r.ingredients.some(i => FRUIT_KEYS.includes(i.key)) ? FRUIT_BONUS : 1);
function charcGrams(item) {
  const r = getById(item.id);
  if (!r || !r.ingredients.some(i => CHARC_KEYS.includes(i.key))) return 0;
  const qs = itemQuantities(item);
  return r.ingredients.reduce((a, ing, i) => a + (CHARC_KEYS.includes(ing.key) ? qs[i] : 0), 0);
}
const charcOfEntry = e => ['breakfast', 'starter', 'lunch', 'dinner', 'sides', 'sweet']
  .reduce((a, s) => a + (e?.meals?.[s] || []).reduce((b, it) => b + charcGrams(it), 0), 0);

function computeMealMacros(item) {
  const r = getById(item.id);
  if (!r) return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const qs = itemQuantities(item);
  return r.ingredients.reduce((acc, ing, i) => {
    const pu = perUnit(ing);
    MACROS.forEach(m => acc[m] += pu[m] * qs[i]);
    return acc;
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });
}

function computeDayFromItems(items) {
  return items.reduce((acc, it) => {
    const m = computeMealMacros(it);
    MACROS.forEach(k => acc[k] += m[k]);
    return acc;
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });
}

// Écart aux cibles. kcal en priorité, protéines : manquer coûte cher, dépasser un peu non.
function score(t, T) {
  const d = m => (t[m] - T[m]) / Math.max(T[m], 1);
  const dK = d('kcal'), dP = d('protein'), dC = d('carbs'), dF = d('fat');
  // Les lipides manquants pèsent autant que les protéines manquantes : sinon le moteur
  // « bouche » les calories avec des glucides et les journées sont trop maigres.
  return 6 * dK * dK + (dP < 0 ? 5 : 0.8) * dP * dP + (dC > 0 ? 1.2 : 0.6) * dC * dC + (dF < 0 ? 4 : 1.5) * dF * dF;
}

// ── Optimise UNE recette pour une cible de repas ──
// mode : 'P' (plat) ou 'S' (collation) → choisit quels ingrédients servent de leviers.
// Renvoie { overrides: {idx: qty}, macros }
// Les minimums « plat » (féculent principal, protéine) sont pensés pour une assiette d'environ
// 1 140 kcal. Pour de plus petits besoins, ils diminuent en proportion (jusqu'à 60 %).
const PLATE_REF_KCAL = 1140;
const portionScale = plateKcal => Math.min(1, Math.max(0.5, plateKcal / PLATE_REF_KCAL));
// Plancher d'une assiette : ses calories quand tous les leviers sont au minimum
const floorCache = {};
function plateFloor(recipe, scale = 1) {
  const k = recipe.id + '@' + scale.toFixed(2);
  if (floorCache[k] == null) floorCache[k] = optimizeRecipe(recipe, { kcal: 0, protein: 0, carbs: 0, fat: 0 }, 'P', scale).macros.kcal;
  return floorCache[k];
}
function scaledMin(key, value, scale) {
  if (scale >= 1) return value;
  const nu = NATURAL_UNITS[key];
  // pains, wraps, pitas : on garde des unités entières (arrondi au-dessus)
  return nu ? Math.max(nu.g, Math.ceil(value * scale / nu.g - 1e-9) * nu.g) : Math.ceil(value * scale / (value >= 200 ? 25 : 10) - 1e-9) * (value >= 200 ? 25 : 10);
}

// Protéine principale d'une recette : l'ingrédient protéique qui apporte le plus de protéines
function mainProteinIdx(recipe) {
  let best = -1, p = 0;
  recipe.ingredients.forEach((ing, idx) => {
    const db = INGREDIENTS[ing.key];
    if (!ing.extra && db && db.role === 'protein' && ing.protein > p) { p = ing.protein; best = idx; }
  });
  return best;
}

// fixed = { index: quantité } : ingrédients imposés (viande calée sur les barquettes achetées)
function optimizeRecipe(recipe, target, mode = 'P', scale = 1, fixed = null) {
  const qty = recipe.ingredients.map(i => i.qty);
  if (fixed) Object.entries(fixed).forEach(([i, q]) => { qty[i] = q; });
  const pu = recipe.ingredients.map(perUnit);
  const levers = [];
  // Protéine principale = l'ingrédient protéique qui apporte le plus de protéines.
  // Dans un plat, seule elle varie (l'œuf d'une panure ou le bœuf d'un mapo tofu restent fixes).
  let mainProt = -1, mainP = 0;
  recipe.ingredients.forEach((ing, idx) => {
    const db = INGREDIENTS[ing.key];
    if (!ing.extra && db && db.role === 'protein' && ing.protein > mainP) { mainP = ing.protein; mainProt = idx; }
  });
  // Féculent principal : c'est lui qui reçoit le minimum « plat » (minP).
  // Riz en priorité, sinon le féculent qui pèse le plus en calories dans la recette.
  let mainStarch = recipe.ingredients.findIndex(i => !i.extra && (i.key === 'riz' || i.key === 'riz_blanc'));
  if (mainStarch < 0) {
    let bestK = 0;
    recipe.ingredients.forEach((ing, idx) => {
      if (!ing.extra && INGREDIENTS[ing.key]?.minP && ing.kcal > bestK) { bestK = ing.kcal; mainStarch = idx; }
    });
  }
  if (!isCantine(recipe)) {
    recipe.ingredients.forEach((ing, idx) => {
      const db = INGREDIENTS[ing.key];
      // mode 'B' (petit-déjeuner) : tous les leviers de l'ingrédient, plat comme collation
      if (ing.extra || !db || !(mode === 'B' ? !!db.lv : db.lv.includes(mode))) return; // tes ajouts gardent leur quantité
      if (fixed && fixed[idx] != null) return;
      if (mode === 'P' && db.role === 'protein' && idx !== mainProt) return;
      const countable = isCountableUnit(ing.unit);
      // minP : minimum imposé dans les plats (ex. jamais moins de 90 g de riz cru)
      const rawMin = mode === 'P' && db.minP && idx === mainStarch ? db.minP : Math.min(db.min ?? ing.qty, ing.qty);
      const min = !countable ? scaledMin(ing.key, rawMin, scale) : rawMin;
      // maxS : plafond propre aux collations (ex. riz au lait : 60 g de riz au plus)
      const max = mode === 'S' && db.maxS ? Math.max(db.maxS, Math.min(ing.qty, db.maxS)) : Math.max(db.max ?? ing.qty, ing.qty, min);
      const span = max - min;
      const step = countable ? 1 : Math.max(1, Math.round(span / 40));
      levers.push({ idx, key: ing.key, base: ing.qty, min, max, step, countable });
    });
  }
  // on part toujours d'une quantité dans les bornes (ex. riz remonté à 90 g s'il était en dessous)
  levers.forEach(l => { qty[l.idx] = Math.min(l.max, Math.max(l.min, qty[l.idx])); });
  const totals = () => {
    const t = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    qty.forEach((q, i) => MACROS.forEach(m => t[m] += pu[i][m] * q));
    return t;
  };
  // Pénalité d'écart à la recette d'origine : le plat garde son équilibre
  // (écart normalisé par la fourchette autorisée : une viande à 120-350 g a plus de marge qu'une huile à 4-12 g)
  const LAMBDA = 0.15;
  const drift = () => levers.reduce((a, l) => {
    const rel = (qty[l.idx] - l.base) / Math.max(l.max - l.min, l.countable ? 1 : 20);
    return a + rel * rel;
  }, 0);
  // Sensibilité au prix : à calories égales, l'optimiseur préfère l'ingrédient le moins cher
  // (ex. un peu plus de riz plutôt que 50 g de bœuf en plus). OPT.priceWeight = 0 pour désactiver.
  const euros = () => recipe.ingredients.reduce((a, ing, i) => a + ingCost(ing.key, qty[i]), 0);
  const cost = () => score(totals(), target) + LAMBDA * drift() + OPT.priceWeight * euros() / 3;

  let best = cost();
  for (let pass = 0; pass < 25 && levers.length; pass++) {
    let improved = false;
    for (const l of levers) {
      const start = qty[l.idx];
      let bestV = start;
      for (let v = l.min; v <= l.max + 1e-9; v += l.step) {
        qty[l.idx] = v;
        const c = cost();
        if (c < best - 1e-9) { best = c; bestV = v; improved = true; }
      }
      qty[l.idx] = bestV;
    }
    if (!improved) break;
  }
  const overrides = {};
  recipe.ingredients.forEach((ing, i) => {
    const isLever = levers.some(l => l.idx === i);
    overrides[i] = fixed && fixed[i] != null ? fixed[i] : isLever ? snapQty(qty[i], isCountableUnit(ing.unit), ing.key) : ing.qty;
  });
  // macros finales (après arrondi)
  const macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  recipe.ingredients.forEach((ing, i) => MACROS.forEach(m => macros[m] += pu[i][m] * overrides[i]));
  return { overrides, macros, score: score(macros, target) };
}

// ── Répartition d'une journée ──
// Une assiette vise ~34 % des kcal du jour, mais jamais plus que ce qu'on peut raisonnablement
// manger (800 kcal, 900 si objectif > 3000). Le reste part en collation(s).
// share : part des calories du jour portée par chaque plat (jeûne 40 %, classique 32 %)
const PLATE_SHARE = { jeune: 0.40, classique: 0.32 };
const BREAKFAST_SHARE = 0.20;
// boost : part de protéines en plus dans les plats, pour qui n'a plus de compléments protéinés (régime)
function plateTarget(T, share = 0.40, boost = 1) {
  // Les plats portent l'essentiel de la journée : grosses portions de féculents,
  // donc moins de collations à côté.
  const cap = T.kcal > 3000 ? 1350 : 1250;
  const kcal = Math.max(400, Math.min(cap, T.kcal * share));
  const f = kcal / T.kcal;
  return {
    kcal: Math.round(kcal),
    protein: Math.round(T.protein * Math.min(f * OPT.plateProteinShare * boost, 0.45 * boost)),
    carbs: Math.round(T.carbs * f),
    // les à-côtés (tartines au carré frais 0 %, collations whey) sont maigres : les plats portent un peu plus de lipides
    fat: Math.round(T.fat * Math.min(f * 1.2, 0.5)),
  };
}

// Cible du petit-déjeuner (formule classique) : 20 % des calories, une part un peu plus grande des protéines
function breakfastTarget(T) {
  const f = BREAKFAST_SHARE;
  return { kcal: Math.round(T.kcal * f), protein: Math.round(T.protein * 0.24), carbs: Math.round(T.carbs * f), fat: Math.round(T.fat * f) };
}

// Calibre une ASSIETTE : le plat seul, ou le plat + un de ses accompagnements air fryer.
// On garde l'option la plus proche de la cible ; l'accompagnement n'est ajouté que s'il aide.
// Renvoie { main: {overrides, macros}, side: {id, overrides, macros} | null, macros }
function calibratePlate(recipe, target) {
  const scale = portionScale(target.kcal);
  const alone = optimizeRecipe(recipe, target, 'P', scale);
  let best = { main: alone, side: null, macros: alone.macros, score: alone.score };
  if (!OPT.autoSides) return best;
  // jamais d'accompagnement qui répète un féculent déjà dans le plat (burger + ses frites de patate douce, etc.)
  const mainCarbs = new Set(recipe.ingredients.filter(i => ['carb', 'legume'].includes(INGREDIENTS[i.key]?.role)).map(i => i.key));
  (recipe.pairs || []).filter(sid => OPT.autoSideIds.includes(sid)).forEach(sid => {
    const side = getById(sid);
    if (!side || side.unavailable) return; // accompagnement impossible avec l'équipement du foyer
    if (side.ingredients.some(i => mainCarbs.has(i.key))) return;
    const sm = side.macros;
    const rest = {};
    MACROS.forEach(m => rest[m] = Math.max(0, target[m] - sm[m]));
    const main = optimizeRecipe(recipe, rest, 'P', scale);
    const tot = {};
    MACROS.forEach(m => tot[m] = main.macros[m] + sm[m]);
    const sc = score(tot, target) + 0.02; // légère préférence pour l'assiette simple
    if (sc < best.score) {
      const overrides = {};
      side.ingredients.forEach((ing, i) => overrides[i] = ing.qty);
      best = { main, side: { id: sid, overrides, macros: sm }, macros: tot, score: sc };
    }
  });
  return best;
}

function subtractMacros(T, used) {
  const out = {};
  MACROS.forEach(m => out[m] = Math.max(0, T[m] - used[m]));
  return out;
}

// Remplit le « reste » d'une journée, dans cet ordre (on s'arrête dès que c'est bouclé) :
//   1. la collation du jour : la mieux adaptée parmi les 2 proposées par la rotation (≤ ~650 kcal)
//   2-4. jusqu'à trois compléments sans préparation : d'abord les tartines carré frais
//        (miel-thym, blanc de poulet), puis banane-cacahuète, amandes, fromage blanc, fruit, skyr
//   4. une 2e collation seulement si l'écart reste vraiment important Renvoie [{ slot, item }]
// Produits laitiers « en bol » : un seul par jour (pas deux fromages blancs le même jour)
const DAIRY_BASES = ['fromage_blanc', 'yaourt_grec', 'yaourt_sl'];
// Variété (v187) : les tartines ont un vrai plafond par semaine ; pour le reste, chaque jour déjà servi
// rend la collation ou le complément moins attractif (sans l'interdire si la journée en a besoin)
const WEEK_CAPS = { S12: 3, S11: 3 };
const weekCap = id => WEEK_CAPS[id] ?? Infinity;
const VARIETY_PENALTY = 0.6; // score × (1 + 0,6 × jours déjà servis)
function fillRemainder(remaining, rotation, fillers = ['S12', 'S11', 'S09', 'S07', 'S08', 'S05', 'S16'], scale = 1, dayKeys = new Set(), charcLeft = Infinity, weekUse = {}) {
  const out = [];
  let rem = { ...remaining };
  const used = new Set();
  const usedBases = new Set(DAIRY_BASES.filter(k => dayKeys.has(k)));
  const basesOf = r => r.ingredients.map(i => i.key).filter(k => DAIRY_BASES.includes(k));
  const plan = [
    // v187 : la collation passe en premier, choisie parmi 2 options qui changent chaque jour
    // (seulement s'il reste au moins 200 kcal : sinon un petit complément convient mieux aux petits gabarits)
    { pool: rotation.slice(0, 2), cap: 650, minRem: 200 },
    // puis le meilleur complément (tartines, fruit, amandes, fromage blanc-cacahuète…), chacun plafonné sur la semaine
    { pool: fillers,              cap: 350, minRem: 120 },
    // si la journée manque de lipides, les compléments gras (amandes, beurre de cacahuète) entrent en lice
    { pool: fillers.filter(id => ['S07', 'S08'].includes(id)), cap: 300, minRem: 120, fatty: true },
    // 2e collation seulement si l'écart reste vraiment important
    { pool: rotation.slice(2, 3), cap: 650, minRem: 120 },
    // petits besoins : un fruit pour combler un petit écart
    { pool: fillers.filter(id => ['S05', 'S16'].includes(id)), cap: 200, minRem: 70, small: true },
    // rattrapage : s'il manque encore beaucoup, n'importe quelle collation ou complément encore permis ce jour-là
    { pool: [...rotation, ...fillers], cap: 400, minRem: 100 },
    // 2e passe de rattrapage : les très gros profils (3 000 kcal et plus) ont besoin de plus de compléments
    { pool: [...rotation, ...fillers], cap: 400, minRem: 150 },
  ];
  for (const stepCfg of plan) {
    // v195 : un jour réservé à une collation préparée, elle passe dès 100 kcal d'écart (sinon la portion préparée serait perdue)
    const batchDay = stepCfg === plan[0] && getById(rotation[0])?.batch;
    // v199 : les jours sans préparée, une vraie collation rapide passe dès 140 kcal d'écart (avant 200 : on n'avait
    // presque que fruit, amandes et tartine) ; les compléments viennent ensuite si besoin
    const quickDay = stepCfg === plan[0] && !batchDay && getById(rotation[0])?.category === 'sweet';
    if (rem.kcal < (batchDay ? 100 : quickDay ? 140 : stepCfg.minRem)) continue;
    const share = Math.min(1, stepCfg.cap / rem.kcal);
    const tgt = {};
    MACROS.forEach(m => tgt[m] = rem[m] * share);
    let best = null;
    let pool = stepCfg.pool;
    if (stepCfg.fatty && rem.fat * 9 > rem.kcal * 0.3) pool = [...new Set([...pool, ...fillers.filter(id => ['S07', 'S09', 'S08'].includes(id))])];
    pool.filter(id => !used.has(id) && (weekUse[id] || 0) < weekCap(id)).forEach(id => { // plafond de la semaine
      const r = getById(id);
      if (!r) return;
      // v199 : pas deux fois le même laitage dans la journée (fromage blanc puis fromage blanc), mais un yaourt après un porridge
      // au fromage blanc, oui : sinon les collations rapides (presque toutes à base de laitage) ne passaient presque jamais
      if (!r.batch && basesOf(r).some(k => usedBases.has(k))) return;
      const res = optimizeRecipe(r, tgt, 'S', scale);
      // charcuterie : jamais au-delà de ce qu'il reste du plafond de la semaine
      const charc = charcGrams({ id, servings: 1, overrides: res.overrides });
      if (charc > charcLeft) return;
      // pas de pénalité de variété pour une collation préparée le dimanche : elle est faite pour plusieurs jours
      const score = res.score * qualityBonus(r) * (r.batch ? 1 : 1 + VARIETY_PENALTY * (weekUse[id] || 0));
      if (!best || score < best.score) best = { id, r, res, score, charc };
    });
    if (!best) continue;
    // au-delà de la tartine obligatoire, on n'ajoute rien qui creuserait l'écart au lieu de le réduire
    if (stepCfg !== plan[0] && best.res.macros.kcal > rem.kcal * 1.8) continue;
    if (stepCfg.small && scale >= 1) continue;
    used.add(best.id);
    charcLeft -= best.charc;
    basesOf(best.r).forEach(k => usedBases.add(k));
    const slot = best.r.category === 'side' ? 'sides' : 'sweet';
    out.push({ slot, item: { id: best.id, servings: 1, overrides: best.res.overrides } });
    rem = subtractMacros(rem, best.res.macros);
  }
  return out;
}

// ── Optimise une journée existante (bouton « Optimiser les portions » du planner) ──
// Assiettes du midi/soir ajustées individuellement, puis collations recalées sur le reste.
function optimizeEntry(entry, T) {
  const pt = plateTarget(T);
  let used = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const add = m => MACROS.forEach(k => used[k] += m[k]);
  (entry.meals.starter || []).forEach(it => add(computeMealMacros(it)));
  (entry.meals.sides || []).forEach(it => add(computeMealMacros(it)));
  ['lunch', 'dinner'].forEach(slot => {
    (entry.meals[slot] || []).forEach(it => {
      const r = getById(it.id);
      if (!r) return;
      if (!isCantine(r)) {
        // on retire de la cible l'accompagnement déjà associé à ce repas
        const linked = (entry.meals.sides || []).filter(sd => sd.with === slot).map(computeMealMacros);
        const tgt = { ...pt };
        linked.forEach(m => MACROS.forEach(k => tgt[k] = Math.max(0, tgt[k] - m[k])));
        const res = optimizeRecipe(r, tgt, 'P');
        it.overrides = res.overrides; it.servings = 1;
      }
      add(computeMealMacros(it));
    });
  });
  // collations : réparties sur ce qu'il reste
  const sweets = entry.meals.sweet || [];
  let rem = subtractMacros(T, used);
  sweets.forEach((it, i) => {
    const r = getById(it.id);
    if (!r) return;
    const left = sweets.length - i;
    const tgt = {};
    MACROS.forEach(m => tgt[m] = rem[m] / left);
    const res = optimizeRecipe(r, tgt, 'S');
    it.overrides = res.overrides; it.servings = 1;
    rem = subtractMacros(rem, res.macros);
  });
  return entry;
}


// ──────────────────────────────────────────────
// js/micros.js
// ──────────────────────────────────────────────
// micros.js — Fibres, sel, vitamines et minéraux, calculés par le moteur (non affichés pour l'instant).
//
// Source : table Ciqual 2020 de l'ANSES (https://ciqual.anses.fr), aliment le plus proche de chaque ingrédient,
// à l'état où il est pesé dans l'app (cru en général, égoutté pour les conserves).
// Valeurs pour 100 g ou 100 ml, et pour UNE pièce quand l'unité est la pièce (œuf 54 g, gousse d'ail 4 g, cube de bouillon 10 g).
// « < x » dans Ciqual est compté x / 2, « traces » 0, une valeur absente 0.
// Approximations : whey (absente de Ciqual, moyenne d'étiquettes), haricots noirs (haricots rouges), fromage frais et carré frais
// (petit-suisse 10 %), cottage (fromage blanc 3 %), houmous (pois chiches + tahin), sauces piquantes (ketchup).
// Les pertes à la cuisson (vitamine C surtout) ne sont pas déduites.
//
// Ordre des valeurs (MICRO_KEYS) :
//   fib g · sel g · ags g (acides gras saturés) · ca mg · fe mg · mg mg · k mg · zn mg ·
//   vitA µg (rétinol + bêta-carotène / 6) · vitD µg · vitC mg · b9 µg · b12 µg · o3 g (ALA + EPA + DHA)


const MICRO_KEYS = ['fib', 'sel', 'ags', 'ca', 'fe', 'mg', 'k', 'zn', 'vitA', 'vitD', 'vitC', 'b9', 'b12', 'o3'];

const MICROS = {
  poulet: [0.0,0.11,0.44,3.3,0.33,32.0,390.0,0.52,10.5,0.125,4.89,14.6,0.17,0.03],
  poulet_hache: [0.0,0.11,0.44,3.3,0.33,32.0,390.0,0.52,10.5,0.125,4.89,14.6,0.17,0.03],
  poulet_tranches: [0.53,1.86,0.54,6.3,0.34,29.0,380.0,0.58,10.5,0.25,17.9,5.64,0.29,0.038],
  boeuf: [0.0,0.097,1.64,7.0,2.65,22.0,353.0,4.54,4.0,0.25,0.0,6.0,2.12,0.024],
  saumon: [0.125,0.16,2.15,5.84,0.48,27.4,358.0,0.36,4.27,3.69,1.8,20.8,3.95,1.82],
  poisson_blanc: [0.085,0.48,0.015,12.8,0.4,36.9,296.0,0.41,4.0,1.1,0.0,3.0,2.3,0.024],
  crevettes: [0.0,1.35,0.31,240.0,1.98,61.0,254.0,1.69,1.0,0.25,0.83,14.6,1.64,0.34],
  thon: [0.0,0.74,0.086,6.26,0.76,24.0,207.0,0.45,6.5,5.08,0.0,16.3,2.53,0.11],
  oeuf: [0.0,0.167,1.43,41.5,1.02,5.94,72.4,0.545,98.3,1.02,0.0,18.4,0.783,0.082],
  tofu: [0.25,0.025,1.35,100.0,2.4,100.0,140.0,1.3,0.417,0.125,0.25,25.1,0.0,0.56],
  riz: [5.0,0.01,0.61,11.1,0.5,118.0,219.0,2.0,4.17,0.0,0.0,48.0,0.0,0.026],
  pates: [6.1,0.016,0.38,32.1,3.2,82.2,378.0,1.9,0.0,0.0,0.0,22.4,0.0,0.062],
  riz_blanc: [1.05,0.006,0.2,33.0,1.57,31.3,121.0,1.41,0,0,0,19.3,0,0.014],
  pates_classiques: [3.0,0.031,0.37,20.5,1.5,57.5,219.0,1.31,0,0,0,23.7,0,0.038],
  nouilles_riz: [1.2,0.03,0.3,14.2,0.5,13.0,20.3,1.3,4.17,0,0,10.0,0,0],
  boulghour: [9.57,0.043,0.27,34.3,2.46,140.0,410.0,2.37,0.833,0.0,0.0,24.0,0.0,0.05],
  quinoa: [7.0,0.013,0.71,47.0,4.57,197.0,563.0,3.1,1.33,0.0,0,184.0,0.0,0.177],
  semoule: [4.33,0.013,0.28,24.0,1.08,44.0,166.0,0.83,0.0,0.0,0.0,20.0,0.0,0.037],
  pdt: [1.8,0.016,0.038,14.3,0.91,22.0,418.0,0.35,0.167,0.0,18.9,26.0,0.0,0.054],
  patate_douce: [2.87,0.098,0.064,37.5,0.76,20.0,373.0,0.25,1418.3,0.0,2.4,11.0,0.0,0.004],
  pain: [6.9,1.12,0.52,39.0,2.1,51.0,240.0,1.4,0.417,0.86,0.25,35.6,0.0,0.07],
  pita: [2.68,1.38,0.17,52.7,1.0,18.1,134.0,0.5,4.17,0,0,21.0,0,0],
  tortilla: [3.85,1.25,3.85,45.0,0.76,19.0,150.0,0.57,10.9,0,0,39.4,0,0.21],
  farine: [3.2,0.065,0.19,23.0,1.0,27.0,180.0,0.81,0.167,0.125,0.25,15.4,0.0,0.05],
  flocons: [10.2,0.014,1.13,84.3,4.05,148.0,377.0,3.33,0.0,0.0,0.0,39.6,0.0,0.096],
  chapelure: [4.5,1.82,0.94,72.8,1.8,55.5,270.0,1.5,4.17,0.0,0,22.0,0.0,0.03],
  lentilles_corail: [15.4,0.065,0.14,29.0,6.3,74.0,750.0,3.9,4.98,0.125,0.25,124.0,0.0,0.1],
  lentilles_vertes: [16.4,0.065,0.24,64.0,6.3,97.0,940.0,3.4,6.12,0.125,1.63,117.0,0,0.22],
  pois_chiches: [5.45,0.54,0.3,41.2,1.15,27.5,135.0,0.93,1.92,0.0,0.1,36.5,0.0,0.032],
  haricots_rouges: [7.0,0.68,0.41,58.0,1.5,29.0,250.0,0.74,0.0,0.0,0.2,23.0,0.0,0.23],
  haricots_blancs: [7.0,0.69,0.11,73.0,2.99,51.0,454.0,1.12,0.0,0.0,0.0,65.0,0.0,0],
  brocoli: [2.77,0.05,0.097,48.5,0.77,17.0,231.0,0.41,112.5,0.0,62.3,80.5,0.0,0.004],
  courgette: [1.05,0.023,0.061,18.7,0.36,17.5,262.0,0.31,20.0,0.0,17.5,36.0,0.0,0.055],
  poivron: [1.5,0.021,0.071,7.7,0.4,11.9,155.0,0.13,140.0,0.25,121.0,40.7,0,0.026],
  oignon: [1.7,0.098,0.2,25.0,0.0,9.0,190.0,0.23,4.17,0.0,3.9,29.6,0.0,0.003],
  ail: [0.232,0.001,0.0,0.44,0.025,0.8,21.2,0.03,0.017,0.005,0.01,1.04,0.0,0.001],
  haricots_verts: [3.68,0.013,0.049,51.5,0.85,22.0,186.0,0.31,48.7,0.0,18.0,39.5,0.0,0.042],
  epinards: [2.7,0.098,0.075,159.0,2.28,50.5,398.0,0.49,1173.3,0.0,21.4,183.0,0.0,0.16],
  carotte: [2.7,0.11,0.005,25.0,0.24,10.0,230.0,0.18,1381.7,0.0,2.05,59.4,0.0,0.015],
  concombre: [0.6,0.012,0.035,19.2,0.13,13.6,157.0,0.095,7.5,0.0,8.25,12.3,0.0,0.018],
  tomates_cerise: [1.2,0.006,0.005,6.6,0.37,11.0,330.0,0.18,226.7,0.0,21.8,17.6,0.0,0.015],
  tomates_conc: [1.8,0.068,0.005,20.0,0.39,11.0,260.0,0.09,330.0,0.125,10.5,30.2,0.0,0.015],
  salade: [1.2,0.021,0.021,64.6,0.98,14.9,200.0,0.2,606.7,0.0,11.8,43.5,0.0,0.056],
  champignons: [1.0,0.098,0.067,6.03,0.31,10.5,364.0,0.5,0.0,0.3,3.09,34.5,0.0,0.0],
  chou_fleur: [1.82,0.047,0.1,21.7,0.51,12.0,193.0,0.17,1.17,0.0,51.9,64.0,0.0,0.099],
  petits_pois: [6.45,0.09,0.11,27.3,1.53,25.9,158.0,0.86,205.0,0.0,20.8,87.0,0.0,0.047],
  mais: [3.1,0.59,0.26,3.51,0.35,26.9,224.0,0.39,3.67,0.0,3.55,75.0,0.0,0.017],
  legumes_mix: [3.6,1.25,0.4,24.5,6.0,0,0,0,0,0,30.8,0,0,0.04],
  avocat: [3.6,0.015,4.51,9.4,0.34,21.0,430.0,0.43,0.417,0.0,0.25,70.4,0.0,0.16],
  herbes: [4.3,0.59,0.1,218.0,4.67,39.5,598.0,0.77,842.7,0.0,177.0,134.0,0.0,0.16],
  citron: [0.4,0.053,0.038,11.0,0.13,8.0,102.0,0.06,0.333,0.0,24.8,10.0,0.0,0.0],
  banane: [2.7,0.006,0.005,5.1,0.2,28.0,320.0,0.14,4.75,0.0,7.16,19.0,0.0,0.015],
  pomme: [1.4,0.004,0.052,5.34,0.099,6.47,119.0,0.031,3.57,0.0,6.25,6.0,0.0,0.007],
  fruits_rouges: [5.3,0.008,0.0,40.0,1.0,16.9,225.0,0.22,8.25,0.0,87.0,37.6,0.0,0],
  fruit_saison: [2.17,0.005,0.032,25.2,0.208,9.75,142.8,0.119,7.7,0.0,26.9,17.8,0.0,0.013],
  dattes: [7.3,0.098,0.075,44.9,0.9,47.3,696.0,0.23,14.8,0.0,3.0,18.0,0.0,0.003],
  fromage_blanc: [0.0,0.11,0.027,134.0,0.16,12.2,144.0,0.49,4.5,0.1,0.0,24.0,0.4,0],
  yaourt_grec: [0.0,0.088,6.51,110.0,0.025,9.4,150.0,0.35,91.2,0.125,0.25,2.5,0.21,0.06],
  cottage: [0.0,0.11,2.12,130.0,0.13,10.2,132.0,0.52,32.3,1.5,0.25,26.0,0.4,0.024],
  fromage_frais: [1.5,0.058,6.99,110.0,0.2,9.4,130.0,0.43,75.3,0,0.25,20.2,0.57,0.04],
  parmesan: [0.0,1.57,20.6,980.0,0.1,40.0,110.0,3.9,338.4,0.125,0.25,16.0,2.64,0.185],
  emmental: [0.0,0.75,18.1,979.0,1.5,38.3,97.4,4.4,193.0,0.25,0.25,33.4,2.02,0.16],
  feta: [0.0,2.27,16.8,220.0,0.08,12.0,66.0,1.2,215.0,0.125,0,18.9,0.53,0.175],
  lait: [0.0,0.078,1.06,119.0,0.031,11.1,153.0,0.41,14.6,0.085,1.3,11.5,0.49,0.015],
  lait_coco: [0.57,0.075,16.5,18.0,3.3,46.0,220.0,0.56,0.0,0.0,1.0,14.0,0.0,0.02],
  creme: [1.5,0.07,20.8,76.9,0.08,7.92,101.0,0.24,207.2,0.1,0.25,23.5,0.12,0.12],
  whey: [0,0.4,2.5,450,1,70,500,2,0,0,0,0,1.0,0],
  huile: [0.0,0.006,15.2,0.1,0.025,0.025,0.15,0.025,35.0,0.125,0.0,0.0,0.0,0.66],
  huile_sesame: [0.0,0.0,14.9,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.38],
  beurre_cacahuete: [5.0,0.97,10.4,43.0,1.92,174.0,629.0,2.76,0.0,0.0,0.0,70.0,0.0,0.027],
  amandes: [12.5,0.006,4.11,260.0,3.4,270.0,800.0,3.5,1.22,0.125,0.25,120.0,0.0,0.015],
  houmous: [6.22,0.365,3.89,162.6,3.92,61.2,286.0,2.77,4.29,0.0,2.15,67.2,0.0,0.016],
  pesto: [2.5,2.64,4.39,150.0,0.59,36.0,200.0,0.66,151.5,0.125,92.6,25.8,0,0.07],
  sesame: [14.9,0.05,7.09,962.0,14.6,324.0,468.0,5.74,0.833,0.0,0.0,97.0,0.0,0.26],
  chocolat: [12.8,0.02,28.7,62.0,11.0,200.0,750.0,3.0,10.9,2.16,0.25,52.0,0.35,0.135],
  granola: [8.68,0.34,6.61,340.0,6.07,102.0,390.0,1.8,12.2,0.125,66.7,167.0,2.08,0.07],
  chia: [34.4,0.04,3.33,631.0,7.72,335.0,407.0,4.58,0,0,1.6,49.0,0.0,17.8],
  cacao: [29.5,0.11,12.4,140.0,48.5,500.0,3900.0,6.4,0.417,2.73,0.25,107.0,0.0,0.05],
  soja: [0.86,18.6,0.009,27.3,1.72,83.7,547.0,0.4,0.0,0.0,0.0,16.0,0.0,0.002],
  miel: [0.0,0.01,0.0,7.93,0.18,4.26,70.3,0.098,0.0,0.0,0.8,2.0,0.0,0.0],
  agave: [0.0,0.018,0.25,0,0,0,0,0,0,0,0,0,0,0.01],
  pate_curry: [53.2,0.13,1.65,525.0,19.1,255.0,1170.0,4.7,1.83,0.0,0.7,56.0,0.0,0.26],
  moutarde: [0.5,6.3,0.76,86.3,1.83,48.3,150.0,0.67,8.5,0.0,0.3,7.5,0.0,0.915],
  concentre: [4.2,0.27,0.093,45.6,1.2,63.3,1010.0,0.05,130.7,0.0,2.6,58.0,0.0,0.018],
  bouillon: [0.058,4.96,0.675,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.002],
  epices: [34.9,0.17,2.14,229.0,21.1,178.0,2280.0,4.33,0.0,0.0,0.9,49.0,0.0,0.45],
  levure: [1.9,0,0.05,8960.0,11.1,21.0,30.8,0.015,0.0,0.0,0.0,0.0,0.0,0.0],
  haut_cuisse: [0.0,0.23,1.03,10.3,0.99,22.3,229.0,1.8,16.7,0.0,3.1,7.67,0.42,0.061],
  boeuf_emince: [0.0,0.17,4.02,7.38,2.29,22.5,342.0,5.46,8.67,0.55,0.0,5.0,1.84,0.1],
  aubergine: [2.7,0.006,0.034,8.7,0.32,12.0,235.0,0.16,2.33,0.0,2.1,24.5,0.0,0.009],
  tomate: [1.2,0.008,0.056,8.14,0.12,10.1,256.0,0.087,74.8,0.0,15.5,22.7,0.0,0.009],
  pousses_soja: [1.7,0.043,0.0,16.0,0.44,16.0,120.0,0.32,0.833,0.25,4.13,61.3,0.0,0.0],
  citron_vert: [0.45,0.026,0.026,12.0,0.23,7.0,75.0,0.06,1.67,0.0,6.4,8.0,0.0,0.0],
  gingembre: [2.7,0.016,0.09,11.0,0.4,26.0,320.0,0.24,7.17,0.125,0.25,11.8,0.0,0.015],
  haricots_noirs: [7.0,0.68,0.41,58.0,1.5,29.0,250.0,0.74,0.0,0.0,0.2,23.0,0.0,0.23],
  baguette: [2.7,1.3,0.45,22.0,1.2,23.0,180.0,0.73,0.0,0.125,0.25,26.8,0,0.05],
  pain_burger: [3.3,1.14,0.88,89.0,0.85,27.0,140.0,0.84,0.833,0,0.25,13.5,0.036,0.172],
  cheddar: [0.0,1.61,19.5,675.0,0.16,27.0,76.0,3.43,270.2,0.6,0.0,26.0,0.88,0.19],
  olives: [3.6,3.15,2.33,58.0,0.16,24.0,31.0,0.07,4.42,0.125,0.25,2.5,0.0,0.19],
  cacahuetes: [8.67,0.018,7.93,58.0,1.58,178.0,634.0,2.77,0.0,0.0,0.0,97.0,0.0,0.025],
  nuoc_mam: [0.2,22.2,0.0,0,0,0,0,0,0,0,0,0,0,0],
  mirin: [0.0,0.033,0.0,9.0,0.37,12.3,54.8,0.015,0.0,0.0,0.5,0.0,0.0,0.0],
  fecule: [0.8,0.019,0.009,6.0,0.38,3.5,4.0,0.28,0.0,0.0,0.0,1.0,0.0,0.0],
  citron_confit: [0.25,0.006,0.005,11.0,0.15,7.9,140.0,0.33,0.417,0.0,45.0,28.4,0.0,0.015],
  cornichons: [1.5,1.72,0.005,65.0,0.25,23.0,120.0,0.13,61.5,0.0,0.25,11.5,0.0,0.015],
  vinaigre_riz: [0.0,0.033,0.0,9.0,0.37,12.3,54.8,0.015,0.0,0.0,0.5,0.0,0.0,0.0],
  mangue: [1.6,0.006,0.005,12.0,0.09,11.0,150.0,0.11,144.0,0.0,25.0,70.2,0.0,0.015],
  pistaches: [10.1,0.015,5.52,108.0,4.1,115.0,1020.0,2.3,26.0,0.0,3.33,50.8,0.0,0.26],
  tahini: [7.0,0.19,7.48,284.0,6.69,95.0,437.0,4.62,6.67,0.0,4.2,98.0,0.0,0.0],
  carre_frais: [1.5,0.058,6.99,110.0,0.2,9.4,130.0,0.43,75.3,0,0.25,20.2,0.57,0.04],
  saumon_fume: [0.125,3.51,2.06,5.97,0.16,38.3,551.0,0.24,15.7,5.45,0.0,26.0,3.35,1.67],
  radis: [1.4,0.04,0.005,15.0,0.4,6.2,250.0,0.08,0.417,0.0,12.2,95.4,0.0,0.015],
  feuille_riz: [1.05,0.006,0.2,33.0,1.57,31.3,121.0,1.41,0.0,0.0,0.0,19.3,0.0,0.014],
  chou_chinois: [1.05,0.13,0.031,86.4,0.68,17.5,249.0,0.17,446.7,0.0,40.3,73.6,0.0,0.053],
  tomates_sechees: [4.2,0.27,0.093,45.6,1.2,63.3,1010.0,0.05,130.7,0.0,2.6,58.0,0.0,0.018],
  ketchup: [1.15,2.59,0.069,21.4,0.77,21.2,485.0,0.12,93.3,0.0,9.52,7.5,0.0,0.006],
  vinaigre_cidre: [0.0,0.013,0.0,7.0,0.2,5.0,73.0,0.04,0.0,0.0,0.0,0.0,0.0,0.0],
  nouilles_oeufs: [3.15,0.085,1.34,35.0,1.9,58.0,244.0,1.92,17.3,0.3,0.0,29.0,0.29,0.058],
  boudoirs: [1.37,0.41,0.99,25.5,1.1,14.3,109.0,0.5,12.0,0.1,0,9.6,0.36,0.059],
  coco_rapee: [14.0,0.064,57.7,18.4,3.46,90.0,647.0,1.26,0,0,1.5,16.5,0,0.004],
  cornflakes: [3.36,2.15,0.3,0,0,0,0,0,0,0,0,0,0,0],
  oignons_frits: [4.19,1.42,9.98,94.5,1.17,64.5,228.0,1.18,0.167,0.0,0.0,27.5,0.36,0.025],
  mayo_allegee: [0.23,2.37,3.52,47.4,0.4,17.7,70.0,0.12,62.3,0.25,3.75,21.2,0.14,3.17],
  gnocchis: [2.0,1.01,0.26,5.1,0.7,18.8,184.0,0.5,1.0,0.25,0,27.1,0.15,0.024],
  jambon_blanc: [0.05,1.87,1.36,14.0,1.5,0,440.0,6.5,0.0,0,0,0.0,0,0],
  sauce_chili: [1.15,2.59,0.069,21.4,0.77,21.2,485.0,0.12,93.3,0.0,9.52,7.5,0.0,0.006],
  sriracha: [1.15,2.59,0.069,21.4,0.77,21.2,485.0,0.12,93.3,0.0,9.52,7.5,0.0,0.006],
  yaourt_sl: [1.5,0.11,1.0,128.0,0.25,12.5,176.0,0.39,12.0,0.8,0.25,25.0,0.33,0.015],
  boisson_avoine: [0.25,0.066,0.2,1.0,0.02,2.3,32.0,0.025,0.417,0.125,0.25,6.39,0,0.015],
  creme_coco: [0.57,0.075,16.5,18.0,3.3,46.0,220.0,0.56,0.0,0.0,1.0,14.0,0.0,0.02],
  pates_sg: [1.22,0.008,0.24,0,0,0,0,0,0,0,0,0,0,0.015],
  pain_sg: [6.5,1.56,1.24,60.0,0.5,16.0,75.0,0.36,1.27,0,38.6,10.7,0.059,0.015],
  wrap_sg: [2.8,1.08,0.78,23.0,0.81,20.0,120.0,0.63,2.12,0,0.25,24.5,0,0.23],
  tamari: [0.86,18.6,0.009,27.3,1.72,83.7,547.0,0.4,0.0,0.0,0.0,16.0,0.0,0.002],
};

// Repères journaliers pour un adulte (ANSES, références nutritionnelles 2016-2021).
// sel et ags sont des PLAFONDS (ags : 12 % des calories), les autres des apports à atteindre.
const MICRO_REFS = {
  male:   { fib: 30, sel: 6, ca: 950, fe: 11, mg: 420, k: 3500, zn: 11, vitA: 750, vitD: 15, vitC: 110, b9: 330, b12: 4 },
  female: { fib: 30, sel: 6, ca: 950, fe: 16, mg: 360, k: 3500, zn: 8.9, vitA: 650, vitD: 15, vitC: 110, b9: 330, b12: 4 },
};
const MICRO_CAPS = ['sel', 'ags'];

const zero = () => Object.fromEntries(MICRO_KEYS.map(k => [k, 0]));

// Micronutriments d'un repas planifié (quantités réelles de la portion)
function microsOfItem(item) {
  const out = zero();
  const r = getById(item.id);
  if (!r) return out;
  const qs = itemQuantities(item);
  r.ingredients.forEach((ing, i) => {
    const row = MICROS[ing.key];
    if (!row || !qs[i]) return;
    const f = INGREDIENTS[ing.key]?.unit === 'pièce' ? qs[i] : qs[i] / 100;
    MICRO_KEYS.forEach((k, j) => out[k] += row[j] * f);
  });
  return out;
}

// Total d'une journée (tous les repas, y compris collations et compléments)
function dayMicros(entry) {
  const out = zero();
  ['breakfast', 'starter', 'lunch', 'dinner', 'sides', 'sweet'].forEach(s =>
    (entry?.meals?.[s] || []).forEach(it => { const m = microsOfItem(it); MICRO_KEYS.forEach(k => out[k] += m[k]); }));
  return out;
}

// Moyenne par jour sur une semaine, arrondie (les jours vides sont ignorés)
function weekMicros(entries, dates) {
  const days = dates.map(d => entries[d]).filter(e => e && Object.values(e.meals || {}).some(a => a && a.length));
  const out = zero();
  days.forEach(e => { const m = dayMicros(e); MICRO_KEYS.forEach(k => out[k] += m[k]); });
  MICRO_KEYS.forEach(k => out[k] = days.length ? +(out[k] / days.length).toFixed(k === 'sel' || k === 'b12' || k === 'vitD' || k === 'o3' ? 2 : 1) : 0);
  return out;
}


// ──────────────────────────────────────────────
// js/weekgen.js
// ──────────────────────────────────────────────
// weekgen.js — Génère une semaine pensée pour le batch cooking.
//
// Organisation :
//   Session 1 (dimanche)  → plats pour lundi, mardi, mercredi
//   Session 2 (mercredi)  → plats pour jeudi → dimanche
// Chaque session = 2 plats (parfois 3) cuisinés en plusieurs portions IDENTIQUES.
// Midi et soir sont interchangeables : on ne mange jamais le même plat deux fois le même jour.
//
// Règles de choix des plats :
//   - variété : pas deux fois la même protéine si possible, féculents variés
//   - tirage aléatoire pondéré (variété des protéines/féculents, plats récents évités)
//   - poisson frais (saumon, colin, crevettes) : max 1 plat, dans la session 1, mangé sous 2 jours
//   - coût visé ~60 €, semaines > 70 € retirées
//
// Portions : chaque plat est calibré UNE fois (js/optimizer.js) dans des bornes réalistes.
// Les collations s'adaptent jour par jour pour boucler les objectifs.


const PLAN_KEY = 'hebe_week_plan';
function getWeekPlan() {
  try { return JSON.parse(localStorage.getItem(PLAN_KEY) || 'null'); } catch { return null; }
}
function saveWeekPlan(p) { localStorage.setItem(PLAN_KEY, JSON.stringify(p)); }
// Plan affiché : le dernier généré, tant que sa semaine n'est pas terminée.
function getActivePlan() {
  const plan = getWeekPlan();
  if (!plan || !plan.dates || !plan.sessions) return null;
  return plan.dates[plan.dates.length - 1] >= getTodayDate() ? plan : null;
}

// Objectifs d'une personne pour la semaine générée (anciens plans : objectifs uniques)
const planTargets = (plan, memberId) => plan?.targetsBy?.[memberId || getActiveMember().id] || plan?.targets || USER.targets;
// Personnes concernées par le plan (anciens plans : la personne active seulement)
// Part de chaque plat selon la formule de la personne (jeûne 40 %, classique 32 %)
const planShare = (plan, memberId) => PLATE_SHARE[plan?.formulaBy?.[memberId || getActiveMember().id] || 'jeune'] || 0.40;
const planMembers = plan => (plan?.members && plan.members.length ? plan.members : [getActiveMember().id]);

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Légumes frais d'une recette (le surgelé et les conserves ne comptent pas pour l'anti-gaspi)
const FRESH_VEG = ['courgette', 'poivron', 'carotte', 'tomates_cerise', 'champignons', 'concombre', 'salade', 'avocat', 'patate_douce'];
const freshVeg = r => new Set(r.ingredients.map(i => i.key).filter(k => FRESH_VEG.includes(k)));

// Coût réel d'un item planifié (avec ses quantités ajustées)
function itemCost(item) {
  const r = getById(item.id);
  if (!r || (r.tags || []).includes('cantine')) return 0;
  const qs = itemQuantities(item);
  return r.ingredients.reduce((a, ing, i) => a + ingCost(ing.key, qs[i]), 0);
}

// ── Tirage d'un plat : VRAIMENT aléatoire, pondéré seulement pour la variété ──
//   - même famille de protéine déjà choisie → beaucoup moins probable
//   - même féculent → un peu moins probable
//   - plat mangé récemment (semaines précédentes / régénération) → très peu probable
//   - poisson frais : 1 max par semaine, session 1 seulement
// ── Conservation : tout est cuisiné en une seule session, le dimanche ──
// Lundi, mardi et mercredi : boîtes au frigo (1 à 3 jours). Au-delà : boîtes congelées, décongelées la veille au frigo.
// Poisson et fruits de mer : mangés lundi ou mardi. Plats qui ne se congèlent pas bien (frites, panures
// croustillantes, crudités et sauces au yaourt dans la boîte) : mangés dans les 3 premiers jours.
const FRESH_ONLY = ['W02', 'W04', 'W09', 'W10', 'W11', 'W13', 'W15', 'W19', 'W31', 'W33', 'W35', 'W36', 'W40', 'W41', 'W42', 'W74'];
const FRIDGE_DAYS = 3;
const isFreshOnly = r => FRESH_ONLY.includes(r.id);
const deadlineOf = r => (isFreshFish(r) ? 1 : isFreshOnly(r) ? FRIDGE_DAYS - 1 : 99);
// une boîte mangée le jour dayIdx (0 = lundi) passe par le congélateur si elle dépasse 3 jours de frigo
const goesToFreezer = (r, dayIdx) => dayIdx >= FRIDGE_DAYS && !isFreshFish(r) && !isFreshOnly(r);
// Viande rouge (repère : 500 g cuits par semaine au plus) : un seul plat de bœuf par semaine, mangé 2 fois au plus.
// Les plus grosses assiettes portent environ 330 g de bœuf cru, soit 660 g crus (≈ 500 g cuits) sur la semaine.
const isRedMeat = r => r.ingredients.some(i => RED_MEAT_KEYS.includes(i.key));
// v174 (demande de Pierre) : jusqu'à 2 plats de bœuf par semaine, 3 repas au total (2 au plus pour un même plat).
// Soit ~1 kg cru (~750 g cuits) pour une grosse assiette : au-dessus du repère de 500 g cuits, choix assumé.
const RED_MEAT_DISHES = 1, RED_MEAT_MEALS = 4, RED_MEAT_PER_DISH = 4; // v184 : un plat de bœuf par semaine, jusqu'à 4 portions (portions homogènes)
// Portions homogènes (v184) : au moins 2 portions par plat, au plus 2 portions d'écart entre les plats
const MIN_PORTIONS = 2, MAX_SPREAD = 2;
// Variété des glucides : familles de féculents ; 2 plats au plus de la même famille par semaine
const STARCH_FAMILY = {
  riz: 'riz', riz_blanc: 'riz', nouilles_riz: 'riz',
  pates: 'pates', pates_classiques: 'pates', nouilles_oeufs: 'pates', orzo: 'pates', pates_sg: 'pates',
  pain: 'pain', farine: 'pain', pita: 'pain', baguette: 'pain', tortilla: 'pain', pain_burger: 'pain', pain_sg: 'pain', wrap_sg: 'pain',
  pdt: 'pdt', patate_douce: 'pdt', gnocchis: 'pdt',
  boulghour: 'cereale', semoule: 'cereale', quinoa: 'cereale',
};
const starchFamily = r => STARCH_FAMILY[mainStarch(r)] || mainStarch(r) || 'autre';
const STARCH_MAX = 3;
const FITS = new Map(); // plat × assiette → peut remplir l'assiette (voir generateWeekOnce)
// v191 : produits vendus en gros paquet pour de petites quantités (lait de coco, feta…) : si la semaine en contient,
// les autres plats, collations et petits-déjeuners qui les utilisent sont favorisés, pour finir le paquet
const SHARE_KEYS = ['lait_coco', 'creme_coco', 'feta', 'fromage_frais', 'carre_frais', 'creme', 'houmous', 'cottage', 'avocat',
  'tortilla', 'pita', 'pain_burger', 'jambon_blanc', 'poulet_tranches', 'fromage_blanc', 'yaourt_grec'];
const SHARE_BONUS = 3;
const recipeKeysOf = r => (r?.ingredients || []).map(i => i.key);
const sharesWith = (r, keys) => keys.size && recipeKeysOf(r).some(k => keys.has(k));
const shareKeysOf = recs => new Set(recs.flatMap(recipeKeysOf).filter(k => SHARE_KEYS.includes(k)));
// produits qui se gardent au moins 2 semaines (carrés frais emballés à l'unité ; pains, wraps, lait de coco et feta au congélateur) :
// le reste est reporté à la semaine suivante, qui favorise les recettes qui l'utilisent (mémoire hebe_leftovers)
const KEEP_2W = ['carre_frais', 'tortilla', 'pita', 'pain_burger', 'pain', 'baguette', 'lait_coco', 'feta']; // lait de coco (bac à glaçons) et feta émiettée : au congélateur
const LEFT_KEY = 'hebe_leftovers';
const getLeftovers = () => { try { return JSON.parse(localStorage.getItem(LEFT_KEY) || '{}'); } catch { return {}; } };

function pickMain(pool, chosen, { allowFish, served = { n: 0, last: {} }, earlySlots = 6, fishSlots = 4, extraKeys = [] }) {
  const prefer = new Set([...shareKeysOf(chosen), ...extraKeys]);
  // 👎 : jamais tiré, sauf s'il ne reste vraiment rien d'autre
  const liked = pool.filter(r => getRating(r.id) >= 0);
  if (liked.length >= 4) pool = liked;
  // Ce qui ne se congèle pas se mange dans les 3 premiers jours (6 repas) : au plus un poisson frais,
  // et 2 plats « à manger frais » (un seul s'il y a déjà un poisson frais, qui prend aussi des premiers jours).
  // … et seulement s'il reste assez de repas dans ces 3 jours (des midis libres en réduisent le nombre) : 2 portions par plat
  // earlySlots = jours cuisinés parmi les 3 premiers : chaque plat frais y prend au moins 2 jours, 2 plats peuvent partager un jour (midi et soir)
  const freshOnlyMax = earlySlots < MIN_PORTIONS ? 0 : Math.min(chosen.some(isFreshFish) ? 1 : 2, Math.floor(earlySlots * 2 / MIN_PORTIONS / (chosen.some(isFreshFish) ? 2 : 1)));
  const nFreshOnly = chosen.filter(isFreshOnly).length;
  if (fishSlots < MIN_PORTIONS) allowFish = false; // pas assez de repas les 2 premiers jours pour un poisson frais
  let cands = pool.filter(r => !chosen.some(c => c.id === r.id) && (allowFish || !isFreshFish(r))
    && !(isFreshFish(r) && (chosen.some(isFreshFish) || nFreshOnly >= 2))
    && !(isFreshOnly(r) && nFreshOnly >= freshOnlyMax));
  // un seul plat de bœuf par semaine (sauf si on n'a choisi que du bœuf comme protéine)
  if (chosen.filter(isRedMeat).length >= RED_MEAT_DISHES && cands.some(r => !isRedMeat(r))) cands = cands.filter(r => !isRedMeat(r));
  // garde-fou : jamais plus de 2 plats de la même famille de féculents dans la semaine (s'il reste d'autres choix)
  const famCount = f => chosen.filter(c => starchFamily(c) === f).length;
  if (cands.some(r => famCount(starchFamily(r)) < STARCH_MAX)) cands = cands.filter(r => famCount(starchFamily(r)) < STARCH_MAX);
  if (!cands.length) return null;
  // Répartition uniforme (v176) : chaque plat a la même chance au départ, puis un tour de rôle.
  // Un plat servi il y a « age » semaines pèse (age / cycle)⁴, plafonné à 1, où cycle ≈ le nombre de semaines
  // pour faire le tour de tous les plats possibles. Plus un plat attend, plus il a de chances de sortir.
  // Aucune pénalité de famille de féculents ou de protéine : s'il y a plus de plats au riz, il y a plus de riz.
  const cycle = Math.max(2, pool.length / 4);
  const weights = cands.map(r => {
    let w = 1;
    if (getRating(r.id) > 0) w *= 2.2;   // 👍 : revient plus souvent
    if (sharesWith(r, prefer)) w *= SHARE_BONUS; // partage un produit en gros paquet déjà pris (ou un reste reporté)
    if (isFreshFish(r) && chosen.some(isFreshFish)) w *= 0.01;
    const last = served.last[r.id];
    if (last !== undefined) w *= Math.min(1, ((served.n - last) / cycle) ** 4);
    return w;
  });
  let x = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < cands.length; i++) { x -= weights[i]; if (x <= 0) return cands[i]; }
  return cands[cands.length - 1];
}

// Répartit n repas entre des plats : un plat ne revient qu'une fois par jour,
// et le poisson frais au plus 2 fois (2 premiers jours). Renvoie null si impossible.
function allocate(n, plats, days, level = 2, early = 99, fishEarly = 99, earlyMeals = 99) {
  const onlyRed = plats.every(isRedMeat);
  let redLeft = RED_MEAT_MEALS;
  let freshLeft = earlyMeals; // repas des 3 premiers jours, à partager entre poisson frais et plats à manger frais
  const caps = plats.map(p => {
    // poisson frais : repas des 2 premiers jours ; à manger frais : repas des 3 premiers jours (des repas libres en réduisent le nombre)
    let c = isFreshFish(p) ? Math.min(2, days, fishEarly, freshLeft) : isFreshOnly(p) ? Math.min(FRIDGE_DAYS, days, early, freshLeft) : days;
    if (isFreshFish(p) || isFreshOnly(p)) freshLeft -= c;
    if (isRedMeat(p) && !onlyRed) { c = Math.min(c, RED_MEAT_PER_DISH, redLeft); redLeft -= c; }
    return c;
  });
  const counts = plats.map(() => 0);
  let left = n;
  while (left > 0) {
    let progressed = false;
    // on remplit d'abord les plats non-poisson, en restant équilibré
    const order = plats.map((p, i) => i).sort((a, b) => counts[a] - counts[b]);
    for (const i of order) {
      if (left === 0) break;
      if (counts[i] < caps[i]) { counts[i]++; left--; progressed = true; }
    }
    if (!progressed) return null;
  }
  // une répartition déséquilibrée (un plat pour une seule portion, 7-3-2-2…) est refusée : le moteur ajoute un plat ou en tire d'autres
  // level 2 : au moins 2 portions et au plus 2 d'écart ; level 1 : au moins 2 portions ; level 0 : dernier recours
  if (level >= 1 && Math.min(...counts) < MIN_PORTIONS) return null;
  if (level >= 2 && Math.max(...counts) - Math.min(...counts) > MAX_SPREAD) return null;
  return counts;
}

// Place les portions dans les créneaux d'une session (earliest-deadline-first)
function schedule(slots, plats, counts) {
  const remaining = [...counts];
  const deadline = plats.map(deadlineOf); // poisson : lundi ou mardi ; plats à manger frais : avant jeudi
  const result = [];
  let prevId = null;
  // v196 : on mélange l'ordre des plats dans la semaine. La date limite d'un plat ne décide plus de tout :
  // un plat n'est « obligé » de passer que s'il ne lui reste plus assez de jours avant sa date limite.
  // Sinon on évite le même plat au même repas que la veille (ou l'avant-veille), et le même plat deux repas de suite.
  const days = [...new Set(slots.map(sl => sl.dayIdx))];
  slots.forEach((slot, si) => {
    const sameDay = result.filter(r => r.slot.dayIdx === slot.dayIdx).map(r => r.plat.id);
    const atMeal = back => result.find(r => r.slot.dayIdx === slot.dayIdx - back && r.slot.meal === slot.meal)?.plat.id;
    const yesterday = atMeal(1), twoAgo = atMeal(2);
    const cands = plats.map((p, i) => i).filter(i => remaining[i] > 0 && !sameDay.includes(plats[i].id));
    const pool = cands.length ? cands : plats.map((p, i) => i).filter(i => remaining[i] > 0);
    // jours encore possibles pour ce plat (un repas par jour au plus), d'aujourd'hui à sa date limite
    const room = i => days.filter(d => d <= deadline[i] && (d > slot.dayIdx || (d === slot.dayIdx && !sameDay.includes(plats[i].id)))).length;
    // obligé ce jour-là… mais s'il a déjà été mangé à ce repas la veille et que le soir est libre pour lui, il attend le soir
    const dinnerLater = slot.meal === 'lunch' && slots.some(sl => sl.dayIdx === slot.dayIdx && sl.meal === 'dinner');
    const forced = i => remaining[i] >= room(i) && !(dinnerLater && plats[i].id === yesterday);
    const pen = i => (plats[i].id === yesterday ? 4 : 0) + (plats[i].id === twoAgo ? 1.5 : 0) + (plats[i].id === prevId ? 1 : 0);
    const rnd = new Map(pool.map(i => [i, Math.random()]));
    pool.sort((a, b) =>
      (forced(b) - forced(a)) ||
      (forced(a) && forced(b) ? deadline[a] - deadline[b] : 0) ||
      (pen(a) - pen(b)) ||
      // urgence douce : moins il reste de jours libres par portion, plus le plat passe tôt
      ((room(a) / remaining[a]) - (room(b) / remaining[b])) ||
      (rnd.get(a) - rnd.get(b)));
    const i = pool[0];
    remaining[i]--;
    prevId = plats[i].id;
    result.push({ slot, plat: plats[i] });
  });
  // correction (v185) : jamais le même plat midi et soir le même jour, si un échange avec un autre jour le permet
  // (sans créer de doublon ailleurs et en respectant les dates limites des plats frais)
  const ok = (o, dayIdx) => dayIdx <= deadlineOf(o.plat);
  for (let pass = 0; pass < 4; pass++) {
    let fixed = false;
    for (const r of result) {
      if (!result.some(o => o !== r && o.slot.dayIdx === r.slot.dayIdx && o.plat.id === r.plat.id)) continue;
      const swap = result.find(o => o.slot.dayIdx !== r.slot.dayIdx && o.plat.id !== r.plat.id
        && !result.some(x => x !== o && x.slot.dayIdx === o.slot.dayIdx && x.plat.id === r.plat.id)
        && !result.some(x => x !== r && x.slot.dayIdx === r.slot.dayIdx && x.plat.id === o.plat.id)
        && ok(o, r.slot.dayIdx) && ok(r, o.slot.dayIdx));
      if (swap) { const p = r.plat; r.plat = swap.plat; swap.plat = p; fixed = true; }
    }
    if (!fixed) break;
  }
  return result;
}

// Choisit les collations de la semaine : un mix sucré / salé, rapides, sans répétition lassante.
// Collations proposées : sans whey (variantes au skyr) pour qui n'a pas de protéine en poudre
function snackPool(whey = true, lac = 0, glu = 0) {
  // avec whey : la version d'origine, sauf si le régime l'interdit (lactose) ; alors sa version sans whey
  const wheyBlocked = r => r.wheyOf && !dietOk(getById(r.wheyOf), lac, glu);
  return getSweets().filter(r => isAvailable(r) && dietOk(r, lac, glu) && getRating(r.id) >= 0
    && (whey === false ? !hasWhey(r) : (!(r.tags || []).includes('sans-whey') || wheyBlocked(r))));
}
// ordre aléatoire pondéré : les recettes qui partagent un produit déjà pris passent plus souvent devant
const weightedOrder = (list, prefer) => list.map(r => ({ r, k: Math.random() ** (1 / (sharesWith(r, prefer) ? SHARE_BONUS : 1)) })).sort((a, b) => b.k - a.k).map(x => x.r);
// v195 : mémoire des collations préparées servies (même principe que les plats), versions avec et sans whey confondues
const SNK_KEY = 'hebe_served_snacks';
const baseSnackId = id => String(id).replace(/S$/, '');
function getServedSnacks() {
  try { const v = JSON.parse(localStorage.getItem(SNK_KEY) || 'null'); if (v && typeof v.n === 'number' && v.last) return v; } catch {}
  return { n: 0, last: {} };
}
// v195 : portion minimale d'une collation (pour ne proposer que des préparées qui tiennent dans la journée)
const snackFloorCache = {};
const snackFloor = r => (snackFloorCache[r.id] ??= optimizeRecipe(r, { kcal: 50, protein: 5, carbs: 5, fat: 2 }, 'S', 1).macros.kcal);
function pickSnacks(whey = true, lac = 0, glu = 0, prefer = new Set(), room = Infinity, bought = null) {
  const all = snackPool(whey, lac, glu);
  // v196 : une collation rapide qui demande un produit frais vendu à la pièce ou en sachet (avocat, salade, concombre…)
  // n'est proposée que si ce produit est déjà acheté pour les plats : sinon on achèterait un avocat entier pour 30 g
  const PACK_FRESH = ['avocat', 'salade', 'concombre', 'herbes', 'tomates_cerise', 'champignons', 'poivron', 'courgette', 'aubergine'];
  const needsPack = s => !!bought && s.ingredients.some(i => PACK_FRESH.includes(i.key) && !bought.has(i.key));
  const quick = all.filter(s => !s.batch && (s.prepTime + s.cookTime) <= 10 && !needsPack(s));
  // v195 / v199 : tour de rôle, pour les collations préparées comme pour les rapides. Celles servies récemment passent
  // leur tour (s'il en reste assez) ; ensuite, plus une collation attend, plus elle a de chances de sortir.
  // Le partage d'un produit avec les plats ne donne plus qu'un petit coup de pouce.
  const sv = getServedSnacks();
  const ageOf = id => (sv.last[id] == null ? 8 : Math.min(8, sv.n - sv.last[id]));
  const byAge = list => list.map(r => ({ r, k: Math.random() ** (1 / (ageOf(baseSnackId(r.id)) ** 2 * (sharesWith(r, prefer) ? 1.3 : 1))) })).sort((a, b) => b.k - a.k).map(x => x.r);
  const restedQ = list => { const r = list.filter(s => ageOf(baseSnackId(s.id)) >= 2); return r.length >= 2 ? r : list; };
  const sweet = byAge(restedQ(quick.filter(s => (s.tags || []).includes('sucré') || !(s.tags || []).includes('salé'))));
  const salty = byAge(restedQ(quick.filter(s => (s.tags || []).includes('salé'))));
  // préparée à l'avance : seulement ce qui tient toute la semaine (energy balls ; pancakes, qui se congèlent)
  let batchPool = all.filter(s => s.batch && (/^K0[68]/.test(s.id) || (s.tags || []).includes('semaine')) && snackFloor(s) <= room);
  const rested = batchPool.filter(s => ageOf(baseSnackId(s.id)) >= 3);
  if (rested.length >= 2) batchPool = rested;
  const batchy = batchPool.map(r => ({ r, k: Math.random() ** (1 / (ageOf(baseSnackId(r.id)) ** 2 * (sharesWith(r, prefer) ? 1.3 : 1))) })).sort((a, b) => b.k - a.k).map(x => x.r);
  // v188 : 1 ou 2 collations préparées le dimanche, en alternance avec des collations rapides (fromage blanc, yaourt…).
  // Rotation [préparée, rapide, préparée ou rapide, rapide] : chaque jour, le choix se fait entre 2 voisines,
  // donc une préparée et une rapide ; une préparée revient ainsi 3 à 4 jours dans la semaine.
  const nBatch = Math.random() < 0.5 ? 1 : 2;
  const picks = nBatch === 2 && batchy[1]
    ? [batchy[0], sweet[0], batchy[1], salty[0] || sweet[1]]
    : [batchy[0], sweet[0], salty[0], sweet[1]];
  return [...new Set(picks.filter(Boolean).map(p => p.id))];
}
const planSnacks = (plan, mid) => plan?.snacksBy?.[mid] || plan?.snacks || pickSnacks();

// ── Petits-déjeuners (formule classique) ──
// Une recette préparée au batch par session. Si elle ne se garde que 3 jours, le 4e jour de la
// 2e session reçoit un petit-déjeuner minute (menemen, tartines).
const fridgeDays = r => parseInt((r.tags || []).find(t => /^frigo-\d+$/.test(t))?.slice(6) || '0');
function weightedPick(list, bonus = () => 1) {
  if (!list.length) return null;
  const w = list.map(r => (getRating(r.id) > 0 ? 2.2 : 1) * bonus(r));
  let x = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let k = 0; k < list.length; k++) { x -= w[k]; if (x <= 0) return list[k]; }
  return list[list.length - 1];
}
// Par personne : selon sa préférence (sucré, salé ou les deux) et la whey.
// Deux recettes par session, en alternance ; une recette préparée à l'avance ne dépasse pas sa durée au frigo.
function breakfastPool(m) {
  return getBreakfasts().filter(r => {
    if (getRating(r.id) < 0 || !isAvailable(r) || !dietOk(r, m.lactose ?? lactoseOf(m.id), m.gluten ?? glutenOf(m.id))) return false;
    // sans whey : la version sans whey de chaque recette ; avec whey : la version d'origine
    if (m.whey === false ? hasWhey(r) : (r.tags || []).includes('sans-whey')) return false;
    const t = r.tags || [];
    if (m.breakfast === 'sucre') return t.includes('sucré');
    if (m.breakfast === 'sale') return t.includes('salé');
    return true;
  });
}
// Charcuterie : ce qu'il reste du plafond de la semaine pour une journée donnée.
// getE(date) renvoie l'état actuel de chaque jour ; e est la journée en cours (déjà vidée de ses collations).
// Variété (v187) : jours où chaque collation ou complément est déjà servi dans les autres jours de la semaine
function weekUseOf(dates, getE, e) {
  const use = {};
  dates.forEach(d => { const x = getE(d); if (!x || x === e || x?.date === e?.date) return;
    new Set(['sides', 'sweet'].flatMap(s => (x.meals?.[s] || []).filter(it => !it.with).map(it => it.id))).forEach(id => { use[id] = (use[id] || 0) + 1; }); });
  return use;
}
// Produits frais consommés en entier (v190, généralise les laitages de la v189) : viande, charcuterie, laitages frais,
// pains, légumes vendus à la pièce ou en barquette, conserves une fois ouvertes. Sur toute la semaine du foyer, les
// quantités de tous les repas qui en contiennent sont ajustées pour tomber sur des paquets entiers (pack, ou poids
// d'une pièce : buy) : finir le paquet entamé, ou réduire un peu si on dépasse d'au plus 20 % pour ne pas en ouvrir un autre.
// Bornes : min et max de l'ingrédient (ou ±20 % / +60 % s'il n'en a pas) ; une petite quantité ne baisse que de 20 %.
// Produits comptés à l'unité (wraps, tranches, carrés) : ajustés par unités entières.
// S'il reste encore un bon morceau, il va dans un complément qui l'utilise, à la place d'un autre (un jour qui le permet).
const FRESH_KEYS = ['poulet', 'poulet_hache', 'boeuf', 'saumon', 'haut_cuisse', 'boeuf_emince', 'tofu', 'poulet_tranches', 'jambon_blanc',
  'fromage_blanc', 'yaourt_grec', 'yaourt_sl', 'cottage', 'fromage_frais', 'carre_frais', 'feta', 'creme', 'creme_coco', 'houmous', 'lait',
  'tortilla', 'pita', 'pain_burger', 'baguette', 'pain', 'gnocchis',
  'concombre', 'avocat', 'poivron', 'courgette', 'aubergine', 'salade', 'herbes', 'tomates_cerise', 'champignons', 'chou_chinois',
  'pois_chiches', 'haricots_rouges', 'haricots_blancs', 'tomates_conc', 'lait_coco', 'mais', 'thon'];
const LEFTOVER_FILLER = { fromage_blanc: 'S08', carre_frais: 'S12', pain: 'S12', tortilla: 'K13', avocat: 'K12' };
const DAIRY_BOWL_KEYS = ['fromage_blanc', 'yaourt_grec', 'yaourt_sl'];
// phase 'repas' (avant les collations) : on ajuste les plats et petits-déjeuners, pas de complément de reste ;
// phase 'collations' (après) : on ne retouche que collations et compléments (les repas sont comptés mais fixes), et on
// place les compléments de reste. Ainsi les collations compensent les calories ajoutées aux repas.
function snapFresh(entries, canTake = () => true, phase = 'collations') {
  const MEAL_SLOTS = ['breakfast', 'starter', 'lunch', 'dinner'];
  const adjustable = slot => (phase === 'repas' ? MEAL_SLOTS.includes(slot) : !MEAL_SLOTS.includes(slot));
  // deux tours : un complément de reste utilise lui-même d'autres produits frais déjà ouverts (la tartine : pain et carré frais)
  for (let round = 0; round < 2; round++) FRESH_KEYS.forEach(key => {
    const db = INGREDIENTS[key];
    const P = db?.pack || db?.buy;
    if (!P) return;
    const g = NATURAL_UNITS[key]?.g || 1; // pas d'ajustement : 1 g, ou une unité entière (wrap, tranche…)
    const spots = [];
    entries.forEach(e => ['breakfast', 'starter', 'lunch', 'dinner', 'sides', 'sweet'].forEach(slot => (e?.meals?.[slot] || []).forEach(it => {
      const r = getById(it.id); if (!r) return;
      const qs = itemQuantities(it);
      r.ingredients.forEach((ing, ix) => {
        if (ing.key !== key || !qs[ix]) return;
        const q = qs[ix];
        // repas : ±15 % / −30 % au plus (les assiettes restent calées, on préfère un paquet de moins) ; collations : bornes de l'ingrédient
        const min = phase === 'repas' ? q * 0.7 : (db.min != null ? (q < db.min ? q * 0.8 : db.min) : q * 0.8);
        // collations : un produit léger (≤ 100 kcal pour 100 g : fromage blanc, yaourt, lait, crudités) peut monter jusqu'à son
        // maximum, presque sans calories ; un produit dense (carré frais, feta, pain…) ne monte pas
        const light = ((db.per?.kcal ?? 999) <= 100 && db.unit !== 'pièce') || CHARC_KEYS.includes(key); // charcuterie : par tranche, sous le plafond
        const max = light ? Math.max(q, db.max ?? q * 1.6) : (phase === 'repas' ? q * 1.15 : q);
        if (!adjustable(slot)) { spots.push({ it, ix, q, min: q, max: q, fixed: true }); return; }
        spots.push({ it, ix, q, min: Math.ceil(min / g) * g > q ? q : Math.ceil(min / g) * g, max: Math.max(q, Math.floor(max / g) * g) });
      });
    })));
    if (!spots.length) return;
    const sum = () => spots.reduce((a, x) => a + x.q, 0);
    const total = sum();
    const down = Math.floor(total / P + 1e-9) * P, up = Math.ceil(total / P - 1e-9) * P;
    if (up - total >= 0.5) {
      const room = spots.reduce((a, x) => a + (x.max - x.q), 0), slack = spots.reduce((a, x) => a + (x.q - x.min), 0);
      let target = (down > 0 && total - down <= Math.min(slack, total * (phase === 'repas' ? 0.3 : 0.2))) ? down : Math.min(up, total + room);
      // charcuterie : jamais au-delà de 4 tranches par personne et par semaine (une barquette)
      if (CHARC_KEYS.includes(key)) { const cap = CHARC_MAX * Math.max(1, Math.round(entries.length / 7)); if (target > cap) target = Math.max(down, Math.min(total, cap)); }
      let diff = target - total;
      for (let pass = 0; pass < 6 && Math.abs(diff) >= g / 2; pass++) {
        const open = spots.filter(x => (diff > 0 ? x.max - x.q : x.q - x.min) >= g / 2);
        if (!open.length) break;
        const each = diff / open.length;
        open.forEach(x => { const nq = Math.max(x.min, Math.min(x.max, x.q + each)); diff -= nq - x.q; x.q = nq; });
      }
      // arrondi (au gramme ou à l'unité), puis la différence d'arrondi sur un seul ingrédient : le total tombe pile
      spots.forEach(x => { if (!x.fixed) x.q = Math.max(g, Math.round(x.q / g) * g); });
      const want = Math.round(target / g) * g, drift = want - sum();
      if (drift) {
        const free = spots.filter(x => !x.fixed);
        const fix = free.find(x => x.q + drift >= x.min && x.q + drift <= x.max) || (free.length ? free.reduce((x, y) => (y.q > x.q ? y : x)) : null);
        if (fix)
        fix.q = Math.max(g, fix.q + drift);
      }
      spots.forEach(x => { if (!x.fixed) x.it.overrides = { ...(x.it.overrides || {}), [x.ix]: x.q }; });
    }
    if (phase === 'repas') return;
    // reste encore un bon morceau du paquet : un complément qui l'utilise, à la place d'un autre complément ou d'une collation rapide
    const fillerId = LEFTOVER_FILLER[key], filler = fillerId && getById(fillerId);
    if (!filler) return;
    const fIx = filler.ingredients.findIndex(i => i.key === key);
    if (fIx < 0) return;
    // le complément ne doit pas faire ouvrir un autre produit frais : ses autres produits frais sont déjà achetés cette semaine
    const bought = k => entries.some(e => ['breakfast', 'starter', 'lunch', 'dinner', 'sides', 'sweet'].some(sl => (e?.meals?.[sl] || []).some(it => {
      const r = getById(it.id); if (!r) return false; const qs = itemQuantities(it);
      return r.ingredients.some((i, ix) => i.key === k && qs[ix] > 0);
    })));
    if (filler.ingredients.some(i => i.key !== key && FRESH_KEYS.includes(i.key) && !bought(i.key))) return;
    for (let n = 0; n < 7; n++) { // plusieurs jours si un seul complément ne suffit pas (pot de 1 kg…)
    const left = Math.ceil(sum() / P - 1e-9) * P - sum();
    if (left < Math.max(g, (db.min ?? 0) * 0.5, P * 0.15)) break;
    const qty = Math.min(db.max ?? Math.max(left, filler.ingredients[fIx].qty * 2), Math.max(g, Math.floor(left / g) * g));
    const item = { id: fillerId, servings: 1, overrides: { [fIx]: qty } };
    const kc = computeMealMacros(item).kcal;
    const isBowl = DAIRY_BOWL_KEYS.includes(key);
    const hasBowl = e => ['breakfast', 'sides', 'sweet'].some(sl => (e?.meals?.[sl] || []).some(it => getById(it.id)?.ingredients.some(i => DAIRY_BOWL_KEYS.includes(i.key))));
    let placed = false;
    for (const pick of [it => !it.with && /^S/.test(it.id) && it.id !== fillerId, it => !it.with && !getById(it.id)?.batch && it.id !== fillerId]) {
      const e = entries.find(x => x?.meals && canTake(x, fillerId) && !(isBowl && hasBowl(x))
        && !['sides', 'sweet'].some(sl => (x.meals[sl] || []).some(it => it.id === fillerId))
        && ['sides', 'sweet'].some(sl => (x.meals[sl] || []).some(pick)));
      if (!e) continue;
      const cands = ['sides', 'sweet'].flatMap(sl => (e.meals[sl] || []).filter(pick).map(it => ({ sl, it })));
      const out = cands.reduce((x, y) => (Math.abs(computeMealMacros(y.it).kcal - kc) < Math.abs(computeMealMacros(x.it).kcal - kc) ? y : x));
      // mêmes calories que le complément remplacé : on réduit la quantité du produit à finir si besoin
      const kOut = computeMealMacros(out.it).kcal;
      if (kc > kOut * 1.1) {
        const per = (kc - computeMealMacros({ id: fillerId, servings: 1, overrides: { [fIx]: 0 } }).kcal) / qty; // kcal par g du produit
        const q2 = Math.floor(Math.max(0, qty - (kc - kOut * 1.1) / Math.max(per, 1e-6)) / g) * g;
        if (q2 < Math.max(g, (db.min ?? 0) * 0.5)) continue;
        item.overrides = { [fIx]: q2 };
      }
      const qPlaced = item.overrides[fIx];
      e.meals[out.sl] = e.meals[out.sl].filter(it => it !== out.it);
      e.meals.sides = [...(e.meals.sides || []), item];
      spots.push({ it: item, ix: fIx, q: qPlaced, min: qPlaced, max: qPlaced });
      placed = true;
      break;
    }
    if (!placed) break;
    }
  });
}
// Rééquilibrage après le calage des produits frais : retire les compléments ou collations sans produit frais
// (fruit, amandes, collation de placard) tant que la journée dépasse sa cible de plus de 3 %
function trimOver(e, T) {
  const hasFresh = it => getById(it.id)?.ingredients.some(i => FRESH_KEYS.includes(i.key));
  for (let n = 0; n < 4; n++) {
    const over = computeDayMacros(e).kcal - T.kcal;
    if (over <= T.kcal * 0.03) return;
    const cands = ['sides', 'sweet'].flatMap(sl => (e.meals[sl] || []).filter(it => !it.with && !hasFresh(it) && !getById(it.id)?.batch).map(it => ({ sl, it, kc: computeMealMacros(it).kcal })));
    if (!cands.length) return;
    // celui qui ramène le plus près de la cible, sans trop descendre en dessous
    const best = cands.reduce((x, y) => (Math.abs(over - y.kc) < Math.abs(over - x.kc) ? y : x));
    if (over - best.kc < -T.kcal * 0.05) return; // le retirer creuserait trop
    e.meals[best.sl] = e.meals[best.sl].filter(it => it !== best.it);
  }
}
function charcLeft(dates, getE, e) {
  return CHARC_MAX - dates.reduce((a, d) => { const x = getE(d); return a + (x === e || x?.date === e?.date ? 0 : charcOfEntry(x)); }, 0) - charcOfEntry(e);
}
// Petit-déjeuner de remplacement sans charcuterie, dans les préférences de la personne
function breakfastNoCharc(m, r) {
  const pool = breakfastPool(m).filter(x => !x.ingredients.some(i => ['jambon_blanc', 'poulet_tranches'].includes(i.key)));
  const t = x => ((x.tags || []).includes('salé') ? 'salé' : 'sucré');
  const quick = pool.filter(x => !x.batch);
  return weightedPick(quick.filter(x => t(x) === t(r))) || weightedPick(quick) || weightedPick(pool) || null;
}
// Calcium : un petit-déjeuner riche en calcium (≥ 70 mg pour 100 kcal : laitages, lait) est deux fois plus probable
const caBreakfast = r => (calciumPer100kcal(r) >= 70 ? 2 : 1);
function pickBreakfasts(m, sessionDays, prefer = new Set()) {
  const pool = breakfastPool(m);
  const used = [];
  return sessionDays.map(days => {
    const fresh = pool.filter(r => !used.includes(r.id));
    const src = fresh.length >= 2 ? fresh : pool;
    const a = weightedPick(src, r => caBreakfast(r) * (sharesWith(r, prefer) ? SHARE_BONUS : 1));
    if (!a) return days.map(() => null);
    // « les deux » : un sucré et un salé ; sinon deux recettes différentes
    const t = r => ((r.tags || []).includes('salé') ? 'salé' : 'sucré');
    let rest = src.filter(r => r.id !== a.id);
    if (m.breakfast !== 'sucre' && m.breakfast !== 'sale' && rest.some(r => t(r) !== t(a))) rest = rest.filter(r => t(r) !== t(a));
    // si la première se prépare à l'avance, la seconde se fait le matin même (elle couvre les jours au-delà du frigo)
    const restQuick = a.batch ? rest.filter(r => !r.batch) : rest;
    const b2 = weightedPick(restQuick.length ? restQuick : rest, r => caBreakfast(r) * (sharesWith(r, prefer) ? SHARE_BONUS : 1)) || a;
    used.push(a.id, b2.id);
    const out = days.map((_, k) => (k % 2 ? b2 : a));
    // au frigo : préparé le dimanche, un petit-déjeuner n'est mangé que tant qu'il se garde (lundi = 1 jour)
    out.forEach((x, k) => {
      if (!x.batch || k + 1 <= fridgeDays(x)) return;
      const other = x === a ? b2 : a;
      out[k] = !other.batch || k + 1 <= fridgeDays(other) ? other : (weightedPick(pool.filter(r => !r.batch)) || other);
    });
    return out;
  });
}

// ── Génère la semaine ──
// opts = { members: [{ id, targets, free, formula, breakfast, whey }], nextWeek, proteins: [familles] }
// Budget : on vise ~60 €. Une semaine tirée au-dessus de 70 € est simplement retirée
// (on ne choisit PAS la semaine « la mieux calibrée », sinon les mêmes plats reviennent toujours).
const COST_MAX = 70;
// Tour de rôle des plats : n = nombre de semaines générées, last[id] = semaine où le plat est sorti la dernière fois
const SERVED_KEY = 'hebe_served_mains';
const getServed = () => {
  try { const v = JSON.parse(localStorage.getItem(SERVED_KEY) || 'null'); if (v && typeof v.n === 'number' && v.last) return v; } catch {}
  return { n: 0, last: {} };
};

function generateWeek(opts = {}) {
  const served = getServed();
  // On retire au plus quelques tirages trop chers (> 70 €). Si aucun ne passe (protéines chères
  // sélectionnées), on garde le PREMIER tirage : surtout pas « le moins cher », qui ramènerait
  // toujours les mêmes plats.
  const costMax = (opts.members ? weekBudget() * 1.17 : COST_MAX) * (7 - Math.max(0, Math.min(6, opts.startFrom | 0))) / 7; // environ +15 % de marge, au prorata des jours planifiés
  const first = generateWeekOnce({ ...opts, served });
  let cand = first;
  for (let i = 0; i < 5 && cand.plan.cost > costMax; i++) cand = generateWeekOnce({ ...opts, served });
  if (cand.plan.cost > costMax) cand = first;
  // mémoire du tour de rôle : ces plats viennent de sortir
  served.n += 1;
  cand.mains.forEach(m => { served.last[m.id] = served.n; });
  localStorage.setItem(SERVED_KEY, JSON.stringify(served));
  localStorage.removeItem('hebe_recent_mains'); // ancienne mémoire (12 derniers plats)
  // collations préparées réellement servies cette semaine
  try {
    const sv = getServedSnacks(); sv.n += 1;
    Object.values(cand.entriesBy || {}).forEach(E => Object.values(E).forEach(e => (e?.meals?.sweet || []).forEach(it => { if (getById(it.id)?.category === 'sweet') sv.last[baseSnackId(it.id)] = sv.n; })));
    localStorage.setItem(SNK_KEY, JSON.stringify(sv));
  } catch {}
  // restes des produits qui se gardent 2 semaines (carrés frais, pains et wraps au congélateur) : reportés à la semaine suivante
  try {
    const tot = {};
    Object.values(cand.entriesBy || {}).forEach(E => Object.values(E).forEach(e => Object.values(e?.meals || {}).forEach(a => (a || []).forEach(it => {
      const r = getById(it.id); if (!r) return; const qs = itemQuantities(it);
      r.ingredients.forEach((i, ix) => { if (KEEP_2W.includes(i.key)) tot[i.key] = (tot[i.key] || 0) + qs[ix]; });
    }))));
    const left = {};
    Object.entries(tot).forEach(([k, t]) => { const P = INGREDIENTS[k]?.pack || INGREDIENTS[k]?.buy; if (P) { const l = Math.ceil(t / P - 1e-9) * P - t; if (l > 0.5) left[k] = Math.round(l); } });
    localStorage.setItem(LEFT_KEY, JSON.stringify(left));
  } catch {}
  saveWeekPlan(cand.plan);
  return cand;
}

// opts.members = [{ id, targets, free }] : un seul planning de plats pour tout le foyer,
// puis des portions calculées pour chaque personne (sans opts.members : la personne active seule).
// m.free = ['0-lunch', '3-dinner', …] : repas libres (non calculés) de la personne
function generateWeekOnce({ nextWeek = true, targets, proteins = null, served = { n: 0, last: {} }, members = null, startFrom = 0 } = {}) {
  targets = targets || { kcal: 2200, protein: 150, carbs: 230, fat: 70 };
  members = members && members.length ? members : [{ id: getActiveMember().id, targets, free: [] }];
  // v195 : semaine commencée en cours de route (startFrom = 1 à 6, 0 = lundi) : on cuisine aujourd'hui
  // et on ne planifie que les jours restants. Les indices de jour deviennent relatifs à la session
  // (fraîcheur, congélation, collations préparées), et les repas libres sont décalés d'autant.
  const skip = Math.max(0, Math.min(6, startFrom | 0));
  const dates = (nextWeek ? getNextWeekDates() : getWeekDates()).slice(skip);
  if (skip) members = members.map(m => ({ ...m, free: (m.free || []).map(k => k.split('-')).filter(([d]) => +d >= skip).map(([d, meal]) => `${+d - skip}-${meal}`) }));

  // Pool : plats complets, batchables, filtrés par les protéines choisies
  applyDiet(); // régime du foyer à jour (lactose)
  let pool = getMains().filter(r => r.batch && isAvailable(r) && dietOk(r, householdLactose(), householdGluten()));
  if (proteins && proteins.length) {
    const f = pool.filter(r => proteins.includes(proteinFamily(r)));
    if (f.length >= 4) pool = f;
  }
  // Petits besoins : on écarte les plats trop copieux même au minimum (pour le plus petit appétit du foyer)
  const shares = members.map(m => PLATE_SHARE[m.formula || 'jeune'] || 0.40);
  const pts = members.map((m, mi) => plateTarget(m.targets, shares[mi], proteinBoost(m.id)));
  const bts = members.map(m => breakfastTarget(m.targets));
  const scales = pts.map(pt => portionScale(pt.kcal));
  const ptMin = pts.reduce((x, y) => (x.kcal <= y.kcal ? x : y));
  const scaleMin = portionScale(ptMin.kcal);
  if (scaleMin < 1) {
    const light = pool.filter(r => plateFloor(r, scaleMin) <= ptMin.kcal * 1.1);
    if (light.length >= 8) pool = light;
  }
  const onlyFish = pool.every(isFreshFish);

  // une seule session de cuisine, le dimanche, pour toute la semaine
  const SESSIONS = [{ key: 'A', label: skip ? "Aujourd'hui" : 'Dimanche', days: dates.map((_, i) => i) }];

  const caches = members.map(() => ({})); // assiette calibrée par personne et par plat
  const calibrate = (mi, r) => (caches[mi][r.id] ||= calibratePlate(r, pts[mi]));
  // plats capables de remplir au moins 85 % de l'assiette de chacun (un wrap plafonne à 3 galettes pour les très gros profils ;
  // au-delà, les collations et compléments complètent)
  const fits = (r, mi) => {
    const key = `${r.id}|${r.macros.kcal}|${pts[mi].kcal}|${pts[mi].protein}`; // la recette change avec le régime et le riz
    if (!FITS.has(key)) FITS.set(key, calibrate(mi, r).macros.kcal >= 0.85 * pts[mi].kcal);
    return FITS.get(key);
  };
  const fitting = pool.filter(r => members.every((_, mi) => fits(r, mi)));
  if (fitting.length >= 12) pool = fitting;
  const isFree = (mi, dayIdx, meal) => (members[mi].free || []).includes(`${dayIdx}-${meal}`);
  // un repas ne sort du batch que s'il est libre pour tout le foyer
  const allFree = (dayIdx, meal) => members.every((_, mi) => isFree(mi, dayIdx, meal));

  const byMember = members.map(() => {
    const e = {};
    dates.forEach(d => e[d] = { date: d, meals: { breakfast: [], starter: [], lunch: [], dinner: [], sides: [], sweet: [] } });
    return e;
  });

  const chosen = [];
  const leftKeys = Object.keys(getLeftovers()).filter(k => getLeftovers()[k] > 0); // restes reportés de la semaine passée
  const sessions = [];
  SESSIONS.forEach((S, si) => {
    const slots = [];
    S.days.forEach((dayIdx, k) => {
      if (!allFree(dayIdx, 'lunch')) slots.push({ dayIdx, k, meal: 'lunch' });
      if (!allFree(dayIdx, 'dinner')) slots.push({ dayIdx, k, meal: 'dinner' });
    });
    const n = slots.length;
    if (!n) return;
    const nDays = S.days.length;
    // jours (pas repas : un plat ne revient pas midi et soir le même jour) cuisinés parmi les 3 premiers, et parmi les 2 premiers
    const early = new Set(slots.filter(sl => sl.dayIdx < FRIDGE_DAYS).map(sl => sl.dayIdx)).size;
    const fishEarly = new Set(slots.filter(sl => sl.dayIdx < 2).map(sl => sl.dayIdx)).size;
    const earlyMeals = slots.filter(sl => sl.dayIdx < FRIDGE_DAYS).length;
    // environ 3 à 4 portions par plat : 4 plats pour une semaine complète
    let plats = [], counts = null, placed = null;
    for (let attempt = 0; attempt < 24 && !placed; attempt++) {
      let k = Math.max(n >= 3 ? 2 : 1, Math.ceil(n / 4));
      plats = [];
      counts = null;
      for (let guard = 0; guard < 6; guard++) {
        while (plats.length < k) {
          const p = pickMain(pool, [...chosen, ...plats], { allowFish: attempt < 20, served, earlySlots: early, fishSlots: fishEarly, extraKeys: leftKeys }); // derniers essais sans poisson frais, plus facile à placer
          if (!p) break;
          plats.push(p);
        }
        counts = allocate(n, plats, nDays, attempt < 16 ? 2 : attempt < 22 ? 1 : 0, early, fishEarly, earlyMeals); // derniers essais moins exigeants, pour toujours trouver une semaine
        if (counts) break;
        // les premiers essais gardent le nombre de plats habituel (≈ 4 portions chacun) et tirent d'autres plats ;
        // un plat de plus seulement ensuite : moins de plats à cuisiner le dimanche
        if (attempt < 8 && plats.length >= Math.ceil(n / 4)) break;
        k++;
      }
      if (!counts) continue;
      const tryPlaced = schedule(slots, plats, counts);
      // chaque plat reste dans sa fenêtre de fraîcheur
      // … et, dans les premiers essais, jamais le même plat midi et soir le même jour (sinon on tire d'autres plats)
      const twice = tryPlaced.some(a => tryPlaced.some(b => b !== a && b.slot.dayIdx === a.slot.dayIdx && b.plat.id === a.plat.id));
      if (tryPlaced.every(({ slot, plat }) => slot.dayIdx <= deadlineOf(plat)) && (!twice || attempt >= 16)) placed = tryPlaced;
    }
    if (!placed) return;
    chosen.push(...plats);
    const boxes = {}; // nombre de boîtes réellement mangées par plat (toutes personnes confondues)
    placed.forEach(({ slot, plat }) => {
      const date = dates[slot.dayIdx];
      members.forEach((_, mi) => {
        if (isFree(mi, slot.dayIdx, slot.meal)) return;
        const res = calibrate(mi, plat);
        const e = byMember[mi][date];
        const item = { id: plat.id, servings: 1, overrides: { ...res.main.overrides } };
        if (goesToFreezer(plat, slot.dayIdx)) item.frozen = true;
        e.meals[slot.meal].push(item);
        if (res.side) e.meals.sides.push({ id: res.side.id, servings: 1, overrides: { ...res.side.overrides }, with: slot.meal });
        boxes[plat.id] = (boxes[plat.id] || 0) + 1;
      });
    });
    sessions.push({
      key: S.key, label: S.label,
      dates: S.days.map(i => dates[i]),
      recipes: plats.map(p => ({ id: p.id, portions: boxes[p.id] || 0, side: calibrate(0, p).side?.id || null })).filter(x => x.portions > 0),
    });
  });

  // Petits-déjeuners de la formule classique : même recette pour le foyer, portion de chacun
  const bCaches = members.map(() => ({}));
  if (members.some(m => m.formula === 'classique')) {
    const preferB = new Set([...shareKeysOf(chosen), ...leftKeys]);
    const picks = members.map(m => (m.formula === 'classique' ? pickBreakfasts(m, SESSIONS.map(S => S.days), preferB) : null));
    SESSIONS.forEach((S, si) => {
      const count = {};
      S.days.forEach((dayIdx, k) => {
        members.forEach((m, mi) => {
          if (m.formula !== 'classique') return;
          let r = picks[mi][si][k];
          if (!r) return;
          let res = (bCaches[mi][r.id] ||= optimizeRecipe(r, bts[mi], 'B', scales[mi]));
          // charcuterie : au-delà du plafond de la semaine, un autre petit-déjeuner
          const item = { id: r.id, servings: 1, overrides: { ...res.overrides } };
          if (charcGrams(item) && charcLeft(dates, d => byMember[mi][d], null) < charcGrams(item)) {
            const alt = breakfastNoCharc(m, r);
            if (alt) { r = alt; res = (bCaches[mi][r.id] ||= optimizeRecipe(r, bts[mi], 'B', scales[mi])); }
          }
          byMember[mi][dates[dayIdx]].meals.breakfast.push({ id: r.id, servings: 1, overrides: { ...res.overrides } });
          count[r.id] = (count[r.id] || 0) + 1;
        });
      });
      const sess = sessions.find(x => x.key === S.key);
      if (sess) sess.breakfasts = Object.entries(count).map(([id, portions]) => ({ id, portions, batch: !!getById(id)?.batch }));
    });
  }

  // Totaux achetables : viandes et poissons sur des barquettes entières, pour tout le foyer
  snapToPacks(byMember, dates, scales, pts, bts);
  // produits frais des repas en paquets entiers, avant les collations (qui compenseront les calories)
  snapFresh(byMember.flatMap(entries => dates.map(d => entries[d])), () => false, 'repas');

  // Repas libres, puis collations recalées chaque jour sur ce qu'il manque à chacun
  // collations : favorise celles qui partagent un produit des plats ou petits-déjeuners de la semaine (ou un reste reporté)
  const usedRecs = byMember.flatMap(entries => dates.flatMap(d => ['breakfast', 'lunch', 'dinner'].flatMap(sl => (entries[d].meals[sl] || []).map(it => getById(it.id))))).filter(Boolean);
  const preferS = new Set([...shareKeysOf(usedRecs), ...leftKeys]);
  // place habituelle pour une collation : la médiane de ce qu'il reste après repas et petit-déjeuner (jours sans repas libre)
  const roomOf = (m, mi) => {
    const v = dates.filter((d, i) => !(m.free || []).some(k => k.startsWith(i + '-')))
      .map(d => m.targets.kcal - computeDayTotals(byMember[mi][d]).kcal).sort((a, b) => a - b);
    return v.length ? v[Math.floor(v.length / 2)] : Infinity;
  };
  const boughtKeys = new Set(usedRecs.flatMap(r => r.ingredients.map(i => i.key)));
  const snackBy = members.map((m, mi) => pickSnacks(m.whey !== false, lactoseOf(m.id), glutenOf(m.id), preferS, roomOf(m, mi), boughtKeys));
  const batchDaysBy = {};
  members.forEach((m, mi) => {
    // repas libres : part de la journée réservée (par tranches de 100 kcal), rien à cuisiner ni à acheter
    (m.free || []).forEach(key => {
      const [d, meal] = key.split('-');
      // calories réservées : choisies par la personne, sinon la part habituelle d'un plat
      const kcal = m.freeKcal || pts[mi].kcal;
      if (dates[+d]) byMember[mi][dates[+d]].meals[meal].push({ id: 'L01', servings: 1, overrides: { 0: Math.round(kcal / 100) } });
    });
    // v198 : chaque collation préparée doit servir au moins 3 fois (sinon on ne la cuisine pas pour 1 ou 2 portions)
    const E = byMember[mi];
    const refill = (dayIdx, P) => {
      const e = E[dates[dayIdx]];
      e.meals.sweet = []; e.meals.sides = (e.meals.sides || []).filter(sd => sd.with);
      fillDay(e, dayIdx, snackBy[mi], m.targets, lactoseOf(m.id), glutenOf(m.id), charcLeft(dates, x => E[x], e), weekUseOf(dates, x => E[x], e), P[dayIdx]);
    };
    const servedOn = id => dates.map((d, i) => (E[d].meals.sweet || []).some(it => it.id === id) ? i : -1).filter(i => i >= 0);
    let P = batchPattern(snackBy[mi].filter(id => getById(id)?.batch), dates.length);
    dates.forEach((d, dayIdx) => refill(dayIdx, P));
    // (plusieurs passes : retirer une préparée refait toute la semaine, ce qui peut changer le compte des autres)
    for (let pass = 0; pass < 3; pass++) for (const id of snackBy[mi].filter(x => getById(x)?.batch)) {
      // pas assez de portions : on la propose d'autres jours (à la place d'une collation rapide)
      for (let d = 0; d < dates.length && servedOn(id).length < 3; d++) {
        if (P[d] || (E[dates[d]].meals.sweet || []).some(it => getById(it.id)?.batch)) continue;
        P[d] = id; refill(d, P);
        if (!servedOn(id).includes(d)) { P[d] = null; refill(d, P); }
      }
      // toujours moins de 3 : on ne la cuisine pas cette semaine
      if (servedOn(id).length < 3) {
        snackBy[mi] = snackBy[mi].filter(x => x !== id);
        P = P.map(x => (x === id ? null : x));
        dates.forEach((d, dayIdx) => refill(dayIdx, P));
      }
    }
    batchDaysBy[m.id] = P;
  });
  // produits frais consommés en entier ; un complément de reste ne va qu'à qui son régime l'autorise
  const owner = new Map(byMember.flatMap((entries, mi) => dates.map(d => [entries[d], members[mi].id])));
  snapFresh(byMember.flatMap(entries => dates.map(d => entries[d])),
    (e, fid) => { const mid = owner.get(e); return !!getById(fid) && dietOk(getById(fid), lactoseOf(mid), glutenOf(mid)); }, 'collations');
  // finir les paquets ajoute des calories : une journée qui dépasse sa cible de plus de 3 % perd un complément sans produit frais
  members.forEach((m, mi) => dates.forEach(d => trimOver(byMember[mi][d], m.targets)));

  // Coût estimé de la semaine (ce qui est réellement mangé, hors repas libres et placard)
  let cost = 0;
  byMember.forEach(entries => dates.forEach(d => ['breakfast', 'starter', 'lunch', 'dinner', 'sides', 'sweet'].forEach(s =>
    (entries[d].meals[s] || []).forEach(it => cost += itemCost(it)))));

  const ids = members.map(m => m.id);
  const plan = {
    start: dates[0], dates, sessions, startFrom: skip, batchDaysBy, snacks: snackBy[0], snacksBy: Object.fromEntries(members.map((m, mi) => [m.id, snackBy[mi]])),
    targets: members[0].targets, targetsBy: Object.fromEntries(members.map(m => [m.id, m.targets])), members: ids,
    formulaBy: Object.fromEntries(members.map(m => [m.id, m.formula || 'jeune'])),
    prefsBy: Object.fromEntries(members.map(m => [m.id, { breakfast: m.breakfast || 'mix', whey: m.whey !== false }])),
    lactoseBy: Object.fromEntries(members.map(m => [m.id, lactoseOf(m.id)])),
    glutenBy: Object.fromEntries(members.map(m => [m.id, glutenOf(m.id)])),
    cost: Math.round(cost), generatedAt: Date.now(),
    // fibres, sel, vitamines et minéraux : moyenne par jour, calculée mais pas encore affichée
    microsBy: Object.fromEntries(members.map((m, mi) => [m.id, weekMicros(byMember[mi], dates)])),
  };
  const entriesBy = Object.fromEntries(ids.map((id, mi) => [id, byMember[mi]]));
  return { dates, entries: byMember[0], entriesBy, plan, mains: chosen };
}

// ── Formats du commerce ──
// Pour chaque ingrédient « snap » (viandes, poissons, tofu), on additionne ce que la semaine utilise,
// on vise le multiple de barquette le plus proche, et on applique le même facteur à toutes les portions.
// Contrainte : chaque portion reste dans sa fourchette réaliste (tolérance de 10 % vers le bas uniquement).
// Les collations, ajoutées ensuite, rattrapent les calories d'écart.
// entries peut être une liste (une par personne du foyer), avec une liste de facteurs de portion.
// Toute la viande achetée est utilisée : le total tombe toujours sur des barquettes entières
// (formats de data/ingredients.js → packs). Si plateTargets est fourni, le reste de chaque assiette
// modifiée (féculent, protéine secondaire) est ensuite recalculé pour rester dans la cible.
// base = { ingrédient: grammes } déjà consommés les jours passés (recalcul en cours de semaine)
function snapToPacks(entries, dates, scale = 1, plateTargets = null, breakfastTargets = null, base = null) {
  const lists = Array.isArray(entries) ? entries : [entries];
  const scales = Array.isArray(scale) ? scale : lists.map(() => scale);
  const uses = {}; // key → [{ item, idx, qty, sc, main, li, entry, slot }]
  lists.forEach((ent, li) => dates.forEach(d => ['breakfast', 'lunch', 'dinner'].forEach(slot => (ent[d].meals[slot] || []).forEach(item => {
    const r = getById(item.id);
    if (!r || (r.tags || []).includes('cantine')) return;
    const qs = itemQuantities(item);
    const mp = mainProteinIdx(r);
    r.ingredients.forEach((ing, idx) => {
      const db = INGREDIENTS[ing.key];
      if (db && db.snap && qs[idx] > 0) (uses[ing.key] ||= []).push({ item, idx, qty: qs[idx], sc: scales[li] ?? 1, main: idx === mp, li, entry: ent[d], slot });
    });
  }))));
  const report = {};
  const touched = new Set();
  Object.entries(uses).forEach(([key, list]) => {
    const db = INGREDIENTS[key];
    const unit = Math.min(...(db.packs || [db.pack]));
    const total = list.reduce((a, u) => a + u.qty, 0);
    const done = base?.[key] || 0;
    // bornes d'une portion : protéine principale dans sa fourchette réaliste,
    // petite quantité d'appoint (bœuf d'un mapo tofu) entre -15 % et +80 %
    const lo = u => (u.main ? Math.min((db.min || 0) * u.sc * 0.9, u.qty) : u.qty * 0.85);
    const hi = u => (u.main ? Math.max(db.max || Infinity, u.qty) : u.qty * 1.8);
    let best = null;
    const jMax = Math.ceil((total + done) / unit) + 4;
    for (let j = 1; j <= jMax; j++) {
      const target = j * unit;
      if (target <= done) continue;
      const f = (target - done) / total;
      if (!list.every(u => u.qty * f >= lo(u) - 1e-6 && u.qty * f <= hi(u) + 1e-6)) continue;
      // on préfère arrondir vers le haut (on mange toute la barquette), un peu moins vers le bas
      const need = total + done;
      const dist = target >= need ? target - need : (need - target) * 1.6;
      if (!best || dist < best.dist) best = { target, f, dist };
    }
    if (!best) { report[key] = { total, target: null }; return; }
    list.forEach(u => {
      if (!u.item.overrides) u.item.overrides = {};
      // quantité exacte (non arrondie) : le total de la semaine tombe pile sur les barquettes
      u.item.overrides[u.idx] = Math.round(u.qty * best.f * 10) / 10;
      if (Math.abs(best.f - 1) > 0.03) touched.add(u);
    });
    report[key] = { total, target: best.target };
  });
  // le reste de l'assiette s'ajuste autour de la viande calée
  if (plateTargets) {
    const seen = new Set();
    touched.forEach(u => {
      if (seen.has(u.item)) return;
      seen.add(u.item);
      const r = getById(u.item.id);
      const fixed = {};
      r.ingredients.forEach((ing, i) => { if (INGREDIENTS[ing.key]?.snap) fixed[i] = u.item.overrides[i] ?? ing.qty; });
      const isB = u.slot === 'breakfast';
      const pt = isB ? breakfastTargets?.[u.li] : plateTargets[u.li];
      if (!pt) return;
      const side = isB ? null : (u.entry.meals.sides || []).find(sd => sd.with === u.slot);
      const rest = { ...pt };
      if (side) { const sm = computeMealMacros(side); Object.keys(rest).forEach(k => rest[k] = Math.max(0, rest[k] - sm[k])); }
      const res = optimizeRecipe(r, rest, isB ? 'B' : 'P', scales[u.li] ?? 1, fixed);
      u.item.overrides = { ...res.overrides };
    });
  }
  return report;
}

// Collations et compléments d'une journée, recalés sur ce qu'il manque après les plats
// v198 : jours des collations préparées. 1 préparée : lun, mer, ven, dim ; 2 : A lun/jeu/dim, B mar/ven/sam (3 portions chacune au moins)
function batchPattern(batchIds, n) {
  const out = Array(n).fill(null);
  if (batchIds.length === 1) for (let d = 0; d < n; d += 2) out[d] = batchIds[0];
  else if (batchIds.length >= 2) { const pat = ['A', 'B', null, 'A', 'B', 'B', 'A']; for (let d = 0; d < n; d++) { const k = pat[d % 7]; if (k) out[d] = batchIds[k === 'A' ? 0 : 1]; } }
  return out;
}
// batchDay : undefined = jours habituels ; null = pas de collation préparée ce jour-là ; id = celle-ci
function fillDay(e, dayIdx, snackIds, targets, lac = 0, glu = 0, charcBudget = CHARC_MAX, weekUse = {}, batchDay = undefined) {
  // ignore les recettes supprimées depuis la génération du plan, ou exclues par le régime
  snackIds = snackIds.filter(id => getById(id) && !getById(id).retired && dietOk(getById(id), lac, glu) && getRating(id) >= 0);
  if (!snackIds.length) snackIds = pickSnacks(true, lac, glu);
  const used = computeDayTotals(e);
  const rem = subtractMacros(targets, used);
  // pas de thon / d'œufs en collation si le plat du jour en contient déjà
  const dayKeys = new Set(['breakfast', 'lunch', 'dinner'].flatMap(s => e.meals[s] || []).flatMap(it => getById(it.id)?.ingredients.map(i => i.key) || []));
  const clash = id => (getById(id)?.ingredients || []).some(i => ['thon', 'oeuf'].includes(i.key) && dayKeys.has(i.key));
  // v195 : les collations préparées le dimanche ont leurs jours réservés (avant, elles perdaient souvent
  // face aux collations rapides et n'étaient jamais servies, surtout sans whey).
  //   1 préparée  : lundi, mercredi, vendredi, dimanche ; collations rapides les autres jours
  //   2 préparées : lun A, mar B, jeu A, ven B, dim A ; collations rapides mercredi et samedi
  const batchIds = snackIds.filter(id => getById(id)?.batch);
  const quickIds = snackIds.filter(id => !getById(id)?.batch);
  const quickRot = quickIds.map((_, i) => quickIds[(i + dayIdx) % quickIds.length]);
  const qOrdered = [...quickRot.filter(id => !clash(id)), ...quickRot.filter(clash)];
  let todayBatch = batchDay !== undefined ? (batchDay && batchIds.includes(batchDay) ? batchDay : null) : batchPattern(batchIds, 7)[dayIdx % 7];
  // trop copieuse pour ce qu'il reste à manger ce jour-là : collation rapide à la place (la préparée n'est pas cuisinée pour ce jour)
  if (todayBatch) {
    const rem0 = subtractMacros(targets, computeDayTotals(e));
    const k = optimizeRecipe(getById(todayBatch), { ...rem0, kcal: Math.min(650, rem0.kcal) }, 'S', portionScale(plateTarget(targets).kcal)).macros.kcal;
    if (k > rem0.kcal * 1.06 + 20) todayBatch = null;
  }
  let rot;
  if (todayBatch) rot = [todayBatch, todayBatch, ...qOrdered];
  else if (qOrdered.length) rot = [...qOrdered, ...batchIds];
  else { rot = snackIds.map((_, i) => snackIds[(i + dayIdx) % snackIds.length]); rot = [...rot.filter(id => !clash(id)), ...rot.filter(clash)]; }
  // compléments sans préparation : les 2 tartines carré frais d'abord (elles alternent), puis les autres
  const okFill = id => { const r = getById(id); return r && !r.retired && dietOk(r, lac, glu) && getRating(id) >= 0; };
  const TARTINES = (dayIdx % 2 ? ['S11', 'S12'] : ['S12', 'S11']).filter(okFill);
  // poignée d'amandes et fruit de saison d'abord : ce sont eux qui complètent la journée en priorité
  const OTHERS = ['S07', 'S05', 'S08', 'S09', 'S16'].filter(okFill);
  const fillers = [...TARTINES, ...OTHERS];
  fillRemainder(rem, rot, fillers, portionScale(plateTarget(targets).kcal), dayKeys, Math.max(0, charcBudget), weekUse).forEach(f => e.meals[f.slot].push(f.item));
}

// ── Remplacer un plat de la semaine ──
// Tire un autre plat (même protéine si possible), recalcule ses portions, l'applique à toutes
// ses portions de la session, puis recale barquettes et collations. Renvoie le nouveau plat ou null.
// v195 : 3 propositions au choix pour « Changer »
function replaceOptions(oldId, n = 3) {
  const pool = replacePool(oldId);
  if (!pool || !pool.length) return [];
  const left = [...pool], out = [];
  while (out.length < n && left.length) {
    const w = left.map(r => getRating(r.id) > 0 ? 2.2 : 1);
    let x = Math.random() * w.reduce((a, b) => a + b, 0), k = left.length - 1;
    for (let i = 0; i < left.length; i++) { x -= w[i]; if (x <= 0) { k = i; break; } }
    out.push(left.splice(k, 1)[0]);
  }
  return out;
}
function replacePool(oldId) {
  const plan = getActivePlan();
  if (!plan) return null;
  const old = getById(oldId);
  const sess = plan.sessions.find(s => s.recipes.some(r => r.id === oldId));
  if (!old || !sess) return null;
  const inPlan = new Set(plan.sessions.flatMap(s => s.recipes.map(r => r.id)));
  const sessIdx = plan.sessions.indexOf(sess);
  const fishOk = sessIdx === 0 && !plan.sessions.some(s => s.recipes.some(r => r.id !== oldId && isFreshFish(getById(r.id))));
  let pool = getMains().filter(r => r.batch && isAvailable(r) && dietOk(r, householdLactose(), householdGluten()) && !inPlan.has(r.id) && getRating(r.id) >= 0 && (fishOk || !isFreshFish(r)));
  const mids = planMembers(plan);
  const ptOf = mid => plateTarget(planTargets(plan, mid), planShare(plan, mid), proteinBoost(mid));
  const ptMin = mids.map(ptOf).reduce((x, y) => (x.kcal <= y.kcal ? x : y));
  const sc = portionScale(ptMin.kcal);
  if (sc < 1) {
    const light = pool.filter(r => plateFloor(r, sc) <= ptMin.kcal * 1.1);
    if (light.length) pool = light;
  }
  // le remplaçant doit tenir jusqu'au dernier jour où l'ancien plat est mangé
  const lastDay = Math.max(...plan.dates.map((d, i) => (planMembers(plan).some(mid => ['lunch', 'dinner'].some(m => (getEntry(d, mid).meals[m] || []).some(it => it.id === oldId))) ? i : -1)));
  pool = pool.filter(r => deadlineOf(r) >= lastDay);
  const otherRed = plan.sessions.flatMap(s => s.recipes).filter(x => x.id !== oldId && getById(x.id) && isRedMeat(getById(x.id))).length;
  if (otherRed >= RED_MEAT_DISHES && pool.some(r => !isRedMeat(r))) pool = pool.filter(r => !isRedMeat(r));
  // glucides variés : pas de 3e plat de la même famille de féculents
  const others = plan.sessions.flatMap(s => s.recipes.map(x => getById(x.id))).filter(r => r && r.id !== oldId);
  const okStarch = pool.filter(r => others.filter(o => starchFamily(o) === starchFamily(r)).length < STARCH_MAX);
  if (okStarch.length) pool = okStarch;
  const same = pool.filter(r => proteinFamily(r) === proteinFamily(old));
  if (same.length) pool = same;
  return pool;
}
function replaceDish(oldId, chosenId = null) {
  const plan = getActivePlan();
  if (!plan) return null;
  const old = getById(oldId);
  const sess = plan.sessions.find(s => s.recipes.some(r => r.id === oldId));
  if (!old || !sess) return null;
  const mids = planMembers(plan);
  const ptOf = mid => plateTarget(planTargets(plan, mid), planShare(plan, mid), proteinBoost(mid));
  const pool = replacePool(oldId);
  if (!pool || !pool.length) return null;
  let next = chosenId && pool.find(r => r.id === chosenId);
  if (!next) {
    const weights = pool.map(r => getRating(r.id) > 0 ? 2.2 : 1);
    let x = Math.random() * weights.reduce((a, b) => a + b, 0); next = pool[pool.length - 1];
    for (let k = 0; k < pool.length; k++) { x -= weights[k]; if (x <= 0) { next = pool[k]; break; } }
  }

  // même plat pour tout le foyer, portions recalculées pour chacun
  const cals = mids.map(mid => calibratePlate(next, ptOf(mid)));
  const all = mids.map((mid, mi) => {
    const entries = {};
    plan.dates.forEach(d => {
      const e = getEntry(d, mid);
      ['lunch', 'dinner'].forEach(meal => {
        const list = e.meals[meal] || [];
        if (!list.some(it => it.id === oldId)) return;
        e.meals[meal] = list.map(it => it.id === oldId ? { id: next.id, servings: 1, overrides: { ...cals[mi].main.overrides }, ...(goesToFreezer(next, plan.dates.indexOf(d)) ? { frozen: true } : {}) } : it);
        e.meals.sides = (e.meals.sides || []).filter(sd => sd.with !== meal);
        if (cals[mi].side) e.meals.sides.push({ id: cals[mi].side.id, servings: 1, overrides: { ...cals[mi].side.overrides }, with: meal });
      });
      entries[d] = e;
    });
    return entries;
  });
  // barquettes entières pour le foyer, puis collations recalées jour par jour
  snapToPacks(all, plan.dates, mids.map(mid => portionScale(ptOf(mid).kcal)), mids.map(ptOf), mids.map(mid => breakfastTarget(planTargets(plan, mid))));
  mids.forEach((mid, mi) => plan.dates.forEach((d, dayIdx) => {
    const e = all[mi][d];
    e.meals.sweet = [];
    e.meals.sides = (e.meals.sides || []).filter(sd => sd.with);
    fillDay(e, dayIdx, planSnacks(plan, mid), planTargets(plan, mid), lactoseOf(mid), glutenOf(mid),
      charcLeft(plan.dates, x => all[mi][x] || getEntry(x, mid), e), weekUseOf(plan.dates, x => all[mi][x] || getEntry(x, mid), e), plan.batchDaysBy?.[mid]?.[dayIdx]);
    saveEntry(e, mid);
  }));
  const cal = cals[0];
  sess.recipes = sess.recipes.map(r => r.id === oldId ? { id: next.id, portions: r.portions, side: cal.side?.id || null } : r);
  plan.generatedAt = Date.now(); // nouvelle liste de courses et nouvelle session à cocher
  saveWeekPlan(plan);
  return next;
}

// ── Besoins modifiés en cours de semaine ──
// Garde les mêmes plats et recalcule les portions de chacun à partir d'aujourd'hui
// (nouveaux objectifs), puis recale barquettes et collations. targetsBy = { idPersonne: objectifs }.
function recalcPortions(targetsBy) {
  const plan = getActivePlan();
  if (!plan) return false;
  const today = getTodayDate();
  const from = Math.max(0, plan.dates.findIndex(d => d >= today));
  const dates = plan.dates.slice(from);
  const mids = planMembers(plan);
  plan.targetsBy = { ...(plan.targetsBy || {}), ...targetsBy };
  const pts = mids.map(mid => plateTarget(planTargets(plan, mid), planShare(plan, mid), proteinBoost(mid)));
  const bts = mids.map(mid => breakfastTarget(planTargets(plan, mid)));
  const scales = pts.map(pt => portionScale(pt.kcal));
  const all = mids.map((mid, mi) => {
    const cache = {}, bcache = {};
    const entries = {};
    dates.forEach(d => {
      const e = getEntry(d, mid);
      ['lunch', 'dinner'].forEach(meal => {
        const list = e.meals[meal] || [];
        const main = list[0] && getById(list[0].id);
        if (!main || (main.tags || []).includes('cantine') || (main.tags || []).includes('imprevu')) return;
        const cal = (cache[main.id] ||= calibratePlate(main, pts[mi]));
        e.meals[meal] = [{ id: main.id, servings: 1, overrides: { ...cal.main.overrides }, ...(list[0].frozen ? { frozen: true } : {}) }, ...list.slice(1)];
        e.meals.sides = (e.meals.sides || []).filter(sd => sd.with !== meal);
        if (cal.side) e.meals.sides.push({ id: cal.side.id, servings: 1, overrides: { ...cal.side.overrides }, with: meal });
      });
      e.meals.breakfast = (e.meals.breakfast || []).map(it => {
        const r = getById(it.id);
        if (!r) return it;
        const res = (bcache[r.id] ||= optimizeRecipe(r, bts[mi], 'B', scales[mi]));
        return { id: r.id, servings: 1, overrides: { ...res.overrides } };
      });
      entries[d] = e;
    });
    return entries;
  });
  // viande déjà mangée les jours passés : elle compte dans les barquettes achetées
  const base = {};
  mids.forEach(mid => plan.dates.slice(0, from).forEach(d => ['breakfast', 'lunch', 'dinner'].forEach(slot => (getEntry(d, mid).meals[slot] || []).forEach(it => {
    const r = getById(it.id);
    if (!r || (r.tags || []).includes('cantine')) return;
    const qs = itemQuantities(it);
    r.ingredients.forEach((ing, i) => { if (INGREDIENTS[ing.key]?.snap) base[ing.key] = (base[ing.key] || 0) + qs[i]; });
  }))));
  snapToPacks(all, dates, scales, pts, bts, base);
  // collations recalées sur les nouveaux objectifs (sans reporter les jours passés, mangés avec les anciens)
  mids.forEach((mid, mi) => dates.forEach((d, k) => {
    const e = all[mi][d];
    e.meals.sweet = [];
    e.meals.sides = (e.meals.sides || []).filter(sd => sd.with);
    fillDay(e, from + k, planSnacks(plan, mid), planTargets(plan, mid), lactoseOf(mid), glutenOf(mid),
      charcLeft(plan.dates, x => all[mi][x] || getEntry(x, mid), e), weekUseOf(plan.dates, x => all[mi][x] || getEntry(x, mid), e), plan.batchDaysBy?.[mid]?.[from + k]);
    saveEntry(e, mid);
  }));
  saveWeekPlan(plan);
  return true;
}

// ── Préférences modifiées en cours de semaine (petit-déjeuner, whey) ──
// Les plats du midi et du soir ne bougent pas : on remplace seulement les petits-déjeuners
// et les collations à partir d'aujourd'hui. prefsBy = { idPersonne: { breakfast, whey } }.
function refreshExtras(prefsBy) {
  const plan = getActivePlan();
  if (!plan) return false;
  const today = getTodayDate();
  const from = Math.max(0, plan.dates.findIndex(d => d >= today));
  plan.prefsBy = { ...(plan.prefsBy || {}) };
  plan.snacksBy = { ...(plan.snacksBy || {}) };
  Object.entries(prefsBy).forEach(([mid, pr]) => {
    plan.prefsBy[mid] = { breakfast: pr.breakfast || 'mix', whey: pr.whey !== false };
    plan.snacksBy[mid] = pickSnacks(pr.whey !== false, lactoseOf(mid), glutenOf(mid));
    if (plan.batchDaysBy) delete plan.batchDaysBy[mid]; // nouvelles collations : jours habituels
    const T = planTargets(plan, mid);
    const bt = breakfastTarget(T);
    const sc = portionScale(plateTarget(T, planShare(plan, mid)).kcal);
    const classic = (plan.formulaBy?.[mid] || 'jeune') === 'classique';
    // nouveaux petits-déjeuners, session par session, pour les jours restants
    const picks = classic ? pickBreakfasts({ ...pr, whey: pr.whey !== false }, plan.sessions.map(S => S.dates)) : null;
    const cache = {};
    plan.dates.slice(from).forEach((d, k) => {
      const e = getEntry(d, mid);
      if (classic) {
        const si = plan.sessions.findIndex(S => S.dates.includes(d));
        let r = si >= 0 ? picks[si][plan.sessions[si].dates.indexOf(d)] : null;
        e.meals.breakfast = [];
        e.meals.sweet = [];
        e.meals.sides = (e.meals.sides || []).filter(sd => sd.with);
        if (r) {
          const it = () => ({ id: r.id, servings: 1, overrides: { ...(cache[r.id] ||= optimizeRecipe(r, bt, 'B', sc)).overrides } });
          if (charcGrams(it()) > charcLeft(plan.dates, x => getEntry(x, mid), e)) r = breakfastNoCharc({ ...pr, id: mid, whey: pr.whey !== false }, r) || r;
          e.meals.breakfast = [it()];
        }
      }
      e.meals.sweet = [];
      e.meals.sides = (e.meals.sides || []).filter(sd => sd.with);
      fillDay(e, from + k, plan.snacksBy[mid], T, lactoseOf(mid), glutenOf(mid), charcLeft(plan.dates, x => getEntry(x, mid), e), weekUseOf(plan.dates, x => getEntry(x, mid), e), plan.batchDaysBy?.[mid]?.[from + k]);
      saveEntry(e, mid);
    });
  });
  // petits-déjeuners à préparer dans chaque session, recomptés pour tout le foyer
  plan.sessions.forEach(S => {
    const count = {};
    planMembers(plan).forEach(mid => S.dates.forEach(d => (getEntry(d, mid).meals.breakfast || []).forEach(it => { count[it.id] = (count[it.id] || 0) + 1; })));
    S.breakfasts = Object.entries(count).map(([id, portions]) => ({ id, portions, batch: !!getById(id)?.batch }));
  });
  saveWeekPlan(plan);
  return true;
}

// ── Imprévu : repas pris dehors ──
// Le plat prévu est remplacé par une estimation (léger / normal / copieux). Les collations du jour
// se recalent ; ce qui dépasse encore est réparti sur les 2 jours suivants en allégeant les
// collations (les plats et les protéines ne bougent pas).
const OUTSIDE_LEVELS = {
  light:  { q: 2,   label: 'Léger',   kcal: 600 },
  normal: { q: 3,   label: 'Normal',  kcal: 900 },
  big:    { q: 4.5, label: 'Copieux', kcal: 1350 },
};

function logOutsideMeal(date, meal, level) {
  const plan = getActivePlan();
  const dayIdx = plan ? plan.dates.indexOf(date) : -1;
  if (dayIdx < 0 || !OUTSIDE_LEVELS[level]) return null;
  const e = getEntry(date);
  e.outside = e.outside || {};
  if (!e.outside[meal]) {
    e.outside[meal] = {
      items: e.meals[meal] || [],
      sides: (e.meals.sides || []).filter(sd => sd.with === meal),
    };
  }
  e.outside[meal].level = level;
  e.meals[meal] = [{ id: 'X01', servings: 1, overrides: { 0: OUTSIDE_LEVELS[level].q } }];
  e.meals.sides = (e.meals.sides || []).filter(sd => sd.with !== meal);
  saveEntry(e);
  rebalanceFrom(plan, dayIdx, getActiveMember().id);
  const skipped = getById(e.outside[meal].items[0]?.id);
  return { skipped: skipped && !(skipped.tags || []).includes('imprevu') ? skipped : null };
}

function undoOutsideMeal(date, meal) {
  const plan = getActivePlan();
  const dayIdx = plan ? plan.dates.indexOf(date) : -1;
  const e = getEntry(date);
  if (dayIdx < 0 || !e.outside?.[meal]) return false;
  const prev = e.outside[meal];
  e.meals[meal] = prev.items;
  e.meals.sides = [...(e.meals.sides || []).filter(sd => sd.with !== meal), ...prev.sides];
  delete e.outside[meal];
  saveEntry(e);
  rebalanceFrom(plan, dayIdx, getActiveMember().id);
  return true;
}

// Après un changement de recette (ingrédient ajouté ou retiré) : recale les collations
// de la semaine en cours, à partir d'aujourd'hui. Renvoie le nombre de jours concernés.
function rebalanceAfterRecipeChange(recipeId) {
  const plan = getActivePlan();
  if (!plan) return 0;
  const today = getTodayDate();
  let from = plan.dates.findIndex(d => d >= today);
  if (from < 0) return 0;
  const touched = plan.dates.slice(from).filter(d => ['lunch', 'dinner'].some(m => (getEntry(d).meals[m] || []).some(it => it.id === recipeId))).length;
  if (!touched) return 0;
  planMembers(plan).forEach(mid => rebalanceFrom(plan, from, mid));
  return touched;
}

// Recalcule collations et compléments à partir d'un jour, en reportant les dépassements
function rebalanceFrom(plan, fromIdx, mid) {
  const T = planTargets(plan, mid); // objectifs de la semaine générée
  const snacks = planSnacks(plan, mid);
  const debt = plan.dates.map(() => 0);
  const spill = (i, over) => {
    if (over <= 80) return;
    const next = [i + 1, i + 2].filter(k => k < plan.dates.length);
    next.forEach(k => { debt[k] += over / next.length; });
  };
  // dépassements des 2 jours précédents, déjà figés
  for (let i = Math.max(0, fromIdx - 2); i < fromIdx; i++) {
    spill(i, computeDayTotals(getEntry(plan.dates[i], mid)).kcal - T.kcal);
  }
  for (let i = fromIdx; i < plan.dates.length; i++) {
    const e = getEntry(plan.dates[i], mid);
    e.meals.sweet = [];
    e.meals.sides = (e.meals.sides || []).filter(sd => sd.with);
    const cut = Math.min(debt[i], 700); // on n'allège jamais plus que les collations
    const target = {
      kcal: T.kcal - cut,
      protein: T.protein,
      carbs: Math.max(0, T.carbs - cut * 0.6 / 4),
      fat: Math.max(0, T.fat - cut * 0.4 / 9),
    };
    fillDay(e, i, snacks, target, lactoseOf(mid), glutenOf(mid), charcLeft(plan.dates, x => getEntry(x, mid), e), weekUseOf(plan.dates, x => getEntry(x, mid), e), plan.batchDaysBy?.[mid]?.[i]);
    saveEntry(e, mid);
    spill(i, computeDayTotals(e).kcal - T.kcal);
  }
}

function computeDayTotals(e) {
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  ['breakfast', 'starter', 'lunch', 'dinner', 'sides', 'sweet'].forEach(s => (e.meals[s] || []).forEach(it => {
    const m = computeMealMacros(it);
    Object.keys(t).forEach(k => t[k] += m[k]);
  }));
  return t;
}

// v195 : jour de la session de cuisine = la veille du premier jour planifié (le dimanche, ou aujourd'hui
// pour une semaine commencée en cours de route). Texte : « aujourd'hui », « demain » ou « dimanche 11 octobre ».
function sessionDate(plan) {
  if (!plan?.dates?.length) return null;
  const d = new Date(plan.dates[0] + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  return localYMD(d);
}
function sessionWhen(plan, { short = false } = {}) {
  const sd = sessionDate(plan);
  if (!sd) return '';
  const today = localYMD();
  const t = new Date(today + 'T12:00:00'); t.setDate(t.getDate() + 1);
  if (sd === today) return "aujourd'hui";
  if (sd === localYMD(t)) return 'demain';
  return new Date(sd + 'T12:00:00').toLocaleDateString('fr-FR', short ? { weekday: 'long', day: 'numeric' } : { weekday: 'long', day: 'numeric', month: 'long' });
}

// v195 : « ce que tu vas réellement manger » pour une recette, partout dans l'app.
// 1. Si elle est dans ta semaine : la portion prévue (le prochain jour où tu la manges, sinon le dernier).
// 2. Sinon : la portion calculée pour toi (assiette, petit-déjeuner ou collation selon la recette).
// Renvoie { item, date } (date = null pour une estimation).
function portionFor(recipeId, mid = null) {
  const r = getById(recipeId);
  if (!r) return null;
  const m = mid ? getMembers().find(x => x.id === mid) : getActiveMember();
  const plan = getActivePlan();
  if (plan) {
    const today = getTodayDate();
    const dates = [...plan.dates.filter(d => d >= today), ...plan.dates.filter(d => d < today).reverse()];
    for (const d of dates) {
      const it = Object.values(getEntry(d, m.id).meals || {}).flat().find(x => x && x.id === recipeId);
      if (it) return { item: it, date: d };
    }
  }
  if ((r.tags || []).includes('cantine') || (r.tags || []).includes('libre')) return null;
  const T = planTargets(plan, m.id);
  const share = PLATE_SHARE[m.formula || 'jeune'] || 0.40;
  let overrides;
  if (r.batch && ['lunch', 'dinner', 'main'].includes(r.category) || ['lunch', 'dinner'].includes(r.category)) {
    overrides = calibratePlate(r, plateTarget(T, share, proteinBoost(m.id))).main.overrides;
  } else if (r.category === 'breakfast') {
    overrides = optimizeRecipe(r, breakfastTarget(T), 'B', portionScale(plateTarget(T, share).kcal)).overrides;
  } else {
    const f = 0.12;
    overrides = optimizeRecipe(r, { kcal: T.kcal * f, protein: T.protein * f, carbs: T.carbs * f, fat: T.fat * f }, 'S', portionScale(plateTarget(T, share).kcal)).overrides;
  }
  return { item: { id: r.id, servings: 1, overrides: { ...overrides } }, date: null };
}


// ──────────────────────────────────────────────
// js/state.js
// ──────────────────────────────────────────────

const state = {
  currentView:    'week',          // démarre sur la vue semaine
  selectedDate:   getTodayDate(),  // jour en cours d'édition dans le planner
  searchQuery:    '',
  filterCategory: 'all',
  filterProtein:  'all',
};

function setState(patch) {
  Object.assign(state, patch);
}

// Renvoie l'entrée du jour sélectionné (toujours fraîche depuis le storage)
function currentEntry() {
  return getEntry(state.selectedDate);
}


// ──────────────────────────────────────────────
// js/nav.js
// ──────────────────────────────────────────────

const ITEMS = [
  { id: 'week',     label: 'Semaine'  },
  { id: 'cook',     label: 'Cuisiner' },
  { id: 'shopping', label: 'Courses'  },
  { id: 'recipes',  label: 'Recettes' },
  { id: 'weight',   label: 'Poids'    }, // v199 : page à part
];

const NAV_SVGS = {
  week:     '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  cook:     '<path d="M4 11h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/><line x1="2" y1="11" x2="22" y2="11"/><path d="M9 7c0-1 1-1.5 1-2.5M14 7c0-1 1-1.5 1-2.5"/>',
  planner:  '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>',
  macros:   '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  recipes:  '<path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>',
  weight:   '<rect x="3" y="4" width="18" height="16" rx="4"/><path d="M8.5 10a4.5 4.5 0 0 1 7 0"/><path d="M12 10l1.5-2"/>',
  shopping: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 001.93-1.46l1.38-5.54H6"/>',
};

function renderNav() {
  const nav = document.createElement('nav');
  nav.id = 'nav';
  nav.innerHTML = ITEMS.map(it => `
    <button class="nav-btn ${(state.currentView === it.id || (it.id === 'week' && state.currentView === 'settings')) ? 'active' : ''}" data-view="${it.id}">
      <svg viewBox="0 0 24 24">${NAV_SVGS[it.id]}</svg>
      <span>${it.label}</span>${it.id === 'weight' && window._weighDue?.() ? '<i class="nav-dot" aria-label="Pesée à faire"></i>' : ''}
    </button>`).join('');
  nav.querySelectorAll('.nav-btn').forEach(b =>
    b.addEventListener('click', () => window._nav?.(b.dataset.view))
  );
  document.getElementById('app').appendChild(nav);
}


// ──────────────────────────────────────────────
// js/recipeDetail.js
// ──────────────────────────────────────────────
// recipeDetail.js — Détail recette avec ajustement des portions
// Le sélecteur de portions recalcule ingrédients ET macros en direct.


// Choix complet / classique sur la fiche, en mode « plat par plat » (Mon programme → Riz et pâtes)
function stapleBlock(recipe) {
  const kind = stapleKind(recipe);
  if (getStaples() !== 'plat' || !kind) return '';
  const whole = isWhole(recipe.id);
  const cooker = getEquipment()?.autocuiseur !== false;
  const R = kind === 'riz'
    ? { title: 'Riz de ce plat', a: 'Complet', b: 'Blanc',
        note: (cooker ? 'Le riz complet cuit 20 minutes sous pression, le blanc 5 minutes.' : 'Le riz complet cuit 35 minutes, le blanc 12 minutes.') + ' Les quantités et la liste de courses suivent ton choix.' }
    : { title: 'Pâtes de ce plat', a: 'Complètes', b: 'Classiques', note: 'Les quantités et la liste de courses suivent ton choix.' };
  return `<div class="rd-staple">
    <div class="dt-top"><b>${R.title}</b><span>Plat par plat</span></div>
    <div class="dt-seg" role="radiogroup" aria-label="${R.title}">
      <button class="dt-btn ${whole ? 'on' : ''}" data-staple="complet" role="radio" aria-checked="${whole}">${R.a}</button>
      <button class="dt-btn ${whole ? '' : 'on'}" data-staple="classique" role="radio" aria-checked="${!whole}">${R.b}</button>
    </div>
    <p class="dt-note">${R.note}</p>
  </div>`;
}

function rateHint(v) {
  if (v > 0) return '<span class="rate-chip like"><span class="rate-emoji">❤️</span>Tu aimes ce plat, il reviendra plus souvent</span>';
  if (v < 0) return '<span class="rate-chip nope"><span class="rate-emoji">👎</span>Plat écarté, il ne sera plus proposé</span>';
  return '';
}

// Origine du plat, lue dans ses tags
const CUISINES = {
  'thaï': 'Thaï', 'vietnamien': 'Vietnamien', 'japonais': 'Japonais', 'coréen': 'Coréen', 'chinois': 'Chinois',
  'indien': 'Indien', 'grec': 'Grec', 'turc': 'Turc', 'libanais': 'Libanais', 'marocain': 'Marocain',
  'mexicain': 'Mexicain', 'américain': 'Américain', 'péruvien': 'Péruvien', 'brésilien': 'Brésilien',
  'éthiopien': 'Éthiopien', 'mozambicain': 'Mozambicain', 'italien': 'Italien', 'moyen-orient': 'Moyen-Orient',
  'méditerranéen': 'Méditerranéen', 'scandinave': 'Scandinave', 'hongrois': 'Hongrois', 'russe': 'Russe', 'cubain': 'Cubain', 'sénégalais': 'Sénégalais', 'cajun': 'Cajun', 'français': 'Français',
};
const ICON_BACK = '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>';
const ICON_CLOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>';

// item (facultatif) : la portion prévue dans la semaine → quantités et calories de cette portion-là (v195)
function renderRecipeDetail(recipe, fromView = 'recipes', item = null) {
  const app = document.getElementById('app');
  app.querySelector('.view')?.remove();

    const fam = proteinFamily(recipe);
  const cuisine = (recipe.tags || []).map(t => CUISINES[t]).find(Boolean);
  const view = el('div', `view detail-view rd fam-${fam} cat-${recipe.category}`);
  app.insertBefore(view, app.querySelector('#nav'));
  window.scrollTo(0, 0);

  function render() {
    // v195 : toujours ce que tu manges vraiment (portion de la semaine, sinon calculée pour toi)
    const pf = item && item.id === recipe.id ? { item, date: null, given: true } : portionFor(recipe.id);
    if (pf) item = pf.item;
    const mine = !!(item && item.id === recipe.id);
    const qs = mine ? itemQuantities(item) : null;
    const m = mine ? (mm => ({ kcal: Math.round(mm.kcal), protein: Math.round(mm.protein), carbs: Math.round(mm.carbs), fat: Math.round(mm.fat) }))(itemMacros(item)) : scaledMacros(recipe, 1);
    const kcalM = m.protein * 4 + m.carbs * 4 + m.fat * 9 || 1;
    const bar = v => Math.round(v / kcalM * 100);
    const photo = photoUrl(recipe.photo || recipe.id);

    view.innerHTML = `
      <div class="rd-hero ${photo ? '' : 'no-photo'} ${rateClass(recipe.id)}">
        ${photo ? `<img class="rd-photo" src="${photo}" alt="">` : artFor(recipe.id) ? `<div class="rd-art">${artFor(recipe.id)}</div>` : `<div class="rd-emoji">${recipe.emoji}</div>`}
        <button class="rd-round rd-back round-back" aria-label="Retour">${ICON_BACK}</button>
        <div class="rd-rate">
          <button class="rd-round fab like" data-v="1" aria-label="J'aime">${ICON_HEART}</button>
          <button class="rd-round fab nope" data-v="-1" aria-label="Pas pour moi">${ICON_NOPE}</button>
        </div>
      </div>

      <div class="rd-sheet">
        <div class="rd-tags">
          ${cuisine ? `<span class="rd-tag main">${cuisine}</span>` : ''}
          <span class="rd-tag">${ICON_CLOCK}${recipe.prepTime + recipe.cookTime ? recipe.prepTime + recipe.cookTime + ' min' : 'Sans cuisson'}</span>
          ${recipe.batch ? '<span class="rd-tag">Batch</span>' : ''}
        </div>
        <h1 class="rd-title">${recipe.name}</h1>
        <div class="rate-hint">${rateHint(getRating(recipe.id))}</div>

        <div class="rd-nutri">
          <div class="rd-kcal"><b>${m.kcal}</b><span>kcal</span></div>
          <div class="rd-macros">
            <div class="rd-m p"><b>${m.protein} g</b><span>Protéines</span><i style="--w:${bar(m.protein * 4)}%"></i></div>
            <div class="rd-m c"><b>${m.carbs} g</b><span>Glucides</span><i style="--w:${bar(m.carbs * 4)}%"></i></div>
            <div class="rd-m f"><b>${m.fat} g</b><span>Lipides</span><i style="--w:${bar(m.fat * 9)}%"></i></div>
          </div>
        </div>
        ${stapleBlock(recipe)}

        <section class="rd-sec">
          <div class="rd-sec-hd"><h2>Ingrédients</h2><span class="rd-raw">${mine ? (pf?.date ? `ta portion de ${new Date(pf.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long' })} · poids crus` : 'ta portion · poids crus') : 'poids crus · 1 portion'}</span></div>
          <div class="rd-ings">
            ${recipe.ingredients.map((ing, k) => mine && !(qs[k] > 0) ? '' : `
              <div class="rd-ing ${ing.extra ? 'extra' : ''}">
                <span class="rd-ing-name">${ing.name}${ing.key === 'epices' && spicesOf(recipe.id) ? `<small class="rd-spices">${spicesOf(recipe.id)}</small>` : ''}${ing.extra ? '<em>ajouté</em>' : ''}</span>
                <span class="rd-ing-qty">${humanQty(ing.key, mine ? qs[k] : ing.qty, ing.unit, { cooked: true })}</span>
                ${ing.extra ? `<button class="rd-rm" data-rm="${ing.key}" aria-label="Retirer ${ing.name}">×</button>` : ''}
              </div>`).join('')}
          </div>
          <button class="rd-add">+ Ajouter un ingrédient</button>
        </section>

        <section class="rd-sec">
          <div class="rd-sec-hd"><h2>Préparation</h2></div>
          <ol class="rd-steps">
            ${recipe.steps.map((st, i) => `<li><span class="rd-num">${i + 1}</span><p>${st}</p></li>`).join('')}
          </ol>
        </section>

        ${recipe.tip ? `<div class="rd-tip"><div class="rd-tip-h">L'astuce</div><p>${recipe.tip}</p></div>` : ''}
      </div>
    `;

    view.querySelector('.rd-back').addEventListener('click', () => window._nav?.(fromView));
    view.querySelectorAll('[data-staple]').forEach(b => b.addEventListener('click', () => {
      setDishStaple(recipe.id, b.dataset.staple); applyEquipment(); applyDiet();
      const y = window.scrollY; render(); window.scrollTo(0, y);
    }));
    view.querySelectorAll('.fab').forEach(btn => btn.addEventListener('click', () => {
      const v = setRating(recipe.id, +btn.dataset.v);
      const hero = view.querySelector('.rd-hero');
      hero.classList.toggle('is-liked', v > 0);
      hero.classList.toggle('is-nope', v < 0);
      btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop');
      view.querySelector('.rate-hint').innerHTML = rateHint(v);
    }));
    view.querySelector('.rd-add').addEventListener('click', () => openAddSheet(recipe, () => {
      const y = window.scrollY; render(); window.scrollTo(0, y);
    }));
    view.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => {
      setExtras(recipe.id, getExtras(recipe.id).filter(e => e.key !== b.dataset.rm));
      const days = rebalanceAfterRecipeChange(recipe.id);
      const y = window.scrollY; render(); window.scrollTo(0, y);
      toast(days ? 'Ingrédient retiré. Tes collations ont été réajustées.' : 'Ingrédient retiré de la recette.');
    }));
  }

  render();
}

// ── Ajouter un ingrédient à une recette ──
const QUICK = ['oeuf', 'emmental', 'feta', 'parmesan', 'avocat', 'carre_frais', 'yaourt_grec', 'poulet_tranches',
  'thon', 'pois_chiches', 'riz', 'pain', 'houmous', 'cacahuetes'];
const HIDDEN = new Set(['repas_ext', 'feculents_cuits', 'epices', 'herbes', 'bouillon', 'levure', 'fecule']);
function qtyRule(key) {
  const db = INGREDIENTS[key], nu = NATURAL_UNITS[key];
  if (nu) return { start: nu.g, step: nu.g };
  if (db.unit === 'pièce') return { start: 1, step: 1 };
  if (db.unit === 'ml') return { start: 15, step: 5 };
  if (['fat', 'dairy', 'flavor'].includes(db.role)) return { start: 20, step: 5 };
  return { start: 50, step: 10 };
}
function openAddSheet(recipe, onDone) {
  const all = Object.keys(INGREDIENTS).filter(k => !HIDDEN.has(k) && INGREDIENTS[k].role !== 'other')
    .sort((a, b) => INGREDIENTS[a].name.localeCompare(INGREDIENTS[b].name, 'fr'));
  openSheet(`
    <div class="sheet-handle"></div>
    <div class="hb-sheet-pad add-sheet">
      <div class="hb-h2">Ajouter à la recette</div>
      <p class="hb-p">L'ajout est gardé pour ce plat : il compte dans tes calories, tes courses et tes quantités à cuisiner.</p>
      <input class="search-bar add-search" placeholder="Chercher un ingrédient…">
      <div class="add-list"></div>
      <div class="add-pick" hidden></div>
    </div>`);
  const sheet = document.getElementById('sheet');
  const list = sheet.querySelector('.add-list'), pick = sheet.querySelector('.add-pick'), search = sheet.querySelector('.add-search');
  const showList = q => {
    const keys = q ? all.filter(k => INGREDIENTS[k].name.toLowerCase().includes(q.toLowerCase())) : QUICK.filter(k => INGREDIENTS[k]);
    list.innerHTML = (q ? '' : '<div class="add-h">Les plus utiles</div>') +
      keys.slice(0, 30).map(k => `<button class="add-item" data-k="${k}">${INGREDIENTS[k].name}</button>`).join('') +
      (keys.length ? '' : '<div class="add-none">Aucun ingrédient trouvé</div>');
    list.querySelectorAll('.add-item').forEach(b => b.addEventListener('click', () => choose(b.dataset.k)));
  };
  const choose = key => {
    const rule = qtyRule(key);
    let qty = (getExtras(recipe.id).find(e => e.key === key)?.qty) || rule.start;
    list.hidden = true; search.hidden = true; pick.hidden = false;
    const draw = () => {
      const m = ingMacros(key, qty);
      pick.innerHTML = `
        <div class="add-name">${INGREDIENTS[key].name}</div>
        <div class="add-qty">
          <button class="serv-sel-btn" data-d="-1" aria-label="Moins">−</button>
          <b>${humanQty(key, qty, INGREDIENTS[key].unit)}</b>
          <button class="serv-sel-btn" data-d="1" aria-label="Plus">+</button>
        </div>
        <div class="add-macro">+${Math.round(m.kcal)} kcal · ${Math.round(m.protein)} g prot. · ${Math.round(m.carbs)} g gluc. · ${Math.round(m.fat)} g lip.</div>
        <button class="hb-btn hb-btn-primary add-ok">Ajouter à la recette</button>
        <button class="add-back">Choisir un autre ingrédient</button>`;
      pick.querySelectorAll('[data-d]').forEach(b => b.addEventListener('click', () => { qty = Math.max(rule.step, qty + rule.step * +b.dataset.d); draw(); }));
      pick.querySelector('.add-back').addEventListener('click', () => { pick.hidden = true; list.hidden = false; search.hidden = false; });
      pick.querySelector('.add-ok').addEventListener('click', () => {
        setExtras(recipe.id, [...getExtras(recipe.id).filter(e => e.key !== key), { key, qty }]);
        const days = rebalanceAfterRecipeChange(recipe.id);
        closeSheet(); onDone();
        const what = `${humanQty(key, qty, INGREDIENTS[key].unit)} ${INGREDIENTS[key].name.toLowerCase()}`;
        toast(days
          ? `${what} ajouté${qty > 1 && INGREDIENTS[key].unit === 'pièce' ? 's' : ''}. Tes collations ont été ajustées pour rester dans ton objectif.`
          : `${what} ajouté${qty > 1 && INGREDIENTS[key].unit === 'pièce' ? 's' : ''} à la recette (+${Math.round(m.kcal)} kcal).`);
      });
    };
    draw();
  };
  search.addEventListener('input', () => showList(search.value.trim()));
  showList('');
}


// ──────────────────────────────────────────────
// js/week.js
// ──────────────────────────────────────────────
// week.js — Onglet « Semaine » : je mange quoi ?
// Le repas du jour en grand, la semaine en une ligne par jour, le détail (macros) en touchant un jour.


const ICON_SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/></svg>';
const ICON_MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
let selectedDay = null, selectedFor = null; // jour affiché dans la Semaine
const DAY_LONG = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const DAY_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const PROTEINS = [
  { id: 'poulet',    label: 'Poulet',    emoji: '🍗' },
  { id: 'boeuf',     label: 'Bœuf',      emoji: '🥩' },
  { id: 'crevettes', label: 'Crevettes', emoji: '🦐' },
  { id: 'saumon',    label: 'Poisson',   emoji: '🐟' },
  { id: 'tofu',      label: 'Végé',      emoji: '🌱' },
];
let selProteins = JSON.parse(localStorage.getItem('hebe_proteins') || 'null') || PROTEINS.map(p => p.id);

const ICON_BOOK = '<svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>';
const ICON_SET = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/></svg>';

const dayIdx = d => (new Date(d + 'T12:00:00').getDay() + 6) % 7;
const shortName = id => getById(id)?.short || '';
const names = list => list.map(it => {
  const r = getById(it.id);
  if (!r) return null;
  if (r.category === 'side' && /frites/i.test(r.name)) return /patate/i.test(r.name) ? 'frites de patate douce' : 'frites';
  return r.name;
}).filter(Boolean);

// Plats d'un repas + accompagnement lié (frites)
function mealItems(e, meal) {
  return [...(e.meals[meal] || []), ...(e.meals.sides || []).filter(s => s.with === meal)];
}
function extraItems(e) {
  return [...(e.meals.sweet || []), ...(e.meals.sides || []).filter(s => !s.with), ...(e.meals.starter || [])];
}

function renderWeek() {
  const app = document.getElementById('app');
  app.querySelector('.view')?.remove();
  const plan = getActivePlan();
  const T = USER.targets;
  const view = el('div', 'view hb-week');

  const top = `
    <div class="hb-top">
      <div><div class="brand-word">Héb<span class="brand-accent">é</span></div><div class="brand-tag">Bien manger sans y penser</div></div>
      <div class="hb-top-actions">
        <button class="hb-avatar" data-go="settings" aria-label="Mon programme">${avatar(getActiveMember().sex)}</button>
      </div>
    </div>
    ${whoSwitch()}`;

  if (!plan) {
    view.innerHTML = `${top}
      <div class="hb-card hb-empty">
        <div class="hb-h2">Prépare ta semaine</div>
        <p class="hb-p">Choisis tes protéines et tes repas libres. Hébé choisit les plats, prépare ta session de cuisine et ta liste de courses.</p>
        ${generatorHTML(null)}
      </div>`;
    app.insertBefore(view, app.querySelector('#nav'));
    bindTop(view);
    bindWho(view, renderWeek);
    bindGenerator(view, () => renderWeek());
    return;
  }

  // personne ajoutée au foyer après la génération : il faut une nouvelle semaine
  if (plan.members && !plan.members.includes(getActiveMember().id)) {
    view.innerHTML = `${top}
      <div class="hb-card hb-empty">
        <div class="hb-h2">Une nouvelle semaine pour ${getActiveMember().name || 'cette personne'}</div>
        <p class="hb-p">La semaine en cours a été préparée avant son arrivée dans le foyer. Génère une nouvelle semaine pour calculer ses portions.</p>
        ${generatorHTML(plan)}
      </div>`;
    app.insertBefore(view, app.querySelector('#nav'));
    bindTop(view);
    bindWho(view, renderWeek);
    bindGenerator(view, () => renderWeek());
    return;
  }

  const today = getTodayDate();
  const isRunning = plan.dates.includes(today);
  const focus = isRunning ? today : plan.dates[0];
  // Un seul jour à l'écran, choisi dans le bandeau des 7 jours (aujourd'hui par défaut)
  if (!plan.dates.includes(selectedDay) || selectedFor !== plan.start) { selectedDay = focus; selectedFor = plan.start; }
  const dotsOf = d => {
    const e = getEntry(d), out = [];
    ['lunch', 'dinner'].forEach(meal => (e.meals[meal] || []).forEach(it => {
      const r = getById(it.id); if (!r) return;
      if ((r.tags || []).includes('libre')) out.push('free'); else if (isFreshFish(r)) out.push('fish');
    }));
    return [...new Set(out)].map(k => `<i class="dot-${k}"></i>`).join('');
  };
  const strip = `<div class="day-strip" role="tablist" aria-label="Jours de la semaine">${plan.dates.map((d, i) => `<button class="${d < today ? 'past' : ''} ${d === today ? 'today' : ''} ${d === selectedDay ? 'on' : ''}" data-day="${d}" role="tab" aria-selected="${d === selectedDay}" aria-label="${DAY_LONG[dayIdx(d)]} ${new Date(d + 'T12:00:00').getDate()}"><span>${'LMMJVSD'[dayIdx(d)]}</span><b>${new Date(d + 'T12:00:00').getDate()}</b><div class="ds-dots">${dotsOf(d)}</div></button>`).join('')}</div>`;
  const tomorrow = localYMD(new Date(new Date(today + 'T12:00:00').getTime() + 864e5));
  const dayCard = d => {
    const e = getEntry(d), m = computeDayMacros(e);
    const miniTile = (it, lbl, cls) => { const r = getById(it.id); if (!r) return ''; return `<button class="dv-mini" data-rid="${r.id}"><div class="dv-photo">${dishThumb(r, 'dv-img')}<span class="hb-tile-lbl ${cls}">${lbl}</span></div><span class="dv-mini-name">${shortName(r.id)}</span><span class="dv-k">${Math.round(itemMacros(it).kcal)} kcal</span></button>`; };
    const minis = [...(e.meals.breakfast || []).slice(0, 1).map(it => miniTile(it, 'Petit-déj', 'lbl-morning')), ...extraItems(e).map(it => miniTile(it, 'Collation', 'lbl-snack'))].filter(Boolean);
    const eyebrow = d === today ? "Aujourd'hui" : d === tomorrow ? 'Demain' : '';
    // boîtes congelées du lendemain : à sortir ce soir et à mettre au frigo
    const k = plan.dates.indexOf(d);
    const next = k >= 0 && k < plan.dates.length - 1 ? getEntry(plan.dates[k + 1]) : null;
    const thaw = next ? ['lunch', 'dinner'].flatMap(meal => (next.meals[meal] || []).filter(it => it.frozen).map(it => `${shortName(it.id)} (demain ${meal === 'lunch' ? 'midi' : 'soir'})`)) : [];
    return `<section class="today day-card ${d === today ? 'is-today' : ''}">
      <div class="today-head">
        <div>
          ${eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : ''}
          <div class="today-date">${DAY_LONG[dayIdx(d)]} ${new Date(d + 'T12:00:00').getDate()}</div>
        </div>
        <button class="link-btn" data-date="${d}">Détail</button>
      </div>
      <div class="dv-meals">${bigTile('Midi', mealItems(e, 'lunch'), false)}${bigTile('Soir', mealItems(e, 'dinner'), false)}</div>
      ${minis.length ? `<div class="dv-minis">${minis.join('')}</div>` : ''}
      ${thaw.length ? `<div class="thaw-note"><b>Ce soir</b>sors du congélateur ${thaw.join(' et ')}, et mets ${thaw.length > 1 ? 'les boîtes' : 'la boîte'} au frigo pour qu'${thaw.length > 1 ? 'elles décongèlent' : 'elle décongèle'} doucement.</div>` : ''}
      <div class="today-macros">
        <div class="tm"><div class="tm-top"><span>Calories</span><span><b>${Math.round(m.kcal)}</b> / ${T.kcal}</span></div><div class="tm-bar"><i style="width:${Math.min(100, m.kcal / T.kcal * 100)}%"></i></div></div>
        <div class="tm"><div class="tm-top"><span>Protéines</span><span><b>${Math.round(m.protein)}</b> / ${T.protein} g</span></div><div class="tm-bar"><i style="width:${Math.min(100, m.protein / T.protein * 100)}%"></i></div></div>
      </div>
    </section>`;
  };

  // Profil modifié depuis la génération (formule ou besoins) : on propose de mettre la semaine à jour
  const inPlan = getMembers().filter(m => (plan.members || [getActiveMember().id]).includes(m.id));
  const me = getActiveMember();
  const fChanged = inPlan.filter(m => (m.formula || 'jeune') !== (plan.formulaBy?.[m.id] || 'jeune'));
  // régime sans lactose modifié : les plats doivent changer, donc nouvelle semaine
  const lChanged = inPlan.filter(m => (m.lactose || 0) !== (plan.lactoseBy?.[m.id] || 0) || (m.gluten || 0) !== (plan.glutenBy?.[m.id] || 0));
  const tChanged = inPlan.filter(m => { const a = getTargetsFor(m), b = planTargets(plan, m.id); return ['kcal', 'protein', 'carbs', 'fat'].some(k => Math.abs(a[k] - b[k]) > 1); });
  // préférences (petit-déjeuner pour la formule classique, whey) ; les anciens plans ne les connaissent pas
  const pChanged = plan.prefsBy ? inPlan.filter(m => {
    const p0 = plan.prefsBy[m.id];
    if (!p0) return false;
    const bk = (m.formula || 'jeune') === 'classique' && (m.breakfast || 'mix') !== p0.breakfast;
    return bk || (m.whey !== false) !== p0.whey;
  }) : [];
  const nameOf = m => m.name || 'Sans prénom';
  let formulaNote = '';
  if (fChanged.length) {
    const toClassic = fChanged.some(m => m.formula === 'classique');
    const who = fChanged.length === 1 && inPlan.length > 1 ? fChanged[0].name : null;
    formulaNote = `<div class="formula-note">
      <b>${toClassic ? (who ? `Les petits-déjeuners de ${who} arrivent à la prochaine semaine` : 'Tes petits-déjeuners arrivent à la prochaine semaine') : 'Formule jeûne : plus de petit-déjeuner'}</b>
      <p>${toClassic
        ? "Cette semaine a été préparée avec la formule jeûne. Génère une nouvelle semaine pour ajouter un petit-déjeuner chaque matin, avec des portions recalculées."
        : 'Cette semaine a été préparée avec la formule classique. Génère une nouvelle semaine pour retirer les petits-déjeuners et recalculer les portions.'}</p>
      <button class="hb-btn hb-btn-primary formula-regen">Préparer une nouvelle semaine</button>
    </div>`;
  } else if (lChanged.length) {
    const solo = inPlan.length < 2;
    const LV = ['sans restriction', 'intolérance', 'strict'], GV = ['sans restriction', 'sensibilité', 'strict'];
    const who = lChanged.length === 1 && !solo ? nameOf(lChanged[0]) : null;
    formulaNote = `<div class="formula-note">
      <b>${who ? `Le régime de ${who} a changé` : solo ? 'Ton régime a changé' : 'Vos régimes ont changé'}</b>
      <div class="fn-rows">${lChanged.flatMap(m => [
        (m.lactose || 0) !== (plan.lactoseBy?.[m.id] || 0) ? `<div class="fn-row"><span>${solo ? 'Lactose' : `${nameOf(m)}, lactose`}</span><span><strong>${LV[m.lactose || 0]}</strong></span></div>` : '',
        (m.gluten || 0) !== (plan.glutenBy?.[m.id] || 0) ? `<div class="fn-row"><span>${solo ? 'Gluten' : `${nameOf(m)}, gluten`}</span><span><strong>${GV[m.gluten || 0]}</strong></span></div>` : '',
      ]).join('')}</div>
      <p>Cette semaine a été préparée avant ce changement. Génère une nouvelle semaine pour avoir des plats, des petits-déjeuners et des collations adaptés.</p>
      <button class="hb-btn hb-btn-primary formula-regen">Préparer une nouvelle semaine</button>
    </div>`;
  } else if (tChanged.length || pChanged.length) {
    const solo = inPlan.length < 2;
    const who = [...new Set([...tChanged, ...pChanged])];
    const subject = solo ? 'Ton profil a changé' : who.length > 1 ? 'Vos profils ont changé' : `Le profil de ${nameOf(who[0])} a changé`;
    const BK = { sucre: 'sucré', sale: 'salé', mix: 'sucré et salé' };
    const rows = [
      ...tChanged.map(m => `<div class="fn-row"><span>${solo ? 'Besoins par jour' : nameOf(m)}</span><span>${planTargets(plan, m.id).kcal} → <strong>${getTargetsFor(m).kcal} kcal</strong></span></div>`),
      ...pChanged.flatMap(m => {
        const p0 = plan.prefsBy[m.id], out = [];
        if ((m.formula || 'jeune') === 'classique' && (m.breakfast || 'mix') !== p0.breakfast) out.push(`<div class="fn-row"><span>${solo ? 'Petit-déjeuner' : `${nameOf(m)}, petit-déjeuner`}</span><span><strong>${BK[m.breakfast || 'mix']}</strong></span></div>`);
        if ((m.whey !== false) !== p0.whey) out.push(`<div class="fn-row"><span>${solo ? 'Whey' : `${nameOf(m)}, whey`}</span><span><strong>${m.whey !== false ? 'avec' : 'sans'}</strong></span></div>`);
        return out;
      }),
    ];
    const what = tChanged.length && pChanged.length ? 'Les portions, les petits-déjeuners et les collations seront recalculés'
      : tChanged.length ? 'Les portions seront recalculées' : 'Les petits-déjeuners et les collations seront remplacés';
    formulaNote = `<div class="formula-note">
      <b>${subject}</b>
      <div class="fn-rows">${rows.join('')}</div>
      <p>${what} à partir d'aujourd'hui, en gardant les mêmes plats du midi et du soir. Tu peux aussi préparer une nouvelle semaine.</p>
      <button class="hb-btn hb-btn-primary recalc-btn">Mettre à jour la semaine</button>
      <button class="hb-btn formula-regen fn-second">Nouvelle semaine</button>
    </div>`;
  }

  view.innerHTML = `${top}
    ${formulaNote}
    ${strip}
    ${dayCard(selectedDay)}

    <button class="hb-card hb-batch-link" data-go="cook">
      <div>
        <div class="hb-h3">Ta session de cuisine</div>
        ${sessionDate(plan) >= getTodayDate() ? `<div class="hb-batch-when"><span>${capFirst(sessionWhen(plan))}</span>${sessionDate(plan) === getTodayDate() ? 'courses puis cuisine' : 'courses la veille ou le matin même'}</div>` : ''}
        <div class="hb-batch-thumbs">${plan.sessions.flatMap(s => s.recipes).map(r => dishThumb(getById(r.id), 'batch')).join('')}</div>
        ${plan.sessions.map(s => `<div class="hb-batch-line">${s.recipes.map(r => shortName(r.id)).join(', ')}</div>`).join('')}
      </div>
      <span class="hb-chev">›</span>
    </button>

    <button class="hb-btn hb-regen">Nouvelle semaine</button>
  `;
  app.insertBefore(view, app.querySelector('#nav'));
  bindTop(view);
  bindWho(view, renderWeek);
  view.querySelectorAll('[data-day]').forEach(b => b.addEventListener('click', () => { selectedDay = b.dataset.day; renderWeek(); }));
  view.querySelectorAll('[data-date]').forEach(b => b.addEventListener('click', () => openDaySheet(b.dataset.date)));
  bindHearts(view);
  view.querySelectorAll('.today [data-rid]').forEach(b => b.addEventListener('click', () => renderRecipeDetail(getById(b.dataset.rid), 'week', plannedItem(selectedDay, b.dataset.rid))));
  view.querySelectorAll('.dv-mini[data-rid]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); renderRecipeDetail(getById(b.dataset.rid), 'week', plannedItem(selectedDay, b.dataset.rid)); }));
  view.querySelector('.formula-regen')?.addEventListener('click', () => view.querySelector('.hb-regen').click());
  view.querySelector('.recalc-btn')?.addEventListener('click', () => {
    if (tChanged.length) recalcPortions(Object.fromEntries(tChanged.map(m => [m.id, getTargetsFor(m)])));
    if (pChanged.length) refreshExtras(Object.fromEntries(pChanged.map(m => [m.id, { breakfast: m.breakfast || 'mix', whey: m.whey !== false }])));
    toast("Semaine mise à jour à partir d'aujourd'hui");
    renderWeek();
  });
  view.querySelector('.hb-regen').addEventListener('click', () => {
    openSheet(`<div class="sheet-handle"></div><div class="hb-sheet-pad"><div class="hb-h2">Nouvelle semaine</div>${generatorHTML(plan)}</div>`);
    bindGenerator(document.getElementById('sheet'), () => { closeSheet(); renderWeek(); });
  });
}

function bindTop(view) {
  view.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => window._nav?.(b.dataset.go)));
}

// Grande tuile d'un repas : photo du plat principal + nom (+ accompagnement éventuel)
// Toucher le cœur d'une photo : j'aime / je n'aime plus (sans ouvrir la fiche)
function bindHearts(root) {
  root.querySelectorAll('[data-like]').forEach(h => h.addEventListener('click', e => {
    e.stopPropagation();
    const id = h.dataset.like;
    const v = setRating(id, 1);
    document.querySelectorAll(`[data-like="${id}"]`).forEach(x => { x.classList.toggle('on', v > 0); x.classList.remove('pop'); void x.offsetWidth; x.classList.add('pop'); });
    document.querySelectorAll(`[data-photo="${id}"]`).forEach(x => { x.classList.toggle('is-liked', v > 0); x.classList.remove('is-nope'); });
    toast(v > 0 ? '❤️ Ajouté à tes plats préférés' : 'Retiré de tes plats préférés');
  }));
}

// Petit-déjeuner (formule classique) : une ligne au-dessus des deux grandes cartes
function morningRow(items) {
  const r = items[0] && getById(items[0].id);
  if (!r) return '';
  const kcal = items.reduce((a, it) => a + itemMacros(it).kcal, 0);
  return `<button class="dv-morning" data-rid="${r.id}">
    ${dishThumb(r, 'dv-mo-img')}
    <span class="dv-mo-txt"><span class="dv-mo-lbl">Petit-déjeuner</span><span class="dv-mo-name">${r.name}</span></span>
    <span class="dv-k">${Math.round(kcal)} kcal</span>
  </button>`;
}

function bigTile(label, items, frozen = true) {
  const frozenNote = frozen && items[0]?.frozen ? '<span class="dv-frozen">Décongelé au frigo depuis la veille</span>' : '';
  const main = items[0] && getById(items[0].id);
  if (!main) return '';
  const side = items.slice(1).map(it => getById(it.id)).filter(Boolean);
  const kcal = items.reduce((a, it) => a + itemMacros(it).kcal, 0);
  const isOut = (main.tags || []).includes('imprevu');
  const fam = (main.tags || []).includes('cantine') ? 'cantine' : isOut ? 'outside' : proteinFamily(main);
  return `<button class="dv-meal fam-${fam}" data-rid="${main.id}">
    <div class="dv-photo ${rateClass(main.id)}" data-photo="${main.id}">${items[0].kind === 'cantine' ? cantineThumb('dv-img') : dishThumb(main, 'dv-img')}<span class="hb-tile-lbl">${label}</span>${(main.tags || []).includes('cantine') || isOut ? '' : `<span class="tile-heart ${getRating(main.id) > 0 ? 'on' : ''}" data-like="${main.id}" role="button" tabindex="0" aria-label="J'aime ce plat">${ICON_HEART}</span>`}</div>
    <div class="dv-name">${items[0].kind === 'cantine' ? 'Cantine' : main.name}</div>
    ${side.length ? `<div class="dv-side">+ ${side.map(r => /frites/i.test(r.name) ? (/patate/i.test(r.name) ? 'frites de patate douce' : 'frites') : r.name.toLowerCase()).join(', ')}</div>` : ''}
    <div class="dv-k">${(main.tags || []).includes('libre') ? `${Math.round(kcal)} kcal réservées` : `${Math.round(kcal)} kcal`}</div>
    ${frozenNote}
  </button>`;
}

// ── Générateur (carte vide ou feuille « Nouvelle semaine ») ──
const todayIdx = () => (new Date().getDay() + 6) % 7; // 0 = lundi
// v195 : « Cette semaine » commence demain (courses et cuisine aujourd'hui). Plus proposée à partir de vendredi.
const thisWeekOk = () => todayIdx() <= 3;
function defaultNextWeek(plan) {
  if (!thisWeekOk()) return true;
  if (plan) return true; // une semaine existe déjà : on prépare la suivante
  return todayIdx() >= 3; // à partir de jeudi : semaine prochaine
}
const capFirst = t => t ? t[0].toUpperCase() + t.slice(1) : t;
const SHORT_DAY = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
function weekNote(next) {
  if (next) {
    const sun = new Date(getNextWeekDates()[0] + 'T12:00:00'); sun.setDate(sun.getDate() - 1);
    const d = sun.getDate();
    return todayIdx() === 6
      ? `Courses et cuisine <b>aujourd'hui</b>. Tes repas commencent demain, lundi ${d + 1}.`
      : `Courses samedi, cuisine <b>dimanche ${d}</b>. Tes repas commencent lundi ${d + 1}.`;
  }
  const t = todayIdx();
  return `Courses et cuisine <b>aujourd'hui</b>. Tes repas commencent demain, ${SHORT_DAY[t + 1]}, jusqu'à dimanche.`;
}
// Repas libres : calories réservées (v186). Affiché seulement s'il y a au moins un repas libre.
// Léger, Normal, Copieux, ou « Ajuster » (par pas de 100 kcal, 300 à 2000), qui part de la taille d'un plat.
// freeKcal = 0 : part habituelle (la taille d'un plat) ; freeKcalAdj : le réglage « Ajuster » est choisi.
const FK_PRESETS = [[600, 'Léger'], [900, 'Normal'], [1200, 'Copieux']];
const usualFreeKcal = m => Math.round(plateTarget(getTargetsFor(m), PLATE_SHARE[m.formula || 'jeune'] || 0.40, proteinBoost(m.id)).kcal / 100) * 100;
function freeKcalHTML(m) {
  const fk = m.freeKcal ?? 0;
  const adj = !!m.freeKcalAdj || !FK_PRESETS.some(([v]) => v === fk);
  const val = fk || usualFreeKcal(m);
  return `<div class="free-kcal" data-fkbox="${m.id}" role="radiogroup" aria-label="Calories réservées par repas libre" ${(m.free || []).length ? '' : 'hidden'}>
        <span class="free-kcal-lbl">Calories réservées par repas libre</span>
        <div class="free-seg2">${FK_PRESETS.map(([v, l]) => { const on = !adj && fk === v; return `<button class="${on ? 'on' : ''}" data-mid="${m.id}" data-fk="${v}" role="radio" aria-checked="${on}">${l}<small>${v} kcal</small></button>`; }).join('')}<button class="${adj ? 'on' : ''}" data-mid="${m.id}" data-fk="adj" role="radio" aria-checked="${adj}">Ajuster<small>${val} kcal</small></button></div>
        ${adj ? `<div class="fk-adj"><button data-mid="${m.id}" data-fkstep="-1" aria-label="100 kcal de moins">−</button><b>${val}<small>kcal</small></b><button data-mid="${m.id}" data-fkstep="1" aria-label="100 kcal de plus">+</button></div><span class="fk-note">Par défaut : la taille de l'un de tes plats</span>` : ''}
      </div>`;
}
function generatorHTML(plan) {
  const next = defaultNextWeek(plan);
  return `
    <div class="hb-field">
      <div class="hb-label">Pour quelle semaine ?</div>
      ${thisWeekOk() ? `<div class="hb-seg">
        <button class="hb-seg-btn ${!next ? 'on' : ''}" data-week="0">Cette semaine</button>
        <button class="hb-seg-btn ${next ? 'on' : ''}" data-week="1">Prochaine</button>
      </div>` : `<div class="hb-seg hb-seg-one"><button class="hb-seg-btn on" data-week="1">Semaine prochaine</button></div>`}
      <div class="week-note">${weekNote(next)}</div>
    </div>
    ${getMembers().map(m => `<div class="hb-field">
      <div class="hb-label">${getMembers().length > 1 ? `Repas libres de ${m.name || 'cette personne'}` : 'Repas libres'}</div>
      <div class="free-hint">Un repas que tu ne cuisines pas : restaurant, invitation, cantine.</div>
      <div class="free-caps" role="group" aria-label="Repas libres">
        ${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => `<div class="free-cap ${!next && i <= todayIdx() ? 'off' : ''}" data-fday="${i}"><span>${d}</span><div class="free-pill">${[['lunch', 'midi', ICON_SUN], ['dinner', 'soir', ICON_MOON]].map(([meal, lbl, ic]) => { const on = (m.free || []).includes(`${i}-${meal}`); return `<button class="free-cell ${on ? 'on' : ''}" data-mid="${m.id}" data-free="${i}-${meal}" aria-pressed="${on}" aria-label="${DAY_LONG[i]} ${lbl}">${ic}</button>`; }).join('')}</div></div>`).join('')}
      </div>
      <div class="free-leg"><span>${ICON_SUN} midi</span><span>${ICON_MOON} soir</span></div>
      ${freeKcalHTML(m)}
    </div>`).join('')}
    <div class="hb-field">
      <div class="hb-label">Protéines</div>
      <div class="protein-chips">
        ${PROTEINS.map(p => `<button class="prot-chip ${selProteins.includes(p.id) ? 'on' : ''}" data-p="${p.id}"><span class="prot-emoji"><img src="img/art/prot-${p.id}.webp" alt=""></span>${p.label}</button>`).join('')}
      </div>
    </div>
    <button class="hb-btn hb-btn-primary hb-generate">Générer ma semaine</button>`;
}
function bindGenerator(root, onDone) {
  let next = !!root.querySelector('.hb-seg-btn[data-week="1"].on');
  root.querySelectorAll('.hb-seg-btn').forEach(b => b.addEventListener('click', () => {
    next = b.dataset.week === '1';
    root.querySelectorAll('.hb-seg-btn').forEach(x => x.classList.toggle('on', x === b));
    const wn = root.querySelector('.week-note'); if (wn) wn.innerHTML = weekNote(next);
    root.querySelectorAll('.free-cap[data-fday]').forEach(c => c.classList.toggle('off', !next && +c.dataset.fday <= todayIdx()));
  }));
  const redrawFk = mid => {
    const box = root.querySelector(`[data-fkbox="${mid}"]`);
    if (box) box.outerHTML = freeKcalHTML(getMembers().find(x => x.id === mid));
  };
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-fk], [data-fkstep]');
    if (!b || !root.contains(b)) return;
    const m = getMembers().find(x => x.id === b.dataset.mid);
    if (b.dataset.fk === 'adj') updateMember(m.id, { freeKcalAdj: true });
    else if (b.dataset.fk) updateMember(m.id, { freeKcal: +b.dataset.fk, freeKcalAdj: false });
    else {
      const v = Math.min(2000, Math.max(300, ((m.freeKcal || 0) || usualFreeKcal(m)) + 100 * +b.dataset.fkstep));
      updateMember(m.id, { freeKcal: v, freeKcalAdj: true });
    }
    redrawFk(m.id);
  });
  root.querySelectorAll('.free-cell').forEach(b => b.addEventListener('click', () => {
    const key = b.dataset.free;
    const m = getMembers().find(x => x.id === b.dataset.mid);
    const free = m.free || [];
    updateMember(m.id, { free: free.includes(key) ? free.filter(x => x !== key) : [...free, key] });
    // calories réservées : visibles seulement s'il y a au moins un repas libre
    const box = root.querySelector(`[data-fkbox="${m.id}"]`);
    if (box) box.hidden = !(getMembers().find(x => x.id === m.id).free || []).length;
    b.classList.toggle('on');
    b.setAttribute('aria-pressed', b.classList.contains('on'));
  }));
  root.querySelectorAll('.prot-chip').forEach(b => b.addEventListener('click', () => {
    const p = b.dataset.p;
    if (selProteins.includes(p)) { if (selProteins.length > 1) selProteins = selProteins.filter(x => x !== p); }
    else selProteins = [...selProteins, p];
    localStorage.setItem('hebe_proteins', JSON.stringify(selProteins));
    b.classList.toggle('on', selProteins.includes(p));
  }));
  root.querySelector('.hb-generate').addEventListener('click', e => {
    const btn = e.currentTarget;
    btn.textContent = 'Génération…'; btn.disabled = true;
    setTimeout(() => {
      // un seul planning pour le foyer, des portions pour chacun
      const hadPlan = !!getActivePlan() || !!localStorage.getItem('hebe_served_mains');
      const members = getMembers().map(m => ({ id: m.id, targets: getTargetsFor(m), free: m.free || [], freeKcal: m.freeKcal || 0, formula: m.formula || 'jeune', breakfast: m.breakfast || 'mix', whey: m.whey !== false }));
      const { entriesBy } = generateWeek({ members, nextWeek: next, proteins: selProteins, startFrom: next ? 0 : todayIdx() + 1 });
      Object.entries(entriesBy).forEach(([mid, entries]) => Object.values(entries).forEach(en => saveEntry(en, mid)));
      onDone();
      showTutoOnce(hadPlan);
    }, 50);
  });
}

// ── Détail d'un jour : les plats en grand, puis les macros, puis les quantités ──
function openDaySheet(date) {
  const e = getEntry(date);
  const m = computeDayMacros(e);
  const T = USER.targets;
  const lunch = mealItems(e, 'lunch'), dinner = mealItems(e, 'dinner'), extras = extraItems(e);

  const smallTile = it => {
    const r = getById(it.id); if (!r) return '';
    return `<button class="dv-extra cat-${r.category}" data-rid="${r.id}">${dishThumbRated(r, 'dv-ex-img')}<span class="dv-ex-name">${r.name}</span><span class="dv-k">${Math.round(itemMacros(it).kcal)} kcal</span></button>`;
  };
  const cell = (label, v, t, unit, cls) => `
    <div class="ds-cell">
      <div class="ds-v ${cls}">${Math.round(v)}</div>
      <div class="ds-l">${label}<br>sur ${t}${unit}</div>
      <div class="ds-bar"><span class="${cls}" style="width:${Math.min(100, v / t * 100)}%"></span></div>
    </div>`;
  const qtyBlock = (label, items) => items.length ? `
    <div class="dv-q-group"><div class="hb-label">${label}</div>
      ${items.map(it => {
        const r = getById(it.id); if (!r || (r.tags || []).includes('cantine') || (r.tags || []).includes('imprevu')) return '';
        const qs = itemQuantities(it);
        const ings = r.ingredients.map((g, i) => ({ g, q: qs[i] }))
          .filter(x => x.q > 0 && !INGREDIENTS[x.g.key]?.pantry)
          .map(x => `${x.g.name.split(' (')[0].toLowerCase()} ${humanQty(x.g.key, x.q, x.g.unit, { cooked: true })}`);
        return `<div class="ds-item"><div class="ds-item-hd"><span>${r.name}</span></div><div class="ds-ings">${ings.join(' · ')}</div></div>`;
      }).join('')}
    </div>` : '';

  openSheet(`
    <div class="sheet-handle"></div>
    <div class="hb-sheet-pad">
      <div class="hb-h2">${DAY_LONG[dayIdx(date)]} ${new Date(date + 'T12:00:00').getDate()}</div>
      ${morningRow(e.meals.breakfast || [])}
      <div class="dv-meals">${bigTile('Midi', lunch)}${bigTile('Soir', dinner)}</div>
      <div class="dv-swaps">${[['lunch', lunch], ['dinner', dinner]].map(([meal, items]) => {
        const r = items[0] && getById(items[0].id);
        if (!r) return '<span></span>';
        if ((r.tags || []).includes('imprevu')) {
          const lvl = OUTSIDE_LEVELS[e.outside?.[meal]?.level];
          return `<div class="dv-acts is-out"><span class="out-tag">Repas dehors${lvl ? `, ${lvl.label.toLowerCase()}, environ ${lvl.kcal} kcal` : ''}</span><button class="act-btn" data-undo="${meal}">Annuler</button></div>`;
        }
        if ((r.tags || []).includes('libre')) {
          const cant = items[0].kind === 'cantine';
          return `<div class="dv-acts dv-kind" role="radiogroup" aria-label="Type de repas libre">
            <button class="act-btn ${cant ? '' : 'on'}" data-kind="libre" data-kmeal="${meal}" role="radio" aria-checked="${!cant}">Repas libre</button>
            <button class="act-btn ${cant ? 'on' : ''}" data-kind="cantine" data-kmeal="${meal}" role="radio" aria-checked="${cant}">Cantine</button>
          </div>`;
        }
        if ((r.tags || []).includes('cantine')) return '<span></span>';
        return `<div class="dv-acts" data-acts="${meal}">
          <button class="act-btn" data-swap="${r.id}">Changer</button>
          <button class="act-btn" data-out="${meal}">Imprévu</button>
        </div>`;
      }).join('')}</div>
      ${extras.length ? `<div class="hb-label dv-extras-lbl">Collations</div><div class="dv-extras">${extras.map(smallTile).join('')}</div>` : ''}
      <div class="ds-grid">
        ${cell('Calories', m.kcal, T.kcal, '', 'k')}
        ${cell('Protéines', m.protein, T.protein, ' g', 'p')}
        ${cell('Glucides', m.carbs, T.carbs, ' g', 'c')}
        ${cell('Lipides', m.fat, T.fat, ' g', 'f')}
      </div>
      <details class="dv-qty">
        <summary>Quantités du jour <span>poids crus, 1 portion</span></summary>
        ${qtyBlock('Petit-déjeuner', e.meals.breakfast || [])}${qtyBlock('Midi', lunch)}${qtyBlock('Soir', dinner)}${qtyBlock('Collations', extras)}
      </details>
      <button class="hb-btn ds-close">Fermer</button>
    </div>`);
  const sheet = document.getElementById('sheet');
  sheet.querySelector('.ds-close')?.addEventListener('click', closeSheet);
  bindHearts(sheet);
  // Repas libre : préciser si c'est la cantine (les calories réservées ne changent pas)
  sheet.querySelectorAll('[data-kind]').forEach(b => b.addEventListener('click', () => {
    const en = getEntry(date), it = (en.meals[b.dataset.kmeal] || [])[0];
    if (!it) return;
    if (b.dataset.kind === 'cantine') it.kind = 'cantine'; else delete it.kind;
    saveEntry(en);
    closeSheet(); openDaySheet(date); renderWeek();
  }));
  // Imprévu : choisir l'ampleur du repas pris dehors
  sheet.querySelectorAll('[data-out]').forEach(btn => btn.addEventListener('click', () => {
    const meal = btn.dataset.out;
    const box = sheet.querySelector(`[data-acts="${meal}"]`);
    box.innerHTML = `<div class="out-pick">
      <div class="out-q">Repas pris dehors ${meal === 'lunch' ? 'ce midi' : 'ce soir'} :</div>
      ${Object.entries(OUTSIDE_LEVELS).map(([k, l]) => `<button class="out-opt" data-lvl="${k}"><b>${l.label}</b><span>~${l.kcal} kcal</span></button>`).join('')}
      <button class="out-cancel">Annuler</button>
    </div>`;
    box.querySelector('.out-cancel').addEventListener('click', () => openDaySheet(date));
    box.querySelectorAll('[data-lvl]').forEach(o => o.addEventListener('click', () => {
      const res = logOutsideMeal(date, meal, o.dataset.lvl);
      closeSheet(); renderWeek(); openDaySheet(date);
      toast(res?.skipped
        ? `C'est noté. Il te reste 1 boîte de ${shortName(res.skipped.id)} : congèle-la.`
        : 'C\'est noté, tes collations s\'adaptent.');
    }));
  }));
  sheet.querySelectorAll('[data-undo]').forEach(btn => btn.addEventListener('click', () => {
    undoOutsideMeal(date, btn.dataset.undo);
    closeSheet(); renderWeek(); openDaySheet(date);
    toast('Imprévu annulé');
  }));
  sheet.querySelectorAll('[data-swap]').forEach(b => b.addEventListener('click', () => { closeSheet(); openSwapSheet(b.dataset.swap, date); }));
  sheet.querySelectorAll('[data-rid]').forEach(b => b.addEventListener('click', () => {
    closeSheet();
    renderRecipeDetail(getById(b.dataset.rid), 'week', plannedItem(date, b.dataset.rid));
  }));
}

const PROT_LBL = { poulet: 'Poulet', boeuf: 'Bœuf', poisson: 'Poisson', crevettes: 'Crevettes', tofu: 'Végé', vege: 'Végé' };
const proteinLabel = r => PROT_LBL[proteinFamily(r)] || '';
// v195 : « Changer » propose 3 plats au choix, et prévient si la liste de courses est déjà commencée
function openSwapSheet(oldId, date) {
  const old = getById(oldId);
  const plan = getActivePlan();
  const opts = replaceOptions(oldId, 3);
  if (!opts.length) { toast('Aucun autre plat disponible pour le moment', 'warn'); return; }
  const ckKey = 'diet_shopping_checked_' + (plan?.generatedAt || 'x');
  let nChecked = 0; try { nChecked = JSON.parse(localStorage.getItem(ckKey) || '[]').length; } catch {}
  const portions = plan.sessions.flatMap(s => s.recipes).find(r => r.id === oldId)?.portions || 0;
  const card = r => `<button class="sw-opt" data-pick="${r.id}">
      ${dishThumb(r, 'sw-img')}
      <span class="sw-txt"><b>${r.name}</b><small>${[(r.tags || []).map(t => CUISINES[t]).find(Boolean), proteinLabel(r)].filter(Boolean).join(' · ')}</small></span>
      <span class="hb-chev">›</span>
    </button>`;
  openSheet(`
    <div class="sheet-handle"></div>
    <div class="hb-sheet-pad">
      <div class="hb-h2">Remplacer ${shortName(oldId)}</div>
      <p class="sw-sub">Le plat choisi remplace les ${portions} boîtes de la session. Portions et courses se recalculent.</p>
      ${nChecked ? `<div class="sw-warn">Tu as déjà coché ${nChecked} produit${nChecked > 1 ? 's' : ''} dans ta liste de courses : la liste va changer pour ce plat, tes coches sont gardées.</div>` : ''}
      <div class="sw-list">${opts.map(card).join('')}</div>
      <button class="hb-btn sw-more">Autres idées</button>
      <button class="out-cancel sw-cancel">Garder ${shortName(oldId)}</button>
    </div>`);
  const sh = document.querySelector('.sheet') || document;
  sh.querySelector('.sw-more')?.addEventListener('click', () => { closeSheet(); openSwapSheet(oldId, date); });
  sh.querySelector('.sw-cancel')?.addEventListener('click', () => { closeSheet(); openDaySheet(date); });
  sh.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => {
    const kept = localStorage.getItem(ckKey);
    const next = replaceDish(oldId, b.dataset.pick);
    if (!next) { toast('Aucun autre plat disponible pour le moment', 'warn'); return; }
    // la liste de courses garde ce qui était déjà coché
    if (kept) localStorage.setItem('diet_shopping_checked_' + getActivePlan().generatedAt, kept);
    closeSheet(); renderWeek(); openDaySheet(date);
    toast(`${shortName(old.id)} remplacé par ${shortName(next.id)} pour toute la session`);
  }));
}

// ── v195 : la première semaine, 3 étapes pour comprendre comment ça marche ──
const TUTO_KEY = 'hebe_tuto_done';
function showTutoOnce(hadPlan = false) {
  try { if (localStorage.getItem(TUTO_KEY)) return; localStorage.setItem(TUTO_KEY, '1'); } catch { return; }
  if (hadPlan) return; // déjà utilisateur : pas de tutoriel
  const plan = getActivePlan(); if (!plan) return;
  const when = sessionWhen(plan);
  const today = when === "aujourd'hui";
  // l'onglet est montré tel qu'il apparaît dans la barre du bas : son icône et son nom
  const tab = (id, label) => `<span class="tuto-tab"><svg viewBox="0 0 24 24" aria-hidden="true">${NAV_SVGS[id]}</svg>${label}</span>`;
  const S = [
    ['Fais tes courses', tab('shopping', 'Courses'), `${today ? "Aujourd'hui" : 'La veille de ta session'}. Tout est calculé en paquets du magasin : coche au fur et à mesure.`],
    ['Cuisine ta session', tab('cook', 'Cuisiner'), `${today ? "Aujourd'hui" : capFirst(when)}. Une étape à la fois, avec les quantités et des minuteurs : tu remplis toutes tes boîtes de la semaine.`],
    ['Mange ce qui est affiché', tab('week', 'Semaine'), "Chaque jour, tu vois quoi manger. Un repas pris dehors ? Ouvre le détail du jour et choisis « Imprévu » : la journée se recalcule."],
  ];
  openSheet(`<div class="sheet-handle"></div><div class="hb-sheet-pad tuto">
    <div class="hb-h2">Ta semaine est prête</div>
    <p class="tuto-sub">Voici comment ça marche, en 3 temps.</p>
    <ol class="tuto-steps">${S.map(([t, tb, d], i) => `<li><span class="tuto-n">${i + 1}</span><div><div class="tuto-h"><b>${t}</b>${tb}</div><p>${d}</p></div></li>`).join('')}</ol>
    <button class="hb-btn hb-btn-primary tuto-ok">C'est parti</button>
  </div>`);
  document.querySelector('.tuto-ok')?.addEventListener('click', () => closeSheet());
}

// v195 : la portion prévue ce jour-là (quantités exactes sur la fiche recette)
function plannedItem(date, rid) {
  const e = getEntry(date);
  return Object.values(e.meals || {}).flat().find(it => it && it.id === rid) || null;
}


// ──────────────────────────────────────────────
// js/cook.js
// ──────────────────────────────────────────────
// cook.js — Onglet « Cuisiner » : je fais quoi pendant ma session ?
// Une checklist unique par session : le plat le plus long (autocuiseur) est lancé d'abord,
// l'autre se prépare pendant la cuisson. Puis les quantités totales et la répartition en boîtes.

const NATURAL_UNITS_KEYS = Object.keys(NATURAL_UNITS);

// « a, b et c »
const listFr = a => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} et ${a[a.length - 1]}`);

let sessionIdx = null;

// Estime le temps de conservation d'une recette (frigo + éventuellement congélo).
function conservation(r) {
  const tags = r.tags || [];
  const n = r.name.toLowerCase();
  const txt = (r.steps || []).join(' ').toLowerCase();
  // Poisson cru / cuit : courte conservation
  if (/saumon|thon frais|poisson cru|poke|tartare|sashimi/.test(n)) return { fridge: '1 jour', freezer: null };
  if (/poisson|colin|merlu|cabillaud|crevette|saumon/.test(n)) return { fridge: '2 jours', freezer: '1 mois' };
  // Salades crues / crudités : 1-2 jours
  if (tags.includes('salade') || /crudités|salade verte|carpaccio/.test(n)) return { fridge: '1-2 jours', freezer: null };
  // Soupes / veloutés : bien au frigo, congèlent très bien
  if (tags.includes('soupe') || /velouté|soupe|gaspacho/.test(n)) return { fridge: '4-5 jours', freezer: '2 mois' };
  // Desserts laitiers (fromage blanc, skyr…) : 2-3 jours, pas de congélo (sauf glacés)
  if (tags.includes('congelé') || /glac|nice cream|frozen/.test(n)) return { fridge: '—', freezer: '1 mois (congelé)' };
  if (r.category === 'sweet' && /fromage blanc|skyr|yaourt|mousse|tiramisu|cheesecake|pudding/.test(n)) return { fridge: '2-3 jours', freezer: null };
  // Mijotés / plats en sauce / currys : 3-4 jours, congèlent bien
  if (/curry|mijot|tajine|chili|dal|mafé|stroganoff|bolognaise|sauce/.test(n + txt)) return { fridge: '3-4 jours', freezer: '2 mois' };
  // Viandes cuites, bowls, gratins : 3 jours
  if (/poulet|boeuf|steak|porc|gratin|boulettes|bowl/.test(n)) return { fridge: '3 jours', freezer: '1-2 mois' };
  // Féculents / légumineuses cuits : 3-4 jours
  if (/riz|pâtes|quinoa|lentilles|pois chiches|boulghour/.test(n)) return { fridge: '3-4 jours', freezer: '2 mois' };
  // Gâteaux / crumbles / energy balls : plusieurs jours
  if (/crumble|gâteau|brownie|galettes|energy balls|cookie|muffin/.test(n)) return { fridge: '4-5 jours', freezer: '1 mois' };
  // défaut raisonnable
  return { fridge: '3 jours', freezer: null };
}

function fmtQty(q, unit) {
  if (unit === 'pièce') { const n = Math.round(q * 2) / 2; return `${String(n).replace('.', ',')}`; }
  if (q >= 1000 && unit === 'g') return `${String(Math.round(q / 10) / 100).replace('.', ',')} kg`;
  if (q >= 1000 && unit === 'ml') return `${String(Math.round(q / 10) / 100).replace('.', ',')} L`;
  return `${Math.round(q)} ${unit}`;
}
const dishShort = r => r.short || r.name;

// Poids d'une boîte une fois cuite (féculents secs gonflés à la cuisson, œuf ≈ 50 g)
function boxWeight(r, qs) {
  return r.ingredients.reduce((a, g, i) => {
    const db = INGREDIENTS[g.key];
    if (g.unit === 'pièce') return a + qs[i] * 50;
    return a + qs[i] * (db?.cook || 1);
  }, 0);
}

// Quantités totales d'une recette sur les jours d'une session, pour tout le foyer,
// avec le détail par personne (nombre de boîtes et poids moyen d'une boîte)
function totals(recipeId, dates, mids) {
  const r = getById(recipeId);
  const tot = r.ingredients.map(() => 0);
  let portions = 0;
  const per = {};
  mids.forEach(mid => {
    const p = per[mid] = { n: 0, w: 0 };
    dates.forEach(d => {
      const e = getEntry(d, mid);
      Object.values(e.meals).flat().forEach(it => {
        if (it.id !== recipeId) return;
        const qs = itemQuantities(it);
        qs.forEach((q, i) => tot[i] += q);
        portions++;
        p.n++;
        p.w += boxWeight(r, qs);
      });
    });
  });
  return { r, tot, portions, per };
}

// Étapes d'une recette, rangées par rôle grâce à leur début :
//   « Riz : … » → cuit une seule fois pour toute la session
//   « Mise en boîtes : … » → dernière phase · « Au moment de manger : … » → récapitulatif, pas pendant la session
const RICE_RX = /^Riz : /, BOX_RX = /^Mise en boîtes : /, MEAL_RX = /^Au moment de manger : /;
function splitSteps(r) {
  const core = [], box = [], meal = [];
  let rice = false;
  r.steps.forEach(st => {
    if (RICE_RX.test(st)) rice = true;
    // v199 : le frigo ou le congélateur est décidé par la session (jour par jour) : on retire de la fiche ce qui le contredirait
    else if (BOX_RX.test(st)) { const t = st.replace(BOX_RX, '').replace(/(,? |^)(au frigo )?dès qu'(il|elle)s? (a|ont) tiédi(, au frigo ou au congélateur)?/gi, '').replace(/, au frigo\./g, '.').replace(/^\s*[.,]\s*/, '').trim(); if (t.replace(/[.\s]/g, '') && t.split(/\s+/).length > 4) box.push(cap(t)); } // « Les pâtes. » seul n'apporte rien
    else if (MEAL_RX.test(st)) meal.push(st.replace(MEAL_RX, ''));
    else core.push(st);
  });
  return { core, rice, box, meal };
}
const cap = t => t.charAt(0).toUpperCase() + t.slice(1);

// Phases de la session, dans l'ordre réel. Il n'y a qu'un autocuiseur :
//   1. le plat qui cuit sous pression est lancé d'abord ; les plats à la poêle et à l'air fryer se font pendant sa cuisson
//   2. les autres plats à l'autocuiseur suivent, une fois la cuve libre
//   3. le riz de toute la session cuit en une fois (au début s'il n'y a aucun plat à l'autocuiseur)
function buildPhases(list) {
  const recipes = list.map(x => x.r);
  const parts = new Map(recipes.map(r => [r, splitSteps(r)]));
  const P = (title, hint, r, steps) => ({ title, hint, r, idx: r ? recipes.indexOf(r) : -1, steps });
  const usesCooker = r => parts.get(r).core.some(st => /autocuiseur/i.test(st));
  const pressure = r => parts.get(r).core.findIndex(st => /sous pression/i.test(st));
  const cooker = recipes.filter(usesCooker);
  const others = recipes.filter(r => !usesCooker(r));
  // riz de la session
  const riceList = list.filter(x => parts.get(x.r).rice);
  const eq = getEquipment() || { autocuiseur: true };
  // riz complet et/ou riz blanc (réglage « Riz et pâtes ») : le complet d'abord, il est plus long
  const RICE = {
    riz: { name: 'riz complet', ratio: eq.autocuiseur ? 1.7 : 2.5, cook: eq.autocuiseur
      ? "Ferme, laisse cuire 20 minutes sous pression, puis laisse la pression retomber seule pendant 10 minutes avant d'ouvrir."
      : 'Porte à ébullition, couvre, baisse à feu très doux et laisse cuire 35 minutes, puis laisse reposer 10 minutes hors du feu sans ouvrir.' },
    riz_blanc: { name: 'riz blanc', ratio: eq.autocuiseur ? 1.5 : 1.7, cook: eq.autocuiseur
      ? "Ferme, laisse cuire 5 minutes sous pression, puis laisse la pression retomber seule pendant 10 minutes avant d'ouvrir."
      : 'Porte à ébullition, couvre, baisse à feu très doux et laisse cuire 12 minutes, puis laisse reposer 5 minutes hors du feu sans ouvrir.' },
  };
  const riceOf = (x, k) => x.r.ingredients.reduce((s, g, i) => s + (g.key === k ? x.tot[i] : 0), 0);
  const batches = Object.keys(RICE).map(k => {
    const g = Math.round(riceList.reduce((a, x) => a + riceOf(x, k), 0) / 5) * 5;
    return { k, g, water: Math.round(g * RICE[k].ratio / 10) * 10, dishes: riceList.filter(x => riceOf(x, k) > 0) };
  }).filter(b => b.g > 0);
  const where = eq.autocuiseur ? "l'autocuiseur" : 'une grande casserole';
  const ricePhase = batches.length === 1 ? [
    `Rince ${batches[0].g} g de ${RICE[batches[0].k].name} à l'eau froide, puis mets-le dans ${where} avec ${batches[0].water} ml d'eau.`,
    RICE[batches[0].k].cook,
    `Ce riz accompagne : ${listFr(batches[0].dishes.map(x => dishShort(x.r)))}. Égrène-le à la fourchette avant de le répartir.`]
  : batches.length === 2 ? [
    `Commence par le riz complet, plus long à cuire : rince ${batches[0].g} g de riz complet à l'eau froide, puis mets-le dans ${where} avec ${batches[0].water} ml d'eau.`,
    RICE.riz.cook,
    eq.autocuiseur ? `Verse le riz complet dans un grand plat, puis rince ${batches[1].g} g de riz blanc et mets-le dans l'autocuiseur avec ${batches[1].water} ml d'eau.`
      : `Pendant ce temps, rince ${batches[1].g} g de riz blanc et mets-le dans une deuxième casserole avec ${batches[1].water} ml d'eau.`,
    RICE.riz_blanc.cook,
    `Le riz complet accompagne : ${listFr(batches[0].dishes.map(x => dishShort(x.r)))}. Le riz blanc accompagne : ${listFr(batches[1].dishes.map(x => dishShort(x.r)))}. Égrène-les à la fourchette avant de les répartir.`]
  : null;

  const out = [];
  const first = cooker.filter(r => pressure(r) >= 0).sort((a, b) => b.cookTime - a.cookTime)[0];
  if (first) {
    const core = parts.get(first).core, cut = pressure(first);
    const solo = recipes.length === 1 && !ricePhase;
    out.push(P(solo ? `Cuisiner : ${dishShort(first)}` : `Lancer : ${dishShort(first)}`, solo ? '' : 'Il cuit tout seul pendant la suite', first, solo ? core : core.slice(0, cut + 1)));
    others.forEach(r => out.push(P(`Pendant la cuisson : ${dishShort(r)}`, '', r, parts.get(r).core)));
    if (!solo && cut + 1 < core.length) out.push(P(`Terminer : ${dishShort(first)}`, '', first, core.slice(cut + 1)));
    cooker.filter(r => r !== first).forEach(r => out.push(P(`Cuisiner : ${dishShort(r)}`, "L'autocuiseur est de nouveau libre", r, parts.get(r).core)));
    if (ricePhase) out.push(P('Cuire le riz', eq.autocuiseur ? 'Pendant les 10 minutes de repos, commence la mise en boîtes' : 'Il cuit tout seul pendant que tu commences la mise en boîtes', null, ricePhase));
  } else {
    cooker.forEach(r => out.push(P(`Préparer : ${dishShort(r)}`, '', r, parts.get(r).core)));
    if (ricePhase) out.push(P('Lancer le riz', 'Il cuit tout seul pendant la suite', null, ricePhase));
    others.forEach(r => out.push(P(`${ricePhase ? 'Pendant la cuisson' : 'Préparer'} : ${dishShort(r)}`, '', r, parts.get(r).core)));
  }
  return { phases: out, boxes: recipes.map(r => ({ r, steps: parts.get(r).box })), meals: recipes.map(r => ({ r, steps: parts.get(r).meal })).filter(x => x.steps.length) };
}

// ── v195 : quantités de l'étape et minuteurs ──
// Ingrédients cités dans une étape : on affiche leur quantité totale pour la session.
const STEP_RX = {
  poulet: /poulet/, haut_cuisse: /poulet|cuisse/, poulet_hache: /poulet/, boeuf: /b(œ|oe)uf|steak|kefta|köfte|boulettes|viande/, boeuf_emince: /b(œ|oe)uf/,
  tomates_conc: /tomates concassées|les tomates/, tomate: /tomates?(?! (concassées|cerise|séchées))/, tomates_cerise: /tomates cerise/,
  lait_coco: /lait de coco/, lait: /\blait(?! de coco)/, yaourt_grec: /yaourt/, fromage_blanc: /fromage blanc/, creme: /crème/,
  pdt: /pommes? de terre|grenailles|frites|purée/, patate_douce: /patates? douces?/, oignon: /oignon/, poivron: /poivron/, courgette: /courgette/,
  carotte: /carotte/, aubergine: /aubergine/, champignons: /champignon/, epinards: /épinard/, concombre: /concombre/,
  riz: /\briz\b/, riz_blanc: /\briz\b/, pates: /pâtes|penne/, pates_classiques: /pâtes|penne/, boulghour: /boulgour/, quinoa: /quinoa/, semoule: /semoule/,
  lentilles_corail: /lentilles/, lentilles_vertes: /lentilles/, pois_chiches: /pois chiches/, haricots_rouges: /haricots rouges/, haricots_blancs: /haricots blancs/,
  mais: /maïs/, crevettes: /crevettes/, saumon: /saumon/, poisson_blanc: /poisson|colin|merlu/, tofu: /tofu/, oeuf: /(?<!b)(œ|oe)ufs?\b/,
  feta: /feta/, cheddar: /cheddar|fromage/, emmental: /emmental|fromage/, mozzarella: /mozzarella/, parmesan: /parmesan/, cottage: /cottage/,
  tortilla: /tortilla|wrap|galette/, pita: /pita/, gnocchis: /gnocchi/, nouilles_oeufs: /nouilles/, nouilles_riz: /nouilles/, farine: /farine/,
  concentre: /concentré/, gingembre: /gingembre(?! en poudre)/, citron: /citron(?! vert)/, citron_vert: /citron vert/, herbes: /persil|coriandre|basilic|herbes(?! de provence)|aneth|ciboulette|menthe|thym/,
  chou_fleur: /chou-fleur/, petits_pois: /petits pois/, haricots_verts: /haricots verts/, olives: /olives/,
  salade: /salade|crudités/, avocat: /avocat/, pain_burger: /pains?\b|burger/, baguette: /baguette|pain/, pain: /pain|tartine/, brocoli: /brocoli/,
  thon: /thon/, feuille_riz: /feuilles? de riz|galette/, tomates_sechees: /tomates séchées/, cornflakes: /corn-?flakes/, houmous: /houmous/,
  cornichons: /cornichon/, chou_chinois: /chou/, radis: /radis/, pousses_soja: /pousses/, mangue: /mangue/, fruits_rouges: /fruits rouges/,
};
// v195 : ingrédients qui ne servent qu'au moment du repas (œuf au plat, galettes, fromage à faire fondre…) :
// pas cuisinés pendant la session, mais à garder pour le jour J
function mealOnlyKeys(r) {
  const MEAL = /^(Au moment de manger : |Le matin)/;
  const sess = r.steps.filter(st => !MEAL.test(st)).join(' ').toLowerCase();
  const meal = r.steps.filter(st => MEAL.test(st)).join(' ').toLowerCase();
  if (!meal) return new Set();
  return new Set(r.ingredients.filter(g => { const rx = STEP_RX[g.key]; return rx && !INGREDIENTS[g.key]?.pantry && !rx.test(sess) && rx.test(meal); }).map(g => g.key));
}
function stepQty(text, x) {
  if (!x || !x.tot) return '';
  const t = text.toLowerCase();
  const seen = new Set();
  const chips = [];
  x.r.ingredients.forEach((g, i) => {
    const rx = STEP_RX[g.key];
    const db = INGREDIENTS[g.key];
    if (!rx || !db || db.pantry || seen.has(g.key) || !(x.tot[i] > 0) || !rx.test(t)) return;
    seen.add(g.key);
    chips.push(`<span class="ck-qty-chip"><b>${humanQty(g.key, x.tot[i], g.unit)}</b> ${g.name.split(' (')[0].toLowerCase()}</span>`);
  });
  return chips.length ? `<div class="ck-qty">${chips.join('')}</div>` : '';
}
// Durée d'une étape (« 18 à 20 minutes » → 20). Pas de minuteur sous 3 minutes.
function stepMinutes(text) {
  let best = 0;
  text.replace(/(\d+)(?:\s*à\s*(\d+))?\s*(?:minutes|min)\b/g, (_, a, b) => { best = Math.max(best, +(b || a)); return _; });
  return best >= 3 ? best : 0;
}
const TIMERS_KEY = 'hebe_timers';
const getTimers = () => { try { return JSON.parse(localStorage.getItem(TIMERS_KEY) || '[]'); } catch { return []; } };
const saveTimers = a => { try { localStorage.setItem(TIMERS_KEY, JSON.stringify(a)); } catch {} };
const ICON_TM_CLOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9.5 2.5h5"/></svg>';
const ICON_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg>';
function startTimer(label, minutes, step) {
  const list = getTimers().filter(t => t.end > Date.now() && t.step !== step);
  list.push({ id: Date.now(), label, step, total: minutes * 60000, end: Date.now() + minutes * 60000 });
  saveTimers(list);
  try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch {}
}
function ringAlarm(label) {
  try { navigator.vibrate?.([300, 150, 300, 150, 600]); } catch {}
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.35, 0.7].forEach(t0 => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 880; o.connect(g); g.connect(ac.destination); g.gain.setValueAtTime(0.25, ac.currentTime + t0); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + t0 + 0.3); o.start(ac.currentTime + t0); o.stop(ac.currentTime + t0 + 0.32); });
  } catch {}
  try { if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') new Notification('Hébé', { body: `${label} : c'est prêt !`, icon: 'icon-192.png' }); } catch {}
  toast(`${label} : c'est prêt !`);
}
const fmtLeft = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
// anneau de progression (le temps qui reste)
const tmRing = (t, now, size) => {
  const r = size / 2 - 3, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, (t.end - now) / (t.total || 1)));
  return `<svg class="tm-ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="tm-ring-bg"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="tm-ring-fg" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - f)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
};
// Minuteur dans l'étape en cours (data-tm-step) ; ailleurs, une petite bulle au-dessus du menu
let timerTick = null;
function drawTimers() {
  const now = Date.now();
  let list = getTimers();
  list.filter(t => t.end <= now && !t.rang).forEach(t => { t.rang = true; ringAlarm(t.label); });
  list = list.filter(t => t.end > now - 10000); // un minuteur fini reste affiché 10 secondes
  saveTimers(list);
  // dans l'étape
  document.querySelectorAll('[data-tm-step]').forEach(box => {
    const t = list.find(x => String(x.step) === box.dataset.tmStep);
    box.classList.toggle('running', !!t);
    box.classList.toggle('over', !!t && t.end <= now);
    const live = box.querySelector('.tm-live');
    if (t && live) { live.querySelector('.tm-ring-wrap').innerHTML = tmRing(t, now, 44); live.querySelector('.tm-left').textContent = t.end <= now ? 'Prêt !' : fmtLeft(t.end - now); }
  });
  const inline = new Set([...document.querySelectorAll('[data-tm-step].running')].map(b => b.dataset.tmStep));
  const float = list.filter(t => !inline.has(String(t.step)));
  let bar = document.getElementById('ck-timers');
  if (!float.length) bar?.remove();
  else {
    if (!bar) { bar = document.createElement('div'); bar.id = 'ck-timers'; document.body.appendChild(bar); }
    bar.innerHTML = float.map(t => `<div class="tm-pill ${t.end <= now ? 'over' : ''}">${tmRing(t, now, 28)}<span class="tm-pill-l">${t.label}</span><b>${t.end <= now ? 'Prêt !' : fmtLeft(t.end - now)}</b><button class="tm-x" data-tstop="${t.id}" aria-label="Arrêter le minuteur ${t.label}">${ICON_X}</button></div>`).join('');
    bar.querySelectorAll('[data-tstop]').forEach(b => b.addEventListener('click', () => { saveTimers(getTimers().filter(t => t.id !== +b.dataset.tstop)); drawTimers(); }));
  }
  if (list.length && !timerTick) timerTick = setInterval(drawTimers, 1000);
  if (!list.length && timerTick) { clearInterval(timerTick); timerTick = null; }
}
setTimeout(drawTimers, 0);

function renderCook() {
  const app = document.getElementById('app');
  app.querySelector('.view')?.remove();
  const view = el('div', 'view hb-cook');
  const plan = getActivePlan();

  if (!plan) {
    view.innerHTML = `
      <div class="hb-page-title">Cuisiner</div>
      <div class="hb-card hb-empty">
        <div class="hb-h3">Aucune session prévue</div>
        <p class="hb-p">Génère ta semaine : les étapes de ta session de cuisine apparaîtront ici.</p>
        <button class="hb-btn hb-btn-primary" data-go="week">Préparer ma semaine</button>
      </div>`;
    app.insertBefore(view, app.querySelector('#nav'));
    view.querySelector('[data-go]').addEventListener('click', () => window._nav?.('week'));
    return;
  }

  const today = getTodayDate();
  if (sessionIdx == null || sessionIdx >= plan.sessions.length) {
    // session à venir : la première dont les jours ne sont pas encore passés
    sessionIdx = Math.max(0, plan.sessions.findIndex(s => s.dates[s.dates.length - 1] >= today));
  }
  const S = plan.sessions[sessionIdx];
  const mids = planMembers(plan);
  const list = S.recipes.map(x => totals(x.id, S.dates, mids)).filter(x => x.portions);
  const recipes = list.map(x => x.r);
  const plan2 = recipes.length ? buildPhases(list) : { phases: [], boxes: [], meals: [] };
  const phases = plan2.phases;

  // Petits-déjeuners, collations et compléments des jours de la session
  const extraIds = [...new Set(mids.flatMap(mid => S.dates.flatMap(d => {
    const e = getEntry(d, mid);
    return [...(e.meals.breakfast || []), ...(e.meals.sweet || []), ...(e.meals.sides || []).filter(sd => !sd.with)].map(it => it.id);
  })))];
  const extras = extraIds.map(id => totals(id, S.dates, mids)).filter(x => x.r && x.portions);
  const isLater = st => /^(Le matin|Au moment de manger)/.test(st);
  // tout ce qui suit la première étape « Le matin » ou « Au moment de manger » se fait plus tard
  const cutAt = r => { const k = r.steps.findIndex(isLater); return k < 0 ? r.steps.length : k; };
  const kindOf = r => (r.category === 'breakfast' ? 'petit-déjeuner' : 'collation');
  const de = n => (/^[aeiouyhéèêâîôûœ]/i.test(n) ? `d'${n}` : `de ${n}`);
  const qtyLine = x => `Pour ${x.portions} ${x.portions > 1 ? 'portions' : 'portion'} : ${x.r.ingredients.map((g, i) => `${humanQty(g.key, x.tot[i], g.unit)} ${g.unit === 'pièce' ? g.name.toLowerCase() : de(g.name.toLowerCase())}`).join(', ')}.`;
  // à préparer pendant la session : de vraies phases, avec les quantités totales
  extras.filter(x => x.r.batch).forEach(x => {
    const steps = x.r.steps.slice(0, cutAt(x.r)).map(st => st.replace(/^Pendant la session de cuisine, /, '').replace(/^./, c => c.toUpperCase()));
    phases.push({ title: `Préparer : ${dishShort(x.r)}`, hint: `${cap(kindOf(x.r))} à préparer maintenant`, r: x.r, idx: -2, steps: [qtyLine(x), ...steps] });
  });
  // à faire au moment : ce qu'il reste à faire, sans cuisson d'avance
  const later = extras.map(x => {
    const steps = x.r.batch ? x.r.steps.slice(cutAt(x.r)) : x.r.steps;
    return steps.length ? { x, text: steps.join(' ').replace(/^Le matin, /, '').replace(/^Au moment de manger : /, '') } : null;
  }).filter(Boolean);
  const fries = [...new Set(S.recipes.map(x => x.side).filter(Boolean))].map(getById).filter(Boolean);
  const minutes = Math.round((recipes.reduce((a, r) => a + r.prepTime, 0) + extras.filter(x => x.r.batch).reduce((a, x) => a + x.r.prepTime, 0) + Math.max(0, ...recipes.map(r => r.cookTime)) + 10) / 5) * 5;
  const boxes = list.reduce((a, x) => a + x.portions, 0);
  // v195 : collations et petits-déjeuners préparés pendant la session, montrés en haut avec les plats
  const batchExtras = extras.filter(x => x.r.batch);
  const kindLbl = r => (r.category === 'breakfast' ? 'Petit-déj' : 'Collation');

  // collations à préparer à l'avance (cookies, overnight oats…) : rattachées à la 1re session
  const prepSnacks = sessionIdx === 0 ? [...new Set(mids.flatMap(mid => plan.dates.flatMap(d => (getEntry(d, mid).meals.sweet || []).map(it => it.id))))]
    .map(getById).filter(r => r && r.batch) : [];

  const doneKey = `hebe_cook_${plan.generatedAt}_${S.key}`;
  let done = JSON.parse(localStorage.getItem(doneKey) || '[]');

  // numérotation continue des étapes cochables
  let n = 0;
  const phaseSteps = phases.map(ph => ph.steps.map(text => ({ text, i: n++ })));
  const boxIdx = n++;
  // Rangement de chaque plat : frigo pour lundi à mercredi, congélateur au-delà (avec le jour prévu)
  const DAYN = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  const MEALN = { lunch: 'midi', dinner: 'soir' };
  const FRESH = { tomate: 'la tomate', concombre: 'le concombre', salade: 'la salade', avocat: "l'avocat", herbes: 'les herbes', yaourt_grec: 'le yaourt' };
  const andList = a => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} et ${a[a.length - 1]}`);
  const storage = r => {
    const uses = [];
    mids.forEach(mid => S.dates.forEach((d, k) => ['lunch', 'dinner'].forEach(meal => (getEntry(d, mid).meals[meal] || []).forEach(it => {
      if (it.id === r.id) uses.push({ k, meal, frozen: !!it.frozen });
    }))));
    const group = list => {
      const by = {};
      list.forEach(u => { const key = `${DAYN[u.k]} ${MEALN[u.meal]}`; by[key] = (by[key] || 0) + 1; });
      return andList(Object.entries(by).map(([key, c]) => (c > 1 ? `${key} (${c} boîtes)` : key)));
    };
    const fr = uses.filter(u => !u.frozen), fz = uses.filter(u => u.frozen);
    const parts = [];
    if (fr.length) parts.push(`au frigo, ${fr.length} ${fr.length > 1 ? 'boîtes' : 'boîte'} pour ${group(fr)}`);
    if (fz.length) parts.push(`au congélateur, ${fz.length} ${fz.length > 1 ? 'boîtes' : 'boîte'} pour ${group(fz)}`);
    let txt = `${parts.join(' ; ')}.`;
    const fresh = fz.length ? [...new Set(r.ingredients.filter(g => FRESH[g.key]).map(g => FRESH[g.key]))] : [];
    if (fresh.length) txt += ` Pour les boîtes congelées, garde à part ${andList(fresh)} : ${fresh.length > 1 ? 'ils ne se congèlent pas' : 'cela ne se congèle pas'}, prépare-les le jour même.`;
    return txt;
  };
  // ce qui ne se cuisine pas aujourd'hui (œufs au plat, galettes…) : on le dit clairement au moment de ranger
  const keptLine = r => {
    const later = mealOnlyKeys(r); if (!later.size) return '';
    const x = list.find(y => y.r === r); if (!x) return '';
    const items = r.ingredients.map((g, i) => later.has(g.key) && x.tot[i] > 0 ? `${humanQty(g.key, x.tot[i], g.unit)} ${g.unit === 'pièce' ? g.name.toLowerCase() : de(g.name.split(' (')[0].toLowerCase())}` : '').filter(Boolean);
    return items.length ? ` À garder pour le jour du repas, sans les cuisiner aujourd'hui : ${andList(items)} (la fiche de la recette dit quoi faire ce jour-là).` : '';
  };
  const boxSteps = plan2.boxes.map(b => ({ r: b.r, text: `${dishShort(b.r)} : ${storage(b.r)}${b.steps.length ? ` Dans les boîtes : ${b.steps.join(' ')}` : ''}${keptLine(b.r)}`, i: n++ }));
  const hasFrozen = list.some(x => mids.some(mid => S.dates.some(d => ['lunch', 'dinner'].some(meal => (getEntry(d, mid).meals[meal] || []).some(it => it.id === x.r.id && it.frozen)))));
  // à manger en premier : poisson et plats qui ne se congèlent pas
  const firstEat = list.filter(x => isFreshFish(x.r) || FRESH_ONLY.includes(x.r.id)).map(x => dishShort(x.r));
  const total = n;
  const doneCount = done.filter(i => i < total).length;
  const current = [...Array(total).keys()].find(i => !done.includes(i));
  const stepBtn = (text, i, dish = '') => {
    return `
    <div class="ck-step ${done.includes(i) ? 'done' : ''} ${i === current ? 'current' : ''}" data-i="${i}" role="button" tabindex="0">
      <span class="ck-box" aria-hidden="true">${done.includes(i) ? '✓' : ''}</span>
      <span class="ck-text">${i === current ? '<span class="ck-now">Maintenant</span>' : ''}${text}
      </span>
    </div>`;
  };

  // Une étape à la fois : la phase en cours en grand, les autres repliées
  const endText = `Prépare ${andList(list.map(x => `${x.portions} ${x.portions > 1 ? 'boîtes' : 'boîte'} de ${dishShort(x.r)}`))}, et écris sur chaque boîte le jour où elle sera mangée.${hasFrozen ? " Les boîtes à congeler vont au congélateur aujourd'hui même, une fois tièdes : la veille du jour prévu, l'onglet Semaine te rappelle de les sortir et de les mettre au frigo." : ''}`;
  const allPhases = [
    ...phases.map((ph, k) => ({ num: k + 2, title: ph.title, hint: ph.hint, r: ph.r, cls: ph.idx === -2 ? `ck-phase-extra dish-${list.length + batchExtras.findIndex(x => x.r === ph.r)}` : ph.r ? `dish-${ph.idx}` : 'ck-phase-rice', steps: phaseSteps[k] })),
    { num: phases.length + 2, title: 'Mettre en boîtes', hint: 'Laisse tiédir 20 minutes au plus, ferme les boîtes et range-les au frigo', r: null, cls: 'ck-phase-end', steps: [{ text: endText, i: boxIdx }, ...boxSteps] },
  ];
  const phaseHTML = P => {
    const ids = P.steps.map(st => st.i);
    if (ids.every(i => done.includes(i))) return `<button class="ck-row done" data-reopen="${ids[ids.length - 1]}"><span>${P.num} · ${P.title}</span><span class="ck-row-ok">✓ fait</span></button>`;
    const cur = P.steps.find(st => st.i === current);
    if (!cur) return `<div class="ck-row"><span>${P.num} · ${P.title}</span><span class="ck-row-n">${ids.length} étape${ids.length > 1 ? 's' : ''}</span></div>`;
    return `<div class="ck-cur ${P.cls}" id="ck-current">
      <div class="ck-phase-hd"><span class="ck-phase-num">${P.num}</span>${P.r ? dishThumb(P.r, 'phase') : ''}<div class="ck-phase-txt"><div class="ck-phase-title">${P.title}</div>${P.hint ? `<div class="ck-phase-hint">${P.hint}</div>` : ''}</div></div>
      <div class="ck-cur-step"><div class="ck-cur-k">Étape ${P.steps.indexOf(cur) + 1} sur ${ids.length}</div>${cur.text}
        ${P.r && !P.cls.includes('ck-phase-extra') ? stepQty(cur.text, list.find(x => x.r === P.r) || extras.find(x => x.r === P.r)) : ''}
        ${stepMinutes(cur.text) ? `<div class="tm-box" data-tm-step="${cur.i}">
          <button class="tm-start" data-timer="${stepMinutes(cur.text)}" data-tstep="${cur.i}" data-tlabel="${P.r ? dishShort(P.r) : 'Riz'}">${ICON_TM_CLOCK}<span>Lancer le minuteur</span><b>${stepMinutes(cur.text)} min</b></button>
          <div class="tm-live"><span class="tm-ring-wrap"></span><div class="tm-txt"><span class="tm-left"></span><small>Minuteur · ${P.r ? dishShort(P.r) : 'Riz'}</small></div><button class="tm-x" data-tstop-step="${cur.i}" aria-label="Arrêter le minuteur">${ICON_X}</button></div>
        </div>` : ''}
      </div>
      <div class="ck-cur-nav"><button class="ck-prev" ${doneCount ? '' : 'disabled'}>Retour</button><button class="ck-next">${current === total - 1 ? 'Terminer' : 'Étape suivante'}</button></div>
    </div>`;
  };

  view.innerHTML = `
    <div class="hb-page-title">Cuisiner</div>
    ${plan.sessions.length > 1 ? `<div class="hb-seg">${plan.sessions.map((s, i) =>
      `<button class="hb-seg-btn ${i === sessionIdx ? 'on' : ''}" data-s="${i}">${s.label}</button>`).join('')}</div>` : ''}

    <div class="ck-summary">
      ${sessionDate(plan) >= getTodayDate() ? `<div class="ck-when">Session ${sessionWhen(plan) === "aujourd'hui" || sessionWhen(plan) === 'demain' ? sessionWhen(plan) : 'du ' + sessionWhen(plan)}</div>` : ''}
      <div class="ck-sum-sub">≈ ${minutes} min · ${boxes} boîtes · pour toute la semaine</div>
      ${firstEat.length ? `<div class="ck-first">À manger en premier : ${firstEat.join(' et ')}, dans les premiers jours de la semaine.</div>` : ''}
      <div class="ck-progress"><div class="tm-bar"><i style="width:${total ? doneCount / total * 100 : 0}%"></i></div><span>${doneCount}/${total} étapes</span></div>
    </div>

    <div class="ck-phase ck-prep">
      <div class="ck-phase-hd"><span class="ck-phase-num">1</span><div><div class="ck-phase-title">Sortir les ingrédients</div><div class="ck-phase-hint">Touche une recette pour voir ses quantités</div></div></div>
      ${sessionIdx > 0 && list.some(x => x.r.ingredients.some(g => INGREDIENTS[g.key]?.snap)) ? `<div class="ck-note ck-note-safe">Viandes et poissons achetés en début de semaine : vérifie leur date limite. Si elle tombe avant aujourd'hui, ils auraient dû être congelés le jour des courses ; dans ce cas, fais-les décongeler la veille au frigo, jamais à température ambiante.</div>` : ''}
      <div class="ck-menu">
        ${[...list, ...batchExtras].map((x, k) => `<div class="ck-card dish-${k}">
          <button class="ck-card-hd" data-card aria-expanded="false">
            <span class="ck-menu-top">${dishThumbRated(x.r, 'menu')}<span class="ck-menu-n">${x.portions} ${x.portions > 1 ? 'portions' : 'portion'}</span></span>
            <span class="ck-menu-name">${dishShort(x.r)}</span>
          </button>
          ${(() => {
            const later = mealOnlyKeys(x.r);
            const row = (g, i) => `<div class="ck-ing"><span>${g.name}${g.key === 'epices' && spicesOf(x.r.id) ? `<small>${spicesOf(x.r.id)}</small>` : ''}</span><span>${humanQty(g.key, x.tot[i], g.unit)}</span></div>`;
            const now = x.r.ingredients.map((g, i) => x.tot[i] > 0 && !later.has(g.key) ? row(g, i) : '').join('');
            const kept = x.r.ingredients.map((g, i) => x.tot[i] > 0 && later.has(g.key) ? row(g, i) : '').join('');
            const mealTxt = x.r.steps.filter(st => /^Au moment de manger : /.test(st)).map(st => cap(st.replace(/^Au moment de manger : /, ''))).join(' ');
            return `<div class="ck-card-ings">${now}${kept ? `<div class="ck-later"><div class="ck-later-h">À garder pour le jour du repas</div>${kept}<p>${mealTxt}</p></div>` : ''}</div>`;
          })()}
          <button class="ck-menu-link" data-rid="${x.r.id}">Voir la recette</button>
        </div>`).join('')}
      </div>
    </div>

    ${allPhases.map(phaseHTML).join('')}
    ${current === undefined ? `<div class="ck-cur ck-finished"><div class="ck-phase-title">Session terminée</div><p>Tous les plats sont en boîtes. Bon appétit cette semaine !</p><button class="ck-restart">Recommencer la session</button></div>` : ''}

    <div class="ck-phase ck-store">
      <div class="ck-phase-hd"><div><div class="ck-phase-title">Rangement</div><div class="ck-phase-hint">Combien de temps se garde chaque plat</div></div></div>
      ${mids.length > 1 ? `<div class="ck-split">${list.map((x, k) => `<div class="ck-split-dish dish-${k}">
        <div class="ck-split-name">${dishThumb(x.r, 'mini')}${dishShort(x.r)}</div>
        ${mids.filter(mid => x.per[mid]?.n).map(mid => `<div class="ck-split-row"><span>${getMember(mid)?.name || 'Sans prénom'}</span><span>${x.per[mid].n} ${x.per[mid].n > 1 ? 'boîtes' : 'boîte'} d'environ ${Math.round(x.per[mid].w / x.per[mid].n / 10) * 10} g</span></div>`).join('')}
      </div>`).join('')}</div>` : ''}
      <div class="ck-cons-list">${list.map(x => { const c = conservation(x.r); return `<div class="ck-cons-row"><span>${dishShort(x.r)}</span><span>frigo ${c.fridge}${c.freezer ? ` · congélo ${c.freezer}` : ''}</span></div>`; }).join('')}</div>
    </div>

    <!-- v195 : la page ne montre que la session de cuisine ; ce qui se fait au moment du repas est dans la Semaine et sur les fiches -->
  `;
  app.insertBefore(view, app.querySelector('#nav'));

  view.querySelectorAll('.hb-seg-btn').forEach(b => b.addEventListener('click', () => { sessionIdx = +b.dataset.s; renderCook(); }));
  const save = () => { localStorage.setItem(doneKey, JSON.stringify(done)); renderCook(); document.getElementById('ck-current')?.scrollIntoView({ block: 'center' }); };
  view.querySelector('.ck-next')?.addEventListener('click', () => { if (current !== undefined) { done = [...done, current]; save(); } });
  view.querySelector('.ck-prev')?.addEventListener('click', () => {
    const prev = Math.max(...done.filter(i => current === undefined || i < current), -1);
    if (prev >= 0) { done = done.filter(i => i !== prev); save(); }
  });
  view.querySelectorAll('[data-reopen]').forEach(b => b.addEventListener('click', () => { done = done.filter(i => i !== +b.dataset.reopen); save(); }));
  view.querySelector('.ck-restart')?.addEventListener('click', () => { done = []; save(); });
  view.querySelectorAll('[data-timer]').forEach(b => b.addEventListener('click', () => { startTimer(b.dataset.tlabel, +b.dataset.timer, +b.dataset.tstep); drawTimers(); }));
  view.querySelectorAll('[data-tstop-step]').forEach(b => b.addEventListener('click', () => { saveTimers(getTimers().filter(t => t.step !== +b.dataset.tstopStep)); drawTimers(); }));
  drawTimers();
  // fiche d'une recette : ouvre ou ferme sa liste d'ingrédients (pleine largeur quand elle est ouverte)
  view.querySelectorAll('[data-card]').forEach(b => b.addEventListener('click', () => {
    const card = b.closest('.ck-card'), open = !card.classList.contains('open');
    card.classList.toggle('open', open); b.setAttribute('aria-expanded', open);
  }));
  view.querySelectorAll('[data-rid]').forEach(b => b.addEventListener('click', e => {
    e.preventDefault();
    renderRecipeDetail(getById(b.dataset.rid), 'cook');
  }));
}


// ──────────────────────────────────────────────
// js/recipes.js
// ──────────────────────────────────────────────

const FILTERS = [
  { key: 'all',    label: 'Tout'        },
  { key: 'main',   label: 'Plats'       },
  { key: 'breakfast', label: 'Petits-déjeuners' },
  { key: 'sweet',  label: 'Collations'  },
  { key: 'side',   label: 'Compléments' },
];

const PROT_FILTERS = [
  { key: 'all',        label: 'Toutes', emoji: '' },
  { key: 'poulet',     label: 'Poulet', emoji: '🍗' },
  { key: 'boeuf',      label: 'Bœuf', emoji: '🥩' },
  { key: 'saumon',     label: 'Poisson', emoji: '🐟' },
  { key: 'crevettes',  label: 'Crevettes', emoji: '🦐' },
  { key: 'tofu',       label: 'Végé', emoji: '🌱' },
];

const TASTES = [
  { key: 'all',   label: 'Tout' },
  { key: 'sucre', label: 'Sucré' },
  { key: 'sale',  label: 'Salé' },
];
const recipeProtein = proteinFamily;

function renderRecipes() {
  const app = document.getElementById('app');
  app.querySelector('.view')?.remove();

  const view = el('div', 'view recipes-view');

  // onglet à part entière : un titre, comme Cuisiner et Courses
  const head = el('div', 'hb-tab-head', `<div class="hb-page-title">Recettes</div>`);
  view.appendChild(head);
  const top = el('div', 'recipes-top');
  const search = el('input', 'search-bar');
  search.placeholder = 'Rechercher une recette…';
  search.value = state.searchQuery || '';

  // Deux menus déroulants : catégorie et protéine
  const activeProt = state.filterProtein || 'all';
  const activeCat = state.filterCategory || 'all';
  const activeTaste = state.filterTaste || 'all';
  const opt = (list, cur) => list.map(f => `<option value="${f.key}" ${cur === f.key ? 'selected' : ''}>${f.label}</option>`).join('');
  const filters = el('div', 'rc-filters', `
    <label class="rc-select ${activeCat !== 'all' ? 'on' : ''}"><span>Catégorie</span><select data-f="cat">${opt(FILTERS, activeCat)}</select></label>
    <label class="rc-select ${activeProt !== 'all' ? 'on' : ''}"><span>Protéine</span><select data-f="prot">${opt(PROT_FILTERS, activeProt)}</select></label>
    <label class="rc-select ${activeTaste !== 'all' ? 'on' : ''}"><span>Goût</span><select data-f="taste">${opt(TASTES, activeTaste)}</select></label>`);
  filters.querySelectorAll('select').forEach(sel => sel.addEventListener('change', () => {
    setState(sel.dataset.f === 'cat' ? { filterCategory: sel.value } : sel.dataset.f === 'taste' ? { filterTaste: sel.value } : { filterProtein: sel.value });
    sel.closest('.rc-select').classList.toggle('on', sel.value !== 'all');
    renderList(search.value);
  }));
  const count = el('div', 'rc-count');

  top.appendChild(search);
  top.appendChild(filters);
  top.appendChild(count);
  view.appendChild(top);

  const list = el('div', 'recipe-list');
  view.appendChild(list);

  function renderList(query) {
    const cat = state.filterCategory || 'all';
    const prot = state.filterProtein || 'all';
    const noWhey = getActiveMember().whey === false;
    const filtered = RECIPES.filter(r => {
      // ni accompagnements retirés, ni repas libres ou cantine, et une seule version de chaque recette (avec ou sans whey)
      if (r.retired || r.category === 'extra' || (r.tags || []).includes('cantine')) return false;
      if (noWhey ? hasWhey(r) : (r.tags || []).includes('sans-whey')) return false;
      if (!dietOk(r, getActiveMember().lactose || 0, getActiveMember().gluten || 0)) return false;
      const matchCat = !(r.tags || []).includes('imprevu') && (cat === 'all' || r.category === cat || (cat === 'main' && (r.category === 'dinner' || r.category === 'lunch') && !(r.tags || []).includes('cantine')));
      const matchProt = prot === 'all' || recipeProtein(r) === prot;
      const sweet = (r.tags || []).includes('sucré');
      const taste = state.filterTaste || 'all';
      const matchTaste = taste === 'all' || (taste === 'sucre' ? sweet : !sweet);
      const matchQ   = r.name.toLowerCase().includes(query.toLowerCase()) ||
                       r.tags?.some(t => t.includes(query.toLowerCase()));
      return matchCat && matchProt && matchTaste && matchQ;
    });

    count.textContent = `${filtered.length} recette${filtered.length > 1 ? 's' : ''}`;
    list.innerHTML = filtered.length ? filtered.map(r => `
      <div class="recipe-card fam-${recipeProtein(r)} cat-${r.category}" data-id="${r.id}">
        ${dishThumbRated(r, 'rc')}
        <div class="rc-info">
          <div class="rc-name">${r.name}</div>
          <div class="rc-meta">${(mm => `${Math.round(mm.kcal)} kcal · ${Math.round(mm.protein)} g prot.`)(myMacros(r))} · ${r.prepTime + r.cookTime} min</div>
        </div>
        <span class="rc-arrow">›</span>
      </div>`).join('') : '<div class="no-results">Aucune recette trouvée.</div>';

    list.querySelectorAll('.recipe-card').forEach(card => {
      card.addEventListener('click', () => {
        const recipe = RECIPES.find(r => r.id === card.dataset.id);
        if (recipe) renderRecipeDetail(recipe, 'recipes');
      });
    });
  }

  renderList(state.searchQuery || '');
  search.addEventListener('input', e => { setState({ searchQuery: e.target.value }); renderList(e.target.value); });

  app.insertBefore(view, app.querySelector('#nav'));
}

// v195 : calories de ta portion réelle (celle de ta semaine, sinon calculée pour toi), gardées en mémoire le temps d'une visite
const MY_MACROS = new Map();
function myMacros(r) {
  const key = r.id + '|' + (localStorage.getItem('hebe_week_plan') || '').length;
  if (!MY_MACROS.has(key)) { const pf = portionFor(r.id); MY_MACROS.set(key, pf ? itemMacros(pf.item) : r.macros); }
  return MY_MACROS.get(key);
}


// ──────────────────────────────────────────────
// js/shopping.js
// ──────────────────────────────────────────────
// shopping.js — Liste de courses
// Source : soit une plage de dates choisie depuis la vue Semaine (diet_shop_range),
// soit les N derniers jours. Les quantités sont multipliées par les portions (servings).


// Petit anneau de progression « articles cochés » pour le héro de la liste.
function shopRing(done, total) {
  const size = 84, sw = 8, r = (size - sw) / 2, c = 2 * Math.PI * r;
  const ratio = total ? Math.min(done / total, 1) : 0;
  const dash = (ratio * c).toFixed(1);
  const cx = size / 2;
  const complete = total && done >= total;
  return `
    <div class="shop-ring-wrap" style="width:${size}px;height:${size}px">
      <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
        <defs>
          <linearGradient id="shopRingGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#A9C2B2"/>
            <stop offset="100%" stop-color="#6E8B76"/>
          </linearGradient>
        </defs>
        <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="var(--s3)" stroke-width="${sw}"/>
        <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="url(#shopRingGrad)" stroke-width="${sw}"
          stroke-linecap="round" stroke-dasharray="${dash} ${c.toFixed(1)}"
          transform="rotate(-90 ${cx} ${cx})" class="shop-ring-arc"/>
      </svg>
      <div class="shop-ring-center">
        ${complete
          ? `<div class="shop-ring-check">✓</div><div class="shop-ring-lbl">terminé</div>`
          : `<div class="shop-ring-num"><span>${done}</span>/${total}</div><div class="shop-ring-lbl">cochés</div>`}
      </div>
    </div>`;
}

// Placard : produits que tu as déjà (épices, huile, whey…), mémorisés d'une semaine à l'autre
const PANTRY_KEY = 'hebe_pantry_have';
const getPantry = () => { try { return JSON.parse(localStorage.getItem(PANTRY_KEY) || '[]'); } catch { return []; } };
const savePantry = a => localStorage.setItem(PANTRY_KEY, JSON.stringify(a));
const PANTRY_CAT = 'Placard : à vérifier';

// Articles cochés : propres à chaque plan généré
const checkedKey = plan => 'diet_shopping_checked_' + (plan?.generatedAt || 'x');
const getChecked  = plan => JSON.parse(localStorage.getItem(checkedKey(plan)) || '[]');
const saveChecked = (plan, a) => localStorage.setItem(checkedKey(plan), JSON.stringify(a));

// Catégorisation simple pour grouper la liste
// Ordre d'affichage des rayons (les noms doivent correspondre à categorize()).
const CATEGORIES = [
  { name: 'Viandes & poisson' },
  { name: 'Œufs & laitages' },
  { name: 'Légumes & fruits' },
  { name: 'Féculents & légumineuses' },
  { name: 'Épicerie & placard' },
  { name: 'Placard : à vérifier' },
];

// Icônes SVG par rayon (line-art, dans l'ordre des CATEGORIES).
const CAT_ICONS = [
  // Viandes & poisson — poisson stylisé
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12c3-5 9-6 14-3 2 1.2 4 3 4 3s-2 1.8-4 3c-5 3-11 2-14-3z"/><path d="M17 9.5l3-2.5M17 14.5l3 2.5"/><circle cx="8" cy="11" r="1"/></svg>',
  // Œufs & laitages — bouteille de lait
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6v3l2 4v10a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V10l2-4z"/><line x1="7" y1="13" x2="17" y2="13"/></svg>',
  // Légumes & fruits — feuille/pomme
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 7c-1-3-4-4-7-3 0 4 2 7 7 7"/><path d="M12 21c-3 0-5-2-5-6 0-3 2-5 5-5s5 2 5 5c0 4-2 6-5 6z"/></svg>',
  // Féculents — épi de blé
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="22" x2="12" y2="9"/><path d="M12 9c0-2-2-3-2-5 1 0 2 .5 2 2 0-1.5 1-2 2-2 0 2-2 3-2 5z"/><path d="M12 13c-1-1.5-3-1.5-4-1 .3 1.6 1.8 2.5 4 2.5M12 13c1-1.5 3-1.5 4-1-.3 1.6-1.8 2.5-4 2.5"/><path d="M12 17c-1-1.5-3-1.5-4-1 .3 1.6 1.8 2.5 4 2.5M12 17c1-1.5 3-1.5 4-1-.3 1.6-1.8 2.5-4 2.5"/></svg>',
  // Épicerie — sachet/pot
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 8h10l1 12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z"/><path d="M9 8V5a3 3 0 0 1 6 0v3"/></svg>',
  // Placard — étagère
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="1.5"/><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/></svg>',
];

// Regroupe les variantes d'un même produit en un seul nom canonique,
// pour éviter les doublons dans la liste de courses (poulet / poulet cuit / poulet émincé…).
// On ne fusionne que des produits réellement identiques à l'achat.
const CANON = [
  // Mélanges d'assaisonnement (contiennent un "+") → placard, AVANT les règles produits
  { rx: /\+/i, name: 'Épices & aromates (placard)' },
  // Viandes / poisson
  { rx: /poulet/i,                          name: 'Blanc de poulet' },
  { rx: /steak hach|boeuf|b\u0153uf/i,        name: 'Steak haché 5%' },
  { rx: /poulet hach/i,                     name: 'Poulet haché' },
  { rx: /merguez/i,                         name: 'Merguez de volaille' },
  { rx: /thon/i,                            name: 'Thon au naturel' },
  { rx: /saumon/i,                          name: 'Saumon' },
  { rx: /colin|merlu|poisson blanc/i,       name: 'Poisson blanc (colin/merlu)' },
  { rx: /crevette/i,                        name: 'Crevettes décortiquées' },
  { rx: /anchois/i,                         name: 'Anchois' },
  { rx: /^bacon/i,                          name: 'Bacon' },
  // Oeufs & laitages
  { rx: /blancs? d'?oeuf/i,                 name: "Blancs d'oeuf" },
  { rx: /^oeufs?\b|oeufs? (durs?|poch)/i,    name: 'Oeufs' },
  { rx: /fromage blanc/i,                   name: 'Fromage blanc 0%' },
  { rx: /fromage frais/i,                   name: 'Fromage frais léger' },
  { rx: /^skyr/i,                           name: 'Skyr' },
  { rx: /ricotta/i,                         name: 'Ricotta' },
  { rx: /^feta/i,                           name: 'Feta' },
  { rx: /parmesan/i,                        name: 'Parmesan' },
  { rx: /emmental/i,                        name: 'Emmental allégé' },
  { rx: /lait de coco/i,                    name: 'Lait de coco light' },
  { rx: /lait \u00e9cr\u00e9m|lait ecrem/i,    name: 'Lait écrémé' },
  // Féculents & légumineuses
  { rx: /^p[âa]tes compl]?|^p[âa]tes/i,     name: 'Pâtes complètes' },
  { rx: /\borzo\b/i,                        name: 'Orzo' },
  { rx: /nouilles de riz/i,                 name: 'Nouilles de riz' },
  { rx: /riz basmati/i,                     name: 'Riz basmati' },
  { rx: /riz rond/i,                        name: 'Riz rond' },
  { rx: /^riz\b/i,                           name: 'Riz' },
  { rx: /boulgh?our|boulgour/i,             name: 'Boulghour' },
  { rx: /quinoa/i,                          name: 'Quinoa' },
  { rx: /flocons d'?avoine/i,               name: "Flocons d'avoine" },
  { rx: /lentilles corail/i,                name: 'Lentilles corail' },
  { rx: /lentilles vertes/i,                name: 'Lentilles vertes' },
  { rx: /pois chiches/i,                    name: 'Pois chiches' },
  { rx: /haricots rouges/i,                 name: 'Haricots rouges' },
  { rx: /haricots blancs/i,                 name: 'Haricots blancs' },
  { rx: /^ma\u00efs|^mais/i,                  name: 'Maïs' },
  { rx: /tortillas?/i,                      name: 'Tortillas blé complètes' },
  { rx: /pain complet/i,                    name: 'Pain complet' },
  { rx: /crackers/i,                        name: 'Crackers de seigle' },
  { rx: /chapelure/i,                       name: 'Chapelure' },
  // Légumes & fruits
  { rx: /haricots verts/i,                  name: 'Haricots verts' },
  { rx: /^[ée\u00e9]pinards/i,                name: 'Épinards' },
  { rx: /^courgettes?/i,                    name: 'Courgettes' },
  { rx: /chou-fleur/i,                      name: 'Chou-fleur' },
  { rx: /chou blanc/i,                      name: 'Chou blanc' },
  { rx: /^brocoli/i,                        name: 'Brocoli' },
  { rx: /champignons/i,                     name: 'Champignons de Paris' },
  { rx: /^carottes?/i,                      name: 'Carottes' },
  { rx: /^concombre/i,                      name: 'Concombre' },
  { rx: /tomates cerise/i,                  name: 'Tomates cerise' },
  { rx: /tomates concass/i,                 name: 'Tomates concassées' },
  { rx: /^tomates?$/i,                      name: 'Tomates' },
  { rx: /^poivrons?/i,                      name: 'Poivron' },
  { rx: /patate douce/i,                    name: 'Patate douce' },
  { rx: /pommes de terre/i,                 name: 'Pommes de terre' },
  { rx: /betterave/i,                       name: 'Betterave cuite' },
  { rx: /^salade|laitue|romaine/i,          name: 'Salade verte' },
  { rx: /avocat/i,                          name: 'Avocat' },
  { rx: /oignon rouge/i,                    name: 'Oignon rouge' },
  { rx: /^oignon/i,                         name: 'Oignon' },
  { rx: /citron vert/i,                     name: 'Citron vert' },
  { rx: /citron|jus.*zeste|zeste.*citron/i, name: 'Citron' },
  { rx: /^banane/i,                         name: 'Banane' },
  { rx: /mangue/i,                          name: 'Mangue surgelée' },
  { rx: /^pommes?\b/i,                       name: 'Pommes' },
  { rx: /fruits rouges/i,                   name: 'Fruits rouges surgelés' },
  { rx: /framboises/i,                      name: 'Framboises surgelées' },
  { rx: /fruit de la passion/i,             name: 'Fruit de la passion' },
  { rx: /dattes/i,                          name: 'Dattes dénoyautées' },
  { rx: /\bgingembre\b/i,                   name: 'Gingembre frais' },
  { rx: /^ail\b/i,                           name: 'Ail' },
  { rx: /olives noires/i,                   name: 'Olives noires' },
  { rx: /olives vertes/i,                   name: 'Olives vertes' },
  { rx: /câpres|capres/i,                   name: 'Câpres' },
  { rx: /cornichons/i,                      name: 'Cornichons' },
  { rx: /piment rouge/i,                    name: 'Piment rouge' },
  // Herbes fraîches (regroupées)
  { rx: /coriandre fra/i,                   name: 'Coriandre fraîche' },
  { rx: /persil/i,                          name: 'Persil frais' },
  { rx: /menthe fra|^menthe/i,              name: 'Menthe fraîche' },
  { rx: /basilic/i,                         name: 'Basilic frais' },
  { rx: /ciboulette/i,                      name: 'Ciboulette' },
  { rx: /thym frais/i,                      name: 'Thym frais' },
  // Épicerie / condiments / poudres (tout ce qui est sec/placard)
  { rx: /beurre de cacahu/i,                name: 'Beurre de cacahuète' },
  { rx: /^beurre\b/i,                        name: 'Beurre' },
  { rx: /tahini/i,                          name: 'Tahini' },
  { rx: /huile d'?olive/i,                  name: "Huile d'olive" },
  { rx: /huile de sésame|huile de sesame/i, name: 'Huile de sésame' },
  { rx: /huile de coco/i,                   name: 'Huile de coco' },
  { rx: /huile \+ |^huile/i,                 name: "Huile d'olive" },
  { rx: /miel/i,                            name: 'Miel' },
  { rx: /sauce soja|soja \+/i,              name: 'Sauce soja' },
  { rx: /sauce huîtres|sauce huitres/i,     name: 'Sauce huîtres' },
  { rx: /sauce worcester/i,                 name: 'Sauce Worcester' },
  { rx: /gochujang/i,                       name: 'Gochujang' },
  { rx: /sriracha/i,                        name: 'Sriracha' },
  { rx: /pâte de curry|pate de curry/i,     name: 'Pâte de curry vert' },
  { rx: /pâte de miso|pate de miso/i,       name: 'Pâte de miso' },
  { rx: /moutarde/i,                        name: 'Moutarde de Dijon' },
  { rx: /vinaigre balsamique|vinaigre \+/i, name: 'Vinaigre balsamique' },
  { rx: /citron confit/i,                   name: 'Citron confit' },
  { rx: /chocolat noir|pépites de chocolat|pepites/i, name: 'Chocolat noir 85%' },
  { rx: /cacao/i,                           name: 'Cacao non sucré' },
  { rx: /whey|protéine en poudre|proteine en poudre/i, name: 'Whey (protéine en poudre)' },
  { rx: /graines de chia/i,                 name: 'Graines de chia' },
  { rx: /noix de coco/i,                    name: 'Noix de coco râpée' },
  { rx: /cacahuètes|cacahuetes/i,           name: 'Cacahuètes non salées' },
  { rx: /sésame|sesame/i,                   name: 'Sésame' },
  { rx: /levure/i,                          name: 'Levure chimique' },
  { rx: /extrait de vanille|vanille/i,      name: 'Vanille' },
  { rx: /café|cafe expresso/i,              name: 'Café' },
  { rx: /biscuits? boudoir/i,               name: 'Biscuits boudoir' },
  { rx: /biscuits? type petit|petit beurre/i, name: 'Biscuits Petit Beurre' },
  // Épices & mélanges → tout en placard, regroupé par "Épices"
  { rx: /garam masala|tikka|ras el hanout|curry|curcuma|cumin|paprika|harissa|cannelle|origan|herbes de provence|herbes fra|épices|epices|ail en poudre|gingembre en poudre/i, name: 'Épices & aromates (placard)' },
  { rx: /^sel|^poivre|sel \+ poivre/i,      name: 'Sel & poivre' },
];

// Catégorie d'un produit (déjà canonisé) → rayon du magasin.
const CAT_RULES = [
  { name: 'Viandes & poisson',        rx: /poulet|boeuf|steak|merguez|thon|saumon|poisson|crevette|anchois|bacon/i },
  { name: 'Œufs & laitages',          rx: /oeuf|fromage|ricotta|feta|parmesan|emmental|skyr|lait|yaourt|beurre$/i },
  { name: 'Féculents & légumineuses', rx: /pâtes|riz|orzo|nouilles|boulghour|quinoa|flocons|lentilles|pois chiches|haricots (rouges|blancs)|maïs|tortillas|pain|crackers|chapelure/i },
  { name: 'Légumes & fruits',         rx: /haricots verts|épinards|courgettes|chou|brocoli|champignons|carottes|concombre|tomates?|poivron|patate|pommes de terre|betterave|salade|avocat|oignon|citron|banane|mangue|pommes|fruits rouges|framboises|passion|dattes|gingembre|ail$|olives|câpres|cornichons|piment|coriandre|persil|menthe|basilic|ciboulette|thym/i },
];

// Renvoie {name} canonique pour un ingrédient.
function canonical(ingName) {
  for (const c of CANON) {
    if (c.rx.test(ingName)) return c.name;
  }
  return null;
}

function categorize(name) {
  for (const cat of CAT_RULES) {
    if (cat.rx.test(name)) return cat.name;
  }
  return 'Épicerie & placard';
}

// Liste agrégée par ingrédient de la base (data/ingredients.js).
// Les anciennes recettes sans clé passent par l'ancien regroupement par nom (canonical()).
function buildList(dates) {
  const map = {};
  // toutes les personnes du foyer : une seule liste de courses
  const entries = planMembers(getActivePlan()).flatMap(mid => dates.map(date => getEntry(date, mid)));
  entries.forEach(entry => {
    ['breakfast','starter','lunch','dinner','sides','sweet'].forEach(slot => {
      (entry.meals[slot] || []).forEach(item => {
        const r = getById(item.id);
        if (!r) return;
        if ((r.tags || []).includes('cantine') || (r.tags || []).includes('imprevu')) return; // pas acheté
        const qs = itemQuantities(item);
        r.ingredients.forEach((ing, idx) => {
          const qty = qs[idx];
          if (!qty) return;
          const db = ing.key ? INGREDIENTS[ing.key] : null;
          const name = db ? db.name : (canonical(ing.name) || ing.name);
          const key = name.toLowerCase();
          if (!map[key]) map[key] = {
            name, qty: 0, unit: db ? db.unit : ing.unit, dbKey: db ? db.key : null,
            cat: db ? (db.pantry ? 'Placard : à vérifier' : db.rayon) : categorize(name),
          };
          map[key].qty += qty;
          if (ing.key === 'epices' && spicesOf(r.id)) { map[key].spices ||= new Set(); spicesOf(r.id).split(', ').forEach(x => map[key].spices.add(x)); }
        });
      });
    });
  });
  return Object.values(map);
}

// v195 : fruits et légumes comptés comme au magasin (pièces, bouquets, barquettes) au lieu de grammes.
// clé : [grammes (ou ml de jus) par pièce, singulier, pluriel, nom affiché, montrer le poids ≈]
const PIECES = {
  courgette: [250, 'courgette', 'courgettes', 'Courgettes'],
  poivron: [180, 'poivron', 'poivrons', 'Poivrons'],
  oignon: [120, 'oignon', 'oignons', 'Oignons', true],
  carotte: [100, 'carotte', 'carottes', 'Carottes', true],
  concombre: [350, 'concombre', 'concombres', 'Concombre'],
  tomates_cerise: [250, 'barquette de 250 g', 'barquettes de 250 g', 'Tomates cerise'],
  salade: [250, 'salade', 'salades', 'Salade verte'],
  champignons: [250, 'barquette de 250 g', 'barquettes de 250 g', 'Champignons de Paris'],
  avocat: [170, 'avocat', 'avocats', 'Avocats'],
  herbes: [30, 'bouquet', 'bouquets', 'Herbes fraîches (persil, coriandre…)'],
  citron: [35, 'citron', 'citrons', 'Citrons'],
  citron_vert: [25, 'citron vert', 'citrons verts', 'Citrons verts'],
  banane: [120, 'banane', 'bananes', 'Bananes', true],
  pomme: [150, 'pomme', 'pommes', 'Pommes', true],
  aubergine: [300, 'aubergine', 'aubergines', 'Aubergines'],
  tomate: [120, 'tomate', 'tomates', 'Tomates', true],
  chou_chinois: [800, 'chou chinois', 'choux chinois', 'Chou chinois'],
  fruit_saison: [150, 'fruit', 'fruits', 'Fruits de saison', true],
  radis: [250, 'botte', 'bottes', 'Radis'],
};

// Quantité à acheter, arrondie au format du commerce.
function toPurchase(item) {
  const db = item.dbKey ? INGREDIENTS[item.dbKey] : null;
  const q = item.qty;
  if (db && PIECES[db.key]) {
    const [g, one, many, label, approx] = PIECES[db.key];
    const n = Math.max(1, Math.ceil(q / g - 0.15));
    const w = Math.round(q / 50) * 50;
    return { qty: n, unit: `${n > 1 ? many : one}${approx && w >= 100 ? ` · ≈ ${w >= 1000 ? String(Math.round(w / 100) / 10).replace('.', ',') + ' kg' : w + ' g'}` : ''}`, name: label };
  }
  // en tranches / à la pièce (pain, blanc de poulet, cheddar, pains burger)
  if (db && NATURAL_UNITS[db.key]) {
    const nu = NATURAL_UNITS[db.key];
    const n = Math.max(1, Math.ceil(q / nu.g - 0.05));
    if (!db.pack) return { qty: n, unit: n > 1 ? nu.many : nu.one };
    const per = Math.round(db.pack / nu.g), packs = Math.ceil(n / per);
    const box = nu.box || 'paquet';
    return { qty: n, unit: `${n > 1 ? nu.many : nu.one} · ${packs} ${box}${packs > 1 ? 's' : ''} de ${per}` };
  }
  if (db && db.pantry) return { qty: '', unit: `${Math.ceil(q)} ${db.unit === 'pièce' ? 'pièce(s)' : db.unit} utilisés` };
  if (item.unit === 'pièce') {
    const n = Math.ceil(q - 0.01);
    if (db && db.pack) return { qty: n, unit: `pièces · ${Math.ceil(n / db.pack)} boîte${Math.ceil(n / db.pack) > 1 ? 's' : ''} de ${db.pack}` };
    return { qty: n, unit: 'pièces' };
  }
  if (db && db.snap) {
    // viandes et poissons : le total tombe sur des barquettes entières (voir weekgen.snapToPacks),
    // éventuellement en combinant les formats vendus (ex. 500 g + 250 g)
    const sizes = db.packs || [db.pack];
    const unit = Math.min(...sizes);
    let left = Math.max(unit, Math.ceil(q / unit - 0.02) * unit);
    const total = left;
    const parts = [];
    sizes.forEach(sz => { const k = Math.floor(left / sz + 1e-6); if (k > 0) { parts.push([k, sz]); left -= k * sz; } });
    const word = ['saumon'].includes(db.key) ? 'paquet' : ['poisson_blanc', 'crevettes'].includes(db.key) ? 'sachet' : db.key === 'tofu' ? 'bloc' : 'barquette';
    const fmt = total >= 1000 ? `${String(total / 1000).replace('.', ',')} kg` : `${total} g`;
    const txt = parts.map(([k, sz], i) => i === 0 ? `${k} ${word}${k > 1 ? 's' : ''} de ${sz} g` : `${k} de ${sz} g`).join(' et ');
    const rest = Math.round((total - q) / 10) * 10;
    return { qty: fmt, unit: `· ${txt}${rest >= 50 ? `, il restera ${rest} g à congeler` : ''}` };
  }
  if (db && db.pack) {
    const n = Math.max(1, Math.ceil(q / db.pack - 0.05));
    const fmt = db.pack >= 1000 ? `${db.pack / 1000} ${db.unit === 'ml' ? 'L' : 'kg'}` : `${db.pack} ${db.unit}`;
    return { qty: Math.round(q), unit: `${db.unit} · ${n} × ${fmt}` };
  }
  if (q >= 1000) return { qty: (Math.ceil(q / 100) / 10).toString().replace('.', ','), unit: db && db.unit === 'ml' ? 'L' : 'kg' };
  return { qty: Math.ceil(q / 50) * 50, unit: item.unit };
}

// v195 : coût de ce qu'on achète vraiment (paquets entiers), affiché en haut de la liste
function listCost(items) {
  return items.reduce((a, it) => {
    const db = it.dbKey && INGREDIENTS[it.dbKey];
    if (!db || db.pantry) return a;
    const P = db.pack || db.buy;
    const q = P ? Math.max(1, Math.ceil(it.qty / P - 0.05)) * P : it.qty;
    return a + ingCost(it.dbKey, q);
  }, 0);
}

function renderShopping() {
  const app = document.getElementById('app');
  const plan = getActivePlan();
  let checked = getChecked(plan);

  function render() {
    app.querySelector('.view')?.remove();
    const view = el('div', 'view shopping-view');
    if (!plan) {
      view.innerHTML = `
        <div class="hb-page-title">Courses</div>
        <div class="hb-card hb-empty">
          <div class="hb-h3">Pas encore de liste</div>
          <p class="hb-p">Génère ta semaine : la liste se remplit avec les bons formats de magasin.</p>
          <button class="hb-btn hb-btn-primary" data-go="week">Préparer ma semaine</button>
        </div>`;
      app.insertBefore(view, app.querySelector('#nav'));
      view.querySelector('[data-go]').addEventListener('click', () => window._nav?.('week'));
      return;
    }
    const pantry = getPantry();
    const all = buildList(plan.dates).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    // produits du placard que tu as déjà : retirés de la liste
    const haveList = all.filter(it => it.cat === PANTRY_CAT && pantry.includes(it.name.toLowerCase()));
    const items = all.filter(it => !haveList.includes(it));
    const done = checked.filter(k => items.some(i => i.name.toLowerCase() === k)).length;
    const grouped = {};
    items.forEach(it => { (grouped[it.cat] ||= []).push(it); });
    const start = new Date(plan.dates[0] + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

    view.innerHTML = `
      <div class="shop-head">
        <div class="hb-page-title">Courses</div>
        <div class="shop-card ${items.length && done === items.length ? 'all-done' : ''}">
          <div class="shop-card-top">
            <div>
              <div class="shop-meta">${sessionDate(plan) >= getTodayDate() ? `Pour ta session ${sessionWhen(plan) === "aujourd'hui" ? "d'aujourd'hui" : sessionWhen(plan) === 'demain' ? 'de demain' : 'du ' + sessionWhen(plan, { short: true })}` : `Semaine du ${start}`}</div>
              <div class="shop-count"><b>${done}</b><span>/ ${items.length} produits</span></div>
              <div class="shop-cost">≈ ${Math.round(listCost(items))} € estimés <small>(prix Lidl moyens)</small></div>
            </div>
            ${done > 0 ? '<button class="clear-btn">Tout décocher</button>' : ''}
          </div>
          <div class="shop-bar"><i style="width:${items.length ? done / items.length * 100 : 0}%"></i></div>
          ${items.length && done === items.length
            ? '<div class="shop-tip done">Tout est dans ton panier. Courses terminées !</div>'
            : done === 0 ? `<div class="shop-tip"><span class="shop-tip-check" aria-hidden="true"></span>Coche chaque produit au fur et à mesure que tu le mets dans ton panier.</div>` : ''}
        </div>
      </div>
      <div class="shopping-list">
        ${CATEGORIES.map((c, ci) => {
          const list = grouped[c.name] || [];
          const isPantry = c.name === PANTRY_CAT;
          if (!list.length && !(isPantry && haveList.length)) return '';
          const doneInCat = list.filter(it => checked.includes(it.name.toLowerCase())).length;
          return `
            <div class="shop-cat cat-c-${ci}">
              <div class="shop-cat-head">
                <span class="shop-cat-ic">${CAT_ICONS[ci] || ''}</span>
                <span class="shop-cat-name">${c.name}</span>
                <span class="shop-cat-count">${list.length ? `${doneInCat}/${list.length}` : ''}</span>
              </div>
              <div class="shop-group">
              ${list.map(item => {
                const key = item.name.toLowerCase();
                const isChecked = checked.includes(key);
                const p = toPurchase(item);
                return `<div class="shop-item ${isChecked ? 'done' : ''}" data-key="${key}" role="button" tabindex="0">
                  <div class="shop-check ${isChecked ? 'checked' : ''}"></div>
                  <div class="shop-info">
                    <div class="shop-name">${p.name || item.name}</div>
                    <div class="shop-qty">${isPantry ? (item.spices ? `Vérifie : ${[...item.spices].sort((a, b) => a.localeCompare(b, 'fr')).join(', ')}` : 'Vérifie ton placard') : `${p.qty} ${p.unit}`}</div>
                  </div>
                  ${isPantry ? `<button class="shop-have" data-have="${key}">J'en ai</button>` : ''}
                </div>`;
              }).join('')}
              </div>
              ${isPantry && haveList.length ? `
                <div class="shop-pantry">
                  <div class="shop-pantry-h">Déjà chez toi. Touche un produit s'il faut le racheter.</div>
                  <div class="shop-pantry-chips">${haveList.map(it => `<button class="shop-chip" data-rebuy="${it.name.toLowerCase()}">${it.name}</button>`).join('')}</div>
                </div>` : ''}
            </div>`;
        }).join('')}
      </div>`;
    view.querySelector('.clear-btn')?.addEventListener('click', () => { checked = []; saveChecked(plan, checked); render(); });
    view.querySelectorAll('[data-have]').forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation();
      savePantry([...new Set([...getPantry(), btn.dataset.have])]);
      render();
      toast('Mémorisé : il ne reviendra plus dans tes listes');
    }));
    view.querySelectorAll('[data-rebuy]').forEach(btn => btn.addEventListener('click', () => {
      savePantry(getPantry().filter(k => k !== btn.dataset.rebuy));
      render();
      toast('Remis dans ta liste de courses');
    }));
    view.querySelectorAll('.shop-item').forEach(row => row.addEventListener('click', () => {
      const key = row.dataset.key;
      checked = checked.includes(key) ? checked.filter(k => k !== key) : [...checked, key];
      saveChecked(plan, checked);
      render();
    }));
    app.insertBefore(view, app.querySelector('#nav'));
  }
  render();
}


// ──────────────────────────────────────────────
// js/bodyfat.js
// ──────────────────────────────────────────────
// bodyfat.js — Aide visuelle pour estimer sa masse grasse, en version homme et en version femme.
// Les silhouettes sont dessinées en SVG : la taille s'épaissit et les abdos s'estompent avec le %.


const LEVELS_M = [
  { bf: 8,  desc: 'Abdos très marqués' },
  { bf: 10, desc: 'Abdos dessinés' },
  { bf: 15, desc: 'Abdos visibles' },
  { bf: 20, desc: 'Ventre plat' },
  { bf: 25, desc: 'Léger ventre' },
  { bf: 30, desc: 'Ventre arrondi' },
  { bf: 35, desc: 'Ventre marqué' },
  { bf: 40, desc: 'Ventre proéminent' },
];
// Chez une femme, la masse grasse essentielle est plus élevée : les repères sont décalés.
const LEVELS_F = [
  { bf: 12, desc: 'Abdos très marqués' },
  { bf: 16, desc: 'Silhouette athlétique' },
  { bf: 20, desc: 'Abdos légers' },
  { bf: 25, desc: 'Ventre plat' },
  { bf: 30, desc: 'Hanches pleines' },
  { bf: 35, desc: 'Léger ventre' },
  { bf: 40, desc: 'Ventre arrondi' },
  { bf: 45, desc: 'Ventre proéminent' },
];
const bodyfatLevels = sex => (sex === 'female' ? LEVELS_F : LEVELS_M);
const bodyfatRange = sex => {
  const l = bodyfatLevels(sex);
  return `de ${l[0].bf} à ${l[l.length - 1].bf} %`;
};

// Silhouette selon le sexe
function torso(bf, sex) {
  return sex === 'female' ? torsoF(bf) : torsoM(bf);
}

// Silhouette paramétrée par le % de masse grasse
function torsoM(bf) {
  const t = (bf - 8) / 32;                  // 8 % → 0, 40 % → 1
  const cx = 60;
  const chest = 37 + t * 3;
  const waist = 23 + t * 24;               // la taille s'élargit nettement
  const hips = 30 + t * 14;
  const belly = Math.max(0, bf - 22) * 0.55; // ventre qui déborde sur les côtés
  const side = (sgn) => {
    const x = v => cx + sgn * v;
    return [
      `C ${x(14)} 20, ${x(40)} 18, ${x(45)} 28`,          // épaule
      `C ${x(44)} 34, ${x(chest + 1)} 40, ${x(chest)} 46`, // aisselle
      `C ${x(chest - 2)} 64, ${x(waist + 2)} 78, ${x(waist)} 92`,  // flanc → taille
      `C ${x(waist + belly)} 104, ${x(hips + belly * .6)} 114, ${x(hips)} 128`, // hanches
    ];
  };
  const L = side(-1), R = side(1);
  // contour : cou gauche → côté gauche → bas → côté droit (inversé) → cou droit
  const path = `M ${cx - 9} 6 L ${cx - 9} 14 ${L.join(' ')} L ${cx + hips} 128
    C ${cx + hips + belly * .6} 114, ${cx + waist + belly} 104, ${cx + waist} 92
    C ${cx + waist + 2} 78, ${cx + chest - 2} 64, ${cx + chest} 46
    C ${cx + chest + 1} 40, ${cx + 44} 34, ${cx + 45} 28
    C ${cx + 40} 18, ${cx + 14} 20, ${cx + 9} 14 L ${cx + 9} 6 Z`;
  const absOp = Math.max(0, 1 - t * 2.6);   // abdos : visibles jusqu'à ~20 %
  const pecOp = Math.max(.15, 1 - t * 1.4);
  const abs = [70, 81, 92].map(y => `
    <path d="M ${cx - 11} ${y} Q ${cx - 6} ${y + 2} ${cx - 1.5} ${y}" />
    <path d="M ${cx + 1.5} ${y} Q ${cx + 6} ${y + 2} ${cx + 11} ${y}" />`).join('');
  const overhang = bf >= 28 ? `<path d="M ${cx - waist - belly * .4} 112 Q ${cx} ${121 + (bf - 28) * .5} ${cx + waist + belly * .4} 112" opacity="${Math.min(.7, (bf - 26) / 10)}"/>` : '';
  return `<svg viewBox="0 0 120 150" class="bf-svg" aria-hidden="true">
    <path d="${path}" class="bf-skin"/>
    <g class="bf-lines" opacity="${pecOp}">
      <path d="M ${cx - 30} ${50 + t * 6} Q ${cx - 16} ${60 + t * 9} ${cx - 2} ${54 + t * 6}" /><path d="M ${cx + 30} ${50 + t * 6} Q ${cx + 16} ${60 + t * 9} ${cx + 2} ${54 + t * 6}" />
    </g>
    <g class="bf-lines" opacity="${absOp}">
      <path d="M ${cx} 60 L ${cx} 100" />${abs}
    </g>
    <g class="bf-lines">${overhang}<ellipse cx="${cx}" cy="${103 + t * 3}" rx="1.6" ry="${2 + t}" class="bf-navel"/></g>
    <path d="M ${cx - hips - 1} 126 L ${cx + hips + 1} 126 L ${cx + hips + 4} 150 L ${cx - hips - 4} 150 Z" class="bf-shorts"/>
  </svg>`;
}

// Silhouette féminine : épaules plus étroites, taille plus fine, hanches plus larges, brassière.
function torsoF(bf) {
  const t = Math.min(1, Math.max(0, (bf - 12) / 33)); // 12 % → 0, 45 % → 1
  const cx = 60;
  const chest = 31 + t * 5;
  const waist = 21 + t * 20;
  const hips = 34 + t * 16;
  const belly = Math.max(0, bf - 28) * 0.6;
  const L = v => cx - v, R = v => cx + v;
  const path = `M ${L(7.5)} 6 L ${L(7.5)} 15
    C ${L(12)} 20, ${L(32)} 19, ${L(37)} 28
    C ${L(37)} 34, ${L(chest + 1)} 40, ${L(chest)} 47
    C ${L(chest - 2)} 64, ${L(waist + 1)} 76, ${L(waist)} 88
    C ${L(waist + belly)} 100, ${L(hips + belly * .4)} 110, ${L(hips)} 128
    L ${R(hips)} 128
    C ${R(hips + belly * .4)} 110, ${R(waist + belly)} 100, ${R(waist)} 88
    C ${R(waist + 1)} 76, ${R(chest - 2)} 64, ${R(chest)} 47
    C ${R(chest + 1)} 40, ${R(37)} 34, ${R(37)} 28
    C ${R(32)} 19, ${R(12)} 20, ${R(7.5)} 15 L ${R(7.5)} 6 Z`;
  // brassière : bretelles, encolure arrondie, bande sous la poitrine
  const band = 63 + t * 2;
  const bra = `M ${L(chest - .5)} 47 C ${L(chest - 1)} 53, ${L(chest - 1.5)} 59, ${L(chest - 2)} ${band}
    L ${R(chest - 2)} ${band} C ${R(chest - 1.5)} 59, ${R(chest - 1)} 53, ${R(chest - .5)} 47
    L ${R(20)} 26 L ${R(15)} 25 C ${R(14)} 36, ${R(8)} 43, ${cx} 44
    C ${L(8)} 43, ${L(14)} 36, ${L(15)} 25 L ${L(20)} 26 Z`;
  const absOp = Math.max(0, 1 - t * 2.4);    // abdos : visibles jusqu'à ~25 %
  const abs = [74, 84].map(y => `
    <path d="M ${cx - 9} ${y} Q ${cx - 5} ${y + 1.6} ${cx - 1.5} ${y}" />
    <path d="M ${cx + 1.5} ${y} Q ${cx + 5} ${y + 1.6} ${cx + 9} ${y}" />`).join('');
  const overhang = bf >= 36 ? `<path d="M ${cx - waist - belly * .3} 112 Q ${cx} ${119 + (bf - 36) * .45} ${cx + waist + belly * .3} 112" opacity="${Math.min(.65, (bf - 34) / 10)}"/>` : '';
  return `<svg viewBox="0 0 120 150" class="bf-svg" aria-hidden="true">
    <path d="${path}" class="bf-skin"/>
    <path d="${bra}" class="bf-shorts"/>
    <path d="M ${cx - 10} ${band - 6} Q ${cx} ${band - 3} ${cx + 10} ${band - 6}" class="bf-fold"/>
    <g class="bf-lines" opacity="${absOp}">
      <path d="M ${cx} ${band + 5} L ${cx} 96" />${abs}
    </g>
    <g class="bf-lines">${overhang}<ellipse cx="${cx}" cy="${101 + t * 3}" rx="1.5" ry="${1.9 + t}" class="bf-navel"/></g>
    <path d="M ${cx - hips - 1} 126 L ${cx + hips + 1} 126 L ${cx + hips + 5} 150 L ${cx - hips - 5} 150 Z" class="bf-shorts"/>
  </svg>`;
}

function openBodyfatGuide(current, onPick, sex = 'male') {
  const LEVELS = bodyfatLevels(sex);
  const closest = LEVELS.reduce((a, l) => Math.abs(l.bf - current) < Math.abs(a.bf - current) ? l : a, LEVELS[0]).bf;
  openSheet(`
    <div class="sheet-handle"></div>
    <div class="hb-sheet-pad">
      <div class="hb-h2">Estimer ta masse grasse</div>
      <p class="hb-p">Touche la silhouette qui te ressemble le plus.</p>
      <div class="bf-grid">
        ${LEVELS.map(l => `
          <button class="bf-card ${l.bf === closest ? 'on' : ''}" data-bf="${l.bf}">
            ${torso(l.bf, sex)}
            <span class="bf-val">${l.bf} %</span>
            <span class="bf-desc">${l.desc}</span>
          </button>`).join('')}
      </div>
      <p class="bf-note">${sex === 'female' ? 'Entre 21 et 31 %, c\'est la moyenne chez une femme. ' : ''}Une estimation à ± 3 % suffit.</p>
      <button class="hb-btn bf-close">Fermer</button>
    </div>`);
  const sheet = document.getElementById('sheet');
  sheet.querySelector('.bf-close').addEventListener('click', closeSheet);
  sheet.querySelectorAll('[data-bf]').forEach(b => b.addEventListener('click', () => {
    closeSheet();
    onPick(+b.dataset.bf);
  }));
}


// ──────────────────────────────────────────────
// js/profileUi.js
// ──────────────────────────────────────────────
// profileUi.js — Morceaux d'interface partagés entre « Mon programme » et l'accueil.
// Même rendu aux deux endroits : mesures, prénom et sexe, activité, cartes des programmes.


const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Case de mesure avec − et +
function pcell(key, label, value, unit, step) {
  const shown = value ?? '';
  return `
    <div class="profile-cell">
      <div class="pc-label">${label}</div>
      <div class="pc-control">
        <button class="pcell-btn" data-key="${key}" data-delta="-${step}" aria-label="${label} : moins">−</button>
        <div class="pc-value"><input class="pcell-input" type="text" inputmode="decimal" data-key="${key}" value="${shown}" placeholder="–" aria-label="${label}" style="width:${Math.max(1, String(shown).length) + 0.2}ch"><span class="pc-unit">${unit}</span></div>
        <button class="pcell-btn" data-key="${key}" data-delta="${step}" aria-label="${label} : plus">+</button>
      </div>
    </div>`;
}

function measuresGrid(p) {
  return `<div class="profile-grid">
    ${pcell('age', 'Âge', p.age, 'ans', 1)}
    ${pcell('height', 'Taille', p.height, 'm', 0.01)}
    ${pcell('weight', 'Poids', p.weight, 'kg', 0.5)}
    ${pcell('bodyfat', 'Masse grasse', p.bodyfat, '%', 1)}
  </div>`;
}

function bodyfatButton(sex) {
  sex = sex || 'male';
  return `<button class="bf-guide-btn">
    <span class="bf-guide-ic">${torso(sex === 'female' ? 25 : 20, sex)}</span>
    <span><b>Estimer ta masse grasse en images</b><span>Compare-toi à des silhouettes ${bodyfatRange(sex)}</span></span>
    <span class="hb-chev">›</span>
  </button>`;
}

// Illustrations (dessins vectoriels légers, même esprit que les silhouettes du guide)
// Portraits : les mêmes personnages que l'illustration du foyer (lui à lunettes et barbe, elle aux cheveux ondulés).
// Calculés à l'appel (les fonctions de dessin sont définies plus bas dans ce fichier).
const avFrame = (inner, id) => `<svg viewBox="0 0 200 196" class="av-svg" aria-hidden="true"><defs><clipPath id="${id}"><circle cx="100" cy="100" r="92"/></clipPath></defs><circle cx="100" cy="100" r="92" fill="#fff" opacity=".7"/><g clip-path="url(#${id})">${inner}</g></svg>`;
let avSeq = 0;
const AV_NONE = `<svg viewBox="0 0 200 196" class="av-svg" aria-hidden="true"><circle cx="100" cy="100" r="92" fill="#fff" opacity=".7"/>
  <path d="M40 196 C42 150 66 134 100 134 C134 134 158 150 160 196 Z" fill="#A9C2B2"/><circle cx="100" cy="80" r="32" fill="#D4DBCB"/></svg>`;
// Personnages illustrés (v151) : images détourées dans img/art
const ART_IMG = { male: 'img/art/man.webp', female: 'img/art/woman.webp' };
// Photo d'identité : le personnage seul, sur fond blanc
const idPhoto = sex => (ART_IMG[sex] ? `<img class="idf-img" src="${ART_IMG[sex]}" alt="">` : AV_NONE);
// Avatar rond : le personnage sur son fond de couleur
const avatar = sex => (ART_IMG[sex] ? `<span class="av-svg av-pic av-${sex === 'male' ? 'm' : 'f'}" aria-hidden="true"><img src="${ART_IMG[sex]}" alt=""></span>` : AV_NONE);

// Prénom et sexe : deux grandes cartes illustrées
function identityBlock(member, { error = '', sex = true } = {}) {
  const card = (sex, label, tint) => `
    <button class="sx-card ${member.sex === sex ? 'on' : ''}" data-sex="${sex}" role="radio" aria-checked="${member.sex === sex}" style="--c:var(${tint.slice(0, -2)});--t:var(${tint})">
      ${avatar(sex)}<b>${label}</b><span class="sel-check" aria-hidden="true"></span>
    </button>`;
  return `<div class="id-block">
    <label class="id-field">
      <span class="pc-label">Prénom</span>
      <input class="id-name" type="text" autocomplete="given-name" maxlength="24" placeholder="Ton prénom" value="${esc(member.name)}">
    </label>
    ${sex ? `<div class="sx-grid" role="radiogroup" aria-label="Profil">
      ${card('male', 'Un homme', '--leaf-t')}${card('female', 'Une femme', '--honey-t')}
    </div>` : ''}
    ${error ? `<p class="wl-error" role="alert">${error}</p>` : ''}
  </div>`;
}

// Nombre de personnes : une ou deux assiettes
function householdCards(n, photo = 'W05') {
  const img = `img/dishes/${photo}.webp`;
  const card = (k, title, sub, tint, plates) => `
    <button class="hh-card ${n === k ? 'on' : ''}" data-count="${k}" role="radio" aria-checked="${n === k}" style="--c:var(${tint.slice(0, -2)});--t:var(${tint})">
      <span class="hh-plates hh-${k}" aria-hidden="true">${plates}</span>
      <span class="hh-txt"><b>${title}</b><span>${sub}</span></span>
      <span class="sel-check" aria-hidden="true"></span>
    </button>`;
  return `<div class="hh-list" role="radiogroup" aria-label="Nombre de personnes">
    ${card(1, 'Pour moi', 'Une fiche, tes portions.', '--honey-t', '<span class="hh-art hh-art-1"></span>')}
    ${card(2, 'Pour nous deux', 'Deux fiches, deux portions, une seule session de cuisine.', '--terra-t', '<span class="hh-art hh-art-2"></span>')}
  </div>`;
}

// Illustrations faites main (SVG), style des avatars
const SK = 'stroke="#2A3A30" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"';
// Personnages dessinés du foyer : lui (lunettes, barbe) seul, puis en couple
const HL = '#2A3A30';
// Lui : cheveux bruns en banane, peau claire, polo vert sauge (v143)
const GUY_INNER = `<g> <path d="M32 196 C34 146 60 126 100 126 C140 126 166 146 168 196 Z" fill="#7C9885"/> <path d="M32 196 C34 158 44 142 58 134 C54 150 53 172 54 196 Z" fill="#6A8573"/><path d="M146 196 C147 172 146 150 142 134 C156 142 166 158 168 196 Z" fill="#6A8573"/> <path d="M92 124 L100 144 L108 124 Z" fill="#EBC9AE"/> <path d="M86 121 L82 134 L97 137 L100 127 Z" fill="#A9C2B2" stroke="#5F7B68" stroke-width="1.6" stroke-linejoin="round"/> <path d="M114 121 L118 134 L103 137 L100 127 Z" fill="#A9C2B2" stroke="#5F7B68" stroke-width="1.6" stroke-linejoin="round"/> <path d="M100 144 V160" stroke="#5F7B68" stroke-width="1.6"/><circle cx="100" cy="150" r="1.6" fill="#F6F1E6"/><circle cx="100" cy="157" r="1.6" fill="#F6F1E6"/> <path d="M88 102 h24 v20 c0 8 -24 8 -24 0 Z" fill="#EBC9AE"/><path d="M88 108 c6 6 18 6 24 0 v-6 h-24 Z" fill="#DDB497"/> <ellipse cx="66" cy="78" rx="6.5" ry="9.5" fill="#F0D2BA"/><ellipse cx="134" cy="78" rx="6.5" ry="9.5" fill="#F0D2BA"/> <path d="M65 74 q3 4 0 8 M135 74 q-3 4 0 8" fill="none" stroke="#D9AE90" stroke-width="2" stroke-linecap="round"/> <path d="M68 70 C68 47 82 36 100 36 C118 36 132 47 132 70 C132 93 121 110 100 110 C79 110 68 93 68 70 Z" fill="#F7DFCB"/> <ellipse cx="80" cy="86" rx="7" ry="4.5" fill="#EFA898" opacity=".35"/><ellipse cx="120" cy="86" rx="7" ry="4.5" fill="#EFA898" opacity=".35"/> <path d="M67 64 C64 46 74 34 88 30 C96 22 116 20 126 30 C136 38 137 52 133 64 C130 56 124 51 116 50 C106 49 96 52 86 51 C78 53 71 57 67 64 Z" fill="#4A3529"/> <path d="M90 32 C100 24 116 24 124 32" fill="none" stroke="#6E5444" stroke-width="2.6" stroke-linecap="round"/><path d="M94 40 C104 33 116 33 124 40" fill="none" stroke="#6E5444" stroke-width="1.8" stroke-linecap="round" opacity=".7"/> <path d="M67 62 C67 68 67.5 74 68.5 79 L71 79 C70 74 70 68 71 63 Z" fill="#4A3529"/><path d="M133 62 C133 68 132.5 74 131.5 79 L129 79 C130 74 130 68 129 63 Z" fill="#4A3529"/> <path d="M76 59 C81 55.5 88 55.5 93 58 M107 58 C112 55.5 119 55.5 124 59" fill="none" stroke="#3A2A20" stroke-width="3.4" stroke-linecap="round"/> <ellipse cx="85" cy="70.5" rx="2.9" ry="3.3" fill="#2E241E"/><ellipse cx="115" cy="70.5" rx="2.9" ry="3.3" fill="#2E241E"/> <circle cx="86" cy="69.4" r=".9" fill="#fff"/><circle cx="116" cy="69.4" r=".9" fill="#fff"/> <path d="M100 73 C98.5 80 96.5 84 99 85.5 C101 86.3 103.5 85.6 104.5 84.5" fill="none" stroke="#D2A285" stroke-width="2.2" stroke-linecap="round"/> <path d="M91 95 Q100 102 109 95" fill="none" stroke="#C46F63" stroke-width="2.6" stroke-linecap="round"/> </g>`;
function hhGuy(x = 100, y = 0, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s}) translate(-100 0)">${GUY_INNER}</g>`;
}
function hhHer(x = 100, y = 0, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s}) translate(-100 0) rotate(-5 100 120)">
    <!-- cheveux arrière, ondulés jusqu'aux épaules -->
    <path d="M60 78 C54 40 76 26 100 26 C126 26 146 42 140 80 C146 104 144 128 134 140 C128 132 124 128 120 126 L80 126 C76 128 72 132 66 140 C56 128 54 104 60 78 Z" fill="#8A5A3C"/>
    <path d="M62 104 C58 118 60 130 66 140 M138 104 C142 118 140 130 134 140" fill="none" stroke="#744A31" stroke-width="2.4" stroke-linecap="round"/>
    <!-- buste : haut col en V -->
    <path d="M38 182 C40 148 64 132 100 132 C136 132 160 148 162 182 Z" fill="#D98E6B"/>
    <path d="M38 182 C40 160 50 148 62 141 C58 154 57 168 58 182 Z" fill="#C97D5B"/>
    <path d="M86 132 L100 152 L114 132 C110 134 90 134 86 132 Z" fill="#E6BFA0"/>
    <!-- cou -->
    <path d="M89 106 h22 v24 c0 8 -22 8 -22 0 Z" fill="#E6BFA0"/>
    <path d="M89 113 c5 6 17 6 22 0 v-5 h-22 Z" fill="#D7AA88"/>
    <!-- visage -->
    <path d="M71 74 C71 51 84 40 100 40 C116 40 129 51 129 74 C129 96 117 113 100 113 C83 113 71 96 71 74 Z" fill="#F3D7BE"/>
    <ellipse cx="82" cy="87" rx="7.5" ry="4.8" fill="#EBA594" opacity=".45"/><ellipse cx="118" cy="87" rx="7.5" ry="4.8" fill="#EBA594" opacity=".45"/>
    <!-- mèche et frange sur le côté -->
    <path d="M70 76 C67 50 82 36 102 36 C122 36 134 50 130 72 C122 62 110 54 96 51 C88 56 78 64 70 76 Z" fill="#8A5A3C"/>
    <path d="M96 51 C104 54 114 59 122 66" fill="none" stroke="#A06E4E" stroke-width="2.4" stroke-linecap="round"/>
    <!-- sourcils fins -->
    <path d="M78 63 C82 60.5 88 60.5 92 62" fill="none" stroke="#6A4430" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M108 62 C112 60.5 118 60.5 122 63" fill="none" stroke="#6A4430" stroke-width="2.6" stroke-linecap="round"/>
    <!-- yeux et cils -->
    <ellipse cx="86" cy="73" rx="2.8" ry="3.3" fill="#2E241E"/><ellipse cx="114" cy="73" rx="2.8" ry="3.3" fill="#2E241E"/>
    <circle cx="87" cy="71.9" r="0.9" fill="#fff"/><circle cx="115" cy="71.9" r="0.9" fill="#fff"/>
    
    <!-- nez et sourire -->
    <path d="M100 77 C99 83 97.5 85.5 99.5 86.5 C101 87 102.5 86.6 103.2 85.8" fill="none" stroke="#D2A386" stroke-width="2" stroke-linecap="round"/>
    <path d="M92 95 Q100 102.5 108 95 Q100 98 92 95 Z" fill="#C46F63"/>
    <!-- boucle d'oreille -->
    <circle cx="72.5" cy="90" r="2.6" fill="#E0A95E"/>
  </g>`;
}
const hhBowl = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">
    <path d="M-11 -16 q4 -6 0 -12 M0 -17 q4 -6 0 -12 M11 -16 q4 -6 0 -12" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" opacity=".9"/>
    <path d="M-24 -6 h48 c0 16 -10 25 -24 25 c-14 0 -24 -9 -24 -25 Z" fill="#F6F1E6" stroke="${HL}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M-19 -6 c4 -7 12 -8 15 -3 c4 -6 13 -6 15 0 c4 -3 9 -1 9 3 Z" fill="#E0A95E"/>
    <circle cx="-7" cy="-7" r="3.4" fill="#8FB573"/><circle cx="8" cy="-8" r="3" fill="#D98E6B"/><circle cx="1" cy="-10" r="2.4" fill="#7C9885"/>
    <path d="M-24 4 c10 4 38 4 48 0" fill="none" stroke="#E8DCC6" stroke-width="2"/>
  </g>`;
const HH1 = `<svg viewBox="0 0 200 200" aria-hidden="true"><defs><clipPath id="hh1c"><circle cx="100" cy="104" r="92"/></clipPath></defs><circle cx="100" cy="104" r="92" fill="#E4EEE6"/><g clip-path="url(#hh1c)">${hhGuy(100, 12)}</g>${hhBowl(100, 176, 0.92)}</svg>`;
const HH2 = `<svg viewBox="0 0 280 200" aria-hidden="true"><defs><clipPath id="hh2c"><rect x="6" y="14" width="268" height="182" rx="90"/></clipPath></defs><rect x="6" y="14" width="268" height="182" rx="90" fill="#FBEBE3"/><g clip-path="url(#hh2c)">${hhHer(186, 8, 0.94)}${hhGuy(98, 12)}</g>${hhBowl(98, 176, 0.82)}${hhBowl(188, 178, 0.76)}</svg>`;

const box = (inner) => `<svg viewBox="0 0 64 56" aria-hidden="true">${inner}</svg>`;
const TOOL_ART = {
  plaque: box(`<rect x="6" y="20" width="52" height="28" rx="6" fill="#F6F1E6" ${SK}/>
    <circle cx="22" cy="34" r="8" fill="none" stroke="#D98E6B" stroke-width="2.2"/><circle cx="44" cy="34" r="6" fill="none" stroke="#A9C2B2" stroke-width="2.2"/>
    <path d="M10 18 h22 c0 6 -4 9 -11 9 c-7 0 -11 -3 -11 -9 Z" fill="#7C9885" ${SK}/><path d="M32 20 h14" ${SK}/>`),
  four: box(`<rect x="8" y="6" width="48" height="44" rx="6" fill="#F6F1E6" ${SK}/>
    <path d="M8 16 h48" ${SK}/><circle cx="16" cy="11" r="2" fill="#2A3A30"/><circle cx="24" cy="11" r="2" fill="#2A3A30"/>
    <rect x="15" y="22" width="34" height="21" rx="4" fill="#FBEBE3" ${SK}/><path d="M20 36 h24" stroke="#D98E6B" stroke-width="2.2" stroke-linecap="round"/>`),
  airfryer: box(`<path d="M16 8 h32 c4 0 7 3 7 7 v28 c0 5 -4 8 -8 8 h-30 c-4 0 -8 -3 -8 -8 v-28 c0 -4 3 -7 7 -7 Z" fill="#F6F1E6" ${SK}/>
    <rect x="22" y="13" width="20" height="7" rx="3" fill="#E8F0EA" ${SK}/>
    <path d="M14 28 h36 v13 c0 3 -2 5 -5 5 h-26 c-3 0 -5 -2 -5 -5 Z" fill="#A9C2B2" ${SK}/><path d="M27 37 h10" ${SK}/>`),
  autocuiseur: box(`<path d="M12 26 h40 v16 c0 5 -4 8 -9 8 h-22 c-5 0 -9 -3 -9 -8 Z" fill="#7C9885" ${SK}/>
    <path d="M9 26 c0 -10 10 -15 23 -15 c13 0 23 5 23 15 Z" fill="#F6F1E6" ${SK}/>
    <path d="M32 11 v-4" ${SK}/><circle cx="32" cy="6" r="2.5" fill="#E0A95E" ${SK}/><path d="M6 32 h6 M52 32 h6" ${SK}/>`),
  microondes: box(`<rect x="5" y="12" width="54" height="34" rx="5" fill="#F6F1E6" ${SK}/>
    <rect x="11" y="18" width="32" height="22" rx="3" fill="#EAF3F8" ${SK}/>
    <path d="M49 20 v18" ${SK}/><circle cx="53" cy="22" r="1.8" fill="#2A3A30"/><circle cx="53" cy="29" r="1.8" fill="#2A3A30"/>
    <ellipse cx="27" cy="34" rx="9" ry="2.6" fill="#D98E6B"/>`),
  mixeur: box(`<path d="M20 6 h24 l-4 30 h-16 Z" fill="#EAF3F8" ${SK}/><path d="M23 20 h18" stroke="#D98E6B" stroke-width="5" opacity=".55"/>
    <path d="M44 12 h4 c3 0 4 2 4 4 v8 c0 2 -1 4 -4 4 h-5" fill="none" ${SK}/>
    <path d="M18 36 h28 l3 14 h-34 Z" fill="#7C9885" ${SK}/><circle cx="32" cy="43" r="2.4" fill="#F6F1E6"/>`),
};

// Équipement de cuisine (pour tout le foyer) : cartes à cocher
function equipmentBlock(eq) {
  const e = eq || {};
  const c = countPossible({ ...e });
  const can = (e.plaque || e.autocuiseur);
  return `<div class="eq-grid" role="group" aria-label="Équipement">
      ${TOOLS.map(t => `<button class="eq-card ${e[t.key] ? 'on' : ''}" data-tool="${t.key}" role="checkbox" aria-checked="${!!e[t.key]}">
        <span class="eq-art">${TOOL_ART[t.key]}</span><b>${t.label}</b><span class="eq-desc">${t.desc}</span><span class="sel-check" aria-hidden="true"></span>
      </button>`).join('')}
    </div>
    ${can ? '' : '<p class="eq-count">Il faut au moins des plaques de cuisson ou un autocuiseur pour cuisiner les plats.</p>'}`;
}

// Repas de la journée : frise avec un point par repas (taille = part des calories)
const MEAL_COLORS = { breakfast: 'var(--honey)', lunch: 'var(--terra)', snack: 'var(--leaf)', dinner: 'var(--sky)' };
const FORMULAS = [
  { id: 'jeune', title: 'Jeûne intermittent', desc: 'Déjeuner, collation et dîner.', tint: '--leaf-t', fast: true,
    meals: [['lunch', 36, 40, '12 h'], ['snack', 62, 20, '16 h'], ['dinner', 88, 40, '20 h']] },
  { id: 'classique', title: 'Classique', desc: 'Petit-déjeuner, déjeuner, collation et dîner.', tint: '--sky-t',
    meals: [['breakfast', 8, 20, '8 h'], ['lunch', 36, 32, '12 h'], ['snack', 62, 16, '16 h'], ['dinner', 88, 32, '20 h']] },
];
function timeline(f) {
  return `<span class="fm-tl" aria-hidden="true"><span class="fm-tl-ln"></span>
    ${f.fast ? '<span class="fm-tl-fast"></span>' : ''}
    ${f.meals.map(([k, x, pct, t]) => { const d = Math.round(9 + pct * 0.36); return `<span class="fm-tl-d" style="left:${x}%;width:${d}px;height:${d}px;background:${MEAL_COLORS[k]}"></span><span class="fm-tl-t" style="left:${x}%">${t}</span>`; }).join('')}
  </span>`;
}
const DIETS = [
  { key: 'lactose', label: 'Lactose', hint: 'Lait, yaourt, fromage frais', tint: '--terra-t', levels: ['Aucun souci', 'Intolérance', 'Strict'] },
  { key: 'gluten', label: 'Gluten', hint: 'Pâtes, pain, sauce soja', tint: '--terra-t', levels: ['Aucun souci', 'Sensibilité', 'Strict'] },
];
function mealsBlock(member, { error = '' } = {}) {
  return `<div class="fm-list" role="radiogroup" aria-label="Formule de repas">
      ${FORMULAS.map(f => `<button class="fm-card ${member.formula === f.id ? 'on' : ''}" data-formula="${f.id}" role="radio" aria-checked="${member.formula === f.id}" style="--c:var(${f.tint.slice(0, -2)});--t:var(${f.tint})">
        <b>${f.title}</b><span class="fm-desc">${f.desc}</span>${timeline(f)}<span class="sel-check" aria-hidden="true"></span>
      </button>`).join('')}
    </div>
    <div class="fm-legend" aria-hidden="true"><span><i style="background:${MEAL_COLORS.breakfast}"></i>Petit-déjeuner</span><span><i style="background:${MEAL_COLORS.lunch}"></i>Déjeuner</span><span><i style="background:${MEAL_COLORS.snack}"></i>Collation</span><span><i style="background:${MEAL_COLORS.dinner}"></i>Dîner</span></div>
    ${error ? `<p class="wl-error" role="alert">${error}</p>` : ''}
    ${member.formula === 'classique' ? `<div class="dt-card dt-bk" style="--c:var(--honey);--t:var(--honey-t)">
      <div class="dt-top"><b>Au petit-déjeuner</b></div>
      <div class="dt-seg" role="radiogroup" aria-label="Petit-déjeuner">
        ${[['sucre', 'Sucré'], ['sale', 'Salé'], ['mix', 'Les deux']].map(([v, l]) => `<button class="dt-btn ${(member.breakfast || 'mix') === v ? 'on' : ''}" data-bk="${v}" role="radio" aria-checked="${(member.breakfast || 'mix') === v}">${l}</button>`).join('')}
      </div>
    </div>` : ''}
    <div class="dt-card dt-whey" style="--c:var(--sky);--t:var(--sky-t)">
      <div class="dt-top"><b>Protéine en poudre (whey)</b></div>
      <div class="dt-seg dt-seg-2" role="radiogroup" aria-label="Whey">
        <button class="dt-btn ${member.whey === true ? 'on' : ''}" data-whey="1" role="radio" aria-checked="${member.whey === true}">J'en ai</button>
        <button class="dt-btn ${member.whey === false ? 'on' : ''}" data-whey="0" role="radio" aria-checked="${member.whey === false}">Je n'en ai pas</button>
      </div>
    </div>
    <div class="dt-card dt-diet" style="--c:var(--terra);--t:var(--terra-t)">
      <div class="dt-top"><b>Ton régime</b><span>Lactose et gluten</span></div>
      ${DIETS.map(d => `<div class="dt-row">
        <div class="dt-row-top"><span>${d.label}</span><em>${d.hint}</em></div>
        <div class="dt-seg" role="radiogroup" aria-label="${d.label}">
          ${d.levels.map((l, i) => `<button class="dt-btn ${(member[d.key] || 0) === i ? 'on' : ''}" data-diet="${d.key}" data-level="${i}" role="radio" aria-checked="${(member[d.key] || 0) === i}">${l}</button>`).join('')}
        </div>
      </div>`).join('')}
    </div>`;
}

// Niveau d'activité : quatre choix décrits par une phrase
function activityList(level = null) {
  return `<div class="act-list" role="radiogroup" aria-label="Niveau d'activité">
    ${ACTIVITY.map(a => `
      <button class="act-opt ${a.level === level ? 'on' : ''}" data-act="${a.level}" role="radio" aria-checked="${a.level === level}">
        <span class="act-bars" aria-hidden="true">${[1, 2, 3, 4].map(i => `<i class="${i <= a.level ? 'f' : ''}"></i>`).join('')}</span>
        <span class="act-txt"><b>${a.label}</b><span>${a.desc}</span></span>
        <span class="act-check" aria-hidden="true"></span>
      </button>`).join('')}
  </div>`;
}

// v195 : « Départ 2526 kcal », puis ce qui se passe ensuite, en clair
function phaseRange(profile, pid) {
  const ph = computeAllPhases(profile, pid);
  const k = ph.map(x => x.targets.kcal);
  if (ph.length === 1) return `<b>${k[0]} kcal</b><span>sans changer de palier</span>`;
  const more = k[k.length - 1] > k[0];
  const then = ph.length === 2
    ? `puis ${k[1]} si ${more ? 'tu stagnes' : 'le poids stagne'}`
    : `puis jusqu'à ${k[k.length - 1]}, en ${ph.length - 1} paliers`;
  return `<b>Départ ${k[0]} kcal</b><span>${then}</span>`;
}

// Cartes des quatre programmes
function protocolCards(profile, selectedId, { info = true } = {}) {
  return `<div class="protocol-grid">
    ${protocolsFor(profile).map(p => `
      <button class="proto-card pc-${p.id} ${p.id === selectedId ? 'active' : ''}" data-pid="${p.id}">
        <div class="proto-head">
          <div class="proto-name">${p.name}</div>
          ${info ? `<span class="proto-info" data-sheet="${p.id}" role="button" tabindex="0" aria-label="En savoir plus sur ${p.name}">i</span>` : ''}
        </div>
        <div class="proto-tagline">${p.tagline}</div>
        <div class="proto-range">${phaseRange(profile, p.id)}</div>
        <div class="proto-check">✓</div>
      </button>`).join('')}
  </div>`;
}

// Sélecteur de personne (foyer de deux) : chacun voit ses portions et ses collations
function whoSwitch() {
  const ms = getMembers();
  if (ms.length < 2) return '';
  const act = getActiveMember().id;
  return `<div class="who-switch" role="tablist" aria-label="Personne affichée">
    ${ms.map(m => `<button class="who-btn ${m.id === act ? 'on' : ''}" data-mid="${m.id}" role="tab" aria-selected="${m.id === act}">
      <span class="who-av">${avatar(m.sex)}</span>${m.name || 'Sans prénom'}</button>`).join('')}
  </div>`;
}
function bindWho(root, rerender) {
  root.querySelectorAll('.who-btn').forEach(b => b.addEventListener('click', () => {
    if (b.classList.contains('on')) return;
    setActiveMember(b.dataset.mid); rerender();
  }));
}

// Branche les cases de mesure : appelle onChange(key, value) à chaque modification
function bindMeasures(root, getValue, onChange) {
  root.querySelectorAll('.pcell-input').forEach(inp => inp.addEventListener('input', () => { inp.style.width = `${Math.max(1, inp.value.length) + 0.2}ch`; }));
  root.querySelectorAll('.pcell-btn').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.key, d = parseFloat(b.dataset.delta);
    onChange(k, Math.max(0, Math.round((getValue(k) + d) * 100) / 100));
  }));
  root.querySelectorAll('.pcell-input').forEach(inp => inp.addEventListener('change', () => {
    const k = inp.dataset.key;
    let v = parseFloat(inp.value.replace(',', '.'));
    if (k === 'height' && v > 3) v = Math.round(v) / 100; // « 178 » compris comme 1,78 m
    if (!isNaN(v) && v > 0) onChange(k, v);
    else if (inp.value.trim() === '' && getValue.allowEmpty) onChange(k, null);
    else onChange(k, getValue(k, true));
  }));
}

// ── Fiche détaillée d'un programme ──
// Rythme estimé de chaque étape, d'après les calories calculées pour ce profil
function paceValues(ph, maint) {
  return ph.map(x => x.targets.kcal - maint).filter(d => Math.abs(d) > 30)
    .map(d => kgPerWeek(d).toFixed(1).replace('.', ','));
}
function paceShort(p, ph, maint) {
  const v = paceValues(ph, maint);
  if (p.id === 'P2' || !v.length) return '≈ stable';
  const sign = p.phases.some(x => x.pct > 0) ? '+' : '−';
  return v.length > 1 ? `${sign}${v[0]} à ${v[v.length - 1]} kg` : `${sign}${v[0]} kg`;
}

// Graphique 1 : calories de chaque étape par rapport à la maintenance (escalier)
function kcalChart(ph, maint) {
  const W = 330, H = 160, padL = 8, padR = 8, top = 26, bottom = 30;
  const vals = ph.map(x => x.targets.kcal);
  const lo = Math.min(maint, ...vals) - 120, hi = Math.max(maint, ...vals) + 120;
  const y = v => top + (hi - v) / (hi - lo) * (H - top - bottom);
  const n = ph.length, segW = (W - padL - padR) / n;
  const yM = y(maint);
  const segs = ph.map((x, i) => {
    const x0 = padL + i * segW + 6, x1 = padL + (i + 1) * segW - 6, yv = y(x.targets.kcal);
    const area = `<rect x="${x0}" y="${Math.min(yv, yM)}" width="${x1 - x0}" height="${Math.max(2, Math.abs(yM - yv))}" class="kc-area"/>`;
    return `${area}<line x1="${x0}" y1="${yv}" x2="${x1}" y2="${yv}" class="kc-line"/>
      <text x="${(x0 + x1) / 2}" y="${yv - 8}" class="kc-val">${x.targets.kcal}</text>
      <text x="${(x0 + x1) / 2}" y="${H - 10}" class="kc-lbl">${i === 0 ? 'Départ' : 'Étape ' + i}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="pf-chart" role="img" aria-label="Calories par étape">
    ${segs}
    <line x1="0" y1="${yM}" x2="${W}" y2="${yM}" class="kc-maint"/>
    <text x="${W - 4}" y="${vals.some(v => v > maint) ? yM + 14 : yM - 6}" class="kc-maint-lbl">Maintenance ${maint}</text>
  </svg>`;
}

// Graphique 2 : répartition protéines / lipides / glucides (en kcal) pour chaque étape
function macroChart(ph) {
  const max = Math.max(...ph.map(x => x.targets.kcal));
  return `<div class="mc">
    ${ph.map((x, i) => {
      const t = x.targets, P = t.protein * 4, F = t.fat * 9, C = t.carbs * 4;
      const w = v => (v / max * 100).toFixed(1);
      return `<div class="mc-row">
        <span class="mc-lbl">${i === 0 ? 'Départ' : 'Étape ' + i}</span>
        <span class="mc-bar">
          <i class="p" style="width:${w(P)}%">${t.protein} g</i><i class="f" style="width:${w(F)}%">${t.fat} g</i><i class="c" style="width:${w(C)}%">${t.carbs} g</i>
        </span>
      </div>`;
    }).join('')}
    <div class="mc-legend"><span class="p">Protéines</span><span class="f">Lipides</span><span class="c">Glucides</span></div>
  </div>`;
}

function openProtocolSheet(profile, pid, { isCurrent = false, onChoose = null } = {}) {
  const p = protocolFor(profile, pid);
  const ph = computeAllPhases(profile, pid);
  const maint = Math.round(computeBase(profile).maintenance);
  const stepName = (x, i) => i === 0 ? x.label : `${x.label} <em>facultative</em>`;
  const last = ph.length - 1;
  openSheet(`
    <div class="sheet-handle"></div>
    <div class="hb-sheet-pad pf pc-${p.id}">
      <div class="pf-hero">
        <div class="hb-h2">${p.name}</div>
        <p class="pf-tag">${p.tagline}</p>
        <div class="pf-stats">
          <div><b>${paceShort(p, ph, maint)}</b><span>par semaine</span></div>
          <div><b>${ph.length}</b><span>${ph.length > 1 ? 'étapes' : 'étape'}</span></div>
          <div><b>${p.duration.replace(', puis bilan', '')}</b><span>durée</span></div>
        </div>
      </div>

      <div class="pf-block">
        <div class="pf-h">À quoi sert ce programme</div>
        <p class="pf-purpose">${p.purpose}</p>
        <div class="pf-who">
          <div class="pf-who-h">C'est pour toi si…</div>
          ${p.forWho.map(t => `<div class="pf-who-i">${t}</div>`).join('')}
        </div>
      </div>

      <div class="pf-block">
        <div class="pf-h">Tes calories</div>
        ${kcalChart(ph, maint)}
      </div>

      <div class="pf-block">
        <div class="pf-h">Ton assiette</div>
        ${macroChart(ph)}
        <p class="pf-note">Seuls les glucides changent d'une étape à l'autre.</p>
      </div>

      <div class="pf-block">
        <div class="pf-h">Les étapes</div>
        <p class="pf-intro">${ph.length > 1
          ? `Tu commences à ${ph[0].targets.kcal} kcal par jour. Les étapes suivantes sont facultatives : tu ne passes à la suivante que si tes résultats stagnent.`
          : `Tu restes à ${ph[0].targets.kcal} kcal par jour pendant toute la durée du programme.`}</p>
        <div class="tl">
          ${ph.map((x, i) => {
            const w = p.phases[i].when || '';
            const final = /^Dernier palier/.test(w) || ph.length === 1;
            return `<div class="tl-item">
              <span class="tl-dot">${i + 1}</span>
              <div class="tl-body">
                <div class="tl-top"><b>${i === 0 ? 'Départ' : 'Étape ' + i}${i > 0 ? '<em>facultative</em>' : ''}</b><span>${x.targets.kcal} kcal</span></div>
                <div class="tl-short">${p.phases[i].short || ''}</div>
                ${w ? `<div class="tl-when ${final ? 'final' : ''}"><span>${final ? (ph.length === 1 ? 'À faire' : 'Dernier palier') : 'Étape suivante si'}</span>${(t => t.charAt(0).toUpperCase() + t.slice(1))(w.replace(/^Dernier palier : /, ''))}</div>` : ''}
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>

      <button class="hb-btn ${isCurrent ? '' : 'hb-btn-primary'} pf-choose">${isCurrent ? 'Programme actuel' : 'Choisir ce programme'}</button>
    </div>`);
  const sheet = document.getElementById('sheet');
  sheet.querySelector('.pf-choose').addEventListener('click', () => {
    closeSheet();
    if (!isCurrent && onChoose) onChoose(pid);
  });
}


// ──────────────────────────────────────────────
// js/settings.js
// ──────────────────────────────────────────────
// settings.js — « Mon programme » : fiche de la personne, activité, programme et objectifs


function renderSettings() {
  const app = document.getElementById('app');
  app.querySelector('.view')?.remove();

  let profile    = getProfile();
  let protocolId = getSelectedProtocol();
  let phaseIdx   = getSelectedPhase();

  const view = el('div', 'view settings-view');
  app.insertBefore(view, app.querySelector('#nav'));

  const applyComputed = () => saveTargets(computeTargets(profile, protocolId, phaseIdx));
  let manualOpen = false; // la section « à la main » reste ouverte entre deux rendus

  let firstRender = true;
  function render() {
    const keepY = firstRender ? 0 : window.scrollY; // une modification ne fait pas remonter la page
    const member   = getActiveMember();
    const base     = computeBase(profile);
    const phases   = computeAllPhases(profile, protocolId);
    const protocol = protocolFor(profile, protocolId);
    phaseIdx = Math.min(phaseIdx, protocol.phases.length - 1);
    const active   = phases[phaseIdx];
    const details  = computeDetails(profile, protocolId, phaseIdx);
    const current  = getTargets();
    const isComputed = !hasManualTargets();

    view.innerHTML = `
      <div class="page-head">
        <button class="hb-back round-back" aria-label="Retour à ma semaine"><svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg></button>
        <div class="hb-page-title">Mon programme</div>
      </div>
      ${whoSwitch()}
      <p class="pg-hello"><b>Bienvenue dans ton programme${member.name ? ` ${esc(member.name)}` : ''} !</b><span>C'est ici que tu retrouveras ta fiche, tes repas et ton objectif. Touche une information pour la modifier : tes besoins se recalculent tout seuls.</span></p>
      <!-- FICHE D'IDENTITÉ -->
      <div class="idf">
        <div class="idf-band"><span>Fiche Hébé</span><span>N° ${String(getMembers().findIndex(x => x.id === member.id) + 1).padStart(3, '0')}</span></div>
        <div class="idf-body">
          <div class="idf-photo">${idPhoto(member.sex)}</div>
          <div class="idf-fields">
            <button class="idf-f idf-full" data-edit="name"><span>Prénom</span><b class="idf-name">${esc(member.name || 'Sans prénom')}</b></button>
            <button class="idf-f" data-edit="age"><span>Âge</span><b>${profile.age} ans</b></button>
            <button class="idf-f" data-edit="height"><span>Taille</span><b>${String(profile.height).replace('.', ',')} m</b></button>
            <button class="idf-f" data-edit="weight"><span>Poids</span><b>${String(profile.weight).replace('.', ',')} kg</b></button>
            <button class="idf-f" data-edit="bodyfat"><span>Masse grasse</span><b>${String(profile.bodyfat).replace('.', ',')} %</b></button>
            <button class="idf-f idf-full" data-edit="activity"><span>Quotidien</span><b>${(ACTIVITY.find(a => a.level === profile.activity) || ACTIVITY[1]).label}</b></button>
          </div>
        </div>
        <button class="idf-stamp pc-${protocolId}" data-edit="protocol">
          <div><span>Programme</span><b>${protocol.name}</b></div>
          <div class="idf-goal"><span>Objectif</span><b>${current.kcal} kcal</b></div>
        </button>
      </div>


      <!-- REPAS ET RÉGIME -->
      <div class="set-section">
        <div class="set-section-head">Tes repas</div>
        ${mealsBlock(member)}
        ${staplesCard()}
      </div>

      <!-- PROTOCOLE -->
      <div class="set-section">
        <div class="set-section-head">Ton objectif</div>
        ${protocolCards(profile, protocolId)}
      </div>

      <!-- PHASES -->
      <div class="set-section">
        <div class="set-section-head">Ta progression</div>
        <div class="phase-stepper">
          ${phases.map((ph, i) => `
            <button class="phase-step ${i === phaseIdx ? 'active' : ''} ${i < phaseIdx ? 'done' : ''}" data-phase="${i}">
              <div class="ps-label">${ph.label}</div>
              <div class="ps-kcal">${ph.targets.kcal} kcal</div>
            </button>
          `).join('')}
        </div>

        <div class="target-card">
          <div class="tc-kcal">${active.targets.kcal}<span> kcal/jour</span></div>
          <div class="tc-week">≈ ${(active.targets.kcal * 7).toLocaleString('fr-FR')} kcal / semaine</div>
          <div class="tc-macros">
            <div class="tcm protein"><div class="tcm-bar"></div><strong>${active.targets.protein}g</strong><span>Protéines</span></div>
            <div class="tcm carbs"><div class="tcm-bar"></div><strong>${active.targets.carbs}g</strong><span>Glucides</span></div>
            <div class="tcm fat"><div class="tcm-bar"></div><strong>${active.targets.fat}g</strong><span>Lipides</span></div>
          </div>
          ${details.floored ? `<p class="tc-note">Le programme visait ${details.wanted} kcal. Hébé remonte ton objectif à ${details.targets.kcal} kcal pour ne pas descendre sous ce dont ton corps a besoin au repos.</p>` : ''}
          ${details.fatRaised ? `<p class="tc-note">Tes lipides sont relevés à ${details.targets.fat} g pour rester au-dessus de ${profile.sex === 'female' ? '25' : '20'} % de tes calories, un minimum important pour l'équilibre hormonal.</p>` : ''}
        </div>

        ${(() => {
          const cur = protocol.phases[phaseIdx], nxt = phases[phaseIdx + 1];
          const label = i => i === 0 ? 'Départ' : 'Étape ' + i;
          const isLast = !nxt;
          return `<div class="phase-guide pc-${protocol.id}">
            <div class="pg-now">
              <div class="pg-kicker">Cette phase · ${label(phaseIdx)}</div>
              <div class="pg-big">${cur.short || ''}</div>
              <p>${cur.advice}</p>
            </div>
            <div class="pg-next ${isLast ? 'last' : ''}">
              ${isLast
                ? `<div class="pg-kicker">Dernier palier</div><p>${cur.advance}</p>`
                : `<div class="pg-kicker">Quand passer à la suite</div>
                   <div class="pg-steps">
                     <span class="pg-chip on">${label(phaseIdx)}<b>${phases[phaseIdx].targets.kcal} kcal</b></span>
                     <span class="pg-arrow" aria-hidden="true"></span>
                     <span class="pg-chip">${label(phaseIdx + 1)}<b>${nxt.targets.kcal} kcal</b></span>
                   </div>
                   <p>${(cur.when || cur.advance).replace(/^./, c => c.toUpperCase())}.</p>`}
            </div>
          </div>`;
        })()}

      </div>

      <!-- MANUEL -->
      <details class="set-manual pc-${protocolId}" ${manualOpen ? 'open' : ''}>
        <summary>Régler mes calories à la main</summary>
        <div class="manual-body">
          ${isComputed ? '' : '<button class="back-to-plan">Revenir aux calories du programme</button>'}
          ${mrow('kcal',    'Calories',  current.kcal,    'kcal', 50)}
          ${mrow('protein', 'Protéines', current.protein, 'g',    5)}
          ${mrow('carbs',   'Glucides',  current.carbs,   'g',    5)}
          ${mrow('fat',     'Lipides',   current.fat,     'g',    5)}
          <div class="weekly-readout"><span>Objectif hebdomadaire</span><strong>${(current.kcal*7).toLocaleString('fr-FR')} kcal</strong></div>
        </div>
      </details>

      <!-- FOYER -->
      <div class="set-section">
        <div class="set-section-head">Ton foyer</div>
        ${getMembers().length < 2
          ? `<button class="hh-row" data-count="2"><span class="hh-plus" aria-hidden="true">+</span><span class="hh-row-txt"><b>Ajouter une personne</b><span>Mêmes plats, portions calculées pour chacun</span></span><span class="hb-chev">›</span></button>`
          : `<div class="hh-members">${getMembers().map(m => `<div class="hh-mem"><b>${esc(m.name || 'Sans prénom')}</b><span>${m.sex === 'female' ? 'Femme' : 'Homme'}, ${m.age} ans</span></div>`).join('')}</div>
             <button class="hh-row hh-remove" data-count="1"><span class="hh-row-txt"><b>Retirer ${esc(getMembers()[1].name || 'la deuxième personne')} du foyer</b><span>Sa fiche et ses repas prévus seront effacés</span></span><span class="hb-chev">›</span></button>`}
        <div class="budget-row">
          <div><b>Budget des courses</b><span>Par semaine, pour tout le foyer</span></div>
          <div class="field-control">
            <button class="mrow-btn bud-btn" data-delta="-5" aria-label="Budget : moins">−</button>
            <span class="bud-val">${weekBudget()} €</span>
            <button class="mrow-btn bud-btn" data-delta="5" aria-label="Budget : plus">+</button>
          </div>
        </div>
      </div>

      <!-- ÉQUIPEMENT -->
      <div class="set-section">
        <div class="set-section-head">Ta cuisine</div>
        ${equipmentBlock(getHousehold().equipment)}
      </div>

      <!-- SAUVEGARDE (v193) -->
      <div class="set-section">
        <div class="set-section-head">Tes données</div>
        <div class="bk-card">
          <p>Tout est enregistré sur ce téléphone. Garde une copie dans tes fichiers (iCloud, Drive…) pour ne rien perdre.</p>
          <div class="bk-btns"><button class="hb-btn hb-btn-primary" data-backup>Sauvegarder</button><button class="hb-btn bk-sec" data-restore>Restaurer</button></div>
          <span class="bk-last">Dernière sauvegarde : ${lastBackupText()}</span>
          <input type="file" accept=".json,application/json" data-restore-file hidden>
        </div>
      </div>

      <button class="hb-btn set-back-bottom">Retour à ma semaine</button>
    `;
    bind();
    if (!firstRender) window.scrollTo(0, keepY);
    firstRender = false;
  }

  // Modifier une valeur de la fiche : un panneau s'ouvre en bas de l'écran
  const EDIT = {
    age:     { title: 'Ton âge',          unit: 'ans', step: 1,    min: 18,  max: 99 },
    height:  { title: 'Ta taille',        unit: 'm',   step: 0.01, min: 1.3, max: 2.3 },
    weight:  { title: 'Ton poids',        unit: 'kg',  step: 0.5,  min: 35,  max: 250 },
    bodyfat: { title: 'Ta masse grasse',  unit: '%',   step: 1,    min: 5,   max: 60 },
  };
  const fmt = v => String(Math.round(v * 100) / 100).replace('.', ',');
  function openEdit(k) {
    if (k === 'name') {
      openSheet(`<div class="sheet-handle"></div><div class="hb-sheet-pad edit-sheet"><div class="hb-h2">Ton prénom</div>
        <input class="edit-name" value="${esc(getActiveMember().name || '')}" maxlength="30" autocomplete="off">
        <button class="hb-btn hb-btn-primary edit-save">Enregistrer</button></div>`);
      const sh = document.getElementById('sheet'), inp = sh.querySelector('.edit-name');
      setTimeout(() => inp.focus(), 50);
      sh.querySelector('.edit-save').addEventListener('click', () => { const v = inp.value.trim(); if (v) updateActiveMember({ name: v }); closeSheet(); render(); });
      return;
    }
    if (k === 'protocol') {
      openSheet(`<div class="sheet-handle"></div><div class="hb-sheet-pad edit-sheet"><div class="hb-h2">Ton programme</div>${protocolCards(profile, protocolId)}</div>`);
      document.getElementById('sheet').querySelectorAll('.proto-card').forEach(b => b.addEventListener('click', () => {
        const pid = b.dataset.pid; closeSheet();
        if (pid === protocolId) return;
        protocolId = pid; phaseIdx = 0; saveSelectedProtocol(pid); saveSelectedPhase(0); applyComputed();
        toast(`Programme : ${protocolFor(profile, pid).name}`); render();
      }));
      return;
    }
    if (k === 'activity') {
      openSheet(`<div class="sheet-handle"></div><div class="hb-sheet-pad edit-sheet"><div class="hb-h2">Ton quotidien</div>${activityList(profile.activity)}</div>`);
      document.getElementById('sheet').querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
        profile.activity = parseInt(b.dataset.act); saveProfile(profile); applyComputed(); closeSheet(); render();
      }));
      return;
    }
    const E = EDIT[k]; let v = profile[k];
    openSheet(`<div class="sheet-handle"></div><div class="hb-sheet-pad edit-sheet"><div class="hb-h2">${E.title}</div>
      <div class="edit-step"><button class="edit-btn" data-d="-1" aria-label="Moins">−</button>
        <label class="edit-val"><input class="edit-input" inputmode="decimal" value="${fmt(v)}"><span>${E.unit}</span></label>
        <button class="edit-btn" data-d="1" aria-label="Plus">+</button></div>
      ${k === 'bodyfat' ? bodyfatButton(profile.sex) : ''}
      <button class="hb-btn hb-btn-primary edit-save">Enregistrer</button></div>`);
    const sh = document.getElementById('sheet'), inp = sh.querySelector('.edit-input');
    const read = () => { let x = parseFloat(inp.value.replace(',', '.')); if (k === 'height' && x > 3) x = x / 100; return x; };
    sh.querySelectorAll('.edit-btn').forEach(b => b.addEventListener('click', () => {
      const x = isNaN(read()) ? v : read();
      inp.value = fmt(Math.min(E.max, Math.max(E.min, Math.round((x + E.step * +b.dataset.d) * 100) / 100)));
    }));
    sh.querySelector('.bf-guide-btn')?.addEventListener('click', () => { closeSheet(); openBodyfatGuide(profile.bodyfat, b => { profile.bodyfat = b; saveProfile(profile); applyComputed(); render(); toast(`Masse grasse : ${b} %`); }, profile.sex); });
    sh.querySelector('.edit-save').addEventListener('click', () => {
      const x = read();
      if (isNaN(x) || x < E.min || x > E.max) { toast(`Indique une valeur entre ${fmt(E.min)} et ${fmt(E.max)} ${E.unit}`, 'warn'); return; }
      profile[k] = Math.round(x * 100) / 100; saveProfile(profile); applyComputed(); closeSheet(); render();
    });
  }

  function bind() {
    view.querySelector('[data-backup]')?.addEventListener('click', async () => {
      await exportBackup();
      const last = view.querySelector('.bk-last'); if (last) last.textContent = `Dernière sauvegarde : ${lastBackupText()}`;
    });
    const fileIn = view.querySelector('[data-restore-file]');
    view.querySelector('[data-restore]')?.addEventListener('click', () => fileIn?.click());
    fileIn?.addEventListener('change', async () => { const f = fileIn.files?.[0]; fileIn.value = ''; if (f) askRestore(await f.text()); });
    view.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openEdit(b.dataset.edit)));
    view.querySelector('.hb-back')?.addEventListener('click', () => window._nav?.('week'));
    view.querySelector('.bf-guide-btn')?.addEventListener('click', () => openBodyfatGuide(profile.bodyfat, v => {
      profile.bodyfat = v; saveProfile(profile); applyComputed(); render();
      toast(`Masse grasse : ${v} %`);
    }, profile.sex));
    bindMeasures(view, k => profile[k], (k, v) => { profile[k] = v; saveProfile(profile); applyComputed(); render(); });
    const nameInp = view.querySelector('.id-name');
    nameInp?.addEventListener('change', () => {
      const name = nameInp.value.trim();
      if (!name) { nameInp.value = getActiveMember().name; return; }
      updateActiveMember({ name }); render();
    });
    view.querySelectorAll('[data-sex]').forEach(b => b.addEventListener('click', () => {
      if (profile.sex === b.dataset.sex) return;
      profile.sex = b.dataset.sex; saveProfile(profile); applyComputed(); render();
      toast(gx('Calculs adaptés à un profil [masculin|féminin]', profile.sex));
    }));
    bindWho(view, () => { profile = getProfile(); protocolId = getSelectedProtocol(); phaseIdx = getSelectedPhase(); render(); });
    view.querySelectorAll('[data-formula]').forEach(b => b.addEventListener('click', () => {
      if (getActiveMember().formula === b.dataset.formula) return;
      updateActiveMember({ formula: b.dataset.formula }); render();
      toast(b.dataset.formula === 'classique' ? 'Les petits-déjeuners arriveront avec la prochaine semaine générée' : 'Formule jeûne pour la prochaine semaine générée');
    }));
    view.querySelectorAll('[data-diet]').forEach(b => b.addEventListener('click', () => { updateActiveMember({ [b.dataset.diet]: +b.dataset.level }); applyEquipment(); applyDiet(); render(); }));
    view.querySelectorAll('[data-staples]').forEach(b => b.addEventListener('click', () => {
      setStaples(b.dataset.staples); applyEquipment(); applyDiet();
      const y = window.scrollY; render(); window.scrollTo(0, y);
      toast('Préférence enregistrée');
    }));
    view.querySelectorAll('[data-bk]').forEach(b => b.addEventListener('click', () => { updateActiveMember({ breakfast: b.dataset.bk }); render(); toast('Préférence enregistrée : mets à jour ta semaine depuis l\'onglet Semaine'); }));
    view.querySelectorAll('[data-whey]').forEach(b => b.addEventListener('click', () => { updateActiveMember({ whey: b.dataset.whey === '1' }); render(); toast('Préférence enregistrée : mets à jour ta semaine depuis l\'onglet Semaine'); }));
    view.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => {
      const eq = { ...(getHousehold().equipment || {}) };
      eq[b.dataset.tool] = !eq[b.dataset.tool];
      if (!eq.plaque && !eq.autocuiseur) { toast('Il faut au moins des plaques de cuisson ou un autocuiseur', 'warn'); return; }
      setEquipment(eq); applyEquipment(); applyDiet(); render();
      toast('Recettes adaptées à ton équipement');
    }));
    view.querySelectorAll('.bud-btn').forEach(b => b.addEventListener('click', () => {
      const h = getHousehold();
      h.budget = Math.max(20, Math.min(400, weekBudget() + +b.dataset.delta));
      saveHousehold(h);
      view.querySelector('.bud-val').textContent = `${h.budget} €`;
    }));
    view.querySelectorAll('[data-count]').forEach(b => b.addEventListener('click', () => {
      const n = +b.dataset.count, ms = getMembers();
      if (n === ms.length) return;
      if (n === 2) { setMemberCount(2); setOnboarded(false); window._nav?.('week'); return; } // fiche de la 2e personne à remplir
      const gone = ms[ms.length - 1];
      openSheet(`<div class="sheet-handle"></div><div class="hb-sheet-pad">
        <div class="hb-h2">Retirer ${esc(gone.name || 'la deuxième personne')} du foyer ?</div>
        <p class="hb-p">Sa fiche et ses repas prévus seront effacés. La prochaine semaine générée ne comptera qu'une personne.</p>
        <button class="hb-btn hb-btn-primary rm-yes">Retirer ${esc(gone.name || 'cette personne')}</button>
        <button class="hb-btn rm-no">Annuler</button></div>`);
      const sh = document.getElementById('sheet');
      sh.querySelector('.rm-no').addEventListener('click', closeSheet);
      sh.querySelector('.rm-yes').addEventListener('click', () => {
        setMemberCount(1); closeSheet();
        profile = getProfile(); protocolId = getSelectedProtocol(); phaseIdx = getSelectedPhase(); render();
        toast(`${gone.name || 'La deuxième personne'} ne fait plus partie du foyer`);
      });
    }));
    view.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
      profile.activity = parseInt(b.dataset.act); saveProfile(profile); applyComputed(); render();
    }));
    view.querySelectorAll('.proto-card').forEach(b => b.addEventListener('click', e => {
      if (e.target.closest('[data-sheet]')) return openProtocolSheet(profile, b.dataset.pid, {
        isCurrent: b.dataset.pid === protocolId,
        onChoose: pid => { protocolId = pid; phaseIdx = 0; saveSelectedProtocol(pid); saveSelectedPhase(0); applyComputed(); toast(`Programme : ${protocolFor(profile, pid).name}`); render(); },
      });
      if (b.dataset.pid === protocolId) return;
      protocolId = b.dataset.pid; phaseIdx = 0;
      saveSelectedProtocol(protocolId); saveSelectedPhase(0); applyComputed(); render();
    }));
    view.querySelectorAll('.phase-step').forEach(b => b.addEventListener('click', () => {
      phaseIdx = parseInt(b.dataset.phase); saveSelectedPhase(phaseIdx); applyComputed(); render();
    }));
    view.querySelector('.back-to-plan')?.addEventListener('click', () => { applyComputed(); render(); toast('Calories du programme rétablies'); });
    view.querySelector('.set-back-bottom')?.addEventListener('click', () => window._nav?.('week'));
    const manual = view.querySelector('.set-manual');
    manual?.addEventListener('toggle', () => { manualOpen = manual.open; });

    // Met à jour une valeur sans redessiner la page (la section reste ouverte)
    const setManual = (key, value) => {
      const t = getTargets();
      t[key] = Math.max(0, Math.round(value));
      saveTargets(t);
      view.querySelector(`.mrow-input[data-key="${key}"]`).value = t[key];
      const wk = view.querySelector('.weekly-readout strong');
      if (wk) wk.textContent = `${(t.kcal * 7).toLocaleString('fr-FR')} kcal`;
      const body = view.querySelector('.manual-body');
      if (body && !body.querySelector('.back-to-plan')) {
        body.insertAdjacentHTML('afterbegin', '<button class="back-to-plan">Revenir aux calories du programme</button>');
        body.querySelector('.back-to-plan').addEventListener('click', () => { applyComputed(); render(); toast('Calories du programme rétablies'); });
      }
    };
    // Appui court : un pas. Appui long : ça défile tant que le doigt reste posé.
    view.querySelectorAll('.mrow-btn').forEach(btn => {
      const key = btn.dataset.key, delta = parseInt(btn.dataset.delta);
      let wait = null, rep = null;
      const step = () => setManual(key, getTargets()[key] + delta);
      const stop = () => { clearTimeout(wait); clearInterval(rep); wait = rep = null; };
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        step();
        wait = setTimeout(() => { rep = setInterval(step, 160); }, 450);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => btn.addEventListener(ev, stop));
      btn.addEventListener('click', e => { if (e.detail === 0) step(); }); // clavier
    });
    view.querySelectorAll('.mrow-input').forEach(inp => inp.addEventListener('change', () => {
      const v = parseInt(inp.value);
      if (!isNaN(v) && v >= 0) setManual(inp.dataset.key, v);
      else inp.value = getTargets()[inp.dataset.key];
    }));
  }

  function mrow(key, label, value, unit, step) {
    return `
      <div class="settings-field">
        <span class="field-label">${label}</span>
        <div class="field-control">
          <button class="mrow-btn" data-key="${key}" data-delta="-${step}">−</button>
          <input class="mrow-input" type="text" inputmode="decimal" data-key="${key}" value="${value}">
          <span class="field-unit">${unit}</span>
          <button class="mrow-btn" data-key="${key}" data-delta="${step}">+</button>
        </div>
      </div>`;
  }

  render();
}

// Riz et pâtes (v171) : complets, classiques ou au choix sur la fiche de chaque plat. Commun au foyer.
function staplesCard() {
  const mode = getStaples();
  const NOTES = {
    complet: `Riz complet et pâtes complètes dans tous les plats : plus de fibres, cuisson plus longue (riz : ${getEquipment()?.autocuiseur === false ? '35 min à la casserole au lieu de 12' : '20 min sous pression au lieu de 5'}).`,
    classique: 'Riz blanc et pâtes classiques dans tous les plats.',
    plat: 'Tu choisis sur la fiche de chaque plat. Par défaut : complet.',
  };
  return `<div class="dt-card dt-staples" style="--c:var(--leaf);--t:var(--leaf-t)">
    <div class="dt-top"><b>Riz et pâtes</b><span>Pour tout le foyer</span></div>
    <div class="dt-seg" role="radiogroup" aria-label="Riz et pâtes">
      ${[['complet', 'Complets'], ['classique', 'Classiques'], ['plat', 'Plat par plat']].map(([v, l]) =>
        `<button class="dt-btn ${mode === v ? 'on' : ''}" data-staples="${v}" role="radio" aria-checked="${mode === v}">${l}</button>`).join('')}
    </div>
    <p class="dt-note">${NOTES[mode]}</p>
  </div>`;
}

// ── Sauvegarde et restauration des données (v193) ──
// Tout ce que l'app enregistre sur le téléphone commence par « hebe_ » ou « diet_ » (fiches, semaine, notes, placard, journal…).
const BACKUP_PREFIXES = ['hebe_', 'diet_'];
const isAppKey = k => BACKUP_PREFIXES.some(p => k.startsWith(p));
const frDate = d => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
function lastBackupText() {
  const d = localStorage.getItem('hebe_last_backup');
  if (!d) return 'jamais';
  const day = x => new Date(x).toDateString();
  return day(d) === day(Date.now()) ? 'aujourd\'hui' : `le ${frDate(d)}`;
}
async function exportBackup() {
  const date = new Date().toISOString();
  localStorage.setItem('hebe_last_backup', date);
  const data = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (isAppKey(k)) data[k] = localStorage.getItem(k); }
  const json = JSON.stringify({ app: 'hebe', version: 1, date, data });
  const name = `hebe-sauvegarde-${date.slice(0, 10)}.json`;
  const file = new File([json], name, { type: 'application/json' });
  // sur téléphone : la fenêtre de partage (Enregistrer dans Fichiers, iCloud, Drive…) ; sinon, un téléchargement
  try {
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: 'Sauvegarde Hébé' }); toast('Sauvegarde créée'); return; }
  } catch (e) { if (e?.name === 'AbortError') return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Sauvegarde créée');
}
function askRestore(text) {
  let backup;
  try { backup = JSON.parse(text); } catch { backup = null; }
  if (!backup || backup.app !== 'hebe' || !backup.data || typeof backup.data !== 'object') { toast('Ce fichier n\'est pas une sauvegarde Hébé', 'warn'); return; }
  openSheet(`<div class="sheet-handle"></div><div class="hb-sheet-pad bk-confirm">
      <div class="hb-h2">Restaurer cette sauvegarde ?</div>
      <p>Sauvegarde du ${frDate(backup.date)}. Elle remplacera tout ce qui est sur ce téléphone : fiches, semaine, notes des plats, placard.</p>
      <div class="bk-btns"><button class="hb-btn bk-sec" data-bk-cancel>Annuler</button><button class="hb-btn hb-btn-primary" data-bk-ok>Restaurer</button></div>
    </div>`);
  const sheet = document.getElementById('sheet');
  sheet.querySelector('[data-bk-cancel]').addEventListener('click', () => closeSheet());
  sheet.querySelector('[data-bk-ok]').addEventListener('click', () => {
    const old = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (isAppKey(k)) old.push(k); }
    old.forEach(k => localStorage.removeItem(k));
    Object.entries(backup.data).forEach(([k, v]) => { if (isAppKey(k) && typeof v === 'string') localStorage.setItem(k, v); });
    closeSheet();
    location.reload();
  });
}


// ──────────────────────────────────────────────
// js/weight.js
// ──────────────────────────────────────────────
// weight.js — v200 : balance vintage + courbe sur papier millimétré. v195 : fiche « Mon poids » (pesée de la semaine, courbe, passage à l'étape suivante).
// Historique par personne : hebe_weights = { id: [{ d: 'AAAA-MM-JJ', kg }] }. Le poids du profil n'est
// mis à jour qu'au changement d'étape (sinon les besoins bougeraient chaque semaine pour quelques grammes).


const WEIGH_KEY = 'hebe_weights';
const getWeights = mid => { try { return (JSON.parse(localStorage.getItem(WEIGH_KEY) || '{}')[mid] || []).sort((a, b) => a.d.localeCompare(b.d)); } catch { return []; } };
function saveWeights(mid, list) {
  let all = {}; try { all = JSON.parse(localStorage.getItem(WEIGH_KEY) || '{}'); } catch {}
  all[mid] = list;
  localStorage.setItem(WEIGH_KEY, JSON.stringify(all));
}
const wDays = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
const kgFr = v => v.toFixed(1).replace('.', ',');
const dFr = (d, o = { day: 'numeric', month: 'short' }) => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', o);
const WT_LOSS = ['P3', 'P4'];
// rythme sur environ deux semaines (au moins 10 jours entre deux pesées), en kg par semaine
function weeklyRate(ws) {
  if (ws.length < 2) return null;
  const last = ws[ws.length - 1];
  const ref = [...ws].reverse().find(w => wDays(w.d, last.d) >= 10);
  return ref ? (last.kg - ref.kg) / wDays(ref.d, last.d) * 7 : null;
}
// pesée attendue : rien depuis 6 jours
const weighDue = m => { const ws = getWeights(m.id); return !ws.length || wDays(ws[ws.length - 1].d, getTodayDate()) >= 6; };

// ── v199 : ajustement automatique des calories ──
// À chaque pesée : pente du poids sur les 4 dernières semaines (au moins 3 pesées sur 14 jours, hors 1re semaine,
// où le corps perd surtout de l'eau) → dépense réelle = ce que tu manges − variation de poids × 7 700 kcal/kg.
// Le facteur de correction (dépense réelle / calcul) est lissé (moitié ancien, moitié mesuré) et borné à ±15 %.
const ADJ_MIN = 0.85, ADJ_MAX = 1.15;
function computeAdjust(m) {
  const all = getWeights(m.id);
  if (all.length < 3) return null;
  const last = all[all.length - 1];
  const win = all.filter(w => wDays(w.d, last.d) <= 28 && wDays(all[0].d, w.d) >= 7);
  if (win.length < 3 || wDays(win[0].d, last.d) < 14) return null;
  const xs = win.map(w => wDays(win[0].d, w.d)), ys = win.map(w => w.kg);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
  const slope = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / (xs.reduce((a, x) => a + (x - mx) ** 2, 0) || 1); // kg par jour
  const now = getTargetsFor(m).kcal;
  const intake = win.slice(1).reduce((a, w) => a + (w.kcal || now), 0) / (win.length - 1);
  const real = intake - slope * 7700;
  const formula = computeBase({ ...m, tdeeAdj: 1 }).maintenance;
  const old = +m.tdeeAdj || 1;
  const next = Math.min(ADJ_MAX, Math.max(ADJ_MIN, old * 0.5 + (real / formula) * 0.5));
  return { old, next, real: Math.round(real), formula: Math.round(formula), rate: slope * 7, last: last.d };
}
// appliqué après une pesée, si l'ajustement est activé et que l'écart vaut la peine (≥ 1,5 %)
function autoAdjust(m) {
  if (m.autoAdjust === false || m.targets) return null; // calories réglées à la main : on n'y touche pas
  const a = computeAdjust(m);
  if (!a || m.adjLastD === a.last || Math.abs(a.next - a.old) < 0.015) return null;
  const fromK = getTargetsFor(m).kcal;
  const nm = updateMember(m.id, { tdeeAdj: Math.round(a.next * 1000) / 1000, adjLastD: a.last, adjPrev: a.old });
  const toK = getTargetsFor(nm).kcal;
  updateMember(m.id, { adjNote: { d: a.last, fromK, toK, up: a.next > a.old } });
  return { fromK, toK };
}

// ── v200 : balance vintage (illustration + cadran dessiné par-dessus, 0 à 150 kg) ──
// Repères dans l'image (1254 × 1254) : centre du cadran (624, 299), rayon 200, cadran légèrement aplati (× 0,9).
const SC = { cx: 624, cy: 299, R: 200, max: 150, sweep: 250 };
const needleDeg = kg => -SC.sweep / 2 + SC.sweep * Math.min(SC.max, Math.max(0, kg)) / SC.max;
function scaleSvg(kg) {
  const { cx, cy, R, max } = SC;
  let ticks = '';
  for (let v = 0; v <= max; v++) {
    const a = needleDeg(v) * Math.PI / 180, big = v % 10 === 0, mid = v % 5 === 0;
    const r1 = R - 14, r2 = big ? R - 48 : mid ? R - 36 : R - 27, sn = Math.sin(a), cs = Math.cos(a);
    ticks += `<line x1="${(cx + r1 * sn).toFixed(1)}" y1="${(cy - r1 * cs).toFixed(1)}" x2="${(cx + r2 * sn).toFixed(1)}" y2="${(cy - r2 * cs).toFixed(1)}" class="${big ? 'b' : mid ? 'm' : ''}"/>`;
    if (v % 20 === 0) { const rt = R - 88; ticks += `<text x="${(cx + rt * sn).toFixed(1)}" y="${(cy - rt * cs + 10).toFixed(1)}">${v}</text>`; }
  }
  return `<svg class="wt-dial" viewBox="0 0 1254 1254" aria-hidden="true"><g transform="translate(${cx} ${cy}) scale(1 .9) translate(${-cx} ${-cy})">
    <g class="wt-ticks">${ticks}</g>
    <text class="wt-dial-kg" x="${cx}" y="${cy + 122}">${kgFr(kg)}</text><text class="wt-dial-u" x="${cx}" y="${cy + 152}">KG</text>
    <g class="wt-needle" style="transform:rotate(${needleDeg(0)}deg);transform-origin:${cx}px ${cy}px" data-deg="${needleDeg(kg)}">
      <path d="M${cx - 6} ${cy + 40} L${cx - 2.2} ${cy - R + 40} L${cx} ${cy - R + 15} L${cx + 2.2} ${cy - R + 40} L${cx + 6} ${cy + 40} Z"/></g>
    <circle cx="${cx}" cy="${cy}" r="24" class="wt-cap"/><circle cx="${cx - 7}" cy="${cy - 7}" r="8" class="wt-cap-hl"/>
  </g></svg>`;
}

// ── v200 : courbe sur papier millimétré, tracé à l'encre légèrement tremblé ──
function chart(ws) {
  const pts = ws.slice(-12);
  if (pts.length < 2) return '<div class="wt-empty">Ta courbe apparaît dès la deuxième pesée.</div>';
  const W = 320, H = 150, X0 = 26, X1 = 306, Y0 = 12, Y1 = 124, G = 5.6;
  const ks = pts.map(p => p.kg);
  let lo = Math.min(...ks), hi = Math.max(...ks);
  const pad = Math.max(0.4, (hi - lo) * 0.18); lo -= pad; hi += pad;
  const x = i => X0 + i * (X1 - X0) / (pts.length - 1), y = v => Y0 + (hi - v) * (Y1 - Y0) / (hi - lo);
  const P = pts.map((p, i) => [x(i), y(p.kg)]);
  let d = `M${P[0][0].toFixed(1)},${P[0][1].toFixed(1)}`;
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2;
    d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  // quadrillage : un trait fin tous les 5,6 px, un trait plus marqué tous les 5 carreaux
  let grid = '';
  for (let k = 0, gx = X0 - 16; gx <= X1 + 10; gx += G, k++) grid += `<line x1="${gx.toFixed(1)}" x2="${gx.toFixed(1)}" y1="0" y2="134" class="${k % 5 ? '' : 'b'}"/>`;
  for (let k = 0, gy = 0; gy <= 134; gy += G, k++) grid += `<line x1="${X0 - 16}" x2="${X1 + 14}" y1="${gy.toFixed(1)}" y2="${gy.toFixed(1)}" class="${k % 5 ? '' : 'b'}"/>`;
  // graduations : kilos entiers (ou tous les 2 kg si l'écart est grand)
  const st = hi - lo > 6 ? 2 : 1, ticks = [];
  for (let v = Math.ceil(lo / st) * st; v <= hi; v += st) ticks.push(v);
  const ax = ticks.map(v => `<text x="${X0 - 20}" y="${(y(v) + 4).toFixed(1)}" class="wt-ax">${v}</text>`).join('');
  const marks = P.map((q, i) => i === P.length - 1
    ? `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="5.5" class="wt-last"/>`
    : `<path d="M${(q[0] - 3.5).toFixed(1)} ${(q[1] - 3.5).toFixed(1)}l7 7M${(q[0] + 3.5).toFixed(1)} ${(q[1] - 3.5).toFixed(1)}l-7 7" class="wt-x"/>`).join('');
  const fmt = dd => dFr(dd, { day: 'numeric', month: 'long' });
  return `<svg class="wt-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution du poids">
    <defs><filter id="wtWob"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="3"/></filter></defs>
    <g class="wt-mm">${grid}</g>${ax}<path d="${d}" class="wt-line" filter="url(#wtWob)"/>${marks}
    <text x="${X0}" y="148" class="wt-ax">${fmt(pts[0].d)}</text><text x="${X1}" y="148" class="wt-ax" text-anchor="end">${fmt(pts[pts.length - 1].d)}</text></svg>`;
}

let weighOpen = false; // « Me peser » ouvre la pesée même si celle de la semaine est faite

function renderWeight() {
  const app = document.getElementById('app');
  app.querySelector('.view')?.remove();
  const view = el('div', 'view wt-view');
  const m = getActiveMember();
  const ws = getWeights(m.id);
  const last = ws[ws.length - 1];
  const due = weighDue(m);
  const weighing = due || weighOpen;
  const proto = getProtocol(m.protocol || 'P4');
  const phase = +(m.phase || 0);
  const rate = weeklyRate(ws.filter(w => !m.phaseSince || w.d >= m.phaseSince));
  // avec l'ajustement automatique, les calories se recalent déjà ; l'étape suivante n'est proposée que si la correction est au plus bas
  const autoOn = m.autoAdjust !== false && !m.targets;
  const slow = WT_LOSS.includes(proto.id) && rate != null && rate > -0.2 && phase < proto.phases.length - 1 && m.stepSnooze !== last?.d
    && (!autoOn || (+m.tdeeAdj || 1) <= ADJ_MIN + 0.005);
  const note = m.adjNote && last && m.adjNote.d === last.d ? m.adjNote : null;
  const start = last?.kg || m.weight || 70;
  const first = ws[0];
  const stepName = slow ? `l'${proto.phases[phase + 1].label.toLowerCase()}` : '';

  const sign = v => (v <= 0 ? '−' : '+') + kgFr(Math.abs(v));
  const total = first && last && ws.length > 1 ? last.kg - first.kg : null;
  const goodDir = v => (WT_LOSS.includes(proto.id) ? v < 0 : proto.id === 'P1' ? v > 0 : true);
  const nextD = last ? (() => { const d = new Date(last.d + 'T12:00:00'); d.setDate(d.getDate() + 7); return localYMD(d); })() : null;
  const kcalNow = getTargetsFor(m).kcal;
  const prog = proto.phases[phase] ? `Ton programme : ${proto.name.toLowerCase()} (${proto.phases[phase].label.toLowerCase()}).` : `Ton programme : ${proto.name.toLowerCase()}.`;
  const dLong = dd => dFr(dd, { weekday: 'long', day: 'numeric', month: 'long' });
  const sub = weighing ? (last && !due ? "Cette pesée remplacera celle d'aujourd'hui." : 'Pèse-toi le matin, à jeun.')
    : `Dernière pesée le ${dLong(last.d)}, la prochaine ${dFr(nextD, { weekday: 'long', day: 'numeric' })}.`;
  const chips = [
    total != null ? `<div class="wt-chip ${goodDir(total) ? 'good' : ''}">Depuis le ${dFr(first.d, { day: '2-digit', month: '2-digit' })}<b>${sign(total)} kg</b></div>` : '',
    rate != null ? `<div class="wt-chip">Rythme<b>${Math.abs(rate) < 0.05 ? 'stable' : `${sign(rate)} kg/sem`}</b></div>` : '',
    `<div class="wt-chip">Objectif<b>${kcalNow} kcal</b></div>`,
  ].join('');

  view.innerHTML = `
    <div class="hb-page-title">Mon poids</div>
    <div class="wt-sub">${sub}</div>
    <div class="wt-scale"><img src="img/art/balance.webp" alt="" width="720" height="720">${scaleSvg(start)}</div>

    ${weighing ? `<div class="wt-weigh">
      <button class="wt-step-btn" data-wstep="-0.1" aria-label="100 g de moins">−</button>
      <label class="wt-val"><input class="wt-input" type="text" inputmode="decimal" enterkeyhint="done" value="${kgFr(start)}" data-kg="${start}" aria-label="Ton poids en kilos"><small>kg</small></label>
      <button class="wt-step-btn" data-wstep="0.1" aria-label="100 g de plus">+</button>
    </div>
    <button class="hb-btn hb-btn-primary wt-cta wt-save">Enregistrer</button>
    ${weighOpen && !due ? '<button class="wt-later" data-weigh-cancel>Annuler</button>' : ''}`
    : `<div class="wt-chips">${chips}</div><button class="hb-btn hb-btn-primary wt-cta" data-weigh-open>Me peser</button>`}

    ${slow ? `<div class="wt-card wt-step">
      <h2>Ta perte ralentit</h2>
      <p>${Math.abs(rate) < 0.05 ? "Ton poids n'a presque pas bougé ces deux dernières semaines." : rate > 0 ? `Ton poids a remonté ces deux dernières semaines (+${kgFr(rate)} kg par semaine).` : `Seulement ${kgFr(-rate)} kg de moins par semaine ces deux dernières semaines.`} C'est le moment de passer à <b>${stepName}</b> : ${computeAllPhases(m, proto.id)[phase + 1].targets.kcal} kcal par jour, dès ta prochaine semaine.</p>
      <button class="hb-btn hb-btn-primary" data-step-go>Passer à ${stepName}</button>
      <button class="wt-later" data-step-later>Plus tard</button>
    </div>` : ''}

    ${ws.length >= 2 ? `<div class="wt-card wt-paper">
      <h2>Ton évolution</h2><div class="wt-m">${ws.length} pesées depuis le ${dFr(first.d, { day: 'numeric', month: 'long' })}</div>
      ${chart(ws)}
    </div>` : ''}

    <div class="wt-card wt-kcal">
      <div class="wt-row">
        <div><h2>Calories ajustées</h2><div class="wt-m">${m.targets ? "Réglées à la main dans Mon programme : Hébé n'y touche pas." : 'Hébé recale ton objectif selon tes pesées.'}</div></div>
        <button class="wt-switch ${autoOn ? 'on' : ''}" role="switch" aria-checked="${autoOn}" aria-label="Ajustement automatique des calories" data-auto ${m.targets ? 'disabled' : ''}><i></i></button>
      </div>
      <div class="wt-kcal-v">${kcalNow}<small>kcal / jour</small></div>
      ${note ? `<div class="wt-note">Tu dépenses un peu ${note.up ? 'plus' : 'moins'} que prévu : objectif ${note.up ? 'monté' : 'baissé'} de ${Math.abs(note.toK - note.fromK)} kcal cette semaine. Ça s'applique dès ta prochaine semaine.
        <button class="wt-undo" data-adj-undo>Annuler cet ajustement</button></div>` : `<div class="wt-m">${prog}</div>`}
    </div>

    ${ws.length ? `<div class="wt-card wt-hist">
      <h2>Historique</h2>
      ${[...ws].reverse().slice(0, 8).map((w, i, arr) => { const prev = [...ws].reverse()[i + 1]; const dv = prev ? w.kg - prev.kg : null; return `<div class="wt-hrow"><span>${dFr(w.d, { day: '2-digit', month: '2-digit' })}</span><b>${kgFr(w.kg)} kg</b><em class="${dv == null ? '' : goodDir(dv) || Math.abs(dv) < 0.05 ? 'good' : 'bad'}">${dv == null ? '' : Math.abs(dv) < 0.05 ? '=' : sign(dv)}</em></div>`; }).join('')}
    </div>` : ''}
  `;
  app.insertBefore(view, app.querySelector('#nav'));

  // l'aiguille part de 0 et tourne jusqu'au poids
  const needle = view.querySelector('.wt-needle');
  const setNeedle = kg => { needle.style.transform = `rotate(${needleDeg(kg)}deg)`; view.querySelector('.wt-dial-kg').textContent = kgFr(kg); };
  requestAnimationFrame(() => requestAnimationFrame(() => setNeedle(start)));

  const val = view.querySelector('.wt-input');
  // le poids se tape directement (virgule ou point) ou s'ajuste avec − et +
  const setVal = (v, write = true) => { v = Math.round(Math.min(250, Math.max(20, v)) * 10) / 10; val.dataset.kg = v; if (write) val.value = kgFr(v); setNeedle(v); };
  val?.addEventListener('focus', () => val.select());
  val?.addEventListener('input', () => { const v = parseFloat(val.value.replace(',', '.')); if (v >= 20 && v <= 250) setVal(v, false); });
  val?.addEventListener('blur', () => setVal(+val.dataset.kg));
  val?.addEventListener('keydown', e => { if (e.key === 'Enter') val.blur(); });
  let hold = null;
  view.querySelectorAll('[data-wstep]').forEach(b => {
    const step = () => setVal(+val.dataset.kg + +b.dataset.wstep);
    b.addEventListener('click', step);
    b.addEventListener('pointerdown', () => { hold = setTimeout(() => { hold = setInterval(step, 80); }, 400); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, () => { clearTimeout(hold); clearInterval(hold); }));
  });
  view.querySelector('[data-weigh-open]')?.addEventListener('click', () => { weighOpen = true; renderWeight(); });
  view.querySelector('[data-weigh-cancel]')?.addEventListener('click', () => { weighOpen = false; renderWeight(); });
  view.querySelector('.wt-save')?.addEventListener('click', () => {
    const d = getTodayDate();
    saveWeights(m.id, [...getWeights(m.id).filter(w => w.d !== d), { d, kg: +val.dataset.kg, kcal: getTargetsFor(m).kcal }]);
    const adj = autoAdjust(getMembers().find(x => x.id === m.id));
    weighOpen = false;
    document.querySelector('.nav-btn[data-view="weight"] .nav-dot')?.remove();
    renderWeight();
    toast(adj ? `Pesée enregistrée, tes calories passent à ${adj.toK} kcal par jour.` : `Pesée enregistrée : ${kgFr(+val.dataset.kg)} kg.`);
  });
  view.querySelector('[data-adj-undo]')?.addEventListener('click', () => {
    updateMember(m.id, { tdeeAdj: m.adjPrev ?? 1, adjNote: null });
    renderWeight();
    toast('Ajustement annulé');
  });
  view.querySelector('[data-auto]')?.addEventListener('click', () => {
    const on = !(m.autoAdjust !== false);
    updateMember(m.id, on ? { autoAdjust: true } : { autoAdjust: false, tdeeAdj: 1, adjNote: null });
    renderWeight();
    toast(on ? 'Ajustement automatique activé' : 'Ajustement automatique désactivé : retour au calcul de départ');
  });
  view.querySelector('[data-step-go]')?.addEventListener('click', () => {
    updateMember(m.id, { phase: phase + 1, phaseSince: getTodayDate(), weight: last?.kg || m.weight });
    renderWeight();
    toast('Nouvelle étape : elle s\'applique à ta prochaine semaine');
  });
  view.querySelector('[data-step-later]')?.addEventListener('click', () => {
    updateMember(m.id, { stepSnooze: last?.d || getTodayDate() });
    renderWeight();
  });
}

// pastille sur l'onglet Poids quand une pesée est attendue
window._weighDue = () => { try { return weighDue(getActiveMember()); } catch { return false; } };


// ──────────────────────────────────────────────
// js/welcome.js
// ──────────────────────────────────────────────
// welcome.js — Accueil : faire connaissance.
// Première ouverture : bienvenue → foyer → pour chaque personne (profil, mesures, quotidien, repas, objectif) → résumé.
// Profil repris d'une ancienne version : foyer, prénom et profil, repas, puis les autres personnes éventuelles.
// Personne ajoutée depuis Mon programme : seulement les étapes de cette personne.


// Point de départ des boutons − et + quand une case est encore vide (rien n'est enregistré tant qu'on n'y touche pas)
const START = {
  male:   { age: 30, height: 1.78, weight: 78, bodyfat: 20 },
  female: { age: 30, height: 1.65, weight: 62, bodyfat: 28 },
};
const RANGES = {
  age:     { min: 18, max: 99,  msg: 'Hébé est conçue pour les adultes : indique un âge entre 18 et 99 ans.' },
  height:  { min: 1.3, max: 2.3, msg: 'Indique ta taille en mètres, par exemple 1,72.' },
  weight:  { min: 35, max: 250, msg: 'Indique un poids entre 35 et 250 kg.' },
  bodyfat: { min: 5,  max: 60,  msg: 'Indique une masse grasse entre 5 et 60 %. Si tu ne la connais pas, estime-la avec les silhouettes.' },
};
const MEMBER_STEPS = ['identity', 'measures', 'activity', 'meals', 'goal'];
const ORD = ['Première', 'Deuxième'];

const WL_BACK = '<button class="round-back wl-back" aria-label="Étape précédente"><svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg></button>';

function renderWelcome(onDone) {
  const app = document.getElementById('app');
  app.querySelector('.view')?.remove();
  const view = el('div', 'view welcome-view');
  app.appendChild(view);

  const h = getHousehold();
  const firstTime = !h.onboardedOnce;
  const memberSteps = mid => MEMBER_STEPS.map(type => ({ type, mid }));
  const incomplete = () => getMembers().filter(m => !isComplete(m)).map(m => m.id);

  // Étapes qui suivent le choix du foyer
  function tail() {
    const out = [];
    if (h.migrated && firstTime) out.push({ type: 'identity', mid: 'm1' }, { type: 'meals', mid: 'm1' });
    getMembers().forEach(m => { if (!isComplete(m) && !(h.migrated && firstTime && m.id === 'm1')) out.push(...memberSteps(m.id)); });
    if (out.some(s => s.type === 'goal') || getMembers().length > 1) out.push({ type: 'summary' });
    return out;
  }
  let steps;
  if (firstTime) steps = [...(h.migrated ? [] : [{ type: 'hello' }]), { type: 'household' }, { type: 'tools' }, ...tail()];
  else steps = [...incomplete().flatMap(memberSteps), { type: 'summary' }];
  let i = 0;
  let error = '';

  const cur = () => steps[i];
  const member = () => getMember(cur().mid) || getActiveMember();

  const progress = () => {
    const counted = steps.filter(s => s.type !== 'hello');
    const k = counted.indexOf(cur());
    if (k < 0 || counted.length < 2) return '';
    return `<div class="wl-progress" role="progressbar" aria-valuemin="1" aria-valuemax="${counted.length}" aria-valuenow="${k + 1}" aria-label="Étape ${k + 1} sur ${counted.length}">
      ${counted.map((_, j) => `<i class="${j <= k ? 'on' : ''}"></i>`).join('')}</div>`;
  };
  const top = () => `<div class="wl-top">${i > 0 ? WL_BACK : '<span class="wl-spacer"></span>'}${progress()}</div>`;
  // pastille de la personne concernée (foyer de deux)
  const who = () => {
    const ms = getMembers();
    if (ms.length < 2 || !cur().mid) return '';
    const k = ms.findIndex(m => m.id === cur().mid);
    const m = member();
    return `<div class="wl-who"><span class="wl-who-n">${k + 1}</span>${m.name ? esc(m.name) : `${ORD[k]} personne`}${m.name ? '' : ' sur deux'}</div>`;
  };
  // étiquette colorée de l'étape
  const KICK = { tools: 'Ta cuisine', household: 'Ton foyer', identity: 'Profil', measures: 'Mesures', activity: 'Quotidien', meals: 'Repas', goal: 'Objectif', summary: 'Résumé' };
  const kick = () => ''; // pas d'étiquette au-dessus des titres
  const errBox = () => (error ? `<p class="wl-error" role="alert">${error}</p>` : '');
  const cta = label => `<div class="wl-cta"><button class="hb-btn hb-btn-primary wl-next">${label}</button></div>`;

  function screen() {
    const s = cur();
    const m = member();
    const p = getProfile();
    switch (s.type) {
      case 'hello': return `
        <div class="wl-hero" aria-hidden="true">
          <span class="wl-blob b1"></span><span class="wl-blob b2"></span>
          <img class="wl-art" src="img/art/accueil.webp" alt="">
        </div>
        <div class="wl-hello">
          <div class="brand-word">Héb<span class="brand-accent">é</span></div>
          <div class="brand-tag">Bien manger sans y penser</div>
          <div class="wl-points">
            <div><i style="background:var(--honey)"></i>${getMains().filter(r => r.batch && !(r.tags || []).includes('cantine')).length} plats du monde</div>
            <div><i style="background:var(--sky)"></i>Des portions calculées pour toi</div>
            <div><i style="background:var(--terra)"></i>Une seule session de cuisine par semaine</div>
            <div><i style="background:var(--sage)"></i>La liste de courses toute prête</div>
          </div>
          <p class="wl-end">Plus qu'à cuisiner !</p>
        </div>
        <div class="wl-cta wl-cta-hello"><button class="hb-btn hb-btn-primary wl-next">Commencer</button>
          <button class="wl-restore-btn" data-wl-restore>J'ai déjà une sauvegarde Hébé</button><input type="file" accept=".json,application/json" data-wl-file hidden></div>`;

      case 'household': return `
        ${top()}
        ${kick()}
        <h1 class="wl-title">Pour combien de personnes ?</h1>
        ${householdCards(getMembers().length >= 2 ? 2 : (h.countChosen ? 1 : 0))}
        ${errBox()}
        ${cta('Continuer')}`;

      case 'tools': return `
        ${top()}${kick()}
        <h1 class="wl-title">Qu'as-tu dans ta cuisine ?</h1>
        ${equipmentBlock(getHousehold().equipment)}
        ${errBox()}
        ${cta('Continuer')}`;

      case 'identity': return `
        ${top()}${who()}${kick()}
        <h1 class="wl-title">Faisons connaissance</h1>
        ${identityBlock(m, { error })}
        ${cta('Continuer')}`;

      case 'measures': return `
        ${top()}${who()}${kick()}
        <h1 class="wl-title">${getMembers().length > 1 && m.name ? `Les mesures de ${esc(m.name)}` : 'Tes mesures'}</h1>
        ${measuresGrid(p)}
        ${bodyfatButton(m.sex)}
        ${errBox()}
        ${cta('Continuer')}`;

      case 'activity': return `
        ${top()}${who()}${kick()}
        <h1 class="wl-title">${getMembers().length > 1 && m.name ? `Le quotidien de ${esc(m.name)}` : 'Ton quotidien'}</h1>
        ${activityList(p.activity)}
        ${errBox()}
        ${cta('Continuer')}`;

      case 'meals': return `
        ${top()}${who()}${kick()}
        <h1 class="wl-title">${getMembers().length > 1 && m.name ? `Les repas de ${esc(m.name)}` : 'Tes repas'}</h1>
        ${mealsBlock(m, { error })}
        ${cta('Continuer')}`;

      case 'goal': return `
        ${top()}${who()}${kick()}
        <h1 class="wl-title">${getMembers().length > 1 && m.name ? `L'objectif de ${esc(m.name)}` : 'Ton objectif'}</h1>
        ${protocolCards(p, m.protocol)}
        ${errBox()}
        ${cta('Voir les besoins')}`;

      case 'summary': {
        const ms = getMembers();
        return `
        ${top()}${kick()}
        <h1 class="wl-title">Tout est prêt${ms.length === 1 ? `, ${esc(ms[0].name)}` : ''}</h1>
        <div class="sm-list">
          ${ms.map((x, k) => {
            const t = getTargetsFor(x);
            const proto = protocolFor(x, x.protocol);
            return `<div class="sm-card" style="${k ? '--c:var(--honey);--t:var(--honey-t)' : '--c:var(--leaf);--t:var(--leaf-t)'}">
              <div class="sm-head"><span class="sm-av">${avatar(x.sex)}</span><div><b>${esc(x.name)}</b><span>${proto.name}</span></div></div>
              <div class="sm-kcal">${t.kcal}<span> kcal par jour</span></div>
              <div class="sm-maint">Dépense quotidienne : ${Math.round(computeBase(x).maintenance)} kcal</div>
              <div class="tc-macros">
                <div class="tcm protein"><div class="tcm-bar"></div><strong>${t.protein}g</strong><span>Protéines</span></div>
                <div class="tcm carbs"><div class="tcm-bar"></div><strong>${t.carbs}g</strong><span>Glucides</span></div>
                <div class="tcm fat"><div class="tcm-bar"></div><strong>${t.fat}g</strong><span>Lipides</span></div>
              </div>
            </div>`;
          }).join('')}
        </div>
        ${cta('Préparer ma semaine')}`;
      }
    }
    return '';
  }

  let shownStep = -1;
  function render() {
    if (cur().mid) setActiveMember(cur().mid);
    const keepY = window.scrollY;
    view.className = `view welcome-view wl-${cur().type}`;
    view.innerHTML = screen();
    bind();
    // en haut seulement quand on change d'étape ; une réponse ne fait pas remonter la page
    window.scrollTo(0, shownStep === i ? keepY : 0);
    shownStep = i;
  }
  const fail = (msg, focusSel) => { error = msg; render(); if (focusSel) view.querySelector(focusSel)?.focus(); };

  function next() {
    const s = cur();
    const m = member();
    if (s.type === 'household') {
      if (!h.countChosen && getMembers().length < 2) return fail('Choisis pour combien de personnes Hébé prépare les repas.');
      steps = [...steps.slice(0, i + 1), { type: 'tools' }, ...tail()];
    }
    if (s.type === 'tools') {
      const eq = getHousehold().equipment || {};
      if (!eq.plaque && !eq.autocuiseur) return fail('Coche au moins des plaques de cuisson ou un autocuiseur.');
    }
    if (s.type === 'identity') {
      const name = view.querySelector('.id-name').value.trim();
      if (name) updateMember(m.id, { name });
      if (!name || !getMember(m.id).sex) {
        return fail(!name && !m.sex ? 'Indique le prénom et choisis le profil pour continuer.'
          : !name ? 'Indique le prénom pour continuer.' : 'Choisis le profil pour continuer.', !name ? '.id-name' : '.sx-card');
      }
    }
    if (s.type === 'measures') {
      const pr = getProfile();
      const bad = Object.keys(RANGES).find(k => pr[k] == null || pr[k] < RANGES[k].min || pr[k] > RANGES[k].max);
      if (bad) return fail(pr[bad] == null ? 'Remplis les quatre mesures pour continuer.' : RANGES[bad].msg, `.pcell-input[data-key="${bad}"]`);
    }
    if (s.type === 'activity' && !getMember(m.id).activity) return fail('Choisis le quotidien qui ressemble le plus à une semaine habituelle.');
    if (s.type === 'meals' && !getMember(m.id).formula) return fail('Choisis le rythme de repas.');
    if (s.type === 'meals' && getMember(m.id).whey == null) return fail('Indique si tu as de la protéine en poudre (whey).');
    if (s.type === 'goal' && !getMember(m.id).protocol) return fail('Choisis un programme pour continuer.');
    error = '';
    if (i < steps.length - 1) { i++; render(); return; }
    // fin du parcours : objectifs du programme de chacun, puis la semaine
    getMembers().forEach(x => { setActiveMember(x.id); saveTargets(computeTargets(getProfile(), x.protocol, x.phase || 0)); });
    setActiveMember(getMembers()[0].id);
    setOnboarded(true);
    if (!steps.some(st => st.type === 'summary')) toast(`Merci ${getMembers()[0].name}, ton profil est à jour`);
    onDone();
  }

  function bind() {
    view.querySelector('.wl-next')?.addEventListener('click', next);
    // v195 : nouveau téléphone, reprendre ses données sans refaire le profil
    const wlFile = view.querySelector('[data-wl-file]');
    view.querySelector('[data-wl-restore]')?.addEventListener('click', () => wlFile?.click());
    wlFile?.addEventListener('change', async () => { const f = wlFile.files?.[0]; wlFile.value = ''; if (f) askRestore(await f.text()); });
    view.querySelector('.wl-back')?.addEventListener('click', () => { error = ''; i = Math.max(0, i - 1); render(); });
    const m = member();
    // équipement
    view.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => {
      const eq = { ...(getHousehold().equipment || {}) };
      eq[b.dataset.tool] = !eq[b.dataset.tool];
      setEquipment(eq); error = ''; render();
    }));
    // foyer
    view.querySelectorAll('[data-count]').forEach(b => b.addEventListener('click', () => {
      setMemberCount(+b.dataset.count); h.countChosen = true; getHousehold().countChosen = true; error = ''; render();
    }));
    // prénom et profil
    const nameInp = view.querySelector('.id-name');
    nameInp?.addEventListener('input', () => { if (error) { error = ''; view.querySelector('.wl-error')?.remove(); } });
    nameInp?.addEventListener('keydown', e => { if (e.key === 'Enter') { nameInp.blur(); next(); } });
    nameInp?.addEventListener('change', () => { const v = nameInp.value.trim(); if (v) updateMember(m.id, { name: v }); });
    view.querySelectorAll('[data-sex]').forEach(b => b.addEventListener('click', () => {
      const name = view.querySelector('.id-name')?.value.trim();
      updateMember(m.id, { sex: b.dataset.sex, ...(name ? { name } : {}) });
      error = ''; render();
    }));
    // mesures
    const start = () => START[getMember(m.id)?.sex] || START.male;
    const getValue = (k, fallback) => getProfile()[k] ?? (fallback ? null : start()[k]);
    getValue.allowEmpty = true;
    bindMeasures(view, getValue, (k, v) => { saveProfile({ [k]: v }); error = ''; render(); });
    view.querySelector('.bf-guide-btn')?.addEventListener('click', () =>
      openBodyfatGuide(getProfile().bodyfat ?? start().bodyfat, v => { saveProfile({ bodyfat: v }); error = ''; render(); }, getMember(m.id).sex));
    // quotidien
    view.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => { saveProfile({ activity: parseInt(b.dataset.act) }); error = ''; render(); }));
    // repas et régime
    view.querySelectorAll('[data-formula]').forEach(b => b.addEventListener('click', () => { updateMember(m.id, { formula: b.dataset.formula }); error = ''; render(); }));
    view.querySelectorAll('[data-diet]').forEach(b => b.addEventListener('click', () => { updateMember(m.id, { [b.dataset.diet]: +b.dataset.level }); render(); }));
    view.querySelectorAll('[data-bk]').forEach(b => b.addEventListener('click', () => { updateMember(m.id, { breakfast: b.dataset.bk }); render(); }));
    view.querySelectorAll('[data-whey]').forEach(b => b.addEventListener('click', () => { updateMember(m.id, { whey: b.dataset.whey === '1' }); error = ''; render(); }));
    // objectif (avec la fiche détaillée)
    view.querySelectorAll('.proto-card').forEach(b => b.addEventListener('click', e => {
      if (e.target.closest('[data-sheet]')) {
        return openProtocolSheet(getProfile(), b.dataset.pid, {
          isCurrent: getMember(m.id).protocol === b.dataset.pid,
          onChoose: pid => { updateMember(m.id, { protocol: pid, phase: 0, targets: null }); error = ''; render(); },
        });
      }
      updateMember(m.id, { protocol: b.dataset.pid, phase: 0, targets: null }); error = ''; render();
    }));
  }

  render();
}


// ──────────────────────────────────────────────
// js/main.js
// ──────────────────────────────────────────────

const VIEWS = {
  week:     renderWeek,
  cook:     renderCook,
  shopping: renderShopping,
  recipes:  renderRecipes,
  settings: renderSettings,
  weight:   renderWeight,
};

// changer d'onglet ou de page ramène toujours en haut
function navigate(view) { setState({ currentView: view }); render(); window.scrollTo(0, 0); }

function render() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  applyEquipment(); // recettes adaptées à l'équipement du foyer
  applyDiet();      // puis au régime (lactose)
  // premier lancement : on fait connaissance avant tout le reste
  if (!isOnboarded()) { renderWelcome(() => { setState({ currentView: 'week' }); render(); window.scrollTo(0, 0); }); return; }
  (VIEWS[state.currentView] || renderWeek)();
  renderNav();
  keepAwake(state.currentView === 'cook');
}

// v195 : l'écran reste allumé pendant la session de cuisine (si le téléphone le permet)
let wakeLock = null, wantAwake = false;
async function keepAwake(on) {
  wantAwake = on;
  try {
    if (on && !wakeLock && 'wakeLock' in navigator) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener?.('release', () => { wakeLock = null; }); }
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { wakeLock = null; }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && wantAwake) keepAwake(true); });

window._nav = navigate;
document.addEventListener('DOMContentLoaded', render);
// Mise à jour automatique : on vérifie s'il existe une nouvelle version à chaque ouverture,
// et la page se recharge toute seule (une fois) dès qu'elle est installée. Les données restent intactes.
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return; // première installation : rien à recharger
    reloaded = true;
    window.location.reload();
  });
  navigator.serviceWorker.register('./sw.js').then(reg => reg.update()).catch(() => {});
}


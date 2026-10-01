// DIET — bundled app (généré par build.js)
// 2026-10-01T14:57:57.850Z


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
//       snap : les portions de la semaine sont ajustées pour que le TOTAL tombe sur un multiple de pack
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
  poulet:        ['Blanc de poulet',            'g',     110, 23.5, 0,   1.5, 'protein', 11,   'V', { lv: 'P', min: 110, max: 350, fridge: 3, pack: 500, snap: true }],
  dinde:         ['Escalope de dinde',          'g',     107, 24,   0,   1.2, 'protein', 10.5, 'V', { lv: 'P', min: 110, max: 350, fridge: 3, pack: 500, snap: true }],
  dinde_hachee:  ['Dinde hachée',               'g',     150, 20,   0,   7.5, 'protein', 10,   'V', { lv: 'P', min: 110, max: 350, fridge: 3, pack: 350, snap: true }],
  jambon_dinde:  ['Blanc de dinde (tranches)',  'g',     105, 21,   1,   2,   'protein', 14,   'V', { lv: 'PS', min: 40, max: 160, pack: 160 }],
  boeuf:         ['Steak haché 5%',             'g',     125, 21,   0,   5,   'protein', 12,   'V', { lv: 'P', min: 100, max: 350, fridge: 3, pack: 500, snap: true }],
  saumon:        ['Saumon',                     'g',     205, 20.5, 0,   13.5,'protein', 22,   'V', { lv: 'P', min: 100, max: 160, fridge: 2, pack: 250, snap: true }],
  poisson_blanc: ['Colin / merlu (surgelé)',    'g',     80,  17.5, 0,   1,   'protein', 10,   'V', { lv: 'P', min: 120, max: 220, fridge: 2, pack: 400, snap: true }],
  crevettes:     ['Crevettes décortiquées',     'g',     95,  21,   0.5, 1.2, 'protein', 18,   'V', { lv: 'P', min: 100, max: 180, fridge: 2, pack: 200, snap: true }],
  thon:          ['Thon au naturel (égoutté)',  'g',     112, 26,   0,   1,   'protein', 13,   'E', { lv: 'PS', min: 70, max: 160, pack: 140 }],
  oeuf:          ['Œufs',                      'pièce', 75,  6.5,  0.4, 5.2, 'protein', 0.30, 'L', { lv: 'PS', min: 1, max: 4, pack: 6 }],
  tofu:          ['Tofu ferme',                 'g',     125, 13,   2,   7.5, 'protein', 9,    'L', { lv: 'P', min: 100, max: 220, fridge: 4, pack: 200, snap: true }],

  // ── Féculents (poids cru / sec) ─────────────────────────────────
  riz:           ['Riz',                        'g',     355, 7,    78,  0.8, 'carb', 2.5,  'S', { cook: 2.6, lv: 'PS', min: 50, max: 170, minP: 90, maxS: 60, pack: 1000 }],
  pates:         ['Pâtes',                      'g',     355, 12.5, 70,  1.8, 'carb', 2.0,  'S', { cook: 2.3, lv: 'P', min: 60, max: 180, minP: 100, pack: 500 }],
  nouilles_riz:  ['Nouilles de riz',            'g',     360, 6,    80,  0.7, 'carb', 6,    'S', { cook: 2.4, lv: 'P', min: 50, max: 180, minP: 100, pack: 400 }],
  boulghour:     ['Boulghour',                  'g',     350, 11,   70,  1.5, 'carb', 3.5,  'S', { cook: 2.5, lv: 'P', min: 50, max: 175, minP: 95, pack: 500 }],
  quinoa:        ['Quinoa',                     'g',     370, 14,   64,  6,   'carb', 9,    'S', { cook: 2.7, lv: 'P', min: 50, max: 165, minP: 85, pack: 500 }],
  semoule:       ['Semoule',                    'g',     360, 12,   73,  1.5, 'carb', 2,    'S', { cook: 2.2, lv: 'P', min: 50, max: 180, minP: 105, pack: 500 }],
  pdt:           ['Pommes de terre',            'g',     77,  2,    16,  0.1, 'carb', 1.5,  'F', { lv: 'P', min: 150, max: 600, minP: 300 }],
  patate_douce:  ['Patate douce',               'g',     86,  1.6,  20,  0.1, 'carb', 3,    'F', { lv: 'P', min: 150, max: 600, minP: 300 }],
  pain:          ['Pain complet',               'g',     245, 9,    44,  3,   'carb', 4.5,  'S', { lv: 'PS', min: 40, max: 120 }],
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
  courgette:     ['Courgettes',                 'g',     17,  1.2,  2.5, 0.3, 'veg', 2.5, 'F', {}],
  poivron:       ['Poivrons',                   'g',     28,  1,    5,   0.3, 'veg', 4,   'F', {}],
  oignon:        ['Oignons',                    'g',     40,  1.2,  8,   0.1, 'veg', 2,   'F', {}],
  ail:           ['Ail',                        'pièce', 4,   0.2,  0.9, 0,   'flavor', 0.10, 'F', { pantry: true }],
  haricots_verts:['Haricots verts (surgelés)',  'g',     30,  2,    4.5, 0.2, 'veg', 3,   'F', {}],
  epinards:      ['Épinards (surgelés)',        'g',     25,  3,    1.5, 0.4, 'veg', 3,   'F', {}],
  carotte:       ['Carottes',                   'g',     36,  0.8,  7,   0.3, 'veg', 1.5, 'F', {}],
  concombre:     ['Concombre',                  'g',     14,  0.6,  2.5, 0.1, 'veg', 2.5, 'F', {}],
  tomates_cerise:['Tomates cerise',             'g',     22,  0.9,  3.5, 0.2, 'veg', 6,   'F', {}],
  tomates_conc:  ['Tomates concassées',         'g',     25,  1.2,  4,   0.2, 'veg', 2.5, 'E', { pack: 400 }],
  salade:        ['Salade verte',               'g',     15,  1.3,  1.7, 0.2, 'veg', 6,   'F', {}],
  champignons:   ['Champignons de Paris',       'g',     22,  3,    1,   0.3, 'veg', 5,   'F', {}],
  chou_fleur:    ['Chou-fleur (surgelé)',       'g',     25,  2,    3,   0.3, 'veg', 3,   'F', {}],
  petits_pois:   ['Petits pois (surgelés)',     'g',     80,  5.5,  10,  0.5, 'veg', 3.5, 'F', {}],
  mais:          ['Maïs (conserve)',            'g',     90,  3,    16,  1.5, 'veg', 4,   'E', { pack: 140 }],
  legumes_mix:   ['Poêlée de légumes (surgelée)','g',    40,  2,    6,   0.5, 'veg', 3,   'F', {}],
  avocat:        ['Avocat',                     'g',     160, 2,    2,   15,  'fat', 10,  'F', { lv: 'PS', min: 30, max: 100 }],
  herbes:        ['Herbes fraîches',            'g',     30,  2,    4,   0.5, 'flavor', 15, 'F', {}],
  citron:        ['Citron (jus)',               'ml',    22,  0.4,  6,   0.2, 'flavor', 5,  'F', {}],

  // ── Fruits ──────────────────────────────────────────────────────
  banane:        ['Banane',                     'g',     90,  1.1,  20,  0.3, 'fruit', 2,   'F', { lv: 'S', min: 80, max: 150 }],
  pomme:         ['Pomme',                      'g',     54,  0.3,  12,  0.2, 'fruit', 2.5, 'F', { lv: 'S', min: 100, max: 200 }],
  fruits_rouges: ['Fruits rouges (surgelés)',   'g',     45,  1,    8,   0.3, 'fruit', 6,   'F', { lv: 'S', min: 60, max: 200 }],
  fruit_saison:  ['Fruit de saison',            'g',     55,  0.6,  12,  0.2, 'fruit', 3,   'F', { lv: 'S', min: 100, max: 250 }],
  dattes:        ['Dattes dénoyautées',         'g',     280, 2.5,  65,  0.4, 'fruit', 8,   'E', {}],

  // ── Laitages ────────────────────────────────────────────────────
  fromage_blanc: ['Fromage blanc 0%',           'g',     46,  7.5,  4,   0.2, 'dairy', 2.6, 'L', { lv: 'S', min: 100, max: 300, pack: 500 }],
  skyr:          ['Skyr',                       'g',     60,  10.5, 4,   0.2, 'dairy', 4.5, 'L', { lv: 'S', min: 100, max: 250, pack: 450 }],
  yaourt_grec:   ['Yaourt grec 0%',             'g',     57,  10,   3.6, 0.4, 'dairy', 5.5, 'L', { lv: 'S', min: 100, max: 250, pack: 500 }],
  cottage:       ['Cottage cheese',             'g',     98,  11,   3.4, 4.3, 'dairy', 7,   'L', { lv: 'S', min: 80, max: 200, pack: 200 }],
  fromage_frais: ['Fromage frais léger',        'g',     120, 8,    4,   8,   'dairy', 9,   'L', { pack: 150 }],
  parmesan:      ['Parmesan',                   'g',     390, 33,   0,   28,  'dairy', 20,  'L', { lv: 'P', min: 10, max: 30, pantry: true }],
  emmental:      ['Emmental râpé allégé',       'g',     280, 29,   0,   17,  'dairy', 10,  'L', { lv: 'P', min: 20, max: 50, pack: 150 }],
  feta:          ['Feta',                       'g',     265, 14,   1,   22,  'dairy', 12,  'L', { lv: 'P', min: 20, max: 60, pack: 200 }],
  lait:          ['Lait demi-écrémé',           'ml',    46,  3.3,  4.8, 1.6, 'dairy', 1.0, 'L', { pack: 1000 }],
  lait_coco:     ['Lait de coco light',         'ml',    75,  0.8,  2,   7,   'fat', 4,    'E', { lv: 'P', min: 80, max: 250, pack: 400 }],
  creme:         ['Crème légère 15%',           'ml',    165, 2.5,  3.5, 15,  'fat', 4,    'L', { lv: 'P', min: 15, max: 50, pack: 200 }],
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
  haut_cuisse:   ['Haut de cuisse de poulet (sans peau)', 'g', 120, 19.5, 0, 4.5, 'protein', 9,  'V', { lv: 'P', min: 110, max: 350, fridge: 3, pack: 500, snap: true }],
  boeuf_emince:  ['Bœuf à émincer (macreuse)', 'g',     135, 21,   0,   5.5, 'protein', 14,  'V', { lv: 'P', min: 110, max: 350, fridge: 3, pack: 500, snap: true }],
  aubergine:     ['Aubergine',                  'g',     25,  1,    4,   0.2, 'veg', 3,   'F', {}],
  tomate:        ['Tomates',                    'g',     18,  0.9,  3,   0.2, 'veg', 3,   'F', {}],
  pousses_soja:  ['Pousses de soja',            'g',     30,  3,    4,   0.2, 'veg', 6,   'F', {}],
  citron_vert:   ['Citron vert (jus)',          'ml',    25,  0.4,  7,   0.1, 'flavor', 8, 'F', {}],
  gingembre:     ['Gingembre frais',            'g',     80,  1.8,  18,  0.8, 'flavor', 10, 'F', {}],
  citronnelle:   ['Citronnelle',                'g',     99,  1.8,  25,  0.5, 'flavor', 12, 'F', {}],
  haricots_noirs:['Haricots noirs (conserve)',  'g',     110, 7.5,  14,  0.5, 'legume', 3.5, 'S', { lv: 'P', min: 80, max: 200, pack: 250 }],
  orzo:          ['Orzo',                       'g',     355, 12.5, 70,  1.8, 'carb', 3,  'S', { cook: 2.3, lv: 'P', min: 50, max: 180, minP: 100, pack: 500 }],
  baguette:      ['Baguette',                   'g',     270, 9,    55,  1.5, 'carb', 3,  'S', { lv: 'P', min: 70, max: 200, minP: 100 }],
  pain_burger:   ['Pain burger complet',        'g',     260, 9,    46,  4.5, 'carb', 6,  'S', { pack: 280 }],
  cheddar:       ['Cheddar allégé (tranches)',  'g',     270, 28,   1,   18,  'dairy', 14, 'L', { lv: 'P', min: 20, max: 40, pack: 200 }],
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
    pack: opts.pack || null, snap: !!opts.snap, pantry: !!opts.pantry, fridge: opts.fridge || null,
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
  pain:         { g: 40, one: 'tranche', many: 'tranches' },
  jambon_dinde: { g: 40, one: 'tranche', many: 'tranches' },
  cheddar:      { g: 20, one: 'tranche', many: 'tranches' },
  pain_burger:  { g: 70, one: 'pain',    many: 'pains' },
  tortilla:     { g: 60, one: 'wrap',    many: 'wraps' },
  pita:         { g: 70, one: 'pita',    many: 'pitas' },
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
const getMains    = () => RECIPES.filter(r => (r.category === 'dinner' || r.category === 'lunch') && !(r.tags || []).includes('cantine'));
const getSides    = () => RECIPES.filter(r => r.category === 'side');
const getSweets   = () => RECIPES.filter(r => r.category === 'sweet');
const getStarters = () => RECIPES.filter(r => r.category === 'starter');
const getById     = (id) => RECIPES.find(r => r.id === id);
const getBatch    = () => RECIPES.filter(r => r.batch);
const isCantine   = (r) => !!r && (r.tags || []).includes('cantine');
const isOutside   = (r) => !!r && (r.tags || []).includes('imprevu');

// Famille de protéine principale d'une recette (pour la variété et les filtres).
// Ids alignés sur les chips de la vue Semaine : poulet · boeuf · dinde · crevettes · saumon (= poisson) · tofu (= végé)
const FAMILY = {
  poulet: 'poulet', haut_cuisse: 'poulet', boeuf_emince: 'boeuf', dinde: 'dinde', dinde_hachee: 'dinde', jambon_dinde: 'dinde', boeuf: 'boeuf',
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
// data/calculator.js
// ──────────────────────────────────────────────
// calculator.js — Moteur Zero to Hero
// Reproduit exactement les formules du calculateur Excel.
//
// BMR1 = 13.707×poids + 492.3×taille(m) − 6.673×âge + 77.607
// BMR2 = 21.6×poids×(100−bf)/100 + 370
// BMR  = moyenne(BMR1, BMR2)
// MMR (maintenance) = BMR × 1.5
// Masse maigre = poids×(100−bf)/100
// Protéines = moyenne(poids×1.5, massemaigre×2)   [g/jour]
// Lipides   = 1.2×poids×(1−bf/100)                 [g/jour]
// Glucides  = (kcal − prot×4 − lip×9) / 4          [g/jour]

const PROTOCOLS = [
  {
    id: 'P1', name: 'Prise de muscle propre', emoji: '💪',
    purpose: "Ce programme sert à prendre du muscle en limitant au maximum la prise de gras. Tu commences à ta maintenance, puis tu ajoutes un léger surplus de calories uniquement quand ta progression ralentit. Le gain est lent mais propre : la balance monte doucement et ton tour de taille reste stable.",
    forWho: ["Tu es déjà plutôt sec et tu veux gagner du volume", "Tu t'entraînes régulièrement et tes charges progressent", "Tu acceptes de prendre un peu de poids pour construire du muscle"],
    duration: 'Sur plusieurs mois', goal: 'Muscle',
    tagline: 'Construire du muscle en limitant le gras',
    desc: 'Léger surplus calorique progressif. On ajoute des calories au fil des semaines pour continuer à prendre du muscle sans accumuler de gras superflu.',
    phases: [
      { label: 'Semaine initiale', short: "Maintenance : le corps s'adapte, la force grimpe", when: 'Ta force stagne 2 semaines', offset: 0,
        advice: 'Démarre à maintenance. Mange à ta dépense réelle, le temps que ton corps s\'adapte et que ta force grimpe.',
        advance: 'Passe à l\'étape suivante quand ta progression en charge stagne 2 semaines de suite.' },
      { label: 'Étape 1', short: '+200 kcal : prise de muscle propre', when: 'La prise de poids ralentit, le miroir reste net', offset: +200,
        advice: 'Surplus de +200 kcal. C\'est le sweet spot pour gagner du muscle proprement (~+0.25 kg/semaine max).',
        advance: 'Augmente encore si la prise de poids ralentit et que le miroir reste net.' },
      { label: 'Étape 2', short: '+400 kcal quand tu pousses fort', when: 'Dernier palier : redescends si le gras monte', offset: +400,
        advice: 'Surplus de +400 kcal pour les phases où tu pousses fort. Surveille le tour de taille — si le gras monte trop vite, redescends.',
        advance: 'Dernier palier. Reviens en arrière dès que la prise de gras devient visible.' },
    ],
  },
  {
    id: 'P2', name: 'Recomposition corporelle', emoji: '🔄',
    purpose: "Ce programme sert à perdre du gras et à gagner du muscle en même temps. Un léger déficit de 300 kcal, des protéines élevées et un entraînement sérieux suffisent : ton corps puise dans ses réserves de gras tout en construisant du muscle. Le poids bouge peu, ce sont le miroir et le tour de taille qui changent.",
    forWho: ["Tu débutes la musculation ou tu reprends après une pause", "Tu as un peu de gras à perdre, mais pas beaucoup", "Tu veux un seul réglage, sans changer de palier"],
    duration: '8 à 12 semaines, puis bilan', goal: 'Gras ↓ · muscle ↑',
    tagline: 'Perdre du gras ET gagner du muscle',
    desc: 'Un seul réglage : maintenance −300 kcal. Avec des protéines élevées et un entraînement sérieux, le corps puise dans le gras tout en construisant du muscle. Idéal si tu débutes ou reprends après une pause.',
    phases: [
      { label: 'Phase unique', short: '−300 kcal sur la durée : la balance bouge peu, le miroir oui', when: 'Refais ton profil toutes les 4 semaines', offset: -300,
        advice: 'Reste sur ce déficit léger sur la durée. La balance bougera peu mais le miroir et les mensurations, oui. C\'est normal et c\'est le but.',
        advance: 'Pas de palier à changer. Réévalue ton profil (poids, masse grasse) toutes les 4 semaines pour recalculer.' },
    ],
  },
  {
    id: 'P3', name: 'Créer le déficit parfait', emoji: '🎯',
    purpose: "Ce programme sert à sécher sur quelques semaines, de façon maîtrisée. Tu commences par un déficit doux, puis tu le creuses une seule fois quand la perte de poids ralentit. C'est un bon compromis entre rapidité et confort au quotidien.",
    forWho: ["Tu as un objectif proche, comme l'été ou un événement", "Tu as quelques kilos de gras à perdre", "Tu veux un cadre simple, en deux étapes"],
    duration: '4 à 8 semaines', goal: 'Sèche',
    tagline: 'Sécher de façon maîtrisée',
    desc: 'Déficit en deux paliers. On commence modéré, puis on creuse quand la perte ralentit. Bon compromis vitesse / confort pour une sèche de quelques semaines.',
    phases: [
      { label: 'Semaine initiale', short: '−300 kcal : déficit doux, énergie intacte', when: 'Le poids stagne une dizaine de jours', offset: -300,
        advice: 'Déficit doux de −300 kcal. Tu perds ~0.3 kg/semaine sans souffrir, l\'énergie reste bonne.',
        advance: 'Passe à l\'étape 1 quand ton poids stagne ~10 jours.' },
      { label: 'Étape 1', short: '−500 kcal : appuie-toi sur protéines et légumes', when: 'Dernier palier : pour aller plus loin, passe à la perte progressive', offset: -500,
        advice: 'Déficit de −500 kcal, ~0.5 kg/semaine. La faim se fait sentir : appuie-toi sur les protéines et les légumes pour le volume.',
        advance: 'C\'est le palier final de ce protocole. Si tu dois aller plus loin, bascule sur le Protocole 4.' },
    ],
  },
  {
    id: 'P4', name: 'Perte de gras progressive', emoji: '📉',
    purpose: "Ce programme sert à perdre du gras sur plusieurs mois, sans brusquer ton corps. Le déficit augmente par paliers, et seulement quand la perte ralentit : ton métabolisme ne freine pas et tu tiens dans la durée. C'est le programme conseillé pour une vraie transformation.",
    forWho: ["Tu as une quantité importante de gras à perdre", "Tu vises un changement durable, pas un effet express", "Tu es prêt à suivre le plan sur plusieurs mois"],
    duration: '3 à 6 mois', goal: 'Sèche longue',
    tagline: 'Sécher sur la durée sans choc',
    desc: 'Déficit en trois paliers. On augmente progressivement la restriction pour éviter le coup de frein métabolique et tenir sur plusieurs mois. Le protocole conseillé pour une vraie transformation.',
    phases: [
      { label: 'Semaine initiale', short: '−300 kcal : démarrage en douceur', when: 'La perte ralentit (environ 2 semaines)', offset: -300,
        advice: 'Démarrage en douceur à −300 kcal. Laisse le corps s\'habituer, garde toute ton énergie pour les séances.',
        advance: 'Passe à l\'étape 1 dès que la perte de poids ralentit (~2 semaines).' },
      { label: 'Étape 1', short: '−500 kcal : perte régulière', when: 'Le poids stagne malgré le plan', offset: -500,
        advice: 'On creuse à −500 kcal. Perte régulière d\'environ 0.5 kg/semaine. Priorise protéines + sommeil.',
        advance: 'Passe à l\'étape 2 quand le poids stagne à nouveau malgré le respect du plan.' },
      { label: 'Étape 2', short: '−700 kcal : dernière ligne droite, sur une courte période', when: 'Dernier palier : prévois ensuite une phase de maintenance', offset: -700,
        advice: 'Déficit fort de −700 kcal pour la dernière ligne droite. À tenir sur des périodes courtes. Hydratation et fibres essentielles.',
        advance: 'Palier final. Après ça, prévois une phase de maintenance avant de repartir.' },
    ],
  },
];

function getProtocol(id) {
  return PROTOCOLS.find(p => p.id === id) || PROTOCOLS[3];
}

// profile = { age, height (m), weight (kg), bodyfat (%) }
function computeBase(profile) {
  const { age, height, weight, bodyfat } = profile;
  const bmr1 = 13.707 * weight + 492.3 * height - 6.673 * age + 77.607;
  const bmr2 = 21.6 * weight * (100 - bodyfat) / 100 + 370;
  const bmr  = (bmr1 + bmr2) / 2;
  const maintenance = bmr * 1.5;
  const leanMass = weight * (100 - bodyfat) / 100;
  const protein  = (weight * 1.5 + leanMass * 2) / 2;
  const fat      = 1.2 * weight * (1 - bodyfat / 100);
  return { bmr1, bmr2, bmr, maintenance, leanMass, protein, fat };
}

// Renvoie les cibles { kcal, protein, carbs, fat } pour une phase donnée
function computeTargets(profile, protocolId, phaseIndex = 0) {
  const base = computeBase(profile);
  const protocol = getProtocol(protocolId);
  const phase = protocol.phases[Math.min(phaseIndex, protocol.phases.length - 1)];
  const kcal = base.maintenance + phase.offset;
  const protein = base.protein;
  const fat = base.fat;
  const carbs = (kcal - protein * 4 - fat * 9) / 4;
  return {
    kcal:    Math.round(kcal),
    protein: Math.round(protein),
    carbs:   Math.round(carbs),
    fat:     Math.round(fat),
  };
}

// Toutes les phases d'un protocole (pour affichage du plan complet)
function computeAllPhases(profile, protocolId) {
  const protocol = getProtocol(protocolId);
  return protocol.phases.map((ph, i) => ({
    label: ph.label,
    offset: ph.offset,
    targets: computeTargets(profile, protocolId, i),
  }));
}

// Profil persisté
const DEFAULT_PROFILE = { age: 24, height: 1.85, weight: 97, bodyfat: 20 };

function getProfile() {
  const saved = localStorage.getItem('diet_profile');
  if (saved) { try { return { ...DEFAULT_PROFILE, ...JSON.parse(saved) }; } catch {} }
  return { ...DEFAULT_PROFILE };
}
function saveProfile(p) { localStorage.setItem('diet_profile', JSON.stringify(p)); }

function getSelectedProtocol() {
  return localStorage.getItem('diet_protocol') || 'P4';
}
function saveSelectedProtocol(id) { localStorage.setItem('diet_protocol', id); }

function getSelectedPhase() {
  return parseInt(localStorage.getItem('diet_phase') || '0');
}
function saveSelectedPhase(i) { localStorage.setItem('diet_phase', String(i)); }



// ──────────────────────────────────────────────
// data/user.js
// ──────────────────────────────────────────────
// user.js — Objectifs actifs.
// Priorité : targets manuels sauvegardés > calcul auto (profil + protocole) > défaut.


const DEFAULT_TARGETS = { kcal: 2200, protein: 180, carbs: 220, fat: 65 };

function getTargets() {
  const saved = localStorage.getItem('diet_targets');
  if (saved) {
    try { return { ...DEFAULT_TARGETS, ...JSON.parse(saved) }; } catch {}
  }
  // Pas de cible manuelle → calcul auto depuis le profil + protocole
  try {
    return computeTargets(getProfile(), getSelectedProtocol(), getSelectedPhase());
  } catch {
    return { ...DEFAULT_TARGETS };
  }
}

function saveTargets(targets) {
  localStorage.setItem('diet_targets', JSON.stringify(targets));
}

function resetTargets() {
  localStorage.removeItem('diet_targets');
  return getTargets();
}

function getWeeklyKcalTarget() {
  return getTargets().kcal * 7;
}

const USER = {
  name: 'User', age: 24, height: 185, weight: 97, sex: 'male',
  goal: 'cut', activityLevel: 1.4,
  get targets() { return getTargets(); },
  intermittentFasting: true,
  fastingWindow: { start: '20:00', end: '12:00' },
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

const EMPTY_MEALS = () => ({ starter: [], lunch: [], dinner: [], sides: [], sweet: [] });

function normalizeItem(item) {
  // Ancien format : string → { id, servings:1 }
  if (typeof item === 'string') return { id: item, servings: 1 };
  const out = { id: item.id, servings: item.servings || 1 };
  if (item.overrides) out.overrides = item.overrides; // quantités d'ingrédients ajustées
  if (item.with) out.with = item.with;                // accompagnement lié au midi / au soir
  return out;
}

function normalizeEntry(entry) {
  const meals = EMPTY_MEALS();
  ['starter', 'lunch', 'dinner', 'sides', 'sweet'].forEach(slot => {
    meals[slot] = (entry.meals?.[slot] || []).map(normalizeItem);
  });
  const out = { date: entry.date, meals };
  // imprévu : plat d'origine conservé pour pouvoir annuler
  if (entry.outside && Object.keys(entry.outside).length) out.outside = entry.outside;
  return out;
}

function getLog() {
  const raw = JSON.parse(localStorage.getItem('diet_log') || '[]');
  return raw.map(normalizeEntry);
}

function saveLog(log) {
  localStorage.setItem('diet_log', JSON.stringify(log));
}

function getEntry(date) {
  const log = getLog();
  const existing = log.find(e => e.date === date);
  return existing || { date, meals: EMPTY_MEALS() };
}

function saveEntry(entry) {
  const log = getLog().filter(e => e.date !== entry.date);
  log.push(entry);
  saveLog(log);
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
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
    return dd.toISOString().slice(0, 10);
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


const PHOTOS = new Set(['C01', 'K01', 'K02', 'K03', 'K05', 'K06', 'K07', 'K08', 'K09', 'K10', 'K11', 'K12', 'S11', 'S12', 'SA11', 'W01', 'W02', 'W03', 'W04', 'W05', 'W06', 'W07', 'W08', 'W09', 'W10', 'W11', 'W12', 'W13', 'W14', 'W15', 'W16', 'W17', 'W18', 'W19', 'W20', 'W21', 'W22', 'W23', 'W24', 'W25', 'W26', 'W27', 'W28', 'W29', 'W30']);

const photoUrl = id => (PHOTOS.has(id) ? `img/dishes/${id}.webp` : null);

// Vignette : photo si disponible, sinon pastille emoji de même taille
function dishThumb(r, cls = '') {
  if (!r) return '';
  const u = photoUrl(r.id);
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
  const slots = ['starter', 'lunch', 'dinner', 'sides', 'sweet'];
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
function toast(msg) {
  document.querySelector('.toast')?.remove();
  const t = el('div', 'toast', msg);
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
  plateProteinShare: 0.9, // part des protéines portée par les assiettes (le reste : collation / whey)
  autoSides: true,        // ajouter un accompagnement à l'assiette si ça aide…
  autoSideIds: ['SA01', 'SA11'], // …mais seulement les frites (zéro effort à l'air fryer)
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
function optimizeRecipe(recipe, target, mode = 'P') {
  const qty = recipe.ingredients.map(i => i.qty);
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
  let mainStarch = recipe.ingredients.findIndex(i => !i.extra && i.key === 'riz');
  if (mainStarch < 0) {
    let bestK = 0;
    recipe.ingredients.forEach((ing, idx) => {
      if (!ing.extra && INGREDIENTS[ing.key]?.minP && ing.kcal > bestK) { bestK = ing.kcal; mainStarch = idx; }
    });
  }
  if (!isCantine(recipe)) {
    recipe.ingredients.forEach((ing, idx) => {
      const db = INGREDIENTS[ing.key];
      if (ing.extra || !db || !db.lv.includes(mode)) return; // tes ajouts gardent leur quantité
      if (mode === 'P' && db.role === 'protein' && idx !== mainProt) return;
      const countable = isCountableUnit(ing.unit);
      // minP : minimum imposé dans les plats (ex. jamais moins de 90 g de riz cru)
      const min = mode === 'P' && db.minP && idx === mainStarch ? db.minP : Math.min(db.min ?? ing.qty, ing.qty);
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
    overrides[i] = isLever ? snapQty(qty[i], isCountableUnit(ing.unit), ing.key) : ing.qty;
  });
  // macros finales (après arrondi)
  const macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  recipe.ingredients.forEach((ing, i) => MACROS.forEach(m => macros[m] += pu[i][m] * overrides[i]));
  return { overrides, macros, score: score(macros, target) };
}

// ── Répartition d'une journée ──
// Une assiette vise ~34 % des kcal du jour, mais jamais plus que ce qu'on peut raisonnablement
// manger (800 kcal, 900 si objectif > 3000). Le reste part en collation(s).
function plateTarget(T) {
  // Les plats portent l'essentiel de la journée (40 % chacun) : grosses portions de féculents,
  // donc moins de collations à côté.
  const cap = T.kcal > 3000 ? 1350 : 1250;
  const kcal = Math.max(450, Math.min(cap, T.kcal * 0.40));
  const f = kcal / T.kcal;
  return {
    kcal: Math.round(kcal),
    protein: Math.round(T.protein * Math.min(f * OPT.plateProteinShare, 0.45)),
    carbs: Math.round(T.carbs * f),
    // les à-côtés (tartines au carré frais 0 %, collations whey) sont maigres : les plats portent un peu plus de lipides
    fat: Math.round(T.fat * Math.min(f * 1.2, 0.5)),
  };
}

// Calibre une ASSIETTE : le plat seul, ou le plat + un de ses accompagnements air fryer.
// On garde l'option la plus proche de la cible ; l'accompagnement n'est ajouté que s'il aide.
// Renvoie { main: {overrides, macros}, side: {id, overrides, macros} | null, macros }
function calibratePlate(recipe, target) {
  const alone = optimizeRecipe(recipe, target, 'P');
  let best = { main: alone, side: null, macros: alone.macros, score: alone.score };
  if (!OPT.autoSides) return best;
  // jamais d'accompagnement qui répète un féculent déjà dans le plat (burger + ses frites de patate douce, etc.)
  const mainCarbs = new Set(recipe.ingredients.filter(i => ['carb', 'legume'].includes(INGREDIENTS[i.key]?.role)).map(i => i.key));
  (recipe.pairs || []).filter(sid => OPT.autoSideIds.includes(sid)).forEach(sid => {
    const side = getById(sid);
    if (!side) return;
    if (side.ingredients.some(i => mainCarbs.has(i.key))) return;
    const sm = side.macros;
    const rest = {};
    MACROS.forEach(m => rest[m] = Math.max(0, target[m] - sm[m]));
    const main = optimizeRecipe(recipe, rest, 'P');
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
//        (miel-thym, dinde), puis banane-cacahuète, amandes, fromage blanc, fruit, skyr
//   4. une 2e collation seulement si l'écart reste vraiment important Renvoie [{ slot, item }]
function fillRemainder(remaining, rotation, fillers = ['S12', 'S11', 'S09', 'S07', 'S08', 'S05', 'S16']) {
  const out = [];
  let rem = { ...remaining };
  const used = new Set();
  const plan = [
    // la 1re tartine passe en premier : elle est là tous les jours (tes compléments prioritaires)
    // (le moteur prend la tartine qui convient le mieux : dinde si la journée manque de protéines, miel sinon)
    { pool: fillers.slice(0, 2),  cap: 300, minRem: 100 },
    // collation : choisie parmi 2 options qui changent chaque jour
    { pool: rotation.slice(0, 2), cap: 650, minRem: 120 },
    // puis la 2e tartine, puis le meilleur de 2 autres compléments
    { pool: fillers.slice(0, 2),  cap: 350, minRem: 150 },
    // si la journée manque de lipides, les compléments gras (amandes, beurre de cacahuète) entrent en lice
    { pool: fillers.slice(2, 4),  cap: 300, minRem: 120, fatty: true },
    // 2e collation seulement si l'écart reste vraiment important
    { pool: rotation.slice(2, 3), cap: 500, minRem: 350 },
  ];
  for (const stepCfg of plan) {
    if (rem.kcal < stepCfg.minRem) continue;
    const share = Math.min(1, stepCfg.cap / rem.kcal);
    const tgt = {};
    MACROS.forEach(m => tgt[m] = rem[m] * share);
    let best = null;
    let pool = stepCfg.pool;
    if (stepCfg.fatty && rem.fat * 9 > rem.kcal * 0.3) pool = [...new Set([...pool, ...fillers.filter(id => ['S07', 'S09', 'S08'].includes(id))])];
    pool.filter(id => !used.has(id)).forEach(id => {
      const r = getById(id);
      if (!r) return;
      const res = optimizeRecipe(r, tgt, 'S');
      if (!best || res.score < best.res.score) best = { id, r, res };
    });
    if (!best) continue;
    used.add(best.id);
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
function pickMain(pool, chosen, { allowFish, recent = [] }) {
  // 👎 : jamais tiré, sauf s'il ne reste vraiment rien d'autre
  const liked = pool.filter(r => getRating(r.id) >= 0);
  if (liked.length >= 4) pool = liked;
  const cands = pool.filter(r => !chosen.some(c => c.id === r.id) && (allowFish || !isFreshFish(r)));
  if (!cands.length) return null;
  const weights = cands.map(r => {
    const fam = proteinFamily(r);
    let w = 1;
    if (getRating(r.id) > 0) w *= 2.2;   // 👍 : revient plus souvent
    w /= 1 + 3 * chosen.filter(c => proteinFamily(c) === fam).length;
    w /= 1 + 0.3 * chosen.filter(c => mainStarch(c) === mainStarch(r)).length;
    if (isFreshFish(r) && chosen.some(isFreshFish)) w *= 0.01;
    // recent est rangé du plus ancien au plus récent : les 4 derniers = semaine qu'on vient d'avoir
    const k = recent.indexOf(r.id);
    if (k !== -1) w *= (recent.length - k) <= 4 ? 0.03 : 0.25;
    return w;
  });
  let x = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < cands.length; i++) { x -= weights[i]; if (x <= 0) return cands[i]; }
  return cands[cands.length - 1];
}

// Répartit n repas entre des plats : un plat ne revient qu'une fois par jour,
// et le poisson frais au plus 2 fois (2 premiers jours). Renvoie null si impossible.
function allocate(n, plats, days) {
  const caps = plats.map(p => isFreshFish(p) ? Math.min(2, days) : days);
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
  return counts;
}

// Place les portions dans les créneaux d'une session (earliest-deadline-first)
function schedule(slots, plats, counts) {
  const remaining = [...counts];
  const deadline = plats.map(p => isFreshFish(p) ? 1 : 99); // poisson : jour 0-1 de la session
  const result = [];
  let prevId = null;
  slots.forEach(slot => {
    const sameDay = result.filter(r => r.slot.dayIdx === slot.dayIdx).map(r => r.plat.id);
    // ce qu'on a mangé à ce même repas la veille → on alterne midi/soir
    const yesterday = result.find(r => r.slot.dayIdx === slot.dayIdx - 1 && r.slot.meal === slot.meal)?.plat.id;
    const cands = plats.map((p, i) => i).filter(i => remaining[i] > 0 && !sameDay.includes(plats[i].id));
    const pool = cands.length ? cands : plats.map((p, i) => i).filter(i => remaining[i] > 0);
    pool.sort((a, b) =>
      (deadline[a] - deadline[b]) ||
      ((plats[a].id === yesterday) - (plats[b].id === yesterday)) ||
      (remaining[b] - remaining[a]) ||
      ((plats[a].id === prevId) - (plats[b].id === prevId)));
    const i = pool[0];
    remaining[i]--;
    prevId = plats[i].id;
    result.push({ slot, plat: plats[i] });
  });
  return result;
}

// Choisit les collations de la semaine : un mix sucré / salé, rapides, sans répétition lassante.
function pickSnacks() {
  const all = getSweets().filter(r => getRating(r.id) >= 0);
  const quick = all.filter(s => (s.prepTime + s.cookTime) <= 10);
  const sweet = shuffle(quick.filter(s => (s.tags || []).includes('sucré') || !(s.tags || []).includes('salé')));
  const salty = shuffle(quick.filter(s => (s.tags || []).includes('salé')));
  const batchy = shuffle(all.filter(s => s.batch));
  const picks = [sweet[0], salty[0], sweet[1], batchy[0]].filter(Boolean);
  return [...new Set(picks.map(p => p.id))];
}

// ── Génère la semaine ──
// opts = { cantineDays: [0..6], nextWeek, targets, proteins: [familles] }
// Budget : on vise ~60 €. Une semaine tirée au-dessus de 70 € est simplement retirée
// (on ne choisit PAS la semaine « la mieux calibrée », sinon les mêmes plats reviennent toujours).
const COST_MAX = 70;
const RECENT_KEY = 'hebe_recent_mains';
const getRecent = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; } };

function generateWeek(opts = {}) {
  const recent = getRecent(); // du plus ancien au plus récent
  // On retire au plus quelques tirages trop chers (> 70 €). Si aucun ne passe (protéines chères
  // sélectionnées), on garde le PREMIER tirage : surtout pas « le moins cher », qui ramènerait
  // toujours les mêmes plats.
  const first = generateWeekOnce({ ...opts, recent });
  let cand = first;
  for (let i = 0; i < 5 && cand.plan.cost > COST_MAX; i++) cand = generateWeekOnce({ ...opts, recent });
  if (cand.plan.cost > COST_MAX) cand = first;
  // mémoire : les 12 derniers plats servis (≈ 3 semaines)
  const ids = cand.mains.map(m => m.id);
  const next = [...recent.filter(id => !ids.includes(id)), ...ids].slice(-12);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  saveWeekPlan(cand.plan);
  return cand;
}

function generateWeekOnce({ cantineDays = [], nextWeek = true, targets, proteins = null, recent = [] } = {}) {
  targets = targets || { kcal: 2200, protein: 150, carbs: 230, fat: 70 };
  const dates = nextWeek ? getNextWeekDates() : getWeekDates();

  // Pool : plats complets, batchables, filtrés par les protéines choisies
  let pool = getMains().filter(r => r.batch);
  if (proteins && proteins.length) {
    const f = pool.filter(r => proteins.includes(proteinFamily(r)));
    if (f.length >= 4) pool = f;
  }
  const onlyFish = pool.every(isFreshFish);

  const SESSIONS = [
    { key: 'A', label: 'Dimanche', days: [0, 1, 2] },
    { key: 'B', label: 'Mercredi soir', days: [3, 4, 5, 6] },
  ];

  const pt = plateTarget(targets);
  const portionCache = {}; // id → assiette calibrée (plat + accompagnement éventuel)
  const calibrate = (r) => {
    if (!portionCache[r.id]) portionCache[r.id] = calibratePlate(r, pt);
    return portionCache[r.id];
  };

  const entries = {};
  dates.forEach(d => entries[d] = { date: d, meals: { starter: [], lunch: [], dinner: [], sides: [], sweet: [] } });

  const chosen = [];
  const sessions = [];
  SESSIONS.forEach((S, si) => {
    const slots = [];
    S.days.forEach((dayIdx, k) => {
      if (!cantineDays.includes(dayIdx)) slots.push({ dayIdx, k, meal: 'lunch' });
      slots.push({ dayIdx, k, meal: 'dinner' });
    });
    const n = slots.length;
    if (!n) return;
    const nDays = S.days.length;
    let k = Math.max(n >= 3 ? 2 : 1, Math.ceil(n / nDays));
    const plats = [];
    let counts = null;
    for (let guard = 0; guard < 6; guard++) {
      while (plats.length < k) {
        const p = pickMain(pool, [...chosen, ...plats], { allowFish: si === 0 || onlyFish, recent });
        if (!p) break;
        plats.push(p);
      }
      counts = allocate(n, plats, nDays);
      if (counts) break;
      k++;
    }
    if (!counts) return;
    chosen.push(...plats);
    const placed = schedule(slots, plats, counts);
    placed.forEach(({ slot, plat }) => {
      const date = dates[slot.dayIdx];
      const res = calibrate(plat);
      entries[date].meals[slot.meal].push({ id: plat.id, servings: 1, overrides: { ...res.main.overrides } });
      if (res.side) entries[date].meals.sides.push({ id: res.side.id, servings: 1, overrides: { ...res.side.overrides }, with: slot.meal });
    });
    sessions.push({
      key: S.key, label: S.label,
      dates: S.days.map(i => dates[i]),
      recipes: plats.map((p, i) => ({ id: p.id, portions: counts[i], side: calibrate(p).side?.id || null })).filter(x => x.portions > 0),
    });
  });

  // Totaux achetables : on ajuste les portions pour que viandes / poissons tombent sur des barquettes entières
  snapToPacks(entries, dates);

  // Midis cantine
  cantineDays.forEach(i => entries[dates[i]].meals.lunch.push({ id: 'C01', servings: 1 }));

  // Collations : recalées chaque jour sur ce qu'il manque
  const snackIds = pickSnacks();
  dates.forEach((d, dayIdx) => fillDay(entries[d], dayIdx, snackIds, targets));

  // Coût estimé de la semaine (ce qui est réellement mangé, hors cantine et placard)
  let cost = 0;
  dates.forEach(d => ['starter', 'lunch', 'dinner', 'sides', 'sweet'].forEach(s =>
    (entries[d].meals[s] || []).forEach(it => cost += itemCost(it))));

  const plan = { start: dates[0], dates, sessions, snacks: snackIds, targets, cost: Math.round(cost), generatedAt: Date.now() };
  return { dates, entries, plan, mains: chosen, cantineDays };
}

// ── Formats du commerce ──
// Pour chaque ingrédient « snap » (viandes, poissons, tofu), on additionne ce que la semaine utilise,
// on vise le multiple de barquette le plus proche, et on applique le même facteur à toutes les portions.
// Contrainte : chaque portion reste dans sa fourchette réaliste (tolérance de 10 % vers le bas uniquement).
// Les collations, ajoutées ensuite, rattrapent les calories d'écart.
function snapToPacks(entries, dates) {
  const uses = {}; // key → [{ item, idx, qty }]
  dates.forEach(d => ['lunch', 'dinner'].forEach(slot => (entries[d].meals[slot] || []).forEach(item => {
    const r = getById(item.id);
    if (!r || (r.tags || []).includes('cantine')) return;
    const qs = itemQuantities(item);
    r.ingredients.forEach((ing, idx) => {
      const db = INGREDIENTS[ing.key];
      if (db && db.snap && qs[idx] > 0) (uses[ing.key] ||= []).push({ item, idx, qty: qs[idx] });
    });
  })));
  const report = {};
  Object.entries(uses).forEach(([key, list]) => {
    const db = INGREDIENTS[key];
    const total = list.reduce((a, u) => a + u.qty, 0);
    const lo = (db.min || 0) * 0.9, hi = db.max || Infinity; // jamais au-dessus du max autorisé
    let best = null;
    const kMax = Math.ceil(total / db.pack) + 2;
    for (let k = 1; k <= kMax; k++) {
      const target = k * db.pack;
      const f = target / total;
      const ok = list.every(u => u.qty * f >= lo && u.qty * f <= hi);
      if (!ok) continue;
      // on préfère arrondir vers le haut : réduire la viande coûte plus cher en protéines qu'en ajouter
      const dist = target >= total ? target - total : (total - target) * 1.6;
      if (!best || dist < best.dist) best = { target, f, dist };
    }
    if (!best) { report[key] = { total, target: null }; return; }
    list.forEach(u => {
      if (!u.item.overrides) u.item.overrides = {};
      // quantité exacte (non arrondie) : le total de la semaine tombe pile sur les barquettes
      u.item.overrides[u.idx] = Math.round(u.qty * best.f * 10) / 10;
    });
    report[key] = { total, target: best.target };
  });
  return report;
}

// Collations et compléments d'une journée, recalés sur ce qu'il manque après les plats
function fillDay(e, dayIdx, snackIds, targets) {
  // ignore les recettes supprimées depuis la génération du plan (ex. onigiri)
  snackIds = snackIds.filter(id => getById(id) && getRating(id) >= 0);
  if (!snackIds.length) snackIds = pickSnacks();
  const used = computeDayTotals(e);
  const rem = subtractMacros(targets, used);
  // rotation : on commence par une collation différente chaque jour
  let rot = snackIds.map((_, i) => snackIds[(i + dayIdx) % snackIds.length]);
  // pas de thon / d'œufs en collation si le plat du jour en contient déjà
  const dayKeys = new Set(['lunch', 'dinner'].flatMap(s => e.meals[s] || []).flatMap(it => getById(it.id)?.ingredients.map(i => i.key) || []));
  const clash = id => (getById(id)?.ingredients || []).some(i => ['thon', 'oeuf'].includes(i.key) && dayKeys.has(i.key));
  rot = [...rot.filter(id => !clash(id)), ...rot.filter(clash)];
  // compléments sans préparation : les 2 tartines carré frais d'abord (elles alternent), puis les autres
  const TARTINES = dayIdx % 2 ? ['S11', 'S12'] : ['S12', 'S11'];
  const OTHERS = ['S09', 'S07', 'S08', 'S05', 'S16'].filter(id => getRating(id) >= 0);
  const off = Math.floor(Math.random() * Math.max(OTHERS.length, 1));
  const fillers = [...TARTINES.filter(id => getRating(id) >= 0), ...OTHERS.map((_, i) => OTHERS[(i + off + dayIdx) % OTHERS.length])];
  fillRemainder(rem, rot, fillers).forEach(f => e.meals[f.slot].push(f.item));
}

// ── Remplacer un plat de la semaine ──
// Tire un autre plat (même protéine si possible), recalcule ses portions, l'applique à toutes
// ses portions de la session, puis recale barquettes et collations. Renvoie le nouveau plat ou null.
function replaceDish(oldId) {
  const plan = getActivePlan();
  if (!plan) return null;
  const old = getById(oldId);
  const sess = plan.sessions.find(s => s.recipes.some(r => r.id === oldId));
  if (!old || !sess) return null;
  const inPlan = new Set(plan.sessions.flatMap(s => s.recipes.map(r => r.id)));
  const sessIdx = plan.sessions.indexOf(sess);
  const fishOk = sessIdx === 0 && !plan.sessions.some(s => s.recipes.some(r => r.id !== oldId && isFreshFish(getById(r.id))));
  let pool = getMains().filter(r => r.batch && !inPlan.has(r.id) && getRating(r.id) >= 0 && (fishOk || !isFreshFish(r)));
  const same = pool.filter(r => proteinFamily(r) === proteinFamily(old));
  if (same.length) pool = same;
  if (!pool.length) return null;
  const weights = pool.map(r => getRating(r.id) > 0 ? 2.2 : 1);
  let x = Math.random() * weights.reduce((a, b) => a + b, 0), next = pool[pool.length - 1];
  for (let k = 0; k < pool.length; k++) { x -= weights[k]; if (x <= 0) { next = pool[k]; break; } }

  const targets = plan.targets || USER.targets;
  const cal = calibratePlate(next, plateTarget(targets));
  const entries = {};
  plan.dates.forEach(d => {
    const e = getEntry(d);
    ['lunch', 'dinner'].forEach(meal => {
      const list = e.meals[meal] || [];
      if (!list.some(it => it.id === oldId)) return;
      e.meals[meal] = list.map(it => it.id === oldId ? { id: next.id, servings: 1, overrides: { ...cal.main.overrides } } : it);
      e.meals.sides = (e.meals.sides || []).filter(sd => sd.with !== meal);
      if (cal.side) e.meals.sides.push({ id: cal.side.id, servings: 1, overrides: { ...cal.side.overrides }, with: meal });
    });
    entries[d] = e;
  });
  // barquettes entières, puis collations recalées jour par jour
  snapToPacks(entries, plan.dates);
  plan.dates.forEach((d, dayIdx) => {
    const e = entries[d];
    e.meals.sweet = [];
    e.meals.sides = (e.meals.sides || []).filter(sd => sd.with);
    fillDay(e, dayIdx, plan.snacks || pickSnacks(), targets);
    saveEntry(e);
  });
  sess.recipes = sess.recipes.map(r => r.id === oldId ? { id: next.id, portions: r.portions, side: cal.side?.id || null } : r);
  plan.generatedAt = Date.now(); // nouvelle liste de courses et nouvelle session à cocher
  saveWeekPlan(plan);
  return next;
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
  rebalanceFrom(plan, dayIdx);
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
  rebalanceFrom(plan, dayIdx);
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
  rebalanceFrom(plan, from);
  return touched;
}

// Recalcule collations et compléments à partir d'un jour, en reportant les dépassements
function rebalanceFrom(plan, fromIdx) {
  const T = plan.targets || USER.targets; // objectifs de la semaine générée
  const snacks = plan.snacks || pickSnacks();
  const debt = plan.dates.map(() => 0);
  const spill = (i, over) => {
    if (over <= 80) return;
    const next = [i + 1, i + 2].filter(k => k < plan.dates.length);
    next.forEach(k => { debt[k] += over / next.length; });
  };
  // dépassements des 2 jours précédents, déjà figés
  for (let i = Math.max(0, fromIdx - 2); i < fromIdx; i++) {
    spill(i, computeDayTotals(getEntry(plan.dates[i])).kcal - T.kcal);
  }
  for (let i = fromIdx; i < plan.dates.length; i++) {
    const e = getEntry(plan.dates[i]);
    e.meals.sweet = [];
    e.meals.sides = (e.meals.sides || []).filter(sd => sd.with);
    const cut = Math.min(debt[i], 700); // on n'allège jamais plus que les collations
    const target = {
      kcal: T.kcal - cut,
      protein: T.protein,
      carbs: Math.max(0, T.carbs - cut * 0.6 / 4),
      fat: Math.max(0, T.fat - cut * 0.4 / 9),
    };
    fillDay(e, i, snacks, target);
    saveEntry(e);
    spill(i, computeDayTotals(e).kcal - T.kcal);
  }
}

function computeDayTotals(e) {
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  ['starter', 'lunch', 'dinner', 'sides', 'sweet'].forEach(s => (e.meals[s] || []).forEach(it => {
    const m = computeMealMacros(it);
    Object.keys(t).forEach(k => t[k] += m[k]);
  }));
  return t;
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
];

const SVGS = {
  week:     '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  cook:     '<path d="M4 11h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/><line x1="2" y1="11" x2="22" y2="11"/><path d="M9 7c0-1 1-1.5 1-2.5M14 7c0-1 1-1.5 1-2.5"/>',
  planner:  '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>',
  macros:   '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  recipes:  '<path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>',
  shopping: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 001.93-1.46l1.38-5.54H6"/>',
};

function renderNav() {
  const nav = document.createElement('nav');
  nav.id = 'nav';
  nav.innerHTML = ITEMS.map(it => `
    <button class="nav-btn ${(state.currentView === it.id || (it.id === 'week' && ['recipes','settings'].includes(state.currentView))) ? 'active' : ''}" data-view="${it.id}">
      <svg viewBox="0 0 24 24">${SVGS[it.id]}</svg>
      <span>${it.label}</span>
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
};
const ICON_BACK = '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>';
const ICON_CLOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>';

function renderRecipeDetail(recipe, fromView = 'recipes') {
  const app = document.getElementById('app');
  app.querySelector('.view')?.remove();

    const fam = proteinFamily(recipe);
  const cuisine = (recipe.tags || []).map(t => CUISINES[t]).find(Boolean);
  const view = el('div', `view detail-view rd fam-${fam} cat-${recipe.category}`);
  app.insertBefore(view, app.querySelector('#nav'));
  window.scrollTo(0, 0);

  function render() {
    const m = scaledMacros(recipe, 1);
    const kcalM = m.protein * 4 + m.carbs * 4 + m.fat * 9 || 1;
    const bar = v => Math.round(v / kcalM * 100);
    const photo = photoUrl(recipe.id);

    view.innerHTML = `
      <div class="rd-hero ${photo ? '' : 'no-photo'} ${rateClass(recipe.id)}">
        ${photo ? `<img class="rd-photo" src="${photo}" alt="">` : `<div class="rd-emoji">${recipe.emoji}</div>`}
        <button class="rd-round rd-back" aria-label="Retour">${ICON_BACK}</button>
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

        <section class="rd-sec">
          <div class="rd-sec-hd"><h2>Ingrédients</h2><span class="rd-raw">poids crus · 1 portion</span></div>
          <div class="rd-ings">
            ${recipe.ingredients.map((ing, k) => `
              <div class="rd-ing ${ing.extra ? 'extra' : ''}">
                <span class="rd-ing-name">${ing.name}${ing.extra ? '<em>ajouté</em>' : ''}</span>
                <span class="rd-ing-qty">${humanQty(ing.key, ing.qty, ing.unit, { cooked: true })}</span>
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
const QUICK = ['oeuf', 'emmental', 'feta', 'parmesan', 'avocat', 'carre_frais', 'yaourt_grec', 'jambon_dinde',
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


const DAY_LONG = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const DAY_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const PROTEINS = [
  { id: 'poulet',    label: 'Poulet',    emoji: '🍗' },
  { id: 'boeuf',     label: 'Bœuf',      emoji: '🥩' },
  { id: 'dinde',     label: 'Dinde',     emoji: '🦃' },
  { id: 'crevettes', label: 'Crevettes', emoji: '🦐' },
  { id: 'saumon',    label: 'Poisson',   emoji: '🐟' },
  { id: 'tofu',      label: 'Végé',      emoji: '🌱' },
];
let cantineDays = JSON.parse(localStorage.getItem('hebe_cantine_days') || '[]');
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
        <button class="hb-icon" data-go="recipes" aria-label="Toutes les recettes">${ICON_BOOK}</button>
        <button class="hb-icon" data-go="settings" aria-label="Mon programme">${ICON_SET}</button>
      </div>
    </div>`;

  if (!plan) {
    view.innerHTML = `${top}
      <div class="hb-card hb-empty">
        <div class="hb-h2">Prépare ta semaine</div>
        <p class="hb-p">Choisis tes protéines et tes midis à la cantine. Hébé choisit 4 plats à cuisiner en 2 sessions et fait ta liste de courses.</p>
        ${generatorHTML(null)}
      </div>`;
    app.insertBefore(view, app.querySelector('#nav'));
    bindTop(view);
    bindGenerator(view, () => renderWeek());
    return;
  }

  const today = getTodayDate();
  const isRunning = plan.dates.includes(today);
  const focus = isRunning ? today : plan.dates[0];
  // Une grande carte par jour, à partir d'aujourd'hui ; les jours passés sont repliés en bas
  const upcoming = plan.dates.filter(d => d >= focus), past = plan.dates.filter(d => d < focus);
  const tomorrow = new Date(new Date(today + 'T12:00:00').getTime() + 864e5).toISOString().slice(0, 10);
  const dayCard = d => {
    const e = getEntry(d), m = computeDayMacros(e);
    const ex = names(extraItems(e));
    const exLine = ex.length <= 2 ? ex.join(' et ') : `${ex[0]} et ${ex.length - 1} compléments`;
    const eyebrow = d === today ? "Aujourd'hui" : d === tomorrow ? 'Demain' : '';
    return `<section class="today day-card ${d === today ? 'is-today' : ''}">
      <div class="today-head">
        <div>
          ${eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : ''}
          <div class="today-date">${DAY_LONG[dayIdx(d)]} ${new Date(d + 'T12:00:00').getDate()}</div>
        </div>
        <button class="link-btn" data-date="${d}">Détail</button>
      </div>
      <div class="dv-meals">${bigTile('Midi', mealItems(e, 'lunch'))}${bigTile('Soir', mealItems(e, 'dinner'))}</div>
      ${ex.length ? `<div class="today-extra">En plus : ${exLine}</div>` : ''}
      <div class="today-macros">
        <div class="tm"><div class="tm-top"><span>Calories</span><span><b>${Math.round(m.kcal)}</b> / ${T.kcal}</span></div><div class="tm-bar"><i style="width:${Math.min(100, m.kcal / T.kcal * 100)}%"></i></div></div>
        <div class="tm"><div class="tm-top"><span>Protéines</span><span><b>${Math.round(m.protein)}</b> / ${T.protein} g</span></div><div class="tm-bar"><i style="width:${Math.min(100, m.protein / T.protein * 100)}%"></i></div></div>
      </div>
    </section>`;
  };

  view.innerHTML = `${top}
    ${upcoming.map(d => dayCard(d)).join('')}
    ${past.length ? `<details class="past-days">
      <summary>Jours passés <span>${past.length}</span></summary>
      ${past.map(d => dayCard(d)).join('')}
    </details>` : ''}

    <button class="hb-card hb-batch-link" data-go="cook">
      <div>
        <div class="hb-h3">Sessions de batch cooking</div>
        <div class="hb-batch-thumbs">${plan.sessions.flatMap(s => s.recipes).map(r => dishThumb(getById(r.id), 'batch')).join('')}</div>
        ${plan.sessions.map(s => `<div class="hb-batch-line"><b>${s.label} :</b> ${s.recipes.map(r => shortName(r.id)).join(', ')}</div>`).join('')}
      </div>
      <span class="hb-chev">›</span>
    </button>

    <button class="hb-btn hb-regen">Nouvelle semaine</button>
  `;
  app.insertBefore(view, app.querySelector('#nav'));
  bindTop(view);
  view.querySelectorAll('[data-date]').forEach(b => b.addEventListener('click', () => openDaySheet(b.dataset.date)));
  bindHearts(view);
  view.querySelectorAll('.today [data-rid]').forEach(b => b.addEventListener('click', () => renderRecipeDetail(getById(b.dataset.rid), 'week')));
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

function bigTile(label, items) {
  const main = items[0] && getById(items[0].id);
  if (!main) return '';
  const side = items.slice(1).map(it => getById(it.id)).filter(Boolean);
  const kcal = items.reduce((a, it) => a + itemMacros(it).kcal, 0);
  const isOut = (main.tags || []).includes('imprevu');
  const fam = (main.tags || []).includes('cantine') ? 'cantine' : isOut ? 'outside' : proteinFamily(main);
  return `<button class="dv-meal fam-${fam}" data-rid="${main.id}">
    <div class="dv-photo ${rateClass(main.id)}" data-photo="${main.id}">${dishThumb(main, 'dv-img')}<span class="hb-tile-lbl">${label}</span>${(main.tags || []).includes('cantine') || isOut ? '' : `<span class="tile-heart ${getRating(main.id) > 0 ? 'on' : ''}" data-like="${main.id}" role="button" tabindex="0" aria-label="J'aime ce plat">${ICON_HEART}</span>`}</div>
    <div class="dv-name">${main.name}</div>
    ${side.length ? `<div class="dv-side">+ ${side.map(r => /frites/i.test(r.name) ? (/patate/i.test(r.name) ? 'frites de patate douce' : 'frites') : r.name.toLowerCase()).join(', ')}</div>` : ''}
    <div class="dv-k">${Math.round(kcal)} kcal</div>
  </button>`;
}

// ── Générateur (carte vide ou feuille « Nouvelle semaine ») ──
function defaultNextWeek(plan) {
  if (plan) return plan.dates[0] === getNextWeekDates()[0];
  return ((new Date().getDay() + 6) % 7) >= 3; // à partir de jeudi : semaine prochaine
}
function generatorHTML(plan) {
  const next = defaultNextWeek(plan);
  return `
    <div class="hb-field">
      <div class="hb-label">Pour quelle semaine ?</div>
      <div class="hb-seg">
        <button class="hb-seg-btn ${!next ? 'on' : ''}" data-week="0">Cette semaine</button>
        <button class="hb-seg-btn ${next ? 'on' : ''}" data-week="1">Prochaine</button>
      </div>
    </div>
    <div class="hb-field">
      <div class="hb-label">Midis à la cantine</div>
      <div class="cantine-days">
        ${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => `<button class="cant-day ${cantineDays.includes(i) ? 'on' : ''}" data-i="${i}" aria-label="${DAY_LONG[i]}">${d}</button>`).join('')}
      </div>
    </div>
    <div class="hb-field">
      <div class="hb-label">Protéines</div>
      <div class="protein-chips">
        ${PROTEINS.map(p => `<button class="prot-chip ${selProteins.includes(p.id) ? 'on' : ''}" data-p="${p.id}"><span class="prot-emoji">${p.emoji}</span>${p.label}</button>`).join('')}
      </div>
    </div>
    <button class="hb-btn hb-btn-primary hb-generate">Générer ma semaine</button>`;
}
function bindGenerator(root, onDone) {
  let next = !!root.querySelector('.hb-seg-btn[data-week="1"].on');
  root.querySelectorAll('.hb-seg-btn').forEach(b => b.addEventListener('click', () => {
    next = b.dataset.week === '1';
    root.querySelectorAll('.hb-seg-btn').forEach(x => x.classList.toggle('on', x === b));
  }));
  root.querySelectorAll('.cant-day').forEach(b => b.addEventListener('click', () => {
    const i = +b.dataset.i;
    cantineDays = cantineDays.includes(i) ? cantineDays.filter(x => x !== i) : [...cantineDays, i];
    localStorage.setItem('hebe_cantine_days', JSON.stringify(cantineDays));
    b.classList.toggle('on');
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
      const { entries } = generateWeek({ cantineDays, nextWeek: next, targets: USER.targets, proteins: selProteins });
      Object.values(entries).forEach(en => saveEntry(en));
      onDone();
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
      <div class="dv-meals">${bigTile('Midi', lunch)}${bigTile('Soir', dinner)}</div>
      <div class="dv-swaps">${[['lunch', lunch], ['dinner', dinner]].map(([meal, items]) => {
        const r = items[0] && getById(items[0].id);
        if (!r) return '<span></span>';
        if ((r.tags || []).includes('imprevu')) {
          const lvl = OUTSIDE_LEVELS[e.outside?.[meal]?.level];
          return `<div class="dv-acts"><span class="out-tag">🍽️ ${lvl ? lvl.label : ''} · ~${lvl ? lvl.kcal : ''} kcal</span><button class="swap-btn" data-undo="${meal}">↩ Annuler l'imprévu</button></div>`;
        }
        if ((r.tags || []).includes('cantine')) return '<span></span>';
        return `<div class="dv-acts" data-acts="${meal}">
          <button class="swap-btn" data-swap="${r.id}">↻ Changer</button>
          <button class="swap-btn out" data-out="${meal}">🍽️ Imprévu</button>
        </div>`;
      }).join('')}</div>
      ${extras.length ? `<div class="hb-label dv-extras-lbl">En plus</div><div class="dv-extras">${extras.map(smallTile).join('')}</div>` : ''}
      <div class="ds-grid">
        ${cell('Calories', m.kcal, T.kcal, '', 'k')}
        ${cell('Protéines', m.protein, T.protein, ' g', 'p')}
        ${cell('Glucides', m.carbs, T.carbs, ' g', 'c')}
        ${cell('Lipides', m.fat, T.fat, ' g', 'f')}
      </div>
      <details class="dv-qty">
        <summary>Quantités du jour <span>poids crus, 1 portion</span></summary>
        ${qtyBlock('Midi', lunch)}${qtyBlock('Soir', dinner)}${qtyBlock('En plus', extras)}
      </details>
      <button class="hb-btn ds-close">Fermer</button>
    </div>`);
  const sheet = document.getElementById('sheet');
  sheet.querySelector('.ds-close')?.addEventListener('click', closeSheet);
  bindHearts(sheet);
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
  sheet.querySelectorAll('[data-swap]').forEach(b => b.addEventListener('click', () => {
    const old = getById(b.dataset.swap);
    const next = replaceDish(b.dataset.swap);
    if (!next) { toast('Aucun autre plat disponible pour le moment'); return; }
    closeSheet(); renderWeek(); openDaySheet(date);
    toast(`${shortName(old.id)} remplacé par ${shortName(next.id)} pour toute la session`);
  }));
  sheet.querySelectorAll('[data-rid]').forEach(b => b.addEventListener('click', () => {
    closeSheet();
    renderRecipeDetail(getById(b.dataset.rid), 'week');
  }));
}


// ──────────────────────────────────────────────
// js/cook.js
// ──────────────────────────────────────────────
// cook.js — Onglet « Cuisiner » : je fais quoi pendant ma session ?
// Une checklist unique par session : le plat le plus long (autocuiseur) est lancé d'abord,
// l'autre se prépare pendant la cuisson. Puis les quantités totales et la répartition en boîtes.


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
  if (/poulet|boeuf|dinde|steak|porc|gratin|boulettes|bowl/.test(n)) return { fridge: '3 jours', freezer: '1-2 mois' };
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

// Quantités totales d'une recette sur les jours d'une session
function totals(recipeId, dates) {
  const r = getById(recipeId);
  const tot = r.ingredients.map(() => 0);
  let portions = 0;
  dates.forEach(d => {
    const e = getEntry(d);
    Object.values(e.meals).flat().forEach(it => {
      if (it.id !== recipeId) return;
      itemQuantities(it).forEach((q, i) => tot[i] += q);
      portions++;
    });
  });
  return { r, tot, portions };
}

// Phases de la session, dans l'ordre réel :
// le plat 100 % autocuiseur est lancé d'abord, l'autre se prépare pendant la cuisson, puis on termine.
function buildPhases(recipes) {
  const rank = r => {
    const t = r.tags || [];
    if (t.includes('autocuiseur') && !t.includes('air fryer') && !t.includes('poêle')) return 0;
    if (t.includes('autocuiseur')) return 1;
    return 2;
  };
  const sorted = [...recipes].sort((a, b) => (rank(a) - rank(b)) || (b.cookTime - a.cookTime));
  const P = (title, hint, r, steps) => ({ title, hint, r, idx: recipes.indexOf(r), steps });
  if (sorted.length < 2) return sorted.map(r => P(`Cuisiner : ${dishShort(r)}`, '', r, r.steps));
  const [first, ...others] = sorted;
  const cut = first.steps.findIndex(st => /pression|mijoter|AF \d|air fryer|four/i.test(st));
  if (cut === -1) return sorted.map(r => P(`Préparer : ${dishShort(r)}`, '', r, r.steps));
  const out = [P(`Lancer : ${dishShort(first)}`, 'Il cuit tout seul pendant la suite', first, first.steps.slice(0, cut + 1))];
  others.forEach(r => out.push(P(`Pendant la cuisson : ${dishShort(r)}`, '', r, r.steps)));
  if (cut + 1 < first.steps.length) out.push(P(`Terminer : ${dishShort(first)}`, '', first, first.steps.slice(cut + 1)));
  return out;
}

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
        <p class="hb-p">Génère ta semaine : les étapes de tes sessions de batch apparaîtront ici.</p>
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
  const list = S.recipes.map(x => totals(x.id, S.dates)).filter(x => x.portions);
  const recipes = list.map(x => x.r);
  const phases = recipes.length ? buildPhases(recipes) : [];
  const fries = [...new Set(S.recipes.map(x => x.side).filter(Boolean))].map(getById).filter(Boolean);
  const minutes = Math.round((recipes.reduce((a, r) => a + r.prepTime, 0) + Math.max(0, ...recipes.map(r => r.cookTime)) + 10) / 5) * 5;
  const boxes = list.reduce((a, x) => a + x.portions, 0);

  // collations à préparer à l'avance (cookies, overnight oats…) : rattachées à la 1re session
  const prepSnacks = sessionIdx === 0 ? [...new Set(plan.dates.flatMap(d => (getEntry(d).meals.sweet || []).map(it => it.id)))]
    .map(getById).filter(r => r && r.batch) : [];

  const doneKey = `hebe_cook_${plan.generatedAt}_${S.key}`;
  let done = JSON.parse(localStorage.getItem(doneKey) || '[]');

  // numérotation continue des étapes cochables
  let n = 0;
  const phaseSteps = phases.map(ph => ph.steps.map(text => ({ text, i: n++ })));
  const boxIdx = n++;
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

  view.innerHTML = `
    <div class="hb-page-title">Cuisiner</div>
    ${plan.sessions.length > 1 ? `<div class="hb-seg">${plan.sessions.map((s, i) =>
      `<button class="hb-seg-btn ${i === sessionIdx ? 'on' : ''}" data-s="${i}">${s.label}</button>`).join('')}</div>` : ''}

    <div class="ck-summary">
      <div class="ck-sum-main">${recipes.map(dishShort).join(' + ')}</div>
      <div class="ck-sum-sub">≈ ${minutes} min · ${boxes} boîtes · pour ${S.dates.map(d => ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'][(new Date(d + 'T12:00:00').getDay() + 6) % 7]).join(', ')}</div>
      <div class="ck-progress"><div class="tm-bar"><i style="width:${total ? doneCount / total * 100 : 0}%"></i></div><span>${doneCount}/${total} étapes</span></div>
    </div>

    <div class="ck-menu">
      ${list.map((x, k) => `<button class="ck-menu-item dish-${k}" data-rid="${x.r.id}">
        ${dishThumbRated(x.r, 'menu')}
        <span class="ck-menu-txt"><span class="ck-menu-name">${dishShort(x.r)}</span><span class="ck-menu-link">Voir la recette ›</span></span>
      </button>`).join('')}

    </div>

    <div class="ck-phase">
      <div class="ck-phase-hd"><span class="ck-phase-num">1</span><div><div class="ck-phase-title">Sortir les ingrédients</div><div class="ck-phase-hint">Quantités totales pour toute la session</div></div></div>
      ${list.map((x, k) => {
        const c = conservation(x.r);
        return `<details class="ck-ings dish-${k}">
          <summary><span class="ck-sum-name">${dishThumb(x.r, 'mini')}${x.r.name}</span><span class="ck-ings-n">${x.portions} portions</span></summary>
          ${x.r.ingredients.map((g, i) => `<div class="ck-ing"><span>${g.name}</span><span>${humanQty(g.key, x.tot[i], g.unit)}</span></div>`).join('')}
          <button class="ck-recipe" data-rid="${x.r.id}">Voir la fiche complète</button>
        </details>`;
      }).join('')}
    </div>

    ${phases.map((ph, k) => `
      <div class="ck-phase dish-${ph.idx}">
        <div class="ck-phase-hd">
          <span class="ck-phase-num">${k + 2}</span>
          ${dishThumb(ph.r, 'phase')}
          <div class="ck-phase-txt"><div class="ck-phase-title">${ph.title}</div>${ph.hint ? `<div class="ck-phase-hint">${ph.hint}</div>` : ''}</div>
        </div>
        <div class="ck-phase-steps">${phaseSteps[k].map(st => stepBtn(st.text, st.i, dishShort(ph.r))).join('')}</div>
      </div>`).join('')}

    <div class="ck-phase ck-phase-end">
      <div class="ck-phase-hd"><span class="ck-phase-num">${phases.length + 2}</span><div><div class="ck-phase-title">Mettre en boîtes</div><div class="ck-phase-hint">Laisser tiédir, fermer, mettre au frigo</div></div></div>
      <div class="ck-phase-steps">${stepBtn(list.map(x => `${x.portions} boîtes de ${dishShort(x.r)}`).join(' · '), boxIdx)}</div>
      <div class="ck-cons-list">${list.map(x => { const c = conservation(x.r); return `<div class="ck-cons-row"><span>${dishShort(x.r)}</span><span>frigo ${c.fridge}${c.freezer ? ` · congélo ${c.freezer}` : ''}</span></div>`; }).join('')}</div>
      ${fries.length ? `<div class="ck-note">🍟 ${fries.map(f => f.name).join(' / ')} : à faire au moment du repas, elles ne se gardent pas.</div>` : ''}
    </div>

    ${prepSnacks.length ? `
      <div class="hb-section-title">À préparer aussi</div>
      ${prepSnacks.map(r => `<button class="hb-card ck-snack" data-rid="${r.id}"><span>${r.emoji} ${r.name}</span><span class="hb-chev">›</span></button>`).join('')}` : ''}
  `;
  app.insertBefore(view, app.querySelector('#nav'));

  view.querySelectorAll('.hb-seg-btn').forEach(b => b.addEventListener('click', () => { sessionIdx = +b.dataset.s; renderCook(); }));
  view.querySelectorAll('.ck-step').forEach(b => b.addEventListener('click', () => {
    const i = +b.dataset.i;
    done = done.includes(i) ? done.filter(x => x !== i) : [...done, i];
    localStorage.setItem(doneKey, JSON.stringify(done));
    const y = window.scrollY;
    renderCook();
    window.scrollTo(0, y);
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
  { key: 'sweet',  label: 'Collations'  },
  { key: 'side',   label: 'Compléments' },
  { key: 'starter',label: 'Entrées'     },
];

const PROT_FILTERS = [
  { key: 'all',        label: 'Toutes', emoji: '' },
  { key: 'poulet',     label: 'Poulet', emoji: '🍗' },
  { key: 'boeuf',      label: 'Bœuf', emoji: '🥩' },
  { key: 'dinde',      label: 'Dinde', emoji: '🦃' },
  { key: 'saumon',     label: 'Poisson', emoji: '🐟' },
  { key: 'crevettes',  label: 'Crevettes', emoji: '🦐' },
  { key: 'tofu',       label: 'Végé', emoji: '🌱' },
];

const recipeProtein = proteinFamily;

function renderRecipes() {
  const app = document.getElementById('app');
  app.querySelector('.view')?.remove();

  const view = el('div', 'view recipes-view');

  const head = el('div', 'hb-subhead', `<button class="hb-back">‹ Semaine</button><div class="hb-page-title">Recettes</div>`);
  head.querySelector('.hb-back').addEventListener('click', () => window._nav?.('week'));
  view.appendChild(head);
  const top = el('div', 'recipes-top');
  const search = el('input', 'search-bar');
  search.placeholder = 'Rechercher une recette…';
  search.value = state.searchQuery || '';

  const tabs = el('div', 'filter-tabs');
  FILTERS.forEach(f => {
    const btn = el('button', `tab-btn ${state.filterCategory === f.key ? 'active' : ''}`, f.label);
    btn.addEventListener('click', () => { setState({ filterCategory: f.key }); renderRecipes(); });
    tabs.appendChild(btn);
  });

  // Filtre par protéine
  const protTabs = el('div', 'prot-filter-tabs');
  const activeProt = state.filterProtein || 'all';
  PROT_FILTERS.forEach(f => {
    const btn = el('button', `prot-filter-btn ${activeProt === f.key ? 'active' : ''}`);
    btn.innerHTML = `${f.emoji ? `<span class="pf-emoji">${f.emoji}</span>` : ''}${f.label}`;
    btn.addEventListener('click', () => { setState({ filterProtein: f.key }); renderRecipes(); });
    protTabs.appendChild(btn);
  });

  top.appendChild(search);
  top.appendChild(tabs);
  top.appendChild(protTabs);
  view.appendChild(top);

  const list = el('div', 'recipe-list');
  view.appendChild(list);

  function renderList(query) {
    const cat = state.filterCategory;
    const prot = state.filterProtein || 'all';
    const filtered = RECIPES.filter(r => {
      const matchCat = !(r.tags || []).includes('imprevu') && (cat === 'all' || r.category === cat || (cat === 'main' && (r.category === 'dinner' || r.category === 'lunch') && !(r.tags || []).includes('cantine')));
      const matchProt = prot === 'all' || recipeProtein(r) === prot;
      const matchQ   = r.name.toLowerCase().includes(query.toLowerCase()) ||
                       r.tags?.some(t => t.includes(query.toLowerCase()));
      return matchCat && matchProt && matchQ;
    });

    list.innerHTML = filtered.length ? filtered.map(r => `
      <div class="recipe-card fam-${recipeProtein(r)} cat-${r.category}" data-id="${r.id}">
        ${dishThumbRated(r, 'rc')}
        <div class="rc-info">
          <div class="rc-name">${r.name}</div>
          <div class="rc-meta">${r.macros.kcal} kcal · ${r.macros.protein} g prot. · ${r.prepTime + r.cookTime} min</div>
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
  { rx: /\bdinde\b/i,                       name: 'Blanc de dinde' },
  { rx: /steak hach|boeuf|b\u0153uf/i,        name: 'Steak haché 5%' },
  { rx: /poulet hach/i,                     name: 'Poulet haché' },
  { rx: /merguez/i,                         name: 'Merguez de volaille' },
  { rx: /thon/i,                            name: 'Thon au naturel' },
  { rx: /saumon/i,                          name: 'Saumon' },
  { rx: /colin|merlu|poisson blanc/i,       name: 'Poisson blanc (colin/merlu)' },
  { rx: /crevette/i,                        name: 'Crevettes décortiquées' },
  { rx: /anchois/i,                         name: 'Anchois' },
  { rx: /^bacon/i,                          name: 'Bacon de dinde' },
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
  { name: 'Viandes & poisson',        rx: /poulet|dinde|boeuf|steak|merguez|thon|saumon|poisson|crevette|anchois|bacon/i },
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
  dates.forEach(date => {
    const entry = getEntry(date);
    ['starter','lunch','dinner','sides','sweet'].forEach(slot => {
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
        });
      });
    });
  });
  return Object.values(map);
}

// Quantité à acheter, arrondie au format du commerce.
function toPurchase(item) {
  const db = item.dbKey ? INGREDIENTS[item.dbKey] : null;
  const q = item.qty;
  // en tranches / à la pièce (pain, blanc de dinde, cheddar, pains burger)
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
    // viandes / poissons : le total tombe pile sur des barquettes (voir weekgen.snapToPacks)
    const n = Math.max(1, Math.round(q / db.pack));
    const word = ['saumon'].includes(db.key) ? 'paquet' : ['poisson_blanc', 'crevettes'].includes(db.key) ? 'sachet' : db.key === 'tofu' ? 'bloc' : 'barquette';
    const total = n * db.pack >= 1000 ? `${String(n * db.pack / 1000).replace('.', ',')} kg` : `${n * db.pack} g`;
    return { qty: total, unit: `· ${n} ${word}${n > 1 ? 's' : ''} de ${db.pack} g` };
  }
  if (db && db.pack) {
    const n = Math.max(1, Math.ceil(q / db.pack - 0.05));
    const fmt = db.pack >= 1000 ? `${db.pack / 1000} ${db.unit === 'ml' ? 'L' : 'kg'}` : `${db.pack} ${db.unit}`;
    return { qty: Math.round(q), unit: `${db.unit} · ${n} × ${fmt}` };
  }
  if (q >= 1000) return { qty: (Math.ceil(q / 100) / 10).toString().replace('.', ','), unit: db && db.unit === 'ml' ? 'L' : 'kg' };
  return { qty: Math.ceil(q / 50) * 50, unit: item.unit };
}

function listCost(items) {
  return items.reduce((a, it) => a + (it.dbKey && !INGREDIENTS[it.dbKey].pantry ? ingCost(it.dbKey, it.qty) : 0), 0);
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
        <div class="shop-meta">Semaine du ${start}</div>
        <div class="shop-progress">
          <div class="tm-bar"><i style="width:${items.length ? done / items.length * 100 : 0}%"></i></div>
          <span>${done} / ${items.length}</span>
          ${done > 0 ? '<button class="link-btn clear-btn">Tout décocher</button>' : ''}
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
                    <div class="shop-name">${item.name}</div>
                    <div class="shop-qty">${isPantry ? 'Vérifie ton placard' : `${p.qty} ${p.unit}`}</div>
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
// bodyfat.js — Aide visuelle pour estimer sa masse grasse (morphologie masculine, de face).
// Les silhouettes sont dessinées en SVG : la taille s'épaissit et les abdos s'estompent avec le %.


const LEVELS = [
  { bf: 8,  desc: 'Très sec, abdos très marqués' },
  { bf: 10, desc: 'Abdos bien dessinés' },
  { bf: 15, desc: 'Abdos visibles, taille marquée' },
  { bf: 20, desc: 'Ventre plat, abdos à peine devinés' },
  { bf: 25, desc: 'Léger ventre, poignées d\'amour' },
  { bf: 30, desc: 'Ventre arrondi, taille épaissie' },
  { bf: 35, desc: 'Ventre marqué, plus de définition' },
  { bf: 40, desc: 'Ventre proéminent, poitrine plus grasse' },
];

// Silhouette paramétrée par le % de masse grasse
function torso(bf) {
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

function openBodyfatGuide(current, onPick) {
  const closest = LEVELS.reduce((a, l) => Math.abs(l.bf - current) < Math.abs(a.bf - current) ? l : a, LEVELS[0]).bf;
  openSheet(`
    <div class="sheet-handle"></div>
    <div class="hb-sheet-pad">
      <div class="hb-h2">Estimer ta masse grasse</div>
      <p class="hb-p">Regarde-toi de face dans un miroir, debout et détendu, idéalement le matin. Touche la silhouette la plus proche ; entre deux, ajuste ensuite d'un point avec + et −.</p>
      <div class="bf-grid">
        ${LEVELS.map(l => `
          <button class="bf-card ${l.bf === closest ? 'on' : ''}" data-bf="${l.bf}">
            ${torso(l.bf)}
            <span class="bf-val">${l.bf} %</span>
            <span class="bf-desc">${l.desc}</span>
          </button>`).join('')}
      </div>
      <p class="bf-note">C'est une estimation à ± 3 %, suffisante pour calculer tes besoins. L'important est de rester cohérent d'une mesure à l'autre.</p>
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
// js/settings.js
// ──────────────────────────────────────────────
// settings.js — Profil + choix de programme (Zero to Hero) + objectifs


// ── Fiche détaillée d'un programme ──
const kgWeek = off => off * 7 / 7700; // ~7 700 kcal par kg
function paceShort(p) {
  if (p.id === 'P2') return '≈ stable';
  const v = p.phases.map(x => x.offset).filter(Boolean).map(o => Math.abs(kgWeek(o)).toFixed(1).replace('.', ','));
  const sign = p.phases.some(x => x.offset > 0) ? '+' : '−';
  return v.length > 1 ? `${sign}${v[0]} à ${v[v.length - 1]} kg` : `${sign}${v[0]} kg`;
}
function paceText(p) {
  if (p.id === 'P2') return 'poids à peu près stable';
  const v = p.phases.map(x => x.offset).filter(Boolean).map(o => Math.abs(kgWeek(o)).toFixed(1).replace('.', ','));
  const dir = p.phases.some(x => x.offset > 0) ? 'de prise' : 'de perte';
  return v.length > 1 ? `${v[0]} à ${v[v.length - 1]} kg ${dir} par semaine` : `${v[0]} kg ${dir} par semaine`;
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

  function render() {
    const base     = computeBase(profile);
    const phases   = computeAllPhases(profile, protocolId);
    const protocol = PROTOCOLS.find(p => p.id === protocolId);
    phaseIdx = Math.min(phaseIdx, protocol.phases.length - 1);
    const active   = phases[phaseIdx];
    const current  = getTargets();
    const isComputed = !localStorage.getItem('diet_targets') ||
      JSON.stringify(current) === JSON.stringify(computeTargets(profile, protocolId, phaseIdx));

    view.innerHTML = `
      <div class="hb-subhead"><button class="hb-back">‹ Semaine</button><div class="hb-page-title">Mon programme</div></div>
      <div class="set-hero">
        <div class="set-hero-label">Ce que tu dépenses par jour</div>
        <div class="set-hero-kcal">${Math.round(base.maintenance)}<span>kcal</span></div>
        <div class="set-hero-meta">C'est ton point d'équilibre : en mangeant ça, ton poids ne bouge pas. Calculé avec ta masse maigre de ${base.leanMass.toFixed(1).replace('.', ',')} kg.</div>
      </div>

      <!-- PROFIL -->
      <div class="set-section">
        <div class="set-section-head">Tes informations</div>
        <div class="profile-grid">
          ${pcell('age',     'Âge',          profile.age,     'ans', 1)}
          ${pcell('height',  'Taille',       profile.height,  'm',   0.01)}
          ${pcell('weight',  'Poids',        profile.weight,  'kg',  0.5)}
          ${pcell('bodyfat', 'Masse grasse', profile.bodyfat, '%',   1)}
        </div>
        <button class="bf-guide-btn">
          <span class="bf-guide-ic">${torso(20)}</span>
          <span><b>Estimer ta masse grasse en images</b><span>Compare-toi à des silhouettes de 8 à 40 %</span></span>
          <span class="hb-chev">›</span>
        </button>
      </div>

      <!-- PROTOCOLE -->
      <div class="set-section">
        <div class="set-section-head">Ton objectif</div>
        <div class="protocol-grid">
          ${PROTOCOLS.map(p => {
            const range = phaseRange(profile, p.id);
            return `
            <button class="proto-card pc-${p.id} ${p.id === protocolId ? 'active' : ''}" data-pid="${p.id}">
              <div class="proto-head">
                <div class="proto-name">${p.name}</div>
                <span class="proto-info" data-sheet="${p.id}" role="button" tabindex="0" aria-label="En savoir plus sur ${p.name}">i</span>
              </div>
              <div class="proto-tagline">${p.tagline}</div>
              <div class="proto-range">${range}</div>
              <div class="proto-check">✓</div>
            </button>`;
          }).join('')}
        </div>
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
        </div>

        <div class="phase-guide">
          <div class="pg-row"><div><div class="pg-title">Cette phase</div><div class="pg-text">${protocol.phases[phaseIdx].advice}</div></div></div>
          <div class="pg-row"><div><div class="pg-title">Quand passer à la suite</div><div class="pg-text">${protocol.phases[phaseIdx].advance}</div></div></div>
        </div>

      </div>

      <!-- MANUEL -->
      <details class="set-manual" ${manualOpen ? 'open' : ''}>
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

      <button class="hb-btn set-back-bottom">Retour à ma semaine</button>
    `;
    bind();
  }

  function openProtocolSheet(pid) {
    const p = PROTOCOLS.find(x => x.id === pid);
    const ph = computeAllPhases(profile, pid);
    const maint = Math.round(computeBase(profile).maintenance);
    const isCurrent = pid === protocolId;
    const stepName = (x, i) => i === 0 ? x.label : `${x.label} <em>facultative</em>`;
    const last = ph.length - 1;
    openSheet(`
      <div class="sheet-handle"></div>
      <div class="hb-sheet-pad pf pc-${p.id}">
        <div class="pf-hero">
          <div class="hb-h2">${p.name}</div>
          <p class="pf-tag">${p.tagline}</p>
          <div class="pf-stats">
            <div><b>${paceShort(p)}</b><span>par semaine</span></div>
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
      if (!isCurrent) {
        protocolId = pid; phaseIdx = 0;
        saveSelectedProtocol(protocolId); saveSelectedPhase(0); applyComputed();
        toast(`Programme : ${p.name}`);
      }
      closeSheet(); render();
    });
  }

  function phaseRange(prof, pid) {
    const ph = computeAllPhases(prof, pid);
    if (ph.length === 1) return `${ph[0].targets.kcal} kcal`;
    const kcals = ph.map(p => p.targets.kcal);
    return `${kcals[0]} → ${kcals[kcals.length - 1]} kcal`; // dans l'ordre des phases
  }

  function bind() {
    view.querySelector('.hb-back')?.addEventListener('click', () => window._nav?.('week'));
    view.querySelector('.bf-guide-btn')?.addEventListener('click', () => openBodyfatGuide(profile.bodyfat, v => {
      profile.bodyfat = v; saveProfile(profile); applyComputed(); render();
      toast(`Masse grasse : ${v} %`);
    }));
    view.querySelectorAll('.pcell-btn').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.key, d = parseFloat(b.dataset.delta);
      profile[k] = Math.max(0, Math.round((profile[k] + d) * 100) / 100);
      saveProfile(profile); applyComputed(); render();
    }));
    view.querySelectorAll('.pcell-input').forEach(inp => inp.addEventListener('change', () => {
      const v = parseFloat(inp.value.replace(',', '.'));
      if (!isNaN(v) && v >= 0) { profile[inp.dataset.key] = v; saveProfile(profile); applyComputed(); }
      render();
    }));
    view.querySelectorAll('.proto-card').forEach(b => b.addEventListener('click', e => {
      if (e.target.closest('[data-sheet]')) return openProtocolSheet(b.dataset.pid);
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

  function pcell(key, label, value, unit, step) {
    return `
      <div class="profile-cell">
        <div class="pc-label">${label}</div>
        <div class="pc-control">
          <button class="pcell-btn" data-key="${key}" data-delta="-${step}">−</button>
          <div class="pc-value"><input class="pcell-input" type="text" inputmode="decimal" data-key="${key}" value="${value}"><span class="pc-unit">${unit}</span></div>
          <button class="pcell-btn" data-key="${key}" data-delta="${step}">+</button>
        </div>
      </div>`;
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


// ──────────────────────────────────────────────
// js/main.js
// ──────────────────────────────────────────────

const VIEWS = {
  week:     renderWeek,
  cook:     renderCook,
  shopping: renderShopping,
  recipes:  renderRecipes,
  settings: renderSettings,
};

function navigate(view) { setState({ currentView: view }); render(); }

function render() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  (VIEWS[state.currentView] || renderWeek)();
  renderNav();
}

window._nav = navigate;
document.addEventListener('DOMContentLoaded', render);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});


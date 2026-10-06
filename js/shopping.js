// shopping.js — Liste de courses
// Source : soit une plage de dates choisie depuis la vue Semaine (diet_shop_range),
// soit les N derniers jours. Les quantités sont multipliées par les portions (servings).

import { getEntry, getTodayDate } from '../data/log.js';
import { getById }          from '../data/recipes.js';
import { toast, el }               from './utils.js';
import { getActivePlan, planMembers, sessionDate, sessionWhen } from './weekgen.js';
import { INGREDIENTS, ingCost, NATURAL_UNITS, spicesOf } from '../data/ingredients.js';
import { itemQuantities } from './optimizer.js';

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

export function renderShopping() {
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

// Test du réglage « Riz et pâtes » (v171) : complets, classiques, plat par plat, avec et sans autocuiseur, avec le régime sans gluten.
// Lancer : node outils/tests/riz_pates.js
const L = require('./charger.js');
L(['data/ingredients.js','data/recipes.js','data/household.js','data/calculator.js','data/user.js','data/log.js','data/prefs.js','js/adapt.js','js/staples.js','js/diet.js','js/utils.js','js/optimizer.js','js/micros.js','js/weekgen.js'], `
let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('  ÉCHEC :', msg); } };
const act = () => RECIPES.filter(r => !r.retired);
const apply = () => { applyEquipment(); applyDiet(); };
const keysOf = r => r.ingredients.map(i => i.key);
for (const cooker of [true, false]) {
  const h = getHousehold(); h.equipment = { plaque: true, four: true, airfryer: true, autocuiseur: cooker, microondes: true, mixeur: true }; saveHousehold(h);
  console.log('== ' + (cooker ? 'avec' : 'sans') + ' autocuiseur');
  // 1. Complets (par défaut)
  setStaples('complet'); apply();
  const w14c = getById('W14'), t14 = w14c.cookTime;
  ok(keysOf(w14c).includes('riz') && /riz complet/.test(w14c.name), 'complet : W14 au riz complet');
  ok(act().every(r => !keysOf(r).some(k => k === 'riz_blanc' || k === 'pates_classiques')), 'complet : aucun riz blanc ni pâtes classiques');
  // 2. Classiques
  setStaples('classique'); apply();
  const riceDishes = act().filter(r => r._staple === 'riz'), pastaDishes = act().filter(r => r._staple === 'pates');
  ok(act().every(r => !keysOf(r).filter((k, i) => !r.ingredients[i].extra).some(k => k === 'riz' || k === 'pates')), 'classique : plus aucun riz complet ni pâtes complètes');
  ok(/riz basmati/.test(getById('W14').name) && getById('W14').cookTime === t14 - 15, 'classique : W14 renommé et 15 min de moins');
  const steps = riceDishes.flatMap(r => r.steps).join(' ');
  ok(!/20 minutes sous pression|35 minutes|2,5 fois|1,7 fois son poids d'eau, ferme et laisse cuire 14|riz complet/.test(steps.replace(/1,7 fois son poids d'eau \\(par exemple 150 ml d'eau pour 90 g de riz\\)\\. Porte/g, '')), 'classique : aucun texte de riz complet dans les étapes');
  ok(!getById('W33').steps.join(' ').includes('complètes'), 'classique : W33 sans pâtes complètes');
  ok(Math.abs(getById('W14').macros.kcal - w14c.macros.kcal) < 20, 'classique : calories proches');
  console.log('  plats concernés : riz ' + riceDishes.length + ', pâtes ' + pastaDishes.length);
  // 3. Plat par plat : W14 en blanc, le reste en complet
  setStaples('plat'); setDishStaple('W14', 'classique'); apply();
  ok(keysOf(getById('W14')).includes('riz_blanc'), 'plat par plat : W14 en riz blanc');
  ok(keysOf(getById('W01')).includes('riz'), 'plat par plat : W01 reste au riz complet');
  setDishStaple('W14', 'complet'); apply();
  ok(keysOf(getById('W14')).includes('riz'), 'plat par plat : W14 revenu au complet');
  // 4. Sans gluten strict + classiques : le riz qui remplace le boulgour (W05) passe aussi en blanc
  updateActiveMember({ gluten: 2 }); setStaples('classique'); apply();
  const w05 = getById('W05');
  ok(keysOf(w05).includes('riz_blanc') && !/20 minutes sous pression|35 minutes/.test(w05.steps.join(' ')), 'sans gluten : riz de W05 en blanc');
  ok(w05.cookTime === getById('W05')._cookBase, 'sans gluten : temps de W05 inchangé (pas de -15)');
  ok(keysOf(getById('W33')).includes('pates_sg'), 'sans gluten : pâtes sans gluten gardées');
  updateActiveMember({ gluten: 0 }); setStaples('complet'); apply();
}
// 5. Semaine générée en mode classique : le moteur fonctionne et varie toujours les féculents
setStaples('classique'); apply();
updateActiveMember({sex:'male',age:24,height:1.85,weight:97,bodyfat:20,activity:2,protocol:'P4',phase:0});
let good = 0, n = 0;
for (let w = 0; w < 10; w++) { const { entries, dates } = generateWeek({ targets: getTargets() }); dates.forEach(d => { n++; const k = computeDayMacros(entries[d]).kcal; if (Math.abs(k - getTargets().kcal) / getTargets().kcal <= 0.07) good++; }); }
ok(good / n >= 0.97, 'classique : précision des calories (' + Math.round(good / n * 100) + ' %)');
console.log('semaines en mode classique : ' + Math.round(good / n * 100) + ' % des jours à ±7 %');
setStaples('complet');
console.log(fails ? fails + ' échec(s)' : 'Tout est bon');
`);

// Réglages « même plat au plus N fois » et « soupes » (v208) : vérifie la limite, le nombre de plats, la précision.
// Lancer : node outils/tests/repetition.js
const L = require('./charger.js');
L(['data/ingredients.js','data/recipes.js','data/household.js','data/calculator.js','data/user.js','data/log.js','data/prefs.js','js/adapt.js','js/staples.js','js/diet.js','js/utils.js','js/micros.js','js/optimizer.js','js/weekgen.js'], `
const PROFILS = [
  ['Pierre 2838', {sex:'male',age:24,height:1.85,weight:97,bodyfat:20,activity:2,protocol:'P4',phase:0,formula:'classique'}, []],
  ['Femme 1642', {sex:'female',age:30,height:1.65,weight:60,bodyfat:27,activity:1,protocol:'P2',phase:0,formula:'classique'}, []],
  ['Pierre, 3 midis libres', {sex:'male',age:24,height:1.85,weight:97,bodyfat:20,activity:2,protocol:'P4',phase:0,formula:'classique'}, ['0-lunch','2-lunch','4-lunch']],
];
let fails = 0;
for (const soups of [false, true]) for (const rep of [2, 3, 4]) for (const [lbl, prof, free] of PROFILS) {
  setMaxRepeat(rep); setSoups(soups);
  updateActiveMember(prof);
  const MB=[{id:getActiveMember().id,targets:getTargets(),free,formula:'classique',breakfast:'mix',whey:true}];
  const N=40; let ok=0, days=0, worst=0, nd=0, soupW=0, cost=0;
  for (let w=0; w<N; w++) {
    const res = generateWeek({members:MB}); const E = res.entriesBy[MB[0].id];
    const per = {};
    res.dates.forEach(d => { ['lunch','dinner'].forEach(sl => (E[d].meals[sl]||[]).forEach(it => { if (getById(it.id)?.category==='dinner'||getById(it.id)?.category==='lunch') per[it.id]=(per[it.id]||0)+1; })); days++;
      const k=computeDayMacros(E[d]).kcal; if (Math.abs(k-MB[0].targets.kcal)/MB[0].targets.kcal<=0.07) ok++; });
    worst = Math.max(worst, ...Object.values(per)); nd += Object.keys(per).length;
    if (res.mains.some(isSoup)) soupW++;
    cost += res.cost || 0;
  }
  if (worst > rep) fails++;
  console.log((soups?'soupes  ':'sans    ')+'max '+rep+' | '+lbl.padEnd(24)+' | pire plat '+worst+' repas | '+(nd/N).toFixed(1)+' plats/sem | jours ±7 % '+Math.round(ok/days*100)+'% | semaines avec soupe '+soupW+'/'+N);
}
console.log(fails ? fails+' échec(s) : un plat dépasse la limite' : 'Limite respectée partout');
`);

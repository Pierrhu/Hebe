// Repas libres (midis et soirs différents) : ce que le moteur produit, scénario par scénario.
// Lancer : node outils/tests/repas_libres.js
const L = require('./charger.js');
L(['data/ingredients.js','data/recipes.js','data/household.js','data/calculator.js','data/user.js','data/log.js','data/prefs.js','js/adapt.js','js/staples.js','js/diet.js','js/utils.js','js/micros.js','js/optimizer.js','js/weekgen.js'], `
const J = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
const all = (meal, days) => days.map(d => d + '-' + meal);
const SCEN = [
  ['Aucun repas libre', []],
  ['Cantine du lundi au vendredi (midis)', all('lunch', [0,1,2,3,4])],
  ['Week-end entier libre', [...all('lunch', [5,6]), ...all('dinner', [5,6])]],
  ['Vendredi et samedi soir', all('dinner', [4,5])],
  ['En alternance : lun midi, mar soir, mer midi, jeu soir', ['0-lunch','1-dinner','2-lunch','3-dinner']],
  ['Début de semaine chargé (lun-mer midi et soir)', [...all('lunch', [0,1,2]), ...all('dinner', [0,1,2])]],
  ['Fin de semaine chargée (jeu-dim midi et soir)', [...all('lunch', [3,4,5,6]), ...all('dinner', [3,4,5,6])]],
  ['Tous les soirs libres', all('dinner', [0,1,2,3,4,5,6])],
  ['Tous les midis libres', all('lunch', [0,1,2,3,4,5,6])],
  ['10 repas libres sur 14', [...all('lunch', [0,1,2,3,4,5,6]), '1-dinner', '3-dinner', '5-dinner']],
  ['Un seul repas libre (dimanche soir)', ['6-dinner']],
];
// tirages aléatoires : de 0 à 9 repas libres
for (let i = 0; i < 6; i++) {
  const slots = []; for (let d = 0; d < 7; d++) { slots.push(d + '-lunch', d + '-dinner'); }
  const k = [2, 3, 5, 6, 8, 9][i];
  const pick = slots.sort(() => Math.random() - 0.5).slice(0, k).sort();
  SCEN.push(['Aléatoire ' + k + ' libres : ' + pick.map(s => J[+s[0]] + (s.includes('lunch') ? ' midi' : ' soir')).join(', '), pick]);
}
updateActiveMember({sex:'male',age:24,height:1.85,weight:97,bodyfat:20,activity:2,protocol:'P4',phase:0,formula:'classique'});
const T = getTargets();
const W = 60;
const problems = [];
for (const [nom, free] of SCEN) {
  const MB = [{ id: getActiveMember().id, targets: T, free, formula: 'classique', breakfast: 'mix', whey: true }];
  const st = { empty: 0, ones: 0, dishes: 0, spreads: [], dist: {}, ok: 0, days: 0, late: 0, sameDay: 0, freeBroken: 0, freeMissing: 0, beef2: 0, rice3: 0, nPlats: {} };
  for (let w = 0; w < W; w++) {
    const res = generateWeek({ members: MB });
    const E = res.entriesBy[MB[0].id];
    const c = {};
    res.dates.forEach((d, di) => {
      st.days++;
      const k = computeDayMacros(E[d]).kcal;
      if (Math.abs(k - T.kcal) / T.kcal <= 0.07) st.ok++;
      const ids = [];
      ['lunch', 'dinner'].forEach(m => {
        const items = E[d].meals[m] || [];
        const isFree = free.includes(di + '-' + m);
        const hasL01 = items.some(it => it.id === 'L01');
        if (isFree && !hasL01) st.freeBroken++;
        if (!isFree && hasL01) st.freeBroken++;
        if (!isFree && !items.length) st.freeMissing++;
        items.forEach(it => { const r = getById(it.id); if (!r || !r.batch) return; c[it.id] = (c[it.id] || 0) + 1; ids.push(it.id); if (di > deadlineOf(r)) st.late++; });
      });
      if (ids.length === 2 && ids[0] === ids[1]) st.sameDay++;
    });
    const v = Object.values(c);
    if (!v.length) { if (free.length < 14) st.empty++; continue; }
    st.dishes += v.length; st.ones += v.filter(x => x === 1).length;
    st.spreads.push(Math.max(...v) - Math.min(...v));
    const key = v.sort((a, b) => b - a).join('-'); st.dist[key] = (st.dist[key] || 0) + 1;
    st.nPlats[v.length] = (st.nPlats[v.length] || 0) + 1;
    if (res.mains.filter(r => r.ingredients.some(i => ['boeuf', 'boeuf_emince'].includes(i.key))).length > 1) st.beef2++;
    if (res.mains.filter(r => ['riz', 'riz_blanc', 'nouilles_riz'].includes(mainStarch(r))).length > 3) st.rice3++;
  }
  const n = 14 - free.length;
  const sp = st.spreads.length ? Math.max(...st.spreads) : 0;
  console.log('== ' + nom + ' (' + n + ' repas à cuisiner)');
  console.log('   répartitions : ' + Object.entries(st.dist).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => k + ' (' + v + ')').join(', ')
    + ' | plats/semaine : ' + Object.entries(st.nPlats).map(([k, v]) => k + ' plats ×' + v).join(', '));
  console.log('   jours ±7 % ' + Math.round(st.ok / st.days * 100) + '% | plats à 1 portion ' + st.ones + ' | écart max ' + sp
    + ' | semaines vides ' + st.empty + ' | mangés trop tard ' + st.late + ' | même plat midi et soir ' + st.sameDay
    + ' | repas libres mal placés ' + st.freeBroken + ' | repas vides ' + st.freeMissing + ' | 2 plats de bœuf ' + st.beef2);
  if (st.empty || st.ones || st.late || st.freeBroken || st.freeMissing || st.beef2 || sp > 2 || st.ok / st.days < 0.97) problems.push(nom);
}
console.log(problems.length ? 'À regarder : ' + problems.join(' · ') : 'Tout est bon');
`);

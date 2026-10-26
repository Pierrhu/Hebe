// v226 : plats de saison. Simule 100 semaines en octobre puis 100 en juillet :
// aucun plat hors saison ne doit sortir, et la variété doit rester bonne.
// Lancer : node outils/tests/saisons.js
const L = require('./charger.js');
const RealDate = Date;
function at(iso) {
  global.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [iso])); } static now() { return new RealDate(iso).getTime(); } };
}
let bad = 0;
for (const [label, iso] of [['octobre', '2026-10-12T10:00:00'], ['juillet', '2026-07-06T10:00:00']]) {
  at(iso);
  const r = L(['data/ingredients.js','data/recipes.js','data/household.js','data/calculator.js','data/user.js','data/log.js','data/prefs.js','data/photos.js','data/season.js','js/adapt.js','js/staples.js','js/diet.js','js/utils.js','js/micros.js','js/optimizer.js','data/sessionSteps.js','js/session.js','js/weekgen.js'], `
updateActiveMember({sex:'male',age:24,height:1.85,weight:97,bodyfat:20,activity:2,protocol:'P4',phase:0,formula:'classique'});
const MB=[{id:getActiveMember().id,targets:getTargets(),free:[],formula:'classique',breakfast:'mix',whey:true}];
const cnt={}, off=new Set(); let ok=0, days=0;
for(let w=0;w<100;w++){const res=generateWeek({members:MB});const E=res.entriesBy[MB[0].id];
  res.mains.forEach(m=>{cnt[m.id]=(cnt[m.id]||0)+1; if(!inSeason(m,res.dates[0])) off.add(m.id);});
  res.dates.forEach(d=>{days++; const k=computeDayMacros(E[d]).kcal; if(Math.abs(k-MB[0].targets.kcal)/MB[0].targets.kcal<=0.07) ok++;
    (E[d].meals.sweet||[]).forEach(it=>{const s=getById(it.id); if(s&&!inSeason(s,d)) off.add(it.id);});});}
const pool=getMains().filter(r=>r.batch&&!r.retired&&!(r.tags||[]).includes('cantine')&&inSeason(r,'${iso.slice(0,10)}'));
({ off:[...off], served:Object.keys(cnt).length, pool:pool.length, never:pool.filter(r=>!cnt[r.id]).map(r=>r.id), pct:Math.round(ok/days*100) })`);
  console.log(`${label.padEnd(8)} | ${r.pool} plats de saison, ${r.served} servis | jamais servis : ${r.never.join(' ') || 'aucun'} | hors saison servis : ${r.off.join(' ') || 'aucun'} | jours à ±7 % ${r.pct}%`);
  bad += r.off.length;
}
global.Date = RealDate;
console.log(bad ? 'ERREUR : plats hors saison servis' : 'Tout est bon');

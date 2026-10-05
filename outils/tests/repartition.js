// Répartition des plats sur 200 semaines (v176) : chaque plat doit sortir à peu près aussi souvent que les autres.
// Lancer : node outils/tests/repartition.js            (toutes protéines)
//          node outils/tests/repartition.js poulet boeuf (protéines cochées)
const L = require('./charger.js');
const PROT = process.argv.slice(2);
L(['data/ingredients.js','data/recipes.js','data/household.js','data/calculator.js','data/user.js','data/log.js','data/prefs.js','js/adapt.js','js/staples.js','js/diet.js','js/utils.js','js/micros.js','js/optimizer.js','js/weekgen.js'], `
const PROT = ${JSON.stringify(PROT)};
updateActiveMember({sex:'male',age:24,height:1.85,weight:97,bodyfat:20,activity:2,protocol:'P4',phase:0,formula:'classique'});
const MB=[{id:getActiveMember().id,targets:getTargets(),free:[],formula:'classique',breakfast:'mix',whey:true}];
const N=200,cnt={};let ok=0,days=0,maxRice=0;
const F={riz:'riz',riz_blanc:'riz',nouilles_riz:'riz',pates:'pâtes',nouilles_oeufs:'pâtes',pain:'pain',farine:'pain',pita:'pain',baguette:'pain',tortilla:'pain',pain_burger:'pain',pdt:'pommes de terre',patate_douce:'pommes de terre',gnocchis:'pommes de terre',boulghour:'céréales',semoule:'céréales',quinoa:'céréales'};
let pool=getMains().filter(r=>r.batch&&!r.retired&&!(r.tags||[]).includes('cantine'));
if (PROT.length) pool=pool.filter(r=>PROT.includes(proteinFamily(r)));
for(let w=0;w<N;w++){const res=generateWeek({members:MB,proteins:PROT.length?PROT:null});const E=res.entriesBy[MB[0].id];
 res.mains.forEach(r=>{cnt[r.id]=(cnt[r.id]||0)+1});
 maxRice=Math.max(maxRice,res.mains.filter(r=>F[mainStarch(r)]==='riz').length);
 res.dates.forEach(d=>{days++;const k=computeDayMacros(E[d]).kcal;if(Math.abs(k-MB[0].targets.kcal)/MB[0].targets.kcal<=0.07)ok++;});}
const v=pool.map(r=>cnt[r.id]||0), tot=v.reduce((a,b)=>a+b,0), mean=tot/pool.length;
const sd=Math.sqrt(v.reduce((a,b)=>a+(b-mean)**2,0)/v.length);
console.log((PROT.length?PROT.join('+'):'toutes protéines')+' | '+pool.length+' plats | jours à ±7 % '+Math.round(ok/days*100)+'% | sorties par plat : moyenne '+mean.toFixed(1)+', min '+Math.min(...v)+', max '+Math.max(...v)+', écart-type '+sd.toFixed(1)+' | au plus '+maxRice+' plats au riz par semaine');
const fams={};pool.forEach(r=>{const f=F[mainStarch(r)]||mainStarch(r);fams[f]=fams[f]||[0,0];fams[f][0]++;fams[f][1]+=cnt[r.id]||0});
console.log('par famille (plats → part des plats / part des sorties) : '+Object.entries(fams).map(([f,[n,c]])=>f+' '+n+' → '+Math.round(n/pool.length*100)+'% / '+Math.round(c/tot*100)+'%').join(' · '));
const rows=pool.map(r=>[cnt[r.id]||0,r.id,r.name]).sort((a,b)=>b[0]-a[0]);
console.log('plus fréquents : '+rows.slice(0,5).map(x=>x[1]+' '+x[0]).join(', ')+' | moins fréquents : '+rows.slice(-5).map(x=>x[1]+' '+x[0]).join(', '));
`);

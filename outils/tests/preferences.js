// Préférences de petit-déjeuner (sucré, salé, les deux) et option sans whey.
const L=require('./charger.js');
L(['data/ingredients.js','data/recipes.js','data/household.js','data/calculator.js','data/user.js','data/log.js','data/prefs.js','js/adapt.js','js/staples.js','js/diet.js','js/utils.js','js/optimizer.js','js/micros.js','js/weekgen.js'],`
updateActiveMember({sex:'male',age:24,height:1.85,weight:97,bodyfat:20,activity:2,protocol:'P4',phase:0});const T=getTargets();
const cases=[['classique','sucre',true],['classique','sale',true],['classique','mix',true],['classique','mix',false],['jeune','mix',false]];
for(const [formula,bk,whey] of cases){
 let ok=0,n=0,wheyHits=0,bad=0,prot=[],bkKcal=[],seen=new Set(),sweet=0,salty=0;
 for(let w=0;w<30;w++){
  const {entriesBy,dates}=generateWeek({members:[{id:'m1',targets:T,cantine:[],formula,breakfast:bk,whey}]});
  dates.forEach(d=>{const e=entriesBy.m1[d];const m=computeDayMacros(e);n++;if(Math.abs(m.kcal-T.kcal)/T.kcal<=0.07)ok++;prot.push(m.protein);
   Object.values(e.meals).flat().forEach(it=>{const r=getById(it.id);if(r&&hasWhey(r))wheyHits++;});
   (e.meals.breakfast||[]).forEach(it=>{const r=getById(it.id);seen.add(r.short);bkKcal.push(computeMealMacros(it).kcal);const t=r.tags||[];if(t.includes('salé'))salty++;else sweet++;if(bk==='sucre'&&t.includes('salé'))bad++;if(bk==='sale'&&!t.includes('salé'))bad++;});
  });
 }
 const avg=a=>a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length):0;
 console.log((formula+' / '+bk+' / '+(whey?'avec whey':'sans whey')).padEnd(30),'| jours ±7 %',Math.round(ok/n*100)+'%','| protéines',avg(prot),'g','| petit-déj',avg(bkKcal),'kcal','| sucré/salé',sweet+'/'+salty,'| hors préférence',bad,'| whey trouvée',whey?'–':wheyHits);
 if(seen.size)console.log('    ',[...seen].join(', '));
}`);

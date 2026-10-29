// v303 : douceurs de la semaine cohérentes (profil de Pierre) :
//  - au moins une douceur préparée pendant la session chaque semaine ;
//  - une seule recette par famille (granola, overnight oats, tiramisu, barres…) entre petits-déjeuners et collations ;
//  - une douceur « en série » (tiramisu, overnight oats, pommes poêlées) servie au moins 2 fois, dans ses jours de conservation.
const L=require('./charger.js');
L(['data/ingredients.js','data/recipes.js','data/household.js','data/calculator.js','data/user.js','data/log.js','data/prefs.js','js/adapt.js','js/staples.js','js/diet.js','js/utils.js','js/optimizer.js','js/micros.js','data/season.js','data/sessionSteps.js','js/session.js','js/weekgen.js'],`
const F=process.env.F||'jeune';
updateMember('m1',{name:'Pierre',sex:'male',age:24,height:1.85,weight:97,bodyfat:20,activity:2,protocol:'P2',phase:0,free:[],formula:F});
const FOY=[{id:'m1',targets:getTargets(),free:[],whey:true,formula:F,breakfast:'mix'}];
const N=+(process.env.N||40);let sansDessert=0,doublons=0,serieKo=0,serieN=0,moinsDe2=0,moinsDe3=0,nd=0;const names={};const prob=[];
for(let w=0;w<N;w++){const {entriesBy,dates}=generateWeek({members:FOY,nextWeek:true});
  const items=[];dates.forEach((dt,di)=>{const e=entriesBy.m1[dt];['breakfast','sweet','sides'].forEach(sl=>(e.meals[sl]||[]).filter(it=>!it.with).forEach(it=>items.push({r:getById(it.id),di})))});
  const recs=[...new Map(items.map(x=>[x.r.id,x.r])).values()];
  const sweetBatch=recs.filter(r=>r.batch&&r.category==='sweet');if(!sweetBatch.length)sansDessert++;if(sweetBatch.length<2)moinsDe2++;sweetBatch.forEach(r=>{nd++;if(items.filter(x=>x.r.id===r.id).length<3)moinsDe3++});
  sweetBatch.forEach(r=>names[r.short||r.name]=(names[r.short||r.name]||0)+1);
  const fam={};recs.forEach(r=>familiesOf(r).forEach(f=>(fam[f]=fam[f]||new Set()).add(r.id)));
  const dup=Object.entries(fam).filter(([f,s])=>s.size>1);if(dup.length){doublons++;prob.push(dup.map(([f,s])=>f+':'+[...s].join('/')).join(' '))}
  recs.filter(r=>r.batch&&r.category==='sweet'&&(r.tags||[]).some(t=>/^frigo-/.test(t))).forEach(r=>{serieN++;const ds=items.filter(x=>x.r.id===r.id).map(x=>x.di);const fr=parseInt(r.tags.find(t=>/^frigo-/.test(t)).slice(6));if(ds.length<2||ds.some(d=>d+1>fr)){serieKo++;prob.push(r.id+' jours '+ds.join(','))}});
}
console.log(F,'| semaines avec moins de 2 douceurs préparées',moinsDe2+'/'+N,'| douceurs à moins de 3 portions',moinsDe3+'/'+nd,'| sans aucune',sansDessert+'/'+N,'| semaines avec deux recettes de la même famille',doublons+'/'+N,'| douceurs en série mal servies',serieKo+'/'+serieN);
if(prob.length)console.log('  ',prob.slice(0,6).join(' | '));
console.log('  ',Object.entries(names).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+' '+v).join(' · '));
`);

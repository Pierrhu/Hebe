// v299 : durée de la session du dimanche sur des semaines générées (foyer de deux), avec les vraies quantités.
// La session est construite comme dans l'onglet Cuisiner (ssBuild) : lancements, mise en place commune, cuissons.
const L=require('./charger.js');
L(['data/ingredients.js','data/recipes.js','data/household.js','data/calculator.js','data/user.js','data/log.js','data/prefs.js','js/adapt.js','js/staples.js','js/diet.js','js/utils.js','js/optimizer.js','js/micros.js','data/season.js','data/sessionSteps.js','js/session.js','js/weekgen.js'],`
setMemberCount(2);
updateMember('m1',{name:'Toi',sex:'male',age:28,height:1.80,weight:82,bodyfat:18,activity:2,protocol:'P2',phase:0,free:[]});
updateMember('m2',{name:'Ta moitié',sex:'female',age:28,height:1.65,weight:60,bodyfat:27,activity:2,protocol:'P2',phase:0,free:[]});
const FOY=getMembers().map(m=>{setActiveMember(m.id);return {id:m.id,targets:getTargets(),free:m.free}});setActiveMember('m1');
const N=+(process.env.N||40), T=[], nPlats=[], lost=[];
for(let w=0;w<N;w++){
  const {entriesBy,dates,plan}=generateWeek({members:FOY,nextWeek:true});
  const S=plan.sessions[0];
  const dishes=S.recipes.map(x=>{const r=getById(x.id);const tot=r.ingredients.map(()=>0);
    FOY.forEach(m=>dates.forEach(d=>['lunch','dinner'].forEach(s=>(entriesBy[m.id][d].meals[s]||[]).forEach(it=>{if(it.id!==r.id)return;itemQuantities(it).forEach((q,i)=>tot[i]+=q)}))));
    return {r,tot,kind:'dish'}});
  const rice=dishes.some(d=>d.r.steps.some(s=>/^Riz : /.test(s)));
  const b=ssBuild(dishes,{qtyText:qtyWithName,qtyShort,rice:rice?[{text:'r',app:'autocuiseur',active:3,passive:0},{text:'c',app:'autocuiseur',active:1,passive:35},{text:'e',app:null,active:1,passive:0}]:null});
  if(process.env.DBG) console.log(S.recipes.map(x=>x.id+':'+x.portions).join(' '),'réel',Math.round(b.total),'estimé',Math.round(ssEstimate(S.recipes.map(x=>getById(x.id)))),'essais',S.tries);
  T.push(b.total+10); nPlats.push(dishes.length); if(b.missing) lost.push(b.missing);
}
T.sort((a,b)=>a-b);
console.log('Session (mise en boîtes comprise) : médiane',Math.round(T[T.length>>1]),'min | p90',Math.round(T[Math.floor(T.length*.9)]),'| max',Math.round(T[T.length-1]),'| plats',Math.min(...nPlats)+'-'+Math.max(...nPlats),'| étapes perdues',lost.length);
`);

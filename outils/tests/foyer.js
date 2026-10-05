// Foyer de deux personnes : mêmes plats, portions de chacun, barquettes communes, précision par personne.
const L=require('./charger.js');
L(['data/ingredients.js','data/recipes.js','data/household.js','data/calculator.js','data/user.js','data/log.js','data/prefs.js','js/adapt.js','js/staples.js','js/diet.js','js/utils.js','js/optimizer.js','js/micros.js','js/weekgen.js'],`
setMemberCount(2);
updateMember('m1',{name:'Pierre',sex:'male',age:24,height:1.85,weight:97,bodyfat:20,activity:2,protocol:'P4',phase:0,free:[]});
updateMember('m2',{name:'Léa',sex:'female',age:30,height:1.65,weight:62,bodyfat:28,activity:1,protocol:'P4',phase:1,free:['1-lunch','3-lunch','5-dinner']});
const FOY=getMembers().map(m=>{setActiveMember(m.id);return {id:m.id,targets:getTargets(),free:m.free}});setActiveMember('m1');
const st={m1:[],m2:[]};let rest=[],same=0,tot=0,costs=[],snapOk=0,snapN=0,plate={m1:0,m2:0};
for(let w=0;w<30;w++){
 const {entriesBy,dates,plan}=generateWeek({members:FOY,nextWeek:true});costs.push(plan.cost);
 dates.forEach((d,di)=>{
  FOY.forEach(m=>{const e=entriesBy[m.id][d];const k=computeDayMacros(e).kcal;st[m.id].push(Math.abs(k-m.targets.kcal)/m.targets.kcal);
   ['lunch','dinner'].forEach(s=>e.meals[s].forEach(it=>plate[m.id]=Math.max(plate[m.id],computeMealMacros(it).kcal)))});
  const din=FOY.map(m=>entriesBy[m.id][d].meals.dinner.map(i=>i.id).join());tot++;if(din[0]===din[1])same++;
  
 });
 // barquettes : total foyer multiple d'un format
 const totals={};FOY.forEach(m=>dates.forEach(d=>['lunch','dinner'].forEach(s=>entriesBy[m.id][d].meals[s].forEach(it=>{const r=getById(it.id);if(!r||(r.tags||[]).includes('cantine'))return;const q=itemQuantities(it);r.ingredients.forEach((g,i)=>{if(INGREDIENTS[g.key]?.snap)totals[g.key]=(totals[g.key]||0)+q[i]})}))));
 Object.entries(totals).forEach(([k,v])=>{snapN++;const U=Math.min(...(INGREDIENTS[k].packs||[INGREDIENTS[k].pack])),r=v/U;if(Math.abs(r-Math.round(r))<0.02)snapOk++;else rest.push(k+' '+Math.round(v))});
 // Léa en repas libre mardi midi : pas de plat pour elle, un plat pour Pierre
 if(entriesBy.m2[dates[1]].meals.lunch[0]?.id!=='L01')console.log('ERREUR repas libre Léa');
 if(entriesBy.m1[dates[1]].meals.lunch[0]?.id==='L01')console.log('ERREUR repas libre Pierre');
}
const pct=a=>Math.round(a.filter(x=>x<=0.07).length/a.length*100)+'%';
console.log('Pierre',FOY[0].targets.kcal,'kcal | jours ±7 %',pct(st.m1),'| assiette max',Math.round(plate.m1));
console.log('Léa   ',FOY[1].targets.kcal,'kcal | jours ±7 %',pct(st.m2),'| assiette max',Math.round(plate.m2));
console.log('Mêmes dîners',Math.round(same/tot*100)+'% | barquettes entières',Math.round(snapOk/snapN*100)+'% | coût',Math.min(...costs)+'-'+Math.max(...costs),'€ (budget',weekBudget(),'€)');
`);

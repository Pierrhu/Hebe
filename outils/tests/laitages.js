// Un seul laitage en bol (fromage blanc ou yaourt) par jour, petit-déjeuner compris.
const L=require('./charger.js');
L(['data/ingredients.js','data/recipes.js','data/household.js','data/calculator.js','data/user.js','data/log.js','data/prefs.js','js/adapt.js','js/staples.js','js/diet.js','js/utils.js','js/optimizer.js','js/micros.js','js/weekgen.js'],`
const B=['fromage_blanc','yaourt_grec','yaourt_sl'];
[['classique','mix'],['jeune','mix']].forEach(([formula,bk])=>{
 setMemberCount(1); updateMember('m1',{name:'P',sex:'male',age:31,height:1.79,weight:78.5,bodyfat:30,activity:3,protocol:'P3',phase:0,free:[],formula,breakfast:bk,whey:true,lactose:0,gluten:0});
 setActiveMember('m1'); const T=getTargets(); let dup=0,days=0,ok=0; const FOY=[{id:'m1',targets:T,free:[],formula,breakfast:bk,whey:true}];
 for(let w=0;w<30;w++){const {entriesBy,dates}=generateWeek({members:FOY,nextWeek:true}); dates.forEach(d=>{const e=entriesBy.m1[d]; days++;
   const items=[...(e.meals.breakfast||[]),...(e.meals.sweet||[]),...(e.meals.sides||[]).filter(s=>!s.with)];
   const n=items.filter(it=>{const r=getById(it.id); return r&&r.ingredients.some(i=>B.includes(i.key))}).length; if(n>1)dup++;
   if(Math.abs(computeDayMacros(e).kcal-T.kcal)/T.kcal<=0.07) ok++;});}
 console.log(formula.padEnd(10),'jours avec 2 laitages en bol :',dup,'/',days,'| jours ±7 % :',Math.round(ok/days*100)+'%');
});`);

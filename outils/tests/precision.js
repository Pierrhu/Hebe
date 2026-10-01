const L=require('./charger.js');
const args=JSON.parse(process.argv[2]||'{}');
L(['data/ingredients.js','data/recipes.js','data/calculator.js','data/user.js','data/log.js','data/prefs.js','js/utils.js','js/optimizer.js','js/weekgen.js'],`
const t=${JSON.stringify(args.targets||null)}||getTargets();
let worst=0,res=[],maxPlate=0,costs=[],nplats=[];
for(let run=0;run<30;run++){
 const {entries,dates,plan}=generateWeek({cantineDays:${JSON.stringify(args.cantine||[])},targets:t,budget:'${args.budget||'normal'}'});
 costs.push(plan.cost);nplats.push(plan.sessions.reduce((a,s)=>a+s.recipes.length,0));
 dates.forEach(d=>{const m=computeDayMacros(entries[d]);res.push(m);worst=Math.max(worst,Math.abs(m.kcal-t.kcal)/t.kcal);
  ['lunch','dinner'].forEach(s=>entries[d].meals[s].forEach(it=>{maxPlate=Math.max(maxPlate,computeMealMacros(it).kcal)}))});
}
const avg=k=>Math.round(res.reduce((a,m)=>a+m[k],0)/res.length);
const within=res.filter(m=>Math.abs(m.kcal-t.kcal)/t.kcal<=0.07).length/res.length;
console.log(JSON.stringify(t),'| moy',avg('kcal'),'kcal',avg('protein'),'P',avg('carbs'),'C',avg('fat'),'F | ±7%:',Math.round(within*100)+'%','pire',Math.round(worst*100)+'%','| assiette max',Math.round(maxPlate),'| coût',Math.min(...costs)+'-'+Math.max(...costs)+'€ | plats/sem',Math.min(...nplats)+'-'+Math.max(...nplats));
`);

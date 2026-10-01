const L=require('./charger.js');
L(['data/ingredients.js','data/recipes.js','data/calculator.js','data/user.js','data/log.js','data/prefs.js','js/utils.js','js/optimizer.js','js/weekgen.js'],`
function run(T,label){const days=[];
 for(let w=0;w<30;w++){const {entries,dates}=generateWeek({targets:T});dates.forEach(d=>days.push(computeDayMacros(entries[d])))}
 const avg=k=>Math.round(days.reduce((a,m)=>a+m[k],0)/days.length);
 const within=(k,t)=>Math.round(days.filter(m=>Math.abs(m[k]-T[k])/T[k]<=t).length/days.length*100);
 console.log(label.padEnd(12),'| kcal',avg('kcal')+'/'+T.kcal,'('+within('kcal',.07)+'% à ±7 %)','| prot',avg('protein')+'/'+T.protein,'| gluc',avg('carbs')+'/'+T.carbs,'| lip',avg('fat')+'/'+T.fat,'('+within('fat',.15)+'% à ±15 %, min '+Math.round(Math.min(...days.map(m=>m.fat)))+')');}
run(getTargets(),'Toi 2853');run({kcal:2300,protein:140,carbs:260,fat:75},'Profil 2300');run({kcal:1800,protein:110,carbs:190,fat:60},'Profil 1800');`);

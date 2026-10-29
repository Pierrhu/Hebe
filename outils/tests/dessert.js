// v303 : chaque semaine, au moins un dessert ou une collation sucrée préparé pendant la session (profil de Pierre).
const L=require('./charger.js');
L(['data/ingredients.js','data/recipes.js','data/household.js','data/calculator.js','data/user.js','data/log.js','data/prefs.js','js/adapt.js','js/staples.js','js/diet.js','js/utils.js','js/optimizer.js','js/micros.js','data/season.js','data/sessionSteps.js','js/session.js','js/weekgen.js'],`
updateMember('m1',{name:'Pierre',sex:'male',age:24,height:1.85,weight:97,bodyfat:20,activity:2,protocol:'P2',phase:0,free:[]});
const FOY=[{id:'m1',targets:getTargets(),free:[],whey:true,formula:'classique'}];
const N=+(process.env.N||40);let sansDessert=0;const per=[],names={};let days=[];
for(let w=0;w<N;w++){const {entriesBy,dates}=generateWeek({members:FOY,nextWeek:true});
 const ids=new Set();let d=0;dates.forEach(dt=>{const e=entriesBy.m1[dt];const b=(e.meals.sweet||[]).concat(e.meals.sides||[]).filter(it=>{const r=getById(it.id);return r&&r.batch&&r.category==='sweet'});if(b.length)d++;b.forEach(it=>ids.add(it.id))});
 if(!ids.size)sansDessert++;per.push(ids.size);days.push(d);ids.forEach(i=>names[getById(i).name]=(names[getById(i).name]||0)+1);}
console.log("semaines sans dessert préparé",sansDessert+'/'+N,'| desserts par semaine',Math.min(...per)+'-'+Math.max(...per),'| jours avec',Math.min(...days)+'-'+Math.max(...days));
console.log(Object.entries(names).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+' '+v).join(' · '));
`);

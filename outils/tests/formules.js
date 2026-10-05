// Formules jeûne et classique : respect des calories et quantités réellement mangées à chaque repas.
const L=require('./charger.js');
L(['data/ingredients.js','data/recipes.js','data/household.js','data/calculator.js','data/user.js','data/log.js','data/prefs.js','js/adapt.js','js/staples.js','js/diet.js','js/utils.js','js/optimizer.js','js/micros.js','js/weekgen.js'],`
const PROFILS=[
 ['Homme 24 ans, 97 kg, perte progressive',{sex:'male',age:24,height:1.85,weight:97,bodyfat:20,activity:2,protocol:'P4',phase:0}],
 ['Homme 24 ans, 97 kg, prise de muscle',{sex:'male',age:24,height:1.85,weight:97,bodyfat:20,activity:2,protocol:'P1',phase:1}],
 ['Femme 30 ans, 62 kg, recomposition',{sex:'female',age:30,height:1.65,weight:62,bodyfat:28,activity:2,protocol:'P2',phase:0}],
];
const cooked=(r,q)=>{let s=0;r.ingredients.forEach((g,i)=>{const db=INGREDIENTS[g.key];if(db&&(db.role==='carb'||db.role==='legume')&&db.cook)s+=q[i]*db.cook;else if(db&&(db.role==='carb')&&!db.cook&&g.unit==='g')s+=q[i]});return s};
const avg=a=>a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length):0, rng=a=>a.length?Math.round(Math.min(...a))+'-'+Math.round(Math.max(...a)):'–';
for(const [label,prof] of PROFILS){
 updateActiveMember({...prof,name:'Test',cantine:[]});const T=getTargets();
 console.log('\\n== '+label+' : objectif '+T.kcal+' kcal, '+T.protein+' g de protéines');
 for(const formula of ['jeune','classique']){
  const st={day:[],prot:[],bk:[],lu:[],di:[],ex:[],nex:[],starch:[],meat:[],dev:[]};
  for(let w=0;w<30;w++){
   const {entriesBy,dates}=generateWeek({members:[{id:'m1',targets:T,cantine:[],formula}]});
   dates.forEach(d=>{const e=entriesBy.m1[d];const m=computeDayMacros(e);st.day.push(m.kcal);st.prot.push(m.protein);st.dev.push(Math.abs(m.kcal-T.kcal)/T.kcal);
    const k=list=>list.reduce((a,it)=>a+computeMealMacros(it).kcal,0);
    st.bk.push(k(e.meals.breakfast||[]));
    st.lu.push(k([...e.meals.lunch,...e.meals.sides.filter(s=>s.with==='lunch')]));
    st.di.push(k([...e.meals.dinner,...e.meals.sides.filter(s=>s.with==='dinner')]));
    const ex=[...e.meals.sweet,...e.meals.sides.filter(s=>!s.with)];st.ex.push(k(ex));st.nex.push(ex.length);
    ['lunch','dinner'].forEach(s=>e.meals[s].forEach(it=>{const r=getById(it.id);if(!r||(r.tags||[]).includes('cantine'))return;const q=itemQuantities(it);st.starch.push(cooked(r,q));const mp=mainProteinIdx(r);if(mp>=0&&r.ingredients[mp].unit==='g')st.meat.push(q[mp])}));
   });
  }
  const within=Math.round(st.dev.filter(x=>x<=0.07).length/st.dev.length*100);
  console.log((formula==='jeune'?'  Jeûne     ':'  Classique ')+'| jours à ±7 % : '+within+'% (pire '+Math.round(Math.max(...st.dev)*100)+'%) | moyenne '+avg(st.day)+' kcal, '+avg(st.prot)+' g de protéines');
  console.log('              | matin '+avg(st.bk)+' kcal · midi '+avg(st.lu)+' kcal ('+rng(st.lu)+') · soir '+avg(st.di)+' kcal ('+rng(st.di)+') · à-côtés '+avg(st.ex)+' kcal en '+(st.nex.reduce((a,b)=>a+b,0)/st.nex.length).toFixed(1)+' éléments');
  console.log('              | féculent cuit par assiette '+rng(st.starch)+' g (médiane '+Math.round(st.starch.sort((a,b)=>a-b)[st.starch.length>>1])+') · viande principale '+rng(st.meat)+' g (médiane '+Math.round(st.meat.sort((a,b)=>a-b)[st.meat.length>>1])+')');
 }
}`);

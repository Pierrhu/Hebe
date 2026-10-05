// Foyer réel : Pierre sans restriction + une femme intolérante au lactose et au gluten (toutes combinaisons).
const L=require('./charger.js');
L(['data/ingredients.js','data/recipes.js','data/household.js','data/calculator.js','data/user.js','data/log.js','data/prefs.js','js/adapt.js','js/staples.js','js/diet.js','js/utils.js','js/optimizer.js','js/micros.js','js/weekgen.js'],`
const OUT_L=['fromage_blanc','fromage_frais','carre_frais','whey'], OUT_G1=['chapelure','gnocchis'], OUT_G2=['flocons','granola','cornflakes'];
function run(lab, her, weeks=20){
  setMemberCount(2);
  updateMember('m1',{name:'Pierre',sex:'male',age:31,height:1.79,weight:78.5,bodyfat:30,activity:3,protocol:'P3',phase:0,free:[],formula:'jeune',breakfast:'mix',whey:true,lactose:0,gluten:0});
  updateMember('m2',Object.assign({name:'Elle',sex:'female',age:30,height:1.65,weight:60,bodyfat:28,activity:2,protocol:'P2',phase:0,free:[],formula:'classique',breakfast:'mix',whey:true},her));
  const FOY=getMembers().map(m=>{setActiveMember(m.id);return {id:m.id,targets:getTargets(),free:[],formula:m.formula,breakfast:m.breakfast,whey:m.whey}});setActiveMember('m1');
  const st=[[],[]], bad=new Set(), seen={mains:new Set(),bk:new Set(),snk:new Set()}; let prot=[];
  for(let w=0;w<weeks;w++){const {entriesBy,dates}=generateWeek({members:FOY,nextWeek:true});
    dates.forEach(d=>FOY.forEach((m,mi)=>{const e=entriesBy[m.id][d];const k=computeDayMacros(e);st[mi].push(Math.abs(k.kcal-m.targets.kcal)/m.targets.kcal);
      if(mi===1){prot.push(k.protein);
        (e.meals.lunch||[]).concat(e.meals.dinner||[]).forEach(it=>{if(!['L01','X01','C01'].includes(it.id))seen.mains.add(it.id)});
        (e.meals.breakfast||[]).forEach(it=>seen.bk.add(it.id));(e.meals.sweet||[]).forEach(it=>seen.snk.add(it.id));
        Object.values(e.meals).flat().forEach(it=>{const r=getById(it.id);if(!r||!r._dietBase)return;const b=r._dietBase.ings.map(i=>i.key);
          if((her.lactose||0)>=1&&b.some(x=>OUT_L.includes(x)))bad.add(r.id);
          if((her.gluten||0)>=1&&b.some(x=>OUT_G1.includes(x)))bad.add(r.id);
          if((her.gluten||0)>=2&&b.some(x=>OUT_G2.includes(x)))bad.add(r.id);});}
    }));}
  const pct=a=>Math.round(a.filter(x=>x<=0.07).length/a.length*100)+'%';
  console.log(lab.padEnd(44),'| Pierre',pct(st[0]),'| elle',pct(st[1]),'('+FOY[1].targets.kcal+' kcal, prot moy',Math.round(prot.reduce((a,b)=>a+b)/prot.length)+'/'+FOY[1].targets.protein+' g) | variété plats',seen.mains.size,'petits-déj',seen.bk.size,'collations',seen.snk.size,'| interdits servis',bad.size?[...bad].join(' '):'0');
}
run('Elle : lactose intol., gluten sensib., classique',{lactose:1,gluten:1});
run('Elle : lactose strict, gluten strict, classique',{lactose:2,gluten:2});
run('Elle : lactose strict, gluten strict, jeûne',{lactose:2,gluten:2,formula:'jeune'});
run('Elle : lactose strict, gluten sensib., classique',{lactose:2,gluten:1});
run('Elle : lactose intol., gluten strict, classique',{lactose:1,gluten:2});
run('Elle stricte, déficit, petit gabarit (52 kg)',{lactose:2,gluten:2,weight:52,height:1.58,protocol:'P3'});
run('Elle stricte, prise de muscle',{lactose:2,gluten:2,protocol:'P1'});
`);

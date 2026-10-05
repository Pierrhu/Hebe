// Régime sans lactose : recettes écartées, remplacements, précision, foyer mixte.
const L=require('./charger.js');
L(['data/ingredients.js','data/recipes.js','data/household.js','data/calculator.js','data/user.js','data/log.js','data/prefs.js','js/adapt.js','js/staples.js','js/diet.js','js/utils.js','js/optimizer.js','js/micros.js','js/weekgen.js'],`
const OUT=['fromage_blanc','fromage_frais','carre_frais','whey'], SUBST=['yaourt_grec','lait','creme'], STRICT=['cheddar','feta'];
function run(label, levels, weeks=25){
  setMemberCount(levels.length);
  levels.forEach((lac,i)=>updateMember('m'+(i+1),{name:'P'+(i+1),sex:i?'female':'male',age:30,height:i?1.65:1.82,weight:i?62:85,bodyfat:i?27:20,activity:2,protocol:'P4',phase:0,free:[],formula:'classique',breakfast:'mix',whey:true,lactose:lac}));
  const FOY=getMembers().map(m=>{setActiveMember(m.id);return {id:m.id,targets:getTargets(),free:[],formula:'classique',breakfast:'mix',whey:true}});setActiveMember('m1');
  const st=FOY.map(()=>[]), bad=FOY.map(()=>new Set()), seenFB=FOY.map(()=>0);
  for(let w=0;w<weeks;w++){
    const {entriesBy,dates}=generateWeek({members:FOY,nextWeek:true});
    dates.forEach(d=>FOY.forEach((m,mi)=>{
      const e=entriesBy[m.id][d]; st[mi].push(Math.abs(computeDayMacros(e).kcal-m.targets.kcal)/m.targets.kcal);
      Object.values(e.meals).flat().forEach(it=>{const r=getById(it.id); if(!r)return;
        const keys=r.ingredients.map(i=>i.key);
        if(r._dietBase && r._dietBase.ings.some(i=>OUT.includes(i.key))) { if(levels[mi]>=1) bad[mi].add(r.id+'(exclue)'); else seenFB[mi]++; }
        if(levels.some(l=>l>=1)) keys.filter(k=>SUBST.includes(k)).forEach(k=>bad[mi].add(r.id+':'+k));
        if(Math.max(...levels)>=2) keys.filter(k=>STRICT.includes(k)).forEach(k=>bad[mi].add(r.id+':'+k));
      });
    }));
  }
  const pct=a=>Math.round(a.filter(x=>x<=0.07).length/a.length*100)+'%';
  FOY.forEach((m,mi)=>console.log(label.padEnd(26), 'P'+(mi+1),'lactose',levels[mi],'| jours ±7 %',pct(st[mi]),'| problèmes',[...bad[mi]].slice(0,6).join(' ')||'aucun', levels[mi]===0?'| recettes au fromage blanc ou whey servies : '+seenFB[mi]:''));
}
run('Seul, strict',[2]);
run('Seul, intolérance',[1]);
run('Foyer : lui sans souci, elle stricte',[0,2]);
run('Seul, sans restriction',[0],10);
const W10=getById('W10'), B06=getById('B06'), W14=getById('W14'), W04=getById('W04');
console.log('Exemples (dernier régime appliqué = sans restriction) :', W04.ingredients.find(i=>/yaourt/.test(i.key)).key);
updateMember('m1',{lactose:2}); applyEquipment(); applyDiet();
console.log('Strict →', W04.name,'|', W04.ingredients.find(i=>/yaourt/.test(i.key)).name,'|', W14.ingredients.find(i=>/creme/.test(i.key)).name, '|', B06.name,'|', getById('W10').ingredients.filter(i=>i.key==='emmental').length?'cheddar→emmental':'?');
console.log('Étape butter chicken :', W14.steps.find(s=>/crème/.test(s)));
console.log('Étape muffins :', B06.steps.find(s=>/emmental|feta/.test(s)).slice(0,140));
`);

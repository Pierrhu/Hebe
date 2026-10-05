// Régime sans gluten (et cumul avec le sans lactose) : recettes écartées, remplacements, précision.
const L=require('./charger.js');
L(['data/ingredients.js','data/recipes.js','data/household.js','data/calculator.js','data/user.js','data/log.js','data/prefs.js','js/adapt.js','js/staples.js','js/diet.js','js/utils.js','js/optimizer.js','js/micros.js','js/weekgen.js'],`
const SUBK=['semoule','boulghour','pates','nouilles_oeufs','pain','baguette','pain_burger','pita','tortilla','oignons_frits'];
const OUT1=['chapelure','gnocchis'], OUT2=['flocons','granola','cornflakes'];
function run(label, glu, lac=[], weeks=25){
  setMemberCount(glu.length);
  glu.forEach((g,i)=>updateMember('m'+(i+1),{name:'P'+(i+1),sex:i?'female':'male',age:30,height:i?1.65:1.82,weight:i?62:85,bodyfat:i?27:20,activity:2,protocol:'P4',phase:0,free:[],formula:'classique',breakfast:'mix',whey:true,gluten:g,lactose:lac[i]||0}));
  const FOY=getMembers().map(m=>{setActiveMember(m.id);return {id:m.id,targets:getTargets(),free:[],formula:'classique',breakfast:'mix',whey:true}});setActiveMember('m1');
  const st=FOY.map(()=>[]), bad=FOY.map(()=>new Set());
  for(let w=0;w<weeks;w++){
    const {entriesBy,dates}=generateWeek({members:FOY,nextWeek:true});
    dates.forEach(d=>FOY.forEach((m,mi)=>{
      const e=entriesBy[m.id][d]; st[mi].push(Math.abs(computeDayMacros(e).kcal-m.targets.kcal)/m.targets.kcal);
      Object.values(e.meals).flat().forEach(it=>{const r=getById(it.id); if(!r||!r._dietBase)return;
        const base=r._dietBase.ings.map(i=>i.key), keys=r.ingredients.map(i=>i.key);
        if(glu[mi]>=1 && base.some(k=>OUT1.includes(k))) bad[mi].add(r.id+'(exclue)');
        if(glu[mi]>=2 && base.some(k=>OUT2.includes(k))) bad[mi].add(r.id+'(exclue strict)');
        if(Math.max(...glu)>=1) keys.filter(k=>SUBK.includes(k)).forEach(k=>bad[mi].add(r.id+':'+k));
        if(Math.max(...glu)>=2 && keys.includes('soja')) bad[mi].add(r.id+':soja');
        if((lac[mi]||0)>=1 && r.lacOut) bad[mi].add(r.id+'(lactose)');
      });
    }));
  }
  const pct=a=>Math.round(a.filter(x=>x<=0.07).length/a.length*100)+'%';
  FOY.forEach((m,mi)=>console.log(label.padEnd(30),'P'+(mi+1),'gluten',glu[mi],'lactose',lac[mi]||0,'| jours ±7 %',pct(st[mi]),'| problèmes',[...bad[mi]].slice(0,6).join(' ')||'aucun'));
}
run('Seul, gluten sensibilité',[1]);
run('Seul, gluten strict',[2]);
run('Foyer : lui sans, elle stricte',[0,2]);
run('Seul, gluten + lactose stricts',[2],[2]);
updateMember('m1',{gluten:1,lactose:0}); setMemberCount(1); applyEquipment(); applyDiet();
['W07','W05','W40','W33','W18','W35','W43','W04','W16','W13'].forEach(id=>{const r=getById(id);console.log('\\n'+id,'—',r.name,'|',r.ingredients.map(i=>i.name).filter(n=>/riz|sans gluten|tamari|soja|oignons/i.test(n)).join(', '));
  r.steps.filter(s=>/riz|sans gluten|wrap|tamari|oignons frits/i.test(s)).slice(0,2).forEach(s=>console.log('   ·',s.slice(0,170)))});
`);

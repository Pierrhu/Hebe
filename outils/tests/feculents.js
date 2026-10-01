const L=require('./charger.js');
L(['data/ingredients.js','data/recipes.js','data/calculator.js','data/user.js','data/log.js','data/prefs.js','js/utils.js','js/optimizer.js','js/weekgen.js'],`
const KEYS=Object.keys(INGREDIENTS).filter(k=>INGREDIENTS[k].minP);
function mainIdx(r){let m=r.ingredients.findIndex(i=>i.key==='riz');if(m<0){let b=0;r.ingredients.forEach((g,i)=>{if(INGREDIENTS[g.key].minP&&g.kcal>b){b=g.kcal;m=i}})}return m}
function chk(T,label){const g={},under=[],nonInt=[];let ok=0,n=0,worst=0,sn=0;
 for(let w=0;w<30;w++){const {entries,dates}=generateWeek({targets:T});dates.forEach(d=>{const e=entries[d];const kc=computeDayMacros(e).kcal;n++;const dv=Math.abs(kc-T.kcal)/T.kcal;worst=Math.max(worst,dv);if(dv<=0.07)ok++;
  sn+=e.meals.sweet.length+e.meals.sides.filter(s=>!s.with).length;
  ['lunch','dinner'].forEach(m=>e.meals[m].forEach(it=>{const r=getById(it.id);if(!r||(r.tags||[]).includes('cantine'))return;const q=itemQuantities(it);const mi=mainIdx(r);
   r.ingredients.forEach((ing,i)=>{if(!KEYS.includes(ing.key))return;(g[ing.key]=g[ing.key]||[]).push(q[i]);
    if(i===mi&&q[i]<INGREDIENTS[ing.key].minP)under.push(r.id+':'+ing.key+' '+q[i]);
    const nu=NATURAL_UNITS[ing.key];if(nu&&Math.abs(q[i]/nu.g-Math.round(q[i]/nu.g))>0.01)nonInt.push(r.id+':'+q[i])})}))})}
 console.log('==',label,'| jours ±7 %',Math.round(ok/n*100)+'% | pire',Math.round(worst*100)+'% | collations+compl./jour',(sn/n).toFixed(1),'| féculent principal sous le minimum :',under.length?[...new Set(under)].slice(0,5).join(', '):'aucun','| wraps/pitas non entiers :',nonInt.length);
 console.log('   ',Object.entries(g).map(([k,v])=>k+' '+(NATURAL_UNITS[k]?humanQty(k,Math.min(...v),'g')+'-'+humanQty(k,Math.max(...v),'g'):Math.min(...v)+'-'+Math.max(...v))).join(' · '));}
chk(getTargets(),'Toi 2853');chk({kcal:2300,protein:140,carbs:260,fat:75},'Profil 2300');chk({kcal:1800,protein:110,carbs:190,fat:60},'Profil 1800');`);

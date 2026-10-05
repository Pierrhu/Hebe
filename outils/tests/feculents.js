const L=require('./charger.js');
L(['data/ingredients.js','data/recipes.js','data/household.js','data/calculator.js','data/user.js','data/log.js','data/prefs.js','js/adapt.js','js/staples.js','js/diet.js','js/utils.js','js/optimizer.js','js/micros.js','js/weekgen.js'],`
const KEYS=Object.keys(INGREDIENTS).filter(k=>INGREDIENTS[k].minP);
function mainIdx(r){let m=r.ingredients.findIndex(i=>i.key==='riz');if(m<0){let b=0;r.ingredients.forEach((g,i)=>{if(INGREDIENTS[g.key].minP&&g.kcal>b){b=g.kcal;m=i}})}return m}
function chk(T,label){const sc=portionScale(plateTarget(T).kcal);const minOf=k=>{const nu=NATURAL_UNITS[k],v=INGREDIENTS[k].minP;return sc>=1?v:nu?Math.max(nu.g,Math.ceil(v*sc/nu.g-1e-9)*nu.g):Math.ceil(v*sc/(v>=200?25:10)-1e-9)*(v>=200?25:10)};const g={},under=[],nonInt=[];let ok=0,n=0,worst=0,sn=0;
 for(let w=0;w<30;w++){const {entries,dates}=generateWeek({targets:T});dates.forEach(d=>{const e=entries[d];const kc=computeDayMacros(e).kcal;n++;const dv=Math.abs(kc-T.kcal)/T.kcal;worst=Math.max(worst,dv);if(dv<=0.07)ok++;
  sn+=e.meals.sweet.length+e.meals.sides.filter(s=>!s.with).length;
  ['lunch','dinner'].forEach(m=>e.meals[m].forEach(it=>{const r=getById(it.id);if(!r||(r.tags||[]).includes('cantine'))return;const q=itemQuantities(it);const mi=mainIdx(r);
   r.ingredients.forEach((ing,i)=>{if(!KEYS.includes(ing.key))return;(g[ing.key]=g[ing.key]||[]).push(q[i]);
    if(i===mi&&q[i]<minOf(ing.key)-0.5)under.push(r.id+':'+ing.key+' '+q[i]);
    const nu=NATURAL_UNITS[ing.key];if(nu&&Math.abs(q[i]/nu.g-Math.round(q[i]/nu.g))>0.01)nonInt.push(r.id+':'+q[i])})}))})}
 console.log('==',label,'| minimums ×'+sc.toFixed(2),'| jours ±7 %',Math.round(ok/n*100)+'% | pire',Math.round(worst*100)+'% | collations+compl./jour',(sn/n).toFixed(1),'| féculent principal sous le minimum :',under.length?[...new Set(under)].slice(0,5).join(', '):'aucun','| wraps/pitas non entiers :',nonInt.length);
 console.log('   ',Object.entries(g).map(([k,v])=>k+' '+(NATURAL_UNITS[k]?humanQty(k,Math.min(...v),'g')+'-'+humanQty(k,Math.max(...v),'g'):Math.min(...v)+'-'+Math.max(...v))).join(' · '));}
updateActiveMember({sex:'male',age:24,height:1.85,weight:97,bodyfat:20,activity:2,protocol:'P4',phase:0});chk(getTargets(),'Toi '+getTargets().kcal);chk({kcal:2300,protein:140,carbs:260,fat:75},'Profil 2300');chk({kcal:1800,protein:110,carbs:190,fat:60},'Profil 1800');chk({kcal:1642,protein:91,carbs:166,fat:54},'Femme 1642');chk({kcal:1253,protein:72,carbs:121,fat:42},'Petit gabarit 1253');`);

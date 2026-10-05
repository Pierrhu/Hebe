// Laitages en pots entiers (v189) : part de ce qui est acheté qui est vraiment consommé.
// Lancer : node outils/tests/laitages_pots.js
const L=require('./charger.js');
L(['data/ingredients.js','data/recipes.js','data/household.js','data/calculator.js','data/user.js','data/log.js','data/prefs.js','js/adapt.js','js/staples.js','js/diet.js','js/utils.js','js/micros.js','js/optimizer.js','js/weekgen.js'],`
const KEYS=['fromage_blanc','yaourt_grec','cottage'];
for (const [nom,P] of [['Toi',{sex:'male',age:24,height:1.85,weight:97,bodyfat:20,activity:2,protocol:'P4',phase:0}],['Femme',{sex:'female',age:24,height:1.65,weight:60,bodyfat:27,activity:2,protocol:'P2',phase:0}]]) {
 updateActiveMember({...P,formula:'classique'});const MB=[{id:getActiveMember().id,targets:getTargets(),free:[],formula:'classique',breakfast:'mix',whey:true}];
 const W=40;const st={};KEYS.forEach(k=>st[k]={weeks:0,used:0,bought:0,left:[],bad:0});
 for(let w=0;w<W;w++){const res=generateWeek({members:MB});const E=res.entriesBy[MB[0].id];const tot={};
  res.dates.forEach(d=>Object.values(E[d].meals).forEach(a=>(a||[]).forEach(it=>{const r=getById(it.id);if(!r)return;const qs=itemQuantities(it);r.ingredients.forEach((i,ix)=>{if(KEYS.includes(i.key))tot[i.key]=(tot[i.key]||0)+qs[ix];});})));
  KEYS.forEach(k=>{const t=tot[k]||0;if(!t)return;const pack=INGREDIENTS[k].pack;const n=Math.ceil(t/pack);const left=n*pack-t;const S=st[k];S.weeks++;S.used+=t;S.bought+=n*pack;S.left.push(Math.round(left));if(left>pack*0.25)S.bad++;});}
 KEYS.forEach(k=>{const S=st[k];if(!S.weeks)return;const L=S.left.sort((a,b)=>a-b);console.log(nom+' | '+k+' : présent '+S.weeks+'/'+W+' sem. | utilisé '+Math.round(S.used/S.bought*100)+'% de ce qui est acheté | reste dans le dernier pot : médiane '+L[Math.floor(L.length/2)]+' g, max '+L[L.length-1]+' g | semaines avec plus d\\'un quart de pot perdu : '+S.bad);});}`);

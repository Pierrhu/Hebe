// Produits frais : part de ce qui est acheté qui est consommé dans la semaine (v190).
// Lancer : node outils/tests/frais.js [semaines] [2 pour un foyer de deux]
const L=require('./charger.js');
const N=+(process.argv[2]||100), DUO=process.argv[3]==='2';
L(['data/ingredients.js','data/recipes.js','data/household.js','data/calculator.js','data/user.js','data/log.js','data/prefs.js','js/adapt.js','js/staples.js','js/diet.js','js/utils.js','js/micros.js','js/optimizer.js','js/weekgen.js'],`
// conditionnement réel des produits frais (g ou ml, pièce pour les œufs) : ce qu'on achète d'un coup
const UNIT={ poulet:500, poulet_hache:350, boeuf:500, saumon:250, haut_cuisse:500, boeuf_emince:500, tofu:200, poulet_tranches:160, jambon_blanc:160,
 fromage_blanc:1000, yaourt_grec:500, cottage:200, fromage_frais:150, carre_frais:200, feta:200, creme:200, houmous:200, lait:1000, yaourt_sl:500,
 tortilla:360, pita:420, pain_burger:280, baguette:250, pain:500, gnocchis:500,
 concombre:350, avocat:170, poivron:180, courgette:250, aubergine:300, salade:250, herbes:30, tomates_cerise:250, champignons:250, chou_chinois:800,
 pois_chiches:265, haricots_rouges:250, haricots_blancs:250, tomates_conc:400, lait_coco:400, mais:140, thon:140, creme_coco:200 };
// (chou chinois retiré des recettes en v190)
setMemberCount(${DUO?2:1});
updateMember('m1',{name:'Pierre',sex:'male',age:24,height:1.85,weight:97,bodyfat:20,activity:2,protocol:'P4',phase:0,free:[],formula:'classique',breakfast:'mix',whey:true,lactose:0,gluten:0});
${DUO?"updateMember('m2',{name:'Léa',sex:'female',age:24,height:1.65,weight:60,bodyfat:27,activity:2,protocol:'P2',phase:0,free:[],formula:'classique',breakfast:'mix',whey:true,lactose:0,gluten:0});":""}
const MB=getMembers().map(m=>{setActiveMember(m.id);return {id:m.id,targets:getTargets(),free:[],formula:m.formula,breakfast:m.breakfast,whey:m.whey}});setActiveMember('m1');
const st={};
for(let w=0;w<${N};w++){const res=generateWeek({members:MB});const tot={};
 MB.forEach(m=>{const E=res.entriesBy[m.id];res.dates.forEach(d=>Object.values(E[d].meals).forEach(a=>(a||[]).forEach(it=>{const r=getById(it.id);if(!r)return;const qs=itemQuantities(it);r.ingredients.forEach((i,ix)=>{if(UNIT[i.key])tot[i.key]=(tot[i.key]||0)+qs[ix];});})));});
 Object.entries(tot).forEach(([k,t])=>{if(t<0.5)return;const u=UNIT[k];const n=Math.ceil(t/u-1e-6);const left=n*u-t;const S=(st[k]=st[k]||{w:0,used:0,bought:0,bad:0,maxLeft:0});S.w++;S.used+=t;S.bought+=n*u;if(left>u*0.15)S.bad++;S.maxLeft=Math.max(S.maxLeft,left);});}
const rows=Object.entries(st).map(([k,S])=>[k,S.w,Math.round(S.used/S.bought*100),S.bad,Math.round(S.maxLeft)]).sort((a,b)=>a[2]-b[2]);
let wb=0,wt=0;rows.forEach(r=>{wb+=st[r[0]].bought-st[r[0]].used;});
console.log((${DUO}?'Foyer de 2':'1 personne')+' | ${N} semaines | produit : semaines présentes, % consommé, semaines avec >15 % d\\'un paquet perdu, pire reste');
const KEEP=['carre_frais','tortilla','pita','pain_burger','pain','baguette','lait_coco','feta']; // se gardent 2 semaines (ou au congélateur) : reste reporté
rows.filter(r=>!KEEP.includes(r[0])).forEach(r=>console.log('  '+r[0].padEnd(16)+String(r[1]).padStart(4)+' sem | '+String(r[2]).padStart(3)+' % | perte '+String(r[3]).padStart(3)+' sem | pire '+r[4]));
console.log('  — se gardent 2 semaines (reste reporté à la semaine suivante, pas perdu) :');
rows.filter(r=>KEEP.includes(r[0])).forEach(r=>console.log('  '+r[0].padEnd(16)+String(r[1]).padStart(4)+' sem | '+String(r[2]).padStart(3)+' % utilisé dans la semaine'));`);

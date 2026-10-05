// build.js — concatène les modules en js/app.js (sans imports/exports) pour usage sans serveur
const fs=require('fs'),path=require('path');
const BASE=__dirname;
const FILES=['data/migrate.js','data/ingredients.js','data/recipes.js','data/household.js','data/calculator.js','data/user.js','data/log.js','data/prefs.js','data/photos.js','js/adapt.js','js/staples.js','js/diet.js','js/utils.js','js/optimizer.js','js/micros.js','js/weekgen.js','js/state.js','js/nav.js','js/recipeDetail.js','js/week.js','js/cook.js','js/recipes.js','js/shopping.js','js/bodyfat.js','js/profileUi.js','js/settings.js','js/welcome.js','js/main.js'];
function strip(code){
  const lines=code.split('\n'); const out=[]; let inImport=false;
  for(const line of lines){
    const t=line.trimStart();
    if(!inImport && t.startsWith('import ')){
      if(/from\s+['"].*['"];?\s*$/.test(t)||t.endsWith(';')) continue;
      inImport=true; continue;
    }
    if(inImport){ if(/from\s+['"].*['"];?\s*$/.test(t)||t.endsWith(';')) inImport=false; continue; }
    out.push(line);
  }
  return out.join('\n').replace(/^export default /gm,'').replace(/^export function /gm,'function ').replace(/^export const /gm,'const ').replace(/^export \{[^}]*\};?\s*$/gm,'');
}
let b=`// DIET — bundled app (généré par build.js)\n// ${new Date().toISOString()}\n\n`;
FILES.forEach(s=>{b+=`\n// ${'─'.repeat(46)}\n// ${s}\n// ${'─'.repeat(46)}\n`+strip(fs.readFileSync(path.join(BASE,s),'utf8'))+'\n';});
fs.writeFileSync(path.join(BASE,'js/app.js'),b);
console.log('Bundle:', b.split('\n').length,'lines');

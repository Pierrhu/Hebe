global.localStorage={_d:{},getItem(k){return this._d[k]??null},setItem(k,v){this._d[k]=String(v)},removeItem(k){delete this._d[k]}};
const fs=require('fs');
const path=require('path');
const RACINE=path.join(__dirname,'..','..');
module.exports=function(files,extra=''){let code=files.map(f=>fs.readFileSync(path.join(RACINE,f),'utf8')).join('\n');
code=code.split('\n').filter(l=>!/^\s*import\s/.test(l)||false).join('\n');
// handle multi-line imports crudely
code=code.replace(/^import \{[^}]*\} from [^;]*;/gms,'');
code=code.replace(/^export (default )?/gm,'').replace(/^export \{[^}]*\};?$/gm,'');
return eval(code+'\n'+extra);}

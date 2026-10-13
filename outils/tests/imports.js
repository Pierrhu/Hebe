// v277 : chaque nom importé d'un module existe bien dans ce module (data/recipes.js est régénéré par
// outils/recettes/generer.js : une fonction ajoutée à la main dans recipes.js disparaît à la régénération).
// Lancer : node outils/tests/imports.js
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..', '..');
const files = ['js', 'data'].flatMap(d => fs.readdirSync(path.join(R, d)).filter(f => f.endsWith('.js') && f !== 'app.js').map(f => path.join(d, f)));
const exportsOf = f => {
  const s = fs.readFileSync(path.join(R, f), 'utf8');
  const out = new Set([...s.matchAll(/^export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+(\w+)/gm)].map(m => m[1]));
  [...s.matchAll(/^export\s*\{([^}]*)\}/gm)].forEach(m => m[1].split(',').forEach(x => { const n = x.trim().split(/\s+as\s+/).pop(); if (n) out.add(n); }));
  return out;
};
let fails = 0;
files.forEach(f => {
  const s = fs.readFileSync(path.join(R, f), 'utf8');
  for (const m of s.matchAll(/import\s*\{([^}]*)\}\s*from\s*'([^']+)'/g)) {
    const target = path.normalize(path.join(path.dirname(f), m[2]));
    if (!fs.existsSync(path.join(R, target))) { console.log(`${f} : module introuvable ${m[2]}`); fails++; continue; }
    const ex = exportsOf(target);
    m[1].split(',').map(x => x.trim().split(/\s+as\s+/)[0]).filter(Boolean).forEach(n => { if (!ex.has(n)) { console.log(`${f} : « ${n} » n'existe pas dans ${target}`); fails++; } });
  }
});
console.log(fails ? `${fails} import(s) cassé(s)` : 'Tous les imports existent');
process.exit(fails ? 1 : 0);

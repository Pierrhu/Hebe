// construire.js — v299 : rassemble les recettes structurées pour la session de cuisine
// (outils/recettes/session/lot_*.json, une entrée { id, cuts, steps } par recette) dans data/sessionSteps.js.
// Usage : node outils/recettes/session/construire.js
const fs = require('fs'), path = require('path');
const dir = __dirname;
const all = {};
fs.readdirSync(dir).filter(f => /^lot_\d+\.json$/.test(f)).sort().forEach(f => {
  JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).forEach(o => {
    all[o.id] = { cuts: o.cuts, steps: o.steps.map(s => { const x = { text: s.text, kind: s.kind, app: s.app ?? null, min: s.min, wait: s.wait }; if (s.after) x.after = s.after; return x; }) };
  });
});
const out = `// sessionSteps.js — GÉNÉRÉ par outils/recettes/session/construire.js, ne pas modifier à la main.\n` +
  `// Pour chaque recette cuisinée pendant la session : ses découpes (cuts : ingrédient, verbe, forme) et ses étapes\n` +
  `// (steps : texte, prep/cook, appareil, minutes de gestes, minutes où ça cuit tout seul, dépendances).\n` +
  `export const SESSION_STEPS = {\n${Object.entries(all).map(([k, v]) => `  ${k}: ${JSON.stringify(v)},`).join('\n')}\n};\n`;
fs.writeFileSync(path.join(dir, '../../../data/sessionSteps.js'), out);
console.log(Object.keys(all).length, 'recettes');

// fusion.js — v309 : assaisonnement des recettes en cuillères à café.
// Source : outils/recettes/epices/epices.json, une entrée par recette :
//   { id, spices: { épice: c. à café par portion (laurier : feuilles) }, steps: { index: texte }, session: { index: texte }, note }
// Écrit le bloc généré de data/ingredients.js (SPICE_QTY, SPICE_STEPS). Les étapes de session sont appliquées par
// outils/recettes/session/construire.js. Usage : node outils/recettes/epices/fusion.js
const fs = require('fs'), path = require('path');
const RACINE = path.join(__dirname, '..', '..', '..');
const all = JSON.parse(fs.readFileSync(path.join(__dirname, 'epices.json'), 'utf8'));
const q = {}, st = {};
all.forEach(o => {
  if (o.spices && Object.keys(o.spices).length) q[o.id] = o.spices;
  if (o.steps && Object.keys(o.steps).length) st[o.id] = o.steps;
});
const block = `// <<épices générées\nexport const SPICE_QTY = {\n${Object.entries(q).map(([k, v]) => `  ${k}: ${JSON.stringify(v)},`).join('\n')}\n};\n` +
  `export const SPICE_STEPS = {\n${Object.entries(st).map(([k, v]) => `  ${k}: ${JSON.stringify(v)},`).join('\n')}\n};\n// >>épices générées`;
const p = path.join(RACINE, 'data', 'ingredients.js');
const src = fs.readFileSync(p, 'utf8');
const out = src.replace(/\/\/ <<épices générées[\s\S]*?\/\/ >>épices générées/, block);
if (out === src && !src.includes(block)) throw new Error('bloc introuvable');
fs.writeFileSync(p, out);
console.log(Object.keys(q).length, 'recettes assaisonnées,', Object.keys(st).length, 'avec des étapes réécrites');

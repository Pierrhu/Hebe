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
// v309 : étapes de session réécrites avec les repères d'épices [[épice]] (outils/recettes/epices/epices.json)
const EP = path.join(dir, '..', 'epices', 'epices.json');
if (fs.existsSync(EP)) JSON.parse(fs.readFileSync(EP, 'utf8')).forEach(o => {
  if (!all[o.id] || !o.session) return;
  Object.entries(o.session).forEach(([i, t]) => { if (all[o.id].steps[+i]) all[o.id].steps[+i].text = t; });
});
// v310 : quantités écrites pour une portion : « par portion » (multipliées dans la session)
const PER_PORTION = { W20: ['15 ml de sauce soja'], W49: ["5 ml d'huile"], W50: ["5 ml d'huile"], W65: ["5 ml d'huile"], W66: ["5 ml d'huile"], W35: ['30 g de yaourt grec'], W43: ['30 g de yaourt'] };
Object.entries(PER_PORTION).forEach(([id, qs]) => all[id] && all[id].steps.forEach(s => qs.forEach(q => { if (s.text.includes(q) && !s.text.includes(q + ' par portion')) s.text = s.text.replace(q, q + ' par portion'); })));
const out = `// sessionSteps.js — GÉNÉRÉ par outils/recettes/session/construire.js, ne pas modifier à la main.\n` +
  `// Pour chaque recette cuisinée pendant la session : ses découpes (cuts : ingrédient, verbe, forme) et ses étapes\n` +
  `// (steps : texte, prep/cook, appareil, minutes de gestes, minutes où ça cuit tout seul, dépendances).\n` +
  `export const SESSION_STEPS = {\n${Object.entries(all).map(([k, v]) => `  ${k}: ${JSON.stringify(v)},`).join('\n')}\n};\n`;
fs.writeFileSync(path.join(dir, '../../../data/sessionSteps.js'), out);
console.log(Object.keys(all).length, 'recettes');

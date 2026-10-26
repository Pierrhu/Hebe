// session.js — v297 : ordre réel de la session de cuisine.
//
// Retour de Pierre après sa première semaine : on attendait pendant les cuissons alors qu'on aurait pu
// découper. Chaque recette est donc découpée en actions :
//   - « prep » : découper, éplucher, mariner, préparer une sauce (les mains seulement) ;
//   - « cook » : une cuisson sur un appareil (poêle, autocuiseur, air fryer, four, casserole, cocotte).
//     Une cuisson « passive » (sous pression, à l'air fryer, laisse mijoter) occupe l'appareil, pas les mains.
// Dans un plat, toutes les préparations passent avant ses cuissons (mise en place).
// Puis un petit planificateur simule la session minute par minute, avec une paire de mains et un seul
// exemplaire de chaque appareil : on lance d'abord ce qui cuit longtemps tout seul, on fait toutes les
// découpes pendant ce temps, puis les cuissons actives, et le riz quand l'autocuiseur est libre pour de bon.
// Un plat garde son appareil du premier au dernier usage (« dans la même poêle »).

import { SESSION_STEPS } from '../data/sessionSteps.js';
import { PIECES, INGREDIENTS } from '../data/ingredients.js';

const SS_HEAT = /poêle|autocuiseur|air fryer|\bfour\b|casserole|cocotte|\bfeu\b|dorer|revenir|fais sauter|saisis|cuire|cuisson|mijoter|bouillir|ébullition|pression|chauffe|fondre|micro-ondes|enfourne|grille|rôti|°C/i;
const SS_CUT = /^(Coupe|Émince|Hache|Épluche|Râpe|Taille|Détaille|Lave|Pèle|Retire la peau|Égoutte et rince|Égoutte les (pois|haricots|lentilles|tomates|olives|cornichons|poivrons)|Rince et égoutte|Presse|Écrase l'ail|Zeste|Effeuille|Cisèle|Épépine|Ouvre|Sors|Prépare la (sauce|marinade|garniture|pâte)|Mélange .*(marinade|épices|sauce)|Laisse mariner|Fouette les œufs)/i;
const SS_COOKED = /\bcuit|cuite|refroidi|tiède|tiédi|effiloch|la cuisson|égoutte les pâtes|une fois|vérifier|plus (être )?rose|^Au moment de manger/i;
// après la première cuisson d'un plat, seule une vraie découpe peut encore remonter dans la mise en place
const SS_CUT_STRICT = /^(Coupe|Émince|Hache|Épluche|Râpe|Taille|Détaille|Pèle|Retire la peau|Zeste|Cisèle|Épépine|Lave|Concasse|Rince et égoutte|Égoutte et rince|Prépare la sauce|Prépare le concombre)/i;
// objet d'une phrase de découpe : « Épluche les pommes de terre et… » → « les pommes de terre »
const ssObj = s => (s.match(/^\S+\s+((?:l'|les |le |la )[^,.:]+?)(?= en | finement| et |,|\.|:|$)/i) || [])[1];
// produits déjà passés sur le feu : les découper ensuite, c'est après la cuisson
const SS_NOUNS = ['poulet', 'bœuf', 'boeuf', 'pommes de terre', 'patate', 'pâtes', 'riz', 'boulgour', 'saumon', 'crevettes', 'courge', 'potimarron', 'aubergine', 'oignon', 'carotte', 'courgette', 'poivron', 'champignon', 'tofu', 'lentilles', 'pois chiches', 'haricots', 'brocoli', 'œuf', 'boulettes', 'köfte', 'raviolis', 'poisson', 'colin', 'betterave', 'poireau', 'chou'];
const SS_PASSIVE = /laisse (cuire|mijoter|reposer|refroidir|mariner|gonfler|tiédir|la pression|compoter)|sous pression|air fryer|au four|pression retomber|enfourne|de temps en temps|^couvre\b|dans de l'eau froide \d+/i;
// une phrase sans appareil nommé reste sur celui du plat seulement si elle y fait quelque chose
const SS_ON_SAME = /^(Ajoute|Remets|Verse|Incorpore|Réserve|Retire|Égoutte|Ouvre|Ferme|Mélange|Monte|Baisse|Arrête|Pousse|Délaye|Laisse|Fais|Dans la même)/i;

// « a, b et c »
const ssList = a => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} et ${a[a.length - 1]}`);
const ssCap = t => t.charAt(0).toUpperCase() + t.slice(1);
// Phrases d'une étape (on ne coupe pas « 1,5 » ni « 200 °C. »)
export function ssSentences(step) {
  return step.split(/(?<=[.!?])\s+(?=[A-ZÀ-ÖØ-Þ])/).map(s => s.trim()).filter(Boolean);
}
// Minutes d'une phrase : « 4 minutes par tournée » en deux fois = 8 ; plusieurs durées s'additionnent
// pour une cuisson passive (30 minutes sous pression puis 10 minutes de décompression)
function ssMinutes(s, passive) {
  const all = [];
  s.replace(/(toutes les |tous les )?(\d+)(?:\s*à\s*(\d+))?\s*(?:minutes|min)\b/g, (_, every, a, b) => { if (!every) all.push(+(b || a)); return _; });
  if (!all.length) return 0;
  let m = all.reduce((x, y) => x + y, 0); // étapes qui s'enchaînent : 3 minutes, puis 4 minutes
  if (/par tournée|en deux fois|par face/.test(s)) m *= 2;
  if (/sous pression/.test(s)) m += 5 + (/retomber|tomber la pression/.test(s) ? 0 : 8); // montée en pression, puis décompression
  return m;
}
function ssResource(s0) {
  const s = s0.replace(/sous une casserole/g, '');
  if (/autocuiseur|sous pression|la cuve|mode dorer|pression/i.test(s)) return 'autocuiseur';
  if (/air fryer|panier/i.test(s)) return 'airfryer';
  if (/\bfour\b|enfourne/i.test(s)) return 'four';
  if (/cocotte/i.test(s)) return 'cocotte';
  if (/casserole/i.test(s)) return 'casserole';
  if (/poêle|sauteuse/i.test(s)) return 'poele';
  if (/micro-ondes/i.test(s)) return 'micro';
  return null;
}
const SS_RES_NAME = { autocuiseur: "l'autocuiseur", airfryer: "l'air fryer", four: 'le four', cocotte: 'la cocotte', casserole: 'la casserole', poele: 'la poêle', micro: 'le micro-ondes' };

// « Coupe le poulet en dés et fais-le cuire 6 minutes à la poêle » : la découpe part dans la mise en place,
// la cuisson reste à sa place (« Fais cuire le poulet 6 minutes à la poêle »).
const SS_MIX_CUT = /^(?:(?:Pendant ce temps|Pendant la cuisson|En attendant),\s*)?(?:coupe|émince|hache|épluche|râpe|taille)\s+((?:l'|les |le |la )[^,]+?)(?= en | finement|,| et )/i;
const SS_MIX_AT = /,? (?:puis |et )?(?=(?:fais|mets)-(?:le|la|les)\b)/i;
export function ssSplitMixed(s) {
  const m = s.match(SS_MIX_CUT);
  if (!m || !SS_HEAT.test(s)) return [s];
  const at = s.search(SS_MIX_AT);
  if (at < 0) return [s];
  const cutPart = s.slice(0, at).replace(/,?\s*$/, '');
  if (SS_HEAT.test(cutPart)) return [s];
  const obj = m[1].trim();
  let rest = s.slice(at).replace(/^,?\s*(?:puis |et )?/, '');
  rest = rest.replace(/^fais-(?:les|la|le) (\S+)/i, (_, v) => `Fais ${v} ${obj}`).replace(/^mets-(?:les|la|le)\b/i, `Mets ${obj}`);
  return [ssCap(cutPart.replace(/^(?:Pendant ce temps|Pendant la cuisson|En attendant),\s*/i, '')) + '.', ssCap(rest)];
}

const SS_IMPLIED = /((?:l'|le |la |les )(?:oignons?|ail|poivrons?|carottes?|courgettes?|champignons?|tomates?|aubergines?|poireaux?|gingembre|persil|coriandre|ciboulette|menthe|concombre|pommes? de terre|patates? douces?|chou)(?: rouges?| verts?)?(?: et (?:l'|le |la |les )\S+)?) ?(en (?:petits |fins |gros )?(?:dés|lamelles|lanières|rondelles|demi-rondelles|cubes|quartiers|morceaux|bâtonnets)|émincée?s?|hachée?s?|râpée?s?|écrasée?s?|ciselée?s?)/gi;

const SS_STARCH = /^(Rince|Fais cuire|Mets|Plonge)\s+(?:le |la |les )?(riz|quinoa|pâtes|boulgour|nouilles|pommes de terre|semoule|lentilles|gnocchis)\b/i;
const SS_STARCH_FOLLOW = /^(Ferme|Referme|Fais tomber|Égoutte(?![^.]*sauce)|Égrène|Laisse(-le|-la|-les)? (refroidir|reposer)|Ajoute les lentilles|Mets (le riz|le quinoa|les pommes de terre|les pâtes)|Une fois la pression tombée, (égoutte|égrène))/i;

// Actions d'une recette, préparations d'abord
export function ssActions(r, steps, chain) {
  const sents = steps.flatMap(ssSentences).flatMap(ssSplitMixed);
  const firstHeat = sents.findIndex(s => SS_HEAT.test(s));
  const prep = [], cook = [];
  const moved = [];
  let res = null;
  sents.forEach((s0, i) => {
    const s = s0.replace(/^(Pendant ce temps|Pendant la cuisson|En attendant|Pendant la session de cuisine),\s*/i, '');
    if (/^(Au moment de manger|Au self|Le matin|Réchauffe|Sors-(en|les)|(Ils|Elles) se gardent)/i.test(s) || /au moment de manger seulement/i.test(s)) return; // pas pendant la session
    if (/^Mise en boîtes/i.test(s)) { cook.push({ chain, kind: 'cook', text: s0, res: null, active: 1, passive: 0 }); return; }
    const before = firstHeat < 0 || i < firstHeat;
    // tout ce qui a été cité avant une cuisson a pu passer sur le feu (« Fais-les cuire » ne nomme rien)
    const lastHeat = sents.slice(0, i).map(x => SS_HEAT.test(x)).lastIndexOf(true);
    const heated = sents.slice(0, lastHeat + 1).join(' ').toLowerCase();
    const reCut = !before && SS_CUT_STRICT.test(s) && !SS_NOUNS.some(n => s.toLowerCase().includes(n) && heated.includes(n));
    const isPrep = !SS_COOKED.test(s) && !SS_HEAT.test(s) && (before || reCut);
    moved[i] = isPrep;
    if (isPrep) {
      const passive = /laisse(-le|-la|-les)? (mariner|reposer|gonfler)|fais tremper|fais-y mariner|fais-le mariner/i.test(s) ? ssMinutes(s, true) : 0;
      prep.push({ chain, kind: 'prep', text: ssCap(s), res: null, active: passive ? 1 : 0, passive, eve: /^La veille|la veille au frigo/i.test(s) });
      return;
    }
    // « Mets-les dans l'autocuiseur » juste après une découpe partie dans la mise en place : on nomme ce qu'on met
    let text = s0;
    // le dernier élément nommé par les phrases parties dans la mise en place juste avant
    let o = null;
    for (let k = i - 1; k >= 0 && moved[k] && !o; k--) o = ssObj(sents[k].replace(/^(Pendant ce temps|Pendant la cuisson|En attendant),\s*/i, ''));
    if (o && /^\S+-(?:les|la|le)\b/i.test(s)) {
      if (o) text = /^(fais|laisse)-(?:les|la|le) \S+/i.test(s) ? s.replace(/^(\S+)-(?:les|la|le) (\S+)/i, (_, v, inf) => `${ssCap(v)} ${inf} ${o}`) : s.replace(/^(\S+)-(?:les|la|le)\b/i, (_, v) => `${ssCap(v)} ${o}`);
    }
    const own = ssResource(s);
    if (own && own !== 'micro') res = own;
    if (/refroidir|tiédir/i.test(s) && !own) { cook.push({ chain, kind: 'cook', text, res: null, active: 1, passive: 0 }); return; }
    const here = own === 'micro' ? 'micro' : own || (res && (SS_HEAT.test(s) || SS_ON_SAME.test(s)) ? res : null);
    // « laisse cuire 5 minutes à feu vif » : on reste devant la poêle
    const busy = /feu vif|en remuant(?! de temps)|sans arrêt/i.test(s) && !/de temps en temps|sous pression|air fryer/i.test(s);
    const passive = !busy && (SS_PASSIVE.test(s) || (['airfryer', 'four'].includes(here) && /cuire|rôtir|\bcuis/i.test(s))) && ssMinutes(s, true) >= 3 && !/(au frigo|au congélateur)/i.test(s);
    if (/laisse.*(au frigo|au congélateur)/i.test(s)) { cook.push({ chain, kind: 'cook', text, res: null, active: 1, passive: 0 }); return; } // ça prend au froid sans bloquer la suite
    cook.push({ chain, kind: 'cook', text, res: here, active: passive ? (/de temps en temps/.test(s) ? 2 : 1) : Math.max(1, ssMinutes(s, false) || 2), passive: passive ? ssMinutes(s, true) : 0 });
  });
  // découpes sous-entendues dans une cuisson (« fais revenir l'oignon haché ») : on les ajoute à la mise en place
  const prepTxt = prep.map(a => a.text).join(' ').toLowerCase();
  const implied = [];
  cook.forEach(a => { if (/\b(coupe|hache|émince|râpe)\b/i.test(a.text)) return; for (const m of a.text.matchAll(SS_IMPLIED)) {
    const noun = m[1].toLowerCase().replace(/^(l'|le |la |les )/, '').split(' ')[0].replace(/s$/, '');
    const item = `${m[1]} ${m[2]}`.trim();
    if (!prepTxt.includes(noun) && !implied.some(x => x.toLowerCase().includes(noun))) implied.push(item);
  } });
  if (implied.length) prep.push({ chain, kind: 'prep', text: `Prépare aussi : ${implied.join(', ')}.`, res: null, active: 0, passive: 0, extraCut: implied.length });
  // durée des découpes : le temps de préparation de la recette, réparti sur ses phrases de découpe
  const cuts = prep.filter(a => !a.passive && !a.eve);
  prep.filter(a => a.eve).forEach(a => { a.active = 0; });
  const per = Math.max(2, Math.round((r?.prepTime || 10) / Math.max(1, cuts.length)));
  cuts.forEach(a => { a.active = per; if (a.extraCut) a.active = 2 * a.extraCut; });
  const acts = [...prep, ...cook];
  acts.forEach((a, k) => { a.deps = k ? [k - 1] : []; });
  // Féculent qui cuit à part (riz, quinoa, pâtes, pommes de terre… à l'autocuiseur) : il part dès la fin des
  // découpes, en parallèle du reste du plat ; ce qui le mélange ensuite au reste l'attend.
  const P = prep.length, lastPrep = P - 1;
  for (let a = P; a < acts.length; a++) {
    const m = acts[a].text.match(SS_STARCH);
    if (!m) continue;
    let b = a;
    while (b + 1 < acts.length && SS_STARCH_FOLLOW.test(acts[b + 1].text)) b++;
    const noun = m[2].toLowerCase();
    acts[a].deps = lastPrep >= 0 ? [lastPrep] : [];
    // même appareil que plus tôt dans le plat (la purée après la carbonade) : on attend qu'il soit vidé
    const segRes = acts.slice(a, b + 1).map(x => x.res).find(Boolean);
    let busy = -1; for (let k = P; k < a; k++) if (segRes && acts[k].res === segRes) busy = k;
    if (busy >= 0) acts[a].deps.push(busy);
    if (b + 1 < acts.length) acts[b + 1].deps = a > P ? [a - 1, b] : (lastPrep >= 0 ? [lastPrep] : []);
    for (let j = b + 1; j < acts.length; j++) if (acts[j].text.toLowerCase().includes(noun) && !acts[j].deps.includes(b)) acts[j].deps.push(b);
    // ce qui suivait le féculent dans la recette ne le précède plus : le dernier geste du plat attend tout
    if (a === P && b + 1 < acts.length) { const last = acts.length - 1; if (!acts[last].deps.includes(b)) acts[last].deps.push(b); }
    a = b;
  }
  return acts;
}

// Planification. chains = [{ id, r, label, actions, kind: 'dish' | 'rice' | 'extra' }]
export function ssSchedule(chains) {
  // toutes les actions, avec leurs dépendances dans leur plat
  const A = [];
  chains.forEach(c => {
    const base = A.length;
    c.actions.forEach((a, k) => A.push({ a, c, k, deps: (a.deps || (k ? [k - 1] : [])).map(d => base + d), done: false, end: 0, succ: [] }));
  });
  A.forEach((x, i) => x.deps.forEach(d => A[d].succ.push(i)));
  // chemin critique : ce qui reste à faire derrière une action
  const tail = new Array(A.length).fill(0);
  for (let i = A.length - 1; i >= 0; i--) tail[i] = A[i].a.active + A[i].a.passive + Math.max(0, ...A[i].succ.map(j => tail[j]));
  // dernier usage de chaque appareil par plat : le plat le garde jusque-là (« dans la même poêle »)
  const lock = {}; // appareil → { owner, freeAt }
  const out = [];
  let t = 0, hands = 0, prevChain = null, guard = 0;
  const readyAt = x => Math.max(0, ...x.deps.map(d => A[d].end));
  const depsDone = x => x.deps.every(d => A[d].done);
  const free = x => {
    const r = x.a.res;
    if (!r || r === 'micro') return true;
    const L = lock[r];
    if (L && L.freeAt > t) return false;
    if (L && L.owner && L.owner !== x.c) return false;
    // le riz attend que plus personne n'ait besoin de son appareil
    if (x.c.kind === 'rice' && A.some(o => !o.done && o.c !== x.c && o.a.res === r)) return false;
    return true;
  };
  while (A.some(x => !x.done) && guard++ < 3000) {
    t = Math.max(t, hands);
    const cands = A.filter(x => !x.done && depsDone(x) && readyAt(x) <= t && free(x));
    if (!cands.length) {
      // personne n'est prêt : on attend le prochain événement (fin de cuisson, appareil libéré)
      const times = [...A.filter(x => x.done).map(x => x.end), ...Object.values(lock).map(L => L.freeAt)].filter(v => v > t);
      const next = times.length ? Math.min(...times) : Infinity;
      if (!isFinite(next)) {
        // deux plats qui s'attendent l'un l'autre : on libère les appareils
        if (Object.values(lock).some(L => L.owner)) { Object.values(lock).forEach(L => { L.owner = null; }); continue; }
        break;
      }
      out.push({ wait: true, start: t, end: next });
      t = next; hands = next;
      continue;
    }
    const score = x => {
      const a = x.a, i = A.indexOf(x);
      // le riz part dès que son appareil est libre pour de bon (free() s'en assure)
      if (x.c.kind === 'rice') return (a.passive >= 10 || x.k === 0 ? 2000 : 0) + tail[i];
      // une cuisson commencée se poursuit
      if (a.kind === 'cook' && x.deps.some(d => A[d].c === x.c && A[d].a.kind === 'cook' && A[d].a.res === a.res && a.res)) return 3000 + tail[i];
      // cuisson qui mène vite (≤ 25 min de gestes) à une longue cuisson toute seule (≥ 10 min) : on la lance tôt
      let launches = false;
      if (a.kind === 'cook') {
        let act = 0;
        for (const b of x.c.actions.slice(x.k)) { if (b.kind !== 'cook' || (b.res && a.res && b.res !== a.res)) break; if (b.passive >= 10) { launches = act <= 25; break; } act += b.active; if (act > 25) break; }
      }
      if (launches) return 2000 + tail[i];
      if (a.kind === 'prep') return 1000 + tail[i] + (prevChain === x.c ? 50 : 0);
      return tail[i] + (prevChain === x.c ? 50 : 0);
    };
    const x = cands.reduce((p, q) => (score(q) > score(p) ? q : p));
    const a = x.a, i = A.indexOf(x);
    const start = t, endHands = start + a.active, end = endHands + a.passive;
    // le plat garde l'appareil si son geste suivant s'y fait aussi (« dans la même poêle »)
    if (a.res && a.res !== 'micro') lock[a.res] = { owner: x.succ.some(j => A[j].a.res === a.res) ? x.c : null, freeAt: end };
    out.push({ ...a, chainRef: x.c, start, end, handsEnd: endHands });
    hands = endHands;
    x.done = true; x.end = end;
    prevChain = x.c;
  }
  const total = Math.max(0, ...out.map(a => a.end));
  return { steps: out, total };
}

// Phases lisibles (v297) : d'abord « Découper et lancer » (toutes les découpes, et ce qui cuit longtemps tout
// seul part dès que possible), puis « Finir les cuissons ». Une phase de plus de 9 étapes est coupée là où l'on
// change de plat. Chaque étape garde son plat et dit ce qui cuit en fond, avec le temps qu'il reste.
export function ssPhases(sched, nameOf) {
  const bgAt = (time, chain) => sched.steps.filter(x => !x.wait && x.kind === 'cook' && x.passive >= 5 && x.handsEnd <= time && x.end > time && x.chainRef !== chain);
  const bgText = (time, chain) => {
    const run = bgAt(time, chain);
    const by = [...new Set(run.map(x => x.chainRef))].map(c => {
      const xs = run.filter(x => x.chainRef === c), left = Math.max(...xs.map(x => x.end)) - time;
      return `${nameOf(c)} ${SS_AT[xs[0].res] || ''} (${left >= 5 ? `encore ≈ ${Math.round(left / 5) * 5} min` : 'presque prêt'})`;
    });
    return by.length ? by.join(' · ') : '';
  };
  const flat = [];
  sched.steps.forEach(a => {
    if (a.wait) {
      const mins = Math.round(a.end - a.start);
      if (mins < 3) return;
      const run = bgAt(a.start + 0.5, null);
      const what = run.length ? ` (${ssList([...new Set(run.map(x => nameOf(x.chainRef)))])})` : '';
      // dernière attente (il ne reste que la fin du riz, par exemple) : la mise en boîtes peut commencer
      const lastOne = !sched.steps.some(x => !x.wait && x.start >= a.end && x.active > 2);
      flat.push({ wait: true, chain: null, kind: 'wait', start: a.start, text: lastOne
        ? `Il reste environ ${mins} minutes de cuisson${what}. Commence déjà la mise en boîtes des plats prêts : l'étape « Mettre en boîtes » te dit quoi mettre où.`
        : `${mins >= 15 ? 'Pause' : 'Petite pause'} d'environ ${mins} minutes, le temps que la cuisson se termine${what}. Profites-en pour laver ce qui traîne.` });
      return;
    }
    // les découpes d'un même plat à la suite : une seule étape ; chaque geste de cuisson reste une étape
    const last = flat[flat.length - 1];
    if (last && !last.wait && last.chain === a.chainRef && a.kind === 'prep' && last.kind === 'prep' && !last.passive) { last.text += ' ' + a.text; last.passive = a.passive; return; }
    flat.push({ text: a.text, chain: a.chainRef, kind: a.kind, passive: a.passive, res: a.res, start: a.start, bg: bgText(a.start + 0.01, a.chainRef) });
  });
  const lastPrep = flat.map(x => x.kind === 'prep').lastIndexOf(true);
  const groups = [];
  if (lastPrep >= 0) groups.push({ base: flat.slice(0, lastPrep + 1).some(x => x.kind === 'cook') ? 'Découper et lancer les cuissons' : 'Tout découper', steps: flat.slice(0, lastPrep + 1), prep: true });
  if (lastPrep + 1 < flat.length) groups.push({ base: lastPrep >= 0 ? 'Finir les cuissons' : 'Cuisiner', steps: flat.slice(lastPrep + 1) });
  const out = [];
  groups.forEach(g => {
    let chunk = [];
    const push = () => { if (chunk.length) out.push({ g, steps: chunk }); chunk = []; };
    g.steps.forEach((st, k) => { if (chunk.length >= 9 && st.chain !== chunk[chunk.length - 1].chain && g.steps.length - k > 2) push(); chunk.push(st); });
    push();
  });
  return out.map((p, k) => {
    const first = out.findIndex(q => q.g === p.g) === k;
    const dishes = [...new Set(p.steps.filter(s => s.chain).map(s => s.chain))];
    return {
      title: first ? p.g.base : `${p.g.base} (suite)`,
      hint: first && p.g.prep ? "Les découpes d'abord ; ce qui cuit longtemps tout seul part dès que possible" : ssList(dishes.map(nameOf)),
      steps: p.steps,
    };
  });
}
export const ssResName = k => SS_RES_NAME[k] || '';
const SS_AT = { autocuiseur: "à l'autocuiseur", airfryer: "à l'air fryer", four: 'au four', cocotte: 'en cocotte', casserole: 'en casserole', casserole2: 'en casserole', poele: 'à la poêle' };

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// v299 : session construite à partir des recettes structurées (data/sessionSteps.js), plus de devinette.
//   1. « Lancer » : ce qui cuit longtemps tout seul part d'abord (au plus un plat par appareil), avec ses
//      découpes (et la même découpe pour les autres plats, faite d'un coup).
//   2. « Tout découper » : la mise en place commune, regroupée par produit (« Émince 4 oignons finement :
//      2 pour…, 2 pour… »), puis les marinades et sauces froides.
//   3. « Cuire » : les cuissons, planifiées avec une paire de mains et un exemplaire de chaque appareil.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

// Minutes au couteau pour une quantité donnée (ordre de grandeur, pour le planning)
const SS_CUT_MIN = { oignon: 1.5, carotte: 1, poivron: 1.5, courgette: 1, aubergine: 1.5, tomate: 1, concombre: 1.5, patate_douce: 2,
  poireau: 1.5, butternut: 6, potimarron: 5, chou: 4, pomme: 1, poire: 1, banane: 0.5, citron: 0.5, citron_vert: 0.5, champignons: 3,
  herbes: 2, gingembre: 0.3, ail: 0.5, salade: 3, tomates_cerise: 2, fruit_saison: 1 };
function ssCutMinutes(key, qty, verb) {
  if (/^Rince|^Lave et essore|^Concasse|^Presse/i.test(verb || '')) return 1 + (key === 'salade' ? 2 : 0);
  const P = PIECES[key];
  if (P && SS_CUT_MIN[key]) return 1 + SS_CUT_MIN[key] * Math.max(0.5, qty / P.g);
  if (/poulet|boeuf|saumon|haut_cuisse|tofu|poisson|crevettes/.test(key)) return 1 + 2 * qty / 250;
  if (key === 'pdt') return 1 + qty / 150;
  return 1 + qty / 200;
}
const SS_APP_FOR = (app, eq) => (app === 'autocuiseur' && eq && eq.autocuiseur === false ? 'cocotte' : app === 'airfryer' && eq && eq.airfryer === false && eq.four ? 'four' : app);
// minutes écrites dans un texte (version adaptée à l'équipement : cocotte, four)
const ssTextMinutes = t => { let m = 0; t.replace(/(toutes les |tous les )?(\d+)(?:\s*à\s*(\d+))?\s*(?:minutes|min)\b/g, (_, e, a, b) => { if (!e) m += +(b || a); return _; }); return m; };

// Une session prête à afficher.
// dishes : [{ r, tot, kind: 'dish' | 'extra', qty?: phrase des quantités (extras) }]
// opt : { eq, adapt(text, r), rice: [actions du riz], name(r), qtyText(key, qty, unit, name) }
export function ssBuild(dishes, opt = {}) {
  const eq = opt.eq || { autocuiseur: true, airfryer: true };
  const name = opt.name || (r => r.short || r.name);
  const qtyText = opt.qtyText || ((k, q) => `${Math.round(q)} g`);
  const adapt = opt.adapt || (t => t);
  const T = []; // tâches
  const add = t => { T.push({ deps: [], ...t }); return T.length - 1; };
  const ds = dishes.map(x => {
    const data = SESSION_STEPS[x.r.id];
    const qtyOf = key => x.r.ingredients.reduce((a, g, i) => a + (g.key === key ? (x.tot?.[i] || 0) : 0), 0);
    const unitOf = key => x.r.ingredients.find(g => g.key === key)?.unit || 'g';
    const nameOf = key => x.r.ingredients.find(g => g.key === key)?.name || INGREDIENTS[key]?.name || key;
    let cuts = [], steps = [];
    if (data) {
      cuts = data.cuts.filter(c => qtyOf(c.ing) > 0 || !x.tot).map(c => ({ ...c, qty: qtyOf(c.ing), unit: unitOf(c.ing), nm: nameOf(c.ing) }));
      steps = data.steps.map((s, k) => {
        const text = adapt(s.text, x.r);
        const app = SS_APP_FOR(s.app, eq);
        let wait = s.wait;
        if (text !== s.text && wait) { const m = ssTextMinutes(text); if (m) wait = m + (/sous pression/.test(text) ? 5 : 0); }
        return { text, kind: s.kind, app, min: Math.max(1, s.min), wait, after: s.after ?? (k ? [k - 1] : []) };
      });
    } else {
      // recette pas encore structurée : l'ancienne lecture du texte
      const acts = ssActions(x.r, x.steps || x.r.steps.filter(st => !/^(Riz : |Mise en boîtes : |Au moment de manger : )/.test(st)), x.r.id);
      steps = acts.map(a => ({ text: a.text, kind: a.kind, app: a.res, min: Math.max(a.kind === 'prep' ? 0 : 1, a.active), wait: a.passive, after: a.deps }));
    }
    if (x.qty) steps.unshift({ text: x.qty, kind: 'prep', app: null, min: 0, wait: 0, after: [], head: true }) && steps.forEach((s, k) => { if (k) s.after = s.after.map(d => d + 1); if (k === 1 && !s.after.length) s.after = [0]; });
    return { ...x, cuts, steps, ids: [], cutIds: [] };
  });

  // ── 1. plats à lancer : un long temps de cuisson tout seul (≥ 15 min) atteint en ≤ 25 min de gestes ──
  const leadOf = d => {
    let hands = 0;
    for (let k = 0; k < d.steps.length; k++) {
      const s = d.steps[k];
      if (s.kind === 'prep' && !s.head) return null; // une marinade d'abord : pas un lancement immédiat
      hands += s.min;
      if (s.wait >= 15) return hands <= 25 ? { k, wait: s.wait, app: s.app } : null;
      if (hands > 25) return null;
    }
    return null;
  };
  const launches = [];
  ds.filter(d => d.kind === 'dish').map(d => ({ d, L: leadOf(d) })).filter(x => x.L).sort((a, b) => b.L.wait - a.L.wait)
    .forEach(x => { if (launches.length < 2 && !launches.some(y => y.L.app === x.L.app)) launches.push(x); });
  const isLaunch = d => launches.some(x => x.d === d);

  // ── 2. découpes, regroupées par produit et par geste ──
  const groups = [];
  ds.forEach(d => d.cuts.forEach(c => {
    const key = `${c.ing}|${c.verb}|${c.form}`;
    let g = groups.find(x => x.key === key);
    if (!g) groups.push(g = { key, ing: c.ing, verb: c.verb, form: c.form, unit: c.unit, nm: c.nm, parts: [] });
    g.parts.push({ d, qty: c.qty });
  }));
  const cutText = g => {
    const total = g.parts.reduce((a, p) => a + p.qty, 0);
    const what = total > 0 ? qtyText(g.ing, total, g.unit, g.nm) : g.nm.toLowerCase();
    const base = `${g.verb} ${what}${g.form ? ' ' + g.form : ''}`;
    if (g.parts.length < 2) return `${base}.`;
    return `${base} : ${g.parts.map(p => `${qtyText(g.ing, p.qty, g.unit, g.nm).replace(/ (de |d')?[^ ]+.*$/, m => (PIECES[g.ing]?.self ? '' : m))} pour ${name(p.d.r)}`).join(', ')}.`;
  };
  // les groupes d'un plat à lancer passent dans son lancement (pour tous les plats d'un coup)
  const launchGroups = new Map(launches.map(x => [x.d, groups.filter(g => g.parts.some(p => p.d === x.d))]));
  const usedG = new Set();
  let prevLaunchEnd = null;
  launches.forEach(({ d }) => {
    const gs = launchGroups.get(d).filter(g => !usedG.has(g));
    const ids = gs.map(g => { usedG.add(g); return add({ text: cutText(g), kind: 'cut', app: null, min: Math.round(g.parts.reduce((a, p) => a + ssCutMinutes(g.ing, p.qty, g.verb), 0)), wait: 0, phase: 'launch', chain: d, group: g, prio: 6000 }); });
    gs.forEach((g, k) => { g.task = ids[k]; });
    d.cutIds = gs.map(g => g.task);
    if (prevLaunchEnd != null) ids.forEach(i => T[i].deps.push(prevLaunchEnd));
    // ses étapes jusqu'au lancement
    const L = leadOf(d);
    d.steps.forEach((s, k) => {
      const i = add({ text: s.text, kind: s.kind === 'prep' ? 'prep' : 'cook', app: s.app, min: s.min, wait: s.wait, phase: k <= L.k ? 'launch' : 'cook', chain: d, prio: k <= L.k ? 6000 : 0 });
      d.ids[k] = i;
    });
    d.steps.forEach((s, k) => { T[d.ids[k]].deps.push(...s.after.map(a => d.ids[a]), ...(k <= L.k || !s.after.length ? launchGroups.get(d).map(g => g.task) : [])); });
    prevLaunchEnd = d.ids[L.k];
  });
  // mise en place commune : le reste des découpes
  const mep = groups.filter(g => !usedG.has(g)).sort((a, b) => a.ing.localeCompare(b.ing));
  mep.forEach(g => { g.task = add({ text: cutText(g), kind: 'cut', app: null, min: Math.round(g.parts.reduce((a, p) => a + ssCutMinutes(g.ing, p.qty, g.verb), 0)), wait: 0, phase: 'mep', group: g, chain: g.parts.length === 1 ? g.parts[0].d : null, prio: 1000, deps: prevLaunchEnd != null ? [prevLaunchEnd] : [] }); });
  // les autres plats : leurs gestes attendent leurs découpes ; marinades et sauces froides avec la mise en place
  ds.filter(d => !isLaunch(d)).forEach(d => {
    const myCuts = groups.filter(g => g.parts.some(p => p.d === d)).map(g => g.task);
    d.steps.forEach((s, k) => {
      const prep = s.kind === 'prep';
      d.ids[k] = add({ text: s.text, kind: prep ? 'prep' : 'cook', app: s.app, min: s.min, wait: s.wait, phase: prep ? 'mep' : 'cook', chain: d, prio: prep ? 900 : 0, head: s.head });
    });
    d.steps.forEach((s, k) => { T[d.ids[k]].deps.push(...s.after.map(a => d.ids[a]), ...myCuts, ...(prevLaunchEnd != null ? [prevLaunchEnd] : [])); });
  });
  // riz de la session
  if (opt.rice && opt.rice.length) {
    let prev = null;
    opt.rice.forEach(a => { const i = add({ ...a, kind: 'cook', min: a.active, wait: a.passive, phase: 'cook', chain: 'riz', rice: true, prio: 0 }); if (prev != null) T[i].deps.push(prev); prev = i; });
  }

  // ── 3. planning ──
  T.forEach((t, i) => { t.deps = [...new Set(t.deps)].filter(d => d != null && d !== i); t.succ = []; });
  T.forEach((t, i) => t.deps.forEach(d => T[d].succ.push(i)));
  const tail = new Array(T.length).fill(0);
  const order = ssTopo(T);
  for (let n = order.length - 1; n >= 0; n--) { const i = order[n]; tail[i] = T[i].min + T[i].wait + Math.max(0, ...T[i].succ.map(j => tail[j])); }
  const lock = {};
  const out = [];
  let t = 0, hands = 0, prev = null, guard = 0;
  const done = new Array(T.length).fill(false), end = new Array(T.length).fill(0);
  const ready = i => T[i].deps.every(d => done[d]) && Math.max(0, ...T[i].deps.map(d => end[d])) <= t;
  const free = i => {
    const r = T[i].app;
    if (!r || r === 'micro') return true;
    const L = lock[r];
    if (L && L.freeAt > t) return false;
    if (L && L.owner && L.owner !== T[i].chain) return false;
    if (T[i].rice && T.some((o, j) => !done[j] && !o.rice && o.app === r)) return false; // le riz attend que plus personne n'ait besoin de l'appareil
    return true;
  };
  const score = i => {
    const x = T[i];
    if (x.prio) return x.prio + tail[i] - i * 0.01; // lancements dans l'ordre, puis mise en place
    if (x.rice) return 2000 + tail[i];
    if (x.deps.some(d => T[d].chain === x.chain && T[d].kind === 'cook' && T[d].app && T[d].app === x.app)) return 3000 + tail[i]; // une cuisson commencée se poursuit
    let act = 0, launch = false;
    for (let j = i; j != null && T[j] && T[j].chain === x.chain; j = T[j].succ.find(s => T[s].chain === x.chain)) {
      if (T[j].app && x.app && T[j].app !== x.app) break;
      if (T[j].wait >= 10) { launch = act <= 25; break; }
      act += T[j].min; if (act > 25) break;
    }
    return (launch ? 2000 : 0) + tail[i] + (prev === x.chain ? 50 : 0);
  };
  while (done.some(v => !v) && guard++ < 5000) {
    t = Math.max(t, hands);
    const cands = T.map((_, i) => i).filter(i => !done[i] && ready(i) && free(i));
    if (!cands.length) {
      const times = [...end.filter((e, i) => done[i]), ...Object.values(lock).map(L => L.freeAt)].filter(v => v > t);
      if (!times.length) {
        if (Object.values(lock).some(L => L.owner)) { Object.values(lock).forEach(L => { L.owner = null; }); continue; }
        break;
      }
      const next = Math.min(...times);
      out.push({ wait: true, start: t, end: next });
      t = hands = next;
      continue;
    }
    const i = cands.reduce((a, b) => (score(b) > score(a) ? b : a));
    const x = T[i];
    const start = t, he = t + x.min, e = he + x.wait;
    if (x.app && x.app !== 'micro') lock[x.app] = { owner: x.succ.some(j => T[j].app === x.app && T[j].chain === x.chain) ? x.chain : null, freeAt: e };
    out.push({ ...x, i, start, handsEnd: he, end: e });
    done[i] = true; end[i] = e; hands = he; prev = x.chain;
  }
  const total = Math.max(0, ...out.map(a => a.end || 0));

  // ── 4. phases ──
  const chainName = c => (!c ? '' : c === 'riz' ? 'riz' : name(c.r));
  const bg = (time, self) => {
    const run = out.filter(x => !x.wait && x.wait !== true && x.kind === 'cook' && (x.wait || 0) >= 5 && x.handsEnd <= time && x.end > time && x.chain !== self);
    const by = [...new Set(run.map(x => x.chain))].map(c => {
      const xs = run.filter(x => x.chain === c), left = Math.max(...xs.map(x => x.end)) - time;
      return `${chainName(c)} ${SS_AT[xs[0].app] || ''} (${left >= 5 ? `encore ≈ ${Math.round(left / 5) * 5} min` : 'presque prêt'})`;
    });
    return by.join(' · ');
  };
  const steps = out.map(x => {
    if (x.wait === true) {
      const mins = Math.round(x.end - x.start);
      if (mins < 3) return null;
      const lastOne = !out.some(y => y.wait !== true && y.start >= x.end && y.min > 2);
      const what = bg(x.start + 0.5, null);
      return { kind: 'wait', start: x.start, text: lastOne
        ? `Il reste environ ${mins} minutes de cuisson. Commence déjà la mise en boîtes des plats prêts : l'étape « Mettre en boîtes » te dit quoi mettre où.`
        : `${mins >= 15 ? 'Pause' : 'Petite pause'} d'environ ${mins} minutes, le temps que la cuisson se termine${what ? ` (${what.replace(/ \(.*?\)/g, '')})` : ''}. Profites-en pour laver ce qui traîne.` };
    }
    return { kind: x.kind, phase: x.phase, start: x.start, text: x.text, chain: x.chain, group: x.group, bg: bg(x.start + 0.01, x.chain), head: x.head };
  }).filter(Boolean);
  // fenêtre de la mise en place : tout ce qui se passe entre sa première et sa dernière découpe y reste
  const firstMep = steps.findIndex(s => s.phase === 'mep'), lastMep = steps.map(s => s.phase === 'mep').lastIndexOf(true);
  const lastLaunch = steps.map(s => s.phase === 'launch').lastIndexOf(true);
  const phases = [];
  let cur = null;
  steps.forEach((s, k) => {
    let key;
    if (k <= lastLaunch && s.phase === 'launch' && s.chain && s.chain !== 'riz') key = 'launch:' + s.chain.r.id;
    else if (firstMep >= 0 && k >= firstMep && k <= lastMep) key = 'mep';
    else if (k < firstMep && cur) key = cur.key;
    else key = 'cook';
    if (!cur || cur.key !== key || (key === 'cook' && cur.steps.length >= 9 && s.chain !== cur.steps[cur.steps.length - 1].chain && steps.length - k > 2)) {
      cur = { key, steps: [] }; phases.push(cur);
    }
    cur.steps.push(s);
  });
  let cookN = 0;
  const outPhases = phases.map(p => {
    const dishesIn = [...new Set(p.steps.map(s => s.chain).filter(c => c && c !== 'riz'))];
    if (p.key.startsWith('launch:')) {
      const d = launches.find(x => 'launch:' + x.d.r.id === p.key)?.d;
      return { title: `Lancer : ${name(d.r)}`, hint: "Ensuite ça cuit tout seul : tu avances sur le reste pendant ce temps", steps: p.steps };
    }
    if (p.key === 'mep') return { title: 'Tout découper', hint: 'Toute la mise en place, plat par plat dans des bols : ensuite il ne reste que les cuissons', steps: p.steps };
    cookN++;
    return { title: cookN > 1 ? 'Cuire (suite)' : 'Cuire', hint: ssList(dishesIn.map(c => name(c.r))), steps: p.steps };
  });
  return { phases: outPhases, total, launches: launches.map(x => x.d.r.id) };
}
// ordre topologique (les dépendances d'abord)
function ssTopo(T) {
  const seen = new Array(T.length).fill(0), out = [];
  const visit = i => { if (seen[i]) return; seen[i] = 1; T[i].deps.forEach(visit); out.push(i); };
  T.forEach((_, i) => visit(i));
  return out;
}
// Durée estimée d'une session pour une liste de plats (génération de la semaine) : 6 boîtes par plat
export function ssEstimate(recipes, eq) {
  const rice = recipes.some(r => r.steps.some(st => /^Riz : /.test(st)));
  const dishes = recipes.map(r => ({ r, kind: 'dish', tot: r.ingredients.map(g => g.qty * 6) }));
  return ssBuild(dishes, { eq, rice: rice ? [{ text: '', app: eq && !eq.autocuiseur ? 'casserole' : 'autocuiseur', active: 3, passive: 0 }, { text: '', app: eq && !eq.autocuiseur ? 'casserole' : 'autocuiseur', active: 1, passive: eq && !eq.autocuiseur ? 45 : 35 }] : null }).total;
}

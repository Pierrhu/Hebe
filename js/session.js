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

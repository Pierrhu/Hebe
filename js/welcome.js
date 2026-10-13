// welcome.js — Accueil : faire connaissance.
// Première ouverture : bienvenue → foyer → cuisine → pour chaque personne (profil, mesures, quotidien, rythme, alimentation, objectif) → résumé.
// v220 : une question par écran, quatre chapitres visibles en haut (Cuisine, Profil, Repas, Objectif), une phrase qui dit
// pourquoi on demande, passage automatique à l'écran suivant sur les choix uniques, glissement entre les écrans.
// Profil repris d'une ancienne version : foyer, prénom et profil, repas, puis les autres personnes éventuelles.
// Personne ajoutée depuis Mon programme : seulement les étapes de cette personne.

import { el, toast } from './utils.js';
import { askRestore } from './settings.js';
import { openScienceSheet } from './science.js';
import {
  getHousehold, getMembers, getMember, getActiveMember, setActiveMember, updateMember, setOnboarded,
  setMemberCount, isComplete, setMaxRepeat, setSoups, setEquipment,
} from '../data/household.js';
import { computeBase, computeTargets, protocolFor, getProfile, saveProfile } from '../data/calculator.js';
import { saveTargets, getTargetsFor } from '../data/user.js';
import { openBodyfatGuide } from './bodyfat.js';
import {
  measuresGrid, bodyfatButton, identityBlock, activityPicker, bindActivityPicker, goalPicker, bindGoalPicker, bindMeasures, esc, avatar,
  householdCards, idCard, openMeasureSheet, MEAS_KEYS, formulaBlock, foodBlock, repeatBlock, openProtocolSheet, equipmentBlock,
} from './profileUi.js';

// Point de départ des boutons − et + quand une case est encore vide (rien n'est enregistré tant qu'on n'y touche pas)
const START = {
  male:   { age: 30, height: 1.78, weight: 78, bodyfat: 20 },
  female: { age: 30, height: 1.65, weight: 62, bodyfat: 28 },
};
const RANGES = {
  age:     { min: 18, max: 99,  msg: 'Hébé est conçue pour les adultes : indique un âge entre 18 et 99 ans.' },
  height:  { min: 1.3, max: 2.3, msg: 'Indique ta taille en mètres, par exemple 1,72.' },
  weight:  { min: 35, max: 250, msg: 'Indique un poids entre 35 et 250 kg.' },
  bodyfat: { min: 5,  max: 60,  msg: 'Indique une masse grasse entre 5 et 60 %. Si tu ne la connais pas, estime-la avec les silhouettes.' },
};
const MEMBER_STEPS = ['identity', 'measures', 'activity', 'rhythm', 'food', 'goal'];
// Chapitres affichés en haut de l'écran
const CHAPTER = { household: 0, tools: 0, identity: 1, measures: 1, activity: 1, rhythm: 2, food: 2, goal: 3, summary: 3 };
const CHAPTER_NAMES = ['Cuisine', 'Profil', 'Repas', 'Objectif'];
// Écrans à choix unique : on passe au suivant dès qu'on a choisi
const AUTO_NEXT = []; // v251 : plus de passage automatique, on appuie toujours sur « Continuer »
const ORD = ['Première', 'Deuxième'];

const WL_BACK = '<button class="round-back wl-back" aria-label="Étape précédente"><svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg></button>';

export function renderWelcome(onDone) {
  const app = document.getElementById('app');
  app.querySelector('.view')?.remove();
  const view = el('div', 'view welcome-view');
  app.appendChild(view);

  const h = getHousehold();
  const firstTime = !h.onboardedOnce;
  const memberSteps = mid => MEMBER_STEPS.map(type => ({ type, mid }));
  // Même plat et soupes : réglages du foyer, demandés une seule fois, avec la première personne
  const houseQ = () => firstTime && cur().mid === getMembers()[0]?.id;
  const incomplete = () => getMembers().filter(m => !isComplete(m)).map(m => m.id);

  // Étapes qui suivent le choix du foyer
  function tail() {
    const out = [];
    if (h.migrated && firstTime) out.push({ type: 'identity', mid: 'm1' }, { type: 'rhythm', mid: 'm1' }, { type: 'food', mid: 'm1' });
    getMembers().forEach(m => { if (!isComplete(m) && !(h.migrated && firstTime && m.id === 'm1')) out.push(...memberSteps(m.id)); });
    if (out.some(s => s.type === 'goal') || getMembers().length > 1) out.push({ type: 'summary' });
    return out;
  }
  let steps;
  if (firstTime) steps = [...(h.migrated ? [] : [{ type: 'hello' }]), { type: 'household' }, { type: 'tools' }, ...tail()];
  else steps = [...incomplete().flatMap(memberSteps), { type: 'summary' }];
  let i = 0;
  let error = '';

  const cur = () => steps[i];
  const member = () => getMember(cur().mid) || getActiveMember();

  // Progression : le nom des chapitres, celui en cours en gras (v221 : sans barres)
  const progress = () => {
    const counted = steps.filter(st => st.type !== 'hello');
    const k = counted.indexOf(cur());
    if (k < 0 || counted.length < 2) return '';
    const chs = [...new Set(counted.map(st => CHAPTER[st.type]))];
    const curCh = CHAPTER[cur().type];
    return `<div class="wl-progress" aria-label="Étape ${k + 1} sur ${counted.length}, ${CHAPTER_NAMES[curCh]}">
      ${chs.map(c => { const to = chapterStart(c); const ok = to >= 0 && to <= furthest && c !== curCh;
        return `<button class="wl-ch ${c === curCh ? 'cur' : c < curCh ? 'done' : ''}" data-ch="${c}"${c === curCh ? ' aria-current="step"' : ''}${ok ? '' : ' disabled'}>${CHAPTER_NAMES[c]}</button>`; }).join('')}</div>`;
  };
  // v230 : toucher un chapitre déjà atteint y ramène (première étape du chapitre, pour la personne en cours si possible)
  let furthest = 0;
  const chapterStart = c => {
    const mine = steps.findIndex(st => CHAPTER[st.type] === c && st.mid && st.mid === cur().mid);
    return mine >= 0 ? mine : steps.findIndex(st => CHAPTER[st.type] === c);
  };
  const top = () => `<div class="wl-top">${i > 0 ? WL_BACK : '<span class="wl-spacer"></span>'}${progress()}</div>`;
  // pastille de la personne concernée (foyer de deux)
  const who = () => {
    const ms = getMembers();
    if (ms.length < 2 || !cur().mid) return '';
    const k = ms.findIndex(m => m.id === cur().mid);
    const m = member();
    return `<div class="wl-who"><span class="wl-who-n">${k + 1}</span>${m.name ? esc(m.name) : `${ORD[k]} personne`}${m.name ? '' : ' sur deux'}</div>`;
  };
  const kick = () => ''; // pas d'étiquette au-dessus des titres
  const errBox = () => (error ? `<p class="wl-error" role="alert">${error}</p>` : '');
  const sub = t => `<p class="wl-sub">${t}</p>`;
  const cta = label => `<div class="wl-cta"><button class="hb-btn hb-btn-primary wl-next">${label}</button></div>`;

  function screen() {
    const s = cur();
    const m = member();
    const p = getProfile();
    switch (s.type) {
      case 'hello': return `
        <div class="wl-hero" aria-hidden="true">
          <span class="wl-blob b1"></span><span class="wl-blob b2"></span>
          <img class="wl-art" src="img/art/accueil.webp" alt="" width="900" height="889" fetchpriority="high" decoding="async">
        </div>
        <div class="wl-hello">
          <div class="brand-word">Héb<span class="brand-accent">é</span></div>
          <div class="brand-tag">Bien manger sans y penser</div>
          <div class="wl-points">
            <div><i style="background:var(--honey)"></i>Plus de 100 recettes</div>
            <div><i style="background:var(--sky)"></i>Des portions calculées pour toi</div>
            <div><i style="background:var(--terra)"></i>Une seule session de cuisine par semaine</div>
            <div><i style="background:var(--sage)"></i>La liste de courses toute prête</div>
            <div><i style="background:var(--bloom)"></i><button class="wl-sci" data-science>Des calculs fondés sur la science</button></div>
          </div>
          <p class="wl-end">Plus qu'à cuisiner !</p>
        </div>
        <div class="wl-cta wl-cta-hello"><button class="hb-btn hb-btn-primary wl-next">Commencer</button>
          <button class="wl-restore-btn" data-wl-restore>J'ai déjà une sauvegarde Hébé</button><input type="file" accept=".json,application/json" data-wl-file hidden></div>`;

      case 'household': return `
        ${top()}
        ${kick()}
        <h1 class="wl-title">Pour combien de personnes ?</h1>
        ${sub('Hébé calcule les portions de chacun et prépare une seule session de cuisine.')}
        ${householdCards(getMembers().length >= 2 ? 2 : (h.countChosen ? 1 : 0))}
        ${errBox()}
        ${cta('Continuer')}`;

      case 'tools': return `
        ${top()}${kick()}
        <h1 class="wl-title">Qu'as-tu dans ta cuisine ?</h1>
        ${sub('Les recettes s\'adaptent à ton matériel. Coche tout ce que tu as.')}
        ${equipmentBlock(getHousehold().equipment)}
        ${errBox()}
        ${cta('Continuer')}`;

      case 'identity': return `
        ${top()}${who()}${kick()}
        <h1 class="wl-title">Faisons connaissance</h1>
        ${sub(getMembers().length > 1 && cur().mid !== getMembers()[0].id ? 'Son prénom et son profil, pour calculer ses besoins.' : 'Ton prénom et ton profil, pour calculer tes besoins.')}
        ${identityBlock(m, { error })}
        ${cta('Continuer')}`;

      case 'measures': return `
        ${top()}${who()}${kick()}
        <h1 class="wl-title">${getMembers().length > 1 && m.name ? `Les mesures de ${esc(m.name)}` : 'Tes mesures'}</h1>
        ${sub('Touche chaque case pour la remplir. Elles servent à calculer tes portions.')}
        ${idCard(m, p, { num: getMembers().findIndex(x => x.id === m.id) + 1 })}
        ${bodyfatButton(m.sex)}
        ${errBox()}
        ${cta('Continuer')}`;

      case 'activity': return `
        ${top()}${who()}${kick()}
        <h1 class="wl-title">${getMembers().length > 1 && m.name ? `Le quotidien de ${esc(m.name)}` : 'Ton quotidien'}</h1>
        ${sub('Deux questions sur une semaine habituelle, et Hébé trouve ton niveau.')}
        ${activityPicker(p, m.sex)}
        ${errBox()}
        ${cta('Continuer')}`;

      case 'rhythm': return `
        ${top()}${who()}${kick()}
        <h1 class="wl-title">${getMembers().length > 1 && m.name ? `Le rythme de ${esc(m.name)}` : 'Ton rythme'}</h1>
        ${sub('Hébé répartit les calories de la journée sur ces repas.')}
        ${formulaBlock(m, { error })}
        ${houseQ() ? repeatBlock() : ''}
        ${cta('Continuer')}`;

      case 'food': return `
        ${top()}${who()}${kick()}
        <h1 class="wl-title">${getMembers().length > 1 && m.name ? `Ce que mange ${esc(m.name)}` : 'Ce que tu manges'}</h1>
        ${sub('Hébé écarte ce qui ne te convient pas.')}
        ${foodBlock(m)}
        ${errBox()}
        ${cta('Continuer')}`;

      case 'goal': return `
        ${top()}${who()}${kick()}
        <h1 class="wl-title">${getMembers().length > 1 && m.name ? `L'objectif de ${esc(m.name)}` : 'Ton objectif'}</h1>
        ${sub('Dis ce que tu veux, Hébé choisit le programme.')}
        ${goalPicker(p, m.protocol)}
        ${errBox()}
        ${cta('Voir mon programme')}`;

      case 'summary': {
        const ms = getMembers();
        return `
        ${top()}${kick()}
        <h1 class="wl-title">Tout est prêt${ms.length === 1 ? `, ${esc(ms[0].name)}` : ''}</h1>
        ${sub(ms.length === 1 ? 'Voici ce que Hébé visera chaque jour dans tes repas.' : 'Voici ce que Hébé visera chaque jour pour chacun.')}
        <div class="sm-list">
          ${ms.map((x, k) => {
            const t = getTargetsFor(x);
            const proto = protocolFor(x, x.protocol);
            return `<div class="sm-card" style="${k ? '--c:var(--honey);--t:var(--honey-t)' : '--c:var(--leaf);--t:var(--leaf-t)'}">
              <div class="sm-head"><span class="sm-av">${avatar(x.sex)}</span><div><b>${esc(x.name)}</b><span>${proto.name}</span></div></div>
              <div class="sm-kcal">${t.kcal}<span> kcal par jour</span></div>
              <div class="sm-maint">Dépense quotidienne : ${Math.round(computeBase(x).maintenance)} kcal</div>
              <div class="tc-macros">
                <div class="tcm protein"><div class="tcm-bar"></div><strong>${t.protein}g</strong><span>Protéines</span></div>
                <div class="tcm carbs"><div class="tcm-bar"></div><strong>${t.carbs}g</strong><span>Glucides</span></div>
                <div class="tcm fat"><div class="tcm-bar"></div><strong>${t.fat}g</strong><span>Lipides</span></div>
              </div>
            </div>`;
          }).join('')}
        </div>
        <button class="wl-sci-card" data-science>
          <b>D'où viennent ces chiffres ?</b>
          <span>Ton calcul ligne par ligne, et les études qui le justifient.</span>
        </button>
        ${cta('Préparer ma semaine')}`;
      }
    }
    return '';
  }

  let shownStep = -1;
  function render() {
    if (cur().mid) setActiveMember(cur().mid);
    const keepY = window.scrollY;
    const anim = shownStep < 0 || shownStep === i ? '' : (i > shownStep ? ' wl-in-f' : ' wl-in-b');
    view.className = `view welcome-view wl-${cur().type}${anim}`;
    view.innerHTML = screen();
    bind();
    // en haut seulement quand on change d'étape ; une réponse ne fait pas remonter la page
    window.scrollTo(0, shownStep === i ? keepY : 0);
    shownStep = i;
    furthest = Math.max(furthest, i);
  }
  const fail = (msg, focusSel) => { error = msg; render(); if (focusSel) view.querySelector(focusSel)?.focus(); };

  function next() {
    const s = cur();
    const m = member();
    if (s.type === 'household') {
      if (!h.countChosen && getMembers().length < 2) return fail('Choisis pour combien de personnes Hébé prépare les repas.');
      steps = [...steps.slice(0, i + 1), { type: 'tools' }, ...tail()];
    }
    if (s.type === 'tools') {
      const eq = getHousehold().equipment || {};
      if (!eq.plaque && !eq.autocuiseur) return fail('Coche au moins des plaques de cuisson ou un autocuiseur.');
    }
    if (s.type === 'identity') {
      const name = view.querySelector('.id-name').value.trim();
      if (name) updateMember(m.id, { name });
      if (!name || !getMember(m.id).sex) {
        return fail(!name && !m.sex ? 'Indique le prénom et choisis le profil pour continuer.'
          : !name ? 'Indique le prénom pour continuer.' : 'Choisis le profil pour continuer.', !name ? '.id-name' : '.sx-card');
      }
    }
    if (s.type === 'measures') {
      const pr = getProfile();
      const bad = Object.keys(RANGES).find(k => pr[k] == null || pr[k] < RANGES[k].min || pr[k] > RANGES[k].max);
      if (bad) return fail(pr[bad] == null ? 'Remplis les quatre mesures de ta fiche pour continuer.' : RANGES[bad].msg, `[data-meas="${bad}"]`);
    }
    if (s.type === 'activity' && !getMember(m.id).activity) return fail('Réponds aux deux questions : ton travail et tes séances de sport.');
    if (s.type === 'rhythm' && !getMember(m.id).formula) return fail('Choisis le rythme de repas.');
    if (s.type === 'food' && getMember(m.id).whey == null) return fail('Indique si tu as de la protéine en poudre (whey).');
    if (s.type === 'goal' && !getMember(m.id).protocol) return fail('Choisis un programme pour continuer.');
    error = '';
    if (i < steps.length - 1) { i++; render(); return; }
    // fin du parcours : objectifs du programme de chacun, puis la semaine
    getMembers().forEach(x => { setActiveMember(x.id); saveTargets(computeTargets(getProfile(), x.protocol, x.phase || 0)); });
    setActiveMember(getMembers()[0].id);
    setOnboarded(true);
    if (!steps.some(st => st.type === 'summary')) toast(`Merci ${getMembers()[0].name}, ton profil est à jour`);
    onDone();
  }

  // choix unique : on montre la sélection un court instant, puis on passe à l'écran suivant
  let autoT = 0;
  const autoNext = () => {
    if (!AUTO_NEXT.includes(cur().type) || (cur().type === 'rhythm' && houseQ())) return;
    const at = i; clearTimeout(autoT);
    autoT = setTimeout(() => { if (i === at) next(); }, 320);
  };

  function bind() {
    view.querySelector('.wl-next')?.addEventListener('click', () => { clearTimeout(autoT); next(); });
    view.querySelectorAll('[data-science]').forEach(b => b.addEventListener('click', openScienceSheet)); // v253
    // v195 : nouveau téléphone, reprendre ses données sans refaire le profil
    const wlFile = view.querySelector('[data-wl-file]');
    view.querySelector('[data-wl-restore]')?.addEventListener('click', () => wlFile?.click());
    wlFile?.addEventListener('change', async () => { const f = wlFile.files?.[0]; wlFile.value = ''; if (f) askRestore(await f.text()); });
    view.querySelector('.wl-back')?.addEventListener('click', () => { error = ''; i = Math.max(0, i - 1); render(); });
    view.querySelectorAll('[data-ch]:not([disabled])').forEach(b => b.addEventListener('click', () => {
      const to = chapterStart(+b.dataset.ch);
      if (to < 0 || to > furthest) return;
      clearTimeout(autoT); error = ''; i = to; render();
    }));
    const m = member();
    // équipement
    view.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => {
      const eq = { ...(getHousehold().equipment || {}) };
      eq[b.dataset.tool] = !eq[b.dataset.tool];
      setEquipment(eq); error = ''; render();
    }));
    // ta semaine (v208)
    view.querySelectorAll('[data-rep]').forEach(b => b.addEventListener('click', () => { setMaxRepeat(+b.dataset.rep); render(); }));
    view.querySelectorAll('[data-soups]').forEach(b => b.addEventListener('click', () => { setSoups(b.dataset.soups === '1'); render(); }));
    // foyer
    view.querySelectorAll('[data-count]').forEach(b => b.addEventListener('click', () => {
      setMemberCount(+b.dataset.count); h.countChosen = true; getHousehold().countChosen = true; error = ''; render(); autoNext();
    }));
    // prénom et profil
    const nameInp = view.querySelector('.id-name');
    nameInp?.addEventListener('input', () => { if (error) { error = ''; view.querySelector('.wl-error')?.remove(); } });
    nameInp?.addEventListener('keydown', e => { if (e.key === 'Enter') { nameInp.blur(); next(); } });
    nameInp?.addEventListener('change', () => { const v = nameInp.value.trim(); if (v) updateMember(m.id, { name: v }); });
    view.querySelectorAll('[data-sex]').forEach(b => b.addEventListener('click', () => {
      const name = view.querySelector('.id-name')?.value.trim();
      updateMember(m.id, { sex: b.dataset.sex, ...(name ? { name } : {}) });
      error = ''; render();
    }));
    // mesures
    const start = () => START[getMember(m.id)?.sex] || START.male;
    const getValue = (k, fallback) => getProfile()[k] ?? (fallback ? null : start()[k]);
    getValue.allowEmpty = true;
    bindMeasures(view, getValue, (k, v) => { saveProfile({ [k]: v }); error = ''; render(); });
    // v252 : fiche à remplir, une case après l'autre
    const openMeas = k => openMeasureSheet(k, getProfile()[k], getMember(m.id).sex, start()[k], v => {
      saveProfile({ [k]: v }); error = ''; render();
      const nextK = MEAS_KEYS.find(x => getProfile()[x] == null);
      if (nextK) setTimeout(() => openMeas(nextK), 220);
    });
    view.querySelectorAll('[data-meas]').forEach(b => b.addEventListener('click', () => openMeas(b.dataset.meas)));
    view.querySelector('.bf-guide-btn')?.addEventListener('click', () =>
      openBodyfatGuide(getProfile().bodyfat ?? start().bodyfat, v => { saveProfile({ bodyfat: v }); error = ''; render(); }, getMember(m.id).sex));
    // quotidien
    bindActivityPicker(view, getProfile, patch => { saveProfile(patch); error = ''; render(); });
    // repas et régime
    view.querySelectorAll('[data-formula]').forEach(b => b.addEventListener('click', () => { updateMember(m.id, { formula: b.dataset.formula }); error = ''; render(); autoNext(); }));
    view.querySelectorAll('[data-diet]').forEach(b => b.addEventListener('click', () => { updateMember(m.id, { [b.dataset.diet]: +b.dataset.level }); render(); }));
    view.querySelectorAll('[data-bk]').forEach(b => b.addEventListener('click', () => { updateMember(m.id, { breakfast: b.dataset.bk }); render(); }));
    view.querySelectorAll('[data-whey]').forEach(b => b.addEventListener('click', () => { updateMember(m.id, { whey: b.dataset.whey === '1' }); error = ''; render(); }));
    // objectif (avec la fiche détaillée)
    const choose = pid => { updateMember(m.id, { protocol: pid, phase: 0, targets: null }); error = ''; render(); };
    bindGoalPicker(view, () => getMember(m.id).protocol, choose);
    view.querySelector('.gp-res')?.addEventListener('click', e => openProtocolSheet(getProfile(), e.currentTarget.dataset.sheet, {
      isCurrent: true, onChoose: choose,
    }));
  }

  render();
}

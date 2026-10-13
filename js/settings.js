// settings.js — « Mon profil » : fiche de la personne, activité, programme et objectifs
import { applyDiet } from './diet.js';
import { openBodyfatGuide } from './bodyfat.js';
import { toast, openSheet, closeSheet, el } from './utils.js';
import { getTargets, saveTargets, hasManualTargets } from '../data/user.js';
import {
  computeBase, computeTargets, computeDetails, computeAllPhases, protocolFor, kgPerWeek,
  getProfile, saveProfile, getSelectedProtocol, saveSelectedProtocol,
  getSelectedPhase, saveSelectedPhase,
} from '../data/calculator.js';
import { ACTIVITY, getActiveMember, updateActiveMember, gx, getMembers, getHousehold, saveHousehold, setMemberCount, setOnboarded, weekBudget, setEquipment, getStaples, setStaples, setMaxRepeat, setSoups, getMaxRepeat, getSoups } from '../data/household.js';
import { exportPhotos, importPhotos } from './body.js';
import { openScienceSheet } from './science.js';
import { FORMULAS, measuresGrid, bodyfatButton, identityBlock, activityPicker, bindActivityPicker, goalPicker, bindGoalPicker, bindMeasures, openProtocolSheet, mealsBlock, householdCards, whoSwitch, bindWho, esc, equipmentBlock, idPhoto, weekPrefsBlock } from './profileUi.js';
import { applyEquipment, getEquipment, TOOLS } from './adapt.js';


export function renderSettings() {
  const app = document.getElementById('app');
  app.querySelector('.view')?.remove();

  let profile    = getProfile();
  let protocolId = getSelectedProtocol();
  let phaseIdx   = getSelectedPhase();

  const view = el('div', 'view settings-view');
  app.insertBefore(view, app.querySelector('#nav'));

  const applyComputed = () => saveTargets(computeTargets(profile, protocolId, phaseIdx));
  let manualOpen = false; // la section « à la main » reste ouverte entre deux rendus

  let firstRender = true;
  // v269 : choix du programme depuis les deux questions de l'objectif
  function chooseProtocol(pid) {
    if (pid === protocolId) return;
    protocolId = pid; phaseIdx = 0; saveSelectedProtocol(pid); saveSelectedPhase(0); applyComputed();
    toast(`Programme : ${protocolFor(profile, pid).name}`); render();
  }
  // v273 : sommaire de « Mon profil »
  let section = null;
  const AIM = { P1: 'Prendre du muscle', P2: 'Remodeler mon corps', P3: 'Perdre du gras, assez vite', P4: 'Perdre du gras, sur la durée' };
  const ICONS = {
    objectif: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" />',
    repas: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M16 21V3c-2.5 1-3.5 4-3.5 7.5 0 1.5 1 2.5 2.5 2.5h1"/>',
    semaine: '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    foyer: '<path d="M4 11l8-6.5 8 6.5M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>',
    cuisine: '<path d="M5 10h14v7a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-7zM3 10h18M9 6.5c0-1 .8-1.5 1.5-2.5M13 6.5c0-1 .8-1.5 1.5-2.5"/>',
    donnees: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>',
  };
  const pfRow = (k, tint, ic, title, sub) => `<button class="pf-row" data-sec="${k}">
      <span class="pf-ic pf-${tint}"><svg viewBox="0 0 24 24" aria-hidden="true">${ic}</svg></span>
      <span class="pf-txt"><b>${title}</b><span>${sub}</span></span><span class="hb-chev">›</span></button>`;
  const objSummary = () => `${AIM[protocolId] || ''}, ${(protocolFor(profile, protocolId).phases[phaseIdx]?.label || '').toLowerCase()}`;
  function repasSummary(m) {
    const f = FORMULAS.find(x => x.id === (m.formula || 'jeune'));
    const bk = { sucre: 'petit-déj sucré', sale: 'petit-déj salé', mix: 'petit-déj sucré et salé' }[m.breakfast || 'mix'];
    return [f?.title, f && !f.fast ? bk : '', m.whey !== false ? 'whey' : '', m.lactose ? 'sans lactose' : '', m.gluten ? 'sans gluten' : ''].filter(Boolean).join(', ');
  }
  const semaineSummary = () => [`Même plat ${getMaxRepeat()} fois max`, getSoups() ? 'soupes' : 'sans soupe',
    { complet: 'complets', classique: 'féculents classiques', plat: 'féculents au choix' }[getStaples()] || ''].filter(Boolean).join(', ');
  const foyerSummary = () => `${getMembers().map(m => esc(m.name || 'Sans prénom')).join(' et ')}, ${weekBudget()} € par semaine`;
  const cuisineSummary = () => { const eq = getHousehold().equipment || getEquipment() || {}; return TOOLS.filter(t => eq[t.key]).map(t => t.label).join(', ') || 'Rien de coché'; };
  function dayCard() {
    const t = getTargets(), p = protocolFor(profile, protocolId), ph = p.phases[phaseIdx];
    return `<button class="pf-day pc-${protocolId}" data-sec="objectif">
      <span class="pf-day-top"><span><small>Chaque jour</small><b class="pf-kcal">${t.kcal}<i> kcal</i></b></span>
        <span class="pf-prog"><b>${p.name}</b><span>${ph ? ph.label : ''}${hasManualTargets() ? ', réglé à la main' : ''}</span></span></span>
      <span class="pf-mac"><span><b>${t.protein} g</b>protéines</span><span><b>${t.carbs} g</b>glucides</span><span><b>${t.fat} g</b>lipides</span></span>
    </button>`;
  }
  const goSection = k => { section = k; render(); window.scrollTo(0, 0); };
  function render() {
    const keepY = firstRender ? 0 : window.scrollY; // une modification ne fait pas remonter la page
    const member   = getActiveMember();
    const base     = computeBase(profile);
    const phases   = computeAllPhases(profile, protocolId);
    const protocol = protocolFor(profile, protocolId);
    phaseIdx = Math.min(phaseIdx, protocol.phases.length - 1);
    const active   = phases[phaseIdx];
    const details  = computeDetails(profile, protocolId, phaseIdx);
    const current  = getTargets();
    const isComputed = !hasManualTargets();

    // v273 : « Mon profil » en sommaire. Chaque ligne ouvre sa partie, sur la même page.
    const SECTIONS = {
      objectif: { title: 'Mon objectif', who: true, html: `
      <div class="set-section">
        ${goalPicker(profile, protocolId)}
      </div>

      
      <div class="set-section">
        <div class="phase-stepper">
          ${phases.map((ph, i) => `
            <button class="phase-step ${i === phaseIdx ? 'active' : ''} ${i < phaseIdx ? 'done' : ''}" data-phase="${i}">
              <div class="ps-label">${ph.label}</div>
              <div class="ps-kcal">${ph.targets.kcal} kcal</div>
            </button>
          `).join('')}
        </div>

        <div class="target-card">
          <div class="tc-kcal">${active.targets.kcal}<span> kcal/jour</span></div>
          <div class="tc-week">≈ ${(active.targets.kcal * 7).toLocaleString('fr-FR')} kcal / semaine</div>
          <div class="tc-macros">
            <div class="tcm protein"><div class="tcm-bar"></div><strong>${active.targets.protein}g</strong><span>Protéines</span></div>
            <div class="tcm carbs"><div class="tcm-bar"></div><strong>${active.targets.carbs}g</strong><span>Glucides</span></div>
            <div class="tcm fat"><div class="tcm-bar"></div><strong>${active.targets.fat}g</strong><span>Lipides</span></div>
          </div>
          ${details.floored ? `<p class="tc-note">Le programme visait ${details.wanted} kcal. Hébé remonte ton objectif à ${details.targets.kcal} kcal pour ne pas descendre sous ce dont ton corps a besoin au repos.</p>` : ''}
          ${details.fatRaised ? `<p class="tc-note">Tes lipides sont relevés à ${details.targets.fat} g pour rester au-dessus de ${profile.sex === 'female' ? '25' : '20'} % de tes calories, un minimum important pour l'équilibre hormonal.</p>` : ''}
          <button class="sci-link" data-science>Comment Hébé calcule tes besoins</button>
        </div>

        ${(() => {
          const cur = protocol.phases[phaseIdx], nxt = phases[phaseIdx + 1];
          const label = i => i === 0 ? 'Départ' : 'Étape ' + i;
          const isLast = !nxt;
          return `<div class="phase-guide pc-${protocol.id}">
            <div class="pg-now">
              <div class="pg-kicker">Cette phase : ${label(phaseIdx)}</div>
              <div class="pg-big">${cur.short || ''}</div>
              <p>${cur.advice}</p>
            </div>
            <div class="pg-next ${isLast ? 'last' : ''}">
              ${isLast
                ? `<div class="pg-kicker">Dernier palier</div><p>${cur.advance}</p>`
                : `<div class="pg-kicker">Quand passer à la suite</div>
                   <div class="pg-steps">
                     <span class="pg-chip on">${label(phaseIdx)}<b>${phases[phaseIdx].targets.kcal} kcal</b></span>
                     <span class="pg-arrow" aria-hidden="true"></span>
                     <span class="pg-chip">${label(phaseIdx + 1)}<b>${nxt.targets.kcal} kcal</b></span>
                   </div>
                   <p>${(cur.when || cur.advance).replace(/^./, c => c.toUpperCase())}.</p>`}
            </div>
          </div>`;
        })()}

      </div>

      
      <details class="set-manual pc-${protocolId}" ${manualOpen ? 'open' : ''}>
        <summary>Régler mes calories à la main</summary>
        <div class="manual-body">
          ${isComputed ? '' : '<button class="back-to-plan">Revenir aux calories du programme</button>'}
          ${mrow('kcal',    'Calories',  current.kcal,    'kcal', 50)}
          ${mrow('protein', 'Protéines', current.protein, 'g',    5)}
          ${mrow('carbs',   'Glucides',  current.carbs,   'g',    5)}
          ${mrow('fat',     'Lipides',   current.fat,     'g',    5)}
          <div class="weekly-readout"><span>Objectif hebdomadaire</span><strong>${(current.kcal*7).toLocaleString('fr-FR')} kcal</strong></div>
        </div>
      </details>

      ` },
      repas:    { title: 'Mes repas', who: true, html: `<div class="set-section">${mealsBlock(member, { week: false })}</div>` },
      semaine:  { title: 'Ma semaine', html: `<div class="set-section">${weekPrefsBlock()}${staplesCard()}</div>` },
      foyer:    { title: 'Mon foyer', html: `
      <div class="set-section">
        ${getMembers().length < 2
          ? `<button class="hh-row" data-count="2"><span class="hh-plus" aria-hidden="true">+</span><span class="hh-row-txt"><b>Ajouter une personne</b><span>Mêmes plats, portions calculées pour chacun</span></span><span class="hb-chev">›</span></button>`
          : `<div class="hh-members">${getMembers().map(m => `<div class="hh-mem"><b>${esc(m.name || 'Sans prénom')}</b><span>${m.sex === 'female' ? 'Femme' : 'Homme'}, ${m.age} ans</span></div>`).join('')}</div>
             <button class="hh-row hh-remove" data-count="1"><span class="hh-row-txt"><b>Retirer ${esc(getMembers()[1].name || 'la deuxième personne')} du foyer</b><span>Sa fiche et ses repas prévus seront effacés</span></span><span class="hb-chev">›</span></button>`}
        <div class="budget-row">
          <div><b>Budget des courses</b><span>Par semaine, pour tout le foyer</span></div>
          <div class="field-control">
            <button class="mrow-btn bud-btn" data-delta="-5" aria-label="Budget : moins">−</button>
            <span class="bud-val">${weekBudget()} €</span>
            <button class="mrow-btn bud-btn" data-delta="5" aria-label="Budget : plus">+</button>
          </div>
        </div>
      </div>

      ` },
      cuisine:  { title: 'Ma cuisine', html: `
      <div class="set-section">
        ${equipmentBlock(getHousehold().equipment)}
      </div>

      ` },
      donnees:  { title: 'Mes données', html: `
      <div class="set-section">
        <div class="bk-card">
          <p>Tout est enregistré sur ce téléphone, photos comprises. Garde une copie dans tes fichiers (iCloud, Drive…) pour ne rien perdre.</p>
          <div class="bk-btns"><button class="hb-btn hb-btn-primary" data-backup>Sauvegarder</button><button class="hb-btn bk-sec" data-restore>Restaurer</button></div>
          <span class="bk-last">Dernière sauvegarde : ${lastBackupText()}</span>
          <input type="file" accept=".json,application/json" data-restore-file hidden>
        </div>
      </div>

      ` },
    };
    const sec = section && SECTIONS[section];
    view.innerHTML = sec ? `
      <div class="page-head">
        <button class="round-back pf-up" aria-label="Retour à Mon profil"><svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg></button>
        <div class="hb-page-title">${sec.title}</div>
      </div>
      ${sec.who ? whoSwitch() : ''}
      <div class="pf-sec pf-${section}">${sec.html}</div>
      <button class="hb-btn pf-up pf-up-bottom">Retour à Mon profil</button>` : `
      <div class="page-head">
        <button class="hb-back round-back" aria-label="Retour à ma semaine"><svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg></button>
        <div class="hb-page-title">Mon profil</div>
      </div>
      ${whoSwitch()}
      <div class="idf">
        <div class="idf-band"><span>Fiche Hébé</span><span>N° ${String(getMembers().findIndex(x => x.id === member.id) + 1).padStart(3, '0')}</span></div>
        <div class="idf-body">
          <div class="idf-photo">${idPhoto(member.sex)}</div>
          <div class="idf-fields">
            <button class="idf-f idf-full" data-edit="name"><span>Prénom</span><b class="idf-name">${esc(member.name || 'Sans prénom')}</b></button>
            <button class="idf-f" data-edit="age"><span>Âge</span><b>${profile.age} ans</b></button>
            <button class="idf-f" data-edit="height"><span>Taille</span><b>${String(profile.height).replace('.', ',')} m</b></button>
            <button class="idf-f" data-edit="weight"><span>Poids</span><b>${String(profile.weight).replace('.', ',')} kg</b></button>
            <button class="idf-f" data-edit="bodyfat"><span>Masse grasse</span><b>${String(profile.bodyfat).replace('.', ',')} %</b></button>
            <button class="idf-f idf-full" data-edit="activity"><span>Quotidien</span><b>${(ACTIVITY.find(a => a.level === profile.activity) || ACTIVITY[1]).label}</b></button>
          </div>
        </div>
      </div>
      ${dayCard()}
      <div class="pf-group">
        ${pfRow('objectif', 'terra', ICONS.objectif, 'Mon objectif', objSummary())}
        ${pfRow('repas', 'honey', ICONS.repas, 'Mes repas', repasSummary(member))}
        ${pfRow('semaine', 'leaf', ICONS.semaine, 'Ma semaine', semaineSummary())}
      </div>
      <div class="pf-group">
        ${pfRow('foyer', 'sky', ICONS.foyer, 'Mon foyer', foyerSummary())}
        ${pfRow('cuisine', 'sage', ICONS.cuisine, 'Ma cuisine', cuisineSummary())}
        ${pfRow('donnees', 'sage', ICONS.donnees, 'Mes données', `Dernière sauvegarde : ${lastBackupText()}`)}
      </div>
      <button class="sci-link pf-sci" data-science>Comment Hébé calcule tes besoins</button>
    `;

    bind();
    if (!firstRender) window.scrollTo(0, keepY);
    firstRender = false;
  }

  // Modifier une valeur de la fiche : un panneau s'ouvre en bas de l'écran
  const EDIT = {
    age:     { title: 'Ton âge',          unit: 'ans', step: 1,    min: 18,  max: 99 },
    height:  { title: 'Ta taille',        unit: 'm',   step: 0.01, min: 1.3, max: 2.3 },
    weight:  { title: 'Ton poids',        unit: 'kg',  step: 0.5,  min: 35,  max: 250 },
    bodyfat: { title: 'Ta masse grasse',  unit: '%',   step: 1,    min: 5,   max: 60 },
  };
  const fmt = v => String(Math.round(v * 100) / 100).replace('.', ',');
  function openEdit(k) {
    if (k === 'name') {
      openSheet(`<div class="sheet-handle"></div><div class="hb-sheet-pad edit-sheet"><div class="hb-h2">Ton prénom</div>
        <input class="edit-name" value="${esc(getActiveMember().name || '')}" maxlength="30" autocomplete="off">
        <button class="hb-btn hb-btn-primary edit-save">Enregistrer</button></div>`);
      const sh = document.getElementById('sheet'), inp = sh.querySelector('.edit-name');
      setTimeout(() => inp.focus(), 50);
      sh.querySelector('.edit-save').addEventListener('click', () => { const v = inp.value.trim(); if (v) updateActiveMember({ name: v }); closeSheet(); render(); });
      return;
    }
    if (k === 'protocol') {
      openSheet(`<div class="sheet-handle"></div><div class="hb-sheet-pad edit-sheet"><div class="hb-h2">Ton objectif</div>${goalPicker(profile, protocolId)}</div>`);
      const sh = document.getElementById('sheet');
      const redraw = () => {
        sh.querySelector('.gp').outerHTML = goalPicker(profile, protocolId);
        bindGoalPicker(sh, () => protocolId, pick);
        sh.querySelector('.gp-res')?.addEventListener('click', () => openProtocolSheet(profile, protocolId, { isCurrent: true, onChoose: chooseProtocol }));
      };
      const pick = pid => { chooseProtocol(pid); redraw(); };
      redraw();
      return;
    }
    if (k === 'activity') {
      openSheet(`<div class="sheet-handle"></div><div class="hb-sheet-pad edit-sheet"><div class="hb-h2">Ton quotidien</div>${activityPicker(profile, profile.sex)}</div>`);
      const sh = document.getElementById('sheet');
      const redraw = () => { sh.querySelector('.actp').outerHTML = activityPicker(profile, profile.sex); bindActivityPicker(sh, () => profile, onAct); };
      const onAct = patch => {
        Object.assign(profile, patch); saveProfile(profile); applyComputed(); redraw();
        if (patch.activity) render();
      };
      bindActivityPicker(sh, () => profile, onAct);
      return;
    }
    const E = EDIT[k]; let v = profile[k];
    openSheet(`<div class="sheet-handle"></div><div class="hb-sheet-pad edit-sheet"><div class="hb-h2">${E.title}</div>
      <div class="edit-step"><button class="edit-btn" data-d="-1" aria-label="Moins">−</button>
        <label class="edit-val"><input class="edit-input" inputmode="decimal" value="${fmt(v)}"><span>${E.unit}</span></label>
        <button class="edit-btn" data-d="1" aria-label="Plus">+</button></div>
      ${k === 'bodyfat' ? bodyfatButton(profile.sex) : ''}
      <button class="hb-btn hb-btn-primary edit-save">Enregistrer</button></div>`);
    const sh = document.getElementById('sheet'), inp = sh.querySelector('.edit-input');
    const read = () => { let x = parseFloat(inp.value.replace(',', '.')); if (k === 'height' && x > 3) x = x / 100; return x; };
    sh.querySelectorAll('.edit-btn').forEach(b => b.addEventListener('click', () => {
      const x = isNaN(read()) ? v : read();
      inp.value = fmt(Math.min(E.max, Math.max(E.min, Math.round((x + E.step * +b.dataset.d) * 100) / 100)));
    }));
    sh.querySelector('.bf-guide-btn')?.addEventListener('click', () => { closeSheet(); openBodyfatGuide(profile.bodyfat, b => { profile.bodyfat = b; saveProfile(profile); applyComputed(); render(); toast(`Masse grasse : ${b} %`); }, profile.sex); });
    sh.querySelector('.edit-save').addEventListener('click', () => {
      const x = read();
      if (isNaN(x) || x < E.min || x > E.max) { toast(`Indique une valeur entre ${fmt(E.min)} et ${fmt(E.max)} ${E.unit}`, 'warn'); return; }
      profile[k] = Math.round(x * 100) / 100; saveProfile(profile); applyComputed(); closeSheet(); render();
    });
  }

  function bind() {
    view.querySelector('[data-science]')?.addEventListener('click', openScienceSheet); // v236
    view.querySelector('[data-backup]')?.addEventListener('click', async () => {
      await exportBackup();
      const last = view.querySelector('.bk-last'); if (last) last.textContent = `Dernière sauvegarde : ${lastBackupText()}`;
    });
    const fileIn = view.querySelector('[data-restore-file]');
    view.querySelector('[data-restore]')?.addEventListener('click', () => fileIn?.click());
    fileIn?.addEventListener('change', async () => { const f = fileIn.files?.[0]; fileIn.value = ''; if (f) askRestore(await f.text()); });
    view.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openEdit(b.dataset.edit)));
    view.querySelector('.hb-back')?.addEventListener('click', () => window._nav?.('week'));
    view.querySelectorAll('[data-sec]').forEach(b => b.addEventListener('click', () => goSection(b.dataset.sec)));
    view.querySelectorAll('.pf-up').forEach(b => b.addEventListener('click', () => goSection(null)));
    view.querySelector('.bf-guide-btn')?.addEventListener('click', () => openBodyfatGuide(profile.bodyfat, v => {
      profile.bodyfat = v; saveProfile(profile); applyComputed(); render();
      toast(`Masse grasse : ${v} %`);
    }, profile.sex));
    bindMeasures(view, k => profile[k], (k, v) => { profile[k] = v; saveProfile(profile); applyComputed(); render(); });
    const nameInp = view.querySelector('.id-name');
    nameInp?.addEventListener('change', () => {
      const name = nameInp.value.trim();
      if (!name) { nameInp.value = getActiveMember().name; return; }
      updateActiveMember({ name }); render();
    });
    view.querySelectorAll('[data-sex]').forEach(b => b.addEventListener('click', () => {
      if (profile.sex === b.dataset.sex) return;
      profile.sex = b.dataset.sex; saveProfile(profile); applyComputed(); render();
      toast(gx('Calculs adaptés à un profil [masculin|féminin]', profile.sex));
    }));
    bindWho(view, () => { profile = getProfile(); protocolId = getSelectedProtocol(); phaseIdx = getSelectedPhase(); render(); });
    view.querySelectorAll('[data-formula]').forEach(b => b.addEventListener('click', () => {
      if (getActiveMember().formula === b.dataset.formula) return;
      updateActiveMember({ formula: b.dataset.formula }); render();
      toast(b.dataset.formula === 'classique' ? 'Les petits-déjeuners arriveront avec la prochaine semaine générée' : 'Formule jeûne pour la prochaine semaine générée');
    }));
    view.querySelectorAll('[data-diet]').forEach(b => b.addEventListener('click', () => { updateActiveMember({ [b.dataset.diet]: +b.dataset.level }); applyEquipment(); applyDiet(); render(); }));
    view.querySelectorAll('[data-staples]').forEach(b => b.addEventListener('click', () => {
      setStaples(b.dataset.staples); applyEquipment(); applyDiet();
      const y = window.scrollY; render(); window.scrollTo(0, y);
      toast('Préférence enregistrée');
    }));
    view.querySelectorAll('[data-rep]').forEach(b => b.addEventListener('click', () => {
      setMaxRepeat(+b.dataset.rep); const y = window.scrollY; render(); window.scrollTo(0, y);
      toast('Préférence enregistrée : elle s\'applique à ta prochaine semaine');
    }));
    view.querySelectorAll('[data-soups]').forEach(b => b.addEventListener('click', () => {
      setSoups(b.dataset.soups === '1'); applyEquipment(); applyDiet(); const y = window.scrollY; render(); window.scrollTo(0, y);
      toast('Préférence enregistrée : elle s\'applique à ta prochaine semaine');
    }));
    view.querySelectorAll('[data-bk]').forEach(b => b.addEventListener('click', () => { updateActiveMember({ breakfast: b.dataset.bk }); render(); toast('Préférence enregistrée : mets à jour ta semaine depuis l\'onglet Semaine'); }));
    view.querySelectorAll('[data-whey]').forEach(b => b.addEventListener('click', () => { updateActiveMember({ whey: b.dataset.whey === '1' }); render(); toast('Préférence enregistrée : mets à jour ta semaine depuis l\'onglet Semaine'); }));
    view.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => {
      const eq = { ...(getHousehold().equipment || {}) };
      eq[b.dataset.tool] = !eq[b.dataset.tool];
      if (!eq.plaque && !eq.autocuiseur) { toast('Il faut au moins des plaques de cuisson ou un autocuiseur', 'warn'); return; }
      setEquipment(eq); applyEquipment(); applyDiet(); render();
      toast('Recettes adaptées à ton équipement');
    }));
    view.querySelectorAll('.bud-btn').forEach(b => b.addEventListener('click', () => {
      const h = getHousehold();
      h.budget = Math.max(20, Math.min(400, weekBudget() + +b.dataset.delta));
      saveHousehold(h);
      view.querySelector('.bud-val').textContent = `${h.budget} €`;
    }));
    view.querySelectorAll('[data-count]').forEach(b => b.addEventListener('click', () => {
      const n = +b.dataset.count, ms = getMembers();
      if (n === ms.length) return;
      if (n === 2) { setMemberCount(2); setOnboarded(false); window._nav?.('week'); return; } // fiche de la 2e personne à remplir
      const gone = ms[ms.length - 1];
      openSheet(`<div class="sheet-handle"></div><div class="hb-sheet-pad">
        <div class="hb-h2">Retirer ${esc(gone.name || 'la deuxième personne')} du foyer ?</div>
        <p class="hb-p">Sa fiche et ses repas prévus seront effacés. La prochaine semaine générée ne comptera qu'une personne.</p>
        <button class="hb-btn hb-btn-primary rm-yes">Retirer ${esc(gone.name || 'cette personne')}</button>
        <button class="hb-btn rm-no">Annuler</button></div>`);
      const sh = document.getElementById('sheet');
      sh.querySelector('.rm-no').addEventListener('click', closeSheet);
      sh.querySelector('.rm-yes').addEventListener('click', () => {
        setMemberCount(1); closeSheet();
        profile = getProfile(); protocolId = getSelectedProtocol(); phaseIdx = getSelectedPhase(); render();
        toast(`${gone.name || 'La deuxième personne'} ne fait plus partie du foyer`);
      });
    }));
    bindGoalPicker(view, () => protocolId, chooseProtocol);
    view.querySelector('.gp-res')?.addEventListener('click', () => openProtocolSheet(profile, protocolId, { isCurrent: true, onChoose: chooseProtocol }));
    view.querySelectorAll('.phase-step').forEach(b => b.addEventListener('click', () => {
      phaseIdx = parseInt(b.dataset.phase); saveSelectedPhase(phaseIdx); applyComputed(); render();
    }));
    view.querySelector('.back-to-plan')?.addEventListener('click', () => { applyComputed(); render(); toast('Calories du programme rétablies'); });
    view.querySelector('.set-back-bottom')?.addEventListener('click', () => window._nav?.('week'));
    const manual = view.querySelector('.set-manual');
    manual?.addEventListener('toggle', () => { manualOpen = manual.open; });

    // Met à jour une valeur sans redessiner la page (la section reste ouverte)
    const setManual = (key, value) => {
      const t = getTargets();
      t[key] = Math.max(0, Math.round(value));
      saveTargets(t);
      view.querySelector(`.mrow-input[data-key="${key}"]`).value = t[key];
      const wk = view.querySelector('.weekly-readout strong');
      if (wk) wk.textContent = `${(t.kcal * 7).toLocaleString('fr-FR')} kcal`;
      const body = view.querySelector('.manual-body');
      if (body && !body.querySelector('.back-to-plan')) {
        body.insertAdjacentHTML('afterbegin', '<button class="back-to-plan">Revenir aux calories du programme</button>');
        body.querySelector('.back-to-plan').addEventListener('click', () => { applyComputed(); render(); toast('Calories du programme rétablies'); });
      }
    };
    // Appui court : un pas. Appui long : ça défile tant que le doigt reste posé.
    view.querySelectorAll('.mrow-btn').forEach(btn => {
      const key = btn.dataset.key, delta = parseInt(btn.dataset.delta);
      let wait = null, rep = null;
      const step = () => setManual(key, getTargets()[key] + delta);
      const stop = () => { clearTimeout(wait); clearInterval(rep); wait = rep = null; };
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        step();
        wait = setTimeout(() => { rep = setInterval(step, 160); }, 450);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => btn.addEventListener(ev, stop));
      btn.addEventListener('click', e => { if (e.detail === 0) step(); }); // clavier
    });
    view.querySelectorAll('.mrow-input').forEach(inp => inp.addEventListener('change', () => {
      const v = parseInt(inp.value);
      if (!isNaN(v) && v >= 0) setManual(inp.dataset.key, v);
      else inp.value = getTargets()[inp.dataset.key];
    }));
  }

  function mrow(key, label, value, unit, step) {
    return `
      <div class="settings-field">
        <span class="field-label">${label}</span>
        <div class="field-control">
          <button class="mrow-btn" data-key="${key}" data-delta="-${step}">−</button>
          <input class="mrow-input" type="text" inputmode="decimal" data-key="${key}" value="${value}">
          <span class="field-unit">${unit}</span>
          <button class="mrow-btn" data-key="${key}" data-delta="${step}">+</button>
        </div>
      </div>`;
  }

  render();
}

// Riz et pâtes (v171) : complets, classiques ou au choix sur la fiche de chaque plat. Commun au foyer.
function staplesCard() {
  const mode = getStaples();
  const NOTES = {
    complet: `Riz complet et pâtes complètes dans tous les plats : plus de fibres, cuisson plus longue (riz : ${getEquipment()?.autocuiseur === false ? '35 min à la casserole au lieu de 12' : '20 min sous pression au lieu de 5'}).`,
    classique: 'Riz blanc et pâtes classiques dans tous les plats.',
    plat: 'Tu choisis sur la fiche de chaque plat. Par défaut : complet.',
  };
  return `<div class="dt-card dt-staples" style="--c:var(--leaf);--t:var(--leaf-t)">
    <div class="dt-top"><b>Riz et pâtes</b></div>
    <div class="dt-seg" role="radiogroup" aria-label="Riz et pâtes">
      ${[['complet', 'Complets'], ['classique', 'Classiques'], ['plat', 'Plat par plat']].map(([v, l]) =>
        `<button class="dt-btn ${mode === v ? 'on' : ''}" data-staples="${v}" role="radio" aria-checked="${mode === v}">${l}</button>`).join('')}
    </div>
    <p class="dt-note">${NOTES[mode]}</p>
  </div>`;
}

// ── Sauvegarde et restauration des données (v193) ──
// Tout ce que l'app enregistre sur le téléphone commence par « hebe_ » ou « diet_ » (fiches, semaine, notes, placard, journal…).
const BACKUP_PREFIXES = ['hebe_', 'diet_'];
const isAppKey = k => BACKUP_PREFIXES.some(p => k.startsWith(p));
const frDate = d => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
function lastBackupText() {
  const d = localStorage.getItem('hebe_last_backup');
  if (!d) return 'jamais';
  const day = x => new Date(x).toDateString();
  return day(d) === day(Date.now()) ? 'aujourd\'hui' : `le ${frDate(d)}`;
}
async function exportBackup() {
  const date = new Date().toISOString();
  localStorage.setItem('hebe_last_backup', date);
  const data = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (isAppKey(k)) data[k] = localStorage.getItem(k); }
  const photos = await exportPhotos(); // v229 : les photos du mois voyagent avec la sauvegarde
  const json = JSON.stringify({ app: 'hebe', version: 1, date, data, ...(photos.length ? { photos } : {}) });
  const name = `hebe-sauvegarde-${date.slice(0, 10)}.json`;
  const file = new File([json], name, { type: 'application/json' });
  // sur téléphone : la fenêtre de partage (Enregistrer dans Fichiers, iCloud, Drive…) ; sinon, un téléchargement
  try {
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: 'Sauvegarde Hébé' }); toast('Sauvegarde créée'); return; }
  } catch (e) { if (e?.name === 'AbortError') return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Sauvegarde créée');
}
export function askRestore(text) {
  let backup;
  try { backup = JSON.parse(text); } catch { backup = null; }
  if (!backup || backup.app !== 'hebe' || !backup.data || typeof backup.data !== 'object') { toast('Ce fichier n\'est pas une sauvegarde Hébé', 'warn'); return; }
  openSheet(`<div class="sheet-handle"></div><div class="hb-sheet-pad bk-confirm">
      <div class="hb-h2">Restaurer cette sauvegarde ?</div>
      <p>Sauvegarde du ${frDate(backup.date)}. Elle remplacera tout ce qui est sur ce téléphone : fiches, semaine, notes des plats, placard${Array.isArray(backup.photos) ? ', photos' : ''}.</p>
      <div class="bk-btns"><button class="hb-btn bk-sec" data-bk-cancel>Annuler</button><button class="hb-btn hb-btn-primary" data-bk-ok>Restaurer</button></div>
    </div>`);
  const sheet = document.getElementById('sheet');
  sheet.querySelector('[data-bk-cancel]').addEventListener('click', () => closeSheet());
  sheet.querySelector('[data-bk-ok]').addEventListener('click', async () => {
    const old = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (isAppKey(k)) old.push(k); }
    old.forEach(k => localStorage.removeItem(k));
    Object.entries(backup.data).forEach(([k, v]) => { if (isAppKey(k) && typeof v === 'string') localStorage.setItem(k, v); });
    if (Array.isArray(backup.photos)) { try { await importPhotos(backup.photos); } catch {} }
    closeSheet();
    location.reload();
  });
}

import { openBodyfatGuide, torso } from './bodyfat.js';
import { toast, openSheet, closeSheet } from './utils.js';
// settings.js — Profil + choix de programme (Zero to Hero) + objectifs
import { getTargets, saveTargets } from '../data/user.js';
import {
  PROTOCOLS, computeBase, computeTargets, computeAllPhases,
  getProfile, saveProfile, getSelectedProtocol, saveSelectedProtocol,
  getSelectedPhase, saveSelectedPhase,
} from '../data/calculator.js';
import { el } from './utils.js';


// ── Fiche détaillée d'un programme ──
const kgWeek = off => off * 7 / 7700; // ~7 700 kcal par kg
function paceShort(p) {
  if (p.id === 'P2') return '≈ stable';
  const v = p.phases.map(x => x.offset).filter(Boolean).map(o => Math.abs(kgWeek(o)).toFixed(1).replace('.', ','));
  const sign = p.phases.some(x => x.offset > 0) ? '+' : '−';
  return v.length > 1 ? `${sign}${v[0]} à ${v[v.length - 1]} kg` : `${sign}${v[0]} kg`;
}
function paceText(p) {
  if (p.id === 'P2') return 'poids à peu près stable';
  const v = p.phases.map(x => x.offset).filter(Boolean).map(o => Math.abs(kgWeek(o)).toFixed(1).replace('.', ','));
  const dir = p.phases.some(x => x.offset > 0) ? 'de prise' : 'de perte';
  return v.length > 1 ? `${v[0]} à ${v[v.length - 1]} kg ${dir} par semaine` : `${v[0]} kg ${dir} par semaine`;
}

// Graphique 1 : calories de chaque étape par rapport à la maintenance (escalier)
function kcalChart(ph, maint) {
  const W = 330, H = 160, padL = 8, padR = 8, top = 26, bottom = 30;
  const vals = ph.map(x => x.targets.kcal);
  const lo = Math.min(maint, ...vals) - 120, hi = Math.max(maint, ...vals) + 120;
  const y = v => top + (hi - v) / (hi - lo) * (H - top - bottom);
  const n = ph.length, segW = (W - padL - padR) / n;
  const yM = y(maint);
  const segs = ph.map((x, i) => {
    const x0 = padL + i * segW + 6, x1 = padL + (i + 1) * segW - 6, yv = y(x.targets.kcal);
    const area = `<rect x="${x0}" y="${Math.min(yv, yM)}" width="${x1 - x0}" height="${Math.max(2, Math.abs(yM - yv))}" class="kc-area"/>`;
    return `${area}<line x1="${x0}" y1="${yv}" x2="${x1}" y2="${yv}" class="kc-line"/>
      <text x="${(x0 + x1) / 2}" y="${yv - 8}" class="kc-val">${x.targets.kcal}</text>
      <text x="${(x0 + x1) / 2}" y="${H - 10}" class="kc-lbl">${i === 0 ? 'Départ' : 'Étape ' + i}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="pf-chart" role="img" aria-label="Calories par étape">
    ${segs}
    <line x1="0" y1="${yM}" x2="${W}" y2="${yM}" class="kc-maint"/>
    <text x="${W - 4}" y="${vals.some(v => v > maint) ? yM + 14 : yM - 6}" class="kc-maint-lbl">Maintenance ${maint}</text>
  </svg>`;
}

// Graphique 2 : répartition protéines / lipides / glucides (en kcal) pour chaque étape
function macroChart(ph) {
  const max = Math.max(...ph.map(x => x.targets.kcal));
  return `<div class="mc">
    ${ph.map((x, i) => {
      const t = x.targets, P = t.protein * 4, F = t.fat * 9, C = t.carbs * 4;
      const w = v => (v / max * 100).toFixed(1);
      return `<div class="mc-row">
        <span class="mc-lbl">${i === 0 ? 'Départ' : 'Étape ' + i}</span>
        <span class="mc-bar">
          <i class="p" style="width:${w(P)}%">${t.protein} g</i><i class="f" style="width:${w(F)}%">${t.fat} g</i><i class="c" style="width:${w(C)}%">${t.carbs} g</i>
        </span>
      </div>`;
    }).join('')}
    <div class="mc-legend"><span class="p">Protéines</span><span class="f">Lipides</span><span class="c">Glucides</span></div>
  </div>`;
}

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

  function render() {
    const base     = computeBase(profile);
    const phases   = computeAllPhases(profile, protocolId);
    const protocol = PROTOCOLS.find(p => p.id === protocolId);
    phaseIdx = Math.min(phaseIdx, protocol.phases.length - 1);
    const active   = phases[phaseIdx];
    const current  = getTargets();
    const isComputed = !localStorage.getItem('diet_targets') ||
      JSON.stringify(current) === JSON.stringify(computeTargets(profile, protocolId, phaseIdx));

    view.innerHTML = `
      <div class="hb-subhead"><button class="hb-back">‹ Semaine</button><div class="hb-page-title">Mon programme</div></div>
      <div class="set-hero">
        <div class="set-hero-label">Ce que tu dépenses par jour</div>
        <div class="set-hero-kcal">${Math.round(base.maintenance)}<span>kcal</span></div>
        <div class="set-hero-meta">C'est ton point d'équilibre : en mangeant ça, ton poids ne bouge pas. Calculé avec ta masse maigre de ${base.leanMass.toFixed(1).replace('.', ',')} kg.</div>
      </div>

      <!-- PROFIL -->
      <div class="set-section">
        <div class="set-section-head">Tes informations</div>
        <div class="profile-grid">
          ${pcell('age',     'Âge',          profile.age,     'ans', 1)}
          ${pcell('height',  'Taille',       profile.height,  'm',   0.01)}
          ${pcell('weight',  'Poids',        profile.weight,  'kg',  0.5)}
          ${pcell('bodyfat', 'Masse grasse', profile.bodyfat, '%',   1)}
        </div>
        <button class="bf-guide-btn">
          <span class="bf-guide-ic">${torso(20)}</span>
          <span><b>Estimer ta masse grasse en images</b><span>Compare-toi à des silhouettes de 8 à 40 %</span></span>
          <span class="hb-chev">›</span>
        </button>
      </div>

      <!-- PROTOCOLE -->
      <div class="set-section">
        <div class="set-section-head">Ton objectif</div>
        <div class="protocol-grid">
          ${PROTOCOLS.map(p => {
            const range = phaseRange(profile, p.id);
            return `
            <button class="proto-card pc-${p.id} ${p.id === protocolId ? 'active' : ''}" data-pid="${p.id}">
              <div class="proto-head">
                <div class="proto-name">${p.name}</div>
                <span class="proto-info" data-sheet="${p.id}" role="button" tabindex="0" aria-label="En savoir plus sur ${p.name}">i</span>
              </div>
              <div class="proto-tagline">${p.tagline}</div>
              <div class="proto-range">${range}</div>
              <div class="proto-check">✓</div>
            </button>`;
          }).join('')}
        </div>
      </div>

      <!-- PHASES -->
      <div class="set-section">
        <div class="set-section-head">Ta progression</div>
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
        </div>

        <div class="phase-guide">
          <div class="pg-row"><div><div class="pg-title">Cette phase</div><div class="pg-text">${protocol.phases[phaseIdx].advice}</div></div></div>
          <div class="pg-row"><div><div class="pg-title">Quand passer à la suite</div><div class="pg-text">${protocol.phases[phaseIdx].advance}</div></div></div>
        </div>

      </div>

      <!-- MANUEL -->
      <details class="set-manual" ${manualOpen ? 'open' : ''}>
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

      <button class="hb-btn set-back-bottom">Retour à ma semaine</button>
    `;
    bind();
  }

  function openProtocolSheet(pid) {
    const p = PROTOCOLS.find(x => x.id === pid);
    const ph = computeAllPhases(profile, pid);
    const maint = Math.round(computeBase(profile).maintenance);
    const isCurrent = pid === protocolId;
    const stepName = (x, i) => i === 0 ? x.label : `${x.label} <em>facultative</em>`;
    const last = ph.length - 1;
    openSheet(`
      <div class="sheet-handle"></div>
      <div class="hb-sheet-pad pf pc-${p.id}">
        <div class="pf-hero">
          <div class="hb-h2">${p.name}</div>
          <p class="pf-tag">${p.tagline}</p>
          <div class="pf-stats">
            <div><b>${paceShort(p)}</b><span>par semaine</span></div>
            <div><b>${ph.length}</b><span>${ph.length > 1 ? 'étapes' : 'étape'}</span></div>
            <div><b>${p.duration.replace(', puis bilan', '')}</b><span>durée</span></div>
          </div>
        </div>

        <div class="pf-block">
          <div class="pf-h">À quoi sert ce programme</div>
          <p class="pf-purpose">${p.purpose}</p>
          <div class="pf-who">
            <div class="pf-who-h">C'est pour toi si…</div>
            ${p.forWho.map(t => `<div class="pf-who-i">${t}</div>`).join('')}
          </div>
        </div>

        <div class="pf-block">
          <div class="pf-h">Tes calories</div>
          ${kcalChart(ph, maint)}
        </div>

        <div class="pf-block">
          <div class="pf-h">Ton assiette</div>
          ${macroChart(ph)}
          <p class="pf-note">Seuls les glucides changent d'une étape à l'autre.</p>
        </div>

        <div class="pf-block">
          <div class="pf-h">Les étapes</div>
          <p class="pf-intro">${ph.length > 1
            ? `Tu commences à ${ph[0].targets.kcal} kcal par jour. Les étapes suivantes sont facultatives : tu ne passes à la suivante que si tes résultats stagnent.`
            : `Tu restes à ${ph[0].targets.kcal} kcal par jour pendant toute la durée du programme.`}</p>
          <div class="tl">
            ${ph.map((x, i) => {
              const w = p.phases[i].when || '';
              const final = /^Dernier palier/.test(w) || ph.length === 1;
              return `<div class="tl-item">
                <span class="tl-dot">${i + 1}</span>
                <div class="tl-body">
                  <div class="tl-top"><b>${i === 0 ? 'Départ' : 'Étape ' + i}${i > 0 ? '<em>facultative</em>' : ''}</b><span>${x.targets.kcal} kcal</span></div>
                  <div class="tl-short">${p.phases[i].short || ''}</div>
                  ${w ? `<div class="tl-when ${final ? 'final' : ''}"><span>${final ? (ph.length === 1 ? 'À faire' : 'Dernier palier') : 'Étape suivante si'}</span>${(t => t.charAt(0).toUpperCase() + t.slice(1))(w.replace(/^Dernier palier : /, ''))}</div>` : ''}
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>

        <button class="hb-btn ${isCurrent ? '' : 'hb-btn-primary'} pf-choose">${isCurrent ? 'Programme actuel' : 'Choisir ce programme'}</button>
      </div>`);
    const sheet = document.getElementById('sheet');
    sheet.querySelector('.pf-choose').addEventListener('click', () => {
      if (!isCurrent) {
        protocolId = pid; phaseIdx = 0;
        saveSelectedProtocol(protocolId); saveSelectedPhase(0); applyComputed();
        toast(`Programme : ${p.name}`);
      }
      closeSheet(); render();
    });
  }

  function phaseRange(prof, pid) {
    const ph = computeAllPhases(prof, pid);
    if (ph.length === 1) return `${ph[0].targets.kcal} kcal`;
    const kcals = ph.map(p => p.targets.kcal);
    return `${kcals[0]} → ${kcals[kcals.length - 1]} kcal`; // dans l'ordre des phases
  }

  function bind() {
    view.querySelector('.hb-back')?.addEventListener('click', () => window._nav?.('week'));
    view.querySelector('.bf-guide-btn')?.addEventListener('click', () => openBodyfatGuide(profile.bodyfat, v => {
      profile.bodyfat = v; saveProfile(profile); applyComputed(); render();
      toast(`Masse grasse : ${v} %`);
    }));
    view.querySelectorAll('.pcell-btn').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.key, d = parseFloat(b.dataset.delta);
      profile[k] = Math.max(0, Math.round((profile[k] + d) * 100) / 100);
      saveProfile(profile); applyComputed(); render();
    }));
    view.querySelectorAll('.pcell-input').forEach(inp => inp.addEventListener('change', () => {
      const v = parseFloat(inp.value.replace(',', '.'));
      if (!isNaN(v) && v >= 0) { profile[inp.dataset.key] = v; saveProfile(profile); applyComputed(); }
      render();
    }));
    view.querySelectorAll('.proto-card').forEach(b => b.addEventListener('click', e => {
      if (e.target.closest('[data-sheet]')) return openProtocolSheet(b.dataset.pid);
      if (b.dataset.pid === protocolId) return;
      protocolId = b.dataset.pid; phaseIdx = 0;
      saveSelectedProtocol(protocolId); saveSelectedPhase(0); applyComputed(); render();
    }));
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

  function pcell(key, label, value, unit, step) {
    return `
      <div class="profile-cell">
        <div class="pc-label">${label}</div>
        <div class="pc-control">
          <button class="pcell-btn" data-key="${key}" data-delta="-${step}">−</button>
          <div class="pc-value"><input class="pcell-input" type="text" inputmode="decimal" data-key="${key}" value="${value}"><span class="pc-unit">${unit}</span></div>
          <button class="pcell-btn" data-key="${key}" data-delta="${step}">+</button>
        </div>
      </div>`;
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

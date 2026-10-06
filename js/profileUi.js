// profileUi.js — Morceaux d'interface partagés entre « Mon programme » et l'accueil.
// Même rendu aux deux endroits : mesures, prénom et sexe, activité, cartes des programmes.

import { ACTIVITY, getMembers, getActiveMember, setActiveMember } from '../data/household.js';
import { computeAllPhases, protocolsFor, protocolFor, computeBase, kgPerWeek } from '../data/calculator.js';
import { openSheet, closeSheet } from './utils.js';
import { TOOLS, countPossible } from './adapt.js';
import { torso, bodyfatRange } from './bodyfat.js';

export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Case de mesure avec − et +
export function pcell(key, label, value, unit, step) {
  const shown = value ?? '';
  return `
    <div class="profile-cell">
      <div class="pc-label">${label}</div>
      <div class="pc-control">
        <button class="pcell-btn" data-key="${key}" data-delta="-${step}" aria-label="${label} : moins">−</button>
        <div class="pc-value"><input class="pcell-input" type="text" inputmode="decimal" data-key="${key}" value="${shown}" placeholder="–" aria-label="${label}" style="width:${Math.max(1, String(shown).length) + 0.2}ch"><span class="pc-unit">${unit}</span></div>
        <button class="pcell-btn" data-key="${key}" data-delta="${step}" aria-label="${label} : plus">+</button>
      </div>
    </div>`;
}

export function measuresGrid(p) {
  return `<div class="profile-grid">
    ${pcell('age', 'Âge', p.age, 'ans', 1)}
    ${pcell('height', 'Taille', p.height, 'm', 0.01)}
    ${pcell('weight', 'Poids', p.weight, 'kg', 0.5)}
    ${pcell('bodyfat', 'Masse grasse', p.bodyfat, '%', 1)}
  </div>`;
}

export function bodyfatButton(sex) {
  sex = sex || 'male';
  return `<button class="bf-guide-btn">
    <span class="bf-guide-ic">${torso(sex === 'female' ? 25 : 20, sex)}</span>
    <span><b>Estimer ta masse grasse en images</b><span>Compare-toi à des silhouettes ${bodyfatRange(sex)}</span></span>
    <span class="hb-chev">›</span>
  </button>`;
}

// Illustrations (dessins vectoriels légers, même esprit que les silhouettes du guide)
// Portraits : les mêmes personnages que l'illustration du foyer (lui à lunettes et barbe, elle aux cheveux ondulés).
// Calculés à l'appel (les fonctions de dessin sont définies plus bas dans ce fichier).
const avFrame = (inner, id) => `<svg viewBox="0 0 200 196" class="av-svg" aria-hidden="true"><defs><clipPath id="${id}"><circle cx="100" cy="100" r="92"/></clipPath></defs><circle cx="100" cy="100" r="92" fill="#fff" opacity=".7"/><g clip-path="url(#${id})">${inner}</g></svg>`;
let avSeq = 0;
const AV_NONE = `<svg viewBox="0 0 200 196" class="av-svg" aria-hidden="true"><circle cx="100" cy="100" r="92" fill="#fff" opacity=".7"/>
  <path d="M40 196 C42 150 66 134 100 134 C134 134 158 150 160 196 Z" fill="#A9C2B2"/><circle cx="100" cy="80" r="32" fill="#D4DBCB"/></svg>`;
// Personnages illustrés (v151) : images détourées dans img/art
const ART_IMG = { male: 'img/art/man.webp', female: 'img/art/woman.webp' };
// Photo d'identité : le personnage seul, sur fond blanc
export const idPhoto = sex => (ART_IMG[sex] ? `<img class="idf-img" src="${ART_IMG[sex]}" alt="">` : AV_NONE);
// Avatar rond : le personnage sur son fond de couleur
export const avatar = sex => (ART_IMG[sex] ? `<span class="av-svg av-pic av-${sex === 'male' ? 'm' : 'f'}" aria-hidden="true"><img src="${ART_IMG[sex]}" alt=""></span>` : AV_NONE);

// Prénom et sexe : deux grandes cartes illustrées
export function identityBlock(member, { error = '', sex = true } = {}) {
  const card = (sex, label, tint) => `
    <button class="sx-card ${member.sex === sex ? 'on' : ''}" data-sex="${sex}" role="radio" aria-checked="${member.sex === sex}" style="--c:var(${tint.slice(0, -2)});--t:var(${tint})">
      ${avatar(sex)}<b>${label}</b><span class="sel-check" aria-hidden="true"></span>
    </button>`;
  return `<div class="id-block">
    <label class="id-field">
      <span class="pc-label">Prénom</span>
      <input class="id-name" type="text" autocomplete="given-name" maxlength="24" placeholder="Ton prénom" value="${esc(member.name)}">
    </label>
    ${sex ? `<div class="sx-grid" role="radiogroup" aria-label="Profil">
      ${card('male', 'Un homme', '--leaf-t')}${card('female', 'Une femme', '--honey-t')}
    </div>` : ''}
    ${error ? `<p class="wl-error" role="alert">${error}</p>` : ''}
  </div>`;
}

// Nombre de personnes : une ou deux assiettes
export function householdCards(n, photo = 'W05') {
  const img = `img/dishes/${photo}.webp`;
  const card = (k, title, sub, tint, plates) => `
    <button class="hh-card ${n === k ? 'on' : ''}" data-count="${k}" role="radio" aria-checked="${n === k}" style="--c:var(${tint.slice(0, -2)});--t:var(${tint})">
      <span class="hh-plates hh-${k}" aria-hidden="true">${plates}</span>
      <span class="hh-txt"><b>${title}</b><span>${sub}</span></span>
      <span class="sel-check" aria-hidden="true"></span>
    </button>`;
  return `<div class="hh-list" role="radiogroup" aria-label="Nombre de personnes">
    ${card(1, 'Pour moi', 'Une fiche, tes portions.', '--honey-t', '<span class="hh-art hh-art-1"></span>')}
    ${card(2, 'Pour nous deux', 'Deux fiches, deux portions, une seule session de cuisine.', '--terra-t', '<span class="hh-art hh-art-2"></span>')}
  </div>`;
}

// Illustrations faites main (SVG), style des avatars
const SK = 'stroke="#2A3A30" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"';
// Personnages dessinés du foyer : lui (lunettes, barbe) seul, puis en couple
const HL = '#2A3A30';
// Lui : cheveux bruns en banane, peau claire, polo vert sauge (v143)
const GUY_INNER = `<g> <path d="M32 196 C34 146 60 126 100 126 C140 126 166 146 168 196 Z" fill="#7C9885"/> <path d="M32 196 C34 158 44 142 58 134 C54 150 53 172 54 196 Z" fill="#6A8573"/><path d="M146 196 C147 172 146 150 142 134 C156 142 166 158 168 196 Z" fill="#6A8573"/> <path d="M92 124 L100 144 L108 124 Z" fill="#EBC9AE"/> <path d="M86 121 L82 134 L97 137 L100 127 Z" fill="#A9C2B2" stroke="#5F7B68" stroke-width="1.6" stroke-linejoin="round"/> <path d="M114 121 L118 134 L103 137 L100 127 Z" fill="#A9C2B2" stroke="#5F7B68" stroke-width="1.6" stroke-linejoin="round"/> <path d="M100 144 V160" stroke="#5F7B68" stroke-width="1.6"/><circle cx="100" cy="150" r="1.6" fill="#F6F1E6"/><circle cx="100" cy="157" r="1.6" fill="#F6F1E6"/> <path d="M88 102 h24 v20 c0 8 -24 8 -24 0 Z" fill="#EBC9AE"/><path d="M88 108 c6 6 18 6 24 0 v-6 h-24 Z" fill="#DDB497"/> <ellipse cx="66" cy="78" rx="6.5" ry="9.5" fill="#F0D2BA"/><ellipse cx="134" cy="78" rx="6.5" ry="9.5" fill="#F0D2BA"/> <path d="M65 74 q3 4 0 8 M135 74 q-3 4 0 8" fill="none" stroke="#D9AE90" stroke-width="2" stroke-linecap="round"/> <path d="M68 70 C68 47 82 36 100 36 C118 36 132 47 132 70 C132 93 121 110 100 110 C79 110 68 93 68 70 Z" fill="#F7DFCB"/> <ellipse cx="80" cy="86" rx="7" ry="4.5" fill="#EFA898" opacity=".35"/><ellipse cx="120" cy="86" rx="7" ry="4.5" fill="#EFA898" opacity=".35"/> <path d="M67 64 C64 46 74 34 88 30 C96 22 116 20 126 30 C136 38 137 52 133 64 C130 56 124 51 116 50 C106 49 96 52 86 51 C78 53 71 57 67 64 Z" fill="#4A3529"/> <path d="M90 32 C100 24 116 24 124 32" fill="none" stroke="#6E5444" stroke-width="2.6" stroke-linecap="round"/><path d="M94 40 C104 33 116 33 124 40" fill="none" stroke="#6E5444" stroke-width="1.8" stroke-linecap="round" opacity=".7"/> <path d="M67 62 C67 68 67.5 74 68.5 79 L71 79 C70 74 70 68 71 63 Z" fill="#4A3529"/><path d="M133 62 C133 68 132.5 74 131.5 79 L129 79 C130 74 130 68 129 63 Z" fill="#4A3529"/> <path d="M76 59 C81 55.5 88 55.5 93 58 M107 58 C112 55.5 119 55.5 124 59" fill="none" stroke="#3A2A20" stroke-width="3.4" stroke-linecap="round"/> <ellipse cx="85" cy="70.5" rx="2.9" ry="3.3" fill="#2E241E"/><ellipse cx="115" cy="70.5" rx="2.9" ry="3.3" fill="#2E241E"/> <circle cx="86" cy="69.4" r=".9" fill="#fff"/><circle cx="116" cy="69.4" r=".9" fill="#fff"/> <path d="M100 73 C98.5 80 96.5 84 99 85.5 C101 86.3 103.5 85.6 104.5 84.5" fill="none" stroke="#D2A285" stroke-width="2.2" stroke-linecap="round"/> <path d="M91 95 Q100 102 109 95" fill="none" stroke="#C46F63" stroke-width="2.6" stroke-linecap="round"/> </g>`;
function hhGuy(x = 100, y = 0, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s}) translate(-100 0)">${GUY_INNER}</g>`;
}
function hhHer(x = 100, y = 0, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s}) translate(-100 0) rotate(-5 100 120)">
    <!-- cheveux arrière, ondulés jusqu'aux épaules -->
    <path d="M60 78 C54 40 76 26 100 26 C126 26 146 42 140 80 C146 104 144 128 134 140 C128 132 124 128 120 126 L80 126 C76 128 72 132 66 140 C56 128 54 104 60 78 Z" fill="#8A5A3C"/>
    <path d="M62 104 C58 118 60 130 66 140 M138 104 C142 118 140 130 134 140" fill="none" stroke="#744A31" stroke-width="2.4" stroke-linecap="round"/>
    <!-- buste : haut col en V -->
    <path d="M38 182 C40 148 64 132 100 132 C136 132 160 148 162 182 Z" fill="#D98E6B"/>
    <path d="M38 182 C40 160 50 148 62 141 C58 154 57 168 58 182 Z" fill="#C97D5B"/>
    <path d="M86 132 L100 152 L114 132 C110 134 90 134 86 132 Z" fill="#E6BFA0"/>
    <!-- cou -->
    <path d="M89 106 h22 v24 c0 8 -22 8 -22 0 Z" fill="#E6BFA0"/>
    <path d="M89 113 c5 6 17 6 22 0 v-5 h-22 Z" fill="#D7AA88"/>
    <!-- visage -->
    <path d="M71 74 C71 51 84 40 100 40 C116 40 129 51 129 74 C129 96 117 113 100 113 C83 113 71 96 71 74 Z" fill="#F3D7BE"/>
    <ellipse cx="82" cy="87" rx="7.5" ry="4.8" fill="#EBA594" opacity=".45"/><ellipse cx="118" cy="87" rx="7.5" ry="4.8" fill="#EBA594" opacity=".45"/>
    <!-- mèche et frange sur le côté -->
    <path d="M70 76 C67 50 82 36 102 36 C122 36 134 50 130 72 C122 62 110 54 96 51 C88 56 78 64 70 76 Z" fill="#8A5A3C"/>
    <path d="M96 51 C104 54 114 59 122 66" fill="none" stroke="#A06E4E" stroke-width="2.4" stroke-linecap="round"/>
    <!-- sourcils fins -->
    <path d="M78 63 C82 60.5 88 60.5 92 62" fill="none" stroke="#6A4430" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M108 62 C112 60.5 118 60.5 122 63" fill="none" stroke="#6A4430" stroke-width="2.6" stroke-linecap="round"/>
    <!-- yeux et cils -->
    <ellipse cx="86" cy="73" rx="2.8" ry="3.3" fill="#2E241E"/><ellipse cx="114" cy="73" rx="2.8" ry="3.3" fill="#2E241E"/>
    <circle cx="87" cy="71.9" r="0.9" fill="#fff"/><circle cx="115" cy="71.9" r="0.9" fill="#fff"/>
    
    <!-- nez et sourire -->
    <path d="M100 77 C99 83 97.5 85.5 99.5 86.5 C101 87 102.5 86.6 103.2 85.8" fill="none" stroke="#D2A386" stroke-width="2" stroke-linecap="round"/>
    <path d="M92 95 Q100 102.5 108 95 Q100 98 92 95 Z" fill="#C46F63"/>
    <!-- boucle d'oreille -->
    <circle cx="72.5" cy="90" r="2.6" fill="#E0A95E"/>
  </g>`;
}
const hhBowl = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">
    <path d="M-11 -16 q4 -6 0 -12 M0 -17 q4 -6 0 -12 M11 -16 q4 -6 0 -12" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" opacity=".9"/>
    <path d="M-24 -6 h48 c0 16 -10 25 -24 25 c-14 0 -24 -9 -24 -25 Z" fill="#F6F1E6" stroke="${HL}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M-19 -6 c4 -7 12 -8 15 -3 c4 -6 13 -6 15 0 c4 -3 9 -1 9 3 Z" fill="#E0A95E"/>
    <circle cx="-7" cy="-7" r="3.4" fill="#8FB573"/><circle cx="8" cy="-8" r="3" fill="#D98E6B"/><circle cx="1" cy="-10" r="2.4" fill="#7C9885"/>
    <path d="M-24 4 c10 4 38 4 48 0" fill="none" stroke="#E8DCC6" stroke-width="2"/>
  </g>`;
const HH1 = `<svg viewBox="0 0 200 200" aria-hidden="true"><defs><clipPath id="hh1c"><circle cx="100" cy="104" r="92"/></clipPath></defs><circle cx="100" cy="104" r="92" fill="#E4EEE6"/><g clip-path="url(#hh1c)">${hhGuy(100, 12)}</g>${hhBowl(100, 176, 0.92)}</svg>`;
const HH2 = `<svg viewBox="0 0 280 200" aria-hidden="true"><defs><clipPath id="hh2c"><rect x="6" y="14" width="268" height="182" rx="90"/></clipPath></defs><rect x="6" y="14" width="268" height="182" rx="90" fill="#FBEBE3"/><g clip-path="url(#hh2c)">${hhHer(186, 8, 0.94)}${hhGuy(98, 12)}</g>${hhBowl(98, 176, 0.82)}${hhBowl(188, 178, 0.76)}</svg>`;

const box = (inner) => `<svg viewBox="0 0 64 56" aria-hidden="true">${inner}</svg>`;
const TOOL_ART = {
  plaque: box(`<rect x="6" y="20" width="52" height="28" rx="6" fill="#F6F1E6" ${SK}/>
    <circle cx="22" cy="34" r="8" fill="none" stroke="#D98E6B" stroke-width="2.2"/><circle cx="44" cy="34" r="6" fill="none" stroke="#A9C2B2" stroke-width="2.2"/>
    <path d="M10 18 h22 c0 6 -4 9 -11 9 c-7 0 -11 -3 -11 -9 Z" fill="#7C9885" ${SK}/><path d="M32 20 h14" ${SK}/>`),
  four: box(`<rect x="8" y="6" width="48" height="44" rx="6" fill="#F6F1E6" ${SK}/>
    <path d="M8 16 h48" ${SK}/><circle cx="16" cy="11" r="2" fill="#2A3A30"/><circle cx="24" cy="11" r="2" fill="#2A3A30"/>
    <rect x="15" y="22" width="34" height="21" rx="4" fill="#FBEBE3" ${SK}/><path d="M20 36 h24" stroke="#D98E6B" stroke-width="2.2" stroke-linecap="round"/>`),
  airfryer: box(`<path d="M16 8 h32 c4 0 7 3 7 7 v28 c0 5 -4 8 -8 8 h-30 c-4 0 -8 -3 -8 -8 v-28 c0 -4 3 -7 7 -7 Z" fill="#F6F1E6" ${SK}/>
    <rect x="22" y="13" width="20" height="7" rx="3" fill="#E8F0EA" ${SK}/>
    <path d="M14 28 h36 v13 c0 3 -2 5 -5 5 h-26 c-3 0 -5 -2 -5 -5 Z" fill="#A9C2B2" ${SK}/><path d="M27 37 h10" ${SK}/>`),
  autocuiseur: box(`<path d="M12 26 h40 v16 c0 5 -4 8 -9 8 h-22 c-5 0 -9 -3 -9 -8 Z" fill="#7C9885" ${SK}/>
    <path d="M9 26 c0 -10 10 -15 23 -15 c13 0 23 5 23 15 Z" fill="#F6F1E6" ${SK}/>
    <path d="M32 11 v-4" ${SK}/><circle cx="32" cy="6" r="2.5" fill="#E0A95E" ${SK}/><path d="M6 32 h6 M52 32 h6" ${SK}/>`),
  microondes: box(`<rect x="5" y="12" width="54" height="34" rx="5" fill="#F6F1E6" ${SK}/>
    <rect x="11" y="18" width="32" height="22" rx="3" fill="#EAF3F8" ${SK}/>
    <path d="M49 20 v18" ${SK}/><circle cx="53" cy="22" r="1.8" fill="#2A3A30"/><circle cx="53" cy="29" r="1.8" fill="#2A3A30"/>
    <ellipse cx="27" cy="34" rx="9" ry="2.6" fill="#D98E6B"/>`),
  mixeur: box(`<path d="M20 6 h24 l-4 30 h-16 Z" fill="#EAF3F8" ${SK}/><path d="M23 20 h18" stroke="#D98E6B" stroke-width="5" opacity=".55"/>
    <path d="M44 12 h4 c3 0 4 2 4 4 v8 c0 2 -1 4 -4 4 h-5" fill="none" ${SK}/>
    <path d="M18 36 h28 l3 14 h-34 Z" fill="#7C9885" ${SK}/><circle cx="32" cy="43" r="2.4" fill="#F6F1E6"/>`),
};

// Équipement de cuisine (pour tout le foyer) : cartes à cocher
export function equipmentBlock(eq) {
  const e = eq || {};
  const c = countPossible({ ...e });
  const can = (e.plaque || e.autocuiseur);
  return `<div class="eq-grid" role="group" aria-label="Équipement">
      ${TOOLS.map(t => `<button class="eq-card ${e[t.key] ? 'on' : ''}" data-tool="${t.key}" role="checkbox" aria-checked="${!!e[t.key]}">
        <span class="eq-art">${TOOL_ART[t.key]}</span><b>${t.label}</b><span class="eq-desc">${t.desc}</span><span class="sel-check" aria-hidden="true"></span>
      </button>`).join('')}
    </div>
    ${can ? '' : '<p class="eq-count">Il faut au moins des plaques de cuisson ou un autocuiseur pour cuisiner les plats.</p>'}`;
}

// Repas de la journée : frise avec un point par repas (taille = part des calories)
const MEAL_COLORS = { breakfast: 'var(--honey)', lunch: 'var(--terra)', snack: 'var(--leaf)', dinner: 'var(--sky)' };
export const FORMULAS = [
  { id: 'jeune', title: 'Jeûne intermittent', desc: 'Déjeuner, collation et dîner.', tint: '--leaf-t', fast: true,
    meals: [['lunch', 36, 40, '12 h'], ['snack', 62, 20, '16 h'], ['dinner', 88, 40, '20 h']] },
  { id: 'classique', title: 'Classique', desc: 'Petit-déjeuner, déjeuner, collation et dîner.', tint: '--sky-t',
    meals: [['breakfast', 8, 20, '8 h'], ['lunch', 36, 32, '12 h'], ['snack', 62, 16, '16 h'], ['dinner', 88, 32, '20 h']] },
];
function timeline(f) {
  return `<span class="fm-tl" aria-hidden="true"><span class="fm-tl-ln"></span>
    ${f.fast ? '<span class="fm-tl-fast"></span>' : ''}
    ${f.meals.map(([k, x, pct, t]) => { const d = Math.round(9 + pct * 0.36); return `<span class="fm-tl-d" style="left:${x}%;width:${d}px;height:${d}px;background:${MEAL_COLORS[k]}"></span><span class="fm-tl-t" style="left:${x}%">${t}</span>`; }).join('')}
  </span>`;
}
const DIETS = [
  { key: 'lactose', label: 'Lactose', hint: 'Lait, yaourt, fromage frais', tint: '--terra-t', levels: ['Aucun souci', 'Intolérance', 'Strict'] },
  { key: 'gluten', label: 'Gluten', hint: 'Pâtes, pain, sauce soja', tint: '--terra-t', levels: ['Aucun souci', 'Sensibilité', 'Strict'] },
];
export function mealsBlock(member, { error = '' } = {}) {
  return `<div class="fm-list" role="radiogroup" aria-label="Formule de repas">
      ${FORMULAS.map(f => `<button class="fm-card ${member.formula === f.id ? 'on' : ''}" data-formula="${f.id}" role="radio" aria-checked="${member.formula === f.id}" style="--c:var(${f.tint.slice(0, -2)});--t:var(${f.tint})">
        <b>${f.title}</b><span class="fm-desc">${f.desc}</span>${timeline(f)}<span class="sel-check" aria-hidden="true"></span>
      </button>`).join('')}
    </div>
    <div class="fm-legend" aria-hidden="true"><span><i style="background:${MEAL_COLORS.breakfast}"></i>Petit-déjeuner</span><span><i style="background:${MEAL_COLORS.lunch}"></i>Déjeuner</span><span><i style="background:${MEAL_COLORS.snack}"></i>Collation</span><span><i style="background:${MEAL_COLORS.dinner}"></i>Dîner</span></div>
    ${error ? `<p class="wl-error" role="alert">${error}</p>` : ''}
    ${member.formula === 'classique' ? `<div class="dt-card dt-bk" style="--c:var(--honey);--t:var(--honey-t)">
      <div class="dt-top"><b>Au petit-déjeuner</b></div>
      <div class="dt-seg" role="radiogroup" aria-label="Petit-déjeuner">
        ${[['sucre', 'Sucré'], ['sale', 'Salé'], ['mix', 'Les deux']].map(([v, l]) => `<button class="dt-btn ${(member.breakfast || 'mix') === v ? 'on' : ''}" data-bk="${v}" role="radio" aria-checked="${(member.breakfast || 'mix') === v}">${l}</button>`).join('')}
      </div>
    </div>` : ''}
    <div class="dt-card dt-whey" style="--c:var(--sky);--t:var(--sky-t)">
      <div class="dt-top"><b>Protéine en poudre (whey)</b></div>
      <div class="dt-seg dt-seg-2" role="radiogroup" aria-label="Whey">
        <button class="dt-btn ${member.whey === true ? 'on' : ''}" data-whey="1" role="radio" aria-checked="${member.whey === true}">J'en ai</button>
        <button class="dt-btn ${member.whey === false ? 'on' : ''}" data-whey="0" role="radio" aria-checked="${member.whey === false}">Je n'en ai pas</button>
      </div>
    </div>
    <div class="dt-card dt-diet" style="--c:var(--terra);--t:var(--terra-t)">
      <div class="dt-top"><b>Ton régime</b><span>Lactose et gluten</span></div>
      ${DIETS.map(d => `<div class="dt-row">
        <div class="dt-row-top"><span>${d.label}</span><em>${d.hint}</em></div>
        <div class="dt-seg" role="radiogroup" aria-label="${d.label}">
          ${d.levels.map((l, i) => `<button class="dt-btn ${(member[d.key] || 0) === i ? 'on' : ''}" data-diet="${d.key}" data-level="${i}" role="radio" aria-checked="${(member[d.key] || 0) === i}">${l}</button>`).join('')}
        </div>
      </div>`).join('')}
    </div>`;
}

// Niveau d'activité : quatre choix décrits par une phrase
export function activityList(level = null) {
  return `<div class="act-list" role="radiogroup" aria-label="Niveau d'activité">
    ${ACTIVITY.map(a => `
      <button class="act-opt ${a.level === level ? 'on' : ''}" data-act="${a.level}" role="radio" aria-checked="${a.level === level}">
        <span class="act-bars" aria-hidden="true">${[1, 2, 3, 4].map(i => `<i class="${i <= a.level ? 'f' : ''}"></i>`).join('')}</span>
        <span class="act-txt"><b>${a.label}</b><span>${a.desc}</span></span>
        <span class="act-check" aria-hidden="true"></span>
      </button>`).join('')}
  </div>`;
}

// v195 : « Départ 2526 kcal », puis ce qui se passe ensuite, en clair
function phaseRange(profile, pid) {
  const ph = computeAllPhases(profile, pid);
  const k = ph.map(x => x.targets.kcal);
  if (ph.length === 1) return `<b>${k[0]} kcal</b><span>sans changer de palier</span>`;
  const more = k[k.length - 1] > k[0];
  const then = ph.length === 2
    ? `puis ${k[1]} si ${more ? 'tu stagnes' : 'le poids stagne'}`
    : `puis jusqu'à ${k[k.length - 1]}, en ${ph.length - 1} paliers`;
  return `<b>Départ ${k[0]} kcal</b><span>${then}</span>`;
}

// Cartes des quatre programmes
export function protocolCards(profile, selectedId, { info = true } = {}) {
  return `<div class="protocol-grid">
    ${protocolsFor(profile).map(p => `
      <button class="proto-card pc-${p.id} ${p.id === selectedId ? 'active' : ''}" data-pid="${p.id}">
        <div class="proto-head">
          <div class="proto-name">${p.name}</div>
          ${info ? `<span class="proto-info" data-sheet="${p.id}" role="button" tabindex="0" aria-label="En savoir plus sur ${p.name}">i</span>` : ''}
        </div>
        <div class="proto-tagline">${p.tagline}</div>
        <div class="proto-range">${phaseRange(profile, p.id)}</div>
        <div class="proto-check">✓</div>
      </button>`).join('')}
  </div>`;
}

// Sélecteur de personne (foyer de deux) : chacun voit ses portions et ses collations
export function whoSwitch() {
  const ms = getMembers();
  if (ms.length < 2) return '';
  const act = getActiveMember().id;
  return `<div class="who-switch" role="tablist" aria-label="Personne affichée">
    ${ms.map(m => `<button class="who-btn ${m.id === act ? 'on' : ''}" data-mid="${m.id}" role="tab" aria-selected="${m.id === act}">
      <span class="who-av">${avatar(m.sex)}</span>${m.name || 'Sans prénom'}</button>`).join('')}
  </div>`;
}
export function bindWho(root, rerender) {
  root.querySelectorAll('.who-btn').forEach(b => b.addEventListener('click', () => {
    if (b.classList.contains('on')) return;
    setActiveMember(b.dataset.mid); rerender();
  }));
}

// Branche les cases de mesure : appelle onChange(key, value) à chaque modification
export function bindMeasures(root, getValue, onChange) {
  root.querySelectorAll('.pcell-input').forEach(inp => inp.addEventListener('input', () => { inp.style.width = `${Math.max(1, inp.value.length) + 0.2}ch`; }));
  root.querySelectorAll('.pcell-btn').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.key, d = parseFloat(b.dataset.delta);
    onChange(k, Math.max(0, Math.round((getValue(k) + d) * 100) / 100));
  }));
  root.querySelectorAll('.pcell-input').forEach(inp => inp.addEventListener('change', () => {
    const k = inp.dataset.key;
    let v = parseFloat(inp.value.replace(',', '.'));
    if (k === 'height' && v > 3) v = Math.round(v) / 100; // « 178 » compris comme 1,78 m
    if (!isNaN(v) && v > 0) onChange(k, v);
    else if (inp.value.trim() === '' && getValue.allowEmpty) onChange(k, null);
    else onChange(k, getValue(k, true));
  }));
}

// ── Fiche détaillée d'un programme ──
// Rythme estimé de chaque étape, d'après les calories calculées pour ce profil
function paceValues(ph, maint) {
  return ph.map(x => x.targets.kcal - maint).filter(d => Math.abs(d) > 30)
    .map(d => kgPerWeek(d).toFixed(1).replace('.', ','));
}
function paceShort(p, ph, maint) {
  const v = paceValues(ph, maint);
  if (p.id === 'P2' || !v.length) return '≈ stable';
  const sign = p.phases.some(x => x.pct > 0) ? '+' : '−';
  return v.length > 1 ? `${sign}${v[0]} à ${v[v.length - 1]} kg` : `${sign}${v[0]} kg`;
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

export function openProtocolSheet(profile, pid, { isCurrent = false, onChoose = null } = {}) {
  const p = protocolFor(profile, pid);
  const ph = computeAllPhases(profile, pid);
  const maint = Math.round(computeBase(profile).maintenance);
  const stepName = (x, i) => i === 0 ? x.label : `${x.label} <em>facultative</em>`;
  const last = ph.length - 1;
  openSheet(`
    <div class="sheet-handle"></div>
    <div class="hb-sheet-pad pf pc-${p.id}">
      <div class="pf-hero">
        <div class="hb-h2">${p.name}</div>
        <p class="pf-tag">${p.tagline}</p>
        <div class="pf-stats">
          <div><b>${paceShort(p, ph, maint)}</b><span>par semaine</span></div>
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
    closeSheet();
    if (!isCurrent && onChoose) onChoose(pid);
  });
}

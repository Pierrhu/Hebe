// photos.js — Photos des plats (img/dishes/<code>.webp, 720 px, WebP).
// Pour ajouter une photo : déposer le fichier dans img/dishes/ et ajouter son code ici.
// Les plats sans photo affichent leur emoji.

import { getRating } from './prefs.js';

export const PHOTOS = new Set(['B01', 'B02', 'B05', 'B06', 'B07', 'B15', 'B16', 'C01', 'K01', 'K02', 'K03', 'K05', 'K06', 'K07', 'K08', 'K09', 'K10', 'K11', 'K12', 'K13', 'K14', 'K15', 'K16', 'K17', 'K18', 'K19', 'K20', 'K21', 'S02', 'S05', 'S07', 'S08', 'S09', 'S11', 'S12', 'S16', 'SA01', 'SA11', 'W01', 'W02', 'W03', 'W04', 'W05', 'W06', 'W07', 'W08', 'W09', 'W10', 'W11', 'W12', 'W13', 'W14', 'W15', 'W16', 'W17', 'W18', 'W19', 'W20', 'W21', 'W22', 'W23', 'W24', 'W25', 'W26', 'W27', 'W28', 'W29', 'W30', 'W31', 'W32', 'W33', 'W34', 'W35', 'W36', 'W37', 'W38', 'W39', 'W40', 'W41', 'W43', 'W44', 'W45', 'W46', 'W47', 'W48', 'W49', 'W50', 'W51', 'W52', 'W53', 'W54', 'W55', 'W56', 'W57', 'W58', 'W59', 'W60', 'W61', 'W62', 'W63', 'W64', 'W65', 'W66', 'W67', 'W68', 'W69', 'W70', 'W71', 'W72', 'W73', 'W74', 'W75']);

export const photoUrl = id => (PHOTOS.has(id) ? `img/dishes/${id}.webp` : null);
// Les variantes (ex. sans whey) reprennent la photo de leur recette d'origine (champ photo)
const photoOf = r => photoUrl(r.photo || r.id);

// Vignette : photo si disponible, sinon pastille emoji de même taille
// Illustrations dessinées (sans photo) : repas libre et repas dehors
const AINK = '#2A3A30';
const AK = `stroke="${AINK}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"`;
const AHI = 'stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round" fill="none" opacity=".7"';
// Repas libre : le tablier accroché (ce soir, on ne cuisine pas)
// Repas libre : le tablier au repos, accroché à un crochet (bride passée par-dessus), légèrement penché
const ART_TABLIER = `<svg viewBox="0 0 160 160"><rect width="160" height="160" fill="#E4EEE6"/><ellipse cx="80" cy="144" rx="38" ry="5" fill="#2A3A30" opacity=".08"/><rect x="70" y="14" width="20" height="12" rx="4" fill="#C9A77C" stroke="#2A3A30" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
  <path d="M80 26 v6 c0 5 -6 5 -6 1" fill="none" stroke="#2A3A30" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/><g transform="rotate(-7 80 32)"><path d="M66 61 C64 42 71 32 80 32 C89 32 96 42 94 61" fill="none" stroke="#2A3A30" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/><path d="M64 60 h32 l4 18 c9 2 14 5 17 8 l-6 44 c-1 4 -4 6 -8 6 h-46 c-4 0 -7 -2 -8 -6 l-6 -44 c3 -3 8 -6 17 -8 Z" fill="#F6F1E6" stroke="#2A3A30" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
  <path d="M68 66 h24 l3 14 c7 2 11 4 13 6 l-5 38 c0 2 -2 4 -4 4 h-38 c-2 0 -4 -2 -4 -4 l-5 -38 c2 -2 6 -4 13 -6 Z" fill="none" stroke="#E2D6C0" stroke-width="2" stroke-dasharray="4 3"/>
  <rect x="65" y="94" width="30" height="20" rx="5" fill="#7C9885" stroke="#2A3A30" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
  <path d="M69 99 h22" stroke="#A9C2B2" stroke-width="2" stroke-linecap="round" stroke-dasharray="3 3"/></g><path d="M124 50 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 Z" fill="#E0A95E"/>
  <path d="M34 104 l2 4 l4 2 l-4 2 l-2 4 l-2 -4 l-4 -2 l4 -2 Z" fill="#E0A95E"/><circle cx="128" cy="112" r="2.2" fill="#E0A95E"/></svg>`;
// Repas dehors : le joker (un repas joué ailleurs)
const ART_JOKER = `<svg viewBox="0 0 160 160"><rect width="160" height="160" fill="#E7F0F5"/>
  <circle cx="80" cy="80" r="58" fill="#F3F8FB"/>
  <ellipse cx="84" cy="132" rx="40" ry="6" fill="${AINK}" opacity=".08"/>
  <!-- carte du dessous -->
  <g transform="rotate(10 86 82)"><rect x="56" y="34" width="62" height="88" rx="10" fill="#E9E0CF" ${AK}/></g>
  <!-- carte joker -->
  <g transform="rotate(-8 78 80)">
    <rect x="46" y="34" width="62" height="88" rx="10" fill="#F6F1E6" ${AK}/>
    <rect x="53" y="41" width="48" height="74" rx="6" fill="none" stroke="#E2D6C0" stroke-width="2"/>
    <circle cx="77" cy="78" r="21" fill="#6FA3C0" ${AK}/>
    <path d="M60 72 c1 -6 4 -10 8 -13" ${AHI}/>
    <path d="M70 66 v10 M74 66 v10 M70 76 c0 4 4 4 4 0 M72 78 v14" stroke="#F6F1E6" stroke-width="2.6" stroke-linecap="round" fill="none"/>
    <path d="M85 66 c-5 2 -5 10 0 12 v14" stroke="#F6F1E6" stroke-width="2.6" stroke-linecap="round" fill="none"/>
    <path d="M60 41 l1.8 4.2 l4.2 1.8 l-4.2 1.8 l-1.8 4.2 l-1.8 -4.2 l-4.2 -1.8 l4.2 -1.8 Z" fill="#E0A95E"/>
    <path d="M94 104 l1.8 4.2 l4.2 1.8 l-4.2 1.8 l-1.8 4.2 l-1.8 -4.2 l-4.2 -1.8 l4.2 -1.8 Z" fill="#E0A95E"/>
  </g>
  <path d="M122 38 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 Z" fill="#E0A95E"/>
  <path d="M32 98 l2 4 l4 2 l-4 2 l-2 4 l-2 -4 l-4 -2 l4 -2 Z" fill="#E0A95E"/>
  <circle cx="128" cy="104" r="2.2" fill="#E0A95E"/>
</svg>`;
// Illustrations (v151) : images détourées sur un fond de couleur
const artPic = (src, bg) => `<span class="art-pic" style="background:${bg}"><img src="${src}" alt=""></span>`;
const ART = { L01: artPic('img/art/tablier.webp', '#E4EEE6'), X01: artPic('img/art/joker.webp', '#E7F0F5') };
export const artFor = id => ART[id] || null;
// Repas libre précisé « cantine » : le plateau, un peu plus bas dans la vignette
export const cantineThumb = (cls = '') => `<span class="dish-ph dish-ph-art ${cls}" aria-hidden="true"><span class="art-pic art-low" style="background:#E4EEE6"><img src="img/art/cantine.webp" alt=""></span></span>`;

export function dishThumb(r, cls = '') {
  if (!r) return '';
  if (ART[r.id]) return `<span class="dish-ph dish-ph-art ${cls}" aria-hidden="true">${ART[r.id]}</span>`;
  const u = photoOf(r);
  return u
    ? `<img class="dish-ph ${cls}" src="${u}" alt="" loading="lazy" decoding="async">`
    : `<span class="dish-ph dish-ph-emoji ${cls}" aria-hidden="true">${r.emoji}</span>`;
}

// ── Notes visibles sur les photos ──
export const ICON_HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.3-4.4-9.3-8.8C1.2 8.4 3.2 4.6 6.9 4.6c2 0 3.5 1.1 5.1 3 1.6-1.9 3.1-3 5.1-3 3.7 0 5.7 3.8 4.2 7.1-2 4.4-9.3 8.8-9.3 8.8z"/></svg>';
export const ICON_NOPE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.7a2 2 0 0 0-2 1.7l-1.4 9A2 2 0 0 0 4.3 15H10z"/><path d="M17 2h2.7A2.3 2.3 0 0 1 22 4v7a2.3 2.3 0 0 1-2.3 2H17"/></svg>';
export const rateClass = id => (getRating(id) > 0 ? 'is-liked' : getRating(id) < 0 ? 'is-nope' : '');
// Vignette + badge (cœur si aimé, pouce baissé + noir et blanc si écarté)
export function dishThumbRated(r, cls = '') {
  if (!r) return '';
  const v = getRating(r.id);
  return `<span class="ph-wrap ${rateClass(r.id)}">${dishThumb(r, cls)}${v ? `<span class="ph-badge">${v > 0 ? ICON_HEART : ICON_NOPE}</span>` : ''}</span>`;
}

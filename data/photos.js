// photos.js — Photos des plats (img/dishes/<code>.webp, 720 px, WebP).
// Pour ajouter une photo : déposer le fichier dans img/dishes/ et ajouter son code ici.
// Les plats sans photo affichent leur emoji.

import { getRating } from './prefs.js';

export const PHOTOS = new Set(['C01', 'K01', 'K02', 'K03', 'K05', 'K06', 'K07', 'K08', 'K09', 'K10', 'K11', 'K12', 'S11', 'S12', 'SA11', 'W01', 'W02', 'W03', 'W04', 'W05', 'W06', 'W07', 'W08', 'W09', 'W10', 'W11', 'W12', 'W13', 'W14', 'W15', 'W16', 'W17', 'W18', 'W19', 'W20', 'W21', 'W22', 'W23', 'W24', 'W25', 'W26', 'W27', 'W28', 'W29', 'W30']);

export const photoUrl = id => (PHOTOS.has(id) ? `img/dishes/${id}.webp` : null);

// Vignette : photo si disponible, sinon pastille emoji de même taille
export function dishThumb(r, cls = '') {
  if (!r) return '';
  const u = photoUrl(r.id);
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

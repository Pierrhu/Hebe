// user.js — Objectifs actifs de la personne sélectionnée.
// Priorité : objectifs réglés à la main > calcul automatique (profil + programme) > défaut.

import { getProfile, getSelectedProtocol, getSelectedPhase, computeTargets } from './calculator.js';
import { getActiveMember, updateActiveMember } from './household.js';

const DEFAULT_TARGETS = { kcal: 2200, protein: 140, carbs: 250, fat: 70 };

// Objectifs d'une personne précise du foyer (sans changer la personne active)
export function getTargetsFor(member) {
  if (member.targets) return { ...DEFAULT_TARGETS, ...member.targets };
  try { return computeTargets(member, member.protocol, member.phase || 0); } catch { return { ...DEFAULT_TARGETS }; }
}

export function getTargets() {
  const saved = getActiveMember().targets;
  if (saved) return { ...DEFAULT_TARGETS, ...saved };
  try {
    return computeTargets(getProfile(), getSelectedProtocol(), getSelectedPhase());
  } catch {
    return { ...DEFAULT_TARGETS };
  }
}

// Enregistre des objectifs : s'ils sont identiques au calcul du programme, on ne garde rien
// (ils suivront automatiquement les changements de profil).
export function saveTargets(targets) {
  const computed = computeTargets(getProfile(), getSelectedProtocol(), getSelectedPhase());
  const same = ['kcal', 'protein', 'carbs', 'fat'].every(k => targets[k] === computed[k]);
  updateActiveMember({ targets: same ? null : { kcal: targets.kcal, protein: targets.protein, carbs: targets.carbs, fat: targets.fat } });
}
export const hasManualTargets = () => !!getActiveMember().targets;

export function resetTargets() {
  updateActiveMember({ targets: null });
  return getTargets();
}

export function getWeeklyKcalTarget() {
  return getTargets().kcal * 7;
}

export const USER = {
  get name() { return getActiveMember().name; },
  get sex() { return getActiveMember().sex; },
  get targets() { return getTargets(); },
};

export { DEFAULT_TARGETS };

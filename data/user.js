// user.js — Objectifs actifs.
// Priorité : targets manuels sauvegardés > calcul auto (profil + protocole) > défaut.

import { getProfile, getSelectedProtocol, getSelectedPhase, computeTargets } from './calculator.js';

const DEFAULT_TARGETS = { kcal: 2200, protein: 180, carbs: 220, fat: 65 };

export function getTargets() {
  const saved = localStorage.getItem('diet_targets');
  if (saved) {
    try { return { ...DEFAULT_TARGETS, ...JSON.parse(saved) }; } catch {}
  }
  // Pas de cible manuelle → calcul auto depuis le profil + protocole
  try {
    return computeTargets(getProfile(), getSelectedProtocol(), getSelectedPhase());
  } catch {
    return { ...DEFAULT_TARGETS };
  }
}

export function saveTargets(targets) {
  localStorage.setItem('diet_targets', JSON.stringify(targets));
}

export function resetTargets() {
  localStorage.removeItem('diet_targets');
  return getTargets();
}

export function getWeeklyKcalTarget() {
  return getTargets().kcal * 7;
}

export const USER = {
  name: 'User', age: 24, height: 185, weight: 97, sex: 'male',
  goal: 'cut', activityLevel: 1.4,
  get targets() { return getTargets(); },
  intermittentFasting: true,
  fastingWindow: { start: '20:00', end: '12:00' },
};

export { DEFAULT_TARGETS };

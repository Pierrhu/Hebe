import { getTodayDate, getEntry } from '../data/log.js';

export const state = {
  currentView:    'week',          // démarre sur la vue semaine
  selectedDate:   getTodayDate(),  // jour en cours d'édition dans le planner
  searchQuery:    '',
  filterCategory: 'all',
  filterProtein:  'all',
};

export function setState(patch) {
  Object.assign(state, patch);
}

// Renvoie l'entrée du jour sélectionné (toujours fraîche depuis le storage)
export function currentEntry() {
  return getEntry(state.selectedDate);
}

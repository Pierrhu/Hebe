// log.js — Journal & planning hebdomadaire
//
// Modèle de données (localStorage 'diet_log') :
//   { date: 'YYYY-MM-DD', meals: { lunch:[item], dinner:[item], sides:[item], sweet:[item] } }
// où item = { id: 'D01', servings: 1 }   ← servings = multiplicateur de portions
//
// Migration : les anciennes entrées stockaient des strings ('D01') → converties à la volée.

import { getActiveMember, logKey } from './household.js';

const EMPTY_MEALS = () => ({ breakfast: [], starter: [], lunch: [], dinner: [], sides: [], sweet: [] });

function normalizeItem(item) {
  // Ancien format : string → { id, servings:1 }
  if (typeof item === 'string') return { id: item, servings: 1 };
  const out = { id: item.id, servings: item.servings || 1 };
  if (item.overrides) out.overrides = item.overrides; // quantités d'ingrédients ajustées
  if (item.with) out.with = item.with;                // accompagnement lié au midi / au soir
  if (item.frozen) out.frozen = true;                 // boîte passée par le congélateur (décongelée la veille)
  if (item.kind) out.kind = item.kind;                // repas libre précisé : 'cantine'
  return out;
}

function normalizeEntry(entry) {
  const meals = EMPTY_MEALS();
  ['breakfast', 'starter', 'lunch', 'dinner', 'sides', 'sweet'].forEach(slot => {
    meals[slot] = (entry.meals?.[slot] || []).map(normalizeItem);
  });
  const out = { date: entry.date, meals };
  // imprévu : plat d'origine conservé pour pouvoir annuler
  if (entry.outside && Object.keys(entry.outside).length) out.outside = entry.outside;
  return out;
}

// Chaque personne du foyer a son propre journal (memberId absent = personne active)
const keyOf = memberId => logKey(memberId || getActiveMember().id);

export function getLog(memberId) {
  let raw = [];
  try { raw = JSON.parse(localStorage.getItem(keyOf(memberId)) || '[]'); } catch {}
  return raw.map(normalizeEntry);
}

export function saveLog(log, memberId) {
  localStorage.setItem(keyOf(memberId), JSON.stringify(log));
}

export function getEntry(date, memberId) {
  const log = getLog(memberId);
  const existing = log.find(e => e.date === date);
  return existing || { date, meals: EMPTY_MEALS() };
}

export function saveEntry(entry, memberId) {
  const log = getLog(memberId).filter(e => e.date !== entry.date);
  log.push(entry);
  saveLog(log, memberId);
}

// Date au format AAAA-MM-JJ, en heure locale (toISOString passe en UTC et recule d'un jour
// en France entre minuit et 2 h du matin)
export function localYMD(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getTodayDate() {
  return localYMD(new Date());
}

export function getTodayEntry() {
  return getEntry(getTodayDate());
}

export function saveTodayEntry(entry) {
  saveEntry(entry);
}

// ── Helpers semaine ─────────────────────────────────
// Lundi comme premier jour de semaine.

export function getWeekDates(refDate = new Date()) {
  const d = new Date(refDate);
  const day = (d.getDay() + 6) % 7; // 0 = lundi
  const monday = new Date(d);
  monday.setDate(d.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    return localYMD(dd);
  });
}

export function getNextWeekDates() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return getWeekDates(d);
}

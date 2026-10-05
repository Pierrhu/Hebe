// household.js — Le foyer : une fiche par personne (1 pour l'instant, 2 au lot suivant).
//
// Stocké dans localStorage['hebe_household'] :
//   { version, onboarded, migrated, activeId, budget, equipment: { plaque, four, airfryer, autocuiseur, microondes, mixeur } | null, members: [Membre] }
// Membre :
//   { id, name, sex: 'male' | 'female' | null, age, height (m), weight (kg), bodyfat (%),
//     activity (1 à 4), protocol, phase, targets (objectifs réglés à la main ou null),
//     formula ('jeune' | 'classique'), lactose (0 aucun, 1 léger, 2 strict), gluten (idem),
//     free (repas libres, non calculés : ['0-lunch', '3-dinner', …], 0 = lundi), freeKcal (calories réservées par repas libre, 0 = part habituelle),
//     breakfast ('sucre' | 'sale' | 'mix' : petit-déjeuner de la formule classique), whey (true : en a, false : n'en a pas) }
// Le journal de chaque personne est séparé : 'diet_log' pour la première, 'diet_log_<id>' pour les autres.

const KEY = 'hebe_household';

// Niveaux d'activité : le niveau 2 vaut exactement l'ancien coefficient fixe (1,5).
export const ACTIVITY = [
  { level: 1, coef: 1.35, label: 'Plutôt calme', desc: 'Travail assis, peu ou pas de sport.' },
  { level: 2, coef: 1.5,  label: 'Actif',        desc: 'Travail assis, sport trois à quatre fois par semaine.' },
  { level: 3, coef: 1.65, label: 'Très actif',   desc: 'Travail debout, ou sport presque tous les jours.' },
  { level: 4, coef: 1.8,  label: 'Intense',      desc: 'Travail physique et sport régulier.' },
];
export const activityCoef = level => (ACTIVITY.find(a => a.level === level) || ACTIVITY[1]).coef;

// Aucune valeur par défaut : chaque personne renseigne les siennes à l'accueil.
const NEW_MEMBER = {
  name: '', sex: null, age: null, height: null, weight: null, bodyfat: null,
  activity: null, protocol: null, phase: 0, targets: null,
  formula: null, lactose: 0, gluten: 0, free: [], breakfast: 'mix', whey: null,
};
export const MAX_MEMBERS = 2;

const read = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };

// Ancienne formule (avant le foyer) : sert seulement à savoir si les objectifs enregistrés
// étaient ceux du programme (on les recalcule alors) ou réglés à la main (on les garde).
function legacyTargets(p, protocolId, phase) {
  const OFFSETS = { P1: [0, 200, 400], P2: [-300], P3: [-300, -500], P4: [-300, -500, -700] };
  const offs = OFFSETS[protocolId] || OFFSETS.P4;
  const bmr = ((13.707 * p.weight + 492.3 * p.height - 6.673 * p.age + 77.607) + (21.6 * p.weight * (100 - p.bodyfat) / 100 + 370)) / 2;
  const kcal = bmr * 1.5 + offs[Math.min(phase, offs.length - 1)];
  const lean = p.weight * (100 - p.bodyfat) / 100;
  const protein = (p.weight * 1.5 + lean * 2) / 2, fat = 1.2 * lean;
  return { kcal: Math.round(kcal), protein: Math.round(protein), carbs: Math.round((kcal - protein * 4 - fat * 9) / 4), fat: Math.round(fat) };
}

// Première ouverture de cette version : on reprend l'ancien profil s'il a vraiment été rempli.
// Sans profil enregistré, on ne suppose rien : la personne passe par l'accueil complet.
function migrate() {
  const oldProfile = read('diet_profile');
  const hadData = !!(oldProfile && oldProfile.weight && oldProfile.height && oldProfile.age);
  const m = { ...NEW_MEMBER, id: 'm1' };
  if (hadData) {
    Object.assign(m, { activity: 2, bodyfat: 20 }, oldProfile); // le sexe est demandé à l'accueil
    m.protocol = localStorage.getItem('diet_protocol') || 'P4';
    m.formula = 'jeune'; // la formule de l'ancienne version
    m.whey = true;
    m.phase = parseInt(localStorage.getItem('diet_phase') || '0') || 0;
    const saved = read('diet_targets');
    if (saved && JSON.stringify(saved) !== JSON.stringify(legacyTargets(m, m.protocol, m.phase))) m.targets = saved;
  }
  const cant = read('hebe_cantine_days');
  if (Array.isArray(cant)) m.free = cant.map(d => `${d}-lunch`);
  return {
    version: 1, onboarded: false, migrated: hadData, activeId: 'm1',
    budget: null, appliances: { airfryer: 5, cooker: 6 },
    // équipement : demandé à l'accueil ; un profil repris garde l'équipement d'origine de l'app
    equipment: hadData ? { plaque: true, four: false, airfryer: true, autocuiseur: true, microondes: true, mixeur: true } : null,
    members: [m],
  };
}

let cache = null;
export function getHousehold() {
  if (cache) return cache;
  const saved = read(KEY);
  cache = saved && Array.isArray(saved.members) && saved.members.length ? saved : migrate();
  // foyers créés avant la question sur l'équipement : équipement d'origine de l'app
  if (cache.equipment === undefined) cache.equipment = cache.onboardedOnce || cache.migrated ? { plaque: true, four: false, airfryer: true, autocuiseur: true, microondes: true, mixeur: true } : null;
  cache.members.forEach(m => {
    // anciens midis « cantine » : deviennent des repas libres
    if (!Array.isArray(m.free)) m.free = (Array.isArray(m.cantine) ? m.cantine : []).map(d => `${d}-lunch`);
    delete m.cantine;
    if (!m.breakfast) m.breakfast = 'mix';
    if (m.whey === undefined) m.whey = true; // fiches d'avant cette option : l'app reposait sur la whey
  });
  if (!saved) saveHousehold(cache);
  return cache;
}
export function saveHousehold(h) {
  cache = h;
  localStorage.setItem(KEY, JSON.stringify(h));
}

export const getMembers = () => getHousehold().members;
export function getActiveMember() {
  const h = getHousehold();
  return h.members.find(m => m.id === h.activeId) || h.members[0];
}
export function updateMember(id, patch) {
  const h = getHousehold();
  const m = h.members.find(x => x.id === id);
  if (m) Object.assign(m, patch);
  saveHousehold(h);
  return m;
}
export const updateActiveMember = patch => updateMember(getActiveMember().id, patch);

export const getMember = id => getHousehold().members.find(m => m.id === id);
export function setActiveMember(id) {
  const h = getHousehold();
  if (h.members.some(m => m.id === id)) { h.activeId = id; saveHousehold(h); }
}
// Nombre de personnes du foyer : ajoute une fiche vierge ou retire la dernière
export function setMemberCount(n) {
  const h = getHousehold();
  n = Math.max(1, Math.min(MAX_MEMBERS, n));
  while (h.members.length < n) h.members.push({ ...NEW_MEMBER, id: 'm' + (h.members.length + 1) });
  if (h.members.length > n) {
    h.members.slice(n).forEach(m => localStorage.removeItem('diet_log_' + m.id));
    h.members = h.members.slice(0, n);
  }
  if (!h.members.some(m => m.id === h.activeId)) h.activeId = h.members[0].id;
  saveHousehold(h);
}
export const logKey = id => (!id || id === 'm1' ? 'diet_log' : 'diet_log_' + id);
// Budget de la semaine : réglé à la main, sinon environ 60 € par adulte (les semaines au-delà de +15 % sont écartées)
export const weekBudget = () => getHousehold().budget || 60 * getHousehold().members.length;

export function setEquipment(eq) {
  const h = getHousehold();
  h.equipment = { ...eq };
  saveHousehold(h);
}

export const isOnboarded = () => !!getHousehold().onboarded;

// Riz et pâtes (v171) : 'complet' (par défaut), 'classique' ou 'plat' (choix sur la fiche de chaque plat).
// Commun au foyer : les plats sont cuisinés une seule fois pour tout le monde.
export const STAPLE_MODES = ['complet', 'classique', 'plat'];
export const getStaples = () => (STAPLE_MODES.includes(getHousehold().staples) ? getHousehold().staples : 'complet');
export function setStaples(mode) { const h = getHousehold(); h.staples = mode; saveHousehold(h); }
// choix plat par plat : { W14: 'classique', … } ; absent = complet
export const getDishStaple = id => (getHousehold().staplesByDish || {})[id] || 'complet';
export function setDishStaple(id, v) {
  const h = getHousehold();
  h.staplesByDish = { ...(h.staplesByDish || {}) };
  if (v === 'classique') h.staplesByDish[id] = 'classique'; else delete h.staplesByDish[id];
  saveHousehold(h);
}
export function setOnboarded(v = true) {
  const h = getHousehold();
  h.onboarded = v;
  if (v) h.onboardedOnce = true;
  saveHousehold(h);
}
// Fiche complète : tout ce qu'il faut pour calculer les besoins
export const isComplete = m => !!(m && m.name && m.sex && m.age && m.height && m.weight && m.bodyfat && m.activity && m.protocol && m.formula && m.whey != null);

// Accord des textes selon le profil : « Tu es [prêt|prête] » → « Tu es prête » pour une femme.
export function gx(text, sex) {
  return String(text).replace(/\[([^|\]]*)\|([^\]]*)\]/g, (_, m, f) => (sex === 'female' ? f : m));
}

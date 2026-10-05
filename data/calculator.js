// calculator.js — Moteur Zero to Hero, adapté aux hommes et aux femmes.
//
// Métabolisme de base = moyenne de deux formules :
//   BMR1 (Harris-Benedict) homme = 13,707 × poids + 492,3 × taille (m) − 6,673 × âge + 77,607   (formule du tableur d'origine)
//   BMR1 (Harris-Benedict révisée) femme = 9,247 × poids + 309,8 × taille (m) − 4,330 × âge + 447,593
//   BMR2 (Katch-McArdle, commune) = 21,6 × masse maigre + 370
// Maintenance = BMR × coefficient d'activité (niveau 2 = 1,5, l'ancien coefficient fixe).
// Protéines = moyenne(poids × 1,5 ; masse maigre × 2)
// Lipides   = 1,2 × masse maigre, jamais moins de 25 % des calories (femme) ou 20 % (homme)
// Glucides  = le reste
// Programmes : écart en POURCENTAGE de la maintenance (un écart fixe pèse trop lourd sur de petits besoins).
// Garde-fou : jamais sous le métabolisme de base, ni sous 1 200 kcal (femme) ou 1 500 kcal (homme).

import { getActiveMember, updateActiveMember, activityCoef, gx } from './household.js';

// Textes : [masculin|féminin] est accordé selon le profil ; {kg} = rythme estimé de l'étape.
export const PROTOCOLS = [
  {
    id: 'P1', name: 'Prise de muscle propre',
    purpose: "Ce programme sert à prendre du muscle en limitant au maximum la prise de gras. Tu commences à ta maintenance, puis tu ajoutes un léger surplus de calories uniquement quand ta progression ralentit. Le gain est lent mais propre : la balance monte doucement et ton tour de taille reste stable.",
    forWho: ["Tu es déjà plutôt [sec|sèche] et tu veux gagner du volume", "Tu t'entraînes régulièrement et tes charges progressent", "Tu acceptes de prendre un peu de poids pour construire du muscle"],
    duration: 'Sur plusieurs mois',
    tagline: 'Construire du muscle en limitant le gras',
    phases: [
      { label: 'Semaine initiale', short: "Maintenance : le corps s'adapte, la force grimpe", when: 'Ta force stagne deux semaines', pct: 0,
        advice: "Démarre à ta maintenance. Mange à ta dépense réelle, le temps que ton corps s'adapte et que ta force grimpe.",
        advance: "Passe à l'étape suivante quand ta progression en charge stagne deux semaines de suite." },
      { label: 'Étape 1', short: '+5 % : prise de muscle propre', when: 'La prise de poids ralentit, le miroir reste net', pct: 0.05,
        advice: "Surplus de 5 %. C'est le bon réglage pour gagner du muscle proprement, environ {kg} kg par semaine au maximum.",
        advance: 'Augmente encore si la prise de poids ralentit et que le miroir reste net.' },
      { label: 'Étape 2', short: '+10 % quand tu pousses fort', when: 'Dernier palier : redescends si le gras monte', pct: 0.10,
        advice: 'Surplus de 10 % pour les phases où tu pousses fort. Surveille ton tour de taille : si le gras monte trop vite, redescends.',
        advance: 'Dernier palier. Reviens en arrière dès que la prise de gras devient visible.' },
    ],
  },
  {
    id: 'P2', name: 'Recomposition corporelle',
    purpose: "Ce programme sert à perdre du gras et à gagner du muscle en même temps. Un léger déficit de 10 %, des protéines élevées et un entraînement sérieux suffisent : ton corps puise dans ses réserves de gras tout en construisant du muscle. Le poids bouge peu, ce sont le miroir et le tour de taille qui changent.",
    forWho: ['Tu débutes la musculation ou tu reprends après une pause', "Tu as un peu de gras à perdre, mais pas beaucoup", 'Tu veux un seul réglage, sans changer de palier'],
    duration: '8 à 12 semaines, puis bilan',
    tagline: 'Perdre du gras et gagner du muscle',
    phases: [
      { label: 'Phase unique', short: '−10 % sur la durée : la balance bouge peu, le miroir oui', when: 'Refais ton profil toutes les quatre semaines', pct: -0.10,
        advice: "Reste sur ce déficit léger sur la durée. La balance bougera peu, mais le miroir et les mensurations, oui. C'est normal et c'est le but.",
        advance: 'Pas de palier à changer. Mets à jour ton poids et ta masse grasse toutes les quatre semaines pour recalculer.' },
    ],
  },
  {
    id: 'P3', name: 'Créer le déficit parfait',
    purpose: "Ce programme sert à sécher sur quelques semaines, de façon maîtrisée. Tu commences par un déficit doux, puis tu le creuses une seule fois quand la perte de poids ralentit. C'est un bon compromis entre rapidité et confort au quotidien.",
    forWho: ["Tu as un objectif proche, comme l'été ou un événement", 'Tu as quelques kilos de gras à perdre', 'Tu veux un cadre simple, en deux étapes'],
    duration: '4 à 8 semaines',
    tagline: 'Sécher de façon maîtrisée',
    phases: [
      { label: 'Semaine initiale', short: '−10 % : déficit doux, énergie intacte', when: 'Le poids stagne une dizaine de jours', pct: -0.10,
        advice: "Déficit doux de 10 %. Tu perds environ {kg} kg par semaine sans souffrir, et l'énergie reste bonne.",
        advance: "Passe à l'étape 1 quand ton poids stagne une dizaine de jours." },
      { label: 'Étape 1', short: '−15 % : appuie-toi sur les protéines et les légumes', when: 'Dernier palier : pour aller plus loin, passe à la perte progressive', pct: -0.15,
        advice: 'Déficit de 15 %, environ {kg} kg par semaine. La faim se fait sentir : appuie-toi sur les protéines et les légumes pour le volume.',
        advance: "C'est le palier final de ce programme. Si tu dois aller plus loin, passe à la perte de gras progressive." },
    ],
  },
  {
    id: 'P4', name: 'Perte de gras progressive',
    purpose: "Ce programme sert à perdre du gras sur plusieurs mois, sans brusquer ton corps. Le déficit augmente par paliers, et seulement quand la perte ralentit : ton métabolisme ne freine pas et tu tiens dans la durée. C'est le programme conseillé pour une vraie transformation.",
    forWho: ['Tu as une quantité importante de gras à perdre', 'Tu vises un changement durable, pas un effet express', 'Tu es [prêt|prête] à suivre le plan sur plusieurs mois'],
    duration: '3 à 6 mois',
    tagline: 'Sécher sur la durée sans choc',
    phases: [
      { label: 'Semaine initiale', short: '−10 % : démarrage en douceur', when: 'La perte ralentit, après environ deux semaines', pct: -0.10,
        advice: "Démarrage en douceur avec un déficit de 10 %. Laisse ton corps s'habituer et garde toute ton énergie pour les séances.",
        advance: "Passe à l'étape 1 dès que la perte de poids ralentit, après environ deux semaines." },
      { label: 'Étape 1', short: '−15 % : perte régulière', when: 'Le poids stagne malgré le plan', pct: -0.15,
        advice: 'On creuse à 15 % sous ta maintenance : une perte régulière d\'environ {kg} kg par semaine. Priorité aux protéines et au sommeil.',
        advance: "Passe à l'étape 2 quand le poids stagne à nouveau malgré le respect du plan." },
      { label: 'Étape 2', short: '−20 % : dernière ligne droite, sur une courte période', when: 'Dernier palier : prévois ensuite une phase de maintenance', pct: -0.20,
        advice: "Déficit de 20 % pour la dernière ligne droite, à tenir sur une courte période. L'hydratation et les fibres sont essentielles.",
        advance: 'Palier final. Après ça, prévois une phase de maintenance avant de repartir.' },
    ],
  },
];

export function getProtocol(id) {
  return PROTOCOLS.find(p => p.id === id) || PROTOCOLS[3];
}

// profile = { sex, age, height (m), weight (kg), bodyfat (%), activity (1 à 4) }
export function computeBase(profile) {
  const { age, height, weight, bodyfat } = profile;
  const female = profile.sex === 'female';
  const bmr1 = female
    ? 9.247 * weight + 309.8 * height - 4.330 * age + 447.593
    : 13.707 * weight + 492.3 * height - 6.673 * age + 77.607;
  const leanMass = weight * (100 - bodyfat) / 100;
  const bmr2 = 21.6 * leanMass + 370;
  const bmr  = (bmr1 + bmr2) / 2;
  const coef = activityCoef(profile.activity ?? 2);
  const maintenance = bmr * coef;
  const protein = (weight * 1.5 + leanMass * 2) / 2;
  const fat     = 1.2 * leanMass;
  const floorKcal = Math.max(bmr, female ? 1200 : 1500);
  const fatShare  = female ? 0.25 : 0.20;
  return { bmr1, bmr2, bmr, coef, maintenance, leanMass, protein, fat, floorKcal, fatShare };
}

// Cibles d'une étape, avec le détail des garde-fous appliqués
export function computeDetails(profile, protocolId, phaseIndex = 0) {
  const base = computeBase(profile);
  const protocol = getProtocol(protocolId);
  const phase = protocol.phases[Math.min(phaseIndex, protocol.phases.length - 1)];
  const wanted = base.maintenance * (1 + phase.pct);
  const kcal = Math.max(wanted, base.floorKcal);
  const protein = base.protein;
  const fat = Math.max(base.fat, kcal * base.fatShare / 9);
  const carbs = Math.max(0, (kcal - protein * 4 - fat * 9) / 4);
  return {
    targets: { kcal: Math.round(kcal), protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat) },
    floored: kcal > wanted + 0.5,
    fatRaised: fat > base.fat + 0.5,
    wanted: Math.round(wanted),
    floor: Math.round(base.floorKcal),
  };
}

// Renvoie les cibles { kcal, protein, carbs, fat } pour une phase donnée
export function computeTargets(profile, protocolId, phaseIndex = 0) {
  return computeDetails(profile, protocolId, phaseIndex).targets;
}

// Toutes les phases d'un programme (pour affichage du plan complet)
export function computeAllPhases(profile, protocolId) {
  const protocol = getProtocol(protocolId);
  return protocol.phases.map((ph, i) => ({
    label: ph.label,
    pct: ph.pct,
    targets: computeTargets(profile, protocolId, i),
  }));
}

// Rythme estimé (kg par semaine) d'un écart de calories : environ 7 700 kcal par kilo
export const kgPerWeek = deltaKcal => Math.abs(deltaKcal) * 7 / 7700;
const kgText = v => v.toFixed(1).replace('.', ',');

// Programme avec ses textes accordés au profil et ses rythmes calculés
export function protocolFor(profile, protocolId) {
  const p = getProtocol(protocolId);
  const maint = computeBase(profile).maintenance;
  const ph = computeAllPhases(profile, protocolId);
  const t = s => gx(s, profile.sex);
  return {
    ...p,
    purpose: t(p.purpose), forWho: p.forWho.map(t), tagline: t(p.tagline),
    phases: p.phases.map((x, i) => ({
      ...x,
      short: t(x.short), when: t(x.when), advance: t(x.advance),
      advice: t(x.advice).replace('{kg}', kgText(kgPerWeek(ph[i].targets.kcal - maint))),
    })),
  };
}
export const protocolsFor = profile => PROTOCOLS.map(p => protocolFor(profile, p.id));

// ── Profil de la personne active (stocké dans le foyer) ──
const PROFILE_KEYS = ['sex', 'age', 'height', 'weight', 'bodyfat', 'activity'];
export function getProfile() {
  const m = getActiveMember();
  const p = {};
  PROFILE_KEYS.forEach(k => p[k] = m[k]);
  return p;
}
export function saveProfile(p) {
  const patch = {};
  PROFILE_KEYS.forEach(k => { if (p[k] !== undefined) patch[k] = p[k]; });
  updateActiveMember(patch);
}

export const getSelectedProtocol = () => getActiveMember().protocol || 'P4';
export const saveSelectedProtocol = id => updateActiveMember({ protocol: id });
export const getSelectedPhase = () => parseInt(getActiveMember().phase || 0);
export const saveSelectedPhase = i => updateActiveMember({ phase: i });

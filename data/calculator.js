// calculator.js — Moteur Zero to Hero
// Reproduit exactement les formules du calculateur Excel.
//
// BMR1 = 13.707×poids + 492.3×taille(m) − 6.673×âge + 77.607
// BMR2 = 21.6×poids×(100−bf)/100 + 370
// BMR  = moyenne(BMR1, BMR2)
// MMR (maintenance) = BMR × 1.5
// Masse maigre = poids×(100−bf)/100
// Protéines = moyenne(poids×1.5, massemaigre×2)   [g/jour]
// Lipides   = 1.2×poids×(1−bf/100)                 [g/jour]
// Glucides  = (kcal − prot×4 − lip×9) / 4          [g/jour]

export const PROTOCOLS = [
  {
    id: 'P1', name: 'Prise de muscle propre', emoji: '💪',
    purpose: "Ce programme sert à prendre du muscle en limitant au maximum la prise de gras. Tu commences à ta maintenance, puis tu ajoutes un léger surplus de calories uniquement quand ta progression ralentit. Le gain est lent mais propre : la balance monte doucement et ton tour de taille reste stable.",
    forWho: ["Tu es déjà plutôt sec et tu veux gagner du volume", "Tu t'entraînes régulièrement et tes charges progressent", "Tu acceptes de prendre un peu de poids pour construire du muscle"],
    duration: 'Sur plusieurs mois', goal: 'Muscle',
    tagline: 'Construire du muscle en limitant le gras',
    desc: 'Léger surplus calorique progressif. On ajoute des calories au fil des semaines pour continuer à prendre du muscle sans accumuler de gras superflu.',
    phases: [
      { label: 'Semaine initiale', short: "Maintenance : le corps s'adapte, la force grimpe", when: 'Ta force stagne 2 semaines', offset: 0,
        advice: 'Démarre à maintenance. Mange à ta dépense réelle, le temps que ton corps s\'adapte et que ta force grimpe.',
        advance: 'Passe à l\'étape suivante quand ta progression en charge stagne 2 semaines de suite.' },
      { label: 'Étape 1', short: '+200 kcal : prise de muscle propre', when: 'La prise de poids ralentit, le miroir reste net', offset: +200,
        advice: 'Surplus de +200 kcal. C\'est le sweet spot pour gagner du muscle proprement (~+0.25 kg/semaine max).',
        advance: 'Augmente encore si la prise de poids ralentit et que le miroir reste net.' },
      { label: 'Étape 2', short: '+400 kcal quand tu pousses fort', when: 'Dernier palier : redescends si le gras monte', offset: +400,
        advice: 'Surplus de +400 kcal pour les phases où tu pousses fort. Surveille le tour de taille — si le gras monte trop vite, redescends.',
        advance: 'Dernier palier. Reviens en arrière dès que la prise de gras devient visible.' },
    ],
  },
  {
    id: 'P2', name: 'Recomposition corporelle', emoji: '🔄',
    purpose: "Ce programme sert à perdre du gras et à gagner du muscle en même temps. Un léger déficit de 300 kcal, des protéines élevées et un entraînement sérieux suffisent : ton corps puise dans ses réserves de gras tout en construisant du muscle. Le poids bouge peu, ce sont le miroir et le tour de taille qui changent.",
    forWho: ["Tu débutes la musculation ou tu reprends après une pause", "Tu as un peu de gras à perdre, mais pas beaucoup", "Tu veux un seul réglage, sans changer de palier"],
    duration: '8 à 12 semaines, puis bilan', goal: 'Gras ↓ · muscle ↑',
    tagline: 'Perdre du gras ET gagner du muscle',
    desc: 'Un seul réglage : maintenance −300 kcal. Avec des protéines élevées et un entraînement sérieux, le corps puise dans le gras tout en construisant du muscle. Idéal si tu débutes ou reprends après une pause.',
    phases: [
      { label: 'Phase unique', short: '−300 kcal sur la durée : la balance bouge peu, le miroir oui', when: 'Refais ton profil toutes les 4 semaines', offset: -300,
        advice: 'Reste sur ce déficit léger sur la durée. La balance bougera peu mais le miroir et les mensurations, oui. C\'est normal et c\'est le but.',
        advance: 'Pas de palier à changer. Réévalue ton profil (poids, masse grasse) toutes les 4 semaines pour recalculer.' },
    ],
  },
  {
    id: 'P3', name: 'Créer le déficit parfait', emoji: '🎯',
    purpose: "Ce programme sert à sécher sur quelques semaines, de façon maîtrisée. Tu commences par un déficit doux, puis tu le creuses une seule fois quand la perte de poids ralentit. C'est un bon compromis entre rapidité et confort au quotidien.",
    forWho: ["Tu as un objectif proche, comme l'été ou un événement", "Tu as quelques kilos de gras à perdre", "Tu veux un cadre simple, en deux étapes"],
    duration: '4 à 8 semaines', goal: 'Sèche',
    tagline: 'Sécher de façon maîtrisée',
    desc: 'Déficit en deux paliers. On commence modéré, puis on creuse quand la perte ralentit. Bon compromis vitesse / confort pour une sèche de quelques semaines.',
    phases: [
      { label: 'Semaine initiale', short: '−300 kcal : déficit doux, énergie intacte', when: 'Le poids stagne une dizaine de jours', offset: -300,
        advice: 'Déficit doux de −300 kcal. Tu perds ~0.3 kg/semaine sans souffrir, l\'énergie reste bonne.',
        advance: 'Passe à l\'étape 1 quand ton poids stagne ~10 jours.' },
      { label: 'Étape 1', short: '−500 kcal : appuie-toi sur protéines et légumes', when: 'Dernier palier : pour aller plus loin, passe à la perte progressive', offset: -500,
        advice: 'Déficit de −500 kcal, ~0.5 kg/semaine. La faim se fait sentir : appuie-toi sur les protéines et les légumes pour le volume.',
        advance: 'C\'est le palier final de ce protocole. Si tu dois aller plus loin, bascule sur le Protocole 4.' },
    ],
  },
  {
    id: 'P4', name: 'Perte de gras progressive', emoji: '📉',
    purpose: "Ce programme sert à perdre du gras sur plusieurs mois, sans brusquer ton corps. Le déficit augmente par paliers, et seulement quand la perte ralentit : ton métabolisme ne freine pas et tu tiens dans la durée. C'est le programme conseillé pour une vraie transformation.",
    forWho: ["Tu as une quantité importante de gras à perdre", "Tu vises un changement durable, pas un effet express", "Tu es prêt à suivre le plan sur plusieurs mois"],
    duration: '3 à 6 mois', goal: 'Sèche longue',
    tagline: 'Sécher sur la durée sans choc',
    desc: 'Déficit en trois paliers. On augmente progressivement la restriction pour éviter le coup de frein métabolique et tenir sur plusieurs mois. Le protocole conseillé pour une vraie transformation.',
    phases: [
      { label: 'Semaine initiale', short: '−300 kcal : démarrage en douceur', when: 'La perte ralentit (environ 2 semaines)', offset: -300,
        advice: 'Démarrage en douceur à −300 kcal. Laisse le corps s\'habituer, garde toute ton énergie pour les séances.',
        advance: 'Passe à l\'étape 1 dès que la perte de poids ralentit (~2 semaines).' },
      { label: 'Étape 1', short: '−500 kcal : perte régulière', when: 'Le poids stagne malgré le plan', offset: -500,
        advice: 'On creuse à −500 kcal. Perte régulière d\'environ 0.5 kg/semaine. Priorise protéines + sommeil.',
        advance: 'Passe à l\'étape 2 quand le poids stagne à nouveau malgré le respect du plan.' },
      { label: 'Étape 2', short: '−700 kcal : dernière ligne droite, sur une courte période', when: 'Dernier palier : prévois ensuite une phase de maintenance', offset: -700,
        advice: 'Déficit fort de −700 kcal pour la dernière ligne droite. À tenir sur des périodes courtes. Hydratation et fibres essentielles.',
        advance: 'Palier final. Après ça, prévois une phase de maintenance avant de repartir.' },
    ],
  },
];

export function getProtocol(id) {
  return PROTOCOLS.find(p => p.id === id) || PROTOCOLS[3];
}

// profile = { age, height (m), weight (kg), bodyfat (%) }
export function computeBase(profile) {
  const { age, height, weight, bodyfat } = profile;
  const bmr1 = 13.707 * weight + 492.3 * height - 6.673 * age + 77.607;
  const bmr2 = 21.6 * weight * (100 - bodyfat) / 100 + 370;
  const bmr  = (bmr1 + bmr2) / 2;
  const maintenance = bmr * 1.5;
  const leanMass = weight * (100 - bodyfat) / 100;
  const protein  = (weight * 1.5 + leanMass * 2) / 2;
  const fat      = 1.2 * weight * (1 - bodyfat / 100);
  return { bmr1, bmr2, bmr, maintenance, leanMass, protein, fat };
}

// Renvoie les cibles { kcal, protein, carbs, fat } pour une phase donnée
export function computeTargets(profile, protocolId, phaseIndex = 0) {
  const base = computeBase(profile);
  const protocol = getProtocol(protocolId);
  const phase = protocol.phases[Math.min(phaseIndex, protocol.phases.length - 1)];
  const kcal = base.maintenance + phase.offset;
  const protein = base.protein;
  const fat = base.fat;
  const carbs = (kcal - protein * 4 - fat * 9) / 4;
  return {
    kcal:    Math.round(kcal),
    protein: Math.round(protein),
    carbs:   Math.round(carbs),
    fat:     Math.round(fat),
  };
}

// Toutes les phases d'un protocole (pour affichage du plan complet)
export function computeAllPhases(profile, protocolId) {
  const protocol = getProtocol(protocolId);
  return protocol.phases.map((ph, i) => ({
    label: ph.label,
    offset: ph.offset,
    targets: computeTargets(profile, protocolId, i),
  }));
}

// Profil persisté
const DEFAULT_PROFILE = { age: 24, height: 1.85, weight: 97, bodyfat: 20 };

export function getProfile() {
  const saved = localStorage.getItem('diet_profile');
  if (saved) { try { return { ...DEFAULT_PROFILE, ...JSON.parse(saved) }; } catch {} }
  return { ...DEFAULT_PROFILE };
}
export function saveProfile(p) { localStorage.setItem('diet_profile', JSON.stringify(p)); }

export function getSelectedProtocol() {
  return localStorage.getItem('diet_protocol') || 'P4';
}
export function saveSelectedProtocol(id) { localStorage.setItem('diet_protocol', id); }

export function getSelectedPhase() {
  return parseInt(localStorage.getItem('diet_phase') || '0');
}
export function saveSelectedPhase(i) { localStorage.setItem('diet_phase', String(i)); }

export { DEFAULT_PROFILE };

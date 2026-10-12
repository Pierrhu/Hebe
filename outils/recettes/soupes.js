// Soupes (v205) — recettes apportées par Pierre (PDF du 07/10/2026), reprises SANS RIEN AJOUTER :
// mêmes ingrédients, quantités du PDF ramenées à 1 portion. Seules adaptations : le matériel d'Hébé
// (autocuiseur en mode dorer à la place de la casserole, sous pression pour les longues cuissons) et les
// règles d'Hébé (lait de coco classique, sauce soja remplacée par le tamari seulement en sans gluten).
// v206 : quantités réajustées après relecture (moins de sel, moins de gras, plus de protéines) ; velouté de patate douce retiré (aucune protéine).
// Catégorie « soup » : ni le moteur ni le catalogue ne les proposent tant que l'option « Soupe » n'existe pas.
const R = (id, name, emoji, prep, cook, ings, steps, tip, tags, extra = {}) =>
  ({ id, name, cat: 'soup', emoji, prep, cook, ings, steps, tip, tags: ['soupe', ...tags], batch: true, ...extra });

const MISO = "Prélève une louche de bouillon dans un bol, délaye-y la pâte miso, puis reverse-la dans la cuve, hors du feu : le miso ne doit jamais bouillir.";
const NOUILLES_REPAS = "Au moment de manger : réchauffe le bouillon 3 minutes au micro-ondes, jusqu'à ce qu'il frémisse sans bouillir, puis ajoute les nouilles de riz et laisse-les gonfler 4 à 5 minutes à couvert, en remuant une fois.";

exports.soups = [
  R('SO01', 'Soupe thaï au poulet, carottes, coco et curry', '🍜', 15, 15,
    [['poulet', 160], ['carotte', 120], ['oignon', 50], ['ail', 1], ['bouillon', 0.25], ['lait_coco', 100], ['epices', 1], ['gingembre', 5], ['soja', 5], ['citron', 10], ['herbes', 3], ['nouilles_riz', 60], ['huile', 3]],
    ["Émince l'oignon, coupe les carottes en rondelles, écrase l'ail, râpe le gingembre et émince le poulet en fines lanières.",
     "Mets l'autocuiseur en mode dorer avec l'huile. Fais revenir l'oignon 3 minutes, jusqu'à ce qu'il colore légèrement, puis ajoute l'ail, le gingembre et le curry, et remue 1 minute.",
     "Ajoute le poulet et fais-le dorer 3 minutes sur toutes les faces.",
     "Verse 200 ml d'eau froide par portion avec le bouillon cube émietté, le lait de coco et les carottes. Ferme et laisse cuire 4 minutes sous pression, puis fais tomber la pression : le poulet ne doit plus être rose au centre et les carottes doivent être tendres.",
     "Ajoute la sauce soja et le jus de citron, goûte et ajuste.",
     "Mise en boîtes : la soupe au frigo dès qu'elle a tiédi, ou au congélateur. Les nouilles restent dans leur paquet, la coriandre au frigo.",
     NOUILLES_REPAS + " Parsème de coriandre ciselée."],
    "Les nouilles ajoutées au dernier moment restent fermes, même le troisième jour.", ['thaï', 'autocuiseur', 'batch']),

  R('SO02', 'Bouillon de poulet au miso, épinards et nouilles de riz', '🍲', 10, 25,
    [['haut_cuisse', 170], ['epinards', 120], ['nouilles_riz', 70], ['ail', 2], ['oignon', 50], ['miso', 12], ['soja', 5], ['gingembre', 5], ['epices', 1], ['sesame', 3]],
    ["Pèle l'oignon et coupe-le en quatre. Écrase légèrement les gousses d'ail sans les peler. Râpe le gingembre.",
     "Mets les hauts de cuisse dans l'autocuiseur avec l'oignon, l'ail, le gingembre, la feuille de laurier, la sauce soja et 350 ml d'eau froide par portion. Porte à ébullition en mode dorer et retire à la cuillère la mousse qui se forme en surface.",
     "Ferme et laisse cuire 15 minutes sous pression, puis laisse la pression retomber seule 10 minutes.",
     "Sors le poulet, laisse-le tiédir quelques minutes et effiloche-le à la fourchette. Retire le laurier et l'ail.",
     "Remets l'autocuiseur en mode dorer, ajoute les épinards surgelés et laisse-les fondre 3 à 4 minutes. Arrête le feu.",
     MISO + " Remets le poulet effiloché et poivre : le miso et la sauce soja salent déjà bien.",
     "Mise en boîtes : le bouillon au frigo dès qu'il a tiédi, ou au congélateur. Les nouilles restent dans leur paquet.",
     NOUILLES_REPAS + " Parsème de graines de sésame."],
    "Le bouillon sans les nouilles se garde 3 jours au frigo : ajoute-les seulement au réchauffage.", ['japonais', 'autocuiseur', 'batch'],
    { note: "Notes de Pierre reprises : 1 oignon et 1 feuille de laurier en plus, 2 cuillères à soupe de miso blanc pour deux." }),

  R('SO03', 'Bouillon miso au tofu, poireaux et champignons', '🍜', 10, 15,
    [['tofu', 180], ['poireau', 150], ['champignons', 120], ['nouilles_riz', 70], ['miso', 12], ['huile', 5], ['ail', 1], ['gingembre', 3], ['epices', 1], ['sesame', 3], ['soja', 3]],
    ["Coupe le tofu en dés de 2 cm (presse-le d'abord quelques minutes dans un torchon, il se tiendra mieux). Coupe le poireau en rondelles, blanc et vert tendre, rince-les, et émince les champignons et l'ail. Râpe le gingembre.",
     "Mets l'autocuiseur en mode dorer avec l'huile. Fais revenir l'ail 1 minute, puis ajoute le curcuma et le gingembre, 30 secondes.",
     "Ajoute le poireau et fais-le cuire 4 à 5 minutes, jusqu'à ce qu'il soit tendre, puis les champignons, 3 à 4 minutes.",
     "Ajoute le tofu et fais-le dorer légèrement 2 minutes.",
     "Verse 400 ml d'eau froide par portion et porte à frémissement. Arrête le feu.",
     MISO,
     "Mise en boîtes : le bouillon au frigo dès qu'il a tiédi, ou au congélateur. Les nouilles restent dans leur paquet.",
     NOUILLES_REPAS + " Ajoute quelques gouttes de sauce soja et les graines de sésame."],
    "La pâte miso blanche est plus douce que la rouge.", ['japonais', 'végé', 'autocuiseur', 'batch']),

  R('SO04', 'Soupe de pois cassés, poireaux et cumin', '🥣', 10, 25,
    [['pois_casses', 110], ['poireau', 110], ['carotte', 70], ['oignon', 50], ['ail', 1], ['bouillon', 0.25], ['huile', 5], ['epices', 2], ['lin', 5], ['herbes', 3]],
    ["Rince les pois cassés à l'eau froide. Émince les poireaux et les oignons, coupe les carottes en rondelles et hache l'ail.",
     "Mets l'autocuiseur en mode dorer avec l'huile. Fais revenir les oignons et les poireaux 5 minutes, puis l'ail 1 minute.",
     "Ajoute le cumin, le curcuma, la coriandre moulue et le poivre, et fais-les griller 30 secondes en remuant.",
     "Ajoute les pois cassés, les carottes, la feuille de laurier, le bouillon cube émietté et 250 ml d'eau froide par portion. Mélange et gratte bien le fond.",
     "Ferme et laisse cuire 15 minutes sous pression, puis laisse la pression retomber seule 10 minutes : les pois cassés doivent être fondants et crémeux. Retire le laurier et goûte avant de saler.",
     "Mise en boîtes : la soupe au frigo dès qu'elle a tiédi, ou au congélateur. Les graines de lin et le persil restent à part.",
     "Au moment de manger : réchauffe 3 minutes au micro-ondes avec 3 cuillères à soupe d'eau, en remuant à mi-temps, jusqu'à ce que ce soit bien chaud partout : la soupe épaissit en refroidissant. Hors du feu, saupoudre les graines de lin moulues et le persil."],
    "Pas besoin de faire tremper les pois cassés. Le cumin les rend plus digestes.", ['français', 'végé', 'autocuiseur', 'batch']),

  R('SO06', 'Velouté carotte-butternut et œuf mollet', '🥕', 10, 10,
    [['butternut', 200], ['carotte', 100], ['oignon', 30], ['ail', 1], ['bouillon', 0.25], ['huile', 5], ['lait_coco', 40], ['gingembre', 3], ['oeuf', 2]],
    ["Épluche la courge butternut et retire les graines. Coupe-la en morceaux avec les carottes. Émince finement l'oignon.",
     "Mets l'autocuiseur en mode dorer avec l'huile, en gardant un filet pour le service. Fais revenir l'oignon et l'ail 3 à 4 minutes à feu doux, sans coloration.",
     "Ajoute la courge et les carottes, mélange 1 minute, puis le gingembre râpé, le bouillon cube émietté et 250 ml d'eau froide par portion. Ferme et laisse cuire 6 minutes sous pression, puis fais tomber la pression : les légumes doivent être bien tendres.",
     "Mixe au mixeur plongeant jusqu'à ce que ce soit lisse, puis ajoute le lait de coco. Ajoute un peu d'eau si le velouté est trop épais. Sale très légèrement et poivre. Verse-le dans un plat et rince la cuve.",
     "Œufs mollets : pose les œufs sur le panier vapeur de l'autocuiseur avec 200 ml d'eau froide, ferme et laisse cuire 3 minutes sous pression. Fais tomber la pression, plonge les œufs dans de l'eau froide 5 minutes et écale-les délicatement.",
     "Mise en boîtes : le velouté au frigo dès qu'il a tiédi, ou au congélateur. Les œufs écalés à part, dans une boîte au frigo : ils se gardent 3 jours et ne se congèlent pas.",
     "Au moment de manger : réchauffe le velouté 3 minutes au micro-ondes en remuant à mi-temps. Coupe les œufs en deux, pose-les dessus et ajoute un filet d'huile d'olive."],
    "Le velouté se congèle, pas les œufs : garde ceux-ci pour les trois premiers jours.", ['français', 'végé', 'autocuiseur', 'batch']),
];

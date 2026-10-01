# DIET — δίαιτα

Application PWA de nutrition & planification de repas.
**App-sœur de PONOS** (qui gère le sport) : même ADN visuel — fond noir, titres Cinzel,
labels capitales espacées — mais là où PONOS est rouge sang (la guerre, l'effort),
DIET est or/bronze (le festin, le carburant du guerrier).

*díaita* (δίαιτα) = le mot grec d'origine, qui signifie « manière de vivre », pas « régime ».

## Identité visuelle
- **Couleurs** : noir `#0C0C10` (commun à PONOS) · or `#C9A227` → bronze `#A8763E`
- **Typographie** : Cinzel (titres, épopée grecque) + Space Grotesk (corps) — identiques à PONOS
- **Macros** : protéines teal `#1A9E8F` · glucides ambre `#E4A229` · lipides terracotta `#C2683B`

## Lancer en local
Ouvre `index.html` (le bundle `js/app.js` ne nécessite pas de serveur).

## Déploiement (comme PONOS)
1. Pousse ce dossier sur GitHub.
2. Settings → Pages → Source : branche `main`, dossier `/root`.
3. GitHub te donne une URL `https://<ton-pseudo>.github.io/<repo>/`.
4. Ouvre cette URL sur ton téléphone → menu navigateur → **Ajouter à l'écran d'accueil**.
   L'app s'installe comme PONOS, plein écran, icône incluse.

⚠️ Les polices Cinzel/Space Grotesk se chargent depuis Google Fonts (connexion requise au
premier lancement, puis mises en cache par le service worker).

## Build
Après toute modif dans `js/*.js` ou `data/*.js`, régénère le bundle :
```
node build.js
```

## Structure
```
data/   ingredients.js (macros, prix, portions réalistes) · recipes.js (30 plats du monde,
        12 accompagnements air fryer, 12 collations) · calculator.js · user.js · log.js · migrate.js
js/     optimizer.js (calibrage des portions) · weekgen.js (semaine en 2 sessions de batch)
        vues : week (Semaine), cook (Cuisiner), shopping (Courses), recipes, settings + app.js (bundle)
```

## Comment la semaine est générée
- 2 sessions de batch : dimanche (lun → mer) et mercredi soir (jeu → dim), 2 plats chacune.
- Matériel : plaques, autocuiseur, air fryer (pas de four).
- Assiette = le plat seul (≈ 1 000 kcal max), viandes 110–350 g ; les accompagnements air fryer restent au catalogue.
- 1 collation par jour + compléments sans préparation (fromage blanc-miel, banane-cacahuète, amandes, fruit, pain).
- Plats tirés au sort parmi les protéines choisies, ~60-70 € par semaine.

## Modifier les recettes
Les recettes sont générées depuis une liste compacte. Pour en ajouter une, copier un appel `M(...)`
dans `data/recipes.js` avec des clés de `data/ingredients.js` : macros et coût sont calculés seuls.

# Hébé — Bien manger sans y penser

Application web installable (PWA) de planification de repas et de batch cooking, en français.
Hébé prépare une semaine de repas calibrée sur les besoins de chacun (1 ou 2 personnes),
organise une seule session de cuisine le dimanche, et produit la liste de courses.

## Ce que fait l'app
- **Semaine** : déjeuners, dîners, petits-déjeuners (formule classique) et collations, avec des portions
  calculées pour atteindre les calories et les protéines de chaque personne. Repas libres possibles.
- **Cuisiner** : une session le dimanche, dans l'ordre réel (autocuiseur, riz, air fryer, mise en boîtes),
  frigo du lundi au mercredi, congélateur au-delà, avec un rappel pour décongeler la veille.
- **Courses** : la liste par rayon, en formats de magasin (barquettes entières).
- **Recettes** : 41 plats, 7 petits-déjeuners, 8 collations et 5 compléments, tous avec ingrédients
  de supermarché courant.
- **Mon programme** : la fiche de chaque personne, son objectif (4 programmes) et l'équipement de cuisine,
  auquel les recettes s'adaptent (four à la place de l'air fryer, casserole à la place de l'autocuiseur…).

## Identité visuelle
- **Couleurs** : vert sauge `#7C9885`, crème `#F6F1E6`, terracotta `#D98E6B`, vert-gris foncé `#2A3A30`.
- **Typographie** : Fraunces (titres) et Outfit (texte), chargées depuis Google Fonts puis mises en cache.
- **Illustrations** : personnages, tablier et joker dans `img/art/` ; photos des plats dans `img/dishes/`.

## Lancer en local
Le plus simple est un petit serveur local à la racine du dossier, par exemple :
```
python3 -m http.server 8765
```
puis ouvrir `http://localhost:8765`.

## Déploiement
1. Pousser le dossier sur GitHub.
2. Settings → Pages → Source : branche `main`, dossier `/root`.
3. Ouvrir l'URL donnée par GitHub sur le téléphone → menu du navigateur → **Ajouter à l'écran d'accueil**.

L'app se met à jour toute seule : à chaque nouvelle version, changer le nom du cache dans `sw.js`.

## Modifier les recettes
Les recettes se rédigent dans `outils/recettes/` (plats_du_monde, petits_dejeuners, collations,
complements ; textes des étapes dans generer.js), puis :
```
node outils/recettes/generer.js && node build.js
```

## Build
Après toute modification dans `js/*.js` ou `data/*.js`, régénérer le bundle :
```
node build.js
```

## Tests
```
node outils/tests/precision.js     # précision des calories sur 30 semaines
node outils/tests/foyer.js         # foyer de 2 personnes, repas libres
node outils/tests/preferences.js   # petits-déjeuners sucrés/salés, avec ou sans whey
node outils/tests/formules.js      # formule jeûne ou classique
node outils/tests/lactose.js       # régime sans lactose (seul, strict, foyer mixte)
node outils/tests/gluten.js        # régime sans gluten (et cumul avec le sans lactose)
node outils/tests/foyer_regimes.js # foyer à deux, l'une sans lactose ni gluten
node outils/tests/laitages.js      # un seul laitage en bol par jour
```

## Structure
```
data/    ingredients.js · recipes.js (généré) · calculator.js · household.js · photos.js · prefs.js
js/      optimizer.js (portions) · weekgen.js (semaine et session) · adapt.js (équipement)
         vues : welcome, week, cook, shopping, recipes, recipeDetail, settings · app.js (bundle)
outils/  recettes/ (sources des recettes) · tests/
img/     dishes/ (photos des plats) · art/ (illustrations)
```

Le fichier `CONTEXTE.md` garde l'historique détaillé des choix et de l'état du projet.

# Outils de Hébé

Ces fichiers ne sont pas chargés par l'app. Ils servent à **générer les recettes** et à **vérifier le moteur**.
Tout se lance depuis la racine du projet.

## Recettes (`outils/recettes/`)

`data/recipes.js` est **généré** : ne pas le modifier à la main, sinon les changements seront écrasés.

| Fichier | Contenu |
|---|---|
| `plats_du_monde.js` | Les 30 plats (W01 à W30) et les 12 accompagnements air fryer (SA01 à SA12) |
| `collations.js` | Les collations à la whey (K01 à K12) |
| `petits_dejeuners.js` | Les petits-déjeuners simples de la formule classique (sucrés, salés, avec ou sans whey) |
| `complements.js` | Compléments sans préparation, tartines, cantine, repas dehors |
| `recettes_anciennes.json` | Recettes historiques encore référencées |
| `generer.js` | Assemble le tout. Contient aussi les noms courts, les astuces retenues et les étapes rédigées |

Rédaction des étapes : voir la section « Rédaction des recettes » de `CONTEXTE.md` (les étapes commençant par « Riz : », « Mise en boîtes : » et « Au moment de manger : » sont reconnues par la page Cuisiner).

Après une modification :

```bash
node outils/recettes/generer.js   # régénère data/recipes.js
node build.js                     # regénère js/app.js
```

Pensez aussi à incrémenter la version du cache dans `sw.js` (`hebe-vXX`) pour que les téléphones récupèrent la mise à jour.

## Vérifications (`outils/tests/`)

```bash
node outils/tests/precision.js   # 30 semaines simulées : précision des calories et des macros
node outils/tests/macros.js      # calories, protéines, glucides, lipides sur 5 profils (dont 2 féminins)
node outils/tests/formules.js    # formules jeûne et classique : calories, quantités à chaque repas
node outils/tests/preferences.js # petit-déjeuner sucré, salé ou les deux, option sans whey
node outils/tests/foyer.js       # foyer de deux personnes : mêmes plats, portions de chacun, barquettes communes
node outils/tests/feculents.js   # minimums de féculents (proportionnels à l'assiette), wraps et pitas en unités entières
```

Test du parcours complet dans un vrai navigateur (nécessite Python et Playwright). Il part d'un foyer de deux personnes déjà renseigné et vérifie la semaine, la session de cuisine (cuisson du riz complet), les courses et une fiche recette, avec puis sans autocuiseur :

```bash
python3 -m http.server 8765      # dans un premier terminal
python3 outils/tests/parcours.py # dans un second
```

Test du réglage « Riz et pâtes » (complets, classiques, plat par plat ; avec et sans autocuiseur ; sans gluten) :

```
node outils/tests/riz_pates.js
```

Répartition des plats sur 200 semaines (chaque plat doit sortir à peu près aussi souvent que les autres) :

```
node outils/tests/repartition.js
node outils/tests/repartition.js poulet boeuf
```

Repas libres (cantine, week-end, soirs, motifs aléatoires) : portions, fraîcheur, même plat midi et soir, semaines vides :

```
node outils/tests/repas_libres.js
```

Laitages en pots entiers (fromage blanc, yaourt grec : part de ce qui est acheté qui est consommé) :

```
node outils/tests/laitages_pots.js
```

Produits frais (part de ce qui est acheté qui est consommé dans la semaine, 1 personne ou foyer de 2) :

```
node outils/tests/frais.js 100
node outils/tests/frais.js 50 2
```

# Outils de Hébé

Ces fichiers ne sont pas chargés par l'app. Ils servent à **générer les recettes** et à **vérifier le moteur**.
Tout se lance depuis la racine du projet.

## Recettes (`outils/recettes/`)

`data/recipes.js` est **généré** : ne pas le modifier à la main, sinon les changements seront écrasés.

| Fichier | Contenu |
|---|---|
| `plats_du_monde.js` | Les 30 plats (W01 à W30) et les 12 accompagnements air fryer (SA01 à SA12) |
| `collations.js` | Les collations à la whey (K01 à K12) |
| `complements.js` | Compléments sans préparation, tartines, cantine, repas dehors |
| `recettes_anciennes.json` | Recettes historiques encore référencées |
| `generer.js` | Assemble le tout. Contient aussi les noms courts, les astuces retenues et les étapes rédigées |

Après une modification :

```bash
node outils/recettes/generer.js   # régénère data/recipes.js
node build.js                     # regénère js/app.js
```

Pensez aussi à incrémenter la version du cache dans `sw.js` (`hebe-vXX`) pour que les téléphones récupèrent la mise à jour.

## Vérifications (`outils/tests/`)

```bash
node outils/tests/precision.js   # 30 semaines simulées : précision des calories et des macros
node outils/tests/macros.js      # calories, protéines, glucides, lipides sur 3 profils
node outils/tests/feculents.js   # minimums de féculents, wraps et pitas en unités entières
```

Test du parcours complet dans un vrai navigateur (nécessite Python et Playwright) :

```bash
python3 -m http.server 8765      # dans un premier terminal
python3 outils/tests/parcours.py # dans un second
```

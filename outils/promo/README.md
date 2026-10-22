# Vidéo promo Hébé

`promo.html` : la composition (1080x1920, 30 s), rendue image par image.

Rendu : copier `fonts/` ici, puis `python3 render.py hebe-promo.mp4` (Playwright + ffmpeg, environ 1 min 30).
Aperçu : `python3 stills.py 1.5 7.9 12.3` (images aux secondes demandées).

Les écrans dans `img/` sont des captures de l app (foyer test Pierre et Léa).

Version 2 (« On mange quoi ce soir ? ») : `python3 render.py hebe-promo-v2.mp4 promo2.html`.

Version 3, « Le menu de la semaine » (concept C, 42 s) : `python3 render.py hebe-promo-menu.mp4 promo3.html 42`.

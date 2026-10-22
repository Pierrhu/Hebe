# Vidéo promo Hébé

`promo.html` : la composition (1080x1920, 30 s), rendue image par image.

Rendu : copier `fonts/` ici, puis `python3 render.py hebe-promo.mp4` (Playwright + ffmpeg, environ 1 min 30).
Aperçu : `python3 stills.py 1.5 7.9 12.3` (images aux secondes demandées).

Les écrans dans `img/` sont des captures de l app (foyer test Pierre et Léa).

Version 2 (« On mange quoi ce soir ? ») : `python3 render.py hebe-promo-v2.mp4 promo2.html`.

Version 3, « Le menu de la semaine » (concept C, 42 s) : `python3 render.py hebe-promo-menu.mp4 promo3.html 42`.

Version 4, menu avec l app plus visible (42 s) : `python3 render.py hebe-promo-menu-v2.mp4 promo4.html 42`. Captures faites avec le foyer nommé « Toi » et « Ta moitié ».

Version 5, en deux temps (carte puis app dans le téléphone, 45 s) : `python3 render.py hebe-promo-menu-v3.mp4 promo5.html 45`.

Version 6, cadence lente (71 s) : `python3 render.py hebe-promo-menu-v4.mp4 promo6.html 71`.

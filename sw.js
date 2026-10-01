const CACHE = 'hebe-v107';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './fonts/fraunces-400.woff2',
  './fonts/fraunces-400-italic.woff2',
  './fonts/fraunces-500.woff2',
  './fonts/fraunces-600.woff2',
  './fonts/outfit-400.woff2',
  './fonts/outfit-500.woff2',
  './fonts/outfit-600.woff2',
  './fonts/outfit-700.woff2',
  './manifest.json',
  './js/app.js',
  './data/migrate.js',
  './data/ingredients.js',
  './data/recipes.js',
  './data/photos.js',
  './data/prefs.js',
  './img/dishes/C01.webp',
  './img/dishes/K01.webp',
  './img/dishes/K02.webp',
  './img/dishes/K03.webp',
  './img/dishes/K05.webp',
  './img/dishes/K06.webp',
  './img/dishes/K07.webp',
  './img/dishes/K08.webp',
  './img/dishes/K09.webp',
  './img/dishes/K10.webp',
  './img/dishes/K11.webp',
  './img/dishes/K12.webp',
  './img/dishes/S11.webp',
  './img/dishes/S12.webp',
  './img/dishes/SA11.webp',
  './img/dishes/W01.webp',
  './img/dishes/W02.webp',
  './img/dishes/W03.webp',
  './img/dishes/W04.webp',
  './img/dishes/W05.webp',
  './img/dishes/W06.webp',
  './img/dishes/W07.webp',
  './img/dishes/W08.webp',
  './img/dishes/W09.webp',
  './img/dishes/W10.webp',
  './img/dishes/W11.webp',
  './img/dishes/W12.webp',
  './img/dishes/W13.webp',
  './img/dishes/W14.webp',
  './img/dishes/W15.webp',
  './img/dishes/W16.webp',
  './img/dishes/W17.webp',
  './img/dishes/W18.webp',
  './img/dishes/W19.webp',
  './img/dishes/W20.webp',
  './img/dishes/W21.webp',
  './img/dishes/W22.webp',
  './img/dishes/W23.webp',
  './img/dishes/W24.webp',
  './img/dishes/W25.webp',
  './img/dishes/W26.webp',
  './img/dishes/W27.webp',
  './img/dishes/W28.webp',
  './img/dishes/W29.webp',
  './img/dishes/W30.webp',
  './data/user.js',
  './data/log.js',
  './data/calculator.js',
  './icon-192.png',
  './icon-512.png',
  './icon-192-maskable.png',
  './icon-512-maskable.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (response && response.status === 200 && response.type !== 'opaque') {
          caches.open(CACHE).then(c => c.put(e.request, response.clone()));
        }
        return response;
      }).catch(() => cached);
    })
  );
});

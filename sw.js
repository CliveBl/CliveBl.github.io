const CACHE_NAME = 'cgt-tax-return-v1';
const urlsToCache = [
  '/',
  '/css/index.css',
  '/js/authService.js',
  '/js/slideshow.js',
  '/js/cookieUtils.js',
  '/js/pwa-installer.js',
  '/assets/taxesil/cgtLogo200Trans.webp',
  '/splash.webp',
  '/slide1.webp',
  '/slide2.webp',
  '/slide3.webp',
  '/slide4.webp',
  '/slide5.webp',
  '/slide6.webp',
  '/tax_return.html',
  '/help.html',
  '/faq.html',
  '/presentation.html',
  '/submit_instructions.html',
  '/terms.html',
  '/privacy_policy.html',
  '/verify.html',
  '/reset-password.html',
  '/development.html',
  '/about.markdown',
  '/manifest.json',
  '/browserconfig.xml'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

console.log('Service Worker: Starting up...');
console.log('Service Worker: Self location:', self.location.href);

const CACHE_NAME = 'cgt-tax-return-v1';
const urlsToCache = [
  '/',
  '/css/index.css',
  '/js/authService.js',
  '/js/slideshow.js',
  '/js/cookieUtils.js',
  '/js/pwa-installer.js',
  '/js/index.js',
  '/js/editor.js',
  '/js/env.js',
  '/js/constants.js',
  '/js/imageutils.js',
  '/js/authUI.js',
  '/js/sw.js',
  '/assets/taxesil/cgtLogo200.png',
  '/splash.webp',
  '/slide1.webp',
  '/slide2.webp',
  '/slide3.webp',
  '/slide4.webp',
  '/slide5.webp',
  '/slide6.webp',
  '/tax_return.html',
  '/share-handler.html',
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
self.addEventListener('install', (event: any) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache: Cache) => {
        console.log('Service Worker: Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch((error: Error) => {
        console.error('Service Worker: Cache addAll failed:', error);
      })
  );
});

// Combined fetch event handler - handles both caching and share functionality
self.addEventListener('fetch', (event: any) => {
  console.log(`Service Worker: Fetch event for ${event.request.method} ${event.request.url}`);
  
  // Handle POST requests for share functionality
  if (event.request.method === 'POST' && 
      event.request.url.includes('share-handler.html')) {
    
    console.log('Service Worker: Intercepting share request');
    
    event.respondWith(
      fetch(event.request)
        .then(async (response: Response) => {
          try {
            // Clone the request to read the body
            const clonedRequest = event.request.clone();
            const formData = await clonedRequest.formData();
            const files = formData.getAll('documents');
            
            console.log(`Service Worker: Found ${files.length} shared files`);
            
            // Store files in cache for potential retrieval
            if (files.length > 0) {
              const cache = await caches.open('shared-files');
              for (let i = 0; i < files.length; i++) {
                const file = files[i] as File;
                const cacheKey = `/shared/${Date.now()}_${i}_${file.name}`;
                await cache.put(cacheKey, new Response(file));
                console.log(`Service Worker: Cached file: ${cacheKey}`);
              }
            }
            
            // Clone the response to modify it
            const modifiedResponse = new Response(response.body, {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers
            });
            
            // Add custom header to indicate this was a share request
            modifiedResponse.headers.set('X-Share-Request', 'true');
            modifiedResponse.headers.set('X-Files-Count', files.length.toString());
            
            return modifiedResponse;
          } catch (error) {
            console.error('Service Worker: Error processing share request:', error);
            // Return a fallback response
            return new Response('Share request processed', {
              status: 200,
              headers: { 'Content-Type': 'text/plain' }
            });
          }
        })
        .catch((error: Error) => {
          console.error('Service Worker: Share request failed:', error);
          // Return a fallback response
          return new Response('Share request processed', {
            status: 200,
            headers: { 'Content-Type': 'text/plain' }
          });
        })
    );
    
    return; // Exit early for share requests
  }
  
  // Handle GET requests for caching (only if not already handled)
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request)
        .then((response: Response | undefined) => {
          // Return cached version or fetch from network
          if (response) {
            console.log('Service Worker: Serving from cache:', event.request.url);
            return response;
          }
          
          console.log('Service Worker: Fetching from network:', event.request.url);
          return fetch(event.request);
        })
        .catch((error: Error) => {
          console.error('Service Worker: Fetch failed:', error);
          // Return a fallback response for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
        })
    );
  }
  
  // For any other requests, let them pass through to the network
  console.log('Service Worker: Letting request pass through:', event.request.url);
});

// Activate event - clean up old caches
self.addEventListener('activate', (event: any) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames: string[]) => {
      return Promise.all(
        cacheNames.map((cacheName: string) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Handle messages from the main page (for testing)
self.addEventListener('message', (event: any) => {
  console.log('Service Worker: Received message event!');
  console.log('Service Worker: Event data:', event.data);
  console.log('Service Worker: Event ports:', event.ports);
  console.log('Service Worker: Event source:', event.source);
  
  // Handle ping messages
  if (event.data.action === 'ping') {
    console.log('Service Worker: Received ping, sending pong');
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({
        action: 'pong',
        message: 'Hello from Service Worker!',
        timestamp: Date.now()
      });
      console.log('Service Worker: Pong sent successfully');
    } else {
      console.error('Service Worker: No ports available for ping response');
    }
    return;
  }
  
  // Handle share-target messages
  if (event.data.action === 'share-target' && event.data.files) {
    console.log(`Service Worker: Processing ${event.data.files.length} shared files via message`);
    
    // Store files in cache
    event.waitUntil(
      (async () => {
        try {
          const cache = await caches.open('shared-files');
          const files = event.data.files;
          
          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const cacheKey = `/shared/${Date.now()}_${i}_${file.name}`;
            await cache.put(cacheKey, new Response(file));
            console.log(`Service Worker: Cached file via message: ${cacheKey}`);
          }
          
          // Send response back to main page
          if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({
              success: true,
              filesProcessed: files.length,
              message: `Successfully cached ${files.length} files`
            });
            console.log('Service Worker: Share-target response sent successfully');
          } else {
            console.error('Service Worker: No ports available for share-target response');
          }
          
        } catch (error) {
          console.error('Service Worker: Error processing shared files via message:', error);
          if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({
              success: false,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      })()
    );
  }
  
  // Log any unhandled messages
  if (!event.data.action || (event.data.action !== 'ping' && event.data.action !== 'share-target')) {
    console.log('Service Worker: Received unhandled message:', event.data);
  }
});

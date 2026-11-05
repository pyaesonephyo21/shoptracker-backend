const CACHE_NAME = 'shoptracker-v2.0.0';
const STATIC_ASSETS = [
    '/offline.html',
    '/manifest.json',
    '/apple-touch-icon.png',
    '/icon-192.png',
    '/icon-512.png',
    '/favicon.ico'
];

// 1. Install: Precache static core offline assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        }).then(() => self.skipWaiting())
    );
});

// 2. Activate: Wipe out all old cache versions immediately
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((name) => {
                    if (name !== CACHE_NAME) {
                        console.log('[PWA SW] Clearing old cache version:', name);
                        return caches.delete(name);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 3. Skip Waiting Message Listener (for instant client updates)
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// 4. Fetch: Resilient strategy avoiding cache poisoning
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // Skip non-GET requests (mutations like POST, PUT, DELETE must hit network directly)
    if (request.method !== 'GET') {
        return;
    }

    // Skip cross-origin requests
    if (url.origin !== self.location.origin) {
        return;
    }

    // Skip Vite Dev Server / HMR internal routes
    if (
        url.pathname.includes('@vite') ||
        url.pathname.includes('@fs') ||
        url.pathname.includes('@react-refresh') ||
        url.pathname.includes('__vite_ping') ||
        url.pathname.includes('node_modules')
    ) {
        return;
    }

    // Strategy A: Static Hashed Assets & Media -> Cache-First
    if (
        url.pathname.startsWith('/build/') ||
        url.pathname.match(/\.(js|css|woff2|woff|ttf|png|jpg|jpeg|svg|webp|ico)$/)
    ) {
        event.respondWith(
            caches.open(CACHE_NAME).then(async (cache) => {
                const cachedResponse = await cache.match(request);
                if (cachedResponse) {
                    return cachedResponse;
                }

                try {
                    const networkResponse = await fetch(request);
                    if (networkResponse && networkResponse.status === 200) {
                        cache.put(request, networkResponse.clone());
                    }
                    return networkResponse;
                } catch (error) {
                    return cachedResponse || new Response('Asset unavailable offline', { status: 408 });
                }
            })
        );
        return;
    }

    // Strategy B: Navigation & Inertia Page Requests -> Pure Network-First with Instant Offline Fallback
    // NEVER cache dynamic HTML pages or Inertia JSON responses in the runtime cache.
    // Caching dynamic responses causes CSRF token mismatch (419 errors) and JSON/HTML navigation collisions.
    const isInertia = request.headers.get('X-Inertia') === 'true';
    if (request.mode === 'navigate' || isInertia) {
        event.respondWith(
            (async () => {
                try {
                    // Always fetch real-time state from the network
                    return await fetch(request);
                } catch (err) {
                    // Network unavailable or blocked -> serve offline fallback immediately
                    const cache = await caches.open(CACHE_NAME);

                    if (request.mode === 'navigate') {
                        const offlinePage = await cache.match('/offline.html');
                        if (offlinePage) {
                            return offlinePage;
                        }
                    }

                    if (isInertia) {
                        return new Response(JSON.stringify({
                            component: 'Offline',
                            props: {
                                errors: {},
                                auth: {},
                                flash: { error: 'You are currently offline. Please check your internet connection.' }
                            },
                            url: url.pathname,
                            version: ''
                        }), {
                            status: 200,
                            headers: { 'Content-Type': 'application/json', 'X-Inertia': 'true' }
                        });
                    }

                    return new Response('Network error occurred. Please check your connection.', {
                        status: 503,
                        statusText: 'Service Unavailable',
                        headers: new Headers({ 'Content-Type': 'text/plain' })
                    });
                }
            })()
        );
        return;
    }
});

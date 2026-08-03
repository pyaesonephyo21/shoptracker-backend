const CACHE_NAME = 'shoptracker-v1.0.2';
const STATIC_ASSETS = [
    '/offline.html',
    '/manifest.json',
    '/apple-touch-icon.png',
    '/icon-192.png',
    '/icon-512.png',
    '/favicon.ico'
];

// 1. Install: Precache static core assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        }).then(() => self.skipWaiting())
    );
});

// 2. Activate: Clean up old cache versions immediately
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((name) => {
                    if (name !== CACHE_NAME) {
                        console.log('[PWA SW] Clearing old cache:', name);
                        return caches.delete(name);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 3. Fetch: Smart strategy based on request type
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // Skip non-GET requests (mutations like POST, PUT, DELETE should never be cached)
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

    // Strategy A: Static Assets (/build/assets/*, fonts, icons, images) -> Cache-First with Background Revalidation
    if (
        url.pathname.startsWith('/build/') ||
        url.pathname.match(/\.(js|css|woff2|woff|ttf|png|jpg|jpeg|svg|webp|ico)$/)
    ) {
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(request).then((cachedResponse) => {
                    if (cachedResponse) {
                        // Return cached immediately, revalidate in background
                        fetch(request).then((networkResponse) => {
                            if (networkResponse && networkResponse.status === 200) {
                                cache.put(request, networkResponse.clone());
                            }
                        }).catch(() => {/* ignore background fetch errors */});
                        return cachedResponse;
                    }

                    // Not in cache, fetch from network and cache
                    return fetch(request).then((networkResponse) => {
                        if (networkResponse && networkResponse.status === 200) {
                            cache.put(request, networkResponse.clone());
                        }
                        return networkResponse;
                    });
                });
            })
        );
        return;
    }

    // Strategy B: Navigation & Inertia Page Requests -> 5-Second Network Race with Stale Cache Fallback
    const isInertia = request.headers.get('X-Inertia') === 'true';
    if (request.mode === 'navigate' || isInertia) {
        const NETWORK_TIMEOUT_MS = 5000; // 5-second network timeout for slow internet

        event.respondWith(
            (async () => {
                const cache = await caches.open(CACHE_NAME);

                // Check if we already have a cached copy
                let cachedResponse = await cache.match(request);
                if (!cachedResponse) {
                    cachedResponse = await cache.match(request.url, { ignoreVary: true, ignoreSearch: false });
                }

                // If offline / no connection at all, immediately return cache
                if (!navigator.onLine && cachedResponse) {
                    return cachedResponse;
                }

                // Network fetch with silent cache update
                const networkFetch = fetch(request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        cache.put(request, networkResponse.clone());
                    }
                    return networkResponse;
                });

                // If no cache exists yet, wait for network or show offline fallback
                if (!cachedResponse) {
                    try {
                        return await networkFetch;
                    } catch (err) {
                        if (request.mode === 'navigate') {
                            const offlinePage = await cache.match('/offline.html');
                            if (offlinePage) return offlinePage;
                        }
                        if (isInertia) {
                            return new Response(JSON.stringify({
                                component: 'Offline',
                                props: {
                                    errors: {},
                                    auth: {},
                                    flash: { error: 'You are currently offline. This page has not been cached yet.' }
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
                }

                // If cache exists, race network against 5s timeout
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('NETWORK_TIMEOUT')), NETWORK_TIMEOUT_MS);
                });

                try {
                    return await Promise.race([networkFetch, timeoutPromise]);
                } catch (error) {
                    // Stalled or offline -> return cached page immediately
                    console.log('[PWA SW] Network slow or offline (> 5s). Serving cache:', request.url);
                    networkFetch.catch(() => {});
                    return cachedResponse;
                }
            })()
        );
        return;
    }
});


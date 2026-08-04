import './bootstrap';
import '../css/app.css';

import { createRoot } from 'react-dom/client';
import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';

const appName = import.meta.env.VITE_APP_NAME || 'ShopTracker';

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) => resolvePageComponent(`./Pages/${name}.tsx`, import.meta.glob('./Pages/**/*.tsx')) as any,
    setup({ el, App, props }) {
        const root = createRoot(el);
        root.render(<App {...props} />);
    },
    progress: {
        color: '#3b82f6',
        showSpinner: false,
        delay: 50,
    },
});

// Register Progressive Web App Service Worker ONLY in Production
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('[PWA] Service Worker active, scope:', registration.scope);
                // Check for updates periodically
                registration.onupdatefound = () => {
                    const installingWorker = registration.installing;
                    if (installingWorker) {
                        installingWorker.onstatechange = () => {
                            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                console.log('[PWA] New update available; assets updated in background.');
                            }
                        };
                    }
                };
            })
            .catch((error) => {
                console.error('[PWA] Service Worker registration failed:', error);
            });
    });
} else if ('serviceWorker' in navigator) {
    // Unregister any active service worker during development so live Vite HMR isn't cached
    navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
            registration.unregister();
            console.log('[PWA] Unregistered service worker for dev mode.');
        }
    });
}



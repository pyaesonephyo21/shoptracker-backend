import { useEffect, useRef } from 'react';
import { router } from '@inertiajs/react';

/**
 * Re-fetches specified Inertia props when navigating back via browser/PWA history (popstate)
 * or mobile back-forward cache (bfcache pageshow).
 *
 * @param keys Optional list of prop keys to reload (partial reload via `only`)
 */
export function useRevalidateOnBack(keys?: string[]) {
    const keysRef = useRef(keys);
    keysRef.current = keys;

    useEffect(() => {
        const revalidate = () => {
            if (keysRef.current && keysRef.current.length > 0) {
                router.reload({ only: keysRef.current });
            } else {
                router.reload();
            }
        };

        const handlePageShow = (event: PageTransitionEvent) => {
            if (event.persisted) {
                revalidate();
            }
        };

        window.addEventListener('popstate', revalidate);
        window.addEventListener('pageshow', handlePageShow);

        return () => {
            window.removeEventListener('popstate', revalidate);
            window.removeEventListener('pageshow', handlePageShow);
        };
    }, []);
}

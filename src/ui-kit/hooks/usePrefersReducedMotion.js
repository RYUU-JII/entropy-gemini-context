import { useEffect, useState } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export function usePrefersReducedMotion() {
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
        return window.matchMedia(REDUCED_MOTION_QUERY).matches;
    });

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
        const mediaQueryList = window.matchMedia(REDUCED_MOTION_QUERY);
        const handleChange = (event) => setPrefersReducedMotion(!!event.matches);

        setPrefersReducedMotion(mediaQueryList.matches);
        if (typeof mediaQueryList.addEventListener === 'function') {
            mediaQueryList.addEventListener('change', handleChange);
            return () => mediaQueryList.removeEventListener('change', handleChange);
        }

        mediaQueryList.addListener(handleChange);
        return () => mediaQueryList.removeListener(handleChange);
    }, []);

    return prefersReducedMotion;
}


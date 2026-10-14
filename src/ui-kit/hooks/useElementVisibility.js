import { useEffect, useRef, useState } from 'react';

function toThresholdKey(threshold) {
    if (Array.isArray(threshold)) return threshold.join(',');
    return String(threshold ?? 0);
}

export function useElementVisibility(targetRef, options = {}) {
    const [isVisible, setIsVisible] = useState(true);
    const thresholdKey = toThresholdKey(options?.threshold);
    const active = options?.active ?? true;
    const lastActiveRef = useRef(active);

    if (active && !lastActiveRef.current) {
        lastActiveRef.current = true;
        setIsVisible(true);
    } else if (!active && lastActiveRef.current) {
        lastActiveRef.current = false;
    }

    useEffect(() => {
        if (!active) return undefined;
        if (typeof IntersectionObserver === 'undefined') {
            setIsVisible(true);
            return undefined;
        }

        const requestFrame = (
            typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
                ? window.requestAnimationFrame.bind(window)
                : (fn) => setTimeout(fn, 16)
        );
        const cancelFrame = (
            typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function'
                ? window.cancelAnimationFrame.bind(window)
                : (id) => clearTimeout(id)
        );

        let detached = false;
        let rafId = 0;
        let observer = null;

        const attachObserver = () => {
            if (detached) return;
            const target = targetRef?.current || null;
            if (!target) {
                rafId = requestFrame(attachObserver);
                return;
            }

            observer = new IntersectionObserver(
                (entries) => {
                    if (detached) return;
                    const entry = entries?.[0];
                    if (!entry) return;
                    setIsVisible(entry.isIntersecting || entry.intersectionRatio > 0);
                },
                {
                    root: options?.root || null,
                    rootMargin: options?.rootMargin || '0px',
                    threshold: options?.threshold ?? 0,
                },
            );
            observer.observe(target);
        };

        attachObserver();

        return () => {
            detached = true;
            if (rafId) cancelFrame(rafId);
            if (observer) observer.disconnect();
        };
    }, [active, targetRef, options?.root, options?.rootMargin, thresholdKey]);

    return isVisible;
}


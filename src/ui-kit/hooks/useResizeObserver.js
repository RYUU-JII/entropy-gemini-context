import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * useResizeObserver - Responsive dimension tracking hook
 *
 * Supports two usage patterns:
 * 1. Callback-ref pattern (recommended):
 *    const { targetRef, width, height } = useResizeObserver();
 *    <div ref={targetRef} />
 *
 * 2. Legacy ref-passing pattern (backwards-compatible):
 *    const myRef = useRef(null);
 *    const { width, height } = useResizeObserver(myRef);
 *    <div ref={myRef} />
 */
export function useResizeObserver(externalRef = null, { measureBeforePaint = false, enabled = true } = {}) {
    const [element, setElement] = useState(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const internalRef = useRef(null);

    const setTarget = useCallback((node) => {
        if (typeof externalRef === 'function') {
            externalRef(node);
        } else if (externalRef && typeof externalRef === 'object') {
            externalRef.current = node;
        }
        internalRef.current = node;
        setElement((current) => (current === node ? current : node));
    }, [externalRef]);

    const targetRef = useCallback((node) => {
        setTarget(node);
    }, [setTarget]);

    useLayoutEffect(() => {
        if (externalRef && typeof externalRef === 'object') {
            const current = externalRef.current;
            if (current !== internalRef.current) {
                internalRef.current = current;
                setElement((observed) => (observed === current ? observed : current));
            }
        }
    });

    const measure = useCallback(() => {
        if (!element) return;
        const width = element.offsetWidth || element.clientWidth || 0;
        const height = element.offsetHeight || element.clientHeight || 0;
        setDimensions((prev) => {
            if (prev.width === width && prev.height === height) return prev;
            return { width, height };
        });
    }, [element]);

    // Layout-sensitive surfaces use this single owner for initial/reveal reads.
    // The observer then supplies resize updates without another initial read.
    useLayoutEffect(() => {
        if (measureBeforePaint && enabled) measure();
    }, [enabled, measure, measureBeforePaint]);

    useEffect(() => {
        if (!enabled) return undefined;
        if (!element || typeof ResizeObserver === 'undefined') {
            setDimensions({ width: 0, height: 0 });
            return undefined;
        }

        if (!measureBeforePaint) measure();

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) return;
            const width = entry.contentRect?.width ?? element.offsetWidth ?? 0;
            const height = entry.contentRect?.height ?? element.offsetHeight ?? 0;
            setDimensions((prev) => {
                if (prev.width === width && prev.height === height) return prev;
                return { width, height };
            });
        });

        observer.observe(element);

        return () => {
            observer.disconnect();
        };
    }, [element, enabled, measure, measureBeforePaint]);

    return {
        width: dimensions.width,
        height: dimensions.height,
        targetRef,
        setTarget,
        element,
        measure,
    };
}

export default useResizeObserver;

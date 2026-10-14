import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * useZenStamp - A custom hook for "Hold-to-Stamp" deliberate interaction.
 * Provides progress tracking, hold timing, and execution callbacks.
 * 
 * @param {Function} onComplete - Callback when the stamp is fully held and committed.
 * @param {number} duration - Hold duration in milliseconds (default: 700ms).
 */
export function useZenStamp(onComplete, duration = 700) {
    const [progress, setProgress] = useState(0);
    const [isHolding, setIsHolding] = useState(false);
    const [isCommitted, setIsCommitted] = useState(false);
    const [showWiggle, setShowWiggle] = useState(false);

    const startTimeRef = useRef(null);
    const rafRef = useRef(null);
    const wiggleTimeoutRef = useRef(null);

    const start = useCallback((e) => {
        if (e && e.button !== 0 && e.type === 'mousedown') return; // Only left click

        if (wiggleTimeoutRef.current) {
            clearTimeout(wiggleTimeoutRef.current);
            wiggleTimeoutRef.current = null;
        }
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }

        setIsHolding(true);
        setIsCommitted(false);
        startTimeRef.current = Date.now();

        const update = () => {
            const now = Date.now();
            const elapsed = now - startTimeRef.current;
            const newProgress = Math.min(1, elapsed / duration);

            setProgress(newProgress);

            if (newProgress < 1) {
                rafRef.current = requestAnimationFrame(update);
            } else {
                rafRef.current = null;
                setIsCommitted(true);
                setIsHolding(false);
                setProgress(1);
                onComplete?.();
            }
        };

        rafRef.current = requestAnimationFrame(update);
    }, [duration, onComplete]);

    const end = useCallback(() => {
        if (!isCommitted && isHolding) {
            // If released early, check if it was just a quick click
            const elapsed = Date.now() - startTimeRef.current;
            if (elapsed < 200) {
                // Trigger wiggle effect for quick clicks to indicate "Hold required"
                setShowWiggle(true);
                if (wiggleTimeoutRef.current) {
                    clearTimeout(wiggleTimeoutRef.current);
                }
                wiggleTimeoutRef.current = setTimeout(() => {
                    wiggleTimeoutRef.current = null;
                    setShowWiggle(false);
                }, 500);
            }
        }

        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        setIsHolding(false);
        if (!isCommitted) {
            setProgress(0);
        }
    }, [isCommitted, isHolding]);

    // Clean up on unmount
    useEffect(() => {
        return () => {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
            if (wiggleTimeoutRef.current) {
                clearTimeout(wiggleTimeoutRef.current);
                wiggleTimeoutRef.current = null;
            }
        };
    }, []);

    const bind = {
        onMouseDown: start,
        onMouseUp: end,
        onMouseLeave: end,
        onTouchStart: start,
        onTouchEnd: end,
    };

    return {
        progress,
        isHolding,
        isCommitted,
        showWiggle,
        bind
    };
}

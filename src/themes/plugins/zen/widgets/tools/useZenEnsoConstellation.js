import { useEffect, useState } from 'react';
import { readPageLocalStorageItem, writePageLocalStorageItem } from '@/platform/browser/pageLocalStorage.js';
import { formatLocalDayKey } from '../../presentation/artifacts/engine/zenEnsoRecipe.js';

// Existing UI-only daily reveal checkpoint; shared by both presentation hosts.
const ENSO_CONSTELLATION_STORAGE_KEY = 'zen_enso_constellation_revealed_day';
const ENSO_CONSTELLATION_REVEAL_DELAY_MS = 42_000;
const ENSO_CONSTELLATION_VISIBLE_MS = 6_000;
let ensoConstellationRevealedDay = '';

function readEnsoConstellationRevealedDay() {
    if (ensoConstellationRevealedDay) return ensoConstellationRevealedDay;
    ensoConstellationRevealedDay = readPageLocalStorageItem(ENSO_CONSTELLATION_STORAGE_KEY, '');
    return ensoConstellationRevealedDay;
}

function markEnsoConstellationRevealed(dayKey) {
    ensoConstellationRevealedDay = dayKey;
    writePageLocalStorageItem(ENSO_CONSTELLATION_STORAGE_KEY, dayKey);
}

export function useZenEnsoConstellation(renderIsActive) {
    const [constellationDayKey, setConstellationDayKey] = useState(formatLocalDayKey);
    const [visibleDayKey, setVisibleDayKey] = useState('');
    // Ambient refresh and runtime re-entry already render this retained host.
    // Reconcile their current date before publishing a new scene descriptor;
    // the constellation owns no additional midnight clock.
    const currentDayKey = formatLocalDayKey();
    if (currentDayKey !== constellationDayKey) setConstellationDayKey(currentDayKey);
    const isConstellationVisible = renderIsActive && visibleDayKey === constellationDayKey;
    useEffect(() => {
        if (!renderIsActive) setVisibleDayKey('');
        if (!renderIsActive || typeof window === 'undefined' || typeof document === 'undefined') {
            return undefined;
        }

        let revealTimerId = 0;

        const clearRevealTimer = () => {
            if (!revealTimerId) return;
            window.clearTimeout(revealTimerId);
            revealTimerId = 0;
        };
        const reveal = () => {
            revealTimerId = 0;
            // An existing 42s exposure may cross midnight between ambient
            // refreshes. Its checkpoint and visible constellation share the
            // actual reveal date, rather than the timer's captured date.
            const revealDayKey = formatLocalDayKey();
            setConstellationDayKey(revealDayKey);
            if (readEnsoConstellationRevealedDay() === revealDayKey) return;
            markEnsoConstellationRevealed(revealDayKey);
            setVisibleDayKey(revealDayKey);
        };
        const scheduleReveal = () => {
            clearRevealTimer();
            const nextDayKey = formatLocalDayKey();
            if (nextDayKey !== constellationDayKey) {
                setConstellationDayKey(nextDayKey);
                return;
            }
            if (readEnsoConstellationRevealedDay() === constellationDayKey) return;
            if (document.visibilityState === 'hidden') return;
            revealTimerId = window.setTimeout(reveal, ENSO_CONSTELLATION_REVEAL_DELAY_MS);
        };
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                clearRevealTimer();
                return;
            }
            scheduleReveal();
        };

        scheduleReveal();
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearRevealTimer();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [constellationDayKey, renderIsActive]);

    // Keep the six-second dismissal independent of date reconciliation. A
    // reveal crossing midnight must not lose its hide timer when that date
    // update cleans up the exposure effect.
    useEffect(() => {
        if (!isConstellationVisible) {
            if (visibleDayKey) setVisibleDayKey('');
            return undefined;
        }
        const timerId = window.setTimeout(() => setVisibleDayKey(''), ENSO_CONSTELLATION_VISIBLE_MS);
        return () => window.clearTimeout(timerId);
    }, [isConstellationVisible, visibleDayKey]);

    return { constellationDayKey, isConstellationVisible };
}

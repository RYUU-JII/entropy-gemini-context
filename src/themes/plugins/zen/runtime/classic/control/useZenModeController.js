import { useCallback, useEffect, useRef, useState } from 'react';

export function useZenModeController({
    isCollectionMode = false,
    setIsCollectionMode = null,
    setAbPair = null,
    guardMs = 1000,
    allowCollection = true,
} = {}) {
    const [abEntryGuardActive, setAbEntryGuardActive] = useState(false);
    const abEntryGuardTimerRef = useRef(null);

    const clearABEntryGuard = useCallback(() => {
        if (abEntryGuardTimerRef.current) {
            clearTimeout(abEntryGuardTimerRef.current);
            abEntryGuardTimerRef.current = null;
        }
        setAbEntryGuardActive(false);
    }, []);

    const startABEntryGuard = useCallback(() => {
        if (abEntryGuardTimerRef.current) {
            clearTimeout(abEntryGuardTimerRef.current);
        }
        setAbEntryGuardActive(true);
        abEntryGuardTimerRef.current = setTimeout(() => {
            setAbEntryGuardActive(false);
            abEntryGuardTimerRef.current = null;
        }, Math.max(200, Math.floor(Number(guardMs) || 1000)));
    }, [guardMs]);

    const handleExperimentModeChange = useCallback((nextCollectionMode) => {
        if (nextCollectionMode && !allowCollection) {
            throw new Error('ZEN_BONSAI_CLASSIC_LEARNING_UNSUPPORTED');
        }
        if (typeof setIsCollectionMode !== 'function') {
            return;
        }
        const normalizedNextMode = Boolean(nextCollectionMode);
        if (normalizedNextMode === isCollectionMode) {
            return;
        }
        setIsCollectionMode(normalizedNextMode);
        if (typeof setAbPair === 'function') {
            setAbPair(null);
        }
        if (normalizedNextMode) {
            startABEntryGuard();
            return;
        }
        clearABEntryGuard();
    }, [
        isCollectionMode,
        allowCollection,
        setIsCollectionMode,
        setAbPair,
        startABEntryGuard,
        clearABEntryGuard,
    ]);

    const resetExperimentMode = useCallback(() => {
        if (typeof setIsCollectionMode === 'function') {
            setIsCollectionMode(false);
        }
        if (typeof setAbPair === 'function') {
            setAbPair(null);
        }
        clearABEntryGuard();
    }, [
        setIsCollectionMode,
        setAbPair,
        clearABEntryGuard,
    ]);

    useEffect(() => {
        if (!allowCollection && isCollectionMode) resetExperimentMode();
    }, [allowCollection, isCollectionMode, resetExperimentMode]);

    useEffect(() => () => {
        if (abEntryGuardTimerRef.current) {
            clearTimeout(abEntryGuardTimerRef.current);
            abEntryGuardTimerRef.current = null;
        }
    }, []);

    return {
        abEntryGuardActive,
        startABEntryGuard,
        clearABEntryGuard,
        handleExperimentModeChange,
        resetExperimentMode,
    };
}

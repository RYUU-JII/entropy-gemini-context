import { useCallback, useEffect, useRef, useState } from 'react';
import {
    buildZenKoiRosterMemorySignature,
    EMPTY_ZEN_KOI_ROSTER_MEMORY,
    normalizeZenKoiRosterMemory,
    reconcileZenKoiRosterMemory,
} from '../../roster/zenKoiRosterMemory.js';
import {
    normalizeZenKoiRosterSnapshot,
} from '../../roster/zenKoiRosterContract.js';
import {
    clearRosterMemory,
    readRosterMemory,
    writeRosterMemory,
} from '../../storage/repositories/zenRosterRepository.js';

const DEFAULT_PRESENCE_REEVALUATION_INTERVAL_MS = 15 * 1000;

const EMPTY_MEMORY_SIGNATURE = buildZenKoiRosterMemorySignature(EMPTY_ZEN_KOI_ROSTER_MEMORY);
const normalizeResetToken = (value) => Math.max(0, Math.floor(Number(value) || 0));
const createRosterMemoryRuntimeError = (code, cause) => {
    const error = new Error(code, { cause });
    error.code = code;
    return error;
};

export const useZenKoiRosterMemory = ({
    enabled = false,
    resetToken = 0,
} = {}) => {
    const [memoryRevision, setMemoryRevision] = useState(0);
    const [presenceTick, setPresenceTick] = useState(0);
    const [runtimeError, setRuntimeError] = useState(null);
    const memoryByDomainRef = useRef(EMPTY_ZEN_KOI_ROSTER_MEMORY);
    const memorySignatureRef = useRef(EMPTY_MEMORY_SIGNATURE);
    const hydratedRef = useRef(false);
    const enqueuedSignatureRef = useRef(EMPTY_MEMORY_SIGNATURE);
    const persistenceQueueRef = useRef(Promise.resolve());
    const operationRevisionRef = useRef(0);
    const lastObservedRosterSignatureRef = useRef('');
    const lastResetTokenRef = useRef(normalizeResetToken(resetToken));

    useEffect(() => {
        if (!enabled) {
            operationRevisionRef.current += 1;
            const shouldPublishReset = (
                hydratedRef.current
                || memorySignatureRef.current !== EMPTY_MEMORY_SIGNATURE
            );
            memoryByDomainRef.current = EMPTY_ZEN_KOI_ROSTER_MEMORY;
            memorySignatureRef.current = EMPTY_MEMORY_SIGNATURE;
            hydratedRef.current = false;
            enqueuedSignatureRef.current = EMPTY_MEMORY_SIGNATURE;
            persistenceQueueRef.current = Promise.resolve();
            lastObservedRosterSignatureRef.current = '';
            lastResetTokenRef.current = normalizeResetToken(resetToken);
            setRuntimeError(null);
            if (shouldPublishReset) {
                setMemoryRevision((current) => current + 1);
            }
            return;
        }
        let cancelled = false;
        const hydrationRevision = operationRevisionRef.current + 1;
        operationRevisionRef.current = hydrationRevision;
        void readRosterMemory()
            .then((nextMemory) => {
                if (cancelled || operationRevisionRef.current !== hydrationRevision) return;
                const normalizedMemory = normalizeZenKoiRosterMemory(nextMemory);
                const nextSignature = buildZenKoiRosterMemorySignature(normalizedMemory);
                memoryByDomainRef.current = normalizedMemory;
                memorySignatureRef.current = nextSignature;
                hydratedRef.current = true;
                enqueuedSignatureRef.current = nextSignature;
                lastObservedRosterSignatureRef.current = '';
                setMemoryRevision((current) => current + 1);
            })
            .catch((error) => {
                if (cancelled || operationRevisionRef.current !== hydrationRevision) return;
                setRuntimeError(createRosterMemoryRuntimeError(
                    'ZEN_KOI_ROSTER_MEMORY_HYDRATION_FAILED',
                    error,
                ));
            });
        return () => {
            cancelled = true;
        };
    }, [enabled]);

    useEffect(() => {
        const nextResetToken = normalizeResetToken(resetToken);
        const didResetTokenChange = nextResetToken !== lastResetTokenRef.current;
        lastResetTokenRef.current = nextResetToken;
        if (!enabled || !didResetTokenChange || nextResetToken <= 0) return;
        const resetRevision = operationRevisionRef.current + 1;
        operationRevisionRef.current = resetRevision;
        memoryByDomainRef.current = EMPTY_ZEN_KOI_ROSTER_MEMORY;
        memorySignatureRef.current = EMPTY_MEMORY_SIGNATURE;
        hydratedRef.current = false;
        lastObservedRosterSignatureRef.current = '';
        setMemoryRevision((current) => current + 1);
        // An explicit reset supersedes queued roster snapshots, but it must still
        // wait for their writes to settle before issuing its own required clear.
        const clearTask = persistenceQueueRef.current.then(
            () => clearRosterMemory(),
            () => clearRosterMemory(),
        );
        persistenceQueueRef.current = clearTask;
        void clearTask
            .then(() => {
                if (operationRevisionRef.current !== resetRevision) return;
                hydratedRef.current = true;
                enqueuedSignatureRef.current = EMPTY_MEMORY_SIGNATURE;
                setMemoryRevision((current) => current + 1);
            })
            .catch((error) => {
                if (operationRevisionRef.current !== resetRevision) return;
                setRuntimeError(createRosterMemoryRuntimeError(
                    'ZEN_KOI_ROSTER_MEMORY_CLEAR_FAILED',
                    error,
                ));
            });
    }, [enabled, resetToken]);

    useEffect(() => {
        if (!enabled) return undefined;
        const timerId = setInterval(() => {
            setPresenceTick((current) => current + 1);
        }, DEFAULT_PRESENCE_REEVALUATION_INTERVAL_MS);
        return () => {
            clearInterval(timerId);
        };
    }, [enabled]);

    const getRosterMemorySnapshot = useCallback(() => memoryByDomainRef.current, []);

    const observeRosterSnapshotMemory = useCallback((rosterSnapshot) => {
        if (!enabled || !hydratedRef.current) return;
        const normalizedSnapshot = normalizeZenKoiRosterSnapshot(rosterSnapshot);
        const rosterSignature = normalizedSnapshot.signature;
        if (rosterSignature === lastObservedRosterSignatureRef.current) return;
        lastObservedRosterSignatureRef.current = rosterSignature;

        const nextMemory = reconcileZenKoiRosterMemory({
            memoryByDomain: memoryByDomainRef.current,
            rosterSnapshot: normalizedSnapshot,
            nowMs: Date.now(),
        });
        const nextSignature = buildZenKoiRosterMemorySignature(nextMemory);
        if (nextSignature === memorySignatureRef.current) return;

        memoryByDomainRef.current = nextMemory;
        memorySignatureRef.current = nextSignature;
        if (nextSignature === enqueuedSignatureRef.current) return;

        enqueuedSignatureRef.current = nextSignature;
        const writeRevision = operationRevisionRef.current;
        const writeTask = persistenceQueueRef.current.then(() => writeRosterMemory(nextMemory));
        persistenceQueueRef.current = writeTask;
        void writeTask.catch((error) => {
            if (operationRevisionRef.current !== writeRevision) return;
            setRuntimeError(createRosterMemoryRuntimeError(
                'ZEN_KOI_ROSTER_MEMORY_PERSIST_FAILED',
                error,
            ));
        });
    }, [enabled]);

    if (enabled && runtimeError) {
        throw runtimeError;
    }

    return {
        getRosterMemorySnapshot,
        memoryHydrated: hydratedRef.current,
        memoryReady: !enabled || hydratedRef.current,
        memoryRevision,
        memorySignature: memorySignatureRef.current,
        presenceTick,
        observeRosterSnapshotMemory,
    };
};

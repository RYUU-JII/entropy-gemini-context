import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useZenInteractionStore } from '../../state/stores/index.js';
import {
    emitZenMainBootTrace,
} from '../../../runtime/zenMainBootReadinessTrace.js';
import {
    buildZenKoiRosterFrame,
    normalizeZenKoiPresentationMode,
    shouldObserveZenKoiRosterMemory,
    ZEN_KOI_PRESENTATION_MODE,
} from '../../roster/zenKoiRosterFrame.js';
import { useZenKoiRosterMemory } from '../hooks/useZenKoiRosterMemory.js';
import {
    buildZenKoiBootVisualMemoryCandidates,
} from '../../roster/zenKoiRosterMemory.js';
import {
    ZEN_POND_ROSTER_AUTHORITY_SOURCES,
} from '../../roster/zenPondRosterAuthority.js';

export const ZEN_SCANNER_SOURCE_ERRORS = Object.freeze({
    REQUIRED: 'ZEN_POND_DOMAIN_CANDIDATES_REQUIRED',
    DOMAIN_CANDIDATES_ARRAY_REQUIRED: 'ZEN_POND_DOMAIN_CANDIDATES_ARRAY_REQUIRED',
    ROSTER_AUTHORITY_SOURCE_INVALID: 'ZEN_POND_ROSTER_AUTHORITY_SOURCE_INVALID',
});

const ROSTER_FRAME_SOURCES = Object.freeze({
    BOOT_VISUAL_ROSTER_MEMORY: 'boot_visual_roster_memory',
    EMPTY: 'empty',
    EXPERIMENT_SYNTHETIC_DOMAIN_CANDIDATES: 'experiment_synthetic_domain_candidates',
    FIRST_VISION_PRESENTATION: 'first_vision_presentation',
    STATS_DOMAIN_CANDIDATES: 'stats_domain_candidates',
});

const ROSTER_FRAME_SOURCE_BY_AUTHORITY_SOURCE = Object.freeze({
    [ZEN_POND_ROSTER_AUTHORITY_SOURCES.EXPERIMENT_SYNTHETIC]: ROSTER_FRAME_SOURCES.EXPERIMENT_SYNTHETIC_DOMAIN_CANDIDATES,
    [ZEN_POND_ROSTER_AUTHORITY_SOURCES.FIRST_VISION]: ROSTER_FRAME_SOURCES.FIRST_VISION_PRESENTATION,
    [ZEN_POND_ROSTER_AUTHORITY_SOURCES.STATS_SNAPSHOT]: ROSTER_FRAME_SOURCES.STATS_DOMAIN_CANDIDATES,
});

const normalizeDomain = (candidate) => {
    if (typeof candidate !== 'string') return null;
    const normalized = candidate.trim();
    return normalized || null;
};

const normalizeDomainCandidateArray = (candidate) => (
    Array.isArray(candidate) ? candidate : []
);

const assertDomainCandidateSourceContract = ({
    domainCandidates,
} = {}) => {
    if (domainCandidates === undefined) {
        throw new Error(ZEN_SCANNER_SOURCE_ERRORS.REQUIRED);
    }
    if (!Array.isArray(domainCandidates)) {
        throw new Error(ZEN_SCANNER_SOURCE_ERRORS.DOMAIN_CANDIDATES_ARRAY_REQUIRED);
    }
};

const normalizeRosterAuthoritySource = (source) => {
    if (source === undefined) return ZEN_POND_ROSTER_AUTHORITY_SOURCES.STATS_SNAPSHOT;
    if (Object.values(ZEN_POND_ROSTER_AUTHORITY_SOURCES).includes(source)) return source;
    throw new Error(ZEN_SCANNER_SOURCE_ERRORS.ROSTER_AUTHORITY_SOURCE_INVALID);
};

const resolveRosterFrameSource = ({
    bootVisualMemoryAllowed,
    hasBootVisualMemoryCandidates,
    hasCanonicalDomainCandidates,
    rosterAuthoritySource,
}) => {
    if (hasCanonicalDomainCandidates) {
        return ROSTER_FRAME_SOURCE_BY_AUTHORITY_SOURCE[rosterAuthoritySource]
            || ROSTER_FRAME_SOURCES.STATS_DOMAIN_CANDIDATES;
    }
    if (bootVisualMemoryAllowed && hasBootVisualMemoryCandidates) {
        return ROSTER_FRAME_SOURCES.BOOT_VISUAL_ROSTER_MEMORY;
    }
    return ROSTER_FRAME_SOURCES.EMPTY;
};

const useZenScannerBridgeController = ({
    bootTraceContext = null,
    domainCandidates = undefined,
    dataIsolationMode = false,
    hardResetToken = 0,
    lockedTarget = undefined,
    onLockTarget = null,
    presentationMode = ZEN_KOI_PRESENTATION_MODE.REALITY,
    rosterAuthoritySource = ZEN_POND_ROSTER_AUTHORITY_SOURCES.STATS_SNAPSHOT,
    invitationSlots = [],
    invitationInteractionEnabled = true,
    invitationAssignment = null,
} = {}) => {
    assertDomainCandidateSourceContract({
        domainCandidates,
    });
    const {
        storeLockedTarget,
        setLockedTarget,
    } = useZenInteractionStore(useShallow((state) => ({
        storeLockedTarget: state.lockedTarget,
        setLockedTarget: state.setLockedTarget,
    })));
    const resolvedPresentationMode = normalizeZenKoiPresentationMode(presentationMode);
    const isolated = dataIsolationMode === true;
    const resolvedRosterAuthoritySource = normalizeRosterAuthoritySource(rosterAuthoritySource);
    const shouldObserveRosterMemory = !isolated && shouldObserveZenKoiRosterMemory(resolvedPresentationMode);
    const shouldMutateInteractionStore = !isolated && resolvedPresentationMode === ZEN_KOI_PRESENTATION_MODE.REALITY;
    const {
        getRosterMemorySnapshot,
        memoryHydrated,
        memoryReady,
        memoryRevision,
        memorySignature,
        presenceTick,
        observeRosterSnapshotMemory,
    } = useZenKoiRosterMemory({
        enabled: shouldObserveRosterMemory,
        resetToken: hardResetToken,
    });
    const canonicalDomainCandidates = normalizeDomainCandidateArray(domainCandidates);
    const bootVisualMemoryAllowed = (
        resolvedRosterAuthoritySource === ZEN_POND_ROSTER_AUTHORITY_SOURCES.BOOT_VISUAL_MEMORY
    );
    const bootVisualMemoryCandidates = useMemo(() => (
        bootVisualMemoryAllowed
            ? buildZenKoiBootVisualMemoryCandidates({
                memoryByDomain: getRosterMemorySnapshot(),
            })
            : []
    ), [
        bootVisualMemoryAllowed,
        getRosterMemorySnapshot,
        memoryRevision,
    ]);
    const hasCanonicalDomainCandidates = canonicalDomainCandidates.length > 0;
    const hasBootVisualMemoryCandidates = bootVisualMemoryCandidates.length > 0;
    const resolvedDomainCandidates = hasCanonicalDomainCandidates
        ? canonicalDomainCandidates
        : (bootVisualMemoryAllowed ? bootVisualMemoryCandidates : []);
    const rosterSource = resolveRosterFrameSource({
        bootVisualMemoryAllowed,
        hasBootVisualMemoryCandidates,
        hasCanonicalDomainCandidates,
        rosterAuthoritySource: resolvedRosterAuthoritySource,
    });

    const koiRosterFrame = useMemo(() => (
        buildZenKoiRosterFrame({
            domainCandidates: resolvedDomainCandidates,
            focusDomain: normalizeDomain(lockedTarget),
            memoryByDomain: getRosterMemorySnapshot(),
            nowMs: Date.now(),
            presentationMode: resolvedPresentationMode,
            rosterSource,
            invitationSlots,
            invitationInteractionEnabled,
            invitationAssignment,
        })
    ), [
        resolvedDomainCandidates,
        lockedTarget,
        getRosterMemorySnapshot,
        memoryRevision,
        presenceTick,
        resolvedPresentationMode,
        rosterSource,
        invitationSlots,
        invitationInteractionEnabled,
        invitationAssignment,
    ]);
    const koiRosterFrameRef = useRef(koiRosterFrame);
    koiRosterFrameRef.current = koiRosterFrame;
    const koiRosterFrameSignature = koiRosterFrame.signature;

    const rosterSourceTraceRef = useRef('');
    useEffect(() => {
        const signature = [
            rosterSource,
            canonicalDomainCandidates.length,
            bootVisualMemoryCandidates.length,
            koiRosterFrame.items.length,
            koiRosterFrameSignature,
            memoryHydrated ? 'hydrated' : 'pending',
            memorySignature.length,
            resolvedPresentationMode,
            resolvedRosterAuthoritySource,
            bootVisualMemoryAllowed ? 'boot_memory_allowed' : 'boot_memory_blocked',
        ].join('|');
        if (rosterSourceTraceRef.current === signature) return;
        const previousSignature = rosterSourceTraceRef.current || null;
        rosterSourceTraceRef.current = signature;
        emitZenMainBootTrace('pond_bridge:koi_roster_source', bootTraceContext, {
            previousSignatureLength: previousSignature ? previousSignature.length : 0,
            signatureLength: signature.length,
            rosterSource,
            hasCanonicalDomainCandidates,
            hasBootVisualMemoryCandidates,
            bootVisualMemoryAllowed,
            rosterAuthoritySource: resolvedRosterAuthoritySource,
            canonicalDomainCandidateCount: canonicalDomainCandidates.length,
            bootVisualMemoryCandidateCount: bootVisualMemoryCandidates.length,
            resolvedDomainCandidateCount: resolvedDomainCandidates.length,
            rosterItemCount: koiRosterFrame.items.length,
            rosterSignatureLength: koiRosterFrameSignature.length,
            memoryHydrated,
            memorySignatureLength: memorySignature.length,
            presentationMode: resolvedPresentationMode,
        });
    }, [
        bootTraceContext,
        bootVisualMemoryCandidates.length,
        canonicalDomainCandidates.length,
        hasBootVisualMemoryCandidates,
        hasCanonicalDomainCandidates,
        koiRosterFrame.items.length,
        koiRosterFrameSignature,
        memoryHydrated,
        memorySignature.length,
        resolvedDomainCandidates.length,
        resolvedPresentationMode,
        rosterSource,
        resolvedRosterAuthoritySource,
        bootVisualMemoryAllowed,
    ]);

    useEffect(() => {
        if (!shouldObserveRosterMemory) return;
        if (rosterSource !== ROSTER_FRAME_SOURCES.STATS_DOMAIN_CANDIDATES) return;
        observeRosterSnapshotMemory(koiRosterFrameRef.current);
    }, [
        koiRosterFrameSignature,
        memoryRevision,
        observeRosterSnapshotMemory,
        rosterSource,
        shouldObserveRosterMemory,
    ]);

    useEffect(() => {
        if (!shouldMutateInteractionStore) return;
        if (lockedTarget === undefined) return;
        const normalized = normalizeDomain(lockedTarget);
        if (storeLockedTarget === normalized) return;
        setLockedTarget(normalized);
    }, [lockedTarget, setLockedTarget, shouldMutateInteractionStore, storeLockedTarget]);

    const resolvedLockedTarget = lockedTarget === undefined
        ? (shouldMutateInteractionStore ? storeLockedTarget : null)
        : normalizeDomain(lockedTarget);

    const handleLockTarget = useCallback((nextDomain) => {
        const normalized = normalizeDomain(nextDomain);
        if (
            shouldMutateInteractionStore
            && storeLockedTarget === normalized
            && resolvedLockedTarget === normalized
        ) {
            return normalized;
        }
        if (shouldMutateInteractionStore && storeLockedTarget !== normalized) {
            setLockedTarget(normalized);
        }
        if (typeof onLockTarget === 'function') {
            onLockTarget(normalized);
        }
        return normalized;
    }, [
        onLockTarget,
        resolvedLockedTarget,
        setLockedTarget,
        shouldMutateInteractionStore,
        storeLockedTarget,
    ]);

    return {
        koiRosterFrame,
        rosterMemoryReady: memoryReady,
        resolvedLockedTarget,
        handleLockTarget,
        rosterSource,
    };
};

export {
    useZenScannerBridgeController,
    ZEN_KOI_PRESENTATION_MODE,
};

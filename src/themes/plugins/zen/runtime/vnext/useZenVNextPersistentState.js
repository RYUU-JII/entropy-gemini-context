import { useEffect, useRef, useState } from 'react';
import {
    getDefaultFactorVectorV2,
} from '../../model/vnext/index.js';
import {
    bootstrapZenVNextWorkspaceState,
    createZenVNextWorkspaceStateError,
    DEFAULT_ZEN_VNEXT_ACTIVE_SECTION,
    DEFAULT_ZEN_VNEXT_AUTO_COMPARE_MAX_ROUNDS,
    DEFAULT_ZEN_VNEXT_AUTO_COMPARE_STOP_RELIABILITY,
    DEFAULT_ZEN_VNEXT_RELIABILITY_HINT,
    writeZenVNextActiveSection,
    writeZenVNextAutoCompareMaxRounds,
    writeZenVNextAutoCompareStopReliability,
    writeZenVNextFactors,
    writeZenVNextReliabilityHint,
    writeZenVNextSeed,
} from '@/themes/plugins/zen/state/ZenWorkspaceState.js';

const createZenVNextPersistentStateError = (
    code = 'ZEN_VNEXT_PERSISTENT_STATE_INVALID',
    message = 'Zen VNext persistent workspace state is invalid.',
    details = null,
    cause = null,
) => {
    const error = new Error(message);
    error.code = code;
    if (details && typeof details === 'object') {
        error.details = details;
    }
    if (cause) {
        error.cause = cause;
    }
    return error;
};

const resolveBootstrapActiveSection = (sectionTabs = []) => {
    if (!Array.isArray(sectionTabs) || sectionTabs.length === 0) {
        return DEFAULT_ZEN_VNEXT_ACTIVE_SECTION;
    }

    const previewTab = sectionTabs.find((entry) => entry?.key === DEFAULT_ZEN_VNEXT_ACTIVE_SECTION);
    if (previewTab?.key) {
        return previewTab.key;
    }

    const firstKey = sectionTabs[0]?.key;
    if (typeof firstKey === 'string' && firstKey.trim()) {
        return firstKey.trim();
    }

    throw createZenVNextPersistentStateError(
        'ZEN_VNEXT_PERSISTENT_STATE_SECTION_TABS_INVALID',
        'Zen VNext workspace section tabs must expose at least one non-empty key.',
        {
            sectionTabs,
        },
    );
};

const requireContractActiveSection = (value, sectionTabs = []) => {
    if (!Array.isArray(sectionTabs) || sectionTabs.length === 0) {
        return value;
    }
    if (sectionTabs.some((entry) => entry?.key === value)) {
        return value;
    }
    throw createZenVNextWorkspaceStateError(
        'ZEN_VNEXT_WORKSPACE_ACTIVE_SECTION_INVALID',
        `Zen VNext active section '${value}' is not declared by the current workspace section contract.`,
        {
            activeSection: value,
            allowedSections: sectionTabs
                .map((entry) => entry?.key)
                .filter((entry) => typeof entry === 'string' && entry.length > 0),
        },
    );
};

const surfacePersistentStateError = (label, error) => {
    if (error?.code) {
        return error;
    }
    return createZenVNextPersistentStateError(
        'ZEN_VNEXT_PERSISTENT_STATE_WRITE_FAILED',
        `Failed to persist Zen VNext workspace field '${label}'.`,
        {
            field: label,
        },
        error,
    );
};

export function useZenVNextPersistentState({ sectionTabs = [] } = {}) {
    const initialStateRef = useRef(null);
    if (initialStateRef.current === null) {
        const initialState = bootstrapZenVNextWorkspaceState({
            seed: Math.floor(Math.random() * 1000000),
            factors: getDefaultFactorVectorV2(),
            reliabilityHint: DEFAULT_ZEN_VNEXT_RELIABILITY_HINT,
            autoCompareMaxRounds: DEFAULT_ZEN_VNEXT_AUTO_COMPARE_MAX_ROUNDS,
            autoCompareStopReliability: DEFAULT_ZEN_VNEXT_AUTO_COMPARE_STOP_RELIABILITY,
            activeSection: resolveBootstrapActiveSection(sectionTabs),
        });
        initialStateRef.current = {
            ...initialState,
            activeSection: requireContractActiveSection(
                initialState.activeSection,
                sectionTabs,
            ),
        };
    }

    const initialState = initialStateRef.current;
    const [seed, setSeed] = useState(initialState.seed);
    const [factors, setFactors] = useState(initialState.factors);
    const [reliabilityHint, setReliabilityHint] = useState(initialState.reliabilityHint);
    const [autoCompareMaxRounds, setAutoCompareMaxRounds] = useState(initialState.autoCompareMaxRounds);
    const [autoCompareStopReliability, setAutoCompareStopReliability] = useState(
        initialState.autoCompareStopReliability,
    );
    const [activeSection, setActiveSection] = useState(initialState.activeSection);
    const [persistentStateError, setPersistentStateError] = useState(null);

    const canonicalActiveSection = requireContractActiveSection(
        activeSection,
        sectionTabs,
    );

    if (persistentStateError) {
        throw persistentStateError;
    }

    useEffect(() => {
        try {
            writeZenVNextSeed(seed);
        } catch (error) {
            setPersistentStateError((current) => (
                current || surfacePersistentStateError('vnext seed', error)
            ));
        }
    }, [seed]);

    useEffect(() => {
        try {
            writeZenVNextFactors(factors);
        } catch (error) {
            setPersistentStateError((current) => (
                current || surfacePersistentStateError('vnext factors', error)
            ));
        }
    }, [factors]);

    useEffect(() => {
        try {
            writeZenVNextReliabilityHint(reliabilityHint);
        } catch (error) {
            setPersistentStateError((current) => (
                current || surfacePersistentStateError('vnext reliability hint', error)
            ));
        }
    }, [reliabilityHint]);

    useEffect(() => {
        try {
            writeZenVNextAutoCompareMaxRounds(autoCompareMaxRounds);
        } catch (error) {
            setPersistentStateError((current) => (
                current || surfacePersistentStateError('vnext auto compare max rounds', error)
            ));
        }
    }, [autoCompareMaxRounds]);

    useEffect(() => {
        try {
            writeZenVNextAutoCompareStopReliability(autoCompareStopReliability);
        } catch (error) {
            setPersistentStateError((current) => (
                current
                || surfacePersistentStateError(
                    'vnext auto compare stop reliability',
                    error,
                )
            ));
        }
    }, [autoCompareStopReliability]);

    useEffect(() => {
        try {
            writeZenVNextActiveSection(canonicalActiveSection);
        } catch (error) {
            setPersistentStateError((current) => (
                current || surfacePersistentStateError('vnext active section', error)
            ));
        }
    }, [canonicalActiveSection]);

    return {
        seed,
        setSeed,
        factors,
        setFactors,
        reliabilityHint,
        setReliabilityHint,
        autoCompareMaxRounds,
        setAutoCompareMaxRounds,
        autoCompareStopReliability,
        setAutoCompareStopReliability,
        activeSection: canonicalActiveSection,
        setActiveSection,
    };
}

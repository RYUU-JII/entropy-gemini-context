import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Bug, ChevronRight } from 'lucide-react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { useShallow } from 'zustand/react/shallow';
import {
    DEFAULT_FURIN_TUNING,
    DEFAULT_SHISHI_ODOSHI_TUNING,
    selectZenSessionSlice,
    selectZenSettingsSlice,
    useZenSessionStore,
    useZenSettingsStore,
} from '@/themes/plugins/zen/api/lab.js';
import {
    DashboardTabErrorSurface,
    DashboardTabLoadingSurface,
} from '@/apps/dashboard/loading/DashboardTabStateSurfaces.jsx';
import { BUILD_INCLUDE_DEBUG_TOOLS } from '@/platform/build/releaseCapabilities.js';
import { useStatusController } from '@/apps/dashboard/hooks/useStatusController.js';
import { useDashboardTabReadiness } from '@/apps/dashboard/loading/useDashboardTabReadiness.js';
import { getThemeWidget } from '@/themes/core/registry/index.js';
import {
    DEFAULT_DEBUG_CONFIG,
    normalizeDebugConfig,
} from '@/domains/settings/config/debugConfig.js';
import {
    ZEN_POND_ROSTER_AUTHORITY_SOURCES,
} from '@/themes/plugins/zen/pond/roster/zenPondRosterAuthority.js';
import {
    ZEN_BONSAI_MODEL_IDS,
    ZEN_BONSAI_MODEL_SURFACES,
    listZenBonsaiModelsForSurface,
    requireZenBonsaiModelAdmission,
} from '@/themes/plugins/zen/model/ZenBonsaiModelCatalog.js';
import {
    ZEN_BONSAI_CULTIVATION_LEDGER_POLICIES,
} from '@/themes/plugins/zen/model/ZenBonsaiPresentationPolicy.js';
import { useCycle, useProtocolStore, useUIPreferences } from '../../stores/index.js';
import WorkerRuntimePanel from './WorkerRuntimePanel.jsx';
import BootDiagnosticsLab from './BootDiagnosticsLab.jsx';
import ZenBonsaiRenderDebugLab from './ZenBonsaiRenderDebugLab.jsx';
import ZenBonsaiVNextGrowthLab from './ZenBonsaiVNextGrowthLab.jsx';
import SentinelProtocolLab from './SentinelProtocolLab.jsx';
import CeremonyPreviewLab from './CeremonyPreviewLab.jsx';
import StatsPipelineDiagnosticsLab from './StatsPipelineDiagnosticsLab.jsx';
import StatsSitesBenchmarkLab from './StatsSitesBenchmarkLab.jsx';
import ZenPondExperimentLab from './ZenPondExperimentLab.jsx';
import ArtifactDisclosureExperimentPanel from './ArtifactDisclosureExperimentPanel.jsx';
import ExperimentArtifactPreview from './ExperimentArtifactPreview.jsx';
import ZenSakuraVisualRefinementLab from './ZenSakuraVisualRefinementLab.jsx';
import ZenSolarTokenRefinementLab from './ZenSolarTokenRefinementLab.jsx';
import {
    EXPERIMENT_LAB_SECTION_IDS,
    getExperimentLabReadinessProfile,
    getExperimentLabSectionCopyKeys,
    getExperimentLabSections,
    normalizeExperimentLabSectionId,
} from './experimentLabCatalog.js';
import {
    buildExperimentPondSyntheticDomainCandidates,
    summarizeExperimentPondSyntheticFixture,
} from './pondSyntheticDomainCandidates.js';
import {
    buildExperimentPondKoiSnapshot,
    copyTextToClipboard,
    serializeExperimentPondKoiSnapshot,
} from './pondKoiSnapshotClipboard.js';
import { requireProtocolSyncSuccess } from '../../stores/protocolStoreHelpers.js';

const ARTIFACT_WIDGET_IDS = [
    { id: 'Artifact_Monolith' },
    { id: 'Artifact_Gate' },
    { id: 'Artifact_Lethe' },
    { id: 'Artifact_SentinelFlare' },
];
const EXPERIMENT_SIGNAL_SCANNER_INPUT_MODES = Object.freeze({
    TARGETS: 'targets',
    DOMAIN_CANDIDATES: 'domain-candidates',
});
const EXPERIMENT_POND_DATA_MODES = Object.freeze({
    SYNTHETIC: 'synthetic',
    LIVE: 'live',
});
const DEFAULT_POND_SYNTHETIC_SEED = 20_260_620;
const DEFAULT_BONSAI_DEBUG_CONTROLS = Object.freeze({
    // The lab owns an explicit ephemeral fixture, so it must render before
    // canonical evidence exists. This does not materialize or mutate Home's
    // persisted lineage.
    enabled: true,
    activation: 86,
    growthStage: 30,
});
const DEFAULT_BONSAI_GROWTH_LAB_CONTROLS = Object.freeze({
    dayCount: 14,
    exposureQuality: 72,
    stressWood: 8,
    recoveryWood: 24,
    volatility: 8,
    canopyReserve: 76,
    scenarioId: 'steady',
    randomSeed: 20_260_704,
});
const BONSAI_GROWTH_MODEL_OPTIONS = listZenBonsaiModelsForSurface(
    ZEN_BONSAI_MODEL_SURFACES.EXPERIMENT,
).map((definition) => Object.freeze({
    id: definition.id,
    label: definition.displayName,
}));
const BONSAI_GROWTH_LAB_MAX_DAYS = 56;
const BONSAI_GROWTH_LAB_MILESTONE_STEP = 12;
const BONSAI_GROWTH_LAB_MAX_SEGMENTS = 8;
const BONSAI_GROWTH_LAB_SCENARIOS = Object.freeze({
    steady: Object.freeze({
        id: 'steady',
        label: 'Steady',
        activation: 88,
        growthStage: 48,
        dayCount: 14,
        exposureQuality: 72,
        stressWood: 8,
        recoveryWood: 24,
        volatility: 8,
        canopyReserve: 76,
    }),
    strain: Object.freeze({
        id: 'strain',
        label: 'Strain',
        activation: 54,
        growthStage: 64,
        dayCount: 21,
        exposureQuality: 82,
        stressWood: 46,
        recoveryWood: 5,
        volatility: 34,
        canopyReserve: 43,
    }),
    recovery: Object.freeze({
        id: 'recovery',
        label: 'Recovery',
        activation: 82,
        growthStage: 88,
        dayCount: 28,
        exposureQuality: 88,
        stressWood: 28,
        recoveryWood: 44,
        volatility: 18,
        canopyReserve: 72,
    }),
    compact: Object.freeze({
        id: 'compact',
        label: 'Compact',
        activation: 74,
        growthStage: 28,
        dayCount: 7,
        exposureQuality: 48,
        stressWood: 18,
        recoveryWood: 12,
        volatility: 20,
        canopyReserve: 58,
    }),
});
const clampPercent = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(100, Math.round(numeric)));
};

const clampBonsaiGrowthLabDayCount = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return DEFAULT_BONSAI_GROWTH_LAB_CONTROLS.dayCount;
    return Math.max(1, Math.min(BONSAI_GROWTH_LAB_MAX_DAYS, Math.round(numeric)));
};

const normalizeBonsaiGrowthLabValue = (key, value) => {
    if (key === 'dayCount') {
        return clampBonsaiGrowthLabDayCount(value);
    }
    return clampPercent(value);
};

const getBonsaiGrowthLabScenarioPatch = (scenario) => ({
    dayCount: clampBonsaiGrowthLabDayCount(scenario.dayCount),
    exposureQuality: clampPercent(scenario.exposureQuality),
    stressWood: clampPercent(scenario.stressWood),
    recoveryWood: clampPercent(scenario.recoveryWood),
    volatility: clampPercent(scenario.volatility),
    canopyReserve: clampPercent(scenario.canopyReserve),
    scenarioId: scenario.id,
});

const advanceBonsaiGrowthLabSeed = (seed) => {
    const current = Math.max(1, Math.floor(Number(seed) || DEFAULT_BONSAI_GROWTH_LAB_CONTROLS.randomSeed));
    return (Math.imul(current, 1103515245) + 12345) >>> 0 || DEFAULT_BONSAI_GROWTH_LAB_CONTROLS.randomSeed;
};

const resolveBonsaiGrowthLabSeedRatio = (seed, salt) => {
    let state = (Math.floor(Number(seed) || DEFAULT_BONSAI_GROWTH_LAB_CONTROLS.randomSeed) + Math.imul(salt, 2654435761)) >>> 0;
    state = (Math.imul(state ^ (state >>> 16), 2246822507)) >>> 0;
    state = (Math.imul(state ^ (state >>> 13), 3266489909)) >>> 0;
    return ((state ^ (state >>> 16)) >>> 0) / 0xFFFFFFFF;
};

const buildBonsaiGrowthLabRandomControls = (seed) => {
    const healthLean = resolveBonsaiGrowthLabSeedRatio(seed, 1);
    const strainLean = 1 - healthLean;
    const exposureQuality = clampPercent(28 + (resolveBonsaiGrowthLabSeedRatio(seed, 2) * 68));
    const stressWood = clampPercent((strainLean * 52) + (resolveBonsaiGrowthLabSeedRatio(seed, 3) * 16));
    const recoveryWood = clampPercent((healthLean * 44) + (resolveBonsaiGrowthLabSeedRatio(seed, 4) * 18));
    const volatility = clampPercent((resolveBonsaiGrowthLabSeedRatio(seed, 5) * 42) + (strainLean * 8));
    const canopyReserve = clampPercent(46 + (healthLean * 34) - (stressWood * 0.18) + (recoveryWood * 0.12));
    const dayCount = clampBonsaiGrowthLabDayCount(3 + (resolveBonsaiGrowthLabSeedRatio(seed, 6) * 53));
    const growthStage = clampPercent(8 + (resolveBonsaiGrowthLabSeedRatio(seed, 7) * 92));
    const activation = clampPercent(42 + (healthLean * 54) - (stressWood * 0.08) + (recoveryWood * 0.04));
    return {
        debugPatch: {
            enabled: true,
            activation,
            growthStage,
        },
        growthPatch: {
            dayCount,
            exposureQuality,
            stressWood,
            recoveryWood,
            volatility,
            canopyReserve,
            scenarioId: 'random',
            randomSeed: seed,
        },
    };
};

const toBonsaiGrowthLabRatio = (value) => clampPercent(value) / 100;

const interpolateBonsaiGrowthLabRatio = (start, end, progress) => (
    start + ((end - start) * Math.max(0, Math.min(1, Number(progress) || 0)))
);

const getBonsaiGrowthLabDateKey = (daysAgo = 0) => (
    new Date(Date.now() - (Math.max(0, Math.floor(Number(daysAgo) || 0)) * 24 * 60 * 60 * 1000))
        .toISOString()
        .slice(0, 10)
);

const resolveBonsaiGrowthLabTier = (healthH) => {
    const health = Math.max(0, Math.min(1, Number(healthH) || 0));
    if (health >= 0.88) return 'thriving';
    if (health >= 0.62) return 'steady';
    if (health >= 0.42) return 'strained';
    return 'withered';
};

const getBonsaiDebugPhaseId = (growthStage) => {
    const stage = clampPercent(growthStage);
    if (stage <= 24) return 'seedling';
    if (stage < 70) return 'juvenile';
    return 'mature';
};

const advancePondSyntheticSeed = (seed) => {
    const current = Math.max(1, Math.floor(Number(seed) || DEFAULT_POND_SYNTHETIC_SEED));
    return (Math.imul(current, 1664525) + 1013904223) >>> 0 || DEFAULT_POND_SYNTHETIC_SEED;
};

const buildBonsaiDebugScoreSummary = (activationPercent) => {
    const activation = clampPercent(activationPercent);
    const pressure = 1 - (activation / 100);
    const userRuleDeduction = Number((pressure * 45).toFixed(2));
    const siteRuleDeduction = Number((pressure * 35).toFixed(2));
    const totalDeduction = Number((userRuleDeduction + siteRuleDeduction).toFixed(2));
    return {
        scoringMode: 'scored',
        score: activation,
        displayScore: activation,
        totalDeduction,
        totalCreditApplied: Number(((activation / 100) * 6).toFixed(2)),
        totalCreditAvailable: Number(((activation / 100) * 8).toFixed(2)),
        categories: {
            user_rule: {
                deduction: userRuleDeduction,
                credit: 0,
                points: -userRuleDeduction,
                entryCount: pressure > 0 ? 1 : 0,
            },
            site_rule: {
                deduction: siteRuleDeduction,
                credit: 0,
                points: -siteRuleDeduction,
                entryCount: pressure > 0 ? 1 : 0,
            },
            unmanaged_review: {
                deduction: 0,
                credit: 0,
                points: 0,
                entryCount: 0,
            },
        },
    };
};

const buildBonsaiDebugStructuralImprint = (growthLabControls = {}) => ({
    active: true,
    exposureQuality: toBonsaiGrowthLabRatio(growthLabControls.exposureQuality),
    stressWood: toBonsaiGrowthLabRatio(growthLabControls.stressWood),
    recoveryWood: toBonsaiGrowthLabRatio(growthLabControls.recoveryWood),
    volatility: toBonsaiGrowthLabRatio(growthLabControls.volatility),
    canopyReserve: toBonsaiGrowthLabRatio(growthLabControls.canopyReserve),
    lastUpdatedDateKey: getBonsaiGrowthLabDateKey(0),
});

const buildBonsaiDebugGrowthSegments = ({
    growthStage,
    activation,
    growthLabControls = {},
} = {}) => {
    const segmentCount = Math.min(
        BONSAI_GROWTH_LAB_MAX_SEGMENTS,
        Math.max(0, Math.floor(clampPercent(growthStage) / BONSAI_GROWTH_LAB_MILESTONE_STEP)),
    );
    if (segmentCount <= 0) return [];
    const dayCount = clampBonsaiGrowthLabDayCount(growthLabControls.dayCount);
    const exposure = toBonsaiGrowthLabRatio(growthLabControls.exposureQuality);
    const stress = toBonsaiGrowthLabRatio(growthLabControls.stressWood);
    const recovery = toBonsaiGrowthLabRatio(growthLabControls.recoveryWood);
    const volatility = toBonsaiGrowthLabRatio(growthLabControls.volatility);
    const canopy = toBonsaiGrowthLabRatio(growthLabControls.canopyReserve);
    const activationRatio = toBonsaiGrowthLabRatio(activation);
    return Array.from({ length: segmentCount }, (_, index) => {
        const milestone = index + 1;
        const progress = segmentCount <= 1 ? 1 : index / (segmentCount - 1);
        const daysAgo = Math.round((1 - progress) * Math.max(0, dayCount - 1));
        const segmentStress = Math.max(0, Math.min(1, interpolateBonsaiGrowthLabRatio(stress * 0.42, stress, progress)));
        const segmentRecovery = Math.max(0, Math.min(1, interpolateBonsaiGrowthLabRatio(recovery * 0.35, recovery, progress)));
        const healthH = Math.max(0, Math.min(1, (activationRatio * 0.74) + (segmentRecovery * 0.18) - (segmentStress * 0.22)));
        return {
            id: `lab_m${milestone}`,
            milestone,
            growthScore: Math.min(100, milestone * BONSAI_GROWTH_LAB_MILESTONE_STEP),
            dateKey: getBonsaiGrowthLabDateKey(daysAgo),
            exposureQuality: exposure,
            stressWood: segmentStress,
            recoveryWood: segmentRecovery,
            volatility: Math.max(0, Math.min(1, interpolateBonsaiGrowthLabRatio(volatility * 0.55, volatility, progress))),
            canopyReserve: Math.max(0, Math.min(1, interpolateBonsaiGrowthLabRatio(0.62, canopy, progress))),
            healthH,
            vitalityTier: resolveBonsaiGrowthLabTier(healthH),
        };
    });
};

const resolveBonsaiDebugLifecycleInput = (input, controls, growthLabControls = DEFAULT_BONSAI_GROWTH_LAB_CONTROLS) => {
    if (!controls?.enabled) {
        return input;
    }
    const activation = clampPercent(controls.activation);
    const growthStage = clampPercent(controls.growthStage);
    const dayCount = clampBonsaiGrowthLabDayCount(growthLabControls.dayCount);
    const exposureRatio = toBonsaiGrowthLabRatio(growthLabControls.exposureQuality);
    const registeredSiteGoalCount = Math.max(1, Number(input?.registeredSiteGoalCount) || 0);
    const registeredSiteRuleCount = Math.max(1, Number(input?.registeredSiteRuleCount) || 0);
    const registeredSiteDomains = Array.isArray(input?.registeredSiteDomains) && input.registeredSiteDomains.length
        ? input.registeredSiteDomains
        : ['debug.bonsai.local'];
    const activeProtectionDayCount = Math.max(1, Math.round(dayCount * Math.max(0.2, exposureRatio)));
    return {
        ...(input || {}),
        bonsaiPresentationMode: 'lab_preview',
        bonsaiCultivationLedgerPolicy: 'read_only',
        bonsaiGrowthScore: growthStage,
        progressionGrowthScore: growthStage,
        daysTracked: Math.max(dayCount, Number(input?.daysTracked) || 0),
        registeredSiteGoalCount,
        registeredSiteRuleCount,
        registeredSiteDomains,
        registeredSiteSignature: registeredSiteDomains.join(','),
        protectedVisitCount: Math.max(1, Math.round((growthStage / 100) * dayCount * 2.4)),
        activeProtectionDayCount,
        frictionSuccessCount: Math.max(0, Math.round((activation / 100) * dayCount * 0.42)),
        todayProtectedMs: Math.max(Number(input?.todayProtectedMs) || 0, growthStage * 60 * 1000),
        weeklyProtectedAverageMs: Math.max(Number(input?.weeklyProtectedAverageMs) || 0, growthStage * 90 * 1000),
        cycleScore: activation,
        dailyScore: activation,
        dailyDisplayScore: activation,
        signalCount: Math.round((1 - (activation / 100)) * 8),
        scoreSummary: buildBonsaiDebugScoreSummary(activation),
        bonsaiStructuralImprint: buildBonsaiDebugStructuralImprint(growthLabControls),
        bonsaiGrowthSegments: buildBonsaiDebugGrowthSegments({
            growthStage,
            activation,
            growthLabControls,
        }),
        scoreLedger: [],
        scoreInsights: [],
    };
};

function resolveExperimentThemePolicy(themeProfile = {}) {
    const rawEnableBonsaiVNext = themeProfile?.experiment?.enableBonsaiVNext;
    const rawEnableBonsaiRenderDebug = themeProfile?.experiment?.enableBonsaiRenderDebug;
    const rawSignalScannerInput = themeProfile?.experiment?.signalScannerInput;
    return {
        enableBonsaiVNext: Boolean(rawEnableBonsaiVNext),
        enableBonsaiRenderDebug: Boolean(rawEnableBonsaiRenderDebug),
        signalScannerInput: rawSignalScannerInput === EXPERIMENT_SIGNAL_SCANNER_INPUT_MODES.DOMAIN_CANDIDATES
            ? EXPERIMENT_SIGNAL_SCANNER_INPUT_MODES.DOMAIN_CANDIDATES
            : EXPERIMENT_SIGNAL_SCANNER_INPUT_MODES.TARGETS,
    };
}

export default function ExperimentWorkspace({
    tab,
    isActive,
    onTabChange,
    initialSectionId = EXPERIMENT_LAB_SECTION_IDS.HOME,
    onReturnHome = null,
    embedded = false,
}) {
    const { t } = useAppTranslation('tools');
    const { themeId, themeProfile } = useUIPreferences();
    const { cycleState } = useCycle();
    const {
        debugConfig: storedDebugConfig,
        setDebugConfig,
        solarLocationProfile,
        filterSettings,
        gateConfig,
        nudgeConfig,
        historyCleanupForBlocked,
        concealBlockedBookmarks,
    } = useProtocolStore(useShallow((state) => ({
        debugConfig: state.debugConfig,
        setDebugConfig: state.setDebugConfig,
        solarLocationProfile: state.solarLocationProfile,
        filterSettings: state.filterSettings,
        gateConfig: state.gateConfig,
        nudgeConfig: state.nudgeConfig,
        historyCleanupForBlocked: state.historyCleanupForBlocked,
        concealBlockedBookmarks: state.concealBlockedBookmarks,
    })));
    const theme = themeId;
    const ctrl = useStatusController(onTabChange);
    const experimentThemePolicy = useMemo(
        () => resolveExperimentThemePolicy(themeProfile),
        [themeProfile],
    );
    const includeVNextSection = experimentThemePolicy.enableBonsaiVNext;
    const includeRenderDebugSection = experimentThemePolicy.enableBonsaiRenderDebug;
    const signalScannerFeedProps = experimentThemePolicy.signalScannerInput === EXPERIMENT_SIGNAL_SCANNER_INPUT_MODES.DOMAIN_CANDIDATES
        ? {
            domainCandidates: ctrl.visibleDomainCandidates,
            rosterAuthoritySource: ZEN_POND_ROSTER_AUTHORITY_SOURCES.STATS_SNAPSHOT,
        }
        : { signalScannerTargets: ctrl.signalScannerTargets };

    const CoreStatus = useMemo(() => getThemeWidget(theme, 'CoreStatus'), [theme]);
    const SignalScanner = useMemo(() => getThemeWidget(theme, 'SignalScanner'), [theme]);
    const artifacts = useMemo(() => (
        ARTIFACT_WIDGET_IDS.map((artifact) => ({
            ...artifact,
            Component: getThemeWidget(theme, artifact.id),
        }))
    ), [theme]);
    const FurinTuner = useMemo(() => getThemeWidget(theme, 'Artifact_SentinelFlareTuner'), [theme]);
    const ShishiOdoshiTuner = useMemo(() => getThemeWidget(theme, 'Artifact_GateTuner'), [theme]);

    const SignalTuner = useMemo(() => getThemeWidget(theme, 'SignalTuner'), [theme]);
    const showSignalTuner = !!themeProfile?.main?.enableKoiTuner && !!SignalTuner;

    const {
        tuning: koiTuning,
        setTuning: setKoiTuning,
        resetTuning: resetKoiTuning,
        siteKoiColorStrategy,
        setSiteKoiColorStrategy,
        visualProfile,
        patchVisualProfile,
        resetVisualProfile,
    } = useZenSettingsStore(useShallow(selectZenSettingsSlice));
    const {
        requestHardReset,
        hardResetStatus,
        hardResetError,
    } = useZenSessionStore(useShallow(selectZenSessionSlice));
    const [furinTuning, setFurinTuning] = useState(() => ({ ...DEFAULT_FURIN_TUNING }));
    const [shishiTuning, setShishiTuning] = useState(() => ({ ...DEFAULT_SHISHI_ODOSHI_TUNING }));
    const [activeArtifactId, setActiveArtifactId] = useState('Artifact_SentinelFlare');
    const [artifactActive, setArtifactActive] = useState(true);
    const [artifactColor, setArtifactColor] = useState('#8FBC8F');
    const [activeSection, setActiveSection] = useState(initialSectionId);
    const [debugConfigStatus, setDebugConfigStatus] = useState('');
    const [bonsaiDebugControls, setBonsaiDebugControls] = useState(DEFAULT_BONSAI_DEBUG_CONTROLS);
    const [bonsaiGrowthLabControls, setBonsaiGrowthLabControls] = useState(DEFAULT_BONSAI_GROWTH_LAB_CONTROLS);
    const [bonsaiGrowthModel, setBonsaiGrowthModel] = useState(ZEN_BONSAI_MODEL_IDS.PLUME);
    const [pondDataMode, setPondDataMode] = useState(EXPERIMENT_POND_DATA_MODES.SYNTHETIC);
    const [pondSyntheticSeed, setPondSyntheticSeed] = useState(DEFAULT_POND_SYNTHETIC_SEED);
    const [pondSyntheticLockedTarget, setPondSyntheticLockedTarget] = useState(null);
    const [pondSnapshotCopyFeedback, setPondSnapshotCopyFeedback] = useState('');

    const handleKoiCacheHardReset = useCallback(() => {
        return requestHardReset();
    }, [requestHardReset]);
    const handleBonsaiDebugToggle = useCallback(() => {
        setBonsaiDebugControls((current) => ({
            ...current,
            enabled: !current.enabled,
        }));
    }, []);
    const handleBonsaiDebugReset = useCallback(() => {
        setBonsaiDebugControls(DEFAULT_BONSAI_DEBUG_CONTROLS);
        setBonsaiGrowthLabControls(DEFAULT_BONSAI_GROWTH_LAB_CONTROLS);
        setBonsaiGrowthModel(ZEN_BONSAI_MODEL_IDS.PLUME);
    }, []);
    const handleBonsaiGrowthModelSelect = useCallback((modelId) => {
        setBonsaiGrowthModel(requireZenBonsaiModelAdmission({
            surface: ZEN_BONSAI_MODEL_SURFACES.EXPERIMENT,
            modelId,
        }));
    }, []);
    const handleBonsaiDebugControlChange = useCallback((key, value) => {
        setBonsaiDebugControls((current) => ({
            ...current,
            [key]: clampPercent(value),
        }));
        setBonsaiGrowthLabControls((current) => ({
            ...current,
            scenarioId: 'custom',
        }));
    }, []);
    const handleBonsaiGrowthLabControlChange = useCallback((key, value) => {
        setBonsaiGrowthLabControls((current) => ({
            ...current,
            [key]: normalizeBonsaiGrowthLabValue(key, value),
            scenarioId: 'custom',
        }));
    }, []);
    const handleBonsaiGrowthLabScenarioSelect = useCallback((scenarioId) => {
        const scenario = BONSAI_GROWTH_LAB_SCENARIOS[scenarioId];
        if (!scenario) return;
        setBonsaiDebugControls((current) => ({
            ...current,
            enabled: true,
            activation: clampPercent(scenario.activation),
            growthStage: clampPercent(scenario.growthStage),
        }));
        setBonsaiGrowthLabControls((current) => ({
            ...current,
            ...getBonsaiGrowthLabScenarioPatch(scenario),
        }));
    }, []);
    const handleBonsaiGrowthLabRandomize = useCallback(() => {
        const nextSeed = advanceBonsaiGrowthLabSeed(bonsaiGrowthLabControls.randomSeed);
        const randomControls = buildBonsaiGrowthLabRandomControls(nextSeed);
        setBonsaiDebugControls((current) => ({
            ...current,
            ...randomControls.debugPatch,
        }));
        setBonsaiGrowthLabControls((current) => ({
            ...current,
            ...randomControls.growthPatch,
        }));
    }, [bonsaiGrowthLabControls.randomSeed]);
    const handlePondDataModeChange = useCallback((mode) => {
        const nextMode = Object.values(EXPERIMENT_POND_DATA_MODES).includes(mode)
            ? mode
            : EXPERIMENT_POND_DATA_MODES.SYNTHETIC;
        setPondDataMode(nextMode);
        setPondSyntheticLockedTarget(null);
        setPondSnapshotCopyFeedback('');
    }, []);
    const handlePondSyntheticRandomize = useCallback(() => {
        setPondSyntheticSeed((current) => advancePondSyntheticSeed(current));
        setPondSyntheticLockedTarget(null);
        setPondSnapshotCopyFeedback('');
    }, []);

    const labSections = useMemo(
        () => getExperimentLabSections({ includeVNextSection, includeRenderDebugSection })
            .filter((sectionId) => sectionId !== EXPERIMENT_LAB_SECTION_IDS.CLSE),
        [includeRenderDebugSection, includeVNextSection],
    );
    const resolvedActiveSection = useMemo(
        () => normalizeExperimentLabSectionId(activeSection, {
            includeVNextSection,
            includeRenderDebugSection,
            fallbackSectionId: EXPERIMENT_LAB_SECTION_IDS.HOME,
        }),
        [activeSection, includeRenderDebugSection, includeVNextSection],
    );
    const isExperimentHome = resolvedActiveSection === EXPERIMENT_LAB_SECTION_IDS.HOME;
    const resolvedDebugConfig = useMemo(
        () => normalizeDebugConfig(storedDebugConfig, { defaults: DEFAULT_DEBUG_CONFIG }),
        [storedDebugConfig],
    );
    const runtimeDebuggerProtectedEnabled = resolvedDebugConfig.enabled === true
        && resolvedDebugConfig.runtimeDebuggerEnabled === true;
    const readinessProfile = useMemo(
        () => getExperimentLabReadinessProfile(resolvedActiveSection),
        [resolvedActiveSection],
    );
    const readiness = useDashboardTabReadiness({
        tabId: 'experiment',
        themeId: theme,
        isActive,
        surfaceId: readinessProfile.surfaceId,
    });
    const activeArtifact = useMemo(() => (
        artifacts.find((artifact) => artifact.id === activeArtifactId) || artifacts[0] || null
    ), [artifacts, activeArtifactId]);
    useEffect(() => {
        if (resolvedActiveSection === activeSection) return;
        setActiveSection(resolvedActiveSection);
    }, [activeSection, resolvedActiveSection]);
    const activeSectionMeta = useMemo(
        () => {
            const sectionId = resolvedActiveSection;
            const sectionCopyKeys = getExperimentLabSectionCopyKeys(sectionId, { includeVNextSection });
            return {
                id: sectionId,
                label: t(sectionCopyKeys.label),
                title: t(sectionCopyKeys.title),
                description: t(sectionCopyKeys.description),
            };
        },
        [includeVNextSection, resolvedActiveSection, t],
    );
    const showFurinTuner = activeArtifactId === 'Artifact_SentinelFlare' && !!FurinTuner;
    const showShishiTuner = activeArtifactId === 'Artifact_Gate' && !!ShishiOdoshiTuner;
    const showArtifactTuner = showFurinTuner || showShishiTuner;
    const bonsaiWorkspaceMode = 'classic';
    const registeredSiteDomains = useMemo(() => Array.from(new Set([
        ...Object.keys(ctrl.goals?.siteLimits || {}).filter(
            (domain) => Number(ctrl.goals?.siteLimits?.[domain]) > 0
        ),
        ...(Array.isArray(ctrl.blockedList) ? ctrl.blockedList : []),
    ])).map((domain) => String(domain).trim().toLowerCase()).filter(Boolean).sort(), [
        ctrl.blockedList,
        ctrl.goals?.siteLimits,
    ]);
    const bonsaiLifecycleInput = useMemo(() => {
        if (ctrl.bonsaiEvidenceReady !== true) {
            return null;
        }
        return {
            bonsaiEvidenceReady: true,
            bonsaiCultivationLedgerPolicy: ZEN_BONSAI_CULTIVATION_LEDGER_POLICIES.READ_ONLY,
            daysTracked: ctrl.daysTracked,
            cycleScore: ctrl.cycleScore,
            dailyScore: ctrl.dailyScore,
            dailyDisplayScore: ctrl.dailyDisplayScore,
            dailyScoringMode: ctrl.dailyScoringMode,
            dailyLimitPercent: ctrl.dailyLimitPercent,
            signalCount: ctrl.signalCount,
            todayActiveMs: ctrl.todayActiveMs,
            todayProtectedMs: ctrl.todayProtectedMs,
            weeklyProtectedAverageMs: ctrl.weeklyProtectedAverageMs,
            activeProtectionDayCount: ctrl.activeProtectionDayCount,
            protectedVisitCount: ctrl.protectedVisitCount,
            frictionSuccessCount: ctrl.frictionSuccessCount,
            registeredSiteGoalCount: Object.keys(ctrl.goals?.siteLimits || {}).filter(
                (domain) => Number(ctrl.goals?.siteLimits?.[domain]) > 0
            ).length,
            registeredSiteRuleCount: registeredSiteDomains.length,
            registeredSiteDomains,
            registeredSiteSignature: registeredSiteDomains.join(','),
            scoreLedger: ctrl.scoreLedger,
            scoreSummary: ctrl.scoreSummary,
            scoreInsights: ctrl.scoreInsights,
        };
    }, [
        ctrl.bonsaiEvidenceReady,
        ctrl.cycleScore,
        ctrl.dailyLimitPercent,
        ctrl.dailyScore,
        ctrl.dailyDisplayScore,
        ctrl.dailyScoringMode,
        ctrl.daysTracked,
        ctrl.activeProtectionDayCount,
        ctrl.blockedList,
        ctrl.frictionSuccessCount,
        ctrl.goals?.siteLimits,
        ctrl.protectedVisitCount,
        registeredSiteDomains,
        ctrl.scoreInsights,
        ctrl.scoreLedger,
        ctrl.scoreSummary,
        ctrl.signalCount,
        ctrl.todayActiveMs,
        ctrl.todayProtectedMs,
        ctrl.weeklyProtectedAverageMs,
    ]);
    const resolvedBonsaiLifecycleInput = useMemo(
        () => resolveBonsaiDebugLifecycleInput(
            bonsaiLifecycleInput,
            bonsaiDebugControls,
            bonsaiGrowthLabControls,
        ),
        [bonsaiDebugControls, bonsaiGrowthLabControls, bonsaiLifecycleInput],
    );
    const bonsaiGrowthLabPanelControls = useMemo(() => ({
        enabled: bonsaiDebugControls.enabled,
        activation: bonsaiDebugControls.activation,
        growthStage: bonsaiDebugControls.growthStage,
        phaseId: getBonsaiDebugPhaseId(bonsaiDebugControls.growthStage),
        growthModel: bonsaiGrowthModel,
        growthModelOptions: BONSAI_GROWTH_MODEL_OPTIONS,
        ...bonsaiGrowthLabControls,
        scenarios: Object.values(BONSAI_GROWTH_LAB_SCENARIOS),
        maxDays: BONSAI_GROWTH_LAB_MAX_DAYS,
        onTogglePreview: handleBonsaiDebugToggle,
        onReset: handleBonsaiDebugReset,
        onGrowthModelSelect: handleBonsaiGrowthModelSelect,
        onScenarioSelect: handleBonsaiGrowthLabScenarioSelect,
        onRandomize: handleBonsaiGrowthLabRandomize,
        onPreviewControlChange: handleBonsaiDebugControlChange,
        onGrowthLabControlChange: handleBonsaiGrowthLabControlChange,
    }), [
        bonsaiDebugControls.activation,
        bonsaiDebugControls.enabled,
        bonsaiDebugControls.growthStage,
        bonsaiGrowthModel,
        bonsaiGrowthLabControls,
        handleBonsaiDebugReset,
        handleBonsaiDebugToggle,
        handleBonsaiDebugControlChange,
        handleBonsaiGrowthModelSelect,
        handleBonsaiGrowthLabControlChange,
        handleBonsaiGrowthLabRandomize,
        handleBonsaiGrowthLabScenarioSelect,
    ]);
    const pondSyntheticDomainCandidates = useMemo(
        () => buildExperimentPondSyntheticDomainCandidates({ seed: pondSyntheticSeed }),
        [pondSyntheticSeed],
    );
    const pondSyntheticSummary = useMemo(
        () => summarizeExperimentPondSyntheticFixture(pondSyntheticDomainCandidates),
        [pondSyntheticDomainCandidates],
    );
    const supportsSyntheticPondLab = theme === 'zen';
    const resolvedPondDataMode = supportsSyntheticPondLab
        ? pondDataMode
        : EXPERIMENT_POND_DATA_MODES.LIVE;
    const pondSyntheticActive = resolvedPondDataMode === EXPERIMENT_POND_DATA_MODES.SYNTHETIC;
    const pondSignalScannerFeedProps = pondSyntheticActive
        ? {
            domainCandidates: pondSyntheticDomainCandidates,
            rosterAuthoritySource: ZEN_POND_ROSTER_AUTHORITY_SOURCES.EXPERIMENT_SYNTHETIC,
        }
        : signalScannerFeedProps;
    const pondSnapshotDomainCandidates = pondSyntheticActive
        ? pondSyntheticDomainCandidates
        : ctrl.visibleDomainCandidates;
    const pondScannerStatus = pondSyntheticActive ? 'breach' : ctrl.scannerStatus;
    const pondDailyDisplayScore = pondSyntheticActive ? 64 : ctrl.dailyDisplayScore;
    const pondTopFactors = pondSyntheticActive ? [] : ctrl.cycleTopFactors;
    const pondLockedTarget = pondSyntheticActive ? pondSyntheticLockedTarget : ctrl.lockedTarget;
    const pondLockTargetHandler = pondSyntheticActive ? setPondSyntheticLockedTarget : ctrl.setLockedTarget;
    const pondIsolationProps = pondSyntheticActive
        ? {
            dataIsolationMode: true,
            showRerollControls: false,
        }
        : {};
    const handlePondSnapshotCopy = useCallback(async (experimentControls) => {
        const candidates = Array.isArray(pondSnapshotDomainCandidates)
            ? pondSnapshotDomainCandidates
            : [];
        const snapshot = buildExperimentPondKoiSnapshot({
            dataMode: resolvedPondDataMode,
            theme,
            domainCandidates: candidates,
            syntheticSeed: pondSyntheticSeed,
            syntheticActive: pondSyntheticActive,
            scannerStatus: pondScannerStatus,
            dailyDisplayScore: pondDailyDisplayScore,
            lockedTarget: pondLockedTarget,
            nowMs: Date.now(),
            experimentControls,
        });
        const copied = await copyTextToClipboard(serializeExperimentPondKoiSnapshot(snapshot));
        setPondSnapshotCopyFeedback(
            copied
                ? t('experiment.pond_lab.copy_snapshot_done', { count: snapshot.roster.itemCount })
                : t('experiment.pond_lab.copy_snapshot_failed'),
        );
    }, [
        pondDailyDisplayScore,
        pondLockedTarget,
        pondScannerStatus,
        pondSnapshotDomainCandidates,
        pondSyntheticActive,
        pondSyntheticSeed,
        resolvedPondDataMode,
        t,
        theme,
    ]);
    const handleRuntimeDebuggerToggle = useCallback((nextEnabled) => {
        if (typeof setDebugConfig !== 'function') return;
        setDebugConfig((current) => {
            const normalized = normalizeDebugConfig(current, { defaults: DEFAULT_DEBUG_CONFIG });
            return {
                ...normalized,
                enabled: nextEnabled ? true : normalized.enabled,
                runtimeDebuggerEnabled: !!nextEnabled,
            };
        }).then((result) => {
            requireProtocolSyncSuccess(result);
            setDebugConfigStatus(t(
                nextEnabled
                    ? 'experiment.runtime_debugger_option.saved_on'
                    : 'experiment.runtime_debugger_option.saved_off',
            ));
        }).catch(() => {
            setDebugConfigStatus(t('experiment.runtime_debugger_option.save_failed'));
        });
    }, [setDebugConfig, t]);
    const renderRuntimeDebuggerOption = () => {
        if (!BUILD_INCLUDE_DEBUG_TOOLS) return null;
        return (
            <div className="rounded-[8px] border border-on-surface/10 bg-surface/85 p-4 shadow-sm">
                <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-surface-sunken text-on-surface-muted">
                        <Bug className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-black uppercase tracking-[0.12em] text-on-surface-muted">
                            {t('experiment.runtime_debugger_option.eyebrow')}
                        </div>
                        <div className="mt-1 text-sm font-bold text-on-surface">
                            {runtimeDebuggerProtectedEnabled
                                ? t('experiment.runtime_debugger_option.status_on')
                                : t('experiment.runtime_debugger_option.status_off')}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-on-surface-muted">
                            {t('experiment.runtime_debugger_option.desc')}
                        </p>
                    </div>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={runtimeDebuggerProtectedEnabled}
                        aria-label={t('experiment.runtime_debugger_option.title')}
                        title={t('experiment.runtime_debugger_option.title')}
                        onClick={() => handleRuntimeDebuggerToggle(!runtimeDebuggerProtectedEnabled)}
                        className={`relative mt-0.5 inline-flex h-8 w-14 shrink-0 rounded-full border-2 transition-colors focus:outline-hidden focus:ring-2 focus:ring-accent/35 focus:ring-offset-2 focus:ring-offset-background ${runtimeDebuggerProtectedEnabled
                            ? 'border-accent/35 bg-accent/20'
                            : 'border-border bg-surface-elevated/35'
                            }`}
                    >
                        <span
                            className={`pointer-events-none mt-0.5 inline-block h-6 w-6 transform rounded-full shadow transition-transform ${runtimeDebuggerProtectedEnabled
                                ? 'translate-x-6 bg-accent'
                                : 'translate-x-1 bg-surface'
                                }`}
                        />
                    </button>
                </div>
                {debugConfigStatus ? (
                    <div className="mt-3 rounded-[8px] border border-border/25 bg-surface-sunken/40 px-3 py-2 text-[10px] font-semibold text-on-surface-muted">
                        {debugConfigStatus}
                    </div>
                ) : null}
            </div>
        );
    };
    const renderExperimentHome = () => (
        <div className="min-h-0 min-w-0 flex-1 overflow-auto px-1 pb-1">
            <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {renderRuntimeDebuggerOption()}
                {labSections.map((sectionId) => {
                    const sectionCopyKeys = getExperimentLabSectionCopyKeys(sectionId, { includeVNextSection });
                    return (
                        <button
                            key={sectionId}
                            type="button"
                            onClick={() => setActiveSection(sectionId)}
                            className="group flex min-h-[112px] min-w-0 flex-col justify-between rounded-[8px] border border-on-surface/10 bg-surface/85 p-4 text-left shadow-sm transition-colors hover:border-accent/30 hover:bg-surface-elevated/65 focus:outline-hidden focus:ring-2 focus:ring-accent/35"
                        >
                            <span className="min-w-0">
                                <span className="block text-[10px] font-black uppercase tracking-[0.12em] text-on-surface-muted">
                                    {t(sectionCopyKeys.label)}
                                </span>
                                <span className="mt-1 block text-sm font-bold text-on-surface">
                                    {t(sectionCopyKeys.title)}
                                </span>
                                <span className="mt-1 block text-xs leading-relaxed text-on-surface-muted">
                                    {t(sectionCopyKeys.description)}
                                </span>
                            </span>
                            <span className="mt-3 inline-flex items-center text-[10px] font-black uppercase tracking-[0.08em] text-accent">
                                {t('experiment.lab_actions.open')}
                                <ChevronRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );

    const renderLabHeader = () => (
        <div className="shrink-0 flex min-w-0 flex-wrap items-center gap-2 px-1">
            <button
                type="button"
                onClick={() => {
                    if (typeof onReturnHome === 'function') {
                        onReturnHome();
                        return;
                    }
                    setActiveSection(EXPERIMENT_LAB_SECTION_IDS.HOME);
                }}
                className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-on-surface/10 bg-surface-sunken/50 px-2.5 text-[10px] font-black uppercase tracking-[0.08em] text-on-surface-muted transition-colors hover:border-accent/30 hover:text-on-surface focus:outline-hidden focus:ring-2 focus:ring-accent/35"
            >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t('experiment.lab_actions.back')}</span>
            </button>
            <div className="min-w-0">
                <h3 className="truncate text-sm font-bold text-on-surface">{activeSectionMeta.title}</h3>
                <p className="truncate text-[11px] text-on-surface-muted">{activeSectionMeta.description}</p>
            </div>
        </div>
    );

    const renderHomeHeader = () => (
        <div className="shrink-0 flex min-w-0 flex-wrap items-center gap-2 px-1">
            <div className="min-w-0">
                <h3 className="text-sm font-bold text-on-surface">{activeSectionMeta.title}</h3>
                <p className="text-[11px] text-on-surface-muted">{activeSectionMeta.description}</p>
            </div>
        </div>
    );

    if (readiness.phase === 'loading') {
        return (
            <section
                id={embedded ? undefined : tab.id}
                className={`${isActive ? 'flex' : 'hidden'} h-full min-h-0 w-full flex-col gap-2`}
            >
                {!embedded ? (isExperimentHome ? renderHomeHeader() : renderLabHeader()) : null}
                <DashboardTabLoadingSurface
                    tabId={`experiment-${resolvedActiveSection}`}
                    policyTabId="experiment"
                    label={tab?.title || activeSectionMeta.title}
                    testId="experiment-tab-loading"
                />
            </section>
        );
    }

    if (readiness.phase === 'error') {
        return (
            <section
                id={embedded ? undefined : tab.id}
                className={`${isActive ? 'flex' : 'hidden'} h-full min-h-0 w-full flex-col gap-2`}
            >
                {!embedded ? (isExperimentHome ? renderHomeHeader() : renderLabHeader()) : null}
                <DashboardTabErrorSurface
                    tabId={`experiment-${resolvedActiveSection}`}
                    title={tab?.title || activeSectionMeta.title}
                    detail={readiness.error?.message}
                    testId="experiment-tab-error"
                />
            </section>
        );
    }

    return (
        <section
            id={embedded ? undefined : tab.id}
            className={`${isActive ? 'flex' : 'hidden'} h-full min-h-0 w-full flex-col gap-2`}
        >
            {!embedded ? (isExperimentHome ? renderHomeHeader() : renderLabHeader()) : null}

            {isExperimentHome && renderExperimentHome()}

            {resolvedActiveSection === EXPERIMENT_LAB_SECTION_IDS.BONSAI_CLASSIC && (
                <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
                    <CoreStatus
                        integrityScore={ctrl.cycleScore}
                        experimental={true}
                        labRuntimeActive={isActive}
                        workspaceMode={bonsaiWorkspaceMode}
                        bonsaiLifecycleInput={resolvedBonsaiLifecycleInput}
                        bonsaiGrowthLabControls={bonsaiGrowthLabPanelControls}
                        bonsaiGrowthModel={bonsaiGrowthModel}
                        solarLocationProfile={solarLocationProfile}
                    />
                </div>
            )}

            {resolvedActiveSection === EXPERIMENT_LAB_SECTION_IDS.SAKURA_REFINEMENT && (
                <div className="min-h-0 min-w-0 flex-1 overflow-auto">
                    <ZenSakuraVisualRefinementLab />
                </div>
            )}

            {resolvedActiveSection === EXPERIMENT_LAB_SECTION_IDS.BONSAI_VNEXT && (
                <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
                    <ZenBonsaiVNextGrowthLab
                        isActive={isActive && resolvedActiveSection === EXPERIMENT_LAB_SECTION_IDS.BONSAI_VNEXT}
                    />
                </div>
            )}

            {resolvedActiveSection === EXPERIMENT_LAB_SECTION_IDS.BONSAI_RENDER_DEBUG && (
                <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
                    <ZenBonsaiRenderDebugLab
                        isActive={isActive && resolvedActiveSection === EXPERIMENT_LAB_SECTION_IDS.BONSAI_RENDER_DEBUG}
                    />
                </div>
            )}

            {resolvedActiveSection === EXPERIMENT_LAB_SECTION_IDS.RUNTIME && (
                <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
                    <WorkerRuntimePanel isActive={isActive && resolvedActiveSection === EXPERIMENT_LAB_SECTION_IDS.RUNTIME} />
                </div>
            )}

            {resolvedActiveSection === EXPERIMENT_LAB_SECTION_IDS.BOOT && (
                <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
                    <BootDiagnosticsLab isActive={isActive && resolvedActiveSection === EXPERIMENT_LAB_SECTION_IDS.BOOT} />
                </div>
            )}

            {resolvedActiveSection === EXPERIMENT_LAB_SECTION_IDS.STATS_SITES && (
                <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
                    <div className="flex h-full min-h-0 flex-col gap-3">
                        <StatsPipelineDiagnosticsLab />
                        <div className="min-h-0 flex-1 overflow-hidden">
                            <StatsSitesBenchmarkLab />
                        </div>
                    </div>
                </div>
            )}

            {resolvedActiveSection === EXPERIMENT_LAB_SECTION_IDS.SENTINEL_PROTOCOL && (
                <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
                    <SentinelProtocolLab
                        isActive={isActive && resolvedActiveSection === EXPERIMENT_LAB_SECTION_IDS.SENTINEL_PROTOCOL}
                    />
                </div>
            )}

            {resolvedActiveSection === EXPERIMENT_LAB_SECTION_IDS.CEREMONY && (
                <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
                    <CeremonyPreviewLab />
                </div>
            )}

            {resolvedActiveSection === EXPERIMENT_LAB_SECTION_IDS.POND && (
                <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
                    <ZenPondExperimentLab
                        isActive={isActive && resolvedActiveSection === EXPERIMENT_LAB_SECTION_IDS.POND}
                        SignalScanner={SignalScanner}
                        SignalTuner={SignalTuner}
                        showSignalTuner={showSignalTuner}
                        supportsSyntheticPondLab={supportsSyntheticPondLab}
                        dataMode={resolvedPondDataMode}
                        dataModes={EXPERIMENT_POND_DATA_MODES}
                        syntheticActive={pondSyntheticActive}
                        syntheticSeed={pondSyntheticSeed}
                        syntheticSummary={pondSyntheticSummary}
                        snapshotCopyFeedback={pondSnapshotCopyFeedback}
                        onDataModeChange={handlePondDataModeChange}
                        onSyntheticRandomize={handlePondSyntheticRandomize}
                        onSnapshotCopy={handlePondSnapshotCopy}
                        scannerStatus={pondScannerStatus}
                        scannerFeedProps={pondSignalScannerFeedProps}
                        dailyDisplayScore={pondDailyDisplayScore}
                        topFactors={pondTopFactors}
                        lockedTarget={pondLockedTarget}
                        onLockTarget={pondLockTargetHandler}
                        isolationProps={pondIsolationProps}
                        koiTuning={koiTuning}
                        onTuningChange={setKoiTuning}
                        onResetTuning={resetKoiTuning}
                        onHardReset={handleKoiCacheHardReset}
                        hardResetStatus={hardResetStatus}
                        hardResetError={hardResetError}
                        siteKoiColorStrategy={siteKoiColorStrategy}
                        onSiteKoiColorStrategyChange={setSiteKoiColorStrategy}
                        visualProfile={visualProfile}
                        onVisualProfilePatch={patchVisualProfile}
                        onVisualProfileReset={resetVisualProfile}
                    />
                </div>
            )}

            {resolvedActiveSection === EXPERIMENT_LAB_SECTION_IDS.SOLAR_TOKEN_REFINEMENT && (
                <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
                    <ZenSolarTokenRefinementLab />
                </div>
            )}

            {resolvedActiveSection === EXPERIMENT_LAB_SECTION_IDS.ARTIFACT_DISCLOSURE && (
                <ArtifactDisclosureExperimentPanel
                    t={t}
                    filterSettings={filterSettings}
                    gateConfig={gateConfig}
                    nudgeConfig={nudgeConfig}
                    historyCleanupForBlocked={historyCleanupForBlocked}
                    concealBlockedBookmarks={concealBlockedBookmarks}
                />
            )}

            {resolvedActiveSection === EXPERIMENT_LAB_SECTION_IDS.ARTIFACT && (
                <div className={`min-h-0 min-w-0 flex-1 grid gap-4 ${showArtifactTuner ? 'grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,2fr)]' : 'grid-cols-1'}`}>
                    <div className="flex flex-col min-h-0 relative">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                            {artifacts.map((artifact) => (
                                <button
                                    key={artifact.id}
                                    onClick={() => setActiveArtifactId(artifact.id)}
                                    className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors ${activeArtifactId === artifact.id
                                        ? 'bg-accent text-on-accent'
                                        : 'bg-surface-sunken text-on-surface-muted hover:text-on-surface'
                                        }`}
                                >
                                    {t(`experiment.artifacts.${artifact.id}`)}
                                </button>
                            ))}

                            <button
                                onClick={() => setArtifactActive((prev) => !prev)}
                                className={`ml-auto rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors ${artifactActive
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                                    : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
                                    }`}
                            >
                                {artifactActive
                                    ? t('experiment.artifacts.active')
                                    : t('experiment.artifacts.idle')}
                            </button>
                        </div>

                        <div className="relative flex flex-1 min-h-0 items-center justify-center bg-surface-sunken/40 rounded-2xl">
                            <div className="absolute top-2 right-2 z-10 rounded-full bg-surface/85 p-1">
                                <input
                                    type="color"
                                    value={artifactColor}
                                    onChange={(event) => setArtifactColor(event.target.value)}
                                    className="h-6 w-6 cursor-pointer rounded bg-transparent"
                                    title={t('tools:experiment.artifacts.color_title')}
                                />
                            </div>
                            {activeArtifact?.Component ? (theme === 'zen' ? (
                                <activeArtifact.Component
                                    isActive={artifactActive}
                                    color={artifactColor}
                                    cycleState={cycleState}
                                    tuning={activeArtifactId === 'Artifact_SentinelFlare'
                                        ? furinTuning
                                        : showShishiTuner
                                            ? shishiTuning
                                            : undefined}
                                />
                            ) : (
                                <ExperimentArtifactPreview
                                    Component={activeArtifact.Component}
                                    themeId={theme}
                                    widgetType={activeArtifact.id}
                                    isActive={artifactActive}
                                    isRuntimeActive={isActive && resolvedActiveSection === EXPERIMENT_LAB_SECTION_IDS.ARTIFACT}
                                    color={artifactColor}
                                    cycleState={cycleState}
                                    tuning={activeArtifactId === 'Artifact_SentinelFlare'
                                        ? furinTuning
                                        : showShishiTuner
                                            ? shishiTuning
                                            : undefined}
                                />
                            )) : (
                                <div className="text-xs text-on-surface-muted">
                                    {t('experiment.artifacts.component_unavailable')}
                                </div>
                            )}
                        </div>
                    </div>

                    {showFurinTuner && (
                        <div className="min-h-0">
                            <FurinTuner
                                embedded={true}
                                className="h-full"
                                tuning={furinTuning}
                                onTuningChange={setFurinTuning}
                                onReset={() => setFurinTuning({ ...DEFAULT_FURIN_TUNING })}
                            />
                        </div>
                    )}

                    {showShishiTuner && (
                        <div className="min-h-0">
                            <ShishiOdoshiTuner
                                embedded={true}
                                className="h-full"
                                tuning={shishiTuning}
                                onTuningChange={setShishiTuning}
                                onReset={() => setShishiTuning({ ...DEFAULT_SHISHI_ODOSHI_TUNING })}
                            />
                        </div>
                    )}
                </div>
            )}

        </section>
    );
}

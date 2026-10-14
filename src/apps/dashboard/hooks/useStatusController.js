import { useState, useMemo, useCallback, useEffect } from 'react';
import { useCycleStatistics } from '@/apps/dashboard/hooks/useCycleStatistics.js';
import { useAnalysisStore, useProtocolStore } from '../stores/index.js';
import { useRuntimeParkedStoreSlice } from './useRuntimeParkedStoreSlice.js';
import { useDocumentVisibility } from '../../../ui-kit/hooks/useDocumentVisibility.js';
import {
  buildStatsDashboardPolicyFingerprint,
  buildStatsDashboardPolicyInput,
  projectStatusDomainCandidatesToSignalScannerTargets,
  SCORE_LEDGER_SCORING_MODE,
} from '@/domains/stats/analysis/index.js';
import { normalizeDomain } from '@/lib/domain.js';
import { moveSiteRuleRegistration, registerSiteRule } from '@/apps/dashboard/commands/registerSiteRule.js';

const EMPTY_SITE_DETAILS = Object.freeze({});
const EMPTY_LIST = Object.freeze([]);
const SCORE_LEDGER_SCORING_MODES = new Set(Object.values(SCORE_LEDGER_SCORING_MODE));
export const BONSAI_EVIDENCE_AUTHORITY_STATES = Object.freeze({
    AUTHORITATIVE: 'authoritative',
    POLICY_STALE: 'policy_stale',
    UNAVAILABLE: 'unavailable',
});

const hasOwn = (source, key) => (
    source !== null
    && source !== undefined
    && Object.prototype.hasOwnProperty.call(source, key)
);

const resolveScannerStatus = (signalScannerTargets) => {
    const visibleCount = Array.isArray(signalScannerTargets) ? signalScannerTargets.length : 0;
    if (visibleCount > 2) return 'breach';
    if (visibleCount > 0) return 'warning';
    return 'safe';
};

const selectStatusRuntimeProtocolSlice = (state) => ({
    blockedUrls: state.blockedUrls,
    allowedUrls: state.allowedUrls,
    filteringMode: state.filteringMode,
    globalGoal: state.globalGoal,
    siteGoals: state.siteGoals,
    siteRuleTimeline: state.siteRuleTimeline,
    rulesMode: state.rulesMode,
    dataCollectionMode: state.dataCollectionMode,
    trackingExcludedUrls: state.trackingExcludedUrls,
    removeSiteRule: state.removeSiteRule,
    upsertSiteRule: state.upsertSiteRule,
    moveSiteRule: state.moveSiteRule,
});

const selectStatusRuntimeAnalysisSlice = (state) => ({
    statusSnapshot: state.statusSnapshot,
    refreshStatusSnapshot: state.refreshStatusSnapshot,
});

// Dashboard-owned status controller shared by the main and experiment tabs.
export function useStatusController(onTabChange, { isRuntimeActive = true } = {}) {
    const documentVisible = useDocumentVisibility();
    const runtimeVisible = isRuntimeActive && documentVisible;
    const {
        cycleState,
        cycleSnapshot,
        cycleScore,
        cycleTopFactors,
        daysTracked,
    } = useCycleStatistics({ isRuntimeActive: runtimeVisible });

    const {
        blockedUrls,
        allowedUrls,
        filteringMode,
        globalGoal,
        siteGoals,
        siteRuleTimeline,
        rulesMode,
        dataCollectionMode,
        trackingExcludedUrls,
        removeSiteRule,
        upsertSiteRule,
        moveSiteRule,
    } = useRuntimeParkedStoreSlice(
        useProtocolStore,
        selectStatusRuntimeProtocolSlice,
        runtimeVisible,
    );
    const {
        statusSnapshot,
        refreshStatusSnapshot,
    } = useRuntimeParkedStoreSlice(
        useAnalysisStore,
        selectStatusRuntimeAnalysisSlice,
        runtimeVisible,
    );

    const [rhythmLensDomain, setRhythmLensDomainState] = useState(null);
    const [analyzingDomain, setAnalyzingDomain] = useState(null);

    const handleRegisterProtectedSite = useCallback((domain, { goalMinutes = null, firstUseRecording } = {}) => (
        registerSiteRule({ domain, type: 'blocked', goalMinutes, upsertSiteRule,
            ...(firstUseRecording === undefined ? {} : { firstUseRecording }) })
    ), [upsertSiteRule]);

    // The invoking surface presents the exact admitted move alongside its goal.
    // Only its explicit confirmation enters the atomic site-rule move owner.
    const handleConfirmProtectedSiteMove = useCallback(async (admission, { goalMinutes = null, firstUseRecording } = {}) => {
        if (typeof admission?.normalizedDomain !== 'string'
            || admission.normalizedDomain.length === 0
            || normalizeDomain(admission.normalizedDomain) !== admission.normalizedDomain
            || admission.status !== 'move_exact_opposite'
            || admission.existingType !== 'allowed' || admission.type !== 'blocked') {
            throw new Error('SITE_RULE_REGISTRATION_MOVE_ADMISSION_INVALID');
        }
        return moveSiteRuleRegistration({
            domain: admission.normalizedDomain,
            fromType: admission.existingType,
            toType: admission.type,
            goalMinutes,
            ...(firstUseRecording === undefined ? {} : { firstUseRecording }),
            moveSiteRule,
        });
    }, [moveSiteRule]);

    const dashboardPolicyInput = useMemo(() => buildStatsDashboardPolicyInput({
        blockedUrls,
        allowedUrls,
        filteringMode,
        globalGoal,
        siteGoals,
        siteRuleTimeline,
        rulesMode,
        dataCollectionMode,
        trackingExcludedUrls,
    }), [
        allowedUrls,
        blockedUrls,
        dataCollectionMode,
        filteringMode,
        globalGoal,
        rulesMode,
        siteGoals,
        siteRuleTimeline,
        trackingExcludedUrls,
    ]);
    const dashboardPolicyFingerprint = useMemo(
        () => buildStatsDashboardPolicyFingerprint(dashboardPolicyInput),
        [dashboardPolicyInput],
    );

    useEffect(() => {
        if (!runtimeVisible) return;
        if (statusSnapshot?.policyFingerprint === dashboardPolicyFingerprint) return;
        void refreshStatusSnapshot({ policyInput: dashboardPolicyInput });
    }, [
        dashboardPolicyFingerprint,
        dashboardPolicyInput,
        runtimeVisible,
        refreshStatusSnapshot,
        statusSnapshot?.policyFingerprint,
    ]);

    const handleNeutralize = useCallback((domain) => {
        const normalizedDomain = normalizeDomain(domain);
        return upsertSiteRule({
            domain: normalizedDomain,
            type: 'blocked',
        });
    }, [upsertSiteRule]);

    const handleToggleBlock = useCallback((domain) => {
        const normalizedDomain = normalizeDomain(domain);
        if (blockedUrls.includes(normalizedDomain)) {
            return removeSiteRule({
                domain: normalizedDomain,
                type: 'blocked',
            });
        }
        return upsertSiteRule({
            domain: normalizedDomain,
            type: 'blocked',
        });
    }, [blockedUrls, removeSiteRule, upsertSiteRule]);

    const handleManageSites = useCallback((domain) => {
        setAnalyzingDomain(null);
        onTabChange?.('sites', { domain });
    }, [onTabChange]);

    const handleSetRhythmLensDomain = useCallback((domain) => {
        const normalized = normalizeDomain(domain);
        setRhythmLensDomainState(normalized || null);
    }, []);

    const handleClearRhythmLensDomain = useCallback(() => {
        setRhythmLensDomainState(null);
    }, []);

    const handleOpenAnalysis = useCallback(() => {
        if (rhythmLensDomain) setAnalyzingDomain(rhythmLensDomain);
    }, [rhythmLensDomain]);

    const siteDetails = useMemo(() => {
        const next = statusSnapshot?.window?.siteDetails;
        return next && typeof next === 'object' ? next : EMPTY_SITE_DETAILS;
    }, [statusSnapshot?.window?.siteDetails]);
    const currentActivityDaySiteDetails = useMemo(() => {
        const next = statusSnapshot?.currentActivityDay?.siteDetails;
        return next && typeof next === 'object' ? next : EMPTY_SITE_DETAILS;
    }, [statusSnapshot?.currentActivityDay?.siteDetails]);
    const calendarTodaySiteDetails = useMemo(() => {
        const next = statusSnapshot?.calendarToday?.siteDetails;
        return next && typeof next === 'object' ? next : EMPTY_SITE_DETAILS;
    }, [statusSnapshot?.calendarToday?.siteDetails]);
    const rhythmSiteDetails = useMemo(() => {
        const next = statusSnapshot?.currentActivityDay?.siteDetails;
        return next && typeof next === 'object' ? next : EMPTY_SITE_DETAILS;
    }, [statusSnapshot?.currentActivityDay?.siteDetails]);
    const blockedList = useMemo(() => dashboardPolicyInput.blockedUrls || [], [dashboardPolicyInput]);
    const allowedList = useMemo(() => dashboardPolicyInput.allowedUrls || [], [dashboardPolicyInput]);
    const goals = useMemo(() => ({
        globalGoal: dashboardPolicyInput.globalGoal,
        siteLimits: dashboardPolicyInput.siteGoals || {},
    }), [dashboardPolicyInput]);
    const domainCandidates = useMemo(
        () => (Array.isArray(statusSnapshot?.domainCandidates) ? statusSnapshot.domainCandidates : EMPTY_LIST),
        [statusSnapshot?.domainCandidates],
    );
    const rollingPressure = statusSnapshot?.rollingPressure || null;
    const visibleDomainCandidates = useMemo(
        () => (Array.isArray(statusSnapshot?.visibleDomainCandidates)
            ? statusSnapshot.visibleDomainCandidates
            : EMPTY_LIST),
        [statusSnapshot?.visibleDomainCandidates],
    );
    const pressureRailReadiness = statusSnapshot?.pressureRailReadiness || null;
    const habitFeedback = statusSnapshot?.habitFeedback || null;
    const signalScannerTargets = useMemo(
        () => projectStatusDomainCandidatesToSignalScannerTargets(visibleDomainCandidates, {
            focusDomain: rhythmLensDomain,
        }),
        [rhythmLensDomain, visibleDomainCandidates],
    );
    const scannerSignalCount = signalScannerTargets.length;
    const scannerStatus = useMemo(
        () => resolveScannerStatus(signalScannerTargets),
        [signalScannerTargets],
    );
    const statusMetrics = statusSnapshot?.metrics && typeof statusSnapshot.metrics === 'object'
        ? statusSnapshot.metrics
        : null;
    const scoreSummaryReady = (
        hasOwn(statusMetrics, 'scoreSummary')
        && statusMetrics.scoreSummary !== null
        && typeof statusMetrics.scoreSummary === 'object'
    );
    const statusSnapshotPolicyCurrent = (
        statusSnapshot?.policyFingerprint === dashboardPolicyFingerprint
    );
    const statusSnapshotReady = statusSnapshot !== null && statusSnapshot !== undefined;
    const statusSnapshotAvailable = statusSnapshot?.available === true;
    const bonsaiEvidenceDiagnostics = useMemo(() => {
        const requiredMetricKeys = [
            'todayProtectedMs',
            'weeklyProtectedAverageMs',
            'activeProtectionDayCount',
            'protectedVisitCount',
            'frictionSuccessCount',
            'trackedDateCount',
        ];
        const missingMetricKeys = statusMetrics
            ? requiredMetricKeys.filter((key) => !hasOwn(statusMetrics, key))
            : requiredMetricKeys;
        return {
            snapshotReady: statusSnapshotReady,
            available: statusSnapshotAvailable,
            policyCurrent: statusSnapshotPolicyCurrent,
            scoringMode: statusMetrics?.dailyScoringMode || null,
            scoringModeAllowed: SCORE_LEDGER_SCORING_MODES.has(statusMetrics?.dailyScoringMode),
            scoreSummaryReady,
            missingMetricKeys,
            policyFingerprintLength: typeof statusSnapshot?.policyFingerprint === 'string'
                ? statusSnapshot.policyFingerprint.length
                : 0,
            dashboardPolicyFingerprintLength: typeof dashboardPolicyFingerprint === 'string'
                ? dashboardPolicyFingerprint.length
                : 0,
            dashboardDataCollectionMode: dashboardPolicyInput.dataCollectionMode || null,
            dashboardRulesMode: dashboardPolicyInput.rulesMode || null,
            visibleDomainCandidateCount: visibleDomainCandidates.length,
            signalScannerTargetCount: signalScannerTargets.length,
        };
    }, [
        dashboardPolicyFingerprint,
        dashboardPolicyInput.dataCollectionMode,
        dashboardPolicyInput.rulesMode,
        scoreSummaryReady,
        signalScannerTargets.length,
        statusSnapshotAvailable,
        statusSnapshotReady,
        statusMetrics,
        statusSnapshot,
        statusSnapshotPolicyCurrent,
        visibleDomainCandidates.length,
    ]);
    const bonsaiEvidenceReady = (
        statusSnapshotAvailable
        && statusSnapshotPolicyCurrent
        && SCORE_LEDGER_SCORING_MODES.has(statusMetrics?.dailyScoringMode)
        && scoreSummaryReady
        && hasOwn(statusMetrics, 'todayProtectedMs')
        && hasOwn(statusMetrics, 'weeklyProtectedAverageMs')
        && hasOwn(statusMetrics, 'activeProtectionDayCount')
        && hasOwn(statusMetrics, 'protectedVisitCount')
        && hasOwn(statusMetrics, 'frictionSuccessCount')
        && hasOwn(statusMetrics, 'trackedDateCount')
    );
    const bonsaiEvidenceAuthority = useMemo(() => {
        if (bonsaiEvidenceReady) {
            return {
                state: BONSAI_EVIDENCE_AUTHORITY_STATES.AUTHORITATIVE,
                reason: 'trusted_evidence',
                trusted: true,
            };
        }
        if (
            statusSnapshotReady
            && statusSnapshotAvailable
            && statusSnapshotPolicyCurrent !== true
        ) {
            return {
                state: BONSAI_EVIDENCE_AUTHORITY_STATES.POLICY_STALE,
                reason: 'policy_stale',
                trusted: false,
            };
        }
        return {
            state: BONSAI_EVIDENCE_AUTHORITY_STATES.UNAVAILABLE,
            reason: statusSnapshotReady !== true
                ? 'snapshot_pending'
                : (statusSnapshotAvailable ? 'evidence_incomplete' : 'snapshot_unavailable'),
            trusted: false,
        };
    }, [
        bonsaiEvidenceReady,
        statusSnapshotAvailable,
        statusSnapshotReady,
        statusSnapshotPolicyCurrent,
    ]);

    return useMemo(() => ({
        statusSnapshotReady,
        statusSnapshotAvailable,
        statusSnapshotPolicyCurrent,
        bonsaiEvidenceDiagnostics,
        bonsaiEvidenceAuthority,
        bonsaiEvidenceReady,
        cycleSnapshot,
        cycleState,
        cycleScore,
        daysTracked,
        dailyScore: Number(statusSnapshot?.metrics?.dailyScore) || 0,
        dailyDisplayScore: statusSnapshot?.metrics?.dailyDisplayScore !== null
            && statusSnapshot?.metrics?.dailyDisplayScore !== undefined
            && Number.isFinite(Number(statusSnapshot.metrics.dailyDisplayScore))
            ? Number(statusSnapshot.metrics.dailyDisplayScore)
            : null,
        dailyScoringMode: statusSnapshot?.metrics?.dailyScoringMode || null,
        scoreCriteriaCoverage: statusSnapshot?.metrics?.scoreCriteriaCoverage || null,
        scoreSetup: statusSnapshot?.metrics?.scoreSetup || null,
        cycleTopFactors,
        blockedList,
        allowedList,
        goals,
        siteDetails,
        todaySiteDetails: currentActivityDaySiteDetails,
        currentActivityDaySiteDetails,
        calendarTodaySiteDetails,
        rhythmSiteDetails,
        currentCycleProjection: statusSnapshot?.window || null,
        calendarTodayProjection: statusSnapshot?.calendarToday || null,
        rhythmDayProjection: statusSnapshot?.currentActivityDay || null,
        domainInsights: statusSnapshot?.domainInsights || EMPTY_SITE_DETAILS,
        domainCandidates,
        visibleDomainCandidates,
        pressureRailReadiness,
        habitFeedback,
        rollingPressure,
        signalScannerTargets,
        scannerSignalCount,
        scannerStatus,

        signalCount: Number(statusSnapshot?.metrics?.signalCount) || 0,
        dailyLimitPercent: Number(statusSnapshot?.metrics?.dailyLimitPercent) || 0,
        todayActiveMs: Number(statusSnapshot?.metrics?.todayActiveMs) || 0,
        todayProtectedMs: Number(statusSnapshot?.metrics?.todayProtectedMs) || 0,
        weeklyProtectedAverageMs: Number(statusSnapshot?.metrics?.weeklyProtectedAverageMs) || 0,
        activeProtectionDayCount: Number(statusSnapshot?.metrics?.activeProtectionDayCount) || 0,
        protectedVisitCount: Number(statusSnapshot?.metrics?.protectedVisitCount) || 0,
        frictionSuccessCount: Number(statusSnapshot?.metrics?.frictionSuccessCount) || 0,
        todayFrictionSuccessCount: Number(statusSnapshot?.metrics?.todayFrictionSuccessCount) || 0,
        todayProtectedVisitCount: Number(statusSnapshot?.metrics?.todayProtectedVisitCount) || 0,
        dailyOutcome: statusSnapshot?.metrics?.dailyOutcome || null,
        totalBlockedDuration: Number(statusSnapshot?.metrics?.totalBlockedDuration) || 0,
        scoreLedger: Array.isArray(statusSnapshot?.metrics?.scoreLedger)
            ? statusSnapshot.metrics.scoreLedger
            : EMPTY_LIST,
        scoreSummary: statusSnapshot?.metrics?.scoreSummary || null,
        scoreInsights: Array.isArray(statusSnapshot?.metrics?.scoreInsights)
            ? statusSnapshot.metrics.scoreInsights
            : EMPTY_LIST,

        rhythmLensDomain,
        lockedTarget: rhythmLensDomain,
        analyzingDomain,

        setRhythmLensDomain: handleSetRhythmLensDomain,
        clearRhythmLensDomain: handleClearRhythmLensDomain,
        setLockedTarget: handleSetRhythmLensDomain,
        setAnalyzingDomain,
        handleNeutralize,
        handleToggleBlock,
        handleManageSites,
        handleRegisterProtectedSite,
        handleConfirmProtectedSiteMove,
        handleOpenAnalysis,
    }), [
        analyzingDomain,
        allowedList,
        blockedList,
        bonsaiEvidenceAuthority,
        bonsaiEvidenceDiagnostics,
        bonsaiEvidenceReady,
        calendarTodaySiteDetails,
        currentActivityDaySiteDetails,
        cycleScore,
        cycleSnapshot,
        cycleState,
        cycleTopFactors,
        daysTracked,
        domainCandidates,
        goals,
        habitFeedback,
        handleConfirmProtectedSiteMove,
        handleClearRhythmLensDomain,
        handleManageSites,
        handleRegisterProtectedSite,
        handleNeutralize,
        handleOpenAnalysis,
        handleSetRhythmLensDomain,
        handleToggleBlock,
        pressureRailReadiness,
        rhythmLensDomain,
        rhythmSiteDetails,
        rollingPressure,
        scannerSignalCount,
        scannerStatus,
        signalScannerTargets,
        siteDetails,
        statusSnapshot,
        statusSnapshotAvailable,
        statusSnapshotPolicyCurrent,
        statusSnapshotReady,
        visibleDomainCandidates,
    ]);
}

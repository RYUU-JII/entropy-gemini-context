import { useDeferredValue, useEffect, useMemo } from 'react';
import {
    useAnalysisStore,
    useProtocolStore,
} from '../stores/index.js';
import { useRuntimeParkedStoreSlice } from './useRuntimeParkedStoreSlice.js';
import { useAnalysisProjectionDemand } from './useAnalysisProjectionDemand.js';
import { formatMinutes } from '../utils/formatters.js';
import { isHostnameInList } from '../../../lib/index.js';
import { tDashboardRuntime as tRuntime } from '../../../domains/settings/i18n/dashboardRuntime.js';
import {
    buildStatsAnalysisGoals,
    buildStatsAnalysisPolicyFingerprint,
    buildStatsAnalysisPolicyInput,
} from '../../../domains/stats/analysis/index.js';

const EMPTY_LIST = Object.freeze([]);

const selectCycleRuntimeProtocolSlice = (state) => ({
    blockedUrls: state.blockedUrls,
    allowedUrls: state.allowedUrls,
    filteringMode: state.filteringMode,
    globalGoal: state.globalGoal,
    siteRuleTimeline: state.siteRuleTimeline,
});

const selectCycleRuntimeAnalysisSlice = (state) => ({
    cycleState: state.cycleState,
    cycleSnapshot: state.cycleSnapshot,
    statusSnapshot: state.statusSnapshot,
    refreshCycleProjection: state.refreshCycleProjection,
});

/**
 * useCycleStatistics - 주기(Cycle) 기반 통계 계산 훅
 * 
 * MainTab에서 사용되는 주기 관련 계산 로직을 분리합니다.
 * useDeferredValue를 사용하여 무거운 계산이 UI 전환을 블로킹하지 않도록 합니다.
 */
export function useCycleStatistics({ isRuntimeActive = true } = {}) {
    const runtimeVisible = useAnalysisProjectionDemand(['cycle', 'status'], isRuntimeActive);
    const {
        blockedUrls,
        allowedUrls,
        filteringMode,
        globalGoal,
        siteRuleTimeline,
    } = useRuntimeParkedStoreSlice(
        useProtocolStore,
        selectCycleRuntimeProtocolSlice,
        runtimeVisible,
    );
    const {
        cycleState: rawCycleState,
        cycleSnapshot: rawCycleSnapshot,
        statusSnapshot: rawStatusSnapshot,
        refreshCycleProjection,
    } = useRuntimeParkedStoreSlice(
        useAnalysisStore,
        selectCycleRuntimeAnalysisSlice,
        runtimeVisible,
    );

    const cycleState = useDeferredValue(rawCycleState);
    const cycleSnapshot = useDeferredValue(rawCycleSnapshot);
    const statusSnapshot = useDeferredValue(rawStatusSnapshot);

    const focusOptions = useMemo(
        () => ({
            windowDays: 7,
            deltaWeight: 0.5,
            activeThresholdMs: 5 * 60 * 1000,
            wakeWindowHours: 3,
        }),
        []
    );

    const policyInput = useMemo(() => buildStatsAnalysisPolicyInput({
        blockedUrls,
        allowedUrls,
        filteringMode,
        globalGoal,
        siteRuleTimeline,
    }), [allowedUrls, blockedUrls, filteringMode, globalGoal, siteRuleTimeline]);
    const policyFingerprint = useMemo(
        () => buildStatsAnalysisPolicyFingerprint(policyInput),
        [policyInput],
    );
    const blockedList = useMemo(() => policyInput.blockedUrls || [], [policyInput]);
    const goals = useMemo(() => buildStatsAnalysisGoals(policyInput), [policyInput]);
    const siteLists = useMemo(
        () => ({
            blockedUrls: policyInput.blockedUrls,
            allowedUrls: policyInput.allowedUrls,
            filteringMode: policyInput.filteringMode,
        }),
        [policyInput]
    );

    useEffect(() => {
        if (!runtimeVisible) return;
        if (cycleSnapshot?.policyFingerprint === policyFingerprint) return;
        void refreshCycleProjection({ policyInput });
    }, [
        cycleSnapshot?.policyFingerprint,
        runtimeVisible,
        policyFingerprint,
        policyInput,
        refreshCycleProjection,
    ]);

    const cycleScore = cycleSnapshot?.score ?? 100;
    const cycleTopFactors = Array.isArray(cycleSnapshot?.topFactors)
        ? cycleSnapshot.topFactors
        : EMPTY_LIST;
    const currentCycle = cycleState?.currentCycleStart;

    // 데이터 축적 정도
    const daysTracked = useMemo(() => {
        return Number(statusSnapshot?.metrics?.trackedDateCount) || 0;
    }, [statusSnapshot?.metrics?.trackedDateCount]);

    const isNewUser = useMemo(() => daysTracked < 7, [daysTracked]);

    // Unmanaged Insights (비관리 사이트)
    const unmanagedInsights = useMemo(() => {
        const siteDetails = cycleSnapshot?.window?.siteDetails;
        if (!siteDetails) return EMPTY_LIST;
        const minMs = 20 * 60 * 1000;

        return Object.entries(siteDetails)
            .filter(([domain, ms]) => {
                const active = Number(ms) || 0;
                if (active < minMs) return false;
                if (filteringMode === 'allowlist') return false;
                if (isHostnameInList(domain, blockedList)) return false;
                if (isHostnameInList(domain, allowedUrls)) return false;
                return true;
            })
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2)
            .map(([domain, ms]) => {
                const hours = ms / 3600000;
                const score = Math.min(90, 70 + Math.round(hours) * 5);
                return {
                    id: `unmanaged-${domain}`,
                    type: 'warning',
                    title: tRuntime('main:insights.unmanaged.title'),
                    message: tRuntime(
                        'main:insights.unmanaged.message',
                        { domain, duration: formatMinutes(ms) }
                    ),
                    score,
                    domain,
                };
            });
    }, [allowedUrls, blockedList, cycleSnapshot?.window?.siteDetails, filteringMode]);

    return useMemo(() => ({
        cycleState,
        cycleSnapshot,
        cycleScore,
        cycleTopFactors,
        currentCycle,
        daysTracked,
        isNewUser,
        blockedList,
        goals,
        siteLists,
        insights: unmanagedInsights,
        unmanagedInsights,
        focusOptions,
    }), [
        blockedList,
        cycleScore,
        cycleSnapshot,
        cycleState,
        cycleTopFactors,
        currentCycle,
        daysTracked,
        focusOptions,
        goals,
        isNewUser,
        siteLists,
        unmanagedInsights,
    ]);
}

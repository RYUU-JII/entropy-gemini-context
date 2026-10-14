import { useCallback } from 'react';
import { normalizeDomain } from '../../../../lib/domain.js';
import { resolveSitesSelectionDomain } from '../../../../domains/stats/shared/sitesDomainScope.js';
import { useDocumentVisibility } from '../../../../ui-kit/hooks/useDocumentVisibility.js';
import { useRuntimeParkedStoreSlice } from '../../hooks/useRuntimeParkedStoreSlice.js';
import { useProtocolStore } from '../../stores/index.js';
import { useSitesMutations } from './controller/useSitesMutations.js';
import { useSitesPolicySnapshot } from './controller/useSitesPolicySnapshot.js';
import { useSitesSnapshotViewModel } from './controller/useSitesSnapshotViewModel.js';
import { useSitesSiteDetail } from './controller/useSitesSiteDetail.js';

const selectSitesProtocolState = (state) => ({
        blockedUrls: state.blockedUrls,
        allowedUrls: state.allowedUrls,
        filteringMode: state.filteringMode,
        rulesMode: state.rulesMode,
        globalGoal: state.globalGoal,
        siteGoals: state.siteGoals,
        siteRuleTimeline: state.siteRuleTimeline,
        trackingExcludedUrls: state.trackingExcludedUrls,
        dataCollectionMode: state.dataCollectionMode,
        insightsConsent: state.insightsConsent,
        insightsMode: state.insightsMode,
        protectionPresetAssignments: state.protectionPresetAssignments,
        setGlobalGoal: state.setGlobalGoal,
        setSiteRecordingExcluded: state.setSiteRecordingExcluded,
        removeSiteRule: state.removeSiteRule,
        updateSiteRule: state.updateSiteRule,
        upsertSiteRule: state.upsertSiteRule,
        moveSiteRule: state.moveSiteRule,
        syncExternalProtocolSettings: state.syncExternalProtocolSettings,
});

export function useSitesController({ selectedDomain = null, isActive = true, detailEnabled = true } = {}) {
    const documentVisible = useDocumentVisibility();
    const runtimeActive = isActive && documentVisible;
    const {
        blockedUrls,
        allowedUrls,
        filteringMode,
        rulesMode,
        globalGoal,
        siteGoals,
        siteRuleTimeline,
        trackingExcludedUrls,
        dataCollectionMode,
        insightsConsent,
        insightsMode,
        protectionPresetAssignments,
        setGlobalGoal,
        setSiteRecordingExcluded,
        removeSiteRule,
        updateSiteRule,
        upsertSiteRule,
        moveSiteRule,
        syncExternalProtocolSettings,
    } = useRuntimeParkedStoreSlice(useProtocolStore, selectSitesProtocolState, runtimeActive);

    const {
        sitesSnapshot,
        sitesSnapshotStatus,
        sitesSnapshotError,
        retrySitesSnapshot,
        rejectSitesPolicySnapshot,
        admitSitesSiteDetailRevisionMismatch,
        dashboardPolicyInput,
        dashboardPolicyFingerprint,
        blockedTargets,
        allowedTargets,
        trackingExcludedTargets,
        siteGoalMap,
    } = useSitesPolicySnapshot({
        blockedUrls,
        allowedUrls,
        filteringMode,
        globalGoal,
        siteGoals,
        siteRuleTimeline,
        trackingExcludedUrls,
        rulesMode,
        dataCollectionMode,
        insightsConsent,
        insightsMode,
        protectionPresetAssignments,
        refreshCanonicalPolicy: syncExternalProtocolSettings,
        enabled: runtimeActive,
    });

    const {
        trackedTargets,
        siteDetails,
        observedSiteDetails,
        siteRegistry,
        siteIntels,
        scoreSetupDrafts,
        totalExposure,
        globalExposureAverage,
        recording,
    } = useSitesSnapshotViewModel({
        sitesSnapshot,
    });
    const resolveSiteSelectionDomain = useCallback(
        (domain) => resolveSitesSelectionDomain(domain, dashboardPolicyInput),
        [dashboardPolicyInput],
    );
    const normalizedSelectedDomain = selectedDomain === null
        ? null : resolveSiteSelectionDomain(selectedDomain);
    const siteDetailState = useSitesSiteDetail({
        domain: normalizedSelectedDomain,
        policyInput: dashboardPolicyInput,
        policyFingerprint: dashboardPolicyFingerprint,
        siteDetailRevision: sitesSnapshot?.policyFingerprint === dashboardPolicyFingerprint
            ? sitesSnapshot?.siteDetailRevision
            : null,
        enabled: runtimeActive && detailEnabled,
        onRevisionMismatch: admitSitesSiteDetailRevisionMismatch,
        onPolicyRefusal: rejectSitesPolicySnapshot,
    });
    const selectedSiteDetail = normalizeDomain(siteDetailState.detail?.domain) === normalizedSelectedDomain
        ? siteDetailState.detail
        : null;

    const mutationHandlers = useSitesMutations({
        setGlobalGoal,
        setSiteRecordingExcluded,
        removeSiteRule,
        updateSiteRule,
        upsertSiteRule,
        moveSiteRule,
    });

    return {
        blockedTargets,
        allowedTargets,
        trackedTargets,
        trackingExcludedTargets,
        siteDetails,
        observedSiteDetails,
        siteRegistry,
        siteGoals: siteGoalMap,
        siteIntels,
        selectedSiteDetail,
        resolveSiteSelectionDomain,
        siteDetailStatus: siteDetailState.status,
        siteDetailRefreshStatus: siteDetailState.status,
        siteDetailError: siteDetailState.error,
        retrySiteDetail: siteDetailState.retry,
        sitesSnapshotStatus,
        sitesSnapshotError,
        sitesSnapshotRevision: sitesSnapshot?.siteDetailRevision ?? null,
        sitesSnapshotComputedAt: sitesSnapshot?.computedAtEpochMs ?? null,
        retrySitesSnapshot,
        scoreSetupDrafts,
        globalGoal,
        totalExposure,
        globalExposureAverage,
        recording,
        sitesPolicyFingerprint: sitesSnapshot?.policyFingerprint ?? null,
        ...mutationHandlers,
    };
}

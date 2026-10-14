import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
    buildStatsDashboardPolicyFingerprint,
    buildStatsDashboardPolicyInput,
} from '../../../../../domains/stats/analysis/index.js';
import { requireSitesSiteDetailRevision } from '../../../../../domains/stats/contracts/sitesSiteDetailContracts.js';
import { recordDashboardTabEntryStage } from '@dashboard-tab-entry-telemetry';
import { useAnalysisStore } from '../../../stores/useAnalysisStore.js';
import { useRuntimeParkedStoreSlice } from '../../../hooks/useRuntimeParkedStoreSlice.js';
import {
    admitSitesPolicySnapshotRefreshForDetailRevisionMismatch,
    preloadSitesPolicySnapshot,
} from './sitesPolicySnapshotResource.js';

export const SITES_STATS_REFRESH_COALESCE_MS = 60_000;

function hasCanonicalSiteDetailRevision(snapshot) {
    try {
        requireSitesSiteDetailRevision(snapshot?.siteDetailRevision);
        return true;
    } catch {
        return false;
    }
}

export function resolveSitesStatsRefreshDelay({
    sitesSnapshot,
    policyFingerprint,
    now = Date.now(),
    minIntervalMs = SITES_STATS_REFRESH_COALESCE_MS,
} = {}) {
    if (
        sitesSnapshot?.policyFingerprint !== policyFingerprint
        || !hasCanonicalSiteDetailRevision(sitesSnapshot)
    ) {
        return 0;
    }
    const computedAtEpochMs = Number(sitesSnapshot?.computedAtEpochMs);
    if (!Number.isFinite(computedAtEpochMs) || computedAtEpochMs < 0) return 0;
    const resolvedNow = Number.isFinite(Number(now)) ? Number(now) : Date.now();
    const resolvedMinIntervalMs = Number.isFinite(Number(minIntervalMs))
        ? Math.max(0, Math.floor(Number(minIntervalMs)))
        : SITES_STATS_REFRESH_COALESCE_MS;
    const elapsedMs = resolvedNow - computedAtEpochMs;
    if (elapsedMs < 0) return resolvedMinIntervalMs;
    return Math.max(0, resolvedMinIntervalMs - elapsedMs);
}

export function useSitesPolicySnapshot({
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
    refreshCanonicalPolicy,
    enabled = true,
}) {
    const {
        sitesSnapshot: storedSitesSnapshot,
        sitesSnapshotStale,
    } = useRuntimeParkedStoreSlice(useAnalysisStore, (state) => ({
        sitesSnapshot: state.sitesSnapshot,
        sitesSnapshotStale: state.sitesSnapshotStale,
    }), enabled);
    const [refreshFailure, setRefreshFailure] = useState(null);
    const [policyRefusal, setPolicyRefusal] = useState(null);
    const [retryRevision, setRetryRevision] = useState(0);
    const retryRequestedRef = useRef(false);
    const snapshotResourceRequestFingerprintRef = useRef(null);
    const lastSnapshotCacheHitKeyRef = useRef('');

    const dashboardPolicyInput = useMemo(() => buildStatsDashboardPolicyInput({
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
    }), [
        allowedUrls,
        blockedUrls,
        dataCollectionMode,
        filteringMode,
        globalGoal,
        insightsConsent,
        insightsMode,
        protectionPresetAssignments,
        rulesMode,
        siteGoals,
        siteRuleTimeline,
        trackingExcludedUrls,
    ]);
    const dashboardPolicyFingerprint = useMemo(
        () => buildStatsDashboardPolicyFingerprint(dashboardPolicyInput),
        [dashboardPolicyInput],
    );
    const snapshotMatchesPolicy = storedSitesSnapshot?.policyFingerprint
        === dashboardPolicyFingerprint;
    const snapshotHasSemanticRevision = snapshotMatchesPolicy
        && hasCanonicalSiteDetailRevision(storedSitesSnapshot);
    const currentPolicyRefusal = policyRefusal?.policyFingerprint === dashboardPolicyFingerprint
        ? policyRefusal.error
        : null;
    useEffect(() => {
        setPolicyRefusal((current) => current?.policyFingerprint !== dashboardPolicyFingerprint
            ? null : current);
    }, [dashboardPolicyFingerprint]);
    const refreshError = currentPolicyRefusal || (refreshFailure?.policyFingerprint === dashboardPolicyFingerprint
        ? refreshFailure.error
        : null);
    // The background may learn a cross-window privacy change before this
    // protocol store receives its commit broadcast. Its refusal is authoritative.
    const sitesSnapshot = snapshotHasSemanticRevision
        && refreshError?.code !== 'STATS_SITES_POLICY_CHANGED'
        ? storedSitesSnapshot
        : null;

    const retrySitesSnapshot = useCallback(() => {
        if (!enabled) return false;
        if (currentPolicyRefusal) {
            // A policy refusal is an authoritative privacy boundary. Re-read
            // through the protocol owner before admitting another stats query.
            if (typeof refreshCanonicalPolicy !== 'function') throw new Error('SITES_CANONICAL_POLICY_REFRESH_OWNER_REQUIRED');
            return refreshCanonicalPolicy().then(() => {
                // Do not let an identical cached fingerprint readmit the DTO
                // rejected by the background; retry needs a new owner read.
                useAnalysisStore.setState({ sitesSnapshotStale: true });
                retryRequestedRef.current = true;
                setPolicyRefusal(null);
                setRefreshFailure(null);
                setRetryRevision((current) => current + 1);
                return true;
            }).catch((error) => {
                setRefreshFailure({ policyFingerprint: dashboardPolicyFingerprint, error });
                return false;
            });
        }
        retryRequestedRef.current = true;
        setRefreshFailure(null);
        setRetryRevision((current) => current + 1);
        return true;
    }, [currentPolicyRefusal, dashboardPolicyFingerprint, enabled, refreshCanonicalPolicy]);

    const rejectSitesPolicySnapshot = useCallback((error) => {
        if (error?.code !== 'STATS_SITES_POLICY_CHANGED') return false;
        setPolicyRefusal({ policyFingerprint: dashboardPolicyFingerprint, error });
        return true;
    }, [dashboardPolicyFingerprint]);

    const admitSitesSiteDetailRevisionMismatch = useCallback(({
        requestedSiteDetailRevision,
        responseSiteDetailRevision,
    } = {}) => {
        if (!enabled) return false;
        const admitted = admitSitesPolicySnapshotRefreshForDetailRevisionMismatch({
            policyFingerprint: dashboardPolicyFingerprint,
            requestedSiteDetailRevision,
            responseSiteDetailRevision,
        });
        if (!admitted) return false;
        retryRequestedRef.current = true;
        setRefreshFailure(null);
        setRetryRevision((current) => current + 1);
        return true;
    }, [dashboardPolicyFingerprint, enabled]);

    useEffect(() => {
        if (!enabled) {
            snapshotResourceRequestFingerprintRef.current = null;
        }
    }, [enabled]);

    useEffect(() => {
        if (!enabled) return undefined;
        if (currentPolicyRefusal) return undefined;
        if (sitesSnapshotStale !== true && snapshotHasSemanticRevision) {
            const cacheHitKey = [
                dashboardPolicyFingerprint,
                storedSitesSnapshot.siteDetailRevision,
            ].join('::');
            if (snapshotResourceRequestFingerprintRef.current === dashboardPolicyFingerprint) {
                snapshotResourceRequestFingerprintRef.current = null;
                lastSnapshotCacheHitKeyRef.current = cacheHitKey;
            } else if (lastSnapshotCacheHitKeyRef.current !== cacheHitKey) {
                lastSnapshotCacheHitKeyRef.current = cacheHitKey;
                recordDashboardTabEntryStage('sites', 'data:sites-snapshot', {
                    cacheStatus: 'hit',
                    source: 'render',
                });
            }
            setRefreshFailure((current) => (current ? null : current));
            return undefined;
        }

        const retryRequested = retryRequestedRef.current;
        retryRequestedRef.current = false;
        const delayMs = retryRequested
            ? 0
            : resolveSitesStatsRefreshDelay({
                sitesSnapshot: storedSitesSnapshot,
                policyFingerprint: dashboardPolicyFingerprint,
            });
        let cancelled = false;
        let timerId = null;
        const refresh = () => {
            snapshotResourceRequestFingerprintRef.current = dashboardPolicyFingerprint;
            void preloadSitesPolicySnapshot({
                policyInput: dashboardPolicyInput,
                telemetrySource: 'render',
                isRequestCurrent: () => !cancelled && enabled,
            }).then(() => {
                if (!cancelled) setRefreshFailure(null);
            }).catch((error) => {
                if (cancelled) return;
                if (rejectSitesPolicySnapshot(error)) return;
                if (
                    snapshotResourceRequestFingerprintRef.current
                    === dashboardPolicyFingerprint
                ) {
                    snapshotResourceRequestFingerprintRef.current = null;
                }
                setRefreshFailure({
                    policyFingerprint: dashboardPolicyFingerprint,
                    error: error instanceof Error ? error : new Error(String(error)),
                });
            });
        };

        if (delayMs > 0) {
            timerId = globalThis.setTimeout(refresh, delayMs);
        } else {
            refresh();
        }
        return () => {
            cancelled = true;
            if (timerId !== null) globalThis.clearTimeout(timerId);
        };
    }, [
        dashboardPolicyFingerprint,
        dashboardPolicyInput,
        currentPolicyRefusal,
        enabled,
        rejectSitesPolicySnapshot,
        retryRevision,
        sitesSnapshotStale,
        snapshotHasSemanticRevision,
        storedSitesSnapshot,
    ]);

    const blockedTargets = useMemo(() => dashboardPolicyInput.blockedUrls || [], [dashboardPolicyInput]);
    const allowedTargets = useMemo(() => dashboardPolicyInput.allowedUrls || [], [dashboardPolicyInput]);
    const trackingExcludedTargets = useMemo(
        () => dashboardPolicyInput.trackingExcludedUrls || [],
        [dashboardPolicyInput],
    );
    const siteGoalMap = useMemo(() => dashboardPolicyInput.siteGoals || {}, [dashboardPolicyInput]);

    return {
        sitesSnapshot,
        sitesSnapshotStatus: refreshError
            ? (sitesSnapshot ? 'refresh_error' : 'error')
            : sitesSnapshot
                ? (sitesSnapshotStale === true ? 'refreshing' : 'ready')
                : 'loading',
        sitesSnapshotError: refreshError,
        retrySitesSnapshot,
        rejectSitesPolicySnapshot,
        admitSitesSiteDetailRevisionMismatch,
        dashboardPolicyInput,
        dashboardPolicyFingerprint,
        blockedTargets,
        allowedTargets,
        trackingExcludedTargets,
        siteGoalMap,
    };
}

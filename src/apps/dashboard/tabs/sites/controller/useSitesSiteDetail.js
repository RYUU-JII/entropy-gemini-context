import { useCallback, useEffect, useRef, useState } from 'react';

import { normalizeDomain } from '../../../../../lib/domain.js';
import { recordDashboardTabEntryStage } from '@dashboard-tab-entry-telemetry';
import {
    createSitesSiteDetailResourceKey,
    isSitesSiteDetailRevisionMismatchError,
    peekSitesSiteDetail,
    preloadSitesSiteDetail,
} from './sitesSiteDetailResource.js';

const IDLE_STATE = Object.freeze({
    status: 'idle',
    detail: null,
    error: null,
});
const INTERNAL_IDLE_STATE = Object.freeze({
    requestDomain: null,
    requestKey: null,
    requestPolicyFingerprint: null,
    ...IDLE_STATE,
});

function retainMatchingDetail(state, domain, policyFingerprint) {
    return state.requestPolicyFingerprint === policyFingerprint
        && normalizeDomain(state.detail?.domain) === domain
        ? state.detail
        : null;
}

export function useSitesSiteDetail({
    domain,
    policyInput,
    policyFingerprint,
    siteDetailRevision,
    enabled = true,
    onRevisionMismatch = null,
    onPolicyRefusal = null,
} = {}) {
    const normalizedDomain = normalizeDomain(domain);
    const requestSequenceRef = useRef(0);
    const detailResourceRequestKeyRef = useRef(null);
    const lastDetailCacheHitKeyRef = useRef('');
    const [retryRevision, setRetryRevision] = useState(0);
    const [state, setState] = useState(INTERNAL_IDLE_STATE);
    const hasSiteDetailRevision = typeof siteDetailRevision === 'string'
        && siteDetailRevision.trim().length > 0;
    const request = normalizedDomain && hasSiteDetailRevision ? {
        domain: normalizedDomain,
        policyInput,
        policyFingerprint,
        siteDetailRevision,
        telemetrySource: 'render',
    } : null;
    const requestKey = request ? createSitesSiteDetailResourceKey(request) : null;
    const cachedDetail = request ? peekSitesSiteDetail(request) : null;
    const retry = useCallback(() => {
        if (!enabled || !normalizedDomain || !hasSiteDetailRevision) return false;
        setRetryRevision((current) => current + 1);
        return true;
    }, [enabled, hasSiteDetailRevision, normalizedDomain]);

    useEffect(() => {
        if (!enabled) {
            detailResourceRequestKeyRef.current = null;
            return undefined;
        }
        if (!normalizedDomain || !request) {
            setState(INTERNAL_IDLE_STATE);
            return undefined;
        }

        if (cachedDetail) {
            if (detailResourceRequestKeyRef.current === requestKey) {
                detailResourceRequestKeyRef.current = null;
                lastDetailCacheHitKeyRef.current = requestKey;
            } else if (lastDetailCacheHitKeyRef.current !== requestKey) {
                lastDetailCacheHitKeyRef.current = requestKey;
                recordDashboardTabEntryStage('sites', 'data:sites-site-detail', {
                    cacheStatus: 'hit',
                    source: 'render',
                });
            }
            setState({
                requestDomain: normalizedDomain,
                requestKey,
                requestPolicyFingerprint: policyFingerprint,
                status: 'ready',
                detail: cachedDetail,
                error: null,
            });
            return undefined;
        }

        const requestSequence = requestSequenceRef.current + 1;
        requestSequenceRef.current = requestSequence;
        let cancelled = false;
        setState((current) => {
            const retainedDetail = retainMatchingDetail(current, normalizedDomain, policyFingerprint);
            return {
                requestDomain: normalizedDomain,
                requestKey,
                requestPolicyFingerprint: policyFingerprint,
                status: retainedDetail ? 'refreshing' : 'loading',
                detail: retainedDetail,
                error: null,
            };
        });

        detailResourceRequestKeyRef.current = requestKey;
        void preloadSitesSiteDetail(request).then((detail) => {
            if (cancelled || requestSequenceRef.current !== requestSequence) return;
            setState({
                requestDomain: normalizedDomain,
                requestKey,
                requestPolicyFingerprint: policyFingerprint,
                status: 'ready',
                detail,
                error: null,
            });
        }).catch((error) => {
            if (cancelled || requestSequenceRef.current !== requestSequence) return;
            if (detailResourceRequestKeyRef.current === requestKey) {
                detailResourceRequestKeyRef.current = null;
            }
            let normalizedError = error instanceof Error
                ? error
                : new Error(String(error || 'SITES_SITE_DETAIL_QUERY_FAILED'));
            let revisionRefreshAdmitted = false;
            if (normalizedError.code === 'STATS_SITES_POLICY_CHANGED') {
                onPolicyRefusal?.(normalizedError);
            }
            if (
                isSitesSiteDetailRevisionMismatchError(normalizedError)
                && typeof onRevisionMismatch === 'function'
            ) {
                try {
                    revisionRefreshAdmitted = onRevisionMismatch({
                        requestedSiteDetailRevision:
                            normalizedError.requestedSiteDetailRevision,
                        responseSiteDetailRevision:
                            normalizedError.responseSiteDetailRevision,
                    }) === true;
                } catch (admissionError) {
                    normalizedError = admissionError instanceof Error
                        ? admissionError
                        : new Error(String(
                            admissionError
                            || 'SITES_POLICY_SNAPSHOT_REVISION_MISMATCH_ADMISSION_FAILED',
                        ));
                }
            }
            if (!isSitesSiteDetailRevisionMismatchError(normalizedError)) {
                console.warn('[SITES_FLOW][detail][query_failed]', {
                    domain: normalizedDomain,
                    code: normalizedError.code,
                    message: normalizedError.message,
                });
            }
            setState((current) => {
                const retainedDetail = normalizedError.code === 'STATS_SITES_POLICY_CHANGED'
                    ? null
                    : retainMatchingDetail(current, normalizedDomain, policyFingerprint);
                return {
                    requestDomain: normalizedDomain,
                    requestKey,
                    requestPolicyFingerprint: policyFingerprint,
                    status: revisionRefreshAdmitted
                        ? (retainedDetail ? 'refreshing' : 'loading')
                        : 'error',
                    detail: retainedDetail,
                    error: revisionRefreshAdmitted ? null : normalizedError,
                };
            });
        });

        return () => {
            cancelled = true;
        };
    }, [
        enabled,
        cachedDetail,
        normalizedDomain,
        onRevisionMismatch,
        onPolicyRefusal,
        policyFingerprint,
        requestKey,
        retryRevision,
    ]);

    if (!normalizedDomain) return { ...IDLE_STATE, retry };
    if (!enabled) {
        if (state.requestDomain !== normalizedDomain
            || state.requestPolicyFingerprint !== policyFingerprint) return { ...IDLE_STATE, retry };
        return {
            status: state.status,
            detail: state.detail,
            error: state.error,
            retry,
        };
    }
    if (!request) {
        return {
            status: 'loading',
            detail: null,
            error: null,
            retry,
        };
    }
    if (state.requestKey !== requestKey) {
        if (cachedDetail) {
            return {
                status: 'ready',
                detail: cachedDetail,
                error: null,
                retry,
            };
        }
        const retainedDetail = retainMatchingDetail(state, normalizedDomain, policyFingerprint);
        return {
            status: retainedDetail ? 'refreshing' : 'loading',
            detail: retainedDetail,
            error: null,
            retry,
        };
    }
    return {
        status: state.status,
        detail: state.detail,
        error: state.error,
        retry,
    };
}

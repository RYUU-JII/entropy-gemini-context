import { normalizeDomain } from '../../../../lib/domain.js';
import { isHostnameInList } from '../../../../lib/index.js';
import {
  buildStatsDashboardPolicyFingerprint,
  buildStatsDashboardPolicyInput,
} from '../../../../domains/stats/analysis/index.js';
import { requireSitesSiteDetailRevision } from '../../../../domains/stats/contracts/sitesSiteDetailContracts.js';
import { useAnalysisStore } from '../../stores/useAnalysisStore.js';
import { useProtocolStore } from '../../stores/useProtocolStore.js';
import {
  admitSitesPolicySnapshotRefreshForDetailRevisionMismatch,
  preloadSitesPolicySnapshot,
} from './controller/sitesPolicySnapshotResource.js';
import {
  isSitesSiteDetailRevisionMismatchError,
  preloadSitesSiteDetail,
} from './controller/sitesSiteDetailResource.js';

const tabDataInFlight = new Map();

export const SITES_DATA_PRELOAD_ERROR = Object.freeze({
  ABORT_SIGNAL_INVALID: 'SITES_DATA_PRELOAD_ABORT_SIGNAL_INVALID',
  ABORTED: 'SITES_DATA_PRELOAD_ABORTED',
});

function createPreloadError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function requirePreloadAbortSignal(signal) {
  if (signal === null || signal === undefined) return null;
  if (
    typeof signal !== 'object'
    || typeof signal.aborted !== 'boolean'
    || typeof signal.addEventListener !== 'function'
    || typeof signal.removeEventListener !== 'function'
  ) {
    throw createPreloadError(SITES_DATA_PRELOAD_ERROR.ABORT_SIGNAL_INVALID);
  }
  return signal;
}

function throwIfPreloadAborted(signal) {
  if (signal?.aborted !== true) return;
  const error = createPreloadError(SITES_DATA_PRELOAD_ERROR.ABORTED);
  error.name = 'AbortError';
  throw error;
}

function readCanonicalPolicyInput() {
  const protocolState = useProtocolStore.getState();
  if (protocolState?.loaded !== true) {
    throw createPreloadError('SITES_DATA_PRELOAD_PROTOCOL_NOT_READY');
  }
  if (useAnalysisStore.getState()?.loaded !== true) {
    throw createPreloadError('SITES_DATA_PRELOAD_ANALYSIS_NOT_READY');
  }
  return buildStatsDashboardPolicyInput({
    blockedUrls: protocolState.blockedUrls,
    allowedUrls: protocolState.allowedUrls,
    filteringMode: protocolState.filteringMode,
    globalGoal: protocolState.globalGoal,
    siteGoals: protocolState.siteGoals,
    siteRuleTimeline: protocolState.siteRuleTimeline,
    trackingExcludedUrls: protocolState.trackingExcludedUrls,
    rulesMode: protocolState.rulesMode,
    dataCollectionMode: protocolState.dataCollectionMode,
    insightsConsent: protocolState.insightsConsent,
    insightsMode: protocolState.insightsMode,
    protectionPresetAssignments: protocolState.protectionPresetAssignments,
  });
}

function resolvePreferredDomain(preferredDomain, policyInput) {
  const normalizedPreferredDomain = normalizeDomain(preferredDomain);
  if (!normalizedPreferredDomain) return null;
  return [...policyInput.blockedUrls, ...policyInput.allowedUrls]
    .filter((target) => isHostnameInList(normalizedPreferredDomain, [target]))
    .sort((left, right) => right.length - left.length || left.localeCompare(right))[0]
    || normalizedPreferredDomain;
}

export function preloadSitesTabData({ preferredDomain = null, signal = null } = {}) {
  const resolvedSignal = requirePreloadAbortSignal(signal);
  throwIfPreloadAborted(resolvedSignal);
  const policyInput = readCanonicalPolicyInput();
  const policyFingerprint = buildStatsDashboardPolicyFingerprint(policyInput);
  const normalizedPreferredDomain = normalizeDomain(preferredDomain);
  const preloadKey = `${policyFingerprint}::${normalizedPreferredDomain || 'snapshot'}`;
  const pending = tabDataInFlight.get(preloadKey);
  if (pending?.signal === resolvedSignal) return pending.promise;

  const operation = (async () => {
    let sitesSnapshot = await preloadSitesPolicySnapshot({
      policyInput,
      telemetrySource: 'boot',
    });
    let canRetryRevisionMismatch = true;

    while (true) {
      throwIfPreloadAborted(resolvedSignal);
      const siteDetailRevision = requireSitesSiteDetailRevision(
        sitesSnapshot?.siteDetailRevision,
      );
      // A ledger has no selected analytical subject. Only a declared domain
      // intent admits detail work; registry ranking is not user intent.
      const defaultDomain = resolvePreferredDomain(normalizedPreferredDomain, policyInput);
      if (!defaultDomain) {
        return Object.freeze({
          policyFingerprint,
          siteDetailRevision,
          defaultDomain: null,
          snapshotReady: true,
          detailReady: false,
        });
      }

      try {
        await preloadSitesSiteDetail({
          domain: defaultDomain,
          policyInput,
          policyFingerprint,
          siteDetailRevision,
          telemetrySource: 'boot',
        });
      } catch (error) {
        if (!isSitesSiteDetailRevisionMismatchError(error)) throw error;
        admitSitesPolicySnapshotRefreshForDetailRevisionMismatch({
          policyFingerprint,
          requestedSiteDetailRevision: error.requestedSiteDetailRevision,
          responseSiteDetailRevision: error.responseSiteDetailRevision,
        });
        if (!canRetryRevisionMismatch) throw error;
        canRetryRevisionMismatch = false;
        sitesSnapshot = await preloadSitesPolicySnapshot({
          policyInput,
          telemetrySource: 'boot',
        });
        continue;
      }

      return Object.freeze({
        policyFingerprint,
        siteDetailRevision,
        defaultDomain,
        snapshotReady: true,
        detailReady: true,
      });
    }
  })();
  const entry = { promise: operation, signal: resolvedSignal };
  tabDataInFlight.set(preloadKey, entry);
  operation.then(
    () => {
      if (tabDataInFlight.get(preloadKey) === entry) tabDataInFlight.delete(preloadKey);
    },
    () => {
      if (tabDataInFlight.get(preloadKey) === entry) tabDataInFlight.delete(preloadKey);
    },
  );
  return operation;
}

export function resetSitesTabDataPreloadCache() {
  tabDataInFlight.clear();
}

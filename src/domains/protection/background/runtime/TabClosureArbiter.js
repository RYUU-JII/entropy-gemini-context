import {
  INTERVENTION_PHASES,
} from '../../contracts/interventionLedgerContract.js';
import { getInterventionAdmissionService } from './InterventionAdmissionService.js';
import {
  RITUAL_SURFACE_TYPES,
} from '../../../nudge/runtime/ritualSurfaceLadder.js';
import {
  TAB_CLOSURE_OUTCOMES,
  TAB_CLOSURE_REFUSAL_REASONS,
  TAB_CLOSURE_TIERS,
  resolveTabClosureRequester,
} from '../../contracts/tabClosureContract.js';

function requireFunction(fn, errorCode) {
  if (typeof fn !== 'function') throw new Error(errorCode);
  return fn;
}

function normalizeTabId(value) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function normalizeTabIds(tabId, tabIds) {
  const source = Array.isArray(tabIds) ? tabIds : [tabId];
  const normalized = [];
  for (const candidate of source) {
    const normalizedTabId = normalizeTabId(candidate);
    if (normalizedTabId === null) return null;
    if (!normalized.includes(normalizedTabId)) normalized.push(normalizedTabId);
  }
  return normalized.length ? normalized : null;
}

function toErrorMessage(error) {
  return String(error?.message || error || 'TAB_CLOSURE_UNKNOWN_ERROR');
}

/** Tab destruction uses the exact admission lease/session. Authorization and
 * the browser removal share one serialized lane with admission and revocation.
 * Explicit user-selected tabs and integrity eviction retain their own contracts. */
export function createTabClosureArbiter({
  browserPort,
  gateInterventionSessionRepository,
  interventionLedger,
  recordDiagnostic,
  admissionService = null,
} = {}) {
  const removeTabs = requireFunction(
    browserPort?.tabsRemove,
    'TAB_CLOSURE_BROWSER_PORT_REQUIRED',
  ).bind(browserPort);
  const readSessionByTabId = requireFunction(
    gateInterventionSessionRepository?.getSessionByTabId,
    'TAB_CLOSURE_GATE_SESSION_REPOSITORY_REQUIRED',
  ).bind(gateInterventionSessionRepository);
  const recordLedgerDetached = requireFunction(
    interventionLedger?.recordDetached,
    'TAB_CLOSURE_INTERVENTION_LEDGER_REQUIRED',
  );
  const recordClosureDiagnostic = requireFunction(
    recordDiagnostic,
    'TAB_CLOSURE_DIAGNOSTICS_REQUIRED',
  );

  function recordRefusal(descriptor, {
    tabId,
    hostname,
    sessionId,
    refusalReason,
    now,
  }) {
    recordClosureDiagnostic('tab_closure_refused', {
      requester: descriptor.id,
      tier: descriptor.tier,
      tabId,
      hostname,
      refusalReason,
      refusedBy: RITUAL_SURFACE_TYPES.GATE_INTERSTITIAL,
      observedAt: now,
    });
    // A refusal is the same fact the ledger already records for a surface that
    // wanted the screen and did not get it: policy tried to intervene and was
    // outranked. Requesters whose own surface is recorded elsewhere declare no
    // ledger surface so the episode is not written twice.
    if (!descriptor.ledgerSurfaceId) return;
    recordLedgerDetached({
      surfaceId: descriptor.ledgerSurfaceId,
      phase: INTERVENTION_PHASES.SUPPRESSED,
      scope: { hostname, tabId },
      reason: `tab_closure_refused:${refusalReason}`,
      sessionId,
      at: now,
    });
  }

  /**
   * Whether an existing Gate session forbids an Enso conclusion. Returns the
   * refusal reason, or null when the requester may proceed.
   */
  async function findBlockingAuthority(descriptor, tabId) {
    if (descriptor.tier !== TAB_CLOSURE_TIERS.RESOLUTION) return null;
    if (descriptor.surfaceType !== RITUAL_SURFACE_TYPES.ENSO_GATE) return null;
    const session = await readSessionByTabId(tabId);
    return session ? TAB_CLOSURE_REFUSAL_REASONS.GATE_SESSION_ACTIVE : null;
  }

  async function requestTabClosure({
    tabId,
    tabIds,
    requester,
    reason = '',
    hostname = '',
    sessionId = '',
    admissionLease = null,
    documentId = null,
    sourceTabId = null,
    selection = null,
    now = Date.now(),
  } = {}) {
    const descriptor = resolveTabClosureRequester(requester);
    const normalizedTabIds = normalizeTabIds(tabId, tabIds);
    if (!normalizedTabIds) {
      throw new Error('TAB_CLOSURE_TAB_ID_REQUIRED');
    }
    if (
      descriptor.tier === TAB_CLOSURE_TIERS.RESOLUTION
      && normalizedTabIds.length !== 1
    ) {
      // A conclusion ends one intervention on one tab. A batch arriving here
      // means the caller picked the wrong requester, not that it meant this.
      throw new Error('TAB_CLOSURE_RESOLUTION_REQUIRES_SINGLE_TAB');
    }

    let selectedTargets = null;
    if (descriptor.tier === TAB_CLOSURE_TIERS.SELECTION) {
      if (normalizeTabId(sourceTabId) === null
        || !selection || typeof selection.gatePageUrl !== 'string' || !selection.gatePageUrl
        || typeof selection.sourceUrl !== 'string' || !selection.sourceUrl || selection.sourceUrl.trim() !== selection.sourceUrl
        || typeof selection.sourceDocumentId !== 'string' || !selection.sourceDocumentId
        || selection.sourceDocumentId.trim() !== selection.sourceDocumentId
        || !Array.isArray(selection.targets) || selection.targets.length !== normalizedTabIds.length
        || selection.targets.some((target, index) => target?.tabId !== normalizedTabIds[index]
          || typeof target.url !== 'string' || !target.url || target.url.trim() !== target.url)) {
        throw new Error('TAB_CLOSURE_SELECTION_CONTEXT_REQUIRED');
      }
      // Snapshot before admission; mutable caller input cannot retarget a choice.
      selectedTargets = selection.targets.map(({ tabId: targetTabId, url }) => Object.freeze({ tabId: targetTabId, url }));
    }
    const selectedGatePageUrl = selection?.gatePageUrl;
    const selectedSourceUrl = selection?.sourceUrl;
    const selectedSourceDocumentId = selection?.sourceDocumentId;

    function refuseSelection(refusalReason, targetTabId = sourceTabId) {
      recordRefusal(descriptor, { tabId: targetTabId, hostname, sessionId, refusalReason, now });
      return { outcome: TAB_CLOSURE_OUTCOMES.REFUSED, refusedBy: RITUAL_SURFACE_TYPES.GATE_INTERSTITIAL,
        refusalReason, closedTabIds: [], error: null };
    }

    async function validateSelectionTargets() {
      const readTab = requireFunction(browserPort?.tabsGet, 'TAB_CLOSURE_TARGET_READER_REQUIRED').bind(browserPort);
      const sourceMatches = (session) => session?.sessionId === sessionId
        && session.gateKind === 'detourSpreadGuard' && session.status === 'pending'
        && session.gatePageUrl === selectedGatePageUrl
        && session.originalUrl === selectedSourceUrl
        && session.metrics?.gateDocumentId === selectedSourceDocumentId
        && selectedTargets.every((target) => session.protectedTabs?.some((entry) => (
          entry.tabId === target.tabId && entry.url === target.url
        )));
      if (!sourceMatches(await readSessionByTabId(sourceTabId))) return refuseSelection('stale_gate_selection');
      const liveTabs = new Map([...new Set([sourceTabId, ...normalizedTabIds])]
        .map((targetTabId) => [targetTabId, readTab(targetTabId)]));
      const hasPendingNavigation = (tab) => Object.hasOwn(tab, 'pendingUrl') && tab.pendingUrl !== undefined
        && (typeof tab.pendingUrl !== 'string' || (tab.pendingUrl !== '' && tab.pendingUrl !== tab.url));
      // Each read is inside the same admitted operation as removal. Gate-page
      // projection is allowed only through that target's exact current session.
      const [sourceTab, inspected] = await Promise.all([liveTabs.get(sourceTabId), Promise.all(selectedTargets.map(async (target) => {
        const [tab, targetSession] = await Promise.all([liveTabs.get(target.tabId), readSessionByTabId(target.tabId)]);
        if (!tab || tab.id !== target.tabId || typeof tab.url !== 'string' || !tab.url) {
          return { tabId: target.tabId, reason: 'gate_selection_target_unavailable' };
        }
        if (hasPendingNavigation(tab)) {
          return { tabId: target.tabId, reason: 'gate_selection_target_navigating' };
        }
        const exactGatePage = targetSession?.tabId === target.tabId
          && targetSession.originalUrl === target.url && targetSession.gatePageUrl === tab.url
          && ['pending', 'resuming'].includes(targetSession.status);
        return tab.url === target.url || exactGatePage ? null
          : { tabId: target.tabId, reason: 'stale_gate_selection_target' };
      }))]);
      if (!sourceTab || sourceTab.id !== sourceTabId || sourceTab.url !== selectedGatePageUrl) {
        return refuseSelection('stale_gate_selection_source');
      }
      if (hasPendingNavigation(sourceTab)) return refuseSelection('gate_selection_source_navigating');
      const rejected = inspected.find((entry) => entry !== null);
      if (rejected) return refuseSelection(rejected.reason, rejected.tabId);
      if (!sourceMatches(await readSessionByTabId(sourceTabId))) return refuseSelection('stale_gate_selection');
      return null;
    }

    async function executeClosure() {
      if (selectedTargets) {
        const rejection = await validateSelectionTargets();
        if (rejection) return rejection;
      }
      const refusalReason = await findBlockingAuthority(
        descriptor,
        normalizedTabIds[0],
      );
      if (refusalReason) {
        recordRefusal(descriptor, {
          tabId: normalizedTabIds[0],
          hostname,
          sessionId,
          refusalReason,
          now,
        });
        return {
          outcome: TAB_CLOSURE_OUTCOMES.REFUSED,
          refusedBy: RITUAL_SURFACE_TYPES.GATE_INTERSTITIAL,
          refusalReason,
          closedTabIds: [],
          error: null,
        };
      }

      let removal;
      try {
        // A batch of one is still a batch: reshaping it would make the port call
        // stop matching what the caller asked for.
        removal = await removeTabs(
          Array.isArray(tabIds) ? normalizedTabIds : normalizedTabIds[0],
        );
      } catch (error) {
        removal = { success: false, error: toErrorMessage(error) };
      }
      if (!removal?.success) {
        recordClosureDiagnostic('tab_closure_failed', {
          requester: descriptor.id,
          tier: descriptor.tier,
          tabIds: normalizedTabIds,
          hostname,
          reason,
          error: removal?.error || 'TABS_REMOVE_FAILED',
          observedAt: now,
        });
        return {
          outcome: TAB_CLOSURE_OUTCOMES.FAILED,
          refusedBy: null,
          refusalReason: null,
          closedTabIds: [],
          error: removal?.error || 'TABS_REMOVE_FAILED',
        };
      }

      return {
        outcome: TAB_CLOSURE_OUTCOMES.CLOSED,
        refusedBy: null,
        refusalReason: null,
        closedTabIds: normalizedTabIds,
        error: null,
      };
    }
    if (descriptor.tier === TAB_CLOSURE_TIERS.EVICTION) return executeClosure();
    const admission = admissionService || getInterventionAdmissionService();
    if (descriptor.tier === TAB_CLOSURE_TIERS.SELECTION) return admission.selectGate(sessionId, sourceTabId, executeClosure);
    if ([RITUAL_SURFACE_TYPES.ENSO_GATE, RITUAL_SURFACE_TYPES.SITE_FURIN].includes(descriptor.surfaceType)) {
      return admission.resolve({ leaseId: admissionLease?.leaseId, tabId: normalizedTabIds[0], documentId }, executeClosure,
        { requiredKind: descriptor.surfaceType });
    }
    return admission.resolveGate(sessionId, normalizedTabIds[0], executeClosure);
  }

  return Object.freeze({ requestTabClosure });
}

export default createTabClosureArbiter;

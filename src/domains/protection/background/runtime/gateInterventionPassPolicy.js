import {
  getGateKeptTabPassWindowMs,
} from '../../../settings/config/gateConfig.js';
import { resolveTimeWindowUntil } from '../../../../lib/timeWindow.js';
import { GATE_PASS_SCOPES } from './gateInterventionPassLedger.js';

export const GATE_PASS_GRANT_REASONS = Object.freeze({
  DETOUR_KEPT_TAB: 'detour_kept_tab',
});

function normalizeTabId(tabId) {
  if (typeof tabId !== 'number') return null;
  return Number.isInteger(tabId) && tabId >= 0 ? tabId : null;
}

// Ordinary Continue is owned by GateRuntimeStateOwner's shared entry approval.
// Only detour's narrow "keep this tab" decision grants a timed tab pass here.
export function resolveGateDecisionPassGrants({
  gateKind,
  decision,
  hostname,
  tabId = null,
  now = Date.now(),
} = {}) {
  if (decision !== 'continue') return [];
  const normalizedHostname = typeof hostname === 'string' ? hostname.trim().toLowerCase() : '';
  if (!normalizedHostname) return [];

  if (gateKind === 'detourSpreadGuard') {
    const normalizedTabId = normalizeTabId(tabId);
    // Without a tab to address, "I keep this tab" cannot be expressed at all.
    // Widening it to the host would grant more than the user said, so grant
    // nothing and let the entry checkpoint run.
    if (normalizedTabId === null) return [];
    return [{
      gateKind: 'entryCheckpoint',
      scope: GATE_PASS_SCOPES.TAB,
      hostname: normalizedHostname,
      tabId: normalizedTabId,
      until: resolveTimeWindowUntil(now, getGateKeptTabPassWindowMs()),
      reason: GATE_PASS_GRANT_REASONS.DETOUR_KEPT_TAB,
    }];
  }

  return [];
}

export default resolveGateDecisionPassGrants;

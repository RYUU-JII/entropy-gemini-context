import { getGateProtectedContextConsumeDwellMs, getGateProtectedContextWindowMs } from '../../../settings/config/gateConfig.js';
import { requireConsumptionSegment } from '../../../tracking/background/trackingConsumptionFlowState.js';

// Gate owns this interpretation, Tracking owns the usage facts. Entry/blur
// callbacks alone are insufficient evidence that a protected page was used.
export function projectGateConsumedContexts(flow, now) {
  if (!flow || flow.basis !== 'collection-admitted-foreground' || !Array.isArray(flow.contexts)) {
    throw new Error('PROTECTION_GATE_CONSUMPTION_FLOW_INVALID');
  }
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('PROTECTION_GATE_CONSUMPTION_NOW_INVALID');
  const consumeDwellMs = getGateProtectedContextConsumeDwellMs();
  const contextWindowMs = getGateProtectedContextWindowMs();
  const consumedProtectedContexts = flow.contexts.map(requireConsumptionSegment)
    .filter((context) => context.isProtected && context.closed
      && context.endedAt <= now && now - context.endedAt <= contextWindowMs
      && context.endedAt - context.startedAt >= consumeDwellMs)
    .slice(-48)
    .map((context) => ({
      hostname: context.hostname,
      tabId: context.tabId,
      startedAt: context.startedAt,
      consumedAt: context.endedAt,
      dwellMs: context.endedAt - context.startedAt,
    }));
  return { consumedProtectedContextCount: consumedProtectedContexts.length, consumedProtectedContexts, consumeDwellMs, contextWindowMs };
}

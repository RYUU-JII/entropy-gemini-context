import { recordProtectionInterventionEvent } from '../../protection/content/runtime/protectionRuntimeDiagnostics.js';
import { createRandomUuid } from '../../../lib/randomUuid.js';

// Immutable causal labels only. Never consulted by admission, cleanup or retry
// policy and never persisted or sent as authority to the background service.
export function createInterventionActivationTrace({ protectionContext = null, runId = null } = {}) {
  return Object.freeze({
    activationId: createRandomUuid(),
    traceId: protectionContext?.trace?.traceId ?? null,
    protectionRevision: protectionContext?.revision ?? null,
    runId,
  });
}

export function recordInterventionLifecycleEvent(event, details) {
  recordProtectionInterventionEvent(event, details);
}

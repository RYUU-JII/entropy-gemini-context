import { MESSAGE_TYPES } from '../../../platform/messaging/messageTypes.js';

// A closed return lock outranks every question: there is nothing to decide
// about a site that is not open.
export const GATE_INTERVENTION_PRIORITY = Object.freeze([
  'returnGuard',
  'detourSpreadGuard',
  'entryCheckpoint',
]);

const GATE_INTERVENTION_SIGNAL_BY_CHILD = Object.freeze({
  returnGuard: 'RETURN_GUARD_REQUIRED',
  detourSpreadGuard: 'DETOUR_SPREAD_DETECTED',
  entryCheckpoint: 'ENTRY_CHECKPOINT_REQUIRED',
});

export function resolveGateInterventionInstruction(runtimeSnapshot, hostname, now = Date.now()) {
  const isolationSession = runtimeSnapshot?.scope?.specialSession;
  if (
    isolationSession?.active === true
    && isolationSession.mode === 'isolation'
    && runtimeSnapshot?.scope?.isBlockedDomain === true
  ) {
    const endsAt = Math.max(now, Math.floor(Number(isolationSession.endsAt) || now));
    const holdDurationMs = Math.max(0, endsAt - now);
    return {
      message: {
        type: MESSAGE_TYPES.GATE_INTERVENTION_START,
        payload: {
          hostname,
          interactionId: `${hostname}:isolation:${isolationSession.id}`,
          gateKind: 'isolation',
          signalCode: 'ISOLATION_SESSION_ACTIVE',
          severity: 'high',
          planLevel: 4,
          activeChildIds: ['isolation'],
          pressureSignals: [],
          directTriggers: ['ISOLATION_SESSION_ACTIVE'],
          holdDurationMs,
          holdUntil: endsAt,
          metrics: {
            sessionId: isolationSession.id,
            sessionEndsAt: endsAt,
          },
          protectedTabs: [],
          issuedAt: now,
        },
      },
      signature: JSON.stringify({
        gateKind: 'isolation',
        sessionId: isolationSession.id,
        hostname,
        endsAt,
      }),
      suppressedChildIds: Object.freeze([]),
    };
  }

  const artifacts = runtimeSnapshot?.plan?.artifacts && typeof runtimeSnapshot.plan.artifacts === 'object'
    ? runtimeSnapshot.plan.artifacts
    : {};
  const activeChildIds = GATE_INTERVENTION_PRIORITY.filter((artifactId) => artifacts[artifactId] === 'engaged');

  if (activeChildIds.length === 0) {
    return {
      message: {
        type: MESSAGE_TYPES.GATE_INTERVENTION_STOP,
        payload: {
          hostname,
          issuedAt: now,
          reason: 'inactive',
        },
      },
      signature: 'stop',
      suppressedChildIds: Object.freeze([]),
    };
  }

  const gateKind = activeChildIds[0];
  const gateTelemetry = runtimeSnapshot?.telemetryContext?.gate && typeof runtimeSnapshot.telemetryContext.gate === 'object'
    ? runtimeSnapshot.telemetryContext.gate
    : {};
  const gateMetrics = gateTelemetry?.[gateKind] && typeof gateTelemetry[gateKind] === 'object'
    ? gateTelemetry[gateKind]
    : {};
  const runtimePlanLevel = Math.max(1, Math.floor(Number(runtimeSnapshot?.plan?.state?.level) || 1));
  const interventionLevel = runtimePlanLevel;
  const stableMetrics = gateKind === 'returnGuard'
    ? {
      lockActive: gateMetrics.lockActive === true,
      lockLeftAt: Math.max(0, Math.floor(Number(gateMetrics.lockLeftAt) || 0)),
      lockUntil: Math.max(0, Math.floor(Number(gateMetrics.lockUntil) || 0)),
      triggered: gateMetrics.triggered === true,
    }
    : (gateKind === 'detourSpreadGuard'
      ? {
        maxProtectedTabs: Math.max(1, Math.floor(Number(gateMetrics.maxProtectedTabs) || 1)),
        contextSwitchCount: Math.max(0, Math.floor(Number(gateMetrics.contextSwitchCount) || 0)),
        contextSwitchThreshold: Math.max(0, Math.floor(Number(gateMetrics.contextSwitchThreshold) || 0)),
        protectedTabCount: Math.max(0, Math.floor(Number(gateMetrics.protectedTabCount) || 0)),
        protectedTabHostCount: Math.max(0, Math.floor(Number(gateMetrics.protectedTabHostCount) || 0)),
        protectedTabThreshold: Math.max(0, Math.floor(Number(gateMetrics.protectedTabThreshold) || 0)),
        protectedTabIds: Array.isArray(gateMetrics.protectedTabs)
          ? gateMetrics.protectedTabs.map((entry) => Math.max(0, Math.floor(Number(entry?.tabId) || 0))).filter(Boolean)
          : [],
        consumedProtectedContextCount: Math.max(0, Math.floor(Number(gateMetrics.consumedProtectedContextCount) || 0)),
        protectedContextThreshold: Math.max(0, Math.floor(Number(gateMetrics.protectedContextThreshold) || 0)),
        hopSignal: gateMetrics.hopSignal === true,
        clusterSignal: gateMetrics.clusterSignal === true,
        protectedTabSignal: gateMetrics.protectedTabSignal === true,
        consumedContextSignal: gateMetrics.consumedContextSignal === true,
        triggered: gateMetrics.triggered === true,
      }
      : {
        entryDetected: gateMetrics.entryDetected === true,
        lastEnteredAt: Math.max(0, Math.floor(Number(gateMetrics.lastEnteredAt) || 0)),
        entryPassActive: gateMetrics.entryPassActive === true,
      });
  const holdDurationMs = Math.max(0, Math.floor(Number(gateMetrics.holdDurationMs) || 0));
  const severity = activeChildIds.length > 1 || gateKind === 'returnGuard'
    ? 'high'
    : (gateKind === 'detourSpreadGuard' ? 'mid' : 'low');
  const pressureSignals = Array.isArray(runtimeSnapshot?.plan?.trace?.pressureSignals)
    ? runtimeSnapshot.plan.trace.pressureSignals
    : [];
  const directTriggers = Array.isArray(runtimeSnapshot?.plan?.trace?.directTriggers)
    ? runtimeSnapshot.plan.trace.directTriggers
    : [];
  const interactionId = `${hostname}:${gateKind}:${Math.max(0, Math.floor(Number(now) || Date.now()))}`;

  return {
    message: {
      type: MESSAGE_TYPES.GATE_INTERVENTION_START,
      payload: {
        hostname,
        interactionId,
        gateKind,
        signalCode: GATE_INTERVENTION_SIGNAL_BY_CHILD[gateKind] || null,
        severity,
        planLevel: interventionLevel,
        activeChildIds,
        pressureSignals,
        directTriggers,
        holdDurationMs,
        holdUntil: holdDurationMs > 0 ? now + holdDurationMs : now,
        metrics: { ...gateMetrics },
        protectedTabs: Array.isArray(gateMetrics.protectedTabs)
          ? gateMetrics.protectedTabs
          : [],
        issuedAt: now,
      },
    },
    signature: JSON.stringify({
      gateKind,
      severity,
      activeChildIds,
      pressureSignals,
      directTriggers,
      // The return lock counts down to a fixed moment; its stable form is
      // lockUntil, not the remaining time.
      holdDurationMs: gateKind === 'returnGuard' ? 0 : holdDurationMs,
      metrics: stableMetrics,
      planLevel: interventionLevel,
    }),
    // Gate presentation is winner-take-all: only `gateKind` reaches the user.
    // The runners-up are reported so the intervention ledger can record that
    // they wanted to fire and were pre-empted.
    suppressedChildIds: Object.freeze(activeChildIds.slice(1)),
  };
}

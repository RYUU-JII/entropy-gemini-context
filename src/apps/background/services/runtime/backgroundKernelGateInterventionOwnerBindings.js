import { requireBackgroundKernelOwnerMethod } from './backgroundKernelOwnerMethods.js';

export function createGateInterventionOwnerBindings(trackingProtectionService) {
  return {
    applyGateInterventionDecision: requireBackgroundKernelOwnerMethod(
      trackingProtectionService,
      'applyGateInterventionDecision',
      'BACKGROUND_PROTECTION_GATE_DECISION_OWNER_REQUIRED',
    ),
    recordGateInterventionShown: requireBackgroundKernelOwnerMethod(
      trackingProtectionService,
      'recordGateInterventionShown',
      'BACKGROUND_PROTECTION_GATE_SHOWN_OWNER_REQUIRED',
    ),
  };
}

export function createGateInterventionSessionListOwner(gateInterventionSessionRepository) {
  const readGateInterventionSessionState = requireBackgroundKernelOwnerMethod(
    gateInterventionSessionRepository,
    'readState',
    'BACKGROUND_PROTECTION_SERVICE_GATE_SESSION_OWNER_REQUIRED',
  );

  return async function listGateInterventionSessions() {
    const state = await readGateInterventionSessionState();
    if (!state || typeof state !== 'object' || Array.isArray(state)) {
      throw new Error('BACKGROUND_PROTECTION_SERVICE_GATE_SESSION_STATE_INVALID');
    }
    if (!state.sessionsById || typeof state.sessionsById !== 'object' || Array.isArray(state.sessionsById)) {
      throw new Error('BACKGROUND_PROTECTION_SERVICE_GATE_SESSION_STATE_INVALID:sessionsById');
    }
    return Object.values(state.sessionsById);
  };
}

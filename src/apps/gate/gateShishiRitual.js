import { requireShishiConsumptionLevel } from '../../domains/protection/domain/shishiConsumptionLevel.js';

export const GATE_SHISHI_WAIT_MS = 10_000;

// The Gate owns entry timing. Water is only the visitor's immediate Leave action.
export function resolveGateShishiWaitMs(session) {
  if (!session || !['entryCheckpoint', 'returnGuard'].includes(session.gateKind)) {
    throw new Error('GATE_SHISHI_WAIT_SESSION_INVALID');
  }
  if (session.gateKind !== 'entryCheckpoint') return GATE_SHISHI_WAIT_MS;
  const intensity = requireShishiConsumptionLevel(session.metrics?.shishiIntensity);
  return GATE_SHISHI_WAIT_MS + intensity.waitExtensionMs;
}

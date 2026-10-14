import { resolveGateShishiWaitMs } from '../../../src/apps/gate/gateShishiRitual.js';
import { baselineShishiConsumptionLevel } from '../../../src/domains/protection/domain/shishiConsumptionLevel.js';

// Synthetic continue-only reaction: the same frozen foreground wait used by Gate.
export function shishiEntryDurationMs(extensionMs) {
  return resolveGateShishiWaitMs({ gateKind: 'entryCheckpoint', metrics: {
    shishiIntensity: { ...baselineShishiConsumptionLevel('wait_replay', 0, 0),
      status: 'adapted', band: 'high', waitExtensionMs: extensionMs, uncertaintyMs: 0 },
  } });
}

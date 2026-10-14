import { BUILD_INCLUDE_DEBUG_TOOLS } from '../build/releaseCapabilities.js';

// Local development observations only: no setting values or persisted state.
export const beginSettingsFlowTiming = () => BUILD_INCLUDE_DEBUG_TOOLS ? performance.now() : null;

export function endSettingsFlowTiming(phase, startedAtMs, details = {}) {
    if (startedAtMs === null) return;
    const durationMs = performance.now() - startedAtMs;
    console.debug('[SETTINGS_FLOW][timing]', JSON.stringify({ ...details, phase, durationMs,
        startedAtEpochMs: performance.timeOrigin + startedAtMs }));
}

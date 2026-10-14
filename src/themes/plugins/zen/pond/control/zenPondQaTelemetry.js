import {
    normalizeZenPondCanopyPreparationResearch,
} from '../contracts/zenPondCanopyPreparationResearch.js';

const DEBUG_TOOLS_ENABLED = typeof __ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__ !== 'undefined'
    ? __ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__
    : false;

// Explicit capture-only admission. No persistent setting and no production queries.
export function resolveZenPondQaTelemetry(search = globalThis.location?.search || '') {
    if (!DEBUG_TOOLS_ENABLED) return undefined;
    const params = new URLSearchParams(search);
    const canopyPreparation = normalizeZenPondCanopyPreparationResearch(
        params.has('entropy-qa-canopy-preparation')
            ? params.get('entropy-qa-canopy-preparation')
            : undefined,
    );
    if (canopyPreparation !== undefined && (
        params.get('entropy-qa-capture') !== 'zen-main-v1'
        || params.get('entropy-qa-gpu-timing') !== '1'
        || params.get('tab') !== 'main'
        || params.get('koi-state') !== 'full'
        || params.get('bonsai-state') !== 'full'
        || params.get('appearance-time') !== '12:00'
        || params.get('environment-clock') !== 'fixed'
        || params.get('weather') !== 'clear'
        || params.get('pond-effects') !== 'full'
    )) {
        throw new Error('ZEN_POND_CANOPY_PREPARATION_RESEARCH_REQUIRES_FULL_NOON_QA');
    }
    if (params.get('entropy-qa-capture') !== 'zen-main-v1'
        || params.get('entropy-qa-gpu-timing') !== '1') return undefined;
    return {
        enabled: true,
        sampleIntervalMs: 500,
        ...(canopyPreparation === undefined ? {} : { canopyPreparation }),
    };
}

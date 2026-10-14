import {
    normalizeZenPondCanopyPreparationResearch,
} from '../../../contracts/zenPondCanopyPreparationResearch.js';

const CANOPY_PREPARATION_RESEARCH_BUILD_ENABLED = (
    typeof __ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__ !== 'undefined'
        ? __ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__
        : false
);

// Explicit QA intervention, separate from the observation-only diagnostics.
// Pixi owns compilation, reflection, caching and disposal through its public API.
export const createZenCanopyPreparationResearch = ({
    renderer,
    canopyPreparation,
    telemetryEnabled,
    setStartupPhase,
    isBeforeFirstDraw,
} = {}) => {
    if (!CANOPY_PREPARATION_RESEARCH_BUILD_ENABLED) return null;
    if (normalizeZenPondCanopyPreparationResearch(canopyPreparation) === undefined) return null;
    if (telemetryEnabled !== true) {
        throw new Error('ZEN_POND_CANOPY_PREPARATION_RESEARCH_TELEMETRY_REQUIRED');
    }
    if (typeof renderer?.shader?.generateProgram !== 'function'
        || renderer.shader.renderer !== renderer) {
        throw new Error('ZEN_POND_CANOPY_PREPARATION_RESEARCH_RENDERER_REQUIRED');
    }
    if (typeof setStartupPhase !== 'function' || typeof isBeforeFirstDraw !== 'function') {
        throw new Error('ZEN_POND_CANOPY_PREPARATION_RESEARCH_STARTUP_SEAM_REQUIRED');
    }
    let attempted = false;
    return (shader) => {
        if (attempted) throw new Error('ZEN_POND_CANOPY_PREPARATION_RESEARCH_ALREADY_ATTEMPTED');
        if (isBeforeFirstDraw() !== true) {
            throw new Error('ZEN_POND_CANOPY_PREPARATION_RESEARCH_FIRST_DRAW_ALREADY_STARTED');
        }
        if (!shader || typeof shader !== 'object') {
            throw new Error('ZEN_POND_CANOPY_PREPARATION_RESEARCH_SHADER_REQUIRED');
        }
        attempted = true;
        setStartupPhase('canopy_pre_draw_prepare');
        try {
            renderer.shader.generateProgram(shader);
        } finally {
            setStartupPhase('first_frame_assets_prepare');
        }
    };
};

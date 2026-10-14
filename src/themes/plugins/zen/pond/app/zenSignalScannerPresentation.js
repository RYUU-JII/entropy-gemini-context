import {
    ZEN_KOI_PRESENTATION_MODE,
} from '../roster/zenKoiRosterFrame.js';
import {
    resolveZenSceneEnvironmentPolicy,
} from '../../runtime/environment/zenWorldWeatherAuthority.js';

export const ZEN_FIRST_VISION_POND_BIOTIC_SIGNAL = Object.freeze({
    engine: 'first_vision',
    source: 'zen_first_vision_presentation',
    stageId: 'full_bloom',
    flowerCount: 88,
    leafCount: 24,
    bloomRatio: 1,
    canopyDensity: 0.92,
    petalCapacity: 1,
    petalFallLimit: 0.92,
    seasonSpanDays: 7,
});

export const resolveZenPondProjectionFirstVisionPresentation = ({
    pondProjection = null,
} = {}) => {
    if (pondProjection !== null && typeof pondProjection === 'object') {
        return pondProjection.firstVisionPresentation === true;
    }
    return false;
};

export const resolveZenPondProjectionEnvironmentPolicy = ({
    pondProjection = null,
} = {}) => {
    if (pondProjection === null) {
        return resolveZenSceneEnvironmentPolicy({
            environmentMode: null,
        });
    }
    if (typeof pondProjection !== 'object' || Array.isArray(pondProjection)) {
        throw new Error('ZEN_POND_PROJECTION_INVALID');
    }
    return resolveZenSceneEnvironmentPolicy({
        environmentMode: pondProjection.environmentMode,
    });
};

export const resolveZenPondProjectionKoiPresentationMode = ({
    pondProjection = null,
} = {}) => {
    if (resolveZenPondProjectionFirstVisionPresentation({
        pondProjection,
    }) === true) {
        return ZEN_KOI_PRESENTATION_MODE.FIRST_VISION;
    }
    return ZEN_KOI_PRESENTATION_MODE.REALITY;
};

export const resolveZenPondProjectionDataIsolationMode = ({
    pondProjection = null,
    requestedDataIsolationMode = false,
} = {}) => {
    const firstVisionPresentation = resolveZenPondProjectionFirstVisionPresentation({
        pondProjection,
    });
    if (firstVisionPresentation) {
        if (pondProjection?.dataIsolationMode !== true) {
            throw new Error('ZEN_POND_FIRST_VISION_DATA_ISOLATION_REQUIRED');
        }
        return true;
    }
    return requestedDataIsolationMode === true;
};

export const resolveZenPresentationPondBioticSignal = ({
    pondProjection = null,
    pondBioticSignal = null,
} = {}) => (
    resolveZenPondProjectionFirstVisionPresentation({
        pondProjection,
    }) === true
        ? ZEN_FIRST_VISION_POND_BIOTIC_SIGNAL
        : pondBioticSignal
);

export default resolveZenPresentationPondBioticSignal;

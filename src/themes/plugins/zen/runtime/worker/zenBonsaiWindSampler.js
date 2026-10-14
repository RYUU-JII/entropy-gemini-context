import {
    resolveZenBonsaiWindState,
} from '../../model/zenBonsaiSceneEnvironment.js';

export const ZEN_BONSAI_WIND_SAMPLE_FRAME_STEP = 4;

export const resolveZenBonsaiWindSampleFrameStep = (value, fallback = ZEN_BONSAI_WIND_SAMPLE_FRAME_STEP) => {
    const numeric = Math.round(Number(value));
    return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
};

export const resolveZenBonsaiWindSampleFrame = (
    frameCount = 0,
    sampleFrameStep = ZEN_BONSAI_WIND_SAMPLE_FRAME_STEP,
) => {
    const step = resolveZenBonsaiWindSampleFrameStep(sampleFrameStep);
    const frame = Math.max(0, Math.floor(Number(frameCount) || 0));
    return Math.floor(frame / step) * step;
};

export const createZenBonsaiWindSampler = ({
    sampleFrameStep = ZEN_BONSAI_WIND_SAMPLE_FRAME_STEP,
} = {}) => {
    const defaultStep = resolveZenBonsaiWindSampleFrameStep(sampleFrameStep);
    let cachedSignature = '';
    let cachedStep = defaultStep;
    let cachedSampleFrame = -1;
    let cachedWindState = null;

    return {
        reset() {
            cachedSignature = '';
            cachedStep = defaultStep;
            cachedSampleFrame = -1;
            cachedWindState = null;
        },
        resolve({
            environmentState = null,
            environmentSignature = '',
            frameCount = 0,
            sampleFrameStep: nextSampleFrameStep = defaultStep,
        } = {}) {
            const step = resolveZenBonsaiWindSampleFrameStep(nextSampleFrameStep, defaultStep);
            const sampleFrame = resolveZenBonsaiWindSampleFrame(frameCount, step);
            const signature = typeof environmentSignature === 'string' && environmentSignature
                ? environmentSignature
                : 'env:none';
            if (
                cachedWindState
                && cachedSignature === signature
                && cachedStep === step
                && cachedSampleFrame === sampleFrame
            ) {
                return cachedWindState;
            }

            cachedWindState = resolveZenBonsaiWindState({
                environmentState,
                frameCount: sampleFrame,
            });
            cachedSignature = signature;
            cachedStep = step;
            cachedSampleFrame = sampleFrame;
            return cachedWindState;
        },
    };
};

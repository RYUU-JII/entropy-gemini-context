import {
    BUILD_INCLUDE_EXPERIMENT_TAB,
    BUILD_INCLUDE_ZEN_CLASSIC_EXPERIMENTS,
    BUILD_INCLUDE_ZEN_EXPERIMENTAL_WORKERS,
} from '@/platform/build/releaseCapabilities.js';

const resolveBoolean = (value) => value === true;

export const resolveZenClassicLabRuntimePolicy = ({
    experimental = false,
    surfaceActive = false,
    isCollectionMode = false,
    enableColdStart = false,
    coldStartRequested = false,
    classicLearningEnabled = true,
} = {}) => {
    const allowExperimentSurface = Boolean(
        BUILD_INCLUDE_EXPERIMENT_TAB
        && BUILD_INCLUDE_ZEN_CLASSIC_EXPERIMENTS
        && resolveBoolean(experimental)
        && resolveBoolean(surfaceActive),
    );
    const allowCollectionRuntime = Boolean(
        allowExperimentSurface
        && resolveBoolean(classicLearningEnabled)
        && resolveBoolean(isCollectionMode),
    );
    const allowExperimentalWorkers = Boolean(
        allowExperimentSurface
        && resolveBoolean(classicLearningEnabled)
        && BUILD_INCLUDE_ZEN_EXPERIMENTAL_WORKERS,
    );

    return Object.freeze({
        allowExperimentSurface,
        allowCollectionRuntime,
        allowLearningModelLoad: allowExperimentSurface && resolveBoolean(classicLearningEnabled),
        allowAbGeneration: allowCollectionRuntime,
        allowAbPreviewRender: allowCollectionRuntime,
        allowColdStart: Boolean(
            allowCollectionRuntime
            && allowExperimentalWorkers
            && resolveBoolean(enableColdStart)
            && resolveBoolean(coldStartRequested),
        ),
        allowExperimentalWorkers,
        allowPrewarm: false,
    });
};

export default resolveZenClassicLabRuntimePolicy;

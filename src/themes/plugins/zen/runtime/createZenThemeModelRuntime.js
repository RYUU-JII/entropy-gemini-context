import { createZenThemeModelState } from '../state/ZenThemeModelState.js';

export const createZenModelSaveCoordinator = () => {
    const pendingSaveInstances = new Set();

    return {
        registerPending(instance) {
            if (instance) {
                pendingSaveInstances.add(instance);
            }
        },
        unregisterPending(instance) {
            if (instance) {
                pendingSaveInstances.delete(instance);
            }
        },
        flushPending() {
            [...pendingSaveInstances].forEach((instance) => {
                instance?.flushSave?.();
            });
        },
    };
};

export const createZenThemeModelRuntime = ({
    modelStateStore = null,
    zenThemeModelState = null,
    modelSaveCoordinator = null,
    profileGenerationLease = null,
} = {}) => {
    const resolvedZenThemeModelState = zenThemeModelState || (
        modelStateStore?.zenThemeModelState
        || (
            modelStateStore?.getValueForBootstrap
                ? modelStateStore
                : (
                    modelStateStore
                        ? createZenThemeModelState({
                            modelStateStore,
                            profileGenerationLease,
                        })
                        : null
                )
        )
    );
    if (!resolvedZenThemeModelState) {
        throw new Error('ZEN_THEME_MODEL_RUNTIME_OWNER_REQUIRED');
    }
    return {
        modelStateStore: resolvedZenThemeModelState.modelStateStore || modelStateStore,
        zenThemeModelState: resolvedZenThemeModelState,
        modelSaveCoordinator: modelSaveCoordinator || createZenModelSaveCoordinator(),
    };
};

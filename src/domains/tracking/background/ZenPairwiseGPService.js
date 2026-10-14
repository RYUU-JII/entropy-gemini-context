import { SakuraAdditivePairwiseGPModel } from '@/themes/plugins/zen/api/learning.js';
import { createZenThemeModelRuntime } from '@/themes/plugins/zen/runtime/createZenThemeModelRuntime.js';

export function createZenPairwiseGPService(options = {}) {
    const zenThemeModelRuntime = createZenThemeModelRuntime({
        modelStateStore: options?.modelStateStore,
        zenThemeModelState: options?.zenThemeModelState,
        modelSaveCoordinator: options?.modelSaveCoordinator,
    });
    const { zenThemeModelState, modelSaveCoordinator } = zenThemeModelRuntime;
    const model = new SakuraAdditivePairwiseGPModel({
        learningKeyspaceProfile: options?.learningKeyspaceProfile,
        zenThemeModelState,
        modelSaveCoordinator,
    });
    let loadPromise = null;
    let disposed = false;

    const requireActive = () => {
        if (disposed) {
            throw new Error('ZEN_PAIRWISE_GP_SERVICE_PROFILE_GENERATION_DISPOSED');
        }
    };

    const ensureLoaded = async () => {
        requireActive();
        if (loadPromise) {
            return loadPromise;
        }
        loadPromise = model.load()
            .catch((error) => {
                loadPromise = null;
                throw error;
            });
        return loadPromise;
    };

    return {
        ensureLoaded,
        async trainPair(winnerInput, loserInput, trainingOptions = {}) {
            requireActive();
            await ensureLoaded();
            const result = model.trainPair(winnerInput, loserInput, trainingOptions);
            return {
                result,
                meta: model.getMeta(),
            };
        },
        async predictDetailed(input = null) {
            requireActive();
            await ensureLoaded();
            return model.predictDetailed(input);
        },
        async sampleUtility(input = null) {
            requireActive();
            await ensureLoaded();
            return model.sampleUtility(input);
        },
        async getMeta() {
            requireActive();
            await ensureLoaded();
            return model.getMeta();
        },
        async reset() {
            requireActive();
            await ensureLoaded();
            model.reset();
            return model.getMeta();
        },
        disposeForProfileMutation() {
            if (disposed) return Object.freeze({ disposed: true, reused: true });
            disposed = true;
            model.discardPendingSaveForProfileMutation();
            return Object.freeze({ disposed: true, reused: false });
        },
    };
}

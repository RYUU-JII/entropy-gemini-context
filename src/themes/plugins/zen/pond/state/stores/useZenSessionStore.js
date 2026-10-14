import { create } from 'zustand';
import {
    createSceneGenerationKey,
    readSceneGenerationKey,
    writeSceneGenerationKey,
} from '../../storage/repositories/zenSessionRepository.js';
import { hardResetPondState } from '../../storage/repositories/zenPondResetRepository.js';

const resolveSceneKey = () => readSceneGenerationKey();
let hardResetPromise = null;

const useZenSessionStore = create((set, get) => ({
    sceneGenerationKey: resolveSceneKey(),
    hardResetToken: 0,
    hardResetStatus: 'idle',
    hardResetError: null,
    sceneRerollRevision: 0,

    setSceneGenerationKey: (candidate) => {
        const next = writeSceneGenerationKey(candidate);
        set({ sceneGenerationKey: next });
        return next;
    },

    rerollSceneGeneration: () => {
        const next = writeSceneGenerationKey(createSceneGenerationKey());
        set((state) => ({
            sceneGenerationKey: next,
            sceneRerollRevision: state.sceneRerollRevision + 1,
        }));
        return next;
    },

    requestHardReset: () => {
        if (hardResetPromise) return hardResetPromise;
        set({ hardResetStatus: 'resetting', hardResetError: null });
        hardResetPromise = Promise.resolve().then(hardResetPondState).then(() => {
            const nextToken = get().hardResetToken + 1;
            set({ hardResetToken: nextToken, hardResetStatus: 'complete' });
            return { status: 'complete', token: nextToken };
        }).catch((error) => {
            const message = String(error?.message || error);
            set({ hardResetStatus: 'failed', hardResetError: message });
            return { status: 'failed', error: message };
        }).finally(() => { hardResetPromise = null; });
        return hardResetPromise;
    },
}));

export {
    useZenSessionStore,
};

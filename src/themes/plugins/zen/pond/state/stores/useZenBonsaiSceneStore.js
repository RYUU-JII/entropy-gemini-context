import { create } from 'zustand';
import {
    buildZenBonsaiPondBioticSignalSignature,
    normalizeZenBonsaiPondBioticSignal,
} from '../../../model/zenBonsaiPondBioticSignal.js';

const useZenBonsaiSceneStore = create((set, get) => ({
    pondBioticSignal: null,
    pondBioticSignalSignature: 'zen_bonsai_pond_biotic_signal:none',
    revision: 0,

    publishPondBioticSignal: (candidate) => {
        const next = normalizeZenBonsaiPondBioticSignal(candidate);
        if (!next) {
            return get().pondBioticSignal;
        }
        const nextSignature = buildZenBonsaiPondBioticSignalSignature(next);
        if (nextSignature === get().pondBioticSignalSignature) {
            return get().pondBioticSignal;
        }
        set((state) => ({
            pondBioticSignal: next,
            pondBioticSignalSignature: nextSignature,
            revision: state.revision + 1,
        }));
        return next;
    },

    clearPondBioticSignal: () => {
        if (get().pondBioticSignal === null) {
            return null;
        }
        set((state) => ({
            pondBioticSignal: null,
            pondBioticSignalSignature: 'zen_bonsai_pond_biotic_signal:none',
            revision: state.revision + 1,
        }));
        return null;
    },
}));

export {
    useZenBonsaiSceneStore,
};

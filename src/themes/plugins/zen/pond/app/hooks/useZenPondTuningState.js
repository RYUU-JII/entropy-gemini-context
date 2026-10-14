import { useShallow } from 'zustand/react/shallow';
import { useZenSettingsStore } from '../../state/stores/useZenSettingsStore.js';

const useZenPondTuningState = () => {
    return useZenSettingsStore(useShallow((state) => ({
        tuning: state.tuning,
        setTuning: state.setTuning,
        resetTuning: state.resetTuning,
    })));
};

export {
    useZenPondTuningState,
};

import { useZenClassicExperimentControls } from './useZenClassicExperimentControls';
import { useZenBonsaiAuthoringDraftState } from '../../bonsai/runtime/useZenBonsaiAuthoringDraftState.js';

export function useZenClassicWorkspaceState() {
    const scratchpadState = useZenBonsaiAuthoringDraftState();
    const experimentControls = useZenClassicExperimentControls({
        treeType: scratchpadState.treeType,
    });

    return {
        ...scratchpadState,
        ...experimentControls,
    };
}

export default useZenClassicWorkspaceState;

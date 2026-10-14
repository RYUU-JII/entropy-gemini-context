import {
    createSakuraTrunkScaffoldGenerator,
} from './sakuraTrunkScaffoldGenerator';

export const createSakuraStructuralBranchGenerator = (context = {}) => {
    const {
        generationTelemetry,
        generateTrunkScaffold,
    } = createSakuraTrunkScaffoldGenerator(context);

    return (state = {}) => {
        const { root } = generateTrunkScaffold(state);
        const telemetrySnapshot = generationTelemetry.snapshot();
        if (telemetrySnapshot) {
            root.generationTelemetry = telemetrySnapshot;
        }
        return root;
    };
};

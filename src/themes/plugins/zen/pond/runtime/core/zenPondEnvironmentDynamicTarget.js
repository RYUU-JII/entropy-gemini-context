import {
    projectZenWorldEnvironmentRuntimeTarget,
} from '../../../runtime/environment/zenWorldEnvironmentRuntimeTarget.js';
import {
    requireZenWorldEnvironmentSnapshot,
} from '../../../runtime/environment/zenWorldEnvironmentSnapshot.js';

export const projectZenPondEnvironmentDynamicTarget = (worldSnapshot) => {
    const snapshot = requireZenWorldEnvironmentSnapshot(worldSnapshot);
    return Object.freeze(
        projectZenWorldEnvironmentRuntimeTarget(snapshot.environment),
    );
};

export default projectZenPondEnvironmentDynamicTarget;

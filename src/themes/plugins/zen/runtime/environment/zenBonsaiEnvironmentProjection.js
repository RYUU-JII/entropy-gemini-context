import {
    requireZenWorldEnvironmentSnapshot,
} from './zenWorldEnvironmentSnapshot.js';
import {
    projectZenWorldEnvironmentRuntimeTarget,
} from './zenWorldEnvironmentRuntimeTarget.js';
import {
    resolveZenBonsaiEnvironmentBakeSignature,
    resolveZenBonsaiEnvironmentSignature,
} from '../zenBonsaiEnvironmentSignatures.js';

export const ZEN_BONSAI_ENVIRONMENT_PROJECTION_CONTRACT = 'zen.bonsai.environment.projection';
export const ZEN_BONSAI_ENVIRONMENT_PROJECTION_VERSION = 1;

export const projectZenBonsaiEnvironment = (worldSnapshot) => {
    const snapshot = requireZenWorldEnvironmentSnapshot(worldSnapshot);
    const dynamicTarget = Object.freeze(
        projectZenWorldEnvironmentRuntimeTarget(snapshot.environment),
    );
    return Object.freeze({
        contract: ZEN_BONSAI_ENVIRONMENT_PROJECTION_CONTRACT,
        version: ZEN_BONSAI_ENVIRONMENT_PROJECTION_VERSION,
        sourceAuthorityRevision: snapshot.identity.authorityRevision,
        sourceSampleId: snapshot.identity.sampleId,
        dynamicTarget,
        dynamicSignature: resolveZenBonsaiEnvironmentSignature(dynamicTarget),
        bakeSignature: resolveZenBonsaiEnvironmentBakeSignature(dynamicTarget),
    });
};

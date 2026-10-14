import {
    readZenWorkspaceMode,
    resolveZenWorkspaceMode,
    writeZenWorkspaceMode,
    ZEN_WORKSPACE_MODE,
} from '../../state/ZenWorkspaceState.js';
import {
    ZEN_BONSAI_MODEL_CATALOG,
    ZEN_BONSAI_MODEL_IDS,
} from '../../model/ZenBonsaiModelCatalog.js';

export function loadZenCoreStatusVNext() {
    return import('../../widgets/core/ZenCoreStatusVNext.jsx');
}

export const zenCoreStatusDevelopmentWorkspace = Object.freeze({
    classicMode: ZEN_WORKSPACE_MODE.CLASSIC,
    researchMode: ZEN_WORKSPACE_MODE.VNEXT,
    tabs: Object.freeze([
        Object.freeze({
            id: ZEN_WORKSPACE_MODE.CLASSIC,
            label: ZEN_BONSAI_MODEL_CATALOG[ZEN_BONSAI_MODEL_IDS.PLUME].displayName,
            detail: 'Production bonsai workspace',
        }),
        Object.freeze({
            id: ZEN_WORKSPACE_MODE.VNEXT,
            label: ZEN_BONSAI_MODEL_CATALOG[ZEN_BONSAI_MODEL_IDS.VNEXT].displayName,
            detail: 'Independent research engine',
        }),
    ]),
    resolveMode: resolveZenWorkspaceMode,
    readMode: readZenWorkspaceMode,
    writeMode: writeZenWorkspaceMode,
});

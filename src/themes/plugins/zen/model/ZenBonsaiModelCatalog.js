export const ZEN_BONSAI_MODEL_IDS = Object.freeze({
    PLUME: 'plume',
    G15_4: 'g15_4',
    CLASSIC2: 'classic2',
    CLASSIC: 'classic',
    VNEXT: 'vnext',
});

export const ZEN_BONSAI_MODEL_SURFACES = Object.freeze({
    HOME: 'home',
    EXPERIMENT: 'experiment',
    RESEARCH: 'research',
});

export const ZEN_BONSAI_MODEL_ROLES = Object.freeze({
    PRODUCTION: 'production',
    COMPARISON: 'comparison',
    RESEARCH: 'research',
});

export const ZEN_BONSAI_MODEL_CATALOG = Object.freeze({
    [ZEN_BONSAI_MODEL_IDS.PLUME]: Object.freeze({
        id: ZEN_BONSAI_MODEL_IDS.PLUME,
        role: ZEN_BONSAI_MODEL_ROLES.PRODUCTION,
        displayName: 'Main · Plume Sakura',
        main: true,
        experimentDefault: true,
        admittedSurfaces: Object.freeze([
            ZEN_BONSAI_MODEL_SURFACES.HOME,
            ZEN_BONSAI_MODEL_SURFACES.EXPERIMENT,
        ]),
    }),
    [ZEN_BONSAI_MODEL_IDS.G15_4]: Object.freeze({
        id: ZEN_BONSAI_MODEL_IDS.G15_4,
        role: ZEN_BONSAI_MODEL_ROLES.COMPARISON,
        displayName: 'Comparison · G15.4 Sakura',
        main: false,
        admittedSurfaces: Object.freeze([
            ZEN_BONSAI_MODEL_SURFACES.HOME,
            ZEN_BONSAI_MODEL_SURFACES.EXPERIMENT,
        ]),
    }),
    [ZEN_BONSAI_MODEL_IDS.CLASSIC2]: Object.freeze({
        id: ZEN_BONSAI_MODEL_IDS.CLASSIC2,
        role: ZEN_BONSAI_MODEL_ROLES.COMPARISON,
        displayName: 'Comparison · Classic2',
        main: false,
        admittedSurfaces: Object.freeze([
            ZEN_BONSAI_MODEL_SURFACES.HOME,
            ZEN_BONSAI_MODEL_SURFACES.EXPERIMENT,
        ]),
    }),
    [ZEN_BONSAI_MODEL_IDS.CLASSIC]: Object.freeze({
        id: ZEN_BONSAI_MODEL_IDS.CLASSIC,
        role: ZEN_BONSAI_MODEL_ROLES.COMPARISON,
        displayName: 'Comparison · Classic',
        main: false,
        experimentOnly: true,
        admittedSurfaces: Object.freeze([
            ZEN_BONSAI_MODEL_SURFACES.EXPERIMENT,
        ]),
    }),
    [ZEN_BONSAI_MODEL_IDS.VNEXT]: Object.freeze({
        id: ZEN_BONSAI_MODEL_IDS.VNEXT,
        role: ZEN_BONSAI_MODEL_ROLES.RESEARCH,
        displayName: 'Research · vNext',
        main: false,
        researchOnly: true,
        admittedSurfaces: Object.freeze([
            ZEN_BONSAI_MODEL_SURFACES.RESEARCH,
        ]),
    }),
});

const DEFAULT_MODEL_BY_SURFACE = Object.freeze({
    [ZEN_BONSAI_MODEL_SURFACES.HOME]: ZEN_BONSAI_MODEL_IDS.PLUME,
    [ZEN_BONSAI_MODEL_SURFACES.EXPERIMENT]: ZEN_BONSAI_MODEL_IDS.PLUME,
    [ZEN_BONSAI_MODEL_SURFACES.RESEARCH]: ZEN_BONSAI_MODEL_IDS.VNEXT,
});

const describeInvalidValue = (value) => (
    typeof value === 'string' && value.trim() ? value.trim() : 'missing'
);

export const requireZenBonsaiModelSurface = (surface) => {
    if (Object.prototype.hasOwnProperty.call(DEFAULT_MODEL_BY_SURFACE, surface)) {
        return surface;
    }
    throw new Error(`ZEN_BONSAI_MODEL_SURFACE_INVALID:${describeInvalidValue(surface)}`);
};

export const requireZenBonsaiModelId = (modelId) => {
    if (Object.prototype.hasOwnProperty.call(ZEN_BONSAI_MODEL_CATALOG, modelId)) {
        return modelId;
    }
    throw new Error(`ZEN_BONSAI_MODEL_ID_INVALID:${describeInvalidValue(modelId)}`);
};

export const getZenBonsaiModelDefinition = (modelId) => (
    ZEN_BONSAI_MODEL_CATALOG[requireZenBonsaiModelId(modelId)]
);

// These tools evaluate the Classic latent graph. Plume has its own anatomy;
// selecting it never authorizes training that different graph on its behalf.
export const supportsZenBonsaiClassicLearning = (modelId) => (
    [ZEN_BONSAI_MODEL_IDS.G15_4, ZEN_BONSAI_MODEL_IDS.CLASSIC2, ZEN_BONSAI_MODEL_IDS.CLASSIC]
        .includes(requireZenBonsaiModelId(modelId))
);

export const resolveZenBonsaiDefaultModelId = (surface) => (
    DEFAULT_MODEL_BY_SURFACE[requireZenBonsaiModelSurface(surface)]
);

export const requireZenBonsaiModelAdmission = ({
    surface,
    modelId,
} = {}) => {
    const resolvedSurface = requireZenBonsaiModelSurface(surface);
    const resolvedModelId = requireZenBonsaiModelId(modelId);
    const definition = ZEN_BONSAI_MODEL_CATALOG[resolvedModelId];
    if (!definition.admittedSurfaces.includes(resolvedSurface)) {
        throw new Error(`ZEN_BONSAI_MODEL_SURFACE_ADMISSION_INVALID:${resolvedSurface}:${resolvedModelId}`);
    }
    return resolvedModelId;
};

export const resolveZenBonsaiModelForSurface = ({
    surface,
    requestedModel,
} = {}) => {
    const resolvedSurface = requireZenBonsaiModelSurface(surface);
    const modelId = requestedModel === undefined
        ? resolveZenBonsaiDefaultModelId(resolvedSurface)
        : requireZenBonsaiModelId(requestedModel);
    return requireZenBonsaiModelAdmission({
        surface: resolvedSurface,
        modelId,
    });
};

export const listZenBonsaiModelsForSurface = (surface) => {
    const resolvedSurface = requireZenBonsaiModelSurface(surface);
    return Object.freeze(Object.values(ZEN_BONSAI_MODEL_CATALOG).filter(
        (definition) => definition.admittedSurfaces.includes(resolvedSurface),
    ));
};

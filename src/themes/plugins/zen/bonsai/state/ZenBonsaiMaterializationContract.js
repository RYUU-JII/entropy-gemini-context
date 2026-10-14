const MATERIALIZATION_KEY_INPUT_FIELDS = Object.freeze([
    'inputSignature',
    'evidenceSignature',
    'lifeSignature',
    'presentationMode',
    'modelId',
    'modelMode',
    'modelTopologyFingerprint',
    'modelIdentityFingerprint',
    'modelCommitSignature',
    'modelStateRevision',
]);

const isPlainObject = (value) => (
    value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
);

const canonicalizeJsonValue = (value, {
    ancestors,
    path,
    arrayEntry = false,
} = {}) => {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            throw new Error(`ZEN_BONSAI_MATERIALIZATION_INPUT_NUMBER_INVALID:${path}`);
        }
        return Object.is(value, -0) ? 0 : value;
    }
    if (value === undefined) {
        return arrayEntry ? null : undefined;
    }
    if (typeof value !== 'object') {
        throw new Error(`ZEN_BONSAI_MATERIALIZATION_INPUT_VALUE_INVALID:${path}`);
    }
    if (ancestors.has(value)) {
        throw new Error(`ZEN_BONSAI_MATERIALIZATION_INPUT_CYCLE:${path}`);
    }

    ancestors.add(value);
    try {
        if (Array.isArray(value)) {
            return value.map((entry, index) => canonicalizeJsonValue(entry, {
                ancestors,
                path: `${path}[${index}]`,
                arrayEntry: true,
            }));
        }
        if (!isPlainObject(value)) {
            throw new Error(`ZEN_BONSAI_MATERIALIZATION_INPUT_OBJECT_INVALID:${path}`);
        }
        const canonical = {};
        Object.keys(value)
            .sort()
            .forEach((key) => {
                const normalized = canonicalizeJsonValue(value[key], {
                    ancestors,
                    path: `${path}.${key}`,
                });
                if (normalized !== undefined) {
                    canonical[key] = normalized;
                }
            });
        return canonical;
    } finally {
        ancestors.delete(value);
    }
};

const requireToken = (value, field) => {
    if (typeof value !== 'string' || !value.trim() || value.trim() !== value) {
        throw new Error(`ZEN_BONSAI_MATERIALIZATION_KEY_TOKEN_INVALID:${field}`);
    }
    return value;
};

export const buildZenBonsaiMaterializationInputSignature = (input = null) => {
    const canonical = canonicalizeJsonValue(input, {
        ancestors: new Set(),
        path: 'input',
    });
    return `zen_bonsai_materialization_input_v1:${JSON.stringify(canonical)}`;
};

export const requireZenBonsaiMaterializationKeyInput = (candidate = null) => {
    if (!isPlainObject(candidate)) {
        throw new Error('ZEN_BONSAI_MATERIALIZATION_KEY_INPUT_REQUIRED');
    }
    const actualFields = Object.keys(candidate).sort();
    const expectedFields = [...MATERIALIZATION_KEY_INPUT_FIELDS].sort();
    if (
        actualFields.length !== expectedFields.length
        || expectedFields.some((field, index) => field !== actualFields[index])
    ) {
        throw new Error('ZEN_BONSAI_MATERIALIZATION_KEY_INPUT_SHAPE_INVALID');
    }
    if (
        !Number.isSafeInteger(candidate.modelStateRevision)
        || candidate.modelStateRevision < 1
    ) {
        throw new Error('ZEN_BONSAI_MATERIALIZATION_KEY_STATE_REVISION_INVALID');
    }
    return Object.freeze({
        inputSignature: requireToken(candidate.inputSignature, 'inputSignature'),
        evidenceSignature: requireToken(candidate.evidenceSignature, 'evidenceSignature'),
        lifeSignature: requireToken(candidate.lifeSignature, 'lifeSignature'),
        presentationMode: requireToken(candidate.presentationMode, 'presentationMode'),
        modelId: requireToken(candidate.modelId, 'modelId'),
        modelMode: requireToken(candidate.modelMode, 'modelMode'),
        modelTopologyFingerprint: requireToken(
            candidate.modelTopologyFingerprint,
            'modelTopologyFingerprint',
        ),
        modelIdentityFingerprint: requireToken(
            candidate.modelIdentityFingerprint,
            'modelIdentityFingerprint',
        ),
        modelCommitSignature: requireToken(
            candidate.modelCommitSignature,
            'modelCommitSignature',
        ),
        modelStateRevision: candidate.modelStateRevision,
    });
};

export const buildZenBonsaiMaterializationKey = (input = null) => {
    const canonical = requireZenBonsaiMaterializationKeyInput(input);
    return `zen_bonsai_materialization_v1:${JSON.stringify(canonical)}`;
};

export default buildZenBonsaiMaterializationInputSignature;

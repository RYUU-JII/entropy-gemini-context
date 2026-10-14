const DEFAULT_LATENT_DIGITS = 5;
const DEFAULT_NUMERIC_DIGITS = 4;
const DEFAULT_EXPOSURE_WINDOW_SIZE = 96;

const isPlainObject = (value) => Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value),
);

const safeString = (value, fallback = null) => (
    typeof value === 'string' && value.trim()
        ? value.trim()
        : fallback
);

const finiteNumber = (value, fallback = null) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};
const roundNumber = (value, digits = DEFAULT_NUMERIC_DIGITS) => {
    const numeric = finiteNumber(value, null);
    return numeric === null ? null : Number(numeric.toFixed(digits));
};

const stableHash = (value = '') => {
    const source = String(value);
    let hash = 0x811c9dc5;
    for (let index = 0; index < source.length; index += 1) {
        hash ^= source.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
};

const stableSerialize = (value = null) => {
    if (Array.isArray(value)) {
        return `[${value.map((entry) => stableSerialize(entry)).join(',')}]`;
    }
    if (isPlainObject(value)) {
        return `{${Object.keys(value)
            .sort()
            .map((key) => `${key}:${stableSerialize(value[key])}`)
            .join(',')}}`;
    }
    if (typeof value === 'number') {
        return Number.isFinite(value) ? String(roundNumber(value, 6)) : 'null';
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }
    if (typeof value === 'string') {
        return JSON.stringify(value);
    }
    return value === null || value === undefined ? 'null' : JSON.stringify(value);
};

const resolveLatent = (candidate = null) => {
    if (isPlainObject(candidate?.modelInput?.latent)) {
        return candidate.modelInput.latent;
    }
    if (isPlainObject(candidate?.latent)) {
        return candidate.latent;
    }
    if (isPlainObject(candidate?.A?.latent) || isPlainObject(candidate?.B?.latent)) {
        return null;
    }
    return null;
};

const buildLatentSignature = (latent = null) => {
    if (!isPlainObject(latent)) {
        return 'latent:none';
    }
    const entries = Object.keys(latent)
        .sort()
        .map((key) => {
            const numeric = finiteNumber(latent[key], null);
            return numeric === null
                ? null
                : `${key}:${roundNumber(numeric, DEFAULT_LATENT_DIGITS)}`;
        })
        .filter(Boolean);
    if (!entries.length) {
        return 'latent:none';
    }
    return `latent:${entries.length}:${stableHash(entries.join('|'))}`;
};

const buildRenderProvenanceSignature = (render = null) => {
    if (!isPlainObject(render)) {
        return 'render:none';
    }
    const stageSignature = isPlainObject(render.stage)
        ? stableHash(stableSerialize(render.stage))
        : 'no_stage';
    const parts = [
        `src:${safeString(render.source, 'unknown')}`,
        `semantics:${safeString(render.generationSemantics, 'unknown_semantics')}`,
        `seed:${roundNumber(render.seed, 0) ?? 'na'}`,
        `topo:${roundNumber(render.topologySeed, 0) ?? 'na'}`,
        `offset:${roundNumber(render.stageSeedOffset, 0) ?? 'na'}`,
        `idx:${roundNumber(render.stageProfileIndex, 0) ?? 'na'}`,
        `id:${safeString(render.stageProfileId, 'na')}`,
        `h:${roundNumber(render.topologyReferenceHeight, 3) ?? 'na'}`,
        `stage:${stageSignature}`,
    ];
    const spineGuideConditionId = safeString(render.spineGuideConditionId, null);
    if (spineGuideConditionId) {
        parts.push(
            `spineCondition:${spineGuideConditionId}`,
            `spineGuide:${safeString(render.spineGuideId, 'unknown_guide')}`,
            `spineAdherence:${roundNumber(render.spineGuideAdherence, 6) ?? 'na'}`,
        );
    }
    const spineReferenceFamilyConditionId = safeString(
        render.spineReferenceFamilyConditionId,
        null,
    );
    if (spineReferenceFamilyConditionId) {
        parts.push(
            `spineFamilyCondition:${spineReferenceFamilyConditionId}`,
            `spineFamily:${safeString(render.spineReferenceFamilyId, 'unknown_family')}`,
            `spineReferenceGuide:${safeString(render.spineReferenceGuideId, 'unknown_guide')}`,
            `spineLikeness:${roundNumber(render.spineReferenceLikeness, 6) ?? 'na'}`,
            `spineVariationPolicy:${safeString(
                render.spineReferenceVariationPolicyId,
                'unknown_policy',
            )}`,
            `spineVariantGuide:${safeString(
                render.spineReferenceVariantGuideId,
                'unknown_variant',
            )}`,
        );
    }
    const formComposition = isPlainObject(render.formComposition)
        ? render.formComposition
        : null;
    if (formComposition) {
        parts.push(
            `formPlan:${safeString(formComposition.planId, 'unknown_plan')}`,
            `form:${safeString(formComposition.formId, 'unknown_form')}`,
            `formVariant:${roundNumber(formComposition.variantSeed, 0) ?? 'na'}`,
        );
    }
    return `render:${stableHash(parts.join('|'))}`;
};

export const buildABRenderSignature = (candidate = null) => {
    const explicit = safeString(candidate?.renderSignature || candidate?.render?.signature, null);
    if (explicit) {
        return explicit;
    }
    return buildRenderProvenanceSignature(candidate?.render);
};

export const buildABCandidateSignature = (candidate = null) => {
    if (!isPlainObject(candidate)) {
        return null;
    }
    const explicit = safeString(candidate.signature || candidate.candidateSignature, null);
    if (explicit) {
        return explicit;
    }
    const seed = roundNumber(candidate.seed, 0);
    const latentSignature = buildLatentSignature(resolveLatent(candidate));
    const renderSignature = buildABRenderSignature(candidate);
    const generationSemantics = safeString(
        candidate?.generationSemantics || candidate?.render?.generationSemantics,
        'unknown_semantics',
    );
    const phenotypeSignature = isPlainObject(candidate.phenotype)
        ? `phenotype:${stableHash(stableSerialize(candidate.phenotype))}`
        : 'phenotype:none';
    return [
        'candidate:v1',
        `semantics:${generationSemantics}`,
        `seed:${seed ?? 'na'}`,
        latentSignature,
        renderSignature,
        phenotypeSignature,
    ].join('#');
};

export const buildABPairRenderSignature = (pair = null) => {
    const aRender = buildABRenderSignature(pair?.A);
    const bRender = buildABRenderSignature(pair?.B);
    return `pair_render:v1#${[aRender, bRender].sort().join('#')}`;
};

export const buildABPairSignature = (pair = null) => {
    const explicit = safeString(pair?.pairSignature || pair?.generationContext?.pairSignature, null);
    if (explicit) {
        return explicit;
    }
    const aSignature = buildABCandidateSignature(pair?.A);
    const bSignature = buildABCandidateSignature(pair?.B);
    if (!aSignature || !bSignature) {
        return null;
    }
    const pairType = safeString(pair?.generationContext?.pairType, 'unknown_pair');
    const latentSpace = safeString(pair?.generationContext?.latentSpace, 'unknown_space');
    const keyspace = safeString(pair?.generationContext?.learningKeyspaceProfile, 'default');
    const generationSemantics = safeString(
        pair?.generationContext?.generationSemantics,
        'unknown_semantics',
    );
    const parts = [
        'pair:v1',
        `semantics:${generationSemantics}`,
        `type:${pairType}`,
        `space:${latentSpace}`,
        `keyspace:${keyspace}`,
    ];
    const spineGuideConditionId = safeString(
        pair?.generationContext?.spineGuideConditionId,
        null,
    );
    if (spineGuideConditionId) {
        parts.push(
            `spineCondition:${spineGuideConditionId}`,
            `spineGuide:${safeString(pair?.generationContext?.spineGuideId, 'unknown_guide')}`,
            `spineAdherence:${roundNumber(
                pair?.generationContext?.spineGuideAdherence,
                6,
            ) ?? 'na'}`,
        );
    }
    const spineReferenceFamilyConditionId = safeString(
        pair?.generationContext?.spineReferenceFamilyConditionId,
        null,
    );
    if (spineReferenceFamilyConditionId) {
        parts.push(
            `spineFamilyCondition:${spineReferenceFamilyConditionId}`,
            `spineFamily:${safeString(
                pair?.generationContext?.spineReferenceFamilyId,
                'unknown_family',
            )}`,
            `spineReferenceGuide:${safeString(
                pair?.generationContext?.spineReferenceGuideId,
                'unknown_guide',
            )}`,
            `spineLikeness:${roundNumber(
                pair?.generationContext?.spineReferenceLikeness,
                6,
            ) ?? 'na'}`,
            `spineVariationPolicy:${safeString(
                pair?.generationContext?.spineReferenceVariationPolicyId,
                'unknown_policy',
            )}`,
            `spineVariantGuide:${safeString(
                pair?.generationContext?.spineReferenceVariantGuideId,
                'unknown_variant',
            )}`,
        );
    }
    const formQuestionPolicyId = safeString(
        pair?.generationContext?.formQuestionPolicyId,
        null,
    );
    if (formQuestionPolicyId) {
        parts.push(
            `formQuestionPolicy:${formQuestionPolicyId}`,
            `formRelation:${safeString(
                pair?.generationContext?.formQuestionRelation,
                'unknown_relation',
            )}`,
            `formA:${safeString(pair?.generationContext?.targetFormIdA, 'unknown_form')}`,
            `formB:${safeString(pair?.generationContext?.targetFormIdB, 'unknown_form')}`,
            `formVariantA:${roundNumber(
                pair?.generationContext?.formVariantSeedA,
                0,
            ) ?? 'na'}`,
            `formVariantB:${roundNumber(
                pair?.generationContext?.formVariantSeedB,
                0,
            ) ?? 'na'}`,
        );
    }
    parts.push(...[aSignature, bSignature].sort());
    return parts.join('#');
};

const isAnchorEntry = (entry = {}) => (
    String(entry?.query?.kind || entry?.generationContext?.queryKind || '')
        .trim()
        .toLowerCase() === 'anchor'
);

export const readABPairSignatureFromHistory = (entry = null) => {
    const explicit = safeString(entry?.pairSignature || entry?.generationContext?.pairSignature, null);
    if (explicit) {
        return explicit;
    }
    return buildABPairSignature({
        A: entry?.A,
        B: entry?.B,
        generationContext: entry?.generationContext,
    });
};

export const buildABPairExposureLedger = (
    abHistory = [],
    {
        windowSize = DEFAULT_EXPOSURE_WINDOW_SIZE,
        includeAnchors = false,
    } = {},
) => {
    const limit = Math.max(1, Math.floor(Number(windowSize) || DEFAULT_EXPOSURE_WINDOW_SIZE));
    const history = Array.isArray(abHistory) ? abHistory.slice(0, limit) : [];
    const bySignature = new Map();
    history.forEach((entry, index) => {
        if (!includeAnchors && isAnchorEntry(entry)) {
            return;
        }
        const signature = readABPairSignatureFromHistory(entry);
        if (!signature || bySignature.has(signature)) {
            return;
        }
        bySignature.set(signature, {
            signature,
            age: index,
            picked: safeString(entry?.picked, null),
            queryKind: safeString(entry?.query?.kind || entry?.generationContext?.queryKind, null),
            timestamp: safeString(entry?.timestamp, null),
        });
    });
    return {
        windowSize: limit,
        bySignature,
        signatures: new Set(bySignature.keys()),
    };
};

export const resolveABPairExposure = (pair = null, ledger = null) => {
    const signature = buildABPairSignature(pair);
    if (!signature || !ledger?.bySignature?.has(signature)) {
        return {
            signature,
            exposed: false,
            age: null,
            queryKind: null,
        };
    }
    const entry = ledger.bySignature.get(signature);
    return {
        signature,
        exposed: true,
        age: Number.isFinite(Number(entry?.age)) ? Number(entry.age) : null,
        queryKind: safeString(entry?.queryKind, null),
    };
};

const FNV_OFFSET = 2166136261;
const FNV_PRIME = 16777619;

export const ZEN_BONSAI_CLASSIC2_ACTIVE_IDENTITY_CONTRACT = (
    'zen_bonsai_classic2_candidate_identity_v1'
);

const fail = (code, detail = '') => {
    throw new Error(
        `ZEN_BONSAI_CLASSIC2_LINEAGE_${code}${detail ? `:${detail}` : ''}`,
    );
};

const isPlainObject = (value) => (
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const requireRevision = (value) => {
    if (!Number.isSafeInteger(value) || value < 1) {
        fail('TREE_IDENTITY_REVISION_INVALID');
    }
    return value;
};

const canonicalizeIdentityJson = (value, stack = new WeakSet()) => {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) fail('TREE_IDENTITY_NON_FINITE');
        return value;
    }
    if (Array.isArray(value)) {
        return value.map((entry) => canonicalizeIdentityJson(entry, stack));
    }
    if (!isPlainObject(value)) fail('TREE_IDENTITY_INVALID');
    if (stack.has(value)) fail('TREE_IDENTITY_CYCLE');
    stack.add(value);
    const normalized = Object.fromEntries(Object.keys(value).sort().map((key) => {
        if (value[key] === undefined) fail('TREE_IDENTITY_UNDEFINED', key);
        return [key, canonicalizeIdentityJson(value[key], stack)];
    }));
    stack.delete(value);
    return normalized;
};

const hashIdentitySource = (value) => {
    const source = String(value);
    let hash = FNV_OFFSET;
    for (let index = 0; index < source.length; index += 1) {
        hash ^= source.charCodeAt(index);
        hash = Math.imul(hash, FNV_PRIME);
    }
    return hash >>> 0;
};

export const resolveZenBonsaiClassic2TreeIdentityEnvelope = (treeIdentity) => {
    if (!isPlainObject(treeIdentity) || Object.keys(treeIdentity).length === 0) {
        fail('TREE_IDENTITY_REQUIRED');
    }
    const identityRevision = requireRevision(treeIdentity.identityRevision);
    const fingerprintInput = Object.fromEntries(
        Object.entries(treeIdentity).filter(([key]) => key !== 'identityRevision'),
    );
    if (Object.keys(fingerprintInput).length === 0) fail('TREE_IDENTITY_REQUIRED');
    const canonicalFingerprintInput = canonicalizeIdentityJson(fingerprintInput);
    const fingerprintHash = hashIdentitySource(JSON.stringify(canonicalFingerprintInput));
    return Object.freeze({
        identityRevision,
        fingerprintInput: canonicalFingerprintInput,
        fingerprint: `classic2_identity_v1:${fingerprintHash.toString(16).padStart(8, '0')}`,
    });
};

export const resolveZenBonsaiClassic2TreeIdentityRevision = (treeIdentity) => (
    resolveZenBonsaiClassic2TreeIdentityEnvelope(treeIdentity).identityRevision
);

export const resolveZenBonsaiClassic2TreeIdentityFingerprint = (treeIdentity) => (
    resolveZenBonsaiClassic2TreeIdentityEnvelope(treeIdentity).fingerprint
);

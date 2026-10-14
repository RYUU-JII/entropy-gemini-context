export const STRUCTURAL_PLAN_HASH_ALGORITHM_V1 = 'fnv1a32_utf16_v1';

const ID_NAMESPACE_PATTERN = /^[a-z][a-z0-9_]*$/;

const failIdentityContract = (reason) => {
    throw new Error(`ZEN_STRUCTURAL_PLAN_IDENTITY_V1_INVALID:${reason}`);
};

const encodeIdentityPart = (part, index) => {
    if (typeof part === 'string') {
        return `s:${part.length}:${part}`;
    }
    if (typeof part === 'number') {
        if (!Number.isFinite(part)) {
            failIdentityContract(`parts.${index}`);
        }
        return `n:${Object.is(part, -0) ? '0' : String(part)}`;
    }
    if (typeof part === 'boolean') {
        return part ? 'b:1' : 'b:0';
    }
    if (part === null) {
        return 'z:null';
    }
    failIdentityContract(`parts.${index}`);
    return '';
};

export const createStructuralPlanHashV1 = (parts) => {
    if (!Array.isArray(parts)) {
        failIdentityContract('parts');
    }
    const encoded = parts
        .map((part, index) => encodeIdentityPart(part, index))
        .join('|');
    let hash = 0x811c9dc5;
    for (let index = 0; index < encoded.length; index += 1) {
        hash ^= encoded.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
};

export const createStructuralPlanIdV1 = (namespace, parts) => {
    if (typeof namespace !== 'string' || !ID_NAMESPACE_PATTERN.test(namespace)) {
        failIdentityContract('namespace');
    }
    return `${namespace}_${createStructuralPlanHashV1(parts)}`;
};

export const isStructuralPlanIdV1 = (value, namespace) => (
    typeof namespace === 'string'
    && ID_NAMESPACE_PATTERN.test(namespace)
    && typeof value === 'string'
    && new RegExp(`^${namespace}_[0-9a-f]{8}$`).test(value)
);

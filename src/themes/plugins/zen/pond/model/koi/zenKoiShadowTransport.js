export const ZEN_KOI_SHADOW_TRANSPORT_CONTRACT_ID = (
    'entropy.zen.pond.koi-shadow-transport'
);
export const ZEN_KOI_SHADOW_TRANSPORT_CONTRACT_VERSION = 1;
export const ZEN_KOI_SHADOW_TRANSPORT_MODEL_ID = 'linear-depth-span-v1';
export const ZEN_KOI_SHADOW_DEPTH_SEMANTIC = 'normalized-zero-surface-positive-down';
export const ZEN_KOI_SHADOW_DIRECTION_SEMANTIC = 'caster-to-receiver-canvas-xy';
export const ZEN_KOI_SHADOW_REACH_SEMANTIC = 'shadow-length-times-depth-span';

export const ZEN_KOI_SHADOW_TRANSPORT_CONTRACT = Object.freeze({
    id: ZEN_KOI_SHADOW_TRANSPORT_CONTRACT_ID,
    version: ZEN_KOI_SHADOW_TRANSPORT_CONTRACT_VERSION,
    modelId: ZEN_KOI_SHADOW_TRANSPORT_MODEL_ID,
    depthSemantic: ZEN_KOI_SHADOW_DEPTH_SEMANTIC,
    directionSemantic: ZEN_KOI_SHADOW_DIRECTION_SEMANTIC,
    reachSemantic: ZEN_KOI_SHADOW_REACH_SEMANTIC,
});

const failInvalidTransport = (reason) => {
    throw new TypeError(`ZEN_POND_KOI_SHADOW_TRANSPORT_INVALID:${reason}`);
};

const requireMutableTarget = (target) => {
    if (
        !target
        || typeof target !== 'object'
        || Array.isArray(target)
        || !Object.isExtensible(target)
        || Object.isFrozen(target)
    ) {
        failInvalidTransport('target_not_mutable_record');
    }
    return target;
};

const requireNormalizedDepth = (value, name) => {
    if (!Number.isFinite(value)) {
        failInvalidTransport(`${name}_not_finite`);
    }
    if (value < 0 || value > 1) {
        failInvalidTransport(`${name}_outside_normalized_range`);
    }
    return value;
};

const requireFiniteNumber = (value, name) => {
    if (!Number.isFinite(value)) {
        failInvalidTransport(`${name}_not_finite`);
    }
    return value;
};

const requirePositiveNumber = (value, name) => {
    const numeric = requireFiniteNumber(value, name);
    if (numeric <= 0) {
        failInvalidTransport(`${name}_not_positive`);
    }
    return numeric;
};

/**
 * Writes the depth-only shadow transport shared by bottom and fish receivers.
 *
 * This seam intentionally owns only projection geometry. Shadow appearance,
 * receiver selection, display lifecycle, texture leases, and caching belong to
 * their respective presentation/runtime owners.
 */
export const writeZenKoiShadowTransport = (
    target,
    {
        sourceDepth,
        receiverDepth,
        sunAngle,
        shadowLength,
    } = {},
) => {
    const output = requireMutableTarget(target);
    const safeSourceDepth = requireNormalizedDepth(sourceDepth, 'source_depth');
    const safeReceiverDepth = requireNormalizedDepth(receiverDepth, 'receiver_depth');
    if (safeReceiverDepth <= safeSourceDepth) {
        failInvalidTransport('receiver_not_below_source');
    }
    const safeSunAngle = requireFiniteNumber(sunAngle, 'sun_angle');
    const safeShadowLength = requirePositiveNumber(shadowLength, 'shadow_length');

    const directionBaseX = Math.cos(safeSunAngle);
    const directionBaseY = Math.sin(safeSunAngle);
    const directionMagnitude = Math.hypot(directionBaseX, directionBaseY);
    if (!Number.isFinite(directionMagnitude) || directionMagnitude <= 0) {
        failInvalidTransport('direction_not_resolvable');
    }

    const depthSpan = safeReceiverDepth - safeSourceDepth;
    const directionX = directionBaseX / directionMagnitude;
    const directionY = directionBaseY / directionMagnitude;
    const reach = safeShadowLength * depthSpan;

    output.contractId = ZEN_KOI_SHADOW_TRANSPORT_CONTRACT_ID;
    output.contractVersion = ZEN_KOI_SHADOW_TRANSPORT_CONTRACT_VERSION;
    output.modelId = ZEN_KOI_SHADOW_TRANSPORT_MODEL_ID;
    output.depthSemantic = ZEN_KOI_SHADOW_DEPTH_SEMANTIC;
    output.directionSemantic = ZEN_KOI_SHADOW_DIRECTION_SEMANTIC;
    output.reachSemantic = ZEN_KOI_SHADOW_REACH_SEMANTIC;
    output.sourceDepth = safeSourceDepth;
    output.receiverDepth = safeReceiverDepth;
    output.depthSpan = depthSpan;
    output.sunAngle = safeSunAngle;
    output.shadowLength = safeShadowLength;
    output.directionX = directionX;
    output.directionY = directionY;
    output.reach = reach;
    output.offsetX = directionX * reach;
    output.offsetY = directionY * reach;
    return output;
};

export const resolveZenKoiShadowTransport = (options = {}) => (
    Object.freeze(writeZenKoiShadowTransport({}, options))
);

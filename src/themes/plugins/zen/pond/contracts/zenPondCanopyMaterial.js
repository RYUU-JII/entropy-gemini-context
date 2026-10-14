// Canopy material contract.
//
// One leaf geometry, two visibility measures. Direct visibility resolves the
// small gaps; sky visibility is the broad, softer obstruction of diffuse sky.
// Komorebi restores the incident sunlight in those gaps. It never adds a
// second light on top of an already sunlit material.

export const ZEN_POND_CANOPY_MODEL_IDS = Object.freeze({
    LAYERED: 'canopy_branch_visibility_layered_v6',
    LACY: 'canopy_branch_visibility_lacy_v6',
});

export const ZEN_POND_CANOPY_MODEL_ID =
    ZEN_POND_CANOPY_MODEL_IDS.LAYERED;

const ZEN_POND_CANOPY_SUPPORTED_MODEL_IDS = Object.freeze(
    Object.values(ZEN_POND_CANOPY_MODEL_IDS),
);

export const ZEN_POND_CANOPY_TEXTURE_SIZE = 512;

// Packed direct penumbra endpoints and diffuse sky visibility share the same
// total texture budget as the preceding two-mask canopy material.
export const ZEN_POND_CANOPY_TEXTURE_COUNT = 2;
export const ZEN_POND_CANOPY_RAW_TEXTURE_BYTES =
    ZEN_POND_CANOPY_TEXTURE_SIZE
    * ZEN_POND_CANOPY_TEXTURE_SIZE
    * 4
    * ZEN_POND_CANOPY_TEXTURE_COUNT;

export const ZEN_POND_CANOPY_SEED_ROLE = 'canopy-branch-aperture-v6';

export const ZEN_POND_CANOPY_TRANSFER_MODEL_ID = 'canopy_direct_diffuse_transfer_v1';
export const ZEN_POND_CANOPY_DIRECT_OCCLUSION = 0.62;
export const ZEN_POND_CANOPY_SKY_OCCLUSION = 0.22;

// Diagnostics report the gap's direct-light contrast, not emissive opacity.
export const ZEN_POND_KOMOREBI_MAXIMUM_ALPHA = ZEN_POND_CANOPY_DIRECT_OCCLUSION;
export const ZEN_POND_CANOPY_SHADE_MAXIMUM_ALPHA = 1;

// Six independent branch masses in three height bands. Unequal corner crowns
// and sparse side twigs leave breaks in the rim. Anchor is a viewport fraction;
// offset and size use its shorter edge. Edge signs point toward open water.
export const ZEN_POND_CANOPY_CROWNS = Object.freeze([
    { id: 'upper_left', atlas: [0, 0, 0.5, 0.5], size: 0.62, anchorX: 0, anchorY: 0, offsetX: -0.08, offsetY: -0.09, edgeX: 1, edgeY: 1, height: 0.072, density: 0.90 },
    { id: 'lower_right', atlas: [0.5, 0.5, 1, 1], size: 0.50, anchorX: 1, anchorY: 1, offsetX: 0.07, offsetY: 0.07, edgeX: -1, edgeY: -1, height: 0.047, density: 0.78 },
    { id: 'upper_right', atlas: [0.5, 0, 0.75, 0.25], size: 0.36, anchorX: 1, anchorY: 0, offsetX: 0.075, offsetY: -0.07, edgeX: -1, edgeY: 1, height: 0.028, density: 0.65 },
    { id: 'lower_left', atlas: [0.75, 0, 1, 0.25], size: 0.32, anchorX: 0, anchorY: 1, offsetX: -0.055, offsetY: 0.065, edgeX: 1, edgeY: -1, height: 0.047, density: 0.62 },
    { id: 'left_near', atlas: [0.5, 0.25, 0.75, 0.5], size: 0.30, anchorX: 0, anchorY: 0.52, offsetX: -0.07, offsetY: 0, edgeX: 1, edgeY: 0, height: 0.028, density: 0.50 },
    { id: 'right_far', atlas: [0.75, 0.25, 1, 0.5], size: 0.28, anchorX: 1, anchorY: 0.35, offsetX: 0.08, offsetY: 0, edgeX: -1, edgeY: 0, height: 0.072, density: 0.45 },
].map((crown) => Object.freeze({ ...crown, atlas: Object.freeze(crown.atlas) })));
export const ZEN_POND_CANOPY_PROJECTION_LIMIT = 0.12;
// Grain and baked penumbra are fractions of the visible world's shorter edge,
// shared by both crowns. They are geometry dimensions, not lighting gains.
export const ZEN_POND_CANOPY_LEAF_LENGTH = Object.freeze({
    layered: Object.freeze([0.022, 0.034]),
    lacy: Object.freeze([0.018, 0.029]),
});
export const ZEN_POND_CANOPY_DIRECT_PENUMBRA = 0.008;
export const ZEN_POND_CANOPY_SOFT_PENUMBRA = 0.022;
export const ZEN_POND_CANOPY_SKY_PENUMBRA = 0.024;
// Bake coverage into the same foliage masks: soften atlas boundaries and let
// the crown thin toward open water. This envelope moves with solar projection.
export const ZEN_POND_CANOPY_EDGE_FEATHER = 0.014;
export const ZEN_POND_CANOPY_INNER_FADE = Object.freeze([0.045, 0.19]);


export const readZenPondCanopyModelId = (
    value,
    { required = false } = {},
) => {
    if (value === null || value === undefined) {
        if (required === true) {
            throw new Error('ZEN_POND_CANOPY_MODEL_ID_MISSING');
        }
        return null;
    }
    if (typeof value !== 'string') {
        throw new Error('ZEN_POND_CANOPY_MODEL_ID_TYPE_INVALID');
    }
    if (!ZEN_POND_CANOPY_SUPPORTED_MODEL_IDS.includes(value)) {
        throw new Error(
            `ZEN_POND_CANOPY_MODEL_ID_UNSUPPORTED:${value}`,
        );
    }
    return value;
};

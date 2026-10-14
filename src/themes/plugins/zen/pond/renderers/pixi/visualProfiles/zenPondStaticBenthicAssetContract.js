export const ZEN_POND_STATIC_BENTHIC_ASSET_SCHEMA_VERSION = 1;

export const ZEN_POND_STATIC_BENTHIC_MATERIAL_ID = 'neutral-depth';
export const ZEN_POND_STATIC_BENTHIC_TEXTURE_SIZE = 1024;

export const ZEN_POND_STATIC_BENTHIC_STYLES = Object.freeze({
    PRIMARY: 'primary',
    DETAIL: 'detail',
});

export const ZEN_POND_STATIC_BENTHIC_STYLE_VALUES = Object.freeze(
    Object.values(ZEN_POND_STATIC_BENTHIC_STYLES),
);

export const ZEN_POND_STATIC_BENTHIC_MATERIAL_PROFILE = Object.freeze({
    baseMorphology: 'neutral_mineral_relief',
    depthPocketStrength: 0.16,
    depthSeedRole: 'neutral-depth-v2',
});

export const ZEN_POND_STATIC_BENTHIC_ASSET_FILES = Object.freeze({
    [ZEN_POND_STATIC_BENTHIC_STYLES.PRIMARY]: 'zen-pond-benthic-primary.png',
    [ZEN_POND_STATIC_BENTHIC_STYLES.DETAIL]: 'zen-pond-benthic-detail.png',
    manifest: 'zen-pond-benthic-manifest.json',
});

export const ZEN_POND_STATIC_BENTHIC_RUNTIME_ASSET_FILES = Object.freeze({
    [ZEN_POND_STATIC_BENTHIC_STYLES.PRIMARY]: 'zen-pond-benthic-primary.rgba.gz',
    [ZEN_POND_STATIC_BENTHIC_STYLES.DETAIL]: 'zen-pond-benthic-detail.rgba.gz',
});

export const ZEN_POND_STATIC_BENTHIC_RUNTIME_PIXEL_FORMAT = 'rgba8';
export const ZEN_POND_STATIC_BENTHIC_RUNTIME_CHANNEL_COUNT = 4;
export const ZEN_POND_STATIC_BENTHIC_RUNTIME_ENCODING = 'gzip';

export const ZEN_POND_STATIC_BENTHIC_BUILD_ENGINE = '@napi-rs/canvas@1.0.2';

export const ZEN_POND_STATIC_BENTHIC_CONTRACT_SIGNATURE = [
    `schema:${ZEN_POND_STATIC_BENTHIC_ASSET_SCHEMA_VERSION}`,
    `material:${ZEN_POND_STATIC_BENTHIC_MATERIAL_ID}`,
    `size:${ZEN_POND_STATIC_BENTHIC_TEXTURE_SIZE}`,
    `runtime:${ZEN_POND_STATIC_BENTHIC_RUNTIME_PIXEL_FORMAT}`,
    `encoding:${ZEN_POND_STATIC_BENTHIC_RUNTIME_ENCODING}`,
    `morphology:${ZEN_POND_STATIC_BENTHIC_MATERIAL_PROFILE.baseMorphology}`,
    `depth:${ZEN_POND_STATIC_BENTHIC_MATERIAL_PROFILE.depthPocketStrength}`,
    `seed:${ZEN_POND_STATIC_BENTHIC_MATERIAL_PROFILE.depthSeedRole}`,
    `engine:${ZEN_POND_STATIC_BENTHIC_BUILD_ENGINE}`,
].join('|');

export const requireZenPondStaticBenthicStyle = (value) => {
    if (!ZEN_POND_STATIC_BENTHIC_STYLE_VALUES.includes(value)) {
        throw new Error(`ZEN_POND_STATIC_BENTHIC_STYLE_INVALID:${String(value)}`);
    }
    return value;
};

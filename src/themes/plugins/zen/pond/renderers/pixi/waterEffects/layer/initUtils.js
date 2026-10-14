
export const resolveWaterEffectsTextureSizes = () => {
    return {
        pebbleTextureSize: 1024,
        pebbleDetailTextureSize: 1024,
        causticTextureSize: 1024,
        skyReflectionTextureSize: 512,
    };
};

export const createWaterEffectsInitMetrics = ({
    textureSizes,
    debugToggles,
    cloudReflectionToggleEnabled = false,
} = {}) => ({
    phase: 'water-effects-layer',
    cache: {
        key: '',
        hit: false,
    },
    textureSizes,
    sharedTextures: {
        pebbleDetailFromPrimary: false,
        skyReflectionOwner: 'surface_field',
    },
    debugToggles,
    textureBuildMs: {},
    textureBuildTotalMs: 0,
    textureSetupMs: 0,
    totalMs: 0,
    bottleneck: null,
});

export const buildWaterTextureBudgetKey = ({
    cloudReflectionToggleEnabled = false,
    benthicToggleEnabled = false,
    causticsToggleEnabled = false,
    godRaysToggleEnabled = false,
    atmosphereToggleEnabled = false,
    canopyToggleEnabled = false,
    canopyModel = 'layered',
} = {}) => [
    'full',
    cloudReflectionToggleEnabled ? 'cloud-on' : 'cloud-off',
    benthicToggleEnabled ? 'benthic-on' : 'benthic-off',
    causticsToggleEnabled ? 'caustic-on' : 'caustic-off',
    godRaysToggleEnabled ? 'rays-on' : 'rays-off',
    atmosphereToggleEnabled ? 'atmosphere-on' : 'atmosphere-off',
    canopyToggleEnabled ? `canopy-${canopyModel}` : 'canopy-off',
].join('|');

import { ZEN_POND_SHADOW_DEPTH_WORLD_UNITS } from '../../../contracts/zenPondShadowGeometry.js';

// Preserve the interior field's texel density. A finite camera/world crop is
// not a bank: sunlight may enter the water just outside it. 64 world units
// cover the flat Snell travel of the canonical 48-unit depth; the remaining
// margin covers the bounded inverse correction and derivative aperture.
export const resolveZenWaterOpticalDomain = (width, height, fieldSize) => {
    const guard = ZEN_POND_SHADOW_DEPTH_WORLD_UNITS * 4 / 3 + height * 0.05;
    const padX = Math.ceil(guard * fieldSize.width / width);
    const padY = Math.ceil(guard * fieldSize.height / height);
    const textureWidth = fieldSize.width + padX * 2;
    const textureHeight = fieldSize.height + padY * 2;
    return {
        width: textureWidth,
        height: textureHeight,
        map: new Float32Array([
            fieldSize.width / textureWidth, fieldSize.height / textureHeight,
            padX / textureWidth, padY / textureHeight,
        ]),
    };
};

export const zenWaterSurfaceDomainShader = `
uniform vec4 uSurfaceFieldMap;
vec2 surfaceFieldUv(vec2 worldUv) {
    return worldUv * uSurfaceFieldMap.xy + uSurfaceFieldMap.zw;
}
`;

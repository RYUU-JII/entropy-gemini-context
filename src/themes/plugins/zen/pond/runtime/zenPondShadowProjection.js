import { sampleZenPondBottomDepth } from '../world/fields/zenPondBathymetryField.js';
import { ZEN_WATER_AIR_TO_WATER_ETA } from '../contracts/zenWaterOptics.js';

// All pond casters consume this projection of the existing environment. The
// sun vector points toward the light; receiver displacement points away from it.
export const ZEN_POND_SHADOW_SKY_RGB = Object.freeze([0.78, 0.9, 1]);

const finite = (value, field) => {
    if (!Number.isFinite(value)) throw new Error(`ZEN_POND_SHADOW_FIELD_INVALID:${field}`);
    return value;
};

// A bank-crossing body can overlap the pond while its head is outside it.
// Sample the nearest point on the finite bottom receiver for that lifecycle.
export const sampleZenKoiShadowBottomDepth = (field, fish) => {
    const x = finite(fish.x, 'koi.x');
    const y = finite(fish.y, 'koi.y');
    const transit = fish.rosterTransit;
    const crossing = transit && !transit.complete
        && (transit.kind === 'entering' || transit.kind === 'exiting');
    return sampleZenPondBottomDepth(field,
        crossing && transit.edge < 2 ? Math.max(0, Math.min(field.worldWidth, x)) : x,
        crossing && transit.edge >= 2 ? Math.max(0, Math.min(field.worldHeight, y)) : y);
};

export const resolveZenPondShadowLight = ({
    sunDirectionX, sunDirectionY, sunDirectionZ,
    directSunlight, diffuseSkylight, lightChannels,
}) => {
    const x = finite(sunDirectionX, 'sunDirectionX');
    const y = finite(sunDirectionY, 'sunDirectionY');
    const z = finite(sunDirectionZ, 'sunDirectionZ');
    const magnitude = Math.hypot(x, y, z);
    if (magnitude < 0.000001) throw new Error('ZEN_POND_SHADOW_SUN_VECTOR_EMPTY');
    const beam = finite(directSunlight, 'directSunlight');
    const sky = finite(diffuseSkylight, 'diffuseSkylight');
    if (beam < 0 || sky < 0) throw new Error('ZEN_POND_SHADOW_NEGATIVE_LIGHT');
    const sunRgb = ['r', 'g', 'b'].map((channel) => {
        const value = finite(lightChannels?.[channel], `lightChannels.${channel}`);
        if (value < 0 || value > 255) throw new Error('ZEN_POND_SHADOW_LIGHT_COLOR_RANGE');
        return value / 255;
    });
    const horizontal = Math.hypot(x, y);
    const directShare = sunRgb.map((color, index) => {
        const direct = z > 0 ? beam * color : 0;
        const diffuse = sky * ZEN_POND_SHADOW_SKY_RGB[index];
        return direct + diffuse === 0 ? 0 : direct / (direct + diffuse);
    });
    const skyShare = sunRgb.map((color, index) => {
        const direct = z > 0 ? beam * color : 0;
        const diffuse = sky * ZEN_POND_SHADOW_SKY_RGB[index];
        return direct + diffuse === 0 ? 0 : diffuse / (direct + diffuse);
    });
    return Object.freeze({
        sunX: x / magnitude, sunY: y / magnitude, sunZ: z / magnitude,
        submergedSunX: x / magnitude * ZEN_WATER_AIR_TO_WATER_ETA,
        submergedSunY: y / magnitude * ZEN_WATER_AIR_TO_WATER_ETA,
        submergedSunZ: z > 0 ? Math.sqrt(1 - ZEN_WATER_AIR_TO_WATER_ETA ** 2 * (horizontal / magnitude) ** 2) : 0,
        directionX: horizontal === 0 ? 0 : -x / horizontal,
        directionY: horizontal === 0 ? 0 : -y / horizontal,
        directShare: Object.freeze(directShare), skyShare: Object.freeze(skyShare),
        directStrength: directShare.reduce((sum, value) => sum + value, 0) / 3,
        sunRgb: Object.freeze(sunRgb),
    });
};

// Submerged receivers use the mean refracted ray from the same light snapshot.
// Surface plants retain projectZenPondShadow's air-space projection.
export const projectZenPondSubmergedShadow = ({ light, heightAboveReceiver, maxReach }) => (
    projectZenPondShadow({
        light: {
            sunX: light?.submergedSunX, sunY: light?.submergedSunY, sunZ: light?.submergedSunZ,
            directionX: light?.directionX, directionY: light?.directionY,
        },
        heightAboveReceiver, maxReach,
    })
);

export const projectZenPondShadow = ({ light, heightAboveReceiver, maxReach }) => {
    const height = finite(heightAboveReceiver, 'heightAboveReceiver');
    const limit = finite(maxReach, 'maxReach');
    if (height < 0 || limit <= 0) throw new Error('ZEN_POND_SHADOW_PROJECTION_RANGE');
    const z = finite(light?.sunZ, 'light.sunZ');
    const horizontal = Math.hypot(finite(light.sunX, 'light.sunX'), finite(light.sunY, 'light.sunY'));
    const rawReach = z > 0 ? height * horizontal / Math.max(0.08, z) : 0;
    // A smooth horizon limit keeps the contact point fixed without allowing a
    // low sun to sweep an entire dashboard. It is presentation, not a new sun.
    const reach = limit * Math.tanh(rawReach / limit);
    return {
        offsetX: finite(light.directionX, 'light.directionX') * reach,
        offsetY: finite(light.directionY, 'light.directionY') * reach,
        reach,
        penumbra: height * 0.045 + reach * 0.015,
    };
};

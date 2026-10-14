import {
    ZEN_PETAL_COLORS,
    ZEN_PETAL_SHAPE_COUNT,
} from '../../runtime/petals/zenPetalMaterial.js';
import { ZEN_PETAL_DEPTH_LAYERS } from '../../runtime/petals/zenPetalDepth.js';

export const ZEN_POND_LANDED_PETAL_LIMIT = 32;
export const ZEN_POND_PETAL_LANDING_BATCH_LIMIT = 24;
export const ZEN_POND_PETAL_LANDING_HISTORY_LIMIT = 2048;
// Pond world units (720 short edge), independent of CSS size, DPR or cover crop.
// Even the young-pad tail starts at radius 10; a petal cannot dwarf that pad.
export const ZEN_POND_MAX_LANDED_PETAL_SIZE = 6;

export const requireZenPetalLandingDescriptor = (landing) => {
    if (!landing || typeof landing !== 'object' || Array.isArray(landing)
        || landing.depthLayer !== ZEN_PETAL_DEPTH_LAYERS.SURFACE
        || typeof landing.id !== 'string' || !landing.id || landing.id.length > 160
        || !['x', 'y', 'size', 'rotation', 'opacity', 'velocityX', 'velocityY']
            .every((key) => Number.isFinite(landing[key]))
        || landing.size <= 0 || landing.size > 64
        || landing.opacity < 0 || landing.opacity > 1
        || !ZEN_PETAL_COLORS.includes(landing.color)
        || !Number.isInteger(landing.shapeType)
        || landing.shapeType < 0 || landing.shapeType >= ZEN_PETAL_SHAPE_COUNT) {
        throw new Error('ZEN_POND_PETAL_LANDING_DESCRIPTOR_INVALID');
    }
    return landing;
};

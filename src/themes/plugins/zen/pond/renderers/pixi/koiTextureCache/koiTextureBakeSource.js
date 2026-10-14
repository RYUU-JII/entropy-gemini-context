import {
    koiFishRenderBodyCoreMethods,
} from '../../../model/koi/koiFishRenderBodyCoreMethods.js';
import {
    koiFishRenderFinMethods,
} from '../../../model/koi/koiFishRenderFinMethods.js';
import {
    koiFishRenderPatternMethods,
} from '../../../model/koi/koiFishRenderPatternMethods.js';

const REQUIRED_SIMULATION_METHODS = Object.freeze([
    'createBodyPath',
    'getBodyRadius',
    'mixColor',
]);

const requireMethod = (owner, methodName) => {
    const method = owner?.[methodName];
    if (typeof method !== 'function') {
        throw new Error(
            `ZEN_PIXI_KOI_TEXTURE_BAKE_METHOD_REQUIRED:${methodName}`,
        );
    }
    return method;
};

export const createPixiKoiTextureBakeSource = (fishInfo) => {
    if (!fishInfo || typeof fishInfo !== 'object' || Array.isArray(fishInfo)) {
        throw new TypeError('ZEN_PIXI_KOI_TEXTURE_BAKE_SOURCE_REQUIRED');
    }

    const simulationMethods = Object.fromEntries(
        REQUIRED_SIMULATION_METHODS.map((methodName) => ([
            methodName,
            requireMethod(fishInfo, methodName),
        ])),
    );

    return {
        ...fishInfo,
        ...simulationMethods,
        drawPattern: requireMethod(
            koiFishRenderPatternMethods,
            'drawPattern',
        ),
        drawDorsalFin: requireMethod(
            koiFishRenderPatternMethods,
            'drawDorsalFin',
        ),
        drawEyeSimple: requireMethod(
            koiFishRenderBodyCoreMethods,
            'drawEyeSimple',
        ),
        drawTailFin: requireMethod(
            koiFishRenderFinMethods,
            'drawTailFin',
        ),
    };
};


import {
    requireZenWorldAmbientGrammar,
} from './environment/zenWorldAmbientGrammar.js';
import { resolveZenWorldMaterialPaintSignature } from './environment/zenWorldMaterialPalette.js';

const quantizeStep = (value, step = 1, digits = 3) => {
    const numeric = Number(value);
    const safeStep = Math.max(Number(step) || 1, 1e-6);
    if (!Number.isFinite(numeric)) return 'na';
    return String(Number((Math.round(numeric / safeStep) * safeStep).toFixed(digits)));
};

const resolveEnvironmentLightBand = (environmentState) => {
    const chromatic = requireZenWorldAmbientGrammar(environmentState.ambientChromaticState);
    if (chromatic.nightWeight > 0.5) return 'night';
    if (chromatic.dawnWeight > 0.45) return 'dawn';
    if (chromatic.duskWeight > 0.45) return 'dusk';
    return 'day';
};

const resolveEnvironmentChromaticSignature = (environmentState) => {
    const chromatic = requireZenWorldAmbientGrammar(environmentState.ambientChromaticState);
    return ['warmth', 'twilightWeight', 'nightWeight', 'noonWeight']
        .map((field) => quantizeStep(chromatic[field], 0.05, 2));
};

export const resolveZenBonsaiEnvironmentSignature = (environmentState) => {
    if (!environmentState || typeof environmentState !== 'object') {
        return 'env:motion:none';
    }
    return [
        'env:motion',
        quantizeStep(environmentState?.daylight, 0.2, 2),
        quantizeStep(environmentState?.windIntensity, 0.1, 2),
        quantizeStep(environmentState?.gustEnvelope, 0.1, 2),
        quantizeStep(environmentState?.windDirection, Math.PI / 10, 3),
    ].join('|');
};

export const resolveZenBonsaiEnvironmentBakeSignature = (environmentState) => {
    if (!environmentState || typeof environmentState !== 'object') {
        return 'env:bake:none';
    }
    return [
        'env:bake',
        resolveEnvironmentLightBand(environmentState),
        ...resolveEnvironmentChromaticSignature(environmentState),
        resolveZenWorldMaterialPaintSignature(environmentState),
    ].join('|');
};

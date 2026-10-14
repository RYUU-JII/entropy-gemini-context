import { clamp01 } from './metricsMath';

const extractReferenceFeatures = (ref) => {
    if (!ref || Array.isArray(ref)) {
        return ref;
    }
    if (ref.features && typeof ref.features === 'object') {
        return ref.features;
    }
    return ref;
};

export const extractReferenceBloomRatio = (ref) => {
    if (!ref || typeof ref !== 'object') {
        return null;
    }
    const direct = Number(ref?.factors?.bloomRatio ?? ref?.bloomRatio);
    if (Number.isFinite(direct)) {
        return clamp01(direct);
    }
    const flowers = Number(ref?.density?.flowers);
    const leaves = Number(ref?.density?.leaves);
    if (Number.isFinite(flowers) && Number.isFinite(leaves) && (flowers + leaves) > 0) {
        return clamp01(flowers / (flowers + leaves));
    }
    return null;
};

export const extractReferenceFeatureValue = (ref, key) => {
    const features = extractReferenceFeatures(ref);
    const value = Number(features?.[key]);
    return Number.isFinite(value) ? clamp01(value) : null;
};

export const vectorizeReference = (ref, keys) => {
    if (!ref) {
        return null;
    }
    if (Array.isArray(ref)) {
        if (ref.length < keys.length) {
            return null;
        }
        return ref
            .slice(0, keys.length)
            .map((value) => (Number.isFinite(value) ? value : 0));
    }
    const features = extractReferenceFeatures(ref);
    if (!features || typeof features !== 'object') {
        return null;
    }
    return keys.map((key) => (Number.isFinite(features[key]) ? features[key] : 0));
};

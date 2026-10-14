const clamp01 = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const toNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const dot2 = (a, b) => (toNumber(a?.[0]) * toNumber(b?.[0])) + (toNumber(a?.[1]) * toNumber(b?.[1]));
const vecLength2 = (v) => Math.sqrt((toNumber(v?.[0]) ** 2) + (toNumber(v?.[1]) ** 2));
const normalize2 = (v) => {
    const len = Math.max(1e-9, vecLength2(v));
    return [toNumber(v?.[0]) / len, toNumber(v?.[1]) / len];
};
const lerp = (a, b, t) => a + ((b - a) * clamp01(t));

export class LightFieldModel {
    constructor({
        topLightDir = [0, 1],
        sideLightDir = [0.55, 0.78],
        topLightWeight = 0.72,
        sideLightWeight = 0.28,
    } = {}) {
        this.topLightDir = normalize2(topLightDir);
        this.sideLightDir = normalize2(sideLightDir);
        this.topLightWeight = clamp01(toNumber(topLightWeight, 0.72));
        this.sideLightWeight = clamp01(toNumber(sideLightWeight, 0.28));
    }

    sample({
        position = [0, 0, 0],
        heading = [0, 1, 0],
        bounds = { width: 420, height: 420 },
    } = {}) {
        const heading2 = normalize2([heading[0], heading[1]]);
        const topAlign = clamp01((dot2(heading2, this.topLightDir) + 1) * 0.5);
        const sideAlign = clamp01((dot2(heading2, this.sideLightDir) + 1) * 0.5);

        const normalizedHeight = clamp01(toNumber(position?.[1]) / Math.max(1, toNumber(bounds?.height, 420)));
        const normalizedX = clamp01(Math.abs(toNumber(position?.[0])) / Math.max(1, toNumber(bounds?.width, 420) * 0.5));
        const openSkyGain = clamp01((normalizedHeight * 0.62) + ((1 - normalizedX) * 0.38));

        const directional = (
            topAlign * this.topLightWeight
            + sideAlign * this.sideLightWeight
        );
        const lightAlign = clamp01(
            (directional * 0.72) + (openSkyGain * 0.28),
        );

        return {
            lightAlign,
            topAlign,
            sideAlign,
            openSkyGain,
        };
    }

    sampleWithPhototropism({
        position,
        heading,
        bounds,
        phototropismGain = 0.5,
    } = {}) {
        const base = this.sample({ position, heading, bounds });
        const gain = clamp01(toNumber(phototropismGain, 0.5));
        return {
            ...base,
            lightAlign: clamp01(lerp(base.lightAlign * 0.82, base.lightAlign, gain)),
        };
    }
}


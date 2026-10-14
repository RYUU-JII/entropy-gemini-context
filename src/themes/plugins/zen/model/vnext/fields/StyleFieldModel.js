const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const clamp01 = (value) => clamp(Number.isFinite(value) ? value : 0, 0, 1);
const toNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const lerp = (a, b, t) => a + ((b - a) * clamp01(t));

const normalize2 = (v = [0, 1]) => {
    const x = toNumber(v?.[0], 0);
    const y = toNumber(v?.[1], 1);
    const len = Math.max(1e-9, Math.sqrt((x * x) + (y * y)));
    return [x / len, y / len];
};

const dot2 = (a = [0, 1], b = [0, 1]) => (
    (toNumber(a?.[0], 0) * toNumber(b?.[0], 0))
    + (toNumber(a?.[1], 0) * toNumber(b?.[1], 0))
);

export class StyleFieldModel {
    constructor({
        cascadeBias = 0.2,
        windsweptBias = 0,
        canopyEnvelopeBias = 0,
        padSeparationTarget = 0.58,
        negativeSpaceTarget = 0.44,
        massBalanceGain = 0.5,
    } = {}) {
        this.cascadeBias = clamp01(toNumber(cascadeBias, 0.2));
        this.windsweptBias = clamp(toNumber(windsweptBias, 0), -1, 1);
        this.canopyEnvelopeBias = clamp(toNumber(canopyEnvelopeBias, 0), -1, 1);
        this.padSeparationTarget = clamp01(toNumber(padSeparationTarget, 0.58));
        this.negativeSpaceTarget = clamp01(toNumber(negativeSpaceTarget, 0.44));
        this.massBalanceGain = clamp01(toNumber(massBalanceGain, 0.5));
    }

    sample({
        position = [0, 0, 0],
        heading = [0, 1, 0],
        bounds = { width: 420, height: 420 },
    } = {}) {
        const width = Math.max(1, toNumber(bounds?.width, 420));
        const height = Math.max(1, toNumber(bounds?.height, 420));

        const normalizedX = clamp((toNumber(position?.[0], 0) / (width * 0.5)), -1, 1);
        const normalizedY = clamp01(toNumber(position?.[1], 0) / height);
        const heading2 = normalize2([toNumber(heading?.[0], 0), toNumber(heading?.[1], 1)]);

        const styleHeading = normalize2([
            this.windsweptBias * 0.85,
            lerp(1.05, 0.42, this.cascadeBias),
        ]);
        const directionalAlign = clamp01((dot2(heading2, styleHeading) + 1) * 0.5);

        const centerShift = this.canopyEnvelopeBias * 0.38;
        const shiftedX = normalizedX - centerShift;
        const targetY = lerp(0.76, 0.28, this.cascadeBias);
        const yEnvelope = clamp01(1 - Math.abs(normalizedY - targetY) / 0.75);

        const trunkCorridor = lerp(0.22, 0.58, normalizedY);
        const canopyWidth = clamp01(1 - Math.max(0, (Math.abs(shiftedX) - trunkCorridor) / Math.max(0.2, 1 - trunkCorridor)));

        const padBand = Math.max(0.14, lerp(0.32, 0.12, this.padSeparationTarget));
        const bandCenter = Math.round(normalizedY / padBand) * padBand;
        const padBandAlign = clamp01(1 - (Math.abs(normalizedY - bandCenter) / Math.max(0.06, padBand * 0.7)));

        const negativeSpaceLift = clamp01(1 - (Math.abs(shiftedX) * lerp(0.4, 0.18, this.negativeSpaceTarget)));
        const styleAlign = clamp01(
            (directionalAlign * 0.44)
            + (canopyWidth * 0.24)
            + (yEnvelope * 0.16)
            + (padBandAlign * 0.1)
            + (negativeSpaceLift * 0.06),
        );

        const centerPreference = clamp01(1 - Math.abs(shiftedX));
        const verticalBalance = clamp01(1 - Math.abs(normalizedY - 0.58) / 0.82);
        const massBalance = clamp01(
            (centerPreference * (0.55 + (0.2 * this.massBalanceGain)))
            + (verticalBalance * (0.45 - (0.2 * this.massBalanceGain))),
        );

        return {
            styleAlign,
            massBalance,
            directionalAlign,
            canopyWidth,
            yEnvelope,
            padBandAlign,
        };
    }
}

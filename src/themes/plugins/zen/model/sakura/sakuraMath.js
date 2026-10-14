export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const lerp = (a, b, t) => a + (b - a) * t;

export const degToRad = (deg) => (deg * Math.PI) / 180;

export const wrapAngle = (angle) => {
    let out = Number.isFinite(angle) ? angle : 0;
    const twoPi = Math.PI * 2;
    while (out <= -Math.PI) out += twoPi;
    while (out > Math.PI) out -= twoPi;
    return out;
};

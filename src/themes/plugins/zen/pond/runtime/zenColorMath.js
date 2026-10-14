import { clamp as clampValue } from '../model/koi/koiMotion.js';

const toRgbHex = (r, g, b) => {
    const rr = clampValue(Math.round(Number(r) || 0), 0, 255);
    const gg = clampValue(Math.round(Number(g) || 0), 0, 255);
    const bb = clampValue(Math.round(Number(b) || 0), 0, 255);
    return (rr << 16) | (gg << 8) | bb;
};

export {
    toRgbHex,
};
